import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Pool } from "pg";
import { disposableCluster } from "../../scripts/backup/disposable-cluster";
import { migrateWithBootstrapCompatibility } from "../../scripts/db/bootstrap";
import { IntakeService, newResumeToken } from "../../lib/platform/intake/service";
import { prepareC2 } from "../../scripts/intake/adaptive-sources";
import { ProtectedInterview } from "../../lib/platform/intake/protected-interview";

test("Core development policy confines the existing draft writer to the inactive fixture", async () => {
  const cluster = await disposableCluster(process.env.PG_BIN_DIR ?? "C:/Program Files/PostgreSQL/18/bin");
  const admin = new Pool({ connectionString: cluster.url });
  const selection = { webPresenceId: "819d007a-595d-4374-a2f0-96b900d46559", managedSiteId: "1d92a248-416f-4e22-baaf-d2f1fca70352" };
  const org = randomUUID();
  const url = new URL(cluster.url);
  url.username = "miopages_core_development";
  const password = randomUUID();
  url.password = password;
  const role = new Pool({ connectionString: url.href, options: "-c search_path=miopages_core_guard,miopages_wp,public" });
  try {
    await migrateWithBootstrapCompatibility(admin);
    await admin.query("CREATE SCHEMA miopages_wp");
    await admin.query(`CREATE ROLE miopages_core_development LOGIN NOINHERIT PASSWORD '${password}'`);
    // Minimal read dependencies mirror the adapter tables. The actual intake,
    // constraints and trigger code come from the existing migrations.
    await admin.query(`CREATE TABLE miopages_wp.wordpress_operator_credentials
      (id uuid, token_sha256 text, expires_at timestamptz, revoked_at timestamptz);
      CREATE TABLE miopages_wp.wordpress_operator_grants
      (id uuid, operator_id uuid, web_presence_id uuid, managed_site_id uuid, permission text, customer jsonb, revoked_at timestamptz)`);
    await admin.query("INSERT INTO organizations(id,name,status) VALUES ($1,'Fixture','inactive')", [org]);
    await admin.query("INSERT INTO web_presences(id,organization_id,name,status) VALUES ($1,$2,'Fixture','inactive')", [selection.webPresenceId, org]);
    await admin.query("INSERT INTO managed_sites(id,web_presence_id,name,status) VALUES ($1,$2,'Fixture','inactive')", [selection.managedSiteId, selection.webPresenceId]);
    // Exercise the real draft table and trigger. The activation binding is a
    // read-only dependency here and is already covered by its own suite.
    await admin.query(`ALTER TABLE public.activation_customer_bindings RENAME TO original_activation_customer_bindings;
      CREATE TABLE public.activation_customer_bindings (managed_site_id uuid, web_presence_id uuid, organization_id uuid)`);
    await admin.query("INSERT INTO public.activation_customer_bindings VALUES ($1,$2,$3)", [selection.managedSiteId, selection.webPresenceId, org]);
    await admin.query(await readFile("lib/platform/intake/protected-core-policy.sql", "utf8"));
    assert.equal((await role.query("SELECT count(*)::int AS n FROM miopages_wp.core_development_scope")).rows[0].n, 1);
    const service = new IntakeService(role, selection, { database: url.pathname.slice(1), answers: {}, provenance: {},
      prepared: prepareC2(), step: 3, protectedScope: async db => { await db.query("SET search_path TO miopages_core_guard, miopages_wp, public"); } });
    const token = newResumeToken();
    const result = await service.create(token, "DIRECT_START");
    assert.equal(result.version, 2);
    assert.deepEqual(await service.create(token, "DIRECT_START"), result);
    const evidence = [{ id: "offer", kind: "owner-confirmed" as const, at: "2026-11-13", reference: "Fictional policy test",
      statement: "Customers can ask about an existing website." }];
    let dispatches = 0;
    const interview = new ProtectedInterview(service, { version: "offline-policy-test", async propose(context) {
      dispatches++;
      const previous = context.history.at(-1);
      return previous ? { question: "Who checks whether a migration is suitable?", rationale: "Determine who handles the next step.",
        sourceIds: ["offer", previous.id + ":answer"],
        assessment: { recommendation: "Ask for the current website address before discussing migration.", evidenceNeeded: "Identify the reviewer." } }
        : { question: "What should someone bring to discuss their current website?", rationale: "Identify what is needed for the handoff.",
          sourceIds: ["offer"], assessment: null };
    } }, evidence);
    const asked = await interview.next(token, result.version);
    const first = asked.interview!.turns[0];
    await assert.rejects(interview.next(token, asked.version), /question_unavailable/);
    const answered = await interview.answer(token, asked.version, first.id, "Bring the current website address.");
    assert.equal(dispatches, 1);
    const followed = await interview.next(token, answered.version);
    assert.equal(followed.interview?.turns[1].respondsTo, first.id + ":answer");
    assert.match(followed.interview?.turns[1].assessment?.recommendation ?? "", /migration/);
    assert.deepEqual(await service.resume(token), followed);
    await assert.rejects(role.query("SELECT * FROM public.prospect_intakes"), /permission denied/);
    await assert.rejects(role.query("DELETE FROM miopages_wp.core_development_drafts"), /permission denied/);
    await assert.rejects(role.query("UPDATE miopages_wp.core_development_drafts SET web_presence_id=$1", [randomUUID()]), /permission denied/);
    await assert.rejects(role.query("UPDATE miopages_wp.core_development_drafts SET state='needs_operator_review'"), /permission denied/);
    await assert.rejects(role.query(`INSERT INTO miopages_wp.core_development_drafts
      (web_presence_id,managed_site_id,entry_intent,questionnaire_version,resume_hash,expires_at,resume_expires_at)
      VALUES($1,$2,'DIRECT_START','paid-onboarding/2',$3,now(),now())`,
    [randomUUID(), selection.managedSiteId, "f".repeat(64)]), /check option|owner mismatch/);
  } finally {
    await role.end();
    await admin.end();
    await cluster.stop();
  }
});
