import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { QuestionContext } from "../../lib/platform/intake/intelligent-model";
import { controlledProofResponsesProvider } from "../../lib/platform/intake/intelligent-responses";
import { checkAttestation, exactProjection, manifestSha, proofModel, providerFailure, readManifest, runProof } from "../../scripts/intake/intelligent-live-proof";

test("provider refusals retain status and safe API error fields only", () => {
  assert.deepEqual(providerFailure("/v1/responses", 400, { error: {
    code: "invalid_json_schema", type: "invalid_request_error", param: "text.format.schema", message: "private body",
  } }), { path: "/v1/responses", status: 400, code: "invalid_json_schema", type: "invalid_request_error", param: "text.format.schema" });
  assert.deepEqual(providerFailure("/v1/responses/input_tokens", 401, { error: {
    code: "sk-proj-secret", type: "org_private", param: "private body", message: "private body",
  } }), { path: "/v1/responses/input_tokens", status: 401, code: null, type: null, param: null });
});

test("no-call preflight requires matching key, commit, project evidence and count price", () => {
  const key = "sk-proj-fake-for-offline-tests-only", commit = "a".repeat(40), now = Date.now();
  const receipt = {
    authorization: "6775948557", commit, manifestSha, project: "proj_test_only", organization: "org-test-only",
    credentialSha256: createHash("sha256").update(key).digest("hex"), validUntil: new Date(now + 60_000).toISOString(),
    rateCard: "openai-gpt54mini-standard-usd/2026-11-10.1", countMicros: 10_000, countPriceEvidence: "Fixture price reference",
    projectAccessEvidence: "Fixture project reference", dataControlsEvidence: "Fixture data controls reference",
    verified: { pinnedModelEnabled: true, restrictedEndpoints: true, billingAndPhaseBudget: true, trainingOptInDisabled: true,
      retentionAndCachingReviewed: true, projectCredentialProtected: true },
  } as const;
  assert.doesNotThrow(() => checkAttestation(receipt, commit, key, now));
  assert.throws(() => checkAttestation({ ...receipt, countMicros: 10_001 }, commit, key, now), /preflight evidence refused/);
  assert.throws(() => checkAttestation({ ...receipt, countPriceEvidence: "" }, commit, key, now), /preflight evidence refused/);
  assert.throws(() => checkAttestation(receipt, "b".repeat(40), key, now), /preflight evidence refused/);
  assert.throws(() => checkAttestation(receipt, commit, key + "_wrong", now), /preflight evidence refused/);
  assert.throws(() => checkAttestation(receipt, commit, key, now + 60_001), /preflight evidence refused/);
});

test("exact wire projection refuses alternate, foreign or augmented evidence", async () => {
  const manifest = await readManifest();
  const entryPath = "DIRECT_START" as const, { sources: evidence, gaps: [gap] } = manifest.contexts.c2;
  const context: QuestionContext = { entryPath, gap, evidence, history: [] };
  assert.deepEqual(exactProjection(context, entryPath, gap, evidence), context);
  const first = { id: "fixture-turn", gapId: gap.id, question: "What hours can urgent callers reach you?", rationale: "Local rationale",
    sourceIds: ["c2-site"], respondsTo: null, generatorVersion: "local-test", assessment: null, at: "local time",
    answer: { ...manifest.traces[3].answer, at: "local time" } };
  const wire = exactProjection({ ...context, history: [first] }, entryPath, gap, evidence, first, manifest.traces[3].answer);
  assert.equal(JSON.stringify(wire).includes("local time"), false);
  assert.throws(() => exactProjection({ ...context, evidence: manifest.contexts.c0.sources }, entryPath, gap, evidence), /projection mismatch/);
  assert.throws(() => exactProjection({ ...context, history: [first] }, entryPath, gap, evidence, first, manifest.traces[0].answer), /projection mismatch/);
  const augmented = { ...context, privateAnswer: "injected" };
  assert.throws(() => exactProjection(augmented, entryPath, gap, evidence), /projection mismatch/);
});

