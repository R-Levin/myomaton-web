import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fingerprint } from "../../lib/platform/canonical/model";
import { createC0Onboarding } from "../../scripts/intake/c0-onboarding";
import { workflowFixture } from "../../scripts/intake/presence-workflow-fixture";
import { PresenceWorkflow, type PresenceWorkflowOperations, type WorkflowContext } from "../../lib/platform/intake/presence-workflow";
import { bindPresenceEvaluations } from "../../lib/platform/intake/presence-evaluation";
import { composeHomeConcept } from "../../lib/platform/intake/presence-home-concept";
import { composeIsolatedPresenceEvaluation, workPresenceCase } from "../../lib/platform/intake/protected-presence-workflow";
import { qualityCriteria, type QualityReview } from "../../lib/platform/intake/presence-marketing-authority";
import { workflowDeliveryInput, workflowEvaluationPreviewInput } from "../../lib/platform/intake/presence-workflow-delivery";
import { IntakeService } from "../../lib/platform/intake/service";
import { FirstPartyMeasurement, type MeasurementSource } from "../../lib/platform/measurement/first-party";
import type { PresenceEvidence } from "../../lib/platform/intake/presence-workflow-artifacts";
import type { PresenceVisualResult } from "../../lib/platform/intake/presence-workflow-visual";

