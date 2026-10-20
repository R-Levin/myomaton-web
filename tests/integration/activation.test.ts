import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { activationFixture } from "../../scripts/activation/disposable";
import { intakeAnswersV2 } from "../helpers/intake";
import { ActivationService, inspectionText } from "../../lib/platform/activation/service";
import { approvedReview, localApprovedReviews } from "../../lib/platform/activation/review-source";
import { initialAssessment, type CreateCase } from "../../lib/platform/activation/model";
import { newResumeToken, resumeHash } from "../../lib/platform/intake/service";
import { fingerprint } from "../../lib/platform/canonical/model";
import { schemaSignature } from "./schema-fidelity";
import { customerTables, stateFingerprint } from "../../lib/platform/customer-initialization";
import { qualityChecks } from "../../lib/platform/reviews/model";
import { Pool } from "pg";
import { intakeDatabaseUrl } from "../../scripts/intake/disposable";

test("activation foundation: fresh/upgrade PostgreSQL, durable source paths and scoped immutable authority", async t => {
  const url = process.env.ASSET_TEST_DATABASE_URL; assert.ok(url, "Disposable PostgreSQL URL required");
  const old = { NODE_ENV: process.env.NODE_ENV, MIOPAGES_REVIEW_SYNTHESIS: process.env.MIOPAGES_REVIEW_SYNTHESIS };
  Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" });
  const f = await activationFixture(url);
  try {
    const a = await f.submit("FREE_REVIEW", intakeAnswersV2()), review = await f.review(a.submission), unapproved = await f.review(a.submission, false);
    const b = await f.submit("DIRECT_START", intakeAnswersV2()), other = await f.submit("FREE_REVIEW", intakeAnswersV2()), foreignReview = await f.review(other.submission);
    const immutable = (await f.pool.query("SELECT to_jsonb(s) data FROM prospect_intake_submissions s ORDER BY id")).rows;
    const reviewBefore = await review.store.read();
    const input: CreateCase = { requestId: randomUUID(), scope: a.scope, submissionId: a.submission.id, submissionDigest: a.submission.digest, review: review.request };
    const svc = f.service();
    await t.test("missing, arbitrary-string, operation and cross-scope authority refuse", async () => {
      for (const context of [undefined, "operator", { operatorId: "operator" }, f.grant(a.scope, ["inspect"]), b.context]) await assert.rejects(svc.create(context, input), /authority/);
    });
    await t.test("unsubmitted/wrong-owner/wrong-digest and unapproved/wrong-prospect Review refuse", async () => {
      const token = newResumeToken(); await f.intake.create(token, "FREE_REVIEW");
      const draftId = (await f.pool.query("SELECT id FROM prospect_intakes WHERE resume_hash=$1", [resumeHash(token)])).rows[0].id;
      await assert.rejects(svc.create(a.context, { ...input, submissionId: draftId }), /submitted/);
      await assert.rejects(svc.create(a.context, { ...input, submissionDigest: "0".repeat(64) }), /digest/);
      await assert.rejects(svc.create(a.context, { ...input, review: unapproved.request }), /approved/);
      await assert.rejects(svc.create(a.context, { ...input, review: foreignReview.request }), /binding/);
      await assert.rejects(svc.create(a.context, { ...input, review: { ...review.request, revision: 2 } }), /binding/);
      await assert.rejects(approvedReview(localApprovedReviews, review.request, { ...a.scope, webPresenceId: randomUUID() }, a.submission), /Foreign Review owner/);
      const foreignSite = f.before.managed_sites.find(s => s.id !== a.scope.managedSiteId)!;
      const wrongScope = { ...a.scope, managedSiteId: String(foreignSite.id) };
      await assert.rejects(svc.create(f.grant(wrongScope), { ...input, scope: wrongScope }), /submitted/);
    });
    const [created, repeated] = await Promise.all([svc.create(a.context, input), svc.create(a.context, input)]);
    await t.test("case identity survives new service; concurrent retry creates one row/event", async () => {
      assert.deepEqual(repeated, created); assert.deepEqual(await f.service().inspect(a.context, created.id, a.scope), created);
      const reopened = new Pool({ connectionString: intakeDatabaseUrl(url, f.schema) });
      try { assert.deepEqual(await new ActivationService(reopened, f.authority, localApprovedReviews).inspect(a.context, created.id, a.scope), created); } finally { await reopened.end(); }
      assert.equal(created.source.questionnaireVersion, "foundational-intake/2"); assert.equal(created.review!.digest, review.request.digest);
      assert.equal(created.state.status, "PENDING_COMMERCIAL"); assert.equal(created.version, 1);
      await assert.rejects(svc.create(a.context, { ...input, requestId: randomUUID() }), /Duplicate/);
      await assert.rejects(svc.create(a.context, { ...input, review: undefined }), /Duplicate/);
      await assert.rejects(svc.inspect(b.context, created.id, b.scope), /scope/);
    });
    const confirmation = { source: "agreement-order", reference: "synthetic-order-001", confirmedAt: new Date().toISOString(), launchScope: "One focused Launch", ongoingScope: "Continuing care" }, confirmationId = randomUUID();
    const confirmed = await svc.update(a.context, created.id, a.scope, 1, confirmationId, "confirm-commercial", confirmation);
    await t.test("commercial confirmation grants onboarding authority without fact promotion; retries/conflicts guarded", async () => {
      assert.equal(confirmed.state.status, "AUTHORIZED_FOR_ONBOARDING"); assert.deepEqual(confirmed.state.assessment, initialAssessment(a.submission));
      assert.deepEqual(await svc.update(a.context, created.id, a.scope, 1, confirmationId, "confirm-commercial", confirmation), confirmed);
      await assert.rejects(svc.update(a.context, created.id, a.scope, 1, randomUUID(), "assess", initialAssessment(a.submission)), /Stale/);
      await assert.rejects(svc.update(a.context, created.id, a.scope, 2, confirmationId, "confirm-commercial", { ...confirmation, reference: "changed" }), /idempotency/);
      await assert.rejects(svc.update(a.context, created.id, a.scope, 2, randomUUID(), "confirm-commercial", { ...confirmation, reference: "changed" }), /Conflicting/);
    });
    await t.test("separate scoped permission is required to confirm information; assessment never mutates intake", async () => {
      const value = initialAssessment(a.submission).map((r, i) => i ? r : { ...r, state: "CONFIRMED", reference: "Explicit customer identity attestation: synthetic-order-001" });
      await assert.rejects(svc.update(f.grant(a.scope, ["assess"]), created.id, a.scope, 2, randomUUID(), "assess", value), /authority/);
      const current = await svc.update(a.context, created.id, a.scope, 2, randomUUID(), "assess", value);
      assert.equal(current.state.assessment[0].state, "CONFIRMED"); assert.equal(current.state.assessment[1].state, "UNCONFIRMED"); assert.equal(current.state.assessment[4].state, "MISSING");
      assert.deepEqual((await f.pool.query("SELECT to_jsonb(s) data FROM prospect_intake_submissions s ORDER BY id")).rows, immutable);
    });
    await t.test("Direct Start proceeds without Review; wrong Review dependency refuses", async () => {
      const direct = { requestId: randomUUID(), scope: b.scope, submissionId: b.submission.id, submissionDigest: b.submission.digest };
      await assert.rejects(svc.create(b.context, { ...direct, review: review.request }), /Direct Start/);
      const c = await svc.create(b.context, direct); assert.equal(c.review, null);
      const authorized = await svc.update(b.context, c.id, b.scope, 1, randomUUID(), "confirm-commercial", confirmation);
      assert.equal(authorized.state.status, "AUTHORIZED_FOR_ONBOARDING"); assert.equal(authorized.source.path, "DIRECT_START");
    });
    await t.test("history and source identity resist SQL rewrite/delete and invalid event append", async () => {
      await assert.rejects(f.pool.query("UPDATE activation_cases SET source='{}' WHERE id=$1", [created.id]), /immutable/);
      await assert.rejects(f.pool.query("DELETE FROM activation_case_events WHERE case_id=$1", [created.id]), /immutable/);
      await assert.rejects(f.pool.query("UPDATE activation_case_events SET actor='other' WHERE case_id=$1", [created.id]), /immutable/);
      await assert.rejects(f.pool.query("INSERT INTO activation_case_events SELECT gen_random_uuid(),case_id,99,gen_random_uuid(),request_digest,operation,actor,authority_reference,at,previous,digest,snapshot FROM activation_case_events WHERE case_id=$1 LIMIT 1", [created.id]), /version/);
    });
    await t.test("concurrent mutations serialize; exactly one expected-version write succeeds", async () => {
      const current = await svc.inspect(a.context, created.id, a.scope);
      const value = current.state.assessment.map(({ area, state, fields, reference }) => ({ area, state, fields, ...(reference ? { reference } : {}) }));
      const results = await Promise.allSettled([1, 2].map(() => svc.update(a.context, created.id, a.scope, current.version, randomUUID(), "assess", value)));
      assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
      assert.ok(results.some(r => r.status === "rejected" && /Stale/.test(r.reason.message)));
    });
    await t.test("later Review revisions/approval cannot retarget the exact historical approval binding", async () => {
      await review.store.append("edit", await review.store.currentBinding(), reviewBefore.revisions[0].content, "synthetic-activation-operator", "Synthetic later revision");
      const later = await review.store.currentBinding();
      await review.store.append("request-review", later, null, "synthetic-activation-operator", "Synthetic later QC");
      await review.store.append("approve", later, null, "synthetic-activation-operator", "Synthetic later approval", { ...Object.fromEntries(qualityChecks.map(k => [k, true])), retainedEvidenceReviewed: true });
      const unchanged = await svc.inspect(a.context, created.id, a.scope);
      assert.equal(unchanged.review!.revision, 1); assert.equal(unchanged.review!.digest, review.request.digest);
      assert.deepEqual((await review.store.read()).decisions.slice(0, 3), reviewBefore.decisions);
    });
    await t.test("shared/public and production service operation refuse even with an authorized context", async () => {
      const pool = new Pool({ connectionString: url });
      try { await assert.rejects(new ActivationService(pool, f.authority, localApprovedReviews).create(a.context, input), /isolated/); } finally { await pool.end(); }
      Object.assign(process.env, { NODE_ENV: "production" });
      try { await assert.rejects(svc.inspect(a.context, created.id, a.scope), /isolated/); } finally { Object.assign(process.env, { NODE_ENV: "development" }); }
    });
    await t.test("0011 upgrade from 0010 preserves canonical data; later ordered replay matches fresh schema", async () => {
      const schema = f.schema.replace("_intake", "_act"), quoted = `"${schema}"`, c = await f.pool.connect();
      try {
        await c.query("BEGIN"); await c.query(`CREATE SCHEMA ${quoted}`); await c.query(`SET LOCAL search_path=${quoted}`);
        const migrations = readMigrationFiles({ migrationsFolder: "lib/platform/db/migrations" }); assert.ok(migrations.length >= 12);
        for (const m of migrations.slice(0, 11)) for (const sql of m.sql) await c.query(sql.replaceAll('"public".', `${quoted}.`));
        const order = ["organizations", "subject_types", "web_presences", "managed_sites", ...customerTables.filter(t => !["organizations", "subject_types", "web_presences", "managed_sites"].includes(t))];
        for (const table of order) for (const row of f.before[table]) await c.query(`INSERT INTO ${table} SELECT * FROM jsonb_populate_record(NULL::${table},$1::jsonb)`, [JSON.stringify(row)]);
        const original = {} as Record<string, unknown>;
        for (const table of customerTables) original[table] = (await c.query(`SELECT to_jsonb(t) row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
        const before = (await c.query("SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename", [schema])).rows; assert.equal(before.length, 24);
        for (const sql of migrations[11].sql) await c.query(sql.replaceAll('"public".', `${quoted}.`));
        for (const migration of migrations.slice(12)) for (const sql of migration.sql) await c.query(sql.replaceAll('"public".', `${quoted}.`));
        for (const table of customerTables) assert.deepEqual((await c.query(`SELECT to_jsonb(t) row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows, original[table]);
        await c.query("SET LOCAL search_path=pg_catalog");
        assert.deepEqual(await schemaSignature(c, schema, ["activation_cases", "activation_case_events"]), await schemaSignature(c, f.schema, ["activation_cases", "activation_case_events"]));
        await c.query("ROLLBACK");
      } finally { await c.query("ROLLBACK"); c.release(); }
    });
    assert.equal(fingerprint((await review.store.read()).revisions[0]), fingerprint(reviewBefore.revisions[0]));
    for (const table of customerTables) {
      const rows = (await f.pool.query(`SELECT to_jsonb(t) row FROM ${table} t`)).rows.map(r => r.row);
      assert.equal(stateFingerprint({ rows }), stateFingerprint({ rows: f.before[table] }), `Case operations must not promote or mutate ${table}`);
    }
    const inspection = await svc.inspect(a.context, created.id, a.scope);
    await mkdir("runtime-content/activation-proof", { recursive: true });
    await writeFile("runtime-content/activation-proof/synthetic-case.txt", "SYNTHETIC DISPOSABLE PROOF — database fixture removed after durable reread.\n" + inspectionText(inspection));
    await f.verify();
  } finally { await f.stop(); Object.assign(process.env, old); }
});
