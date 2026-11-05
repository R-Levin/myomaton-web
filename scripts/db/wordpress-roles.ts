import assert from "node:assert/strict";
import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { migrationRole, operatorRole, pullRole } from "../../lib/platform/wordpress-delivery/protected-connection";
import { quote } from "../backup/managed-permissions";

const wordpressRoles = [operatorRole, pullRole];
const originalRoles = ["miopages_runtime", migrationRole, "miopages_backup"];

export async function verifyWordPressRoles(db: PoolClient) {
  const rows = (await db.query(`SELECT rolname,rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls
    FROM pg_roles WHERE rolname=ANY($1) ORDER BY rolname`, [wordpressRoles])).rows;
  assert.equal(rows.length, 2, "Both WordPress roles must exist");
  for (const row of rows) {
    assert.equal(row.rolcanlogin, true);
    assert.equal(row.rolinherit, false);
    for (const flag of ["rolsuper", "rolcreatedb", "rolcreaterole", "rolreplication", "rolbypassrls"]) assert.equal(row[flag], false);
    const state = (await db.query(`SELECT
      NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=$1)) AS no_memberships,
      has_database_privilege($1,current_database(),'CONNECT') AS can_connect,
      NOT has_database_privilege($1,current_database(),'CREATE') AS no_database_create,
      has_schema_privilege($1,'public','USAGE') AS public_usage,
      NOT has_schema_privilege($1,'public','CREATE') AS no_public_create,
      NOT EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname='miopages_wp'
        AND has_schema_privilege($1,n.oid,'CREATE')) AS no_adapter_create`, [row.rolname])).rows[0];
    assert.ok(Object.values(state).every(value => value === true), "WordPress role restrictions differ");
  }
  return { verified: true, roles: wordpressRoles.map(role => ({ role, restricted: true })) };
}

async function existingRoleState(db: PoolClient) {
  return (await db.query(`SELECT rolname,rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,
    (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member),'[]'::jsonb) FROM pg_auth_members m WHERE m.member=r.oid) memberships
    FROM pg_roles r WHERE rolname=ANY($1) ORDER BY rolname`, [originalRoles])).rows;
}

// Fixed two-role operator. The original three-role provisioner is untouched.
// SCRAM construction follows createManagedLoginRoles, sending no plaintext SQL password.
export async function createWordPressRoles(db: PoolClient, providerOwner: string, passwords: { operator: string; pull: string }) {
  assert.ok(providerOwner && ![...originalRoles, ...wordpressRoles].includes(providerOwner));
  const identity = (await db.query(`SELECT session_user::text AS login,current_user::text AS actor,
    (SELECT rolcreaterole OR rolsuper FROM pg_roles WHERE rolname=current_user) AS can_create`)).rows[0];
  assert.ok(identity?.login === providerOwner && identity.actor === providerOwner && identity.can_create,
    "Authorized provider-owner connection required");
  assert.ok(Object.values(passwords).every(secret => typeof secret === "string" && /^[!-~]{32,256}$/.test(secret)),
    "Protected random ASCII passwords required");
  assert.notEqual(passwords.operator, passwords.pull, "Distinct passwords required");
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended('miopages-wordpress-two-roles',0))");
  assert.equal((await db.query("SELECT 1 FROM pg_roles WHERE rolname=ANY($1)", [wordpressRoles])).rowCount, 0,
    "Create requires both WordPress roles absent. Use verify after an uncertain outcome");
  const before = await existingRoleState(db);
  assert.equal(before.length, 3, "Existing Core roles required");
  for (const [role, password] of [[operatorRole, passwords.operator], [pullRole, passwords.pull]]) {
    const salt = randomBytes(16), salted = pbkdf2Sync(password, salt, 4096, 32, "sha256");
    const clientKey = createHmac("sha256", salted).update("Client Key").digest();
    const stored = createHash("sha256").update(clientKey).digest("base64");
    const server = createHmac("sha256", salted).update("Server Key").digest("base64");
    const verifier = `SCRAM-SHA-256$4096:${salt.toString("base64")}$${stored}:${server}`;
    await db.query(`CREATE ROLE ${quote(role)} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${verifier}'`);
    // PG17+ may create an automatic ADMIN edge to the role creator.
    await db.query(`REVOKE ${quote(role)} FROM ${quote(providerOwner)}`);
  }
  const database = (await db.query("SELECT current_database() AS name")).rows[0].name;
  await db.query(`GRANT CONNECT ON DATABASE ${quote(database)} TO ${wordpressRoles.map(quote).join(",")}`);
  await db.query(`GRANT USAGE ON SCHEMA public TO ${wordpressRoles.map(quote).join(",")}`);
  const result = await verifyWordPressRoles(db);
  assert.deepEqual(await existingRoleState(db), before, "Existing Core roles changed");
  return { ...result, created: 2 };
}
