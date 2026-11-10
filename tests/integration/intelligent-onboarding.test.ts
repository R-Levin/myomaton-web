import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { source } from "../../lib/platform/activation/model";
import { IntelligentOnboarding } from "../../lib/platform/intake/intelligent";
import { readProposal, type InterviewEvidence, type InterviewGap, type QuestionContext } from "../../lib/platform/intake/intelligent-model";
import { initializeOfflineUsageLedger, offlineResponsesProvider, type OfflineResponsesTransport } from "../../lib/platform/intake/intelligent-responses";
import { IntakeService } from "../../lib/platform/intake/service";
import type { Submission } from "../../lib/platform/reviews/model";

import { openIntelligentFixture } from "../../scripts/intake/intelligent-proof-fixture";

const rates = { model: "offline-fixture-model", verifiedOn: "2026-11-10", inputPerMillion: 5_000_000,
  cachedPerMillion: 500_000, cacheWritePerMillion: 5_000_000, outputPerMillion: 25_000_000, countMicros: 0 };
const evidence = (id: string, kind: InterviewEvidence["kind"], reference: string, statement: string, at = "2026-11-09"): InterviewEvidence =>
  ({ id, kind, reference, statement, at });

const c0Evidence = [
  evidence("c0-discovery", "owner-confirmed", "docs/miopages-c0-business-brief.md#launch-and-ongoing-offer", "One managed Web Presence service leads from Launch to Ongoing. The customer confirms business truth and consequential changes.", "2026-10-05/2026-10-06"),
  evidence("c0-audience", "owner-confirmed", "docs/miopages-c0-product-model.md#initial-customer-hypothesis", "Startups and established service, trade, professional and technical firms are in scope."),
  evidence("c0-website", "website-observation", "docs/c0-adaptive-onboarding-walkthrough.md#the-existing-site-review", "Old site copy emphasizes separate website and hosting services. This is a historical observation."),
  evidence("c0-retained-interview", "historical-review-answer", "docs/c0-discovery-question-recovery-audit.md", "The separate October 14 human Free Review intake included startups and small businesses. These are historical interview answers.", "2026-10-14"),
  evidence("c0-retained-assessment", "historical-review-assessment", "docs/free-review-synthesis.md#current-bounded-implementation", "The separately retained assessment was approved and undelivered.", "2026-10-19"),
];
const c0Gaps: InterviewGap[] = [
  { id: "buyer-proof", questionPurpose: "Learn what makes a skeptical buyer trust the managed relationship, and what supports that claim.",
    sourceIds: ["c0-audience", "c0-website", "c0-retained-interview", "c0-retained-assessment", "review-fixture", "wrong-review"], known: ["Who are your customers?", "What services do you offer?"] },
  { id: "ongoing", questionPurpose: "Find a supported first Ongoing improvement and the evidence or owner decision needed for it.",
    sourceIds: ["c0-discovery", "c0-website"], known: ["What services do you offer?"] },
];
const c2Evidence = [evidence("c2-site", "website-observation", "docs/fictional-customer-2-tree-service-onboarding-scenario.md",
  "Fictional old-site observations mention emergency tree work and routine estimates. Actual emergency coverage is unknown.")];
const c2Gaps: InterviewGap[] = [{ id: "coverage", questionPurpose: "Determine truthful urgent call coverage and separate routine estimates.", sourceIds: ["c2-site"], known: ["What services do you offer?"] }];

function providerResponse(proposal: unknown, outputTokens = 100) {
  return { requestId: "req_fixture", body: { id: "resp_fixture", model: rates.model, service_tier: "default", status: "completed",
    usage: { input_tokens: 1000, output_tokens: outputTokens, total_tokens: 1000 + outputTokens,
      input_tokens_details: { cached_tokens: 200 }, output_tokens_details: { reasoning_tokens: 20 } },
    output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(proposal) }] }],
  } };
}

