import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import { createC0Onboarding } from "../../scripts/intake/c0-onboarding";
import { workflowFixture } from "../../scripts/intake/presence-workflow-fixture";
import { fingerprint } from "../../lib/platform/canonical/model";
import { PresenceWorkflow, type PresenceWorkflowView, type WorkflowContext } from "../../lib/platform/intake/presence-workflow";
import type { AccountWorkView } from "../../lib/platform/intake/account-work";
import { workflowDeliveryInput } from "../../lib/platform/intake/presence-workflow-delivery";

test("an account retains source corrections and dependent work, retries safely, and separates actual review activity", async () => {
  const setup = await createC0Onboarding(process.env.PG_BIN_DIR ?? "C:/Program Files/PostgreSQL/18/bin", true, undefined, true);
  const server = setup.listener();
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try {
    const addr = server.address(); assert.ok(addr && typeof addr !== "string");
    const origin = `http://127.0.0.1:${addr.port}`, api = origin + "/api/onboarding";
    const access = await fetch(api + "/access", { method: "POST", headers: {
      Origin: origin, "X-Intake-Request": "1", "X-Local-Access": setup.accessCode!,
    } });
    let cookie = access.headers.get("set-cookie")!.split(";")[0];
    const post = (value: unknown, authenticated = true) => fetch(api, { method: "POST", headers: {
      Origin: origin, Cookie: authenticated ? cookie : "", "Content-Type": "application/json", "X-Intake-Request": "1",
    }, body: JSON.stringify(value) });
    const read = () => fetch(api, { headers: { Cookie: cookie, "X-Intake-Request": "1" } });
    const began = await post({ operation: "begin" });
    cookie += "; " + began.headers.get("set-cookie")!.split(";")[0];
    let state: PresenceWorkflowView;
    let account: AccountWorkView;
    const run = async (operation: string) => {
      const response = await post({ operation: "workflow-" + operation, ...(state && { version: state.version }) });
      assert.equal(response.status, 200);
      const view = await response.json(); state = view.workflow; account = view.accountWork;
    };
    await run("start"); await run("next"); await run("next"); await run("confirm");
    await run("next"); await run("next"); await run("next");
    assert.equal(state!.pages.length, 1);
    const baseline = structuredClone(state!), source = account!.sources.find(item => item.kind === "owner-confirmed")!;
    assert.ok(source);
    const canonical = (await setup.pool.query("SELECT id,payload,version FROM business_knowledge WHERE web_presence_id=$1", [setup.selection.webPresenceId])).rows;
    const outputCount = async () => (await setup.pool.query("SELECT count(*)::int AS total FROM presence_workflow_outputs")).rows[0].total;
    const outputs = await outputCount();
    const correction = { id: randomUUID(), sourceId: source.id, sourceDigest: source.digest,
      text: "Review the full managed growth service, rather than presenting Ongoing as maintenance only. This test note is unconfirmed." };
    const operation = { operation: "workflow-understanding-correct", version: state!.version, correction };
    assert.equal((await post(operation, false)).status, 401);
    assert.equal((await post({ ...operation, correction: { ...correction, sourceDigest: "0".repeat(64) } })).status, 409);
    assert.equal((await post({ ...operation, correction: { ...correction, sourceId: "foreign-source" } })).status, 409);
    assert.equal((await post({ ...operation, webPresenceId: randomUUID() })).status, 400);
    assert.equal((await post({ ...operation, correction: { ...correction, text: "<script>invalid</script>" } })).status, 400);
    const stored = await post(operation); assert.equal(stored.status, 200);
    let resumed = await stored.json(); state = resumed.workflow; account = resumed.accountWork;
    assert.equal(state.next, "understanding-review");
    assert.equal(account.pendingCorrections, 1);
    assert.deepEqual(state.report, baseline.report); assert.deepEqual(state.direction, baseline.direction);
    assert.deepEqual(state.blueprint, baseline.blueprint); assert.deepEqual(state.pages, baseline.pages);
    assert.deepEqual(state.sources, baseline.sources);
    assert.ok(account.corrections[0].impact.direction);
    assert.deepEqual(account.corrections[0].impact.pages, ["/", "/project"]);
    const retry = await post(operation); assert.equal(retry.status, 200);
    assert.equal((await retry.json()).workflow.version, state.version);
    assert.equal((await post({ ...operation, correction: { ...correction, text: "Different retry" } })).status, 409);
    assert.equal((await post({ ...operation, correction: { ...correction, id: randomUUID() } })).status, 409);
    assert.equal((await post({ operation: "workflow-next", version: state.version })).status, 409);
    resumed = await (await read()).json();
    assert.equal(resumed.accountWork.corrections[0].text, correction.text);
    assert.equal(await outputCount(), outputs);
    assert.deepEqual((await setup.pool.query("SELECT id,payload,version FROM business_knowledge WHERE web_presence_id=$1", [setup.selection.webPresenceId])).rows, canonical);

    const { rows: [bound] } = await setup.pool.query("SELECT intake_id,payload->'sourceSnapshot' AS source FROM presence_workflow_events ORDER BY version DESC LIMIT 1");
    const context: WorkflowContext = { ...bound.source, scope: setup.selection, intakeId: bound.intake_id };
    const reopened = new PresenceWorkflow(setup.pool, workflowFixture);
    assert.deepEqual((await reopened.review(context))?.understandingCorrections, state.understandingCorrections);
    const actor = { id: "local-customer", role: "customer", simulated: true } as const;
    await assert.rejects(reopened.correctUnderstanding(context, state.version, { ...correction, id: randomUUID() }, { ...actor, simulated: false }), { code: "unavailable" });
    const foreign = { ...context, scope: { ...context.scope, webPresenceId: randomUUID() } };
    assert.equal(await reopened.review(foreign), null);
    await assert.rejects(reopened.correctUnderstanding(foreign, state.version, correction, actor), { code: "workflow_not_ready" });
    await assert.rejects(reopened.withdrawUnderstandingCorrection(context, state.version, { id: correction.id, reason: "Wrong actor" }, { ...actor, id: "other-customer" }), { code: "unavailable" });
    assert.throws(() => workflowDeliveryInput(context, state, {}, []), /Complete exact workflow/);
    const withdrawal = { operation: "workflow-understanding-withdraw", version: state.version,
      correction: { id: correction.id, reason: "Withdraw this isolated test note; retain its history." } };
    const withdrawn = await post(withdrawal); assert.equal(withdrawn.status, 200);
    resumed = await withdrawn.json();
    assert.equal(resumed.accountWork.pendingCorrections, 0);
    assert.equal(resumed.accountWork.corrections.length, 1);
    assert.ok(resumed.accountWork.corrections[0].withdrawn);
    assert.equal(resumed.workflow.next, baseline.next);
    assert.deepEqual(resumed.workflow.pages, baseline.pages);
    assert.equal((await post(withdrawal)).status, 200);
    assert.equal(await outputCount(), outputs);

    const event = { id: randomUUID(), kind: "page-observed", at: new Date().toISOString(), action: null };
    assert.equal((await post({ operation: "review-activity", event }, false)).status, 401);
    assert.equal((await post({ operation: "review-activity", event: { ...event, sourceId: randomUUID() } })).status, 400);
    assert.equal((await post({ operation: "review-activity", event: { ...event, kind: "contact-accepted" } })).status, 400);
    assert.equal((await post({ operation: "review-activity", event: { ...event, action: "foreign-action" } })).status, 400);
    assert.equal((await post({ operation: "review-activity", event })).status, 200);
    assert.equal((await post({ operation: "review-activity", event })).status, 200);
    const selected = { id: randomUUID(), kind: "action-selected", at: new Date().toISOString(), action: "open-current-work" };
    assert.equal((await post({ operation: "review-activity", event: selected })).status, 200);
    resumed = await (await read()).json();
    assert.equal(resumed.accountActivity.environment, "development");
    assert.deepEqual(resumed.accountActivity.counts, { "page-observed": 1, "action-selected": 1, "contact-accepted": null });
    assert.equal(resumed.accountActivity.customerOutcome, null);
    assert.equal(resumed.firstParty.environment, "synthetic");
    assert.equal(resumed.firstParty.counts["page-observed"], 1);
    assert.notEqual(resumed.accountActivity.sourceId, resumed.firstParty.sourceId);
    assert.equal(await outputCount(), outputs);
    assert.equal(fingerprint((await setup.pool.query("SELECT id,payload,version FROM business_knowledge WHERE web_presence_id=$1", [setup.selection.webPresenceId])).rows), fingerprint(canonical));
  } finally {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await setup.stop();
  }
});
