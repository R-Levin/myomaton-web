import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fingerprint } from "../lib/platform/canonical/model";
import { initializeResponsesUsageLedger, type ResponsesTransport } from "../lib/platform/intake/intelligent-responses";
import { createAiWriter } from "../lib/platform/service/ai-writer";
import { ask, current, currentSite, openRecord, respond, startLaunch, tasks, work, type PageContent, type ServiceRecord } from "../lib/platform/service/cycle";
import { compareWords } from "../lib/platform/service/page-words";
import { pageIdentity } from "../lib/platform/work-products/pages";
import { offlineAi } from "./helpers/simulated-ai";

const account = { webPresenceId: "6a1f3e0c-3f53-4d43-9d0e-6f1c2a7b9e11", managedSiteId: "2c4e6a80-1b3d-4f57-8a9c-0e2f4a6c8e01" };
const knowledge = [{ key: "audience", kind: "audience", value: "Owner-led service businesses", status: "confirmed", forWebsite: true }];
const rates = { model: "offline-model", verifiedOn: "2026-11-28", inputPerMillion: 750_000, cachedPerMillion: 75_000,
  outputPerMillion: 4_500_000, cacheWritePerMillion: 0, countMicros: 0 };
const specialist = { id: "specialist", role: "operator" as const }, client = { id: "client@example.test", role: "customer" as const };

type Node = { kind: string; text: string | null; level: number | null; items: string[]; children: Node[]; [key: string]: unknown };
const layout = { arrangement: "flow", columns: [], gap: "medium", inset: "none", surface: "none", align: "start", measure: "reading",
  typeScale: "body", span: 12, mobileOrder: 0, border: false, rounded: false };
const node = (kind: string, text: string | null, extra: Partial<Node> = {}): Node =>
  ({ kind, text, level: null, items: [], ordered: false, reference: null, layout, children: [], ...extra });
const firstHeading = (n: Node): string => n.kind === "heading" ? n.text! : n.children.map(firstHeading).find(Boolean) ?? "";

/** What a designer would return for "lay this page out again": every piece, each section designed, the list order reversed. */
function relayout(arrangement: PageContent) {
  return { sections: arrangement.sections.map(raw => {
    const s = raw as { heading: string; body: string; role: string; visual: unknown; moreVisuals?: unknown; block?: { version?: number; mode?: string; root: Node; groups?: { heading: string; body: string; items: string[] }[] } };
    if (s.block?.version === 2 && s.block.mode === "section") {
      const block = structuredClone(s.block);
      (block.root as unknown as { layout: { gap: string } }).layout.gap = "small"; // a new arrangement, the same pieces
      return { heading: firstHeading(block.root), role: s.role, visual: s.visual, moreVisuals: s.moreVisuals ?? [], block };
    }
    const paras = (t: string) => String(t).split(/\n\s*\n/u).map(x => x.trim()).filter(x => /^w\d+$/u.test(x));
    const kids = [node("heading", s.heading, { level: s.role === "hero" ? 1 : 2 }), ...paras(s.body).map(id => node("paragraph", id))];
    for (const g of s.block?.groups ?? []) {
      if (/^w\d+$/u.test(g.heading)) kids.push(node("heading", g.heading, { level: 3 }));
      kids.push(...paras(g.body).map(id => node("paragraph", id)));
      if (g.items.length) kids.push(node("list", null, { items: [...g.items].reverse() }));
    }
    if (s.block?.version === 2) kids.push(s.block.root);
    return { heading: s.heading, role: s.role, visual: s.visual, moreVisuals: s.moreVisuals ?? [],
      block: { version: 2, name: "relaid", purpose: "A new arrangement", mode: "section", root: node("group", null, { children: kids }) } };
  }) };
}

/** The offline AI, answering a words or layout change from what it was given; `tamper` makes it misbehave. */
function aiFor(tamper?: (answer: { sections: { block: { root: Node } }[] }) => void) {
  const offline = offlineAi(rates.model);
  const sent: { name: string; input: string; schema: unknown; instructions: string }[] = [];
  const transport: ResponsesTransport = { async send(path, body) {
    const request = body as { instructions: string; input: string; text: { format: { name: string; schema: unknown } } };
    const name = request.text?.format?.name;
    if (path.endsWith("/input_tokens") || (name !== "core_page_layout" && name !== "core_page_words")) return offline.transport.send(path, body);
    sent.push({ name, input: request.input, schema: request.text.format.schema, instructions: request.instructions });
    const given = JSON.parse(request.input) as { words: { id: string; text: string }[]; arrangement: PageContent };
    let output: unknown;
    if (name === "core_page_layout") { const answer = relayout(given.arrangement); tamper?.(answer as never); output = answer; }
    else output = { change: [{ id: given.words[1]!.id, text: "Reworded by request." }], remove: [], add: [] };
    const response = { id: "resp_grain_" + sent.length, model: rates.model, status: "completed", service_tier: "default",
      usage: { input_tokens: 2000, output_tokens: 400, total_tokens: 2400, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } },
      output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(output) }] }] };
    return { body: response, rawBody: Buffer.from(JSON.stringify(response)) };
  } };
  return { transport, sent };
}

