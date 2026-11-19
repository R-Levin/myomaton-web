import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import { fingerprint } from "../lib/platform/canonical/model";
import { originalMaterialInput, type OriginalMaterial, type OriginalMaterialGrant } from "../lib/platform/intake/presence-source-material";
import { prepareOriginalCustody, prepareRenderedCandidateCustody, readRenderedCandidateCustody } from "../lib/platform/intake/presence-original-custody";
import { readPage } from "../lib/platform/intake/presence-workflow-artifacts";
import type { WorkflowRun } from "../lib/platform/intake/presence-workflow";

const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const original = Buffer.from("Recorded business context, unchanged by a rendered review.");
const source: OriginalMaterial = { id: "business", sha256: hash(original), bytes: original.length, mime: "text/plain",
  reference: "Offline recorded source", author: "Fixture owner", date: "2026-11-19", status: "owner-confirmed",
  purpose: "business-context", operations: ["report", "page", "editorial"] };

function makeRun(): WorkflowRun {
  const context: WorkflowRun["context"] = { scope: { webPresenceId: "offline-presence", managedSiteId: "offline-site" }, intakeId: "offline-intake",
    entry: "DIRECT_START", evidence: [{ id: "business", kind: "owner-confirmed", label: "Fixture business", date: "2026-11-19",
      reference: source.reference, content: original.toString() }], limitations: [], conflicts: [] };
  const paths = ["/", "/service"];
  const pages = paths.map(path => readPage({ path, heading: "Fixture Page", searchTitle: "Fixture Page",
    searchDescription: "Offline source-contract fixture.", composition: "managed-v1", sections: [{ heading: "Fixture section",
      body: "Recorded business context.", sourceIds: ["business"], role: "hero", block: null,
      visual: { purpose: "Text only", brief: "No image", altIntent: "No image", status: "text-only" } }],
    actions: [{ label: "Discuss the service", kind: "request-contact", destination: null, sectionIndex: 0 }], internalLinks: [] }, path, paths, ["business"], {}, false, false, true));
  const input: WorkflowRun["input"] = { ...context, research: [], report: null, direction: null, blueprint: null, corrections: [], pages };
  return { context, input, work: { operation: "editorial", until: 0, inputDigest: fingerprint(input), attempt: "offline-render" } };
}

async function fixture() {
  const run = makeRun();
  const grant: OriginalMaterialGrant = { version: 1, contextDigest: fingerprint(run.context), records: [source], requestBytes: 500_000,
    candidateReview: { operations: ["editorial"], maximumRecords: 4, maximumBytes: 400_000 } };
  const representationDigest = fingerprint({ pages: run.input.pages, media: "no media in offline fixture" });
  const rows = [];
  for (const [index, page] of run.input.pages.entries()) {
    for (const viewport of ["desktop", "mobile"] as const) {
      const bytes = await sharp({ create: { width: viewport === "desktop" ? 144 : 39, height: 100, channels: 3,
        background: index ? "#16342a" : "#332f7e" } }).png().toBuffer();
      const descriptor: OriginalMaterial = { id: "render-" + index + "-" + viewport, sha256: hash(bytes), bytes: bytes.length,
        mime: "image/png", reference: "Offline renderer " + page.path, author: "Controlled fixture renderer", date: "2026-11-19",
        status: "unconfirmed", purpose: "candidate-review", operations: ["editorial"],
        reviewOf: { contextDigest: grant.contextDigest, inputDigest: run.work.inputDigest, representationDigest, path: page.path,
          viewport, representation: "wordpress-native-draft", variant: "core-candidate" } };
      rows.push({ source: descriptor, bytes });
    }
  }
  return { run, grant, rows };
}