test("pinned proof driver uses seven exact count/generation pairs, offline", async () => {
  const directory = await mkdtemp(join(tmpdir(), "miopages-live-proof-fake-"));
  const oldNodeEnv = process.env.NODE_ENV, oldSynthesis = process.env.MIOPAGES_REVIEW_SYNTHESIS;
  Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" });
  try {
    let calls = 0, countBody: object | undefined;
    const rates = {
      model: proofModel, verifiedOn: "2026-11-10", inputPerMillion: 750_000, cachedPerMillion: 75_000,
      cacheWritePerMillion: 0, outputPerMillion: 4_500_000, countMicros: 10_000,
    };
    const findings = await runProof(directory, process.env.PG_BIN_DIR ?? "C:/Program Files/PostgreSQL/18/bin", rates, { async send(path, body) {
      calls++;
      assert.equal((body as { model: string }).model, proofModel);
      const wire = body as { input: string };
      assert.equal(JSON.stringify(body).includes("ownerDigest"), false);
      if (path === "/v1/responses/input_tokens") {
        assert.equal(calls % 2, 1);
        assert.deepEqual(Object.keys(body).sort(), ["input", "instructions", "model", "text"]);
        countBody = structuredClone(body);
        return { requestId: "req_fake_count", body: { input_tokens: 1_000 } };
      }
      assert.equal(calls % 2, 0);
      assert.deepEqual(body, { ...countBody, service_tier: "default", store: false, max_output_tokens: 1200 });
      const context = JSON.parse(wire.input) as QuestionContext;
      const prior = context.history[0];
      const sources = context.evidence.map(item => item.id);
      assert.equal(sources.some(id => id.startsWith("c0-")), context.gap.id !== "coverage");
      assert.equal(sources.some(id => id.includes("review")), context.entryPath === "FREE_REVIEW");
      const hasProof = prior?.answer?.text?.includes("have a dated");
      const question = prior
        ? context.gap.id === "coverage" ? "How will callers get routed outside the weekday coverage?"
          : hasProof ? "Who can clear the evidence before use?" : "Who will establish the first usable baseline?"
        : context.gap.id === "coverage" ? "When can urgent callers reach someone?" : "Which evidence would make the service promise credible?";
      const assessment = prior ? { recommendation: hasProof ? "Review the dated comparison privately." : "Keep the evidence gap open.",
        evidenceNeeded: hasProof ? null : "Confirm a baseline and owner." } : null;
      const proposal = { question, assessment, rationale: "Fixture generated response", sourceIds: prior ? [...sources.slice(0, 1), prior.id + ":answer"] : sources.slice(0, 1) };
      return { requestId: "req_fake_response", body: { id: "resp_fake", model: proofModel, service_tier: "default", status: "completed",
        usage: { input_tokens: 1000, output_tokens: 100, total_tokens: 1100, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } },
        output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(proposal) }] }] } };
    } });
    assert.equal(calls, 14);
    assert.equal(findings.length, 4);
    assert.equal(findings[0].initialQuestion, findings[1].initialQuestion);
    assert.equal(findings[0].after?.status, "planning-review");
    assert.equal(findings[1].after?.status, "open");
    const ledger = JSON.parse(await readFile(join(directory, "onboarding-usage.json"), "utf8"));
    assert.equal(ledger.attempts.length, 7);
    assert.equal(new Set(ledger.attempts.map((item: { ownerDigest: string }) => item.ownerDigest)).size, 2);
    assert.ok(ledger.attempts.every((item: { reservedMicros: number; estimatedMicros: number }) => item.reservedMicros === 18_400 && item.estimatedMicros === 11_200));
    const manifest = await readManifest(), { sources: evidence, gaps: [gap] } = manifest.contexts.c2;
    const exhausted = controlledProofResponsesProvider(directory, rates, { async send() {
      assert.fail("No eighth generation or fifteenth request is permitted");
    } }, context => context);
    await assert.rejects(exhausted.propose({ entryPath: "DIRECT_START", gap, evidence, history: [] },
      { ownerDigest: "a".repeat(64), workDigest: "b".repeat(64) }), /Development budget exhausted/);
  } finally {
    if (oldNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV"); else Object.assign(process.env, { NODE_ENV: oldNodeEnv });
    if (oldSynthesis === undefined) delete process.env.MIOPAGES_REVIEW_SYNTHESIS; else process.env.MIOPAGES_REVIEW_SYNTHESIS = oldSynthesis;
    await rm(directory, { recursive: true });
  }
});

test("failed first diagnostic preserves its reservation and stops before another call", async () => {
  const directory = await mkdtemp(join(tmpdir(), "miopages-live-proof-refusal-"));
  const oldNodeEnv = process.env.NODE_ENV, oldSynthesis = process.env.MIOPAGES_REVIEW_SYNTHESIS;
  Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" });
  try {
    const paths: string[] = [];
    await assert.rejects(runProof(directory, process.env.PG_BIN_DIR ?? "C:/Program Files/PostgreSQL/18/bin", {
      model: proofModel, verifiedOn: "2026-11-10", inputPerMillion: 750_000, cachedPerMillion: 75_000,
      cacheWritePerMillion: 0, outputPerMillion: 4_500_000, countMicros: 0,
    }, { async send(path) {
      paths.push(path);
      if (path === "/v1/responses/input_tokens") return { body: { input_tokens: 1_000 } };
      throw Error("Simulated API refusal");
    } }), /Required generated question/);
    assert.deepEqual(paths, ["/v1/responses/input_tokens", "/v1/responses"]);
    const ledger = JSON.parse(await readFile(join(directory, "onboarding-usage.json"), "utf8"));
    assert.equal(ledger.attempts.length, 1);
    assert.equal(ledger.attempts[0].reservedMicros, 8400);
    assert.equal(ledger.attempts[0].status, "pending");
  } finally {
    if (oldNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV"); else Object.assign(process.env, { NODE_ENV: oldNodeEnv });
    if (oldSynthesis === undefined) delete process.env.MIOPAGES_REVIEW_SYNTHESIS; else process.env.MIOPAGES_REVIEW_SYNTHESIS = oldSynthesis;
    await rm(directory, { recursive: true });
  }
});
