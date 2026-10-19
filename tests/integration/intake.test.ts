import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { createIntakeFixture, intakeDatabaseUrl } from "../../scripts/intake/disposable";
import { IntakeService, newResumeToken, resumeHash } from "../../lib/platform/intake/service";
import { intakeHttp, intakeCookie, localBrowserRequest } from "../../lib/platform/intake/http";
import { developmentGuard } from "../../lib/platform/contact/boundaries";
import { customerTables, readCustomerState, stateFingerprint } from "../../lib/platform/customer-initialization";
import { schemaSignature } from "./schema-fidelity";
import { intakeAnswersV2 as intakeAnswers, intakeAnswers as legacyAnswers } from "../helpers/intake";
import { projects } from "../../lib/platform/intake/model";

test("progressive intake PostgreSQL persistence, immutable submission, resume, scope and HTTP boundaries", async t => {
  const url = process.env.ASSET_TEST_DATABASE_URL; assert.ok(url, "Disposable PostgreSQL URL required; never skip persistence coverage");
  const f = await createIntakeFixture(url);
  const token = newResumeToken(), otherToken = newResumeToken();
  try {
    await t.test("startup accepts no references while existing/Campaign require a reference in v1 and v2", async () => {
      const f = await createIntakeFixture(url);
      try {
      for (const version of ["foundational-intake/1", "foundational-intake/2"]) {
        const testToken = newResumeToken();
        if (version === "foundational-intake/1") await f.pool.query("INSERT INTO prospect_intakes(web_presence_id,managed_site_id,entry_intent,questionnaire_version,resume_hash,expires_at,resume_expires_at) VALUES($1,$2,'FREE_REVIEW',$3,$4,now()+interval '30 days',now()+interval '30 days')", [f.service.selection.webPresenceId, f.service.selection.managedSiteId, version, resumeHash(testToken)]);
        const initial = version === "foundational-intake/1" ? await f.service.resume(testToken) : await f.service.create(testToken, "FREE_REVIEW");
        const answers = version === "foundational-intake/1" ? legacyAnswers(projects[1]) : intakeAnswers(projects[1]);
        const saved = await f.service.save(testToken, initial.version, { ...answers, website: " ", publicProfile: "" }, 2);
        assert.equal(saved.answers.website, version === "foundational-intake/1" ? "" : undefined);
        assert.deepEqual((await f.service.resume(testToken)).answers, saved.answers);
        assert.deepEqual((await f.pool.query("SELECT answers FROM prospect_intakes WHERE resume_hash=$1", [resumeHash(testToken)])).rows[0].answers, saved.answers);
        await assert.rejects(f.service.save(testToken, saved.version, { ...saved.answers, website: "malformed input" }, 2));
        assert.deepEqual(await f.service.resume(testToken), saved);
        let current = saved;
        for (const project of [projects[0], projects[2]]) {
          current = await f.service.save(testToken, current.version, { ...saved.answers, project }, 2);
          await assert.rejects(f.service.submit(testToken, current.version), /incomplete/);
        }
        current = await f.service.save(testToken, current.version, saved.answers, 2);
        assert.equal((await f.service.submit(testToken, current.version)).state, "needs_operator_review");
      }
      assert.equal((await f.service.queue()).length, 2);
      for (const s of await f.service.queue()) assert.ok(!s.answers.website && !s.answers.publicProfile);
      } finally { await f.stop(); }
    });
    await t.test("draft survives a new connection; repeated writes are exact retries; stale tabs refuse", async () => {
      const initial = await f.service.create(token, "FREE_REVIEW"); assert.equal(initial.state, "draft");
      const saved = await f.service.save(token, initial.version, { businessName: "MioPages", website: "miopages.com", publicProfile: "linkedin.com/company/example" }, 1);
      assert.equal(saved.answers.website, "https://miopages.com/"); assert.equal(saved.answers.publicProfile, "https://linkedin.com/company/example");
      const reopenedPool = new Pool({ connectionString: intakeDatabaseUrl(url, f.schema) });
      try { assert.deepEqual(await new IntakeService(reopenedPool, f.service.selection).resume(token), saved); } finally { await reopenedPool.end(); }
      assert.deepEqual(await f.service.save(token, initial.version, saved.answers, 1), saved);
      await assert.rejects(f.service.save(token, initial.version, { businessName: "Stale tab" }, 2), /draft_changed/);
      assert.equal((await f.pool.query("SELECT resume_hash FROM prospect_intakes")).rows[0].resume_hash, resumeHash(token));
      assert.ok(!JSON.stringify(await f.service.resume(token)).includes(token));
      const readonlyUrl = new URL(intakeDatabaseUrl(url, f.schema)); readonlyUrl.searchParams.set("options", readonlyUrl.searchParams.get("options") + " -c default_transaction_read_only=on");
      const reader = new Pool({ connectionString: readonlyUrl.toString() });
      try { assert.equal((await reader.query("SHOW default_transaction_read_only")).rows[0].default_transaction_read_only, "on"); assert.deepEqual(await new IntakeService(reader, f.service.selection).resume(token), saved); assert.deepEqual(await new IntakeService(reader, f.service.selection).queue(), []); }
      finally { await reader.end(); }
    });
    await t.test("incomplete, unsafe and invalid answers refuse without affecting persisted data", async () => {
      const before = await f.service.resume(token);
      await assert.rejects(f.service.submit(token, before.version), /incomplete/);
      await assert.rejects(f.service.save(token, before.version, { website: "javascript:alert(1)" }, 1));
      await assert.rejects(f.service.save(token, before.version, { ...intakeAnswers(), goals: ["unknown"] }, 12));
      assert.deepEqual(await f.service.resume(token), before);
      const expired = newResumeToken();
      await f.pool.query("INSERT INTO prospect_intakes(web_presence_id,managed_site_id,entry_intent,questionnaire_version,resume_hash,expires_at,resume_expires_at) VALUES($1,$2,'FREE_REVIEW','foundational-intake/1',$3,now()-interval '1 day',now()-interval '1 day')", [f.service.selection.webPresenceId, f.service.selection.managedSiteId, resumeHash(expired)]);
      await assert.rejects(f.service.resume(expired), /session_unavailable/);
    });
    await t.test("atomic submission queues exactly one immutable snapshot and retries produce zero changes", async () => {
      const old = await f.service.resume(token), saved = await f.service.save(token, old.version, { ...intakeAnswers(), businessName: "MioPages", website: "https://miopages.com/" }, 12);
      const submitted = await f.service.submit(token, saved.version); assert.equal(submitted.state, "needs_operator_review");
      const rows = await f.service.queue(); assert.equal(rows.length, 1); assert.deepEqual(rows[0].answers, saved.answers);
      assert.equal(rows[0].provenance.businessName.confirmation, "unconfirmed");
      const snapshot = (await f.pool.query("SELECT * FROM prospect_intake_submissions")).rows;
      assert.equal(snapshot[0].state, "submitted");
      assert.deepEqual(await f.service.submit(token, saved.version), submitted);
      assert.deepEqual((await f.pool.query("SELECT * FROM prospect_intake_submissions")).rows, snapshot);
      await assert.rejects(f.service.save(token, submitted.version, saved.answers, 0), /already_submitted/);
      await assert.rejects(f.pool.query("UPDATE prospect_intake_submissions SET answers='{}'"), /immutable/);
      await assert.rejects(f.pool.query("DELETE FROM prospect_intake_submissions"), /cannot be deleted/);
      await assert.rejects(f.pool.query("DELETE FROM prospect_intakes WHERE resume_hash=$1", [resumeHash(token)]), /cannot be deleted/);
      await assert.rejects(f.pool.query("UPDATE prospect_intakes SET answers='{}',version=version+1 WHERE resume_hash=$1", [resumeHash(token)]), /immutable/);
    });
    await t.test("direct start uses identical tables/answers and identity is never matched by domain or name", async () => {
      const draft = await f.service.create(otherToken, "DIRECT_START");
      const saved = await f.service.save(otherToken, draft.version, intakeAnswers(), 12);
      const sent = await f.service.submit(otherToken, saved.version); assert.equal(sent.intent, "DIRECT_START");
      assert.equal((await f.service.queue()).length, 2);
      assert.equal((await f.pool.query("SELECT count(*)::int n FROM prospect_intakes WHERE expires_at>now()")).rows[0].n, 2);
      const partial = await f.service.create(newResumeToken(), "FREE_REVIEW"); assert.deepEqual(partial.answers, {});
    });
    await t.test("cross-customer/prospect access, foreign relationships and unattested state transitions refuse", async () => {
      const foreignSite = f.before.managed_sites.find(r => r.id !== f.service.selection.managedSiteId)!;
      const foreign = new IntakeService(f.pool, { webPresenceId: String(foreignSite.web_presence_id), managedSiteId: String(foreignSite.id) });
      await assert.rejects(foreign.resume(token), /session_unavailable/); assert.equal((await foreign.queue()).length, 0);
      await assert.rejects(f.service.resume(newResumeToken()), /session_unavailable/);
      await assert.rejects(f.service.create(token, "DIRECT_START"), /intent_conflict/);
      const fresh = newResumeToken(); await f.service.create(fresh, "FREE_REVIEW");
      await assert.rejects(f.pool.query("UPDATE prospect_intakes SET state='needs_operator_review',submitted_at=now(),version=version+1 WHERE resume_hash=$1", [resumeHash(fresh)]), /Matching submission/);
      await assert.rejects(f.pool.query("INSERT INTO prospect_intakes(web_presence_id,managed_site_id,entry_intent,questionnaire_version,resume_hash,expires_at,resume_expires_at) VALUES($1,$2,'FREE_REVIEW','foundational-intake/1',$3,now()+interval '30 days',now()+interval '30 days')", [f.service.selection.webPresenceId, foreignSite.id, resumeHash(newResumeToken())]), /owner mismatch/);
    });
    await t.test("HTTP capability is HttpOnly; production, CSRF, arbitrary scope, oversized input and abuse refuse", async () => {
      const guard = developmentGuard(100), base = "http://127.0.0.1:12345/api/intake";
      const req = (body: unknown, headers: Record<string, string> = {}) => new Request(base, { method: "POST", headers: { Origin: "http://127.0.0.1:12345", "Content-Type": "application/json", "X-Intake-Request": "1", ...headers }, body: JSON.stringify(body) });
      const begin = await intakeHttp(req({ operation: "begin" }), f.service, guard, true); assert.equal(begin.status, 200);
      const cookie = begin.headers.get("set-cookie")!; assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/); assert.match(cookie, /Path=\/api\/intake/);
      const session = cookie.split(";")[0]; assert.ok(session.startsWith(intakeCookie + "="));
      const resumed = await intakeHttp(new Request(base, { headers: { "X-Intake-Request": "1", Cookie: session } }), f.service, guard, true); assert.equal(resumed.status, 200);
      assert.equal((await resumed.json()).state, "draft");
      assert.equal((await intakeHttp(req({ operation: "begin" }), f.service, guard, false)).status, 503);
      assert.equal((await intakeHttp(req({ operation: "begin" }, { Origin: "https://evil.example" }), f.service, guard, true)).status, 403);
      assert.equal((await intakeHttp(req({ operation: "begin", webPresenceId: "foreign" }), f.service, guard, true)).status, 400);
      assert.equal((await intakeHttp(req({ operation: "save", version: 1, step: 0, answers: { businessName: "x".repeat(20000) } }), f.service, guard, true)).status, 413);
      assert.equal((await intakeHttp(req({ operation: "begin" }), f.service, developmentGuard(0), true)).status, 429);
      assert.equal((await intakeHttp(new Request(base, { headers: { Cookie: session } }), f.service, guard, true)).status, 403);
      const internal = new Request("http://localhost:12345/api/intake", { method: "POST", headers: { Host: "127.0.0.1:12345", Origin: "http://127.0.0.1:12345", "Content-Type": "application/json", "X-Intake-Request": "1" }, body: JSON.stringify({ operation: "begin" }) });
      assert.equal((await intakeHttp(localBrowserRequest(internal), f.service, guard, true)).status, 200);
      assert.equal((await intakeHttp(localBrowserRequest(req({ operation: "begin" }, { Host: "evil.example" })), f.service, guard, true)).status, 503);
    });
    await t.test("every canonical table, migration and real customer remains unchanged", async () => {
      const c = await f.pool.connect();
      try { const after = await readCustomerState(c); for (const table of customerTables) assert.equal(stateFingerprint({ [table]: after[table] }), stateFingerprint({ [table]: f.before[table] }), table); }
      finally { c.release(); }
      await f.verify();
    });
  } finally { await f.stop(); }
});

