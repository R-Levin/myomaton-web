import assert from "node:assert/strict";
import { Pool } from "pg";
import test from "node:test";
import { disposableCluster } from "../../scripts/backup/disposable-cluster";
import { migrateWithBootstrapCompatibility } from "../../scripts/db/bootstrap";
import { wordpressRehearsalFixture } from "../../scripts/customer-initializers/wordpress-rehearsal";
import { sharedInventory } from "../../scripts/db/wordpress-shared-inventory";
import { ActivationService } from "../../lib/platform/activation/service";
import ownership from "../../scripts/backup/application-ownership.json";
import { readFile } from "node:fs/promises";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { rehearsalPermissions, rehearsalPrincipals, replaceRehearsalTokenVerifiers } from "../../scripts/db/wordpress-rehearsal-principals";
import { ProtectedOperator } from "../../lib/platform/wordpress-delivery/operator";

const c0 = { organizationId: "152aebd3-00b3-4296-a64e-e281522e64f0",
  webPresenceId: "926cb772-7507-4542-8acd-e7e57ce71324", managedSiteId: "312b8081-4582-47fa-bedb-a551fd6e2b36" };

async function state(db: Pool) {
  const result: Record<string, unknown> = {};
  for (const table of ownership.tables) result[table] = (await db.query(
    `SELECT to_jsonb(t) row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
  return result;
}

test("one protected rehearsal fixture creates atomically and independently verifies without changing C0", { timeout: 120000 }, async () => {
  assert.ok(process.env.WORDPRESS_TEST_PG_BIN);
  const cluster = await disposableCluster(process.env.WORDPRESS_TEST_PG_BIN);
  const pool = new Pool({ connectionString: cluster.url });
  try {
    await migrateWithBootstrapCompatibility(pool);
    await pool.query("INSERT INTO organizations(id,name) VALUES($1,'Synthetic existing C0')", [c0.organizationId]);
    await pool.query("INSERT INTO web_presences(id,organization_id,name) VALUES($1,$2,'Synthetic existing C0')",
      [c0.webPresenceId, c0.organizationId]);
    await pool.query("INSERT INTO managed_sites(id,web_presence_id,name) VALUES($1,$2,'Synthetic existing C0')",
      [c0.managedSiteId, c0.webPresenceId]);
    await pool.query(`INSERT INTO managed_site_hostnames(id,hostname,web_presence_id,managed_site_id)
      VALUES('bfd0daa1-3a9d-429d-8b60-b2d9851f9603','runtime.miopages.com',$1,$2),
      ('46bbd56e-9f28-4006-8bc0-df70c955cda3','domain-test.miopages.com',$1,$2)`, [c0.webPresenceId, c0.managedSiteId]);
    const before = await state(pool);
    const run = async (operation: "create" | "verify", fail = false) => {
      const db = await pool.connect();
      try {
        await db.query(operation === "verify" ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN");
        const result = await wordpressRehearsalFixture(db, operation, fail);
        await db.query(operation === "verify" ? "ROLLBACK" : "COMMIT");
        return result;
      } catch (error) { await db.query("ROLLBACK"); throw error; }
      finally { db.release(); }
    };
    await assert.rejects(run("verify"), /does not exist/);
    assert.deepEqual(await state(pool), before);
    await assert.rejects(run("create", true), /Forced rehearsal fixture rollback/);
    assert.deepEqual(await state(pool), before);
    const created = await run("create");
    assert.equal(created.verified, true);
    assert.equal(created.inserted, 12);
    const after = await state(pool);
    const retried = await run("create");
    assert.equal(retried.inserted, 0);
    assert.deepEqual(await state(pool), after);

    const independent = new Pool({ connectionString: cluster.url });
    try {
      const db = await independent.connect();
      try {
        for (let iteration = 0; iteration < 2; iteration++) {
          await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
          const verified = await wordpressRehearsalFixture(db, "verify");
          assert.deepEqual(verified.site, created.site);
          assert.equal(verified.inserted, 0);
          const inventory = await sharedInventory(db, [], created.site);
          assert.equal(inventory.status, "PASS");
          await db.query("ROLLBACK");
        }
      } finally { db.release(); }
    } finally { await independent.end(); }
    assert.deepEqual(await state(pool), after);

    // Exercise the actual narrow enrollment SQL only against disposable data.
    await pool.query("CREATE SCHEMA miopages_wp; SET search_path=miopages_wp,public");
    await pool.query(await readFile("lib/platform/wordpress-delivery/0016_wordpress_delivery.sql", "utf8"));
    await pool.query(await readFile("lib/platform/wordpress-delivery/0017_private_stage_authority.sql", "utf8"));
    const tokens = [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")];
    const manifest = { version: 1, principals: Object.entries(rehearsalPermissions).map(([reference, permissions], i) => ({
      reference, id: randomUUID(), tokenSha256: createHash("sha256").update(Buffer.from(tokens[i], "hex")).digest("hex"),
      grants: permissions.map(permission => ({ id: randomUUID(), permission })),
    })) };
    const enroll = async (action: "create" | "verify", value: unknown = manifest) => {
      const db = await pool.connect();
      try {
        await db.query(action === "verify" ? "BEGIN READ ONLY" : "BEGIN");
        const result = await rehearsalPrincipals(db, value, created.site, action);
        await db.query("COMMIT"); return result;
      } catch (error) { await db.query("ROLLBACK"); throw error; } finally { db.release(); }
    };
    await assert.rejects(enroll("verify"), /Missing, expired or conflicting/);
    assert.equal((await enroll("create")).created, 2);
    assert.equal((await enroll("create")).created, 0);
    assert.equal((await enroll("verify")).readOnly, true);
    assert.deepEqual(await state(pool), after, "Enrollment must not change canonical/C0 data");
    await pool.query("UPDATE public.managed_sites SET status='active' WHERE id=$1", [created.site.managedSiteId]);
    await assert.rejects(enroll("verify"), /Inactive rehearsal graph/);
    await pool.query("UPDATE public.managed_sites SET status='inactive' WHERE id=$1", [created.site.managedSiteId]);
    await pool.query("INSERT INTO public.managed_site_hostnames(id,hostname,web_presence_id,managed_site_id) VALUES($1,'forbidden-rehearsal.example.test',$2,$3)",
      [randomUUID(), created.site.webPresenceId, created.site.managedSiteId]);
    await assert.rejects(enroll("verify"), /Unhosted rehearsal/);
    await pool.query("DELETE FROM public.managed_site_hostnames WHERE managed_site_id=$1", [created.site.managedSiteId]);
    const identity = new ProtectedOperator(pool, async db => { await db.query("SET search_path=miopages_wp,public"); });
    const owner = await identity.authenticate(tokens[0]), reviewer = await identity.authenticate(tokens[1]);
    assert.equal((await identity.authorize(owner, "approve-site-proposal", created.site)).operatorId, manifest.principals[0].id);
    assert.equal((await identity.authorize(reviewer, "review-private-stage", created.site)).operatorId, manifest.principals[1].id);
    await assert.rejects(identity.authorize(owner, "review-private-stage", created.site), /refused/);
    await assert.rejects(identity.authorize(reviewer, "approve-site-proposal", created.site), /refused/);
    await assert.rejects(identity.authorize(reviewer, "prepare-site-proposal", c0), /refused/);
    const replacement = structuredClone(manifest), replacementTokens = [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")];
    replacement.principals.forEach((p, i) => { p.tokenSha256 = createHash("sha256").update(Buffer.from(replacementTokens[i], "hex")).digest("hex"); });
    const metadata = async () => (await pool.query("SELECT id,expires_at,revoked_at FROM miopages_wp.wordpress_operator_credentials ORDER BY id")).rows;
    const beforeReplacement = await metadata();
    const replace = async (next: unknown, rollback = false) => {
      const db = await pool.connect();
      try {
        await db.query("BEGIN");
        const result = await replaceRehearsalTokenVerifiers(db, manifest, next, created.site);
        await db.query(rollback ? "ROLLBACK" : "COMMIT"); return result;
      } catch (error) { await db.query("ROLLBACK"); throw error; } finally { db.release(); }
    };
    const wrongIdentity = structuredClone(replacement); wrongIdentity.principals[0].id = randomUUID();
    await assert.rejects(replace(wrongIdentity), /identities and every grant/);
    await assert.rejects(replace(manifest), /Fresh distinct/);
    await replace(replacement, true);
    assert.equal((await enroll("verify")).readOnly, true, "Rollback retains both old verifiers");
    assert.equal((await replace(replacement)).verifierReplacements, 2);
    assert.deepEqual(await metadata(), beforeReplacement, "No extension of expiry or revocation changes");
    await assert.rejects(identity.authenticate(tokens[0]), /refused/);
    await assert.rejects(identity.authenticate(tokens[1]), /refused/);
    await assert.rejects(identity.authorize(owner, "approve-site-proposal", created.site), /refused/);
    for (let i = 0; i < 2; i++) {
      const authenticated = await identity.authenticate(replacementTokens[i]);
      const permission = i ? "review-private-stage" : "approve-site-proposal";
      assert.equal((await identity.authorize(authenticated, permission, created.site)).operatorId, manifest.principals[i].id);
    }
    await assert.rejects(replace(replacement), /conflicting/, "Do not automatically repeat a replacement");
    manifest.principals.forEach((p, i) => { p.tokenSha256 = replacement.principals[i].tokenSha256; });
    assert.equal((await enroll("verify")).readOnly, true);
    assert.deepEqual(await state(pool), after);
    const altered = structuredClone(manifest); altered.principals[0].tokenSha256 = "a".repeat(64);
    await assert.rejects(enroll("create", altered), /conflicting/);
    await pool.query("UPDATE miopages_wp.wordpress_operator_credentials SET expires_at=now()-interval '1 second' WHERE id=$1", [manifest.principals[0].id]);
    await assert.rejects(enroll("create"), /expired/);
    await pool.query("DELETE FROM miopages_wp.wordpress_operator_grants; DELETE FROM miopages_wp.wordpress_operator_credentials; SET search_path=public");

    const service = new ActivationService(pool, { authorize: async () => ({
      operatorId: "synthetic-test", authorityReference: "synthetic-test",
    }) }, { read: async () => { throw Error("Unused"); } });
    const binding = (await pool.query("SELECT case_id FROM activation_customer_bindings WHERE managed_site_id=$1",
      [created.site.managedSiteId])).rows[0];
    await assert.rejects(service.inspect({}, binding.case_id, { webPresenceId: c0.webPresenceId,
      managedSiteId: c0.managedSiteId, pendingCustomerId: "918b3c67-6782-4ba4-a9f8-4a28160764c3" }), /isolated disposable schema/);

    await pool.query("UPDATE organizations SET name='Conflicting fixture' WHERE id=$1", [created.site.organizationId]);
    await assert.rejects(run("verify"), /Conflicting fixture content/);
    await assert.rejects(run("create"), /Conflicting fixture content/);
    await pool.query("UPDATE organizations SET name='Synthetic MioPages WordPress rehearsal' WHERE id=$1",
      [created.site.organizationId]);
    assert.deepEqual(await state(pool), after);
    await pool.query("UPDATE managed_site_hostnames SET status='inactive' WHERE hostname='domain-test.miopages.com'");
    await assert.rejects(run("verify"), /Existing baseline changed/);
  } finally { await pool.end(); await cluster.stop(); }
});
