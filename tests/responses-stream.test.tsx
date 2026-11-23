import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import { fingerprint } from "../lib/platform/canonical/model";
import { initializeResponsesUsageLedger, meteredPresenceWorkflow, settleLostAnswer,
  type ResponsesRates } from "../lib/platform/intake/intelligent-responses";
import { streamedAnswer } from "../lib/platform/intake/responses-https";

const answer = { id: "resp_long", model: "test-model", service_tier: "default", status: "completed",
  usage: { input_tokens: 2, input_tokens_details: { cached_tokens: 0 }, output_tokens: 2, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 4 },
  output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "{}" }] }] };
const sse = (type: string, extra: object) => `event: ${type}\r\ndata: ${JSON.stringify({ type, ...extra })}\r\n\r\n`;

test("a streamed answer is received however long it takes, and its identity is recorded at the start", async () => {
  const stream = new PassThrough();
  const seen: string[] = [];
  const reply = streamedAnswer(stream, "req_1", async ids => { seen.push(ids.responseId + "/" + ids.requestId); });
  const body = sse("response.created", { response: { id: "resp_long", status: "in_progress" } }) +
    sse("response.output_text.delta", { delta: "x".repeat(5000) }).repeat(50) + sse("response.completed", { response: answer });
  // Split at awkward places, as a slow network would.
  for (let at = 0; at < body.length; at += 977) stream.write(body.slice(at, at + 977));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(seen, ["resp_long/req_1"]);
  stream.end();
  const result = await reply;
  assert.deepEqual(result.body, answer);
  assert.equal(result.rawBody.toString("utf8"), JSON.stringify(answer));
  assert.equal(result.requestId, "req_1");
});

test("a stream that ends without a final answer, or goes silent, is refused rather than guessed", async () => {
  const cut = new PassThrough();
  const started: string[] = [];
  const partial = streamedAnswer(cut, undefined, async ids => { started.push(ids.responseId); });
  cut.end(sse("response.created", { response: { id: "resp_cut" } }) + sse("response.output_text.delta", { delta: "half" }));
  await assert.rejects(partial, /unavailable/);
  assert.deepEqual(started, ["resp_cut"]);

  const silent = Object.assign(new PassThrough(), { setTimeout(ms: number, callback: () => void) { setTimeout(callback, ms); } });
  const waiting = streamedAnswer(silent, undefined, undefined, 20);
  silent.write(sse("response.created", { response: { id: "resp_silent" } }));
  await assert.rejects(waiting, /silent/);
});

test("a lost answer stays on record at its full reservation and frees the case for a retry", async () => {
  const directory = await mkdtemp(join(tmpdir(), "miopages-lost-answer-"));
  try {
    const rates: ResponsesRates = { model: "test-model", verifiedOn: "2026-11-23", inputPerMillion: 750_000,
      cachedPerMillion: 75_000, cacheWritePerMillion: 0, outputPerMillion: 4_500_000, countMicros: 0 };
    await initializeResponsesUsageLedger(directory, rates);
    const ledger = join(directory, "onboarding-usage.json");
    const scope = { id: fingerprint("case"), startingLedger: createHash("sha256").update(await readFile(ledger)).digest("hex"),
      baselineAttempts: 0, requests: 6, generations: 3, capMicros: 900_000, inputTokens: 10, inputBytes: 1000 };
    const ownerDigest = fingerprint("owner");
    let lose = true;
    const text = meteredPresenceWorkflow(directory, rates, { async send(path, _body, started) {
      if (path.endsWith("/input_tokens")) return { body: { input_tokens: 2 } };
      await started?.({ responseId: lose ? "resp_lost" : "resp_long", requestId: "req_x" });
      if (lose) throw Error("Responses HTTPS result unavailable");
      return { body: answer, rawBody: Buffer.from(JSON.stringify(answer)) };
    } }, scope, 20);
    const request = { model: rates.model, instructions: "fixture", input: "fixture", text: { format: {} } };
    const lost = fingerprint("revision attempt 1");
    await assert.rejects(text({ ownerDigest, workDigest: lost }, request), /unavailable/);
    let rows = JSON.parse(await readFile(ledger, "utf8")).attempts;
    assert.equal(rows[0].status, "pending");
    assert.equal(rows[0].responseId, "resp_lost", "the provider's answer id is on record although the answer never arrived");
    // An unsettled charge blocks further spending until it is settled.
    await assert.rejects(text({ ownerDigest, workDigest: fingerprint("revision attempt 2") }, request), /Unreconciled/);
    const settled = await settleLostAnswer(directory, scope, ownerDigest, lost, "2026-11-23T18:30:00.000Z");
    assert.equal(settled.responseId, "resp_lost");
    await assert.rejects(settleLostAnswer(directory, scope, ownerDigest, lost, "2026-11-23T18:31:00.000Z"), /No lost answer/);
    rows = JSON.parse(await readFile(ledger, "utf8")).attempts;
    assert.equal(rows[0].status, "lost");
    assert.equal(rows[0].estimatedMicros, rows[0].reservedMicros);
    lose = false;
    await text({ ownerDigest, workDigest: fingerprint("revision attempt 2") }, request);
    assert.deepEqual(JSON.parse(await readFile(ledger, "utf8")).attempts.map((row: { status: string }) => row.status), ["lost", "completed"]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
