import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import test from "node:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { disposableCluster } from "../../scripts/backup/disposable-cluster";
import { migrateWithBootstrapCompatibility } from "../../scripts/db/bootstrap";
import { provisionManagedRoles } from "../../scripts/db/managed-roles";
import { createWordPressRoles, verifyWordPressRoles } from "../../scripts/db/wordpress-roles";
import { integratePrivateStage, verifyPrivateStageAdapter } from "../../scripts/db/wordpress-private-stage";
import { managedBackup, verifyManagedBundle, managedSnapshot, assertManagedEquivalent } from "../../scripts/backup/managed";
import { hashFile } from "../../scripts/backup/core";

test("two WordPress roles are created independently and adapter checksums and exact grants verify", { timeout: 120000 }, async () => {
  assert.ok(process.env.WORDPRESS_TEST_PG_BIN);
  const cluster = await disposableCluster(process.env.WORDPRESS_TEST_PG_BIN);
  const work = await mkdtemp(path.join(tmpdir(), "miopages-wordpress-recovery-"));
  const root = new Pool({ connectionString: cluster.url });
  const roles = { runtime: "miopages_runtime", migration: "miopages_migration", backup: "miopages_backup" };
  const passwords = { runtime: randomBytes(32).toString("hex"), migration: randomBytes(32).toString("hex"), backup: randomBytes(32).toString("hex") };
  const wpPasswords = { operator: randomBytes(32).toString("hex"), pull: randomBytes(32).toString("hex") };
  const providerName = "wp_test_provider", providerPassword = randomBytes(32).toString("hex");
  const login = (role: string, password: string) => {
    const url = new URL(cluster.url);
    url.username = role;
    url.password = password;
    return new Pool({ connectionString: url.toString() });
  };
  let provider: Pool | undefined, migration: Pool | undefined;
  try {
    await migrateWithBootstrapCompatibility(root);
    await provisionManagedRoles({ databaseUrl: cluster.url, databaseName: new URL(cluster.url).pathname.slice(1),
      sourceOwner: "postgres", operation: "create", roles, passwords });
    await root.query(`CREATE ROLE ${providerName} LOGIN CREATEROLE PASSWORD '${providerPassword}'`);
    const database = new URL(cluster.url).pathname.slice(1);
    await root.query(`GRANT CONNECT ON DATABASE "${database}" TO ${providerName} WITH GRANT OPTION`);
    await root.query(`GRANT USAGE ON SCHEMA public TO ${providerName} WITH GRANT OPTION`);
    provider = login(providerName, providerPassword);
    // A rejected original administrator password must not prevent backup or
    // invalidate the completed archive before setup is resumed independently.
    const rejectedAdmin = login("postgres", randomBytes(32).toString("hex"));
    try { await assert.rejects(rejectedAdmin.query("SELECT 1"), (e: unknown) => (e as { code: string }).code === "28P01"); }
    finally { await rejectedAdmin.end(); }
    const backupUrl = new URL(cluster.url); backupUrl.username = roles.backup; backupUrl.password = passwords.backup;
    const assets = path.join(work, "assets"); await mkdir(assets);
    const recoveryRoot = path.join(work, "recovery");
    const bundle = await managedBackup({ mode: "managed-postgres", root: recoveryRoot, databaseUrl: backupUrl.toString(),
      objectsRoot: assets, pgBin: process.env.WORDPRESS_TEST_PG_BIN, repository: process.cwd(), roles });
    assert.equal(bundle.state.migrations.length, 16);
    const checksum = await hashFile(path.join(recoveryRoot, "checksums.json"));
    const verified = await verifyManagedBundle(recoveryRoot);
    assert.equal(await hashFile(path.join(recoveryRoot, "checksums.json")), checksum);
    await assert.rejects(provider.query("SELECT * FROM drizzle.__drizzle_migrations"), (e: unknown) => (e as { code: string }).code === "42501");
    migration = login(roles.migration, passwords.migration);
    const initial = (await root.query("SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=ANY($1) ORDER BY rolname", [Object.values(roles)])).rows;
    const c = await provider.connect();
    try {
      await c.query("BEGIN");
      const migrationUrl = new URL(cluster.url); migrationUrl.username = roles.migration; migrationUrl.password = passwords.migration;
      const reader = await migration.connect();
      try {
        await reader.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        assertManagedEquivalent(verified.state, await managedSnapshot(reader, migrationUrl.toString(), roles));
      } finally { await reader.query("ROLLBACK"); reader.release(); }
      await createWordPressRoles(c, providerName, wpPasswords);
      await c.query("ROLLBACK");
      assert.equal((await root.query("SELECT count(*)::int n FROM pg_roles WHERE rolname IN ('miopages_wp_operator','miopages_wp_pull')")).rows[0].n, 0);
      await c.query("BEGIN");
      assert.equal((await createWordPressRoles(c, providerName, wpPasswords)).created, 2);
      await c.query("COMMIT");
      await c.query("BEGIN");
      await assert.rejects(createWordPressRoles(c, providerName, wpPasswords), /both WordPress roles absent/);
      await c.query("ROLLBACK");
    } finally { c.release(); }
    assert.deepEqual((await root.query("SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=ANY($1) ORDER BY rolname", [Object.values(roles)])).rows, initial);
    for (const [role, password] of [["miopages_wp_operator", wpPasswords.operator], ["miopages_wp_pull", wpPasswords.pull]]) {
      const pool = login(role, password);
      try { assert.equal((await pool.query("SELECT session_user AS role")).rows[0].role, role); }
      finally { await pool.end(); }
    }
    const db = await migration.connect();
    try {
      await db.query("BEGIN READ ONLY");
      assert.equal((await verifyWordPressRoles(db)).verified, true);
      await db.query("ROLLBACK");
      await db.query("BEGIN");
      await integratePrivateStage(db);
      await db.query("COMMIT");
      await db.query("BEGIN READ ONLY");
      assert.equal((await verifyPrivateStageAdapter(db)).grantsVerified, true);
      await db.query("ROLLBACK");
      await root.query("GRANT DELETE ON public.pages TO miopages_wp_pull");
      await db.query("BEGIN READ ONLY");
      await assert.rejects(verifyPrivateStageAdapter(db), /Unexpected adapter grantor|WordPress table\/column grants differ/);
      await db.query("ROLLBACK");
      await root.query("REVOKE DELETE ON public.pages FROM miopages_wp_pull");
      await root.query("UPDATE miopages_wp.wordpress_schema_migrations SET sha256=repeat('0',64) WHERE name='0017_private_stage_authority'");
      await db.query("BEGIN READ ONLY");
      await assert.rejects(verifyPrivateStageAdapter(db), /checksum mismatch/);
      await db.query("ROLLBACK");
    } finally { db.release(); }
  } finally {
    await migration?.end(); await provider?.end(); await root.end(); await cluster.stop();
    assert.equal(path.dirname(work), path.resolve(tmpdir())); assert.match(path.basename(work), /^miopages-wordpress-recovery-/);
    await rm(work, { recursive: true });
  }
});