test("exact current desktop/mobile pixels reach the request as derived review evidence, never business facts", async () => {
  const { run, grant, rows } = await fixture();
  const input = await originalMaterialInput(run, grant, { businessKnowledge: run.context.evidence, pages: run.input.pages },
    async () => [{ source, bytes: original }, ...rows]);
  const content = input[0].content;
  const images = content.filter(row => row.type === "input_image");
  assert.equal(images.length, 4);
  images.forEach((image, index) => assert.deepEqual(Buffer.from(image.image_url.split(",")[1], "base64"), rows[index].bytes));
  const instructions = JSON.parse((content[0] as { text: string }).text).interpretation;
  assert.match(instructions, /actual desktop\/mobile output/);
  const task = JSON.stringify(JSON.parse((content[0] as { text: string }).text).task.value);
  assert.doesNotMatch(task, /candidate-review|reviewOf/);
  const descriptors = content.filter(row => row.type === "input_text").flatMap(row => {
    try { return JSON.parse(row.text).originalSource ?? []; } catch { return []; }
  }) as OriginalMaterial[];
  assert.equal(descriptors.filter(row => row.purpose === "candidate-review" && row.status === "unconfirmed").length, 4);
  assert.equal(run.context.evidence.length, 1);
  // Without the new option, historical requests have neither new text nor a screenshot requirement.
  const historical = { ...grant, candidateReview: undefined };
  const oldInput = await originalMaterialInput(run, historical, {}, async () => [{ source, bytes: original }]);
  assert.doesNotMatch(JSON.stringify(oldInput), /Candidate-review|actual desktop\/mobile/);
});

test("stale, foreign, partial, ambiguous and unauthorized rendered reviews refuse before transport", async () => {
  const { run, grant, rows } = await fixture();
  const send = (materials = rows, permission = grant, current = run) =>
    originalMaterialInput(current, permission, {}, async () => [{ source, bytes: original }, ...materials]);
  for (const change of [
    (copy: typeof rows) => { copy.pop(); },
    (copy: typeof rows) => { copy[0].source.reviewOf!.inputDigest = "a".repeat(64); },
    (copy: typeof rows) => { copy[0].source.reviewOf!.contextDigest = "a".repeat(64); },
    (copy: typeof rows) => { copy[0].source.reviewOf!.path = "/other-customer"; },
    (copy: typeof rows) => { copy[0].source.reviewOf!.representationDigest = "a".repeat(64); },
    (copy: typeof rows) => { copy[0].source.reviewOf!.viewport = "mobile"; },
    (copy: typeof rows) => { copy[0].source.status = "owner-confirmed"; },
    (copy: typeof rows) => { copy[0].bytes = Buffer.from("changed"); },
    (copy: typeof rows) => { copy[0].source.reviewOf!.variant = "operator-proposed-preview"; },
  ]) {
    const copy = structuredClone(rows).map(row => ({ ...row, bytes: Buffer.from(row.bytes) }));
    change(copy);
    await assert.rejects(send(copy));
  }
  await assert.rejects(send([]), /Required rendered review/);
  await assert.rejects(send(rows, { ...grant, candidateReview: undefined }), /not authorized/);
  await assert.rejects(send(rows, { ...grant, candidateReview: { ...grant.candidateReview!, maximumBytes: 1 } }), /authorization/);
  await assert.rejects(send(rows, grant, { ...run, input: { ...run.input, corrections: [{ text: "changed" } as never] } }), /authorization/);
  const report = { ...run, work: { ...run.work, operation: "report" as const } };
  await assert.rejects(send(rows.map(row => ({ ...row, source: { ...row.source, operations: ["report"] } })), grant, report));
});

test("Operator-proposed output requires explicit scope and retains its distinct identity", async () => {
  const { run, grant, rows } = await fixture();
  for (const row of rows) row.source.reviewOf!.variant = "operator-proposed-preview";
  const permission = { ...grant, candidateReview: { ...grant.candidateReview!, includeOperatorProjections: true } };
  const input = await originalMaterialInput(run, permission, {}, async () => [{ source, bytes: original }, ...rows]);
  assert.match(JSON.stringify(input), /operator-proposed-preview/);
  assert.match(JSON.stringify(input), /must not be described as the unchanged canonical site/);
});

