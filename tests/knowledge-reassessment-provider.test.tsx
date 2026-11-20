import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { fingerprint } from "../lib/platform/canonical/model";
import { confirmedKnowledgeEvidence } from "../lib/platform/intake/account-work";
import { initializeResponsesUsageLedger, type ResponsesRates } from "../lib/platform/intake/intelligent-responses";
import { createResponsesPresenceWorkflow, projectKnowledgeReassessment, type PresenceWorkflowGrant } from "../lib/platform/intake/presence-workflow-provider";
import type { WorkflowContext, WorkflowInput, WorkflowRun } from "../lib/platform/intake/presence-workflow";
import { readBlueprint } from "../lib/platform/intake/presence-workflow-artifacts";
import { bindCompleteAuthoringKnowledge, marketingCitationIds, marketingProjection } from "../lib/platform/intake/presence-marketing-authority";
import { c0WorkflowGrantMatches } from "../lib/platform/intake/protected-presence-workflow";

function sample(publicUse = true) {
  const context: WorkflowContext = { scope: { webPresenceId: randomUUID(), managedSiteId: randomUUID() }, intakeId: randomUUID(), entry: "DIRECT_START",
    evidence: [{ id: "business", kind: "owner-confirmed", label: "Complete managed service", reference: "PRIVATE-REFERENCE-NOT-FOR-MODEL", date: null,
      content: "Launch establishes the presence. Ongoing uses knowledge, measurement, content and conversion improvement to help it grow." }], limitations: [], conflicts: [] };
  const knowledgeReassessment: NonNullable<WorkflowInput["knowledgeReassessment"]> = { id: randomUUID(), correctionIds: [randomUUID()], previous: { report: null, direction: null, blueprint: null, pages: [] },
    confirmations: [{ recordId: randomUUID(), key: "conversation-goal", kind: "goal", value: "Help the owner prepare the existing website address for the first conversation.",
      previousValue: "An incomplete earlier goal", version: 2, fingerprint: fingerprint("canonical-v2"), publicUse, at: "2026-11-20T00:00:00.000Z" }] };
  const addition = confirmedKnowledgeEvidence(knowledgeReassessment.confirmations);
  const input: WorkflowInput = { entry: context.entry, evidence: [...context.evidence, ...addition], limitations: [], conflicts: [], research: [],
    corrections: [], report: null, direction: null, blueprint: null, pages: [], knowledgeReassessment };
  const run: WorkflowRun = { context, input, work: { operation: "blueprint", attempt: randomUUID(), until: Date.now() + 60_000, inputDigest: fingerprint(input) } };
  return { context, input, run, addition, knowledgeReassessment };
}

