import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { createC0Onboarding } from "../../scripts/intake/c0-onboarding";
import { workflowFixture } from "../../scripts/intake/presence-workflow-fixture";
import { fingerprint } from "../../lib/platform/canonical/model";
import { IntakeService } from "../../lib/platform/intake/service";
import { PresenceWorkflow, type WorkflowContext, type PresenceWorkflowOperations } from "../../lib/platform/intake/presence-workflow";
import { workPresenceCase } from "../../lib/platform/intake/protected-presence-workflow";
import { qualityCriteria, type MarketingAuthority } from "../../lib/platform/intake/presence-marketing-authority";

test("real disposable PostgreSQL retains early critique, separated review, replan history and the new strategy queue", async () => {
  const setup = await createC0Onboarding(process.env.PG_BIN_DIR ?? "C:/Program Files/PostgreSQL/18/bin", true, undefined, true);
  try {
    const service = new IntakeService(setup.pool, setup.selection), token = randomBytes(32).toString("hex");
    await service.create(token, "DIRECT_START");
    const initial = await service.workflowContext(token);
    const source = { id: "fixture-offer", kind: "owner-confirmed" as const, label: "Offline offer", date: null, reference: "Offline integration fixture",
      content: "The fixture business provides a managed presence service." };
    const context: WorkflowContext = { ...initial, evidence: [source], evaluation: { scenario: "c0", basis: fingerprint("isolated PostgreSQL concept fixture") } };
    const authority: MarketingAuthority = { contextDigest: fingerprint(context), projectionVersion: 2, earlyConceptReview: true,
      sources: [{ digest: fingerprint(source), use: "business-fact" }], sourceSelections: [{ digest: fingerprint(source), passages: [source.content] }],
      brandDigest: fingerprint("fixture brand"), brandBrief: "Fixture brand", qualityReviewerId: "reviewer" };
    let calls = 0;
    const operations: PresenceWorkflowOperations = { ...workflowFixture, marketingAuthority: authority, maxCommercialReplans: 1,
      async run(run, retain) {
        calls++;
        if (run.work.reviewStage) {
          const output = { summary: "Offline critic double.", concerns: [{ path: "/", concern: "The value proposition requires a strategic rethink." }] };
          await retain(Buffer.from(JSON.stringify(output))); return output;
        }
        const output = await workflowFixture.run(run, async () => {});
        if (run.work.operation === "page") {
          const page = output as { sections: object[]; actions: object[] };
          const composed = { ...page, composition: "managed-v1", sections: page.sections.map((section, index) => ({
            ...section, role: index === 0 ? "hero" : "intro" })), actions: page.actions.map(action => ({ ...action, sectionIndex: 0 })) };
          await retain(Buffer.from(JSON.stringify(composed))); return composed;
        }
        await retain(Buffer.from(JSON.stringify(output))); return output;
      } };
    const operator = { id: "author", role: "operator" as const, simulated: true, authority: "Offline disposable scope" };
    const reviewer = { ...operator, id: "reviewer" };
    const open = () => new PresenceWorkflow(setup.pool, operations);
    const workflow = open();
    await workflow.start(context);
    const report = (await workPresenceCase(workflow, context))!;
    await workflow.confirmReport(context, report.version, operator, true);
    const home = (await workPresenceCase(workflow, context))!;
    assert.equal(home.next, "home-concept"); assert.deepEqual(home.pages.map(page => page.path), ["/"]);
    const prepared = await workflow.conceptCritiqueInput(context, home.version, operator);
    const critiqued = (await workflow.critiqueHomeConcept(context, home.version, operator))!;
    const retainedCalls = calls;
    const reloaded = (await open().review(context))!;
    assert.equal(reloaded.conceptQuality?.critique?.inputDigest, prepared.work.inputDigest);
    assert.equal(reloaded.editorial, null);
    await open().critiqueHomeConcept(context, reloaded.version, operator);
    assert.equal(calls, retainedCalls);
    const reviewed = (await open().recordQualityReview(context, reloaded.version, reviewer, {
      target: critiqued.conceptQuality!.target, desktopEvidence: fingerprint("desktop fixture"), mobileEvidence: fingerprint("mobile fixture"),
      findings: qualityCriteria.map((criterion, index) => ({ criterion, status: index === 0 ? "revise" : "pass", observation: "Offline independent-role judgment." })),
    }))!;
    const replanned = (await open().requestCommercialReplan(context, reviewed.version, operator))!;
    assert.equal(replanned.next, "direction"); assert.deepEqual(replanned.pages, []);
    assert.deepEqual(replanned.report, report.report);
    const events = await setup.pool.query("SELECT payload,digest FROM presence_workflow_events WHERE intake_id=$1 ORDER BY version", [context.intakeId]);
    assert.ok(events.rows.every(row => fingerprint(row.payload) === row.digest));
    assert.ok(events.rows.some(row => row.payload.pages?.length === 1 && row.payload.pages[0].path === "/"));
    assert.ok(events.rows.some(row => row.payload.conceptEditorial?.inputDigest === prepared.work.inputDigest));
    assert.equal(events.rows.at(-1)!.payload.replan.ordinal, 1);
    assert.deepEqual(events.rows.at(-1)!.payload.replan.concerns, ["offer-and-value"]);
    assert.deepEqual(events.rows.at(-1)!.payload.replan.conceptCritique, critiqued.conceptQuality!.critique);
    const outputs = await setup.pool.query("SELECT count(*)::int AS n FROM presence_workflow_outputs WHERE intake_id=$1", [context.intakeId]);
    assert.ok(outputs.rows[0].n > 0);
    await assert.rejects(open().requestCommercialReplan(context, replanned.version, operator), { code: "workflow_not_ready" });
  } finally { await setup.stop(); }
});
