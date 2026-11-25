import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import { createC0Onboarding } from "../../scripts/intake/c0-onboarding";
import { workflowFixture } from "../../scripts/intake/presence-workflow-fixture";
import { fingerprint } from "../../lib/platform/canonical/model";
import { inspectCanonical, writeCanonical } from "../../lib/platform/canonical/writes";
import { PresenceWorkflow, runInput, type PresenceWorkflowView, type WorkflowContext } from "../../lib/platform/intake/presence-workflow";
import type { AccountWorkView } from "../../lib/platform/intake/account-work";

test("confirmed knowledge and workflow receipts commit together; targeted reassessment retains history without collateral changes", async () => {
  const setup = await createC0Onboarding(process.env.PG_BIN_DIR ?? "C:/Program Files/PostgreSQL/18/bin", true, undefined, true);
  const server = setup.listener(); server.listen(0, "127.0.0.1"); await once(server, "listening");
  try {
    const addr = server.address(); assert.ok(addr && typeof addr !== "string");
    const origin = `http://127.0.0.1:${addr.port}`, api = origin + "/api/onboarding";
    const access = await fetch(api + "/access", { method: "POST", headers: { Origin: origin, "X-Intake-Request": "1", "X-Local-Access": setup.accessCode! } });
    let cookie = access.headers.get("set-cookie")!.split(";")[0];
    const post = (input: unknown, authenticated = true) => fetch(api, { method: "POST", headers: {
      Origin: origin, Cookie: authenticated ? cookie : "", "X-Intake-Request": "1", "Content-Type": "application/json",
    }, body: JSON.stringify(input) });
    const read = () => fetch(api, { headers: { Cookie: cookie, "X-Intake-Request": "1" } });
    const begin = await post({ operation: "begin" }); cookie += "; " + begin.headers.get("set-cookie")!.split(";")[0];
    let state: PresenceWorkflowView, account: AccountWorkView;
    async function run(operation: string, correction?: unknown) {
      const r = await post({ operation: "workflow-" + operation, ...(state && { version: state.version }), ...(correction === undefined ? {} : { correction }) });
      const result = await r.json(); assert.equal(r.status, 200, JSON.stringify({ operation, error: result.error }));
      state = result.workflow; account = result.accountWork; return result;
    }
    for (const operation of ["start", "next", "next", "confirm", "next", "next", "next", "next", "next"]) await run(operation);
    for (const operation of ["revise", "next", "next", "review"]) await run(operation);
    const original = structuredClone(state!);
    assert.equal(original.pages.length, 2);
    const outputs = async () => (await setup.pool.query("SELECT count(*)::int AS n FROM presence_workflow_outputs")).rows[0].n;
    const initialOutputs = await outputs();
    const source = account!.sources.find(item => item.kind === "owner-confirmed")!;
    const initialRecord = account!.knowledgeTargets[0], fact = initialRecord.facts.find(item => item.kind === "goal")!;
    const before = await inspectCanonical(setup.pool, "knowledge", setup.selection.webPresenceId, initialRecord.id); assert.ok(before);
    const c2 = { organization: randomUUID(), presence: randomUUID(), site: randomUUID(), knowledge: randomUUID() };
    await setup.pool.query("INSERT INTO organizations(id,name,status) VALUES($1,'Fictional C2','active')", [c2.organization]);
    await setup.pool.query("INSERT INTO web_presences(id,organization_id,name,status) VALUES($1,$2,'Fictional tree service','active')", [c2.presence, c2.organization]);
    await setup.pool.query("INSERT INTO managed_sites(id,web_presence_id,name,status) VALUES($1,$2,'C2 site','active')", [c2.site, c2.presence]);
    await writeCanonical(setup.pool, { domain: "knowledge", id: c2.knowledge, webPresenceId: c2.presence, expectedVersion: null, expectedFingerprint: null,
      responsibleIdentity: before.row.payload.approval.by, changeReason: "Isolated C2 ownership regression", payload: before.row.payload });
    const c2Before = await inspectCanonical(setup.pool, "knowledge", c2.presence, c2.knowledge); assert.ok(c2Before);
    const sourceState = async () => fingerprint({
      current: (await setup.pool.query("SELECT * FROM business_knowledge ORDER BY id")).rows,
      revisions: (await setup.pool.query("SELECT * FROM business_knowledge_revisions ORDER BY knowledge_id,revision_version")).rows,
      events: (await setup.pool.query("SELECT * FROM presence_workflow_events ORDER BY version")).rows,
    });
    const note = { id: randomUUID(), sourceId: source.id, sourceDigest: source.digest,
      text: "Correct this retained business goal in the isolated test. No real business approval is performed." };
    await run("understanding-correct", note);
    const input = { correctionId: note.id, requestId: randomUUID(), target: { id: initialRecord.id, key: fact.key,
      version: initialRecord.version, fingerprint: initialRecord.fingerprint }, value: "Recorded test: help visitors prepare a useful project conversation.",
      confirmed: true, publicUse: fact.publicUse, reference: "Isolated simulated representative confirmation" };
    const operation = { operation: "workflow-understanding-confirm", version: state!.version, correction: input };
    const unchanged = await sourceState();
    assert.equal((await post(operation, false)).status, 401);
    assert.equal((await post({ ...operation, correction: { ...input, confirmed: false } })).status, 400);
    assert.equal((await post({ ...operation, correction: { ...input, publicUse: !fact.publicUse } })).status, 400);
    assert.equal((await post({ ...operation, correction: { ...input, target: { ...input.target, id: randomUUID() } } })).status, 409);
    assert.equal((await post({ ...operation, correction: { ...input, target: { ...input.target, id: c2.knowledge, version: c2Before.row.version, fingerprint: c2Before.fingerprint } } })).status, 409);
    assert.equal((await post({ ...operation, correction: { ...input, customer: { kind: "business-representative" } } })).status, 400);
    assert.equal(await sourceState(), unchanged);
    await setup.pool.query("CREATE FUNCTION test_knowledge_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Forced atomic rollback'; END $$");
    try {
      for (const table of ["business_knowledge_revisions", "presence_workflow_events"]) {
        await setup.pool.query(`CREATE TRIGGER test_knowledge_failure BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION test_knowledge_failure()`);
        try { assert.equal((await post(operation)).status, 503); assert.equal(await sourceState(), unchanged); }
        finally { await setup.pool.query(`DROP TRIGGER test_knowledge_failure ON ${table}`); }
      }
    } finally { await setup.pool.query("DROP FUNCTION test_knowledge_failure()"); }
    const confirmed = await post(operation); assert.equal(confirmed.status, 200);
    let response = await confirmed.json(); state = response.workflow; account = response.accountWork;
    assert.equal(state.next, "reassessment-ready"); assert.equal(account.pendingCorrections, 0);
    // The portal records the Client's correction like every other Client input: a Request, and the Client's Decision that applied it.
    const request = state.changes!.requests.find((item: { id: string }) => item.id === `understanding:${note.id}:request`);
    assert.deepEqual([request!.origin.kind, request!.origin.channel, request!.target.grain, request!.status], ["customer", "core-screen", "fact", "decided"]);
    const applied = state.changes!.changes.find((item: { id: string }) => item.id === `understanding:${note.id}:K1`);
    assert.deepEqual([applied!.status, applied!.target.path, applied!.difference.after], ["applied", fact.key, input.value]);
    assert.deepEqual(state.pages, original.pages); assert.equal(await outputs(), initialOutputs);
    const after = await inspectCanonical(setup.pool, "knowledge", setup.selection.webPresenceId, initialRecord.id); assert.ok(after);
    assert.equal(after.row.version, before.row.version + 1);
    assert.equal(after.row.payload.entries.find((entry: { key: string }) => entry.key === fact.key).value, input.value);
    assert.deepEqual(after.row.payload.entries.filter((entry: { key: string }) => entry.key !== fact.key), before.row.payload.entries.filter((entry: { key: string }) => entry.key !== fact.key));
    assert.equal(after.row.payload.approval.scope, before.row.payload.approval.scope);
    const retry = await post(operation); assert.equal(retry.status, 200); assert.equal((await retry.json()).workflow.version, state.version);
    assert.equal((await post({ ...operation, correction: { ...input, value: "Conflicting retry" } })).status, 409);
    assert.equal((await post({ operation: "workflow-next", version: state.version })).status, 409);
    assert.equal((await post({ operation: "workflow-understanding-withdraw", version: state.version, correction: { id: note.id, reason: "Cannot withdraw confirmed information" } })).status, 409);
    const { rows: [record] } = await setup.pool.query("SELECT intake_id,payload FROM presence_workflow_events ORDER BY version DESC LIMIT 1");
    const context: WorkflowContext = { ...record.payload.sourceSnapshot, scope: setup.selection, intakeId: record.intake_id };
    const withoutAuthority = new PresenceWorkflow(setup.pool, workflowFixture);
    await assert.rejects(withoutAuthority.confirmUnderstanding(context, state.version, input, { id: "local-customer", role: "customer", simulated: true }), { code: "unavailable" });
    const reassessmentId = randomUUID(); await run("understanding-reassess", { id: reassessmentId });
    assert.equal(state!.next, "report"); assert.deepEqual(state!.knowledgeReassessments?.[0].previous.pages, original.pages);
    assert.equal(await outputs(), initialOutputs);
    const queuedVersion = state!.version; await run("understanding-reassess", { id: reassessmentId }); assert.equal(state!.version, queuedVersion);
    const queued = (await setup.pool.query("SELECT payload FROM presence_workflow_events ORDER BY version DESC LIMIT 1")).rows[0].payload;
    const projected = runInput(context, queued);
    assert.deepEqual(projected.evidence.slice(0, context.evidence.length), context.evidence);
    assert.match(JSON.stringify(projected.knowledgeReassessment), /prepare a useful project conversation/);
    assert.doesNotMatch(JSON.stringify(projected.knowledgeReassessment), /Simulated C0 representative|local-customer|Isolated simulated representative confirmation/);
    await run("next"); assert.equal(state!.next, "customer-review");
    assert.equal(state!.report?.findings.find(item => item.id === "existing-website")?.body, input.value);
    assert.equal(state!.report?.findings.find(item => item.id === "business-offer")?.body, original.report?.findings.find(item => item.id === "business-offer")?.body);
    await run("confirm"); await run("next"); await run("next");
    assert.equal(state!.pages.length, 1); assert.deepEqual(state!.pages[0], original.pages.find(item => item.path === "/"));
    assert.deepEqual(state!.blueprint?.pages.map(page => page.change), ["retain", "revise"]);
    await run("next"); await run("next");
    assert.equal(await outputs(), initialOutputs + 5);
    assert.equal(state!.pages.find(page => page.path === "/project")?.sections[0].body, input.value);
    assert.deepEqual(account!.comparison?.pages.map(page => page.contentChanged), [false, true]);
    assert.equal(state!.operatorReview, null);
    assert.equal((await post({ operation: "workflow-revise", version: state!.version })).status, 409);
    assert.equal(state!.knowledgeReassessments?.[0].revisionOrdinal, 1);
    response = await (await read()).json(); assert.equal(response.myBusiness.facts.find((entry: { id: string }) => entry.id === initialRecord.id + ":" + fact.key).value, input.value);
    // A contrasting confirmed answer changes only the recorded goal and the revised Page;
    // this recorded provider double verifies wiring, not genuine AI intelligence.
    const secondValue = "Recorded test: prepare the current website address and its most important visitor action for discussion.";
    const secondNote = { ...note, id: randomUUID(), text: "A contrasting development correction; preserve the managed service offering." };
    await run("understanding-correct", secondNote);
    const secondTarget = account!.knowledgeTargets.find(item => item.id === initialRecord.id)!;
    await run("understanding-confirm", { ...input, correctionId: secondNote.id, requestId: randomUUID(), value: secondValue,
      target: { ...input.target, version: secondTarget.version, fingerprint: secondTarget.fingerprint } });
    await run("understanding-reassess", { id: randomUUID() });
    assert.equal(state!.knowledgeReassessments?.length, 2);
    assert.equal(state!.knowledgeReassessments?.at(-1)?.confirmations.length, 1);
    for (const operation of ["next", "confirm", "next", "next", "next", "next"]) await run(operation);
    assert.notEqual(state!.direction?.approach, input.value); assert.equal(state!.direction?.approach, secondValue);
    assert.equal(state!.report?.findings.find(item => item.id === "business-offer")?.body, original.report?.findings.find(item => item.id === "business-offer")?.body);
    assert.equal(state!.pages.find(page => page.path === "/project")?.sections[0].body, secondValue);
    assert.deepEqual(state!.pages.find(page => page.path === "/"), original.pages.find(page => page.path === "/"));
    assert.equal(await outputs(), initialOutputs + 10);
    assert.deepEqual(await inspectCanonical(setup.pool, "knowledge", c2.presence, c2.knowledge), c2Before);
    // A later outside canonical edit makes retained generated work stale before any next dispatch.
    const guard = await inspectCanonical(setup.pool, "knowledge", setup.selection.webPresenceId, initialRecord.id); assert.ok(guard);
    await writeCanonical(setup.pool, { domain: "knowledge", id: initialRecord.id, webPresenceId: setup.selection.webPresenceId,
      expectedVersion: guard.row.version, expectedFingerprint: guard.fingerprint, responsibleIdentity: "Outside test editor", changeReason: "Stale source regression",
      payload: { ...guard.row.payload, approval: { ...guard.row.payload.approval, by: "Outside test editor", at: new Date().toISOString() } } });
    assert.equal((await (await read()).json()).workflow.next, "evidence-changed");
    assert.equal((await post({ operation: "workflow-next", version: state!.version })).status, 409);
    assert.equal(await outputs(), initialOutputs + 10);
    assert.equal(await withoutAuthority.review({ ...context, scope: { ...context.scope, webPresenceId: randomUUID() } }), null);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await setup.stop(); }
});