test("reassessment uses the existing metered provider, exact fresh authorization and recovery without a repeat call", async () => {
  const directory = await mkdtemp(join(tmpdir(), "miopages-reassessment-"));
  try {
    const rates: ResponsesRates = { model: "offline-test-model", verifiedOn: "2026-11-20", inputPerMillion: 750_000, cachedPerMillion: 75_000,
      cacheWritePerMillion: 0, outputPerMillion: 4_500_000, countMicros: 0 };
    await initializeResponsesUsageLedger(directory, rates);
    const fixture = sample(), { run, context, input } = fixture;
    const grant: PresenceWorkflowGrant = { contextDigest: fingerprint(context), approvedSources: context.evidence.map(fingerprint), approvedCorrections: [],
      researchSources: [{ id: "research:unused", label: "Unused", url: "https://example.org/" }], researchResponseBytes: 12_000,
      expiresAt: Date.now() + 60_000, maxOutputTokens: 2000, ledger: { id: fingerprint("offline-reassessment"), baselineAttempts: 0,
        startingLedger: createHash("sha256").update(await readFile(join(directory, "onboarding-usage.json"))).digest("hex"),
        requests: 2, generations: 1, inputBytes: 100_000, inputTokens: 7000, capMicros: 30_000 } };
    const paths: string[] = [];
    const blueprint = { pages: [{ path: "/", label: "Home", purpose: "Explain the managed service", sourceIds: ["business"], change: "add", changeReason: "No existing Page in this provider-shaped sample" }], navigation: ["/"], articles: [] };
    const response = { id: "resp_offline_reassessment", model: rates.model, status: "completed", service_tier: "default",
      usage: { input_tokens: 5000, input_tokens_details: { cached_tokens: 0 }, output_tokens: 100, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 5100 },
      output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(blueprint) }] }] };
    const provider = (approved: PresenceWorkflowGrant) => createResponsesPresenceWorkflow({ grant: approved, readGrant: async () => approved,
      readContext: async () => context, rates, ledgerDirectory: directory,
      fetchPage: async () => { throw Error("No research or network call allowed in this test"); },
      transport: { async send(path, body) {
        paths.push(path); const serialized = JSON.stringify(body);
        assert.match(serialized, /existing website address/); assert.match(serialized, /knowledgeReassessment/);
        assert.match(serialized, /conversion improvement/); assert.match(serialized, /changeReason/);
        assert.doesNotMatch(serialized, /PRIVATE-REFERENCE-NOT-FOR-MODEL/);
        if (path.endsWith("/input_tokens")) return { body: { input_tokens: 5000 } };
        assert.equal((body as { store: boolean }).store, false);
        return { body: response, rawBody: Buffer.from(JSON.stringify(response)) };
      } },
    });
    await assert.rejects(provider(grant).run(run, async () => {}), /Exact knowledge reassessment authorization/);
    assert.deepEqual(paths, []);
    const fresh = { ...grant, approvedSources: input.evidence.map(fingerprint), approvedKnowledgeReassessments: [fingerprint(fixture.knowledgeReassessment)],
      approvedKnowledgeSources:fixture.addition.map(fingerprint) };
    assert.equal(c0WorkflowGrantMatches(context,grant),true);
    assert.equal(c0WorkflowGrantMatches(context,{...fresh,approvedKnowledgeSources:[]}),false);
    assert.equal(c0WorkflowGrantMatches(context,fresh),true);
    assert.equal(c0WorkflowGrantMatches(context,{...fresh,approvedSources:fresh.approvedKnowledgeSources}),false);
    assert.equal(c0WorkflowGrantMatches(context,{...fresh,approvedSources:[...fresh.approvedSources,fingerprint('unknown source')]}),false);
    await assert.rejects(provider({...fresh,approvedKnowledgeSources:[fingerprint('wrong canonical source')]}).run(run,async()=>{}),/Exact knowledge source authorization/);
    assert.equal(paths.length,0);
    const engine = provider(fresh); let retained: Buffer | undefined;
    const result = await engine.run(run, async bytes => { retained = bytes; });
    assert.equal(readBlueprint(result, input.evidence.map(source => source.id), false, false, true).pages[0].change, "add");
    assert.ok(retained); assert.equal(paths.length, 2);
    assert.deepEqual(await engine.recover(run, retained), result); assert.equal(paths.length, 2);
    const changed = { ...input, knowledgeReassessment: { ...fixture.knowledgeReassessment, confirmations: fixture.knowledgeReassessment.confirmations.map(item => ({ ...item, value: "Expanded unauthorized data" })) } };
    await assert.rejects(engine.run({ ...run, input: changed, work: { ...run.work, inputDigest: fingerprint(changed), attempt: randomUUID() } }, async () => {}), /Exact knowledge source authorization/);
    assert.equal(paths.length, 2);
  } finally { assert.ok(directory.startsWith(join(tmpdir(), "miopages-reassessment-"))); await rm(directory, { recursive: true, force: true }); }
});

test("source-aware authoring retains the whole business and refuses private fact promotion", () => {
  const { run, context, input, addition } = sample(false);
  const base = { contextDigest: fingerprint(context), brandDigest: fingerprint("brand"), brandBrief: "Test brand", qualityReviewerId: "test-owner-role",
    sources: input.evidence.map(source => ({ digest: fingerprint(source), use: "business-fact" as const })) };
  const incorrect = bindCompleteAuthoringKnowledge(base, input.evidence);
  assert.throws(() => marketingProjection(run, incorrect), /Internal confirmed fact/);
  const corrected = bindCompleteAuthoringKnowledge({ ...base, sources: base.sources.map(source => ({ ...source,
    use: source.digest === fingerprint(addition[0]) ? "analysis" as const : source.use })) }, input.evidence);
  const projection = marketingProjection(run, corrected);
  assert.match(JSON.stringify(projection), /knowledge, measurement, content/);
  assert.match(JSON.stringify(projection), /existing website address/);
  assert.equal(marketingCitationIds({ ...run, work: { ...run.work, operation: "page", path: "/" } }, corrected).includes(addition[0].id), false);
});

test("stage projections avoid repeatedly sending derived Pages without narrowing original business knowledge", () => {
  const { run, input, knowledgeReassessment } = sample();
  const page = (path: string) => ({ path, heading: "Prior recorded Page", searchTitle: "Prior", searchDescription: "Prior description",
    sections: [], actions: [], internalLinks: [] });
  knowledgeReassessment.previous.pages = [page("/"), page("/service")];
  assert.deepEqual(projectKnowledgeReassessment(run)?.previous.pages, knowledgeReassessment.previous.pages);
  assert.deepEqual(projectKnowledgeReassessment({ ...run, work: { ...run.work, operation: "page", path: "/service" } })?.previous.pages, [page("/service")]);
  assert.deepEqual(projectKnowledgeReassessment({ ...run, work: { ...run.work, operation: "report" } })?.previous.pages, []);
  assert.equal(input.evidence.length, 2); assert.match(input.evidence[0].content, /knowledge, measurement, content and conversion/);
  assert.equal(knowledgeReassessment.previous.pages.length, 2);
});
