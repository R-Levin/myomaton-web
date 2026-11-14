import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fingerprint } from "../lib/platform/canonical/model";
import { freshCompactComparison as run, protectedSitePlanningProvider, type ResponsesRates } from "../lib/platform/intake/intelligent-responses";
import { compactSitePlanningVersion, compactSitePlanningOutput, type PreparedPlanning } from "../lib/platform/intake/site-planning";
import { c0, c2 } from "../tests/fixtures/site-planning-compact";

async function main() {
  const root = join(process.env.HOME ?? "", "miopages-private-acceptance");
  const original = await readFile(join(root, "core-usage/onboarding-usage.json"), "utf8");
  const governing = JSON.parse(await readFile(join(root, "ai-scope.json"), "utf8")) as { expiresAt: number; rates: ResponsesRates };
  const manifest = JSON.parse(await readFile(join(root, "site-planning-proof/site-planning-live-proof-inputs.json"), "utf8"));
  const old = JSON.parse(await readFile(join(root, "site-planning-proof/c0-compact-site-planning-grant.json"), "utf8"));
  assert.equal(fingerprint(manifest), "3437eb2491bd7d44dea7cb707319771158b6d61db1f3ac56b4019e908e4e66d6");

  const plans = [prepare("c0"), prepare("c2")];
  function prepare(caseName: "c0" | "c2"): PreparedPlanning {
    const owner = caseName === "c0" ? old.ownerDigest : fingerprint({ fictionalCase: "c2", operation: "site-planning" });
    const sources = manifest[caseName].sources;
    const answers = caseName === "c0" ? [{
      id: old.interviewSession.answers[0].turnId + ":answer", statement: manifest.c0.answerProjection, confirmation: "unconfirmed" as const,
    }] : [];
    const input = { sources, answers };
    const inputDigest = fingerprint({ ownerDigest: owner, input });
    assert.equal(inputDigest, run[caseName]);
    return { ownerDigest: owner, input, inputDigest, sourceIds: [...sources, ...answers].map(source => source.id) };
  }

  const sandbox = await mkdtemp(join(root, "fresh-comparison-offline-"));
  try {
    const ledger = join(sandbox, "onboarding-usage.json");
    await writeFile(ledger, original, { mode: 0o600, flag: "wx" });
    let calls = 0;
    function provider(index: number, mismatch = false, comparisonId: string = run.id) {
      const { ownerDigest, inputDigest } = plans[index];
      return protectedSitePlanningProvider(sandbox, governing.rates, { async send(path, body) {
        calls++;
        assert.equal(fingerprint(JSON.parse((body as { input: string }).input)), fingerprint(plans[index].input));
        assert.deepEqual(Object.hasOwn(body, "tools"), false);
        if (path.endsWith("input_tokens")) return { body: { input_tokens: 1000 } };
        assert.equal((body as { max_output_tokens: number }).max_output_tokens, 6000);
        assert.equal((body as { store: boolean }).store, false);
        return { body: { model: governing.rates.model, service_tier: "default", status: "completed",
          output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(index === 0 ? c0 : c2) }] }],
          usage: { input_tokens: 1000, input_tokens_details: { cached_tokens: 0 }, output_tokens: 2000,
            output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 3000 } } };
      } }, { ownerDigest, inputDigest, comparisonId, expiresAt: governing.expiresAt,
        maxRequests: run.maxRequests, capMicros: run.capMicros - Number(mismatch), format: compactSitePlanningVersion,
        maxOutputTokens: compactSitePlanningOutput, retainedReservation: run.retainedReservation });
    }
    assert.throws(() => provider(0, true), /Invalid fresh comparison authorization/);
    await assert.rejects(provider(1)(() => plans[1]), /ledger baseline refused/);
    await assert.rejects(provider(0)(() => plans[1]), /authorization mismatch/);
    assert.equal(calls, 0);
    assert.equal((await provider(0)(() => plans[0])).status, "proposed");
    await assert.rejects(provider(0)(() => plans[0]), /already dispatched/);
    assert.equal((await provider(1)(() => plans[1])).status, "proposed");
    await assert.rejects(provider(1)(() => plans[1]), /already dispatched/);
    const result = JSON.parse(await readFile(ledger, "utf8"));
    const before = JSON.parse(original);
    assert.deepEqual(result.attempts.slice(0, 7), before.attempts);
    assert.deepEqual(result.attempts.slice(7).map((item: { reservedMicros: number }) => item.reservedMicros), [30_000, 30_000]);
    assert.equal(await readFile(join(root, "core-usage/onboarding-usage.json"), "utf8"), original);
    assert.equal(calls, 4);
    console.log(JSON.stringify({ status: "PASS", simulatedRequests: 4, exactInputs: true, priorLedgerPreserved: true,
      wrongScopeRefused: true, outOfOrderRefused: true, duplicateRefused: true, combinedEnvelopeMicros: 60_000, modelCalls: 0 }));
  } finally { await rm(sandbox, { recursive: true, force: true }); }
}
main().catch(error => {
  console.error(JSON.stringify({ status: "BLOCKED", code: (error as { code?: string }).code ?? "OFFLINE_GATE" }));
  process.exitCode = 1;
});