test("private rendered evidence is durably reusable and refuses conflicting, altered or misbound custody", async () => {
  const { run, grant, rows } = await fixture();
  const root = await mkdtemp(join(tmpdir(), "miopages-rendered-review-"));
  try {
    await prepareOriginalCustody(root, grant, fingerprint(run.context), async () => original);
    const originalIndex = await readFile(join(root, "index.json"));
    const result = await prepareRenderedCandidateCustody(root, run, grant, rows);
    assert.equal(result.records, 4);
    assert.deepEqual(await prepareRenderedCandidateCustody(root, run, grant, rows), result);
    assert.deepEqual(await readRenderedCandidateCustody(root, run, grant), rows);
    assert.deepEqual(await readFile(join(root, "index.json")), originalIndex);
    const changed = structuredClone(rows).map(row => ({ ...row, bytes: Buffer.from(row.bytes) }));
    changed[0].source.author = "Conflicting renderer";
    await assert.rejects(prepareRenderedCandidateCustody(root, run, grant, changed), /conflict/);
    const indexPath = join(root, run.work.inputDigest + ".review.json");
    const index = JSON.parse((await readFile(indexPath)).toString());
    await writeFile(indexPath, JSON.stringify({ ...index, contextDigest: "f".repeat(64) }));
    await assert.rejects(readRenderedCandidateCustody(root, run, grant), /binding changed/);
    await writeFile(indexPath, JSON.stringify(index));
    await writeFile(join(root, rows[0].source.sha256 + ".source"), Buffer.from("changed"));
    await assert.rejects(readRenderedCandidateCustody(root, run, grant), /bytes changed/);
    const foreign = { ...run, context: { ...run.context, intakeId: "foreign" } };
    await assert.rejects(readRenderedCandidateCustody(root, foreign, grant), /authorization differs/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("the normal metered provider receives the rendered evidence, with durable custody before count and generation", async () => {
  const { createResponsesPresenceWorkflow } = await import("../lib/platform/intake/presence-workflow-provider");
  const { initializeResponsesUsageLedger } = await import("../lib/platform/intake/intelligent-responses");
  const { run, grant: materials, rows } = await fixture();
  const root = await mkdtemp(join(tmpdir(), "miopages-rendered-request-"));
  try {
    const rates = { model: "offline-model", verifiedOn: "2026-11-19", inputPerMillion: 750_000, cachedPerMillion: 75_000,
      outputPerMillion: 4_500_000, cacheWritePerMillion: 0, countMicros: 0 };
    await initializeResponsesUsageLedger(root, rates);
    const grant = { contextDigest: fingerprint(run.context), approvedSources: run.context.evidence.map(fingerprint), approvedCorrections: [],
      originalMaterials: materials, researchSources: [{ id: "research:offline", url: "https://example.org/", label: "Not fetched" }],
      researchResponseBytes: 10_000, expiresAt: Date.now() + 60_000, maxOutputTokens: 1000,
      ledger: { id: fingerprint("offline-render-grant"), startingLedger: hash(await readFile(join(root, "onboarding-usage.json"))),
        baselineAttempts: 0, requests: 2, generations: 1, inputTokens: 2000, inputBytes: 500_000, capMicros: 20_000 } };
    let retainedInput: Buffer | undefined, retainedOutput: Buffer | undefined, calls = 0;
    const result = { summary: "Offline double only, not a visual-quality judgment.", concerns: [] };
    const provider = createResponsesPresenceWorkflow({ grant, readGrant: async () => grant, readContext: async () => run.context,
      ledgerDirectory: root, rates, fetchPage: async () => { throw Error("No network"); },
      readOriginalMaterials: async () => [{ source, bytes: original }, ...rows],
      retainRequest: async (_run, bytes) => { retainedInput = bytes; },
      transport: { async send(path, body) {
        calls++;
        assert.ok(retainedInput, "Private request custody precedes even token counting");
        const request = body as { input: { content: { type: string; image_url?: string }[] }[]; store: boolean };
        const images = request.input[0].content.filter(row => row.type === "input_image");
        assert.equal(images.length, 4);
        images.forEach((image, index) => assert.deepEqual(Buffer.from(image.image_url!.split(",")[1], "base64"), rows[index].bytes));
        if (path.endsWith("/input_tokens")) return { body: { input_tokens: 1000 } };
        assert.equal(request.store, false);
        const response = { id: "resp_offline_render", model: rates.model, status: "completed", service_tier: "default",
          usage: { input_tokens: 1000, output_tokens: 30, total_tokens: 1030, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } },
          output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(result) }] }] };
        return { body: response, rawBody: Buffer.from(JSON.stringify(response)) };
      } } });
    assert.deepEqual(await provider.run(run, async bytes => { retainedOutput = bytes; }), result);
    assert.ok(retainedOutput);
    assert.deepEqual(await provider.recover(run, retainedOutput), result);
    assert.equal(calls, 2, "Recovering retained output never makes another request");
  } finally { await rm(root, { recursive: true, force: true }); }
});
