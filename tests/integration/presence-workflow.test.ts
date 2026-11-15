import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createC0Onboarding } from "../../scripts/intake/c0-onboarding";
import { workflowFixture } from "../../scripts/intake/presence-workflow-fixture";
import { fingerprint } from "../../lib/platform/canonical/model";
import { FirstPartyMeasurement, type MeasurementSource } from "../../lib/platform/measurement/first-party";
import { PresenceWorkflow, type PresenceWorkflowView } from "../../lib/platform/intake/presence-workflow";
import { IntakeService } from "../../lib/platform/intake/service";

test("the existing local Core interface persists a report, correction, revised site and performance snapshot", async () => {
  const retainedEvidence = process.env.MIOPAGES_LOCAL_WORKFLOW_RETAINED;
  const setup = await createC0Onboarding(process.env.PG_BIN_DIR ?? "C:/Program Files/PostgreSQL/18/bin", true, retainedEvidence, true);
  const server = setup.listener();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string" && setup.accessCode);
    const origin = "http://127.0.0.1:" + address.port;
    assert.equal((await fetch(origin + "/onboarding")).status, 200);
    const boot = await (await fetch(origin + "/onboarding.js")).text();
    assert.match(boot, /Business report and website/);
    assert.match(boot, /Performance Snapshot/);
    const api = origin + "/api/onboarding";
    assert.equal((await fetch(api, { headers: { "X-Intake-Request": "1" } })).status, 401);
    const authenticated = await fetch(api + "/access", { method: "POST", headers: {
      Origin: origin, "X-Intake-Request": "1", "X-Local-Access": setup.accessCode,
    } });
    assert.equal(authenticated.status, 204);
    let cookie = authenticated.headers.get("set-cookie")!.split(";")[0];
    assert.match(cookie, /^miopages_presence_workflow_access=/u);
    // Browsers send an older 127.0.0.1 cookie across ports. The current review
    // access is valid even when that other disposable intake is gone.
    const earlierDraft = "miopages_adaptive_c0=" + "a1".repeat(32);
    const oldCookieRead = await fetch(api, { headers: { Cookie: cookie + "; " + earlierDraft, "X-Intake-Request": "1" } });
    assert.deepEqual({ status: oldCookieRead.status, body: await oldCookieRead.json() }, { status: 200, body: { state: "not_started" } });
    assert.equal(oldCookieRead.headers.has("set-cookie"), false);
    const priorAccess = cookie.replace("miopages_presence_workflow_access=", "miopages_local_journey=");
    assert.equal((await fetch(api, { headers: { Cookie: priorAccess, "X-Intake-Request": "1" } })).status, 401);
    cookie += "; " + earlierDraft;
    const staleWorkflow = await fetch(api, { headers: {
      Cookie: cookie + "; miopages_presence_workflow_draft=" + "a2".repeat(32), "X-Intake-Request": "1",
    } });
    assert.equal(staleWorkflow.status, 200);
    assert.deepEqual(await staleWorkflow.json(), { state: "not_started" });
    assert.equal(staleWorkflow.headers.get("set-cookie"),
      "miopages_presence_workflow_draft=; Path=/api/onboarding; HttpOnly; SameSite=Strict; Max-Age=0");
    const post = (value: unknown) => fetch(api, { method: "POST", headers: {
      Origin: origin, Cookie: cookie, "Content-Type": "application/json", "X-Intake-Request": "1",
    }, body: JSON.stringify(value) });
    const begin = await post({ operation: "begin" });
    assert.equal(begin.status, 200);
    const opened = await begin.json();
    assert.equal(opened.firstParty.counts["page-observed"], 1);
    assert.equal(opened.firstParty.counts["action-selected"], 1);
    assert.equal(opened.firstParty.counts["contact-accepted"], 0);
    assert.equal(opened.firstParty.customerOutcome, null);
    assert.equal(opened.firstParty.environment, "synthetic");
    const newDraft = begin.headers.get("set-cookie")!.split(";")[0];
    assert.match(newDraft, /^miopages_presence_workflow_draft=/u);
    cookie += "; " + newDraft;
    let state: PresenceWorkflowView;
    async function run(operation: string, extra = {}) {
      const response = await post({ operation: "workflow-" + operation,
        ...(operation !== "start" && { version: state.version }), ...extra });
      const body = await response.json();
      assert.equal(response.status, 200, JSON.stringify({ code: body.error, operation }));
      state = body.workflow;
      return state;
    }
    const initial = await run("start");
    assert.equal(initial.next, "research");
    const competing = await Promise.all([
      post({ operation: "workflow-next", version: initial.version }),
      post({ operation: "workflow-next", version: initial.version }),
    ]);
    assert.deepEqual(competing.map(result => result.status).sort(), [200, 409]);
    state = (await competing.find(result => result.ok)!.json()).workflow;
    const first = await run("next");
    assert.equal(first.next, "customer-review");
    assert.ok(first.report?.findings.some(item => item.id === "existing-website"));
    assert.ok(first.sources.some(item => item.id === "market-correction"));
    assert.equal(first.sources.filter(item => item.kind === "customer-unconfirmed").length, retainedEvidence ? 10 : 0);
    assert.equal((await post({ operation: "workflow-next", version: first.version })).status, 409);
    await run("confirm");
    await run("next");
    assert.equal(state!.next, "blueprint");
    const correction = "Ask existing-site visitors which booking or form path must survive the handoff.";
    await run("correct", { finding: "existing-website", correction });
    assert.equal(state!.direction, null);
    assert.equal(state!.confirmation, null);
    await run("next");
    assert.equal(state!.report?.findings[1].body, correction);
    assert.equal(state!.report?.findings[0].body, first.report?.findings[0].body);
    let progress = await run("confirm");
    for (let step = 0; progress.next !== "operator-review" && step < 12; step++) {
      progress = await run(progress.next === "editorial-review" ? "revise" : "next");
    }
    assert.equal(progress.next, "operator-review");
    assert.equal(state!.pages.length, 2);
    assert.equal(state!.pages[1].sections[0].body, correction);
    assert.equal(state!.pages[0].actions.length, 2);
    assert.equal(state!.pages[0].actions[0].destination, null);
    assert.equal(state!.editorial?.concerns.length, 0);
    await run("review");
    assert.equal(state!.operatorReview?.actor.simulated, true);
    const response = await fetch(api, { headers: { Cookie: cookie, "X-Intake-Request": "1" } });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).workflow, state);
    const audit = await setup.pool.query("SELECT count(*)::int AS total FROM presence_workflow_outputs");
    assert.ok(audit.rows[0].total >= 8, "completed task outputs are retained in PostgreSQL");

    const secondIntake = new IntakeService(setup.pool, setup.selection);
    const otherToken = "ab".repeat(32);
    await secondIntake.create(otherToken, "FREE_REVIEW");
    const secondContext = { ...await secondIntake.workflowContext(otherToken), evidence: initial.sources };
    let freshExecutions = 0;
    const interrupted = new PresenceWorkflow(setup.pool, {
      ...workflowFixture,
      async run(work, retain) {
        freshExecutions++;
        await workflowFixture.run(work, retain);
        throw Error("Simulated interruption after custody");
      },
    });
    const reopened = new PresenceWorkflow(setup.pool, workflowFixture);
    const waiting = await interrupted.start(secondContext);
    assert.equal(waiting?.entry, "FREE_REVIEW");
    const failed = await interrupted.advance(secondContext, waiting!.version);
    assert.equal(failed?.failure, "outcome-unknown");
    assert.equal(await reopened.review({ ...secondContext, scope: { ...secondContext.scope, webPresenceId: randomUUID() } }), null);
    assert.equal((await reopened.recover(secondContext, failed!.version))?.next, "report");
    assert.equal(freshExecutions, 1);
    assert.equal((await reopened.review(secondContext))?.report, null);
    const changed = await reopened.review({ ...secondContext, evidence: secondContext.evidence.map(source => ({ ...source, content: "Changed source" })) });
    assert.equal(changed?.next, "evidence-changed");
    assert.deepEqual(changed?.sources, secondContext.evidence);

    const now = Date.parse("2026-11-15T15:00:00Z");
    const measurement = new FirstPartyMeasurement(setup.pool, () => now);
    const source: MeasurementSource = { id: randomUUID(), selection: setup.selection, revision: fingerprint("local revision"),
      environment: "synthetic", activatedAt: "2026-11-15T14:10:00.000Z", routes: { "/": ["learn"] }, coverage: ["page-observed", "action-selected"] };
    const event = { id: randomUUID(), at: "2026-11-15T14:15:00.000Z", kind: "action-selected", page: "/", action: "learn", attribution: null };
    await measurement.record(source, event);
    await measurement.record(source, event);
    await assert.rejects(measurement.record(source, { ...event, attribution: "search" }), /conflicting/i);
    await assert.rejects(measurement.record(source, { ...event, email: "not-collected@example.test" }), /unknown/i);
    await assert.rejects(measurement.record(source, { ...event, action: "unregistered" }), /scope/i);
    const partial = await measurement.snapshot(source, "2026-11-15T14:00:00.000Z", "2026-11-15T15:00:00.000Z");
    assert.equal(partial.counts["action-selected"], null);
    const covered = await measurement.snapshot(source, "2026-11-15T14:10:00.000Z", "2026-11-15T15:00:00.000Z");
    assert.equal(covered.sourceId, source.id);
    assert.equal(covered.revision, source.revision);
    assert.deepEqual(covered.counts, { "page-observed": 0, "action-selected": 1, "contact-accepted": null });
    const live = await measurement.snapshot({ ...source, environment: "live", coverage: [] }, "2026-11-15T14:10:00.000Z", "2026-11-15T15:00:00.000Z");
    assert.equal(live.counts["action-selected"], null);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await setup.stop();
  }
});