test("isolated evaluations keep the original intake intact and pause at an exact WordPress Home concept", async () => {
  const setup = await createC0Onboarding(process.env.PG_BIN_DIR ?? "C:/Program Files/PostgreSQL/18/bin", true, undefined, true);
  try {
    async function scope() {
      const org = randomUUID(), webPresenceId = randomUUID(), managedSiteId = randomUUID();
      await setup.pool.query("INSERT INTO organizations(id,name,status) VALUES($1,'Evaluation fixture','active')", [org]);
      await setup.pool.query("INSERT INTO web_presences(id,organization_id,name,status) VALUES($1,$2,'Evaluation fixture','active')", [webPresenceId, org]);
      await setup.pool.query("INSERT INTO managed_sites(id,web_presence_id,name,status) VALUES($1,$2,'Evaluation fixture','active')", [managedSiteId, webPresenceId]);
      return { webPresenceId, managedSiteId };
    }
    async function intake(selection: WorkflowContext["scope"], token: string) {
      const service = new IntakeService(setup.pool, selection);
      await service.create(token, "DIRECT_START");
      return { service, context: await service.workflowContext(token) };
    }
    const [original, c0, c2] = await Promise.all([
      intake(setup.selection, "aa".repeat(32)),
      scope().then(selection => intake(selection, "bb".repeat(32))),
      scope().then(selection => intake(selection, "cc".repeat(32))),
    ]);
    const owner = { id: "offer", kind: "owner-confirmed", label: "Offer fixture", reference: "Local approved source fixture",
      date: null, content: "Site launch and continuing care are one service." } satisfies PresenceEvidence;
    const restricted: PresenceEvidence = { ...owner, id: "not-allowed", content: "Unpermitted private content" };
    const origin = { ...original.context, evidence: [owner, restricted] };
    const retained = { version: 41, contextDigest: fingerprint(origin), sourceSnapshot: { evidence: origin.evidence }, pages: ["preserved"] };
    const fictional: PresenceEvidence = { ...owner, kind: "website-observation", id: "fictional-offer", reference: "Fictional C2 fixture: Tree business",
      content: "The fictional business assesses trees around residential buildings." };
    const input = { c0: { origin, retained, digest: fingerprint(retained), sources: [fingerprint(owner)], projectionDigest: fingerprint([fingerprint(owner)]), destination: c0.context },
      c2: { destination: c2.context, fictionalEvidence: [fictional], digest: fingerprint([fictional]) } };
    const bound = bindPresenceEvaluations(input);
    assert.deepEqual(bound.c0.evidence, [owner]);
    assert.deepEqual(bound.c2.evidence, [fictional]);
    assert.throws(() => bindPresenceEvaluations({ ...input, c0: { ...input.c0, digest: "0".repeat(64) } }), /provenance/);
    assert.throws(() => bindPresenceEvaluations({ ...input, c2: { ...input.c2, destination: c0.context } }), /distinct/);
    assert.throws(() => bindPresenceEvaluations({ ...input, c2: { ...input.c2, fictionalEvidence: [owner], digest: fingerprint([owner]) } }), /fictional/);
    assert.throws(() => bindPresenceEvaluations({ ...input, c0: { ...input.c0, sources: [fingerprint(owner), "0".repeat(64)] } }), /permitted/);
    const boundToWrongSession = composeIsolatedPresenceEvaluation(setup.pool, c0.service, "bb".repeat(32),
      bound.c2, { root: "", ledgerDirectory: "", grantFile: "" }, { kind: "review" });
    await assert.rejects(boundToWrongSession.context(), /ownership changed/);
    const boundToCorrectSession = composeIsolatedPresenceEvaluation(setup.pool, c0.service, "bb".repeat(32),
      bound.c0, { root: "", ledgerDirectory: "", grantFile: "" }, { kind: "review" });
    assert.deepEqual(await boundToCorrectSession.context(), bound.c0);
    await assert.rejects(boundToCorrectSession.open(), /Case-specific private evaluation workspace/);
    const root = join(process.cwd(), bound.c0.intakeId);
    const workspace = { root, grantFile: join(root, "grant.json"), ledgerDirectory: join(root, "usage") };
    const readOnly = composeIsolatedPresenceEvaluation(setup.pool, c0.service, "bb".repeat(32), bound.c0, workspace, {
      kind: "offline-test", rates: { model: "gpt-5.4-mini-2026-03-17", verifiedOn: "2026-11-16", inputPerMillion: 750_000,
        cachedPerMillion: 75_000, outputPerMillion: 4_500_000, cacheWritePerMillion: 0, countMicros: 0 },
      readGrant: async () => ({ contextDigest: fingerprint(bound.c0), approvedSources: bound.c0.evidence.map(fingerprint),
        approvedCorrections: [], siteComposition: "managed-v1", researchSources: [{ id: "research:fixture", url: "https://example.org/", label: "Offline fixture" }],
        researchResponseBytes: 12_000, maxOutputTokens: 1_000, expiresAt: Date.now() + 60_000,
        ledger: { id: fingerprint("local-grant"), startingLedger: fingerprint("test-only"), baselineAttempts: 0,
          requests: 2, generations: 1, capMicros: 20_000, inputTokens: 8_000, inputBytes: 24_000,
          breakdown: { text: 1, images: 0, searchCalls: 0 } } }),
      transport: { async send() { throw Error("No provider dispatch during this check"); } },
      async fetchPage() { throw Error("No research request during this check"); },
    });
    assert.equal(await (await readOnly.open()).review(bound.c0), null);
    const operations: PresenceWorkflowOperations = {
      ...workflowFixture,
      async run(run, retain) {
        const tree = run.context.evaluation?.scenario === "c2";
        if (run.work.operation !== "page") return workflowFixture.run(run, retain);
        const base = await workflowFixture.run(run, async () => {}) as { sections: object[]; actions: object[] };
        const revised = Boolean(run.input.revisionRequest);
        const output = { ...base, ...(tree && { heading: run.work.path === "/" ? "Plan a tree assessment" : "Check access before an assessment" }),
          composition: "managed-v1", sections: base.sections.map((section, index) => ({
          ...section, ...(tree && { body: "This fictional service assesses trees near houses and other structures." }),
          ...(revised && { heading: "Start with your most important decision" }), role: index === 0 ? "hero" : "intro",
          visual: { purpose: "Preview media slot", brief: "Local raster fixture", altIntent: "A local fixture image", status: "asset-needed" },
        })), actions: base.actions.map(action => ({ ...action, sectionIndex: 0 })) };
        await retain(Buffer.from(JSON.stringify(output)));
        return output;
      },
      visuals: {
        requestable: true, briefs: [{ id: "visual", label: "Approved local test brief", requestDigest: "a".repeat(64) }],
        // Simulated transport. The private asset preparation and signing gates
        // have their own transport and byte-level tests.
        async execute(visual, retain) {
          const result = { masterDigest: "9".repeat(64), width: 1536, height: 1024, provenanceDigest: fingerprint(visual) } as PresenceVisualResult;
          await retain(result);
          return result;
        },
        async recover(_visual, bytes) { return JSON.parse(bytes.toString("utf8")); },
        async read() { return Buffer.from("Local fixture only"); },
      },
    };
    const actor = { id: "local-evaluation", authority: "test-only", role: "operator", simulated: true } as const;
    const measurement = new FirstPartyMeasurement(setup.pool);
    for (const context of [bound.c0, bound.c2]) {
      const scoped = context === bound.c0 ? { ...operations, marketingAuthority: {
        contextDigest: fingerprint(context), sources: [{ digest: fingerprint(owner), use: "staffed-offer" as const }],
        brandDigest: fingerprint("local brand fixture"), brandBrief: "Local fixture", qualityReviewerId: "independent",
      } } : operations;
      const workflow = new PresenceWorkflow(setup.pool, scoped);
      await workflow.start(context);
      const report = (await workPresenceCase(workflow, context))!;
      await workflow.confirmReport(context, report.version, actor, true);
      const originalHome = (await workPresenceCase(workflow, context))!;
      const requested = (await workflow.reviseHomeConcept(context, originalHome.version, actor,
        composeHomeConcept(context, originalHome).digest, "Show the buyer decision first."))!;
      assert.equal(requested.next, "page");
      const initial = (await workPresenceCase(workflow, context))!;
      assert.notEqual(initial.homeConcept?.digest, originalHome.homeConcept?.digest);
      assert.equal(initial.next, "home-concept");
      assert.deepEqual(initial.pages.map(page => page.path), ["/"]);
      const initialConcept = composeHomeConcept(context, initial);
      assert.deepEqual(initialConcept.candidate.pages.map(page => page.path), ["/"]);
      assert.deepEqual(initialConcept.candidate.actions, []);
      await assert.rejects(workflow.reviewCandidate(context, initial.version, actor), { code: "workflow_not_ready" });
      await assert.rejects(workflow.queueVisual(context, initial.version, actor, "/project", 0, "visual"));
      const queued = (await workflow.queueVisual(context, initial.version, actor, "/", 0, "visual"))!;
      await assert.rejects(workflow.reviewHomeConcept(context, queued.version, actor, initialConcept.digest, "Local review"), { code: "workflow_not_ready" });
      const asset = (await workPresenceCase(workflow, context))!;
      const visual = asset.visuals![0];
      const accepted = (await workflow.decideVisual(context, asset.version, actor, { id: visual.id, decision: "approved",
        reference: "Local raster rights fixture", provenanceDigest: visual.result!.provenanceDigest, alt: "Local raster" }))!;
      const concept = composeHomeConcept(context, accepted);
      assert.notEqual(concept.digest, initialConcept.digest);
      assert.ok(concept.image);
      assert.throws(() => composeHomeConcept(context === bound.c0 ? bound.c2 : bound.c0, accepted), /Current evaluation Home/);
      await assert.rejects(workflow.reviewHomeConcept(context, accepted.version, actor, initialConcept.digest, "Local review"), { code: "draft_changed" });
      if (process.env.MIOPAGES_EVAL_FIXTURE_EXPORT) await writeFile(process.env.MIOPAGES_EVAL_FIXTURE_EXPORT + "/" +
        context.evaluation!.scenario + "-home.json", JSON.stringify(concept));
      const resumed = (await workflow.reviewHomeConcept(context, accepted.version, actor, concept.digest, "Local review"))!;
      assert.equal(resumed.next, "page");
      assert.equal(resumed.operatorReview, null);
      assert.deepEqual(resumed.visuals, []);
      assert.equal(resumed.homeReview?.digest, concept.digest);
      const complete = (await workPresenceCase(workflow, context))!;
      assert.equal(complete.pages.length, 2);
      if (context === bound.c0) {
        const reviewed = (await workflow.reviewCandidate(context, complete.version, actor))!;
        assert.ok(reviewed.deliveryQuality?.target);
        assert.equal(reviewed.deliveryQuality.passed, false);
        assert.throws(() => workflowDeliveryInput(context, reviewed, null, []), /quality review/);
        assert.equal(workflowEvaluationPreviewInput(context, reviewed, null, []).pages.length, 2);
        const reviewer = { ...actor, id: "independent" };
        const receipt: QualityReview = { target: reviewed.deliveryQuality.target, desktopEvidence: fingerprint("desktop fixture"),
          mobileEvidence: fingerprint("mobile fixture"), findings: qualityCriteria.map(criterion =>
            ({ criterion, status: "pass", observation: "Independently inspected fixture criteria." })) };
        await assert.rejects(workflow.recordQualityReview(context, reviewed.version, actor, receipt), { code: "unavailable" });
        await assert.rejects(workflow.recordQualityReview(context, reviewed.version, reviewer, { ...receipt, target: fingerprint("another candidate") }),
          { code: "invalid_request" });
        const accepted = (await workflow.recordQualityReview(context, reviewed.version, reviewer, receipt))!;
        assert.equal(workflowDeliveryInput(context, accepted, null, []).pages.length, 2);
        const wrongAuthority = await new PresenceWorkflow(setup.pool, operations).review(context);
        assert.equal(wrongAuthority?.deliveryQuality?.passed, false);
        assert.throws(() => workflowDeliveryInput(context, wrongAuthority!, null, []), /quality review/);
        const negative: QualityReview = { ...receipt, findings: receipt.findings.map(finding => finding.criterion === "commercial-copy"
          ? { ...finding, status: "revise", observation: "The opening offer is too vague to guide a buyer." } : finding) };
        const rejected = (await workflow.recordQualityReview(context, accepted.version, reviewer, negative))!;
        assert.equal(rejected.next, "editorial-review");
        assert.equal(rejected.operatorReview, null);
        assert.equal(rejected.deliveryQuality?.history.length, 2);
        assert.equal(rejected.editorialFindings?.[0].concern, "The opening offer is too vague to guide a buyer.");
        assert.throws(() => workflowDeliveryInput(context, rejected, null, []), /quality review/);
      }
      const source: MeasurementSource = { id: randomUUID(), selection: context.scope, environment: "synthetic",
        activatedAt: new Date(Date.now() - 60_000).toISOString(), coverage: ["action-selected", "contact-accepted"],
        revision: fingerprint(complete.pages), routes: { "/": ["request-review"] } };
      const at = new Date(Date.now() - 1000).toISOString();
      const selection = { id: randomUUID(), kind: "action-selected", at, page: "/", action: "request-review", attribution: null };
      const wrongSite = context === bound.c0 ? bound.c2 : bound.c0;
      await assert.rejects(measurement.record({ ...source, selection: { ...context.scope, managedSiteId: wrongSite.scope.managedSiteId } }, selection), /unscoped/);
      await measurement.record(source, selection);
      await measurement.record(source, selection);
      const snapshot = await measurement.snapshot(source, source.activatedAt, new Date().toISOString());
      assert.equal(snapshot.counts["action-selected"], 1);
      assert.equal(snapshot.customerOutcome, null);
      assert.ok(snapshot.recommendation?.next.includes("inquiry path"));
      const separate = await measurement.snapshot({ ...source, selection: wrongSite.scope }, source.activatedAt, new Date().toISOString());
      assert.equal(separate.counts["action-selected"], 0);
    }
    assert.equal(await new PresenceWorkflow(setup.pool, operations).review(origin), null);
    assert.deepEqual(await original.service.workflowContext("aa".repeat(32)), original.context);
  } finally { await setup.stop(); }
});
