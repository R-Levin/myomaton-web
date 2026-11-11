import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { proofModel } from "../../scripts/intake/intelligent-live-proof";
import { rankMarketQuestions, respectsC0Offer, runResearchProof } from "../../scripts/intake/research-first";
import { interviewReadiness, readProposal, type QuestionContext } from "../../lib/platform/intake/intelligent-model";

const candidate = (id: string, question: string, impact: number) => ({
  unknown: "Visitor route", question, why: "Visitors need a reliable next step.",
  ifYes: "Show the verified route.", ifNo: "Keep the action provisional.",
  impact, uncertainty: 2, novelty: 2, effort: 1, marketId: id, sourceIds: [],
});
const result = (...candidates: unknown[]) => ({ understanding: "There is a service to explain.", uncertainty: "The next action is unverified.", candidates });

test("only a directly supported reply can advance the asked gap", () => {
  const source = { id: "c0-scope", kind: "owner-confirmed" as const, at: "now", reference: "brief", statement: "Launch and Ongoing are separate phases." };
  const gap = { id: "launch", questionPurpose: "Confirm the maximum Launch scope.", sourceIds: [source.id], known: [] };
  const initial: QuestionContext = { entryPath: "DIRECT_START", gap, evidence: [source], history: [] };
  const asked = readProposal({ question: "What is included in Launch?", rationale: "Confirm the service boundary.",
    sourceIds: [source.id], assessment: null }, initial, "asked", "test");
  const input = (answer: string): QuestionContext => ({ ...initial, history: [{ ...asked, answer: { disposition: "provided", text: answer, at: "now" } }] });
  const output = { question: "What is the included Launch page limit?", rationale: "Resolve the remaining scope.",
    sourceIds: [source.id, "asked:answer"], assessment: { recommendation: "Apply the claimed scope.", evidenceNeeded: null } };
  for (const relevance of ["off-topic", "partial", "needs-confirmation"] as const) {
    const answer = "The owner approves routine Ongoing updates.";
    const follow = readProposal({ ...output, answerReview: { relevance, topic: "Ongoing updates",
      excerpt: answer, unresolved: "The Launch page limit is unresolved." } }, input(answer), "follow", "test", true);
    assert.equal(follow.assessment, null);
    const [view] = interviewReadiness([gap], { turns: [follow], pending: null, failure: null });
    assert.equal(view.status, "open");
    assert.equal(view.recommendation, null);
    assert.equal(view.evidenceNeeded, "The Launch page limit is unresolved.");
  }
  const answer = "Launch includes five pages.";
  const proposal = { ...output, question: null, answerReview: { relevance: "direct", topic: "Launch page limit",
    excerpt: answer, unresolved: null } };
  const follow = readProposal(proposal, input(answer), "follow", "test", true);
  assert.equal(interviewReadiness([gap], { turns: [follow], pending: null, failure: null })[0].status, "planning-review");
  assert.throws(() => readProposal({ ...proposal, answerReview: { ...proposal.answerReview, excerpt: "Launch includes ten pages." } },
    input(answer), "follow", "test", true), { code: "answer_relevance" });
});

test("research ranking prioritizes consequential new gaps and refuses foreign evidence or equivalent branches", () => {
  const evidence = [{ id: "market-example", kind: "website-observation" as const, at: "2026-11-10", reference: "Example", statement: "Observed pattern." }];
  const first = candidate(evidence[0].id, "Can a visitor book directly?", 2);
  const second = candidate(evidence[0].id, "Is the second page ready?", 1);
  assert.equal(rankMarketQuestions(result(second, first), evidence).ranked[0].question, first.question);
  assert.equal(rankMarketQuestions(result({ ...first, novelty: 0 }, second), evidence).ranked[0].question, second.question);
  assert.throws(() => rankMarketQuestions(result(first, { ...second, sourceIds: ["market-foreign"] }), evidence), /question refused/);
  assert.throws(() => rankMarketQuestions(result(first, { ...second, ifYes: second.ifNo }), evidence), /question refused/);
  assert.equal(respectsC0Offer({ ...first, ifYes: "Offer a Launch-only purchase." }), false);
  assert.equal(respectsC0Offer({ ...first, question: "Which routine changes can the customer request during Ongoing?" }), true);
});

test("public research produces a new saved gap and answer-dependent assessment per isolated case", async () => {
  const directory = await mkdtemp(join(tmpdir(), "miopages-research-fixture-"));
  const oldNodeEnv = process.env.NODE_ENV, oldSynthesis = process.env.MIOPAGES_REVIEW_SYNTHESIS;
  Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" });
  try {
    let counts = 0, generations = 0, countBody: object | undefined;
    await runResearchProof(directory, process.env.PG_BIN_DIR ?? "C:/Program Files/PostgreSQL/18/bin", {
      model: proofModel, verifiedOn: "2026-11-10", inputPerMillion: 750_000, cachedPerMillion: 75_000,
      cacheWritePerMillion: 0, outputPerMillion: 4_500_000, countMicros: 0,
    }, { async send(path, body) {
      const wire = body as { input: string; text: { format: { name: string } } };
      if (path === "/v1/responses/input_tokens") {
        counts++;
        countBody = structuredClone(body);
        return { body: { input_tokens: 1000 } };
      }
      generations++;
      assert.deepEqual(body, { ...countBody, max_output_tokens: 1200, service_tier: "default", store: false });
      const input = JSON.parse(wire.input);
      const marketId = input.evidence.find((source: { id: string }) => source.id.startsWith("market-")).id;
      const segment = marketId.split("-")[1];
      assert.ok(input.evidence.every((source: { id: string; reference?: string }) => source.id.includes(segment) && source.reference === undefined));
      const proposal = wire.text.format.name === "market_questions"
        ? result(candidate(marketId, "Can a visitor request a useful next step now?", 2), candidate(marketId, "Should a second page explain this?", 1))
        : { question: "Who can confirm the next step?", rationale: "The synthetic answer establishes a constraint.",
          sourceIds: [marketId, input.history[0].id + ":answer"],
          assessment: null, answerReview: { relevance: "partial", topic: "Operating limits",
            excerpt: input.history[0].answer.text.split(".")[0], unresolved: "Confirm responsibility for the route." } };
      return { body: { id: "resp_fixture", model: proofModel, service_tier: "default", status: "completed",
        usage: { input_tokens: 1000, output_tokens: 100, total_tokens: 1100, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } },
        output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(proposal) }] }] } };
    } });
    assert.equal(counts, 6);
    assert.equal(generations, 6);
    for (const id of ["c0", "c2", "startup"]) {
      const receipt = JSON.parse(await readFile(join(directory, "market-" + id + ".json"), "utf8"));
      assert.equal(receipt.selected, "Can a visitor request a useful next step now?");
      assert.equal(receipt.followUp, "Who can confirm the next step?");
      assert.equal(receipt.answerReview.relevance, "partial");
      assert.equal(receipt.assessment, null);
    }
  } finally {
    if (oldNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV"); else Object.assign(process.env, { NODE_ENV: oldNodeEnv });
    if (oldSynthesis === undefined) delete process.env.MIOPAGES_REVIEW_SYNTHESIS; else process.env.MIOPAGES_REVIEW_SYNTHESIS = oldSynthesis;
    await rm(directory, { recursive: true });
  }
});