test("question proposals reject repetition, unrelated citations and readiness without a supplied answer", () => {
  const context: QuestionContext = { entryPath: "DIRECT_START", gap: c2Gaps[0], evidence: c2Evidence, history: [] };
  const proposal = { question: "Which weekday hours can a caller reach someone?", rationale: "Clarify actual coverage.", sourceIds: ["c2-site"], assessment: null };
  assert.throws(() => readProposal({ ...proposal, question: "What services do you offer?" }, context, "turn-1", "test/1"), /Repeated/);
  assert.throws(() => readProposal({ ...proposal, sourceIds: ["c0-website"] }, context, "turn-1", "test/1"), /references/);
  const first = readProposal(proposal, context, "turn-1", "test/1");
  const later = { ...context, history: [{ ...first, answer: { text: null, disposition: "unknown" as const, at: first.at } }] };
  const followUp = { ...proposal, question: "What can you safely say when no one is available?", assessment: { recommendation: "Hold the urgent promise.", evidenceNeeded: null } };
  assert.throws(() => readProposal(followUp, later, "turn-2", "test/1"), /references/);
  assert.throws(() => readProposal({ ...followUp, sourceIds: ["c2-site", "turn-1:answer"] }, later, "turn-2", "test/1"), /cannot be planning evidence/);
});

test("offline Responses accounting enforces token, request, cost and uncertain-charge limits durably", async t => {
  const context: QuestionContext = { entryPath: "DIRECT_START", gap: c2Gaps[0], evidence: c2Evidence, history: [] };
  const attribution = { ownerDigest: "a".repeat(64), workDigest: "b".repeat(64) };
  const next = { ...attribution, workDigest: "c".repeat(64) };
  const proposal = { question: "Which hours can callers reach someone?", rationale: "Verify availability.", sourceIds: ["c2-site"], assessment: null };
  async function fixture(run: (directory: string) => Promise<void>) {
    const directory = await mkdtemp(join(tmpdir(), "miopages-offline-budget-"));
    try { await run(directory); }
    finally { await rm(directory, { recursive: true }); }
  }
  await t.test("counted oversize input sends no generation and cannot replay the same work", () => fixture(async directory => {
    const paths: string[] = [];
    await initializeOfflineUsageLedger(directory, rates);
    const adapter = offlineResponsesProvider(directory, rates, { mode: "offline-test", async send(path) {
      paths.push(path); return { body: { input_tokens: 4001 } };
    } });
    await assert.rejects(adapter.propose(context, attribution), /Input token ceiling/);
    await assert.rejects(adapter.propose(context, attribution), /already dispatched/);
    assert.deepEqual(paths, ["/v1/responses/input_tokens"]);
  }));
  await t.test("a completed charge persists and a changed rate card or exhausted cash cap refuses before dispatch", () => fixture(async directory => {
    let calls = 0;
    const pricey = { ...rates, countMicros: 450_000 };
    const transport: OfflineResponsesTransport = { mode: "offline-test", async send(path) {
      calls++;
      return path.endsWith("input_tokens") ? { body: { input_tokens: 1000 } } : providerResponse(proposal);
    } };
    await initializeOfflineUsageLedger(directory, pricey);
    assert.deepEqual(await offlineResponsesProvider(directory, pricey, transport).propose(context, attribution), proposal);
    await assert.rejects(offlineResponsesProvider(directory, rates, transport).propose(context, next), /binding mismatch/);
    await assert.rejects(offlineResponsesProvider(directory, pricey, transport).propose(context, next), /budget exhausted/);
    const { attempts: [receipt] } = JSON.parse(await readFile(join(directory, "onboarding-usage.json"), "utf8"));
    assert.equal(receipt.reservedMicros, 500_000);
    assert.equal(receipt.estimatedMicros, 456_600);
    assert.equal(receipt.usage.reasoning, 20);
    assert.equal(calls, 2);
  }));
  await t.test("timeout or invalid usage retains the reservation and prevents calls after reopen", async () => {
    for (const kind of ["timeout", "usage"]) await fixture(async directory => {
      let calls = 0;
      const transport: OfflineResponsesTransport = { mode: "offline-test", async send(path) {
        calls++;
        if (path.endsWith("input_tokens")) return { body: { input_tokens: 1000 } };
        if (kind === "timeout") throw Error("Timeout");
        return providerResponse(proposal, 1201);
      } };
      await initializeOfflineUsageLedger(directory, rates);
      await assert.rejects(offlineResponsesProvider(directory, rates, transport).propose(context, attribution));
      await assert.rejects(offlineResponsesProvider(directory, rates, transport).propose(context, next), /Unreconciled/);
      const { attempts: [receipt] } = JSON.parse(await readFile(join(directory, "onboarding-usage.json"), "utf8"));
      assert.equal(receipt.status, "pending");
      assert.equal(receipt.reservedMicros, 50_000);
      assert.equal(calls, 2);
    });
  });
});

