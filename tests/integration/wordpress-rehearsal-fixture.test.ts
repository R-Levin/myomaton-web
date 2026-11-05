import assert from "node:assert/strict";
import { Pool } from "pg";
import test from "node:test";
import { disposableCluster } from "../../scripts/backup/disposable-cluster";
import { migrateWithBootstrapCompatibility } from "../../scripts/db/bootstrap";
import { wordpressRehearsalFixture } from "../../scripts/customer-initializers/wordpress-rehearsal";
import { sharedInventory } from "../../scripts/db/wordpress-shared-inventory";
import { ActivationService } from "../../lib/platform/activation/service";
import ownership from "../../scripts/backup/application-ownership.json";

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