test("intake migration fresh/upgrade fidelity adds empty domain without rewriting prior tables", async () => {
  const url = process.env.ASSET_TEST_DATABASE_URL; assert.ok(url);
  const f = await createIntakeFixture(url), admin = new Pool({ connectionString: url });
  const schema = `canonical_test_${randomUUID().replaceAll("-", "")}_intake`;
  let created = false;
  try {
    const c = await admin.connect();
    try {
      await c.query("BEGIN"); await c.query(`CREATE SCHEMA "${schema}"`); await c.query(`SET LOCAL search_path="${schema}"`);
      const migrations = readMigrationFiles({ migrationsFolder: "lib/platform/db/migrations" }); assert.equal(migrations.length, 11);
      for (const m of migrations.slice(0, 10)) for (const sql of m.sql) await c.query(sql.replaceAll('"public".', `"${schema}".`));
      const order = ["organizations", "subject_types", "web_presences", "managed_sites"];
      for (const table of order) for (const r of f.before[table]) await c.query(`INSERT INTO ${table} SELECT * FROM jsonb_populate_record(NULL::${table},$1::jsonb)`, [JSON.stringify(r)]);
      await c.query("COMMIT"); created = true;
      await c.query("BEGIN"); await c.query(`SET LOCAL search_path="${schema}"`); await c.query("SET LOCAL TIME ZONE 'UTC'");
      for (const sql of migrations[10].sql) await c.query(sql.replaceAll('"public".', `"${schema}".`));
      for (const table of order) assert.equal(stateFingerprint({ [table]: (await c.query(`SELECT to_jsonb(t) row FROM ${table} t`)).rows.map(r => r.row) }), stateFingerprint({ [table]: f.before[table] }));
      for (const table of ["prospect_intakes", "prospect_intake_submissions"]) assert.equal((await c.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n, 0);
      await c.query("SET LOCAL search_path=pg_catalog");
      assert.deepEqual(await schemaSignature(c, f.schema, ["prospect_intakes", "prospect_intake_submissions"]), await schemaSignature(c, schema, ["prospect_intakes", "prospect_intake_submissions"]));
      await c.query("ROLLBACK");
    } catch (error) { await c.query("ROLLBACK"); throw error; } finally { c.release(); }
    await f.verify();
  } finally { if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`); await admin.end(); await f.stop(); }
});


test("v1 resume/save/submit coexist with default v2 sessions without upgrading or rewriting old snapshots", async () => {
  const url = process.env.ASSET_TEST_DATABASE_URL; assert.ok(url);
  const f = await createIntakeFixture(url);
  try {
    const oldToken = newResumeToken();
    await f.pool.query("INSERT INTO prospect_intakes(web_presence_id,managed_site_id,entry_intent,questionnaire_version,resume_hash,expires_at,resume_expires_at) VALUES($1,$2,'FREE_REVIEW','foundational-intake/1',$3,now()+interval '30 days',now()+interval '30 days')", [f.service.selection.webPresenceId, f.service.selection.managedSiteId, resumeHash(oldToken)]);
    const old = await f.service.resume(oldToken); assert.equal(old.questionnaireVersion, "foundational-intake/1");
    assert.equal((await f.service.create(oldToken, "FREE_REVIEW")).questionnaireVersion, "foundational-intake/1");
    const saved = await f.service.save(oldToken, old.version, legacyAnswers(), 12);
    assert.deepEqual(saved.answers.responses, legacyAnswers().responses);
    assert.equal(saved.questionnaireVersion, "foundational-intake/1");
    const sent = await f.service.submit(oldToken, saved.version);
    const oldSnapshot = (await f.pool.query("SELECT * FROM prospect_intake_submissions WHERE questionnaire_version='foundational-intake/1'")).rows;
    const token = newResumeToken(), current = await f.service.create(token, "FREE_REVIEW");
    assert.equal(current.questionnaireVersion, "foundational-intake/2");
    await assert.rejects(f.service.save(token, current.version, legacyAnswers(), 8));
    await assert.rejects(f.service.save(token, current.version, { ...intakeAnswers(), secondaryResponses: [intakeAnswers().primaryResponse] }, 8));
    assert.deepEqual(await f.service.resume(token), current);
    const v2 = await f.service.save(token, current.version, intakeAnswers(), 12);
    const complete = await f.service.submit(token, v2.version);
    assert.equal(complete.questionnaireVersion, "foundational-intake/2");
    assert.equal(complete.state, "needs_operator_review");
    assert.deepEqual(await f.service.submit(oldToken, saved.version), sent);
    assert.deepEqual((await f.pool.query("SELECT * FROM prospect_intake_submissions WHERE questionnaire_version='foundational-intake/1'")).rows, oldSnapshot);
    const versions = (await f.pool.query("SELECT questionnaire_version FROM prospect_intakes ORDER BY questionnaire_version")).rows.map(r => r.questionnaire_version);
    assert.deepEqual(versions, ["foundational-intake/1", "foundational-intake/2"]);
    await f.verify();
  } finally { await f.stop(); }
});
