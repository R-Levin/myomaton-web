import assert from "node:assert/strict";
import { protectedPool, protectedConnection, migrationRole } from "../lib/platform/wordpress-delivery/protected-connection";
import { createWordPressRoles, verifyWordPressRoles } from "./db/wordpress-roles";
import { verifyManagedBundle, managedSnapshot, assertManagedEquivalent } from "./backup/managed";
import { normalizeInventoryUrl } from "./db/wordpress-shared-inventory";
import { privateStageDiagnostic } from "./db/wordpress-private-stage";

const required = (name: string) => {
  const value = process.env[name];
  assert.ok(value, "Missing protected WordPress role configuration");
  return value;
};

async function main() {
  const action = required("MIOPAGES_WP_ROLE_ACTION");
  assert.ok(action === "create" || action === "verify", "Explicit role action required");
  const expected = required("MIOPAGES_WP_EXPECTED_DATABASE");
  const owner = action === "create" ? required("MIOPAGES_WP_PROVIDER_OWNER") : migrationRole;
  const url = normalizeInventoryUrl(required(action === "create" ? "MIOPAGES_WP_PROVIDER_URL" : "MIOPAGES_WP_MIGRATION_URL"), expected);
  const pool = protectedPool(url, owner, process.env.MIOPAGES_WP_DATABASE_CA);
  try {
    const db = await pool.connect();
    try {
      await db.query(action === "create" ? "BEGIN" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await db.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
      if (action === "create") {
        const identity = (await db.query(`SELECT session_user::text AS login,current_user::text AS actor,current_database() AS database,
          (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls`)).rows[0];
        assert.ok(identity?.login === owner && identity.actor === owner && identity.database === expected && identity.tls,
          "Provider-owner identity and TLS required");
        const recovery = await verifyManagedBundle(required("MIOPAGES_WP_RECOVERY_ROOT"));
        assertManagedEquivalent(recovery.state, await managedSnapshot(db, url,
          { runtime: "miopages_runtime", migration: migrationRole, backup: "miopages_backup" }));
        const result = await createWordPressRoles(db, owner, { operator: required("MIOPAGES_WP_OPERATOR_PASSWORD"),
          pull: required("MIOPAGES_WP_PULL_PASSWORD") });
        await db.query("COMMIT");
        console.log(JSON.stringify({ ...result, recoveryVerified: true }));
      } else {
        await protectedConnection(db, migrationRole, expected);
        const result = await verifyWordPressRoles(db);
        await db.query("ROLLBACK");
        console.log(JSON.stringify({ ...result, readOnly: true }));
      }
    } catch (error) { await db.query("ROLLBACK").catch(() => {}); throw error; }
    finally { db.release(); }
  } finally { await pool.end(); }
}

main().catch(error => {
  const diagnostic = privateStageDiagnostic("adapter_validation", error);
  if (diagnostic.code === "ERR_ASSERTION") diagnostic.detail = "Recovery, provider authority or the expected two-role restrictions failed validation.";
  console.error(JSON.stringify({ ...diagnostic,
    requirement: "Role setup refused or failed. Use independent verify before any create retry." }));
  process.exitCode = 1;
});