test("shared post-gate interview persists scoped contextual turns and answer-driven readiness with zero provider traffic", async () => {
  const directory = await mkdtemp(join(tmpdir(), "miopages-offline-usage-"));
  const oldSynthesis = process.env.MIOPAGES_REVIEW_SYNTHESIS, oldEnv = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" });
  const fixture = await openIntelligentFixture(process.env.PG_BIN_DIR ?? "C:/Program Files/PostgreSQL/18/bin");
  const { pool, activation, database, owner, createEntry } = fixture;
  try {
    const c0 = await owner(), c2 = await owner();
    const review = await createEntry(c0, "FREE_REVIEW");
    const direct = await createEntry(c0, "DIRECT_START");
    const tree = await createEntry(c2, "DIRECT_START");
    const requestContexts: QuestionContext[] = [];
    let count = 0, dispatches = 0;
    await initializeOfflineUsageLedger(directory, rates);
    const transport: OfflineResponsesTransport = { mode: "offline-test", async send(path, request) {
      dispatches++;
      if (path.endsWith("input_tokens")) { count++; return { body: { input_tokens: 1000 }, requestId: "req_count" }; }
      const wire = request as { input: string; store: boolean; max_output_tokens: number };
      assert.equal(wire.store, false);
      assert.equal(wire.max_output_tokens, 1200);
      const context: QuestionContext = JSON.parse(wire.input);
      requestContexts.push(context);
      const refs = context.gap.id === "buyer-proof" ? ["c0-audience", "c0-website"] : [context.evidence[0].id];
      const prior = context.history.at(-1);
      if (!prior) {
        const question = context.gap.id === "buyer-proof" ? "If a founder sees the old hosting offer, what evidence would show that Launch includes an ongoing managed relationship?"
          : context.gap.id === "ongoing" ? "After Launch, which supported change could you make if early inquiries misunderstand the offer?"
            : "Which parts of the advertised service area can you actually cover for an urgent tree call on a weekday?";
        return providerResponse({ question, rationale: "Resolve the scoped evidence gap.", sourceIds: refs, assessment: null });
      }
      refs.push(prior.id + ":answer");
      if (context.gap.id === "coverage") return providerResponse({ sourceIds: refs, rationale: "The reply limits when and where calls can be answered.",
        question: "What should callers outside the weekday northern service area do, and where should routine estimates go?",
        assessment: { recommendation: "Plan a limited urgent-call path and a separate routine estimate route.",
          evidenceNeeded: "Verify weekday hours, coverage and a safe fallback before enabling urgent contact." },
      });
      const hasArtifact = prior.answer?.text?.includes("dated comparison");
      return providerResponse({ sourceIds: refs, rationale: "Follow the evidence named in the saved reply.",
        question: hasArtifact ? "Who can verify the comparison and clear it for prospective customers?" : "What baseline should be collected before making that claim?",
        assessment: hasArtifact ? { recommendation: "Draft a reviewable Service example from the dated comparison.", evidenceNeeded: null } :
          { recommendation: "Keep the claim out of launch copy and collect an evidence baseline.", evidenceNeeded: "Confirm the baseline and who can verify it." },
      });
    } };
    const adapter = offlineResponsesProvider(directory, rates, transport);
    const store = (selection: typeof c0) => new IntakeService(pool, selection, { database, answers: {}, provenance: {} });
    const projection = [...c0Evidence,
      { ...evidence("review-fixture", "synthetic-review", "Disposable activation fixture", "Simulated Review-led evidence only."), reviewDigest: review.review!.digest },
      { ...evidence("wrong-review", "synthetic-review", "Foreign revision fixture", "Wrong assessment version."), reviewDigest: "0".repeat(64) }];
    const c0Engine = (entry: typeof review, inputs = projection) => new IntelligentOnboarding(activation, store(c0), {
      scope: entry.scope, evidence: inputs.map(item => ({ ...item, ...c0 })), gaps: c0Gaps,
    }, adapter);
    const reviewer = c0Engine(review), starter = c0Engine(direct);
    const controlSources = { scope: tree.scope, evidence: c2Evidence.map(item => ({ ...item, ...c2 })), gaps: c2Gaps };
    const control = new IntelligentOnboarding(activation, store(c2), controlSources, adapter);
    assert.throws(() => new IntelligentOnboarding(activation, store(c2), {
      scope: tree.scope, evidence: c2Evidence.map(item => ({ ...item, ...c0 })), gaps: c2Gaps,
    }, adapter), /Invalid onboarding source projection/);
    await assert.rejects(reviewer.open(review), /Commercial confirmation/);
    await assert.rejects(starter.open(direct), /Commercial confirmation/);
    await Promise.all([review.authorize(), direct.authorize(), tree.authorize()]);
    await assert.rejects(reviewer.open({ ...review, context: {} }), /scope/);
    const a = await reviewer.open(review), b = await starter.open(direct), c = await control.open(tree);
    assert.deepEqual(a.readiness, b.readiness);
    await assert.rejects(control.resume({ ...tree, token: review.token }), /session_unavailable/);
    await assert.rejects(store(c0).resume(review.token), /session_unavailable/);
    await assert.rejects(store(c0).submit(review.token, a.version), /session_unavailable/);
    await assert.rejects(reviewer.propose(review, a.version - 1, "buyer-proof"), /draft_changed/);
    await assert.rejects(c0Engine(review, projection.map(item => ({ ...item, statement: item.statement + " Changed" }))).resume(review), /prepared_source_changed/);
    assert.equal(dispatches, 0);
    const competing = await Promise.allSettled([reviewer.propose(review, a.version, "buyer-proof"), reviewer.propose(review, a.version, "buyer-proof")]);
    const first = competing.find(result => result.status === "fulfilled");
    assert.ok(first?.status === "fulfilled");
    assert.equal(competing.filter(result => result.status === "rejected").length, 1);
    assert.equal(dispatches, 2);
    const initial = first.value;
    assert.deepEqual(await c0Engine(review).resume(review), initial);
    const reviewedAnswer = await reviewer.answer(review, initial.version, initial.state.turns[0].id, "provided", "We have a dated comparison of the former setup and the managed handoff.");
    const reviewedFollowup = await reviewer.propose(review, reviewedAnswer.version, "buyer-proof");
    assert.deepEqual(await c0Engine(review).resume(review), reviewedFollowup);
    assert.equal(reviewedFollowup.state.turns[1].generatorVersion, "onboarding-responses/1");
    const directFirst = await starter.propose(direct, b.version, "buyer-proof");
    assert.equal(directFirst.state.turns[0].question, initial.state.turns[0].question);
    const directAnswer = await starter.answer(direct, directFirst.version, directFirst.state.turns[0].id, "unknown", null);
    const directFollowup = await starter.propose(direct, directAnswer.version, "buyer-proof");
    assert.notEqual(reviewedFollowup.state.turns[1].question, directFollowup.state.turns[1].question);
    assert.equal(reviewedFollowup.readiness[0].status, "planning-review");
    assert.equal(directFollowup.readiness[0].status, "open");
    assert.notEqual(reviewedFollowup.readiness[0].recommendation, directFollowup.readiness[0].recommendation);
    assert.ok(reviewedFollowup.readiness[0].sourceIds.includes(initial.state.turns[0].id + ":answer"));
    const afterProof = await reviewer.answer(review, reviewedFollowup.version, reviewedFollowup.state.turns[1].id, "deferred", null);
    assert.equal(afterProof.readiness[0].status, "open");
    const ongoing = await reviewer.propose(review, afterProof.version, "ongoing");
    assert.match(ongoing.state.turns[2].question!, /After Launch/);
    const ongoingAnswer = await reviewer.answer(review, ongoing.version, ongoing.state.turns[2].id, "provided", "Inquiry notes are unavailable for this new launch.");
    const ongoingFollowup = await reviewer.propose(review, ongoingAnswer.version, "ongoing");
    assert.match(ongoingFollowup.readiness[1].recommendation!, /baseline/);
    const treeFirst = await control.propose(tree, c.version, "coverage");
    assert.match(treeFirst.state.turns[0].question!, /urgent tree call/);
    const treeAnswer = await control.answer(tree, treeFirst.version, treeFirst.state.turns[0].id, "provided", "Weekdays in the northern service area.");
    const invalidProvider = new IntelligentOnboarding(activation, store(c2), controlSources, {
      version: "invalid-output-test",
      async propose() { return { question: "Can I use the other account?", rationale: "Injected cross-tenant reference", sourceIds: ["c0-website"], assessment: null }; },
    });
    const rejected = await invalidProvider.propose(tree, treeAnswer.version, "coverage");
    assert.equal(rejected.state.failure?.code, "invalid_output");
    assert.equal(rejected.readiness[0].status, "open");
    assert.equal(rejected.state.turns.length, 1);
    const treeFollowup = await control.propose(tree, rejected.version, "coverage");
    assert.match(treeFollowup.state.turns[1].question!, /weekday northern service area/);
    assert.match(treeFollowup.readiness[0].recommendation!, /separate routine estimate/);
    assert.equal(treeFollowup.readiness[0].status, "open");
    assert.ok(requestContexts.filter(x => x.gap.id === "coverage").every(x => x.evidence.every(item => item.id === "c2-site")));
    assert.ok(requestContexts.filter(x => x.gap.id !== "coverage").every(x => x.evidence.every(item => item.id !== "c2-site" && item.id !== "wrong-review")));
    assert.ok(requestContexts.some(x => x.entryPath === "FREE_REVIEW" &&
      x.evidence.some(item => item.kind === "historical-review-answer" && item.at === "2026-10-14") &&
      x.evidence.some(item => item.kind === "historical-review-assessment" && item.statement.includes("undelivered"))));
    assert.ok(requestContexts.filter(x => x.entryPath === "DIRECT_START").every(x => x.evidence.every(item => !item.kind.includes("review"))));
    assert.equal(count, 8);
    await assert.rejects(adapter.propose(requestContexts[0], { ownerDigest: "1".repeat(64), workDigest: "2".repeat(64) }), /Development budget exhausted/);
    assert.equal(dispatches, 16);
    const { rows } = await pool.query("SELECT * FROM prospect_intake_submissions WHERE questionnaire_version='paid-onboarding/3'");
    assert.equal(rows.length, 0);
    await assert.rejects(pool.query("UPDATE prospect_intake_submissions SET answers='{}'"), /immutable/);
    assert.throws(() => source({ questionnaire_version: "paid-onboarding/3" } as Submission), /not activation evidence/);
    const rawLedger = await readFile(join(directory, "onboarding-usage.json"), "utf8");
    assert.doesNotMatch(rawLedger, /dated comparison|northern service area|c0-website/);
    const receipts = JSON.parse(rawLedger).attempts as { ownerDigest: string; workDigest: string }[];
    assert.equal(receipts.length, 8);
    assert.equal(new Set(receipts.map(item => item.ownerDigest)).size, 2);
    assert.equal(new Set(receipts.map(item => item.workDigest)).size, 8);
  } finally {
    if (oldEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV"); else Object.assign(process.env, { NODE_ENV: oldEnv });
    if (oldSynthesis === undefined) delete process.env.MIOPAGES_REVIEW_SYNTHESIS; else process.env.MIOPAGES_REVIEW_SYNTHESIS = oldSynthesis;
    try { await fixture.close(); } finally { await rm(directory, { recursive: true }); }
  }
});
