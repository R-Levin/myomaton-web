import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import { fingerprint } from "../lib/platform/canonical/model";
import { originalMaterialInput, type OriginalMaterial, type OriginalMaterialGrant } from "../lib/platform/intake/presence-source-material";
import { createResponsesPresenceWorkflow, type PresenceWorkflowGrant } from "../lib/platform/intake/presence-workflow-provider";
import { initializeResponsesUsageLedger, type ResponsesRates } from "../lib/platform/intake/intelligent-responses";
import type { WorkflowContext, WorkflowRun } from "../lib/platform/intake/presence-workflow";
import { retrievePublicResearch } from "../lib/platform/intake/presence-workflow-research";

const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const context: WorkflowContext = { scope: { webPresenceId: "local-source-test", managedSiteId: "local-site-test" },
  intakeId: "local-intake-test", entry: "DIRECT_START", evidence: [{ id: "business", kind: "owner-confirmed",
    reference: "fixture", date: "2026-11-18", content: "Approved fixture offer", label: "Fixture" }], limitations: [], conflicts: [] };
const input = { evidence: context.evidence, entry: context.entry, limitations: [], conflicts: [], report: null, research: null,
  direction: null, blueprint: null, pages: [], corrections: [] };
const run: WorkflowRun = { context, input, work: { operation: "report", until: 0, inputDigest: fingerprint(input), attempt: "original-test" } };
function source(bytes: Buffer, id: string, mime: OriginalMaterial["mime"]): OriginalMaterial {
  return { id, bytes: bytes.length, sha256: hash(bytes), mime, reference: "original fixture " + id, author: "Test owner",
    date: "2026-11-18", status: "unconfirmed", purpose: "business-context", operations: ["report", "page", "editorial"] };
}

