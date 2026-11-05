import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import { migrationRole, operatorRole, protectedPool, pullRole, verifyProtectedSession } from "../lib/platform/wordpress-delivery/protected-connection";

test("protected database URLs allow Supabase session mode for only the expected role", async () => {
  for (const role of [pullRole, operatorRole, migrationRole]) {
    const pooled = `postgresql://${role}.fixture:fixture@aws-0-region.pooler.supabase.com:5432/postgres?sslmode=verify-full`;
    await protectedPool(pooled, role).end();
    for (const rejected of [pooled.replace("5432", "6543"), pooled.replace(":5432", ""),
      pooled.replace(role, "postgres"), pooled.replace(".fixture:", ":"),
      pooled.replace("pooler.supabase.com", "pooler.supabase.com.example.test"),
      pooled.replace("verify-full", "require"), pooled + "&options=untrusted"]) {
      assert.throws(() => protectedPool(rejected, role), /verify-full URL required/);
    }
  }
  const direct = "postgresql://miopages_wp_pull:fixture@direct.example.test:5432/postgres?sslmode=verify-full";
  await protectedPool(direct, pullRole).end();
  assert.throws(() => protectedPool(direct.replace("5432", "6543"), pullRole), /verify-full URL required/);
});

test("session probe refuses a changed backend and still attempts to release its lock", async () => {
  const statements: string[] = [];
  const db = { async query(sql: string) {
    statements.push(sql);
    if (sql.includes("session_user")) return { rows: [{ login: pullRole, actor: pullRole, database: "postgres",
      tls: true, privileged: false, inherits_other_role: false }] };
    if (sql.includes("pg_try_advisory_lock")) return { rows: [{ pid: 10, locked: true }] };
    if (sql.includes("transaction_read_only")) return { rows: [{ pid: 11, read_only: "on",
      search_path: "miopages_wp,public", timezone: "UTC" }] };
    if (sql.includes("pg_advisory_unlock")) return { rows: [{ pid: 10, unlocked: true }] };
    return { rows: [] };
  } } as unknown as PoolClient;
  await assert.rejects(verifyProtectedSession(db, pullRole, "postgres"), /session state did not persist/);
  assert.equal(statements.at(-2), "ROLLBACK");
  assert.match(statements.at(-1)!, /pg_advisory_unlock/);
});
