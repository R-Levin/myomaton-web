import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fingerprint } from "../lib/platform/canonical/model";
import { initializeResponsesUsageLedger } from "../lib/platform/intake/intelligent-responses";
import { createAiWriter } from "../lib/platform/service/ai-writer";
import { currentSite, openRecord, respond, startLaunch, tasks, work, type ServiceRecord } from "../lib/platform/service/cycle";
import { offlineAi } from "./helpers/simulated-ai";

const account = { webPresenceId: "819d007a-595d-4374-a2f0-96b900d46559", managedSiteId: "1d92a248-416f-4e22-baaf-d2f1fca70352" };
const knowledge = [
  { key: "audience", kind: "audience", value: "Owner-led service businesses", status: "confirmed", forWebsite: true },
  { key: "margin", kind: "fact", value: "Margins are thin", status: "proposed", forWebsite: false },
  { name: "Managed Web Presence", summary: "Launch and Ongoing", detail: "", audiences: [], inclusions: [], exclusions: [], status: "confirmed" },
];
const rates = { model: "offline-model", verifiedOn: "2026-11-25", inputPerMillion: 750_000, cachedPerMillion: 75_000,
  outputPerMillion: 4_500_000, cacheWritePerMillion: 0, countMicros: 0 };

test("the real writer runs Launch through the metered AI connection, citing only the Account's own Knowledge", async () => {
  const root = await mkdtemp(join(tmpdir(), "miopages-ai-writer-"));
  try {
    await initializeResponsesUsageLedger(root, rates);
    const budget = { id: fingerprint("ai-writer-test"), startingLedger: createHash("sha256").update(await readFile(join(root, "onboarding-usage.json"))).digest("hex"),
      baselineAttempts: 0, requests: 40, generations: 20, inputTokens: 1_000_000, inputBytes: 5_000_000, capMicros: 5_000_000 };
    const { transport, sent } = offlineAi(rates.model);
    const writer = createAiWriter({ account, ledgerDirectory: root, rates, transport, budget, outputLimit: 20_000 });
    const client = { id: "client@example.test", role: "customer" as const }, specialist = { id: "specialist", role: "operator" as const };
    let record: ServiceRecord = startLaunch(openRecord(account), "2026-11-25T12:00:00.000Z", specialist);
    for (let step = 0; step < 8 && !currentSite(record)?.complete; step++) {
      for (const task of tasks(record).filter(item => item.who === "core")) record = await work(record, task, writer, knowledge, `2026-11-25T12:${10 + step}:00.000Z`);
      for (const task of tasks(record).filter(item => item.who !== "core"))
        record = respond(record, task.changeId!, task.who === "client" ? client : specialist, "approve", `2026-11-25T12:${10 + step}:30.000Z`);
    }
    const site = currentSite(record);
    assert.ok(site?.complete, "Launch reaches a complete site");
    assert.deepEqual(sent.map(item => item.name).slice(0, 3), ["core_report", "core_direction", "core_blueprint"]);
    assert.ok(sent.slice(3).every(item => item.name === "core_page"));
    // Citations are bound to the Account's own Knowledge, with its standing.
    const reportIds = (sent[0].schema.properties!.findings.items!.properties!.sourceIds.items!.enum) as string[];
    assert.deepEqual(reportIds, ["knowledge:audience", "knowledge:margin", "offering:Managed Web Presence"]);
    assert.match(sent[0].input, /"standing":"proposed"/);
    assert.match(sent[0].instructions, /never present it as established/);
    // The ledger recorded every call against the Account's budget.
    const ledger = JSON.parse(await readFile(join(root, "onboarding-usage.json"), "utf8"));
    assert.ok(JSON.stringify(ledger).includes(fingerprint(account)), "Each call is recorded for this Account");
    assert.equal(site!.pages[0].path, "/");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a refused answer is kept and Core gets one more attempt, told why it was refused", async () => {
  const root = await mkdtemp(join(tmpdir(), "miopages-ai-writer-retry-"));
  try {
    await initializeResponsesUsageLedger(root, rates);
    const budget = { id: fingerprint("ai-writer-retry-test"), startingLedger: createHash("sha256").update(await readFile(join(root, "onboarding-usage.json"))).digest("hex"),
      baselineAttempts: 0, requests: 40, generations: 20, inputTokens: 100_000, inputBytes: 5_000_000, capMicros: 5_000_000 };
    const offline = offlineAi(rates.model);
    let generations = 0;
    // The first answer comes back empty, which the check refuses; the second is the usual answer.
    const transport = { async send(path: string, body: unknown, ...rest: unknown[]) {
      const reply = await (offline.transport.send as (...args: unknown[]) => Promise<{ body: unknown; rawBody?: Buffer }>)(path, body, ...rest);
      if (path.endsWith("/input_tokens") || generations++ > 0) return reply;
      const response = structuredClone(reply.body) as { output: { content: { text: string }[] }[] };
      response.output[0].content[0].text = "{}";
      return { body: response, rawBody: Buffer.from(JSON.stringify(response)) };
    } } as typeof offline.transport;
    const kept: { digest?: string; answer: unknown }[] = [];
    const writer = createAiWriter({ account, ledgerDirectory: root, rates, transport, budget, outputLimit: 20_000,
      retain: async entry => { kept.push(entry); },
      refusals: async digest => kept.filter(entry => entry.digest === digest && (entry.answer as { refused?: string }).refused).length });
    const specialist = { id: "specialist", role: "operator" as const };
    let record: ServiceRecord = startLaunch(openRecord(account), "2026-11-25T12:00:00.000Z", specialist);
    const [task] = tasks(record).filter(item => item.who === "core");
    record = await work(record, task!, writer, knowledge, "2026-11-25T12:10:00.000Z");
    assert.equal(kept.length, 2, "The refused answer and the accepted one are both kept");
    assert.ok((kept[0].answer as { refused?: string }).refused, "The first answer is kept as refused, with its reason");
    assert.equal(offline.sent.length, 2, "One retry, no more");
    assert.doesNotMatch(offline.sent[0].instructions, /was refused/);
    assert.match(offline.sent[1].instructions, /Your previous answer to this was refused by Core's check: .+/);
    assert.ok(tasks(record).some(item => item.who !== "core"), "The Report now waits for review");
  } finally { await rm(root, { recursive: true, force: true }); }
});