test("actual metered requests carry complete original text and image bytes, with status and durable input custody", async () => {
  const directory = await mkdtemp(join(tmpdir(), "miopages-full-originals-"));
  try {
    const original = Buffer.from("Unconfirmed original beginning.\n" + "Detailed customer context. ".repeat(900) + "\nExact original ending.");
    const image = await sharp({ create: { width: 144, height: 90, channels: 3, background: "#322f7e" } }).png().toBuffer();
    const rows = [{ source: source(original, "owner-original", "text/plain"), bytes: original },
      { source: { ...source(image, "peer-visual", "image/png"), status: "public-observation" as const, purpose: "market-research" as const }, bytes: image }];
    const materials: OriginalMaterialGrant = { version: 1, contextDigest: fingerprint(context), records: rows.map(row => row.source), requestBytes: 2_000_000 };
    const rates: ResponsesRates = { model: "test-model", verifiedOn: "2026-11-18", inputPerMillion: 750_000,
      cachedPerMillion: 75_000, outputPerMillion: 4_500_000, cacheWritePerMillion: 0, countMicros: 0 };
    await initializeResponsesUsageLedger(directory, rates);
    const grant: PresenceWorkflowGrant = { contextDigest: fingerprint(context), approvedSources: context.evidence.map(fingerprint),
      approvedCorrections: [], originalMaterials: materials, researchResponseBytes: 1000,
      researchSources: [{ id: "research:fixture", url: "https://example.org/", label: "Fixture" }],
      maxOutputTokens: 2000, maxRetries: 0, expiresAt: Date.now() + 60_000,
      ledger: { id: fingerprint("originals-grant"), inputTokens: 12_000, inputBytes: 2_000_000,
        startingLedger: hash(await readFile(join(directory, "onboarding-usage.json"))), baselineAttempts: 0, requests: 2, generations: 1, capMicros: 30_000 } };
    const output = { title: "Fixture report", summary: "Fixture only", findings: [
      { id: "fixture", heading: "Uncertainty stays visible", body: "A proposed interpretation.", status: "proposed", sourceIds: ["business"] }] };
    const reply = { id: "resp_original_fixture", model: rates.model, status: "completed", service_tier: "default",
      usage: { input_tokens: 10_000, output_tokens: 100, total_tokens: 10_100,
        input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } },
      output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(output) }] }] };
    let request: Buffer | undefined;
    let response: Buffer | undefined;
    let calls = 0;
    const provider = createResponsesPresenceWorkflow({ grant, readGrant: async () => grant, readContext: async () => context,
      rates, ledgerDirectory: directory, fetchPage: async () => { throw Error("No network"); },
      readOriginalMaterials: async () => rows, retainRequest: async (_run, bytes) => { request = bytes; },
      transport: { async send(path, body) {
        calls++;
        assert.ok(request, "Request is retained before any provider count or generation");
        const supplied = body as { input: { content: { type: string; text?: string; image_url?: string }[] }[]; store?: boolean };
        const content = supplied.input[0].content;
        assert.ok(content.some(row => row.type === "input_text" && row.text === original.toString()));
        const png = content.find(row => row.type === "input_image")!;
        assert.deepEqual(Buffer.from(png.image_url!.split(",")[1], "base64"), image);
        assert.match(JSON.stringify(content), /unconfirmed/);
        if (path.endsWith("input_tokens")) return { body: { input_tokens: 10_000 } };
        assert.equal(supplied.store, false);
        return { body: reply, rawBody: Buffer.from(JSON.stringify(reply)) };
      } } });
    assert.deepEqual(await provider.run(run, async bytes => { response = bytes; }), output);
    assert.equal(calls, 2);
    assert.deepEqual(await provider.recover(run, response!), output);
    assert.equal(calls, 2, "Recovery never repeats provider dispatch");
    await assert.rejects(originalMaterialInput(run, materials, {}, async () => [{ ...rows[0], bytes: Buffer.from("changed") }, rows[1]]), /bytes changed/);
    await assert.rejects(originalMaterialInput(run, materials, {}, async () => rows.slice(1)), /unavailable/);
    await assert.rejects(originalMaterialInput({ ...run, context: { ...context, intakeId: "foreign" } }, materials, {}, async () => rows), /authorization differs/);
    await assert.rejects(originalMaterialInput(run, { ...materials, requestBytes: 1000 }, {}, async () => rows), /divide the source set/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("research preserves full observed text and original HTML rather than a developer excerpt", async () => {
  const html = Buffer.from("<nav>Visitor choices</nav><main>" + "Original peer material. ".repeat(700) + "</main><footer>Scope details</footer>");
  let retained: Buffer | undefined;
  let rendered: Buffer | undefined;
  const result = await retrievePublicResearch([{ id: "research:example", url: "https://example.org/", label: "Example" }], 100_000,
    async () => {}, async url => {
      const response = new Response(html, { headers: { "content-type": "text/html" } });
      Object.defineProperty(response, "url", { value: String(url) });
      return response;
    }, Date.now, undefined, {
      retain: async (_source, bytes) => { retained = bytes; }, render: async (_source, bytes) => { rendered = bytes; },
    });
  assert.deepEqual(retained, html);
  assert.deepEqual(rendered, html);
  assert.ok(result[0].content.length > 12_000);
  assert.match(result[0].content, /Visitor choices/);
  assert.match(result[0].content, /Scope details/);
  assert.doesNotMatch(result[0].content, /public excerpt/);
});

test("a bounded visual-capture stop preserves complete source text and marks the missing visual evidence", async()=>{
 const html=Buffer.from("<main>Complete public evidence remains available.</main>");
 const read=async(url:RequestInfo|URL)=>{const r=new Response(html,{headers:{"content-type":"text/html"}});Object.defineProperty(r,"url",{value:String(url)});return r};
 const result=await retrievePublicResearch([{id:"research:partial",url:"https://example.org/",label:"Fixture"}],10000,async()=>{},read,Date.now,undefined,
  {retain:async()=>{},render:async()=>{throw Error("Research capture envelope unavailable")}});
 assert.equal(result[0].captureStatus,"incomplete");
 assert.equal(result[0].content,"Complete public evidence remains available.");
 await assert.rejects(retrievePublicResearch([{id:"research:partial",url:"https://example.org/",label:"Fixture"}],10000,async()=>{},read,Date.now,undefined,
  {retain:async()=>{},render:async()=>{throw Error("Private research directory refused")}}),/directory refused/);
});
