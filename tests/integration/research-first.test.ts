import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { proofModel } from "../../scripts/intake/intelligent-live-proof";
import { rankMarketQuestions, runResearchProof } from "../../scripts/intake/research-first";

const candidate = (id: string, question: string, impact: number) => ({
  unknown: "Visitor route", question, why: "Visitors need a reliable next step.",
  ifYes: "Show the verified route.", ifNo: "Keep the action provisional.",
  impact, uncertainty: 2, novelty: 2, effort: 1, sourceIds: [id],
});
const result = (...candidates: unknown[]) => ({ understanding: "There is a service to explain.", uncertainty: "The next action is unverified.", candidates });

test("research ranking prioritizes consequential new gaps and refuses foreign evidence or equivalent branches", () => {
  const evidence = [{ id: "market-example", kind: "website-observation" as const, at: "2026-11-10", reference: "Example", statement: "Observed pattern." }];
  const first = candidate(evidence[0].id, "Can a visitor book directly?", 2);
  const second = candidate(evidence[0].id, "Is the second page ready?", 1);
  assert.equal(rankMarketQuestions(result(second, first), evidence).ranked[0].question, first.question);
  assert.equal(rankMarketQuestions(result({ ...first, novelty: 0 }, second), evidence).ranked[0].question, second.question);
  assert.throws(() => rankMarketQuestions(result(first, { ...second, sourceIds: ["market-foreign"] }), evidence), /question refused/);
  assert.throws(() => rankMarketQuestions(result(first, { ...second, ifYes: second.ifNo }), evidence), /question refused/);
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
          assessment: { recommendation: "Explain the constraint before offering a route.", evidenceNeeded: "Confirm responsibility for the route." } };
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
    }
  } finally {
    if (oldNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV"); else Object.assign(process.env, { NODE_ENV: oldNodeEnv });
    if (oldSynthesis === undefined) delete process.env.MIOPAGES_REVIEW_SYNTHESIS; else process.env.MIOPAGES_REVIEW_SYNTHESIS = oldSynthesis;
    await rm(directory, { recursive: true });
  }
});