async function launched(root: string, transport: ResponsesTransport, kept: { digest?: string; answer: unknown }[] = []) {
  await initializeResponsesUsageLedger(root, rates);
  const budget = { id: fingerprint("page-grains-" + root), startingLedger: createHash("sha256").update(await readFile(join(root, "onboarding-usage.json"))).digest("hex"),
    baselineAttempts: 0, requests: 60, generations: 30, inputTokens: 2_000_000, inputBytes: 9_000_000, capMicros: 9_000_000 };
  const writer = createAiWriter({ account, ledgerDirectory: root, rates, transport, budget, outputLimit: 20_000,
    retain: async entry => { kept.push(entry); },
    refusals: async digest => kept.filter(entry => entry.digest === digest && (entry.answer as { refused?: string }).refused).length });
  let record: ServiceRecord = startLaunch(openRecord(account), "2026-11-28T10:00:00.000Z", specialist);
  for (let step = 0; step < 8 && !currentSite(record)?.complete; step++) {
    for (const task of tasks(record).filter(item => item.who === "core")) record = await work(record, task, writer, knowledge, `2026-11-28T10:${10 + step}:00.000Z`);
    for (const task of tasks(record).filter(item => item.who !== "core"))
      record = respond(record, task.changeId!, task.who === "client" ? client : specialist, "approve", `2026-11-28T10:${10 + step}:30.000Z`);
  }
  return { record, writer };
}

const servicePage = (record: ServiceRecord) => current(record, pageIdentity(account.managedSiteId, "/service"))!;

test("a layout change rearranges the page and its words come back exactly, through the real writer", async () => {
  const root = await mkdtemp(join(tmpdir(), "miopages-page-layout-"));
  try {
    const ai = aiFor();
    let { record, writer } = await launched(root, ai.transport);
    const before = servicePage(record);
    record = ask(record, { id: "layout-1", at: "2026-11-28T11:00:00.000Z", by: specialist, kind: "page", path: "/service", grain: "page-layout",
      words: "Lay this page out to the design brief." });
    const task = tasks(record).find(item => item.who === "core")!;
    assert.match(task.what, /layout of the page \/service/u);
    record = await work(record, task, writer, knowledge, "2026-11-28T11:01:00.000Z");
    const proposed = record.products.find(item => item.status === "proposed")!;
    assert.equal(compareWords(before.content as PageContent, proposed.content as PageContent).unchanged, true, "every word unchanged");
    assert.notEqual(JSON.stringify(proposed.content), JSON.stringify(before.content), "the arrangement did change");
    const change = record.ledger.changes.find(item => item.id === proposed.changeId)!;
    assert.equal(change.target.grain, "page-layout");
    // Core was given numbered pieces and an arrangement, never the page's text in place.
    const sent = ai.sent[0]!;
    assert.equal(sent.name, "core_page_layout");
    assert.match(sent.instructions, /This is a layout change/u);
    const given = JSON.parse(sent.input) as { words: unknown[]; previous?: unknown };
    assert.ok(given.words.length > 0 && given.previous === undefined);
    // A correction of a layout change stays a layout change.
    record = respond(record, proposed.changeId, specialist, "correct", "2026-11-28T11:02:00.000Z", "Fewer boxes.");
    assert.ok(record.ledger.requests.some(item => item.status === "open" && item.target.grain === "page-layout"));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a layout that changes a word is refused, sent back once with the reason, and never becomes a version", async () => {
  const root = await mkdtemp(join(tmpdir(), "miopages-page-layout-tamper-"));
  try {
    const ai = aiFor(answer => { answer.sections[0]!.block.root.children.push(node("paragraph", "A sentence Core made up.")); });
    const kept: { digest?: string; answer: unknown }[] = [];
    let { record, writer } = await launched(root, ai.transport, kept);
    record = ask(record, { id: "layout-2", at: "2026-11-28T11:00:00.000Z", by: specialist, kind: "page", path: "/service", grain: "page-layout", words: "Again." });
    const task = tasks(record).find(item => item.who === "core")!;
    await assert.rejects(work(record, task, writer, knowledge, "2026-11-28T11:01:00.000Z"));
    assert.equal(ai.sent.length, 2, "one more attempt, then stop");
    assert.match(ai.sent[1]!.instructions, /refused by Core's check/u);
    assert.ok(kept.some(entry => /not one of the page's pieces/u.test(String((entry.answer as { refused?: string }).refused))), "the refusal is kept with its reason");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a word change edits only the words asked for; the layout stays", async () => {
  const root = await mkdtemp(join(tmpdir(), "miopages-page-words-"));
  try {
    const ai = aiFor();
    let { record, writer } = await launched(root, ai.transport);
    const before = servicePage(record);
    record = ask(record, { id: "words-1", at: "2026-11-28T11:00:00.000Z", by: specialist, kind: "page", path: "/service", grain: "page-words", words: "Reword the first line." });
    record = await work(record, tasks(record).find(item => item.who === "core")!, writer, knowledge, "2026-11-28T11:01:00.000Z");
    const proposed = record.products.find(item => item.status === "proposed")!;
    const diff = compareWords(before.content as PageContent, proposed.content as PageContent);
    assert.equal(diff.gone.length, 1);
    assert.deepEqual(diff.added, ["Reworded by request."]);
    assert.equal(ai.sent[0]!.name, "core_page_words");
  } finally { await rm(root, { recursive: true, force: true }); }
});
