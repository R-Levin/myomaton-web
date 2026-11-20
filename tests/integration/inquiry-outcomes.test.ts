import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import { createC0Onboarding } from "../../scripts/intake/c0-onboarding";
import { acceptContactSubmission } from "../../lib/platform/contact/submissions";
import { InquiryOutcomes } from "../../lib/platform/contact/outcomes";

test("ordinary Contact acceptance and explicit outcome confirmation share an account without inventing performance", async () => {
  const setup = await createC0Onboarding(process.env.PG_BIN_DIR ?? "C:/Program Files/PostgreSQL/18/bin", true, undefined, true);
  const server = setup.listener(); server.listen(0, "127.0.0.1"); await once(server, "listening");
  try {
    const addr = server.address(); assert.ok(addr && typeof addr !== "string");
    const origin = `http://127.0.0.1:${addr.port}`, api = origin + "/api/onboarding";
    const access = await fetch(api + "/access", { method: "POST", headers: { Origin: origin, "X-Intake-Request": "1", "X-Local-Access": setup.accessCode! } });
    let cookie = access.headers.get("set-cookie")!.split(";")[0];
    const post = (value: unknown, authenticated = true) => fetch(api, { method: "POST", headers: {
      Origin: origin, Cookie: authenticated ? cookie : "", "X-Intake-Request": "1", "Content-Type": "application/json",
    }, body: JSON.stringify(value) });
    const read = () => fetch(api, { headers: { Cookie: cookie, "X-Intake-Request": "1" } });
    const begin = await post({ operation: "begin" }); cookie += "; " + begin.headers.get("set-cookie")!.split(";")[0];
    assert.deepEqual((await (await read()).json()).inquiryOutcomes.inquiries, []);
    const page = (await setup.pool.query("INSERT INTO pages(managed_site_id,slug,name,title) VALUES($1,'/contact','Contact','Contact') RETURNING id", [setup.selection.managedSiteId])).rows[0].id;
    const definition = (await setup.pool.query("INSERT INTO contact_definitions(web_presence_id,name,configuration) VALUES($1,'Development contact',$2) RETURNING id", [setup.selection.webPresenceId,
      { fields: [{ key: "email", label: "Email", required: true }, { key: "message", label: "Message", required: true }] }])).rows[0].id;
    const section = (await setup.pool.query("INSERT INTO sections(page_id,type,content) VALUES($1,'contact',$2) RETURNING id", [page, { contact_definition_id: definition }])).rows[0].id;
    const fields = { email: "development-only@example.test", message: "Representative development inquiry; never transmit automatically." };
    const submission = { sectionId: section, definitionId: definition, version: 1, fields, idempotencyKey: randomUUID() };
    const selection = { ...setup.selection, domain: "development.invalid", managedSiteName: "Development site" };
    const options = { abuse: { allow: async () => true } };
    assert.equal((await acceptContactSubmission(setup.pool, selection, submission, options)).accepted, true);
    assert.equal((await acceptContactSubmission(setup.pool, selection, submission, options)).duplicate, true);
    let view = (await (await read()).json()).inquiryOutcomes;
    assert.equal(view.environment, "development"); assert.equal(view.siteRevision, null);
    assert.equal(view.inquiries.length, 1);
    assert.equal(view.inquiries[0].delivery, "disabled"); assert.equal(view.inquiries[0].outcome, "unknown");
    assert.equal(view.inquiries[0].qualification, "unknown");
    assert.doesNotMatch(JSON.stringify(view), /development-only@example|Representative development inquiry/);
    const input = { submissionId: view.inquiries[0].id, requestId: randomUUID(), expectedVersion: 0,
      qualification: "qualified", outcome: "conversation", confirmedAt: new Date().toISOString(), reference: "Simulated customer confirmation of this development inquiry", confirmed: true };
    const operation = { operation: "record-inquiry-outcome", outcome: input };
    assert.equal((await post(operation, false)).status, 401);
    assert.equal((await post({ ...operation, webPresenceId: randomUUID() })).status, 400);
    assert.equal((await post({ ...operation, outcome: { ...input, environment: "live" } })).status, 400);
    assert.equal((await post({ ...operation, outcome: { ...input, confirmed: false } })).status, 400);
    assert.equal((await post({ ...operation, outcome: { ...input, submissionId: randomUUID() } })).status, 404);
    const context = Object.freeze({}), readOnly = new InquiryOutcomes(setup.pool, { authorize: async () => ({ operatorId: "test", authorityReference: "Read only" }) }, "development");
    await assert.rejects(readOnly.record(context, setup.selection, input), { code: "authorization_required" });
    const broadTestGrant = new InquiryOutcomes(setup.pool, { authorize: async () => ({ operatorId: "test", authorityReference: "Test authority", customer: { kind: "business-representative", subjectId: "test", authorityReference: "Simulated representative" } }) }, "development");
    await assert.rejects(broadTestGrant.record(context, { ...setup.selection, managedSiteId: randomUUID() }, input), { code: "unavailable" });
    const replies = await Promise.all([post(operation), post(operation)]);
    assert.deepEqual(replies.map(response => response.status), [200, 200]);
    view = (await (await read()).json()).inquiryOutcomes;
    assert.equal(view.inquiries[0].history.length, 1); assert.equal(view.inquiries[0].qualification, "qualified");
    assert.equal(view.inquiries[0].outcome, "conversation"); assert.equal(view.inquiries[0].delivery, "disabled");
    assert.equal((await post({ ...operation, outcome: { ...input, outcome: "became-customer" } })).status, 409);
    assert.equal((await post({ ...operation, outcome: { ...input, requestId: randomUUID() } })).status, 409);
    const corrected = { ...input, requestId: randomUUID(), expectedVersion: 1, qualification: "not-qualified", outcome: "closed", confirmedAt: new Date().toISOString(), reference: "Corrected representative development outcome" };
    await setup.pool.query("CREATE FUNCTION outcome_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Forced outcome rollback'; END $$");
    await setup.pool.query("CREATE TRIGGER outcome_test_failure BEFORE INSERT ON contact_outcome_events FOR EACH ROW EXECUTE FUNCTION outcome_test_failure()");
    try { assert.equal((await post({ ...operation, outcome: corrected })).status, 503); }
    finally { await setup.pool.query("DROP TRIGGER outcome_test_failure ON contact_outcome_events"); await setup.pool.query("DROP FUNCTION outcome_test_failure()"); }
    assert.equal((await (await read()).json()).inquiryOutcomes.inquiries[0].history.length, 1);
    assert.equal((await post({ ...operation, outcome: corrected })).status, 200);
    view = (await (await read()).json()).inquiryOutcomes;
    assert.equal(view.inquiries[0].history.length, 2); assert.equal(view.inquiries[0].outcome, "closed");
    assert.equal(view.inquiries[0].history[0].payload.outcome, "conversation");
    await assert.rejects(setup.pool.query("UPDATE contact_outcome_events SET payload=payload WHERE submission_id=$1", [input.submissionId]), /append only/);
    assert.equal((await setup.pool.query("SELECT count(*)::int n FROM contact_submissions")).rows[0].n, 1);
    await setup.pool.query("UPDATE contact_submissions SET expires_at=created_at+interval '1 microsecond' WHERE id=$1", [input.submissionId]);
    assert.deepEqual((await (await read()).json()).inquiryOutcomes.inquiries, []);
    assert.equal((await post({ ...operation, outcome: { ...corrected, requestId: randomUUID(), expectedVersion: 2 } })).status, 404);
    await setup.pool.query("DELETE FROM contact_submissions WHERE id=$1", [input.submissionId]);
    assert.equal((await setup.pool.query("SELECT count(*)::int n FROM contact_outcome_events")).rows[0].n, 0);
    assert.equal((await setup.pool.query("SELECT count(*)::int n FROM presence_workflow_outputs")).rows[0].n, 0);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await setup.stop(); }
});
