import assert from "node:assert/strict";
import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import ownership from "../backup/application-ownership.json";
import { managedSnapshot, managedDependencies, applicationSemantic } from "../backup/managed";
import { applyApplicationGrants, establishApplicationDefaults, normalizeOwnedSchemaGrants, quote as q, qualified, type Roles, type Sql } from "../backup/managed-permissions";
import { recoveryCatalog } from "../backup/catalog";
import { bootstrapFiles, bootstrapStatus } from "./bootstrap";
import { fingerprint } from "../../lib/platform/canonical/model";

export type RoleProvisioning = { databaseUrl: string; databaseName: string; sourceOwner: string; roles: Roles } & ({ operation: "create"; passwords: Roles } | { operation: "verify"; passwords?: never });
export function validateRoleProvisioning(input: RoleProvisioning) {
  assert.ok(input.operation === "create" || input.operation === "verify", "Explicit create/verify operation required");
  const url = new URL(input.databaseUrl); assert.ok(["postgres:", "postgresql:"].includes(url.protocol));
  assert.equal(decodeURIComponent(url.pathname.slice(1)), input.databaseName, "Explicit database identity differs");
  assert.ok(input.sourceOwner.length > 0 && input.sourceOwner.length <= 63 && !input.sourceOwner.includes("\0"), "Explicit provider object owner required");
  assert.deepEqual(Object.keys(input.roles).sort(), ["backup", "migration", "runtime"]);
  assert.equal(new Set(Object.values(input.roles)).size, 3, "Three distinct roles required");
  for (const name of Object.values(input.roles)) assert.ok(/^[a-z][a-z0-9_]{0,62}$/.test(name) && !name.startsWith("pg_") && !["postgres", "public", input.sourceOwner].includes(name), "Unreviewed application role name");
  if (input.operation === "create") {
    assert.deepEqual(Object.keys(input.passwords).sort(), ["backup", "migration", "runtime"]);
    for (const secret of Object.values(input.passwords)) assert.ok(typeof secret === "string" && /^[!-~]{32,256}$/.test(secret), "Supply distinct protected random ASCII passwords (32-256 characters)");
    assert.equal(new Set(Object.values(input.passwords)).size, 3, "Role passwords must differ");
  } else assert.equal(input.passwords, undefined, "Verify never sets or rotates passwords");
}
// The server receives a SCRAM verifier rather than plaintext SQL password text.
// Printable ASCII secrets avoid an implicit SASLprep normalization difference.
export async function createManagedLoginRoles(c: Sql, roles: Roles, passwords: Roles) {
  for (const kind of ["runtime", "migration", "backup"] as const) {
    const salt = randomBytes(16), salted = pbkdf2Sync(passwords[kind], salt, 4096, 32, "sha256");
    const clientKey = createHmac("sha256", salted).update("Client Key").digest();
    const stored = createHash("sha256").update(clientKey).digest("base64"), server = createHmac("sha256", salted).update("Server Key").digest("base64");
    const verifier = `SCRAM-SHA-256$4096:${salt.toString("base64")}$${stored}:${server}`;
    await c.query(`CREATE ROLE ${q(roles[kind])} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${verifier}'`);
  }
}
async function dataState(c: Sql) {
  const tables = [], sequences = [];
  for (const table of ownership.tables) tables.push({ table, hash: fingerprint((await c.query(`SELECT to_jsonb(t) row FROM ${qualified(table)} t ORDER BY to_jsonb(t)::text`)).rows.map(r => r.row)) });
  for (const sequence of ownership.sequences) sequences.push({ sequence, ...(await c.query(`SELECT last_value::text,is_called FROM ${qualified(sequence)}`)).rows[0] });
  return { tables, sequences };
}
async function sharedAuthority(c: Sql, roles: Roles) {
  // Canonical effective ACLs, excluding only the new application-role edges.
  return (await c.query(`SELECT 'database' object,pg_get_userbyid(d.datdba) owner,a.grantee,pg_get_userbyid(a.grantor) grantor,a.privilege_type,a.is_grantable FROM pg_database d CROSS JOIN LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a WHERE d.datname=current_database() AND NOT a.grantee=ANY(SELECT oid FROM pg_roles WHERE rolname=ANY($1))
    UNION ALL SELECT 'public',pg_get_userbyid(n.nspowner),a.grantee,pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='public' AND NOT a.grantee=ANY(SELECT oid FROM pg_roles WHERE rolname=ANY($1)) ORDER BY 1,2,3,4,5`, [Object.values(roles)])).rows;
}
async function preflight(c: PoolClient, owner: string) {
  const relations = (await c.query("SELECT n.nspname||'.'||r.relname name,r.relkind,pg_get_userbyid(r.relowner) owner FROM pg_class r JOIN pg_namespace n ON n.oid=r.relnamespace WHERE (n.nspname||'.'||r.relname)=ANY($1)", [[...ownership.tables, ...ownership.sequences]])).rows;
  assert.equal(relations.length, ownership.tables.length + ownership.sequences.length, "Complete application inventory required");
  for (const r of relations) { assert.equal(r.owner, owner, "Mixed/unexpected initial object ownership"); assert.equal(r.relkind, ownership.sequences.includes(r.name) ? "S" : "r"); }
  // ALTER TABLE OWNER also moves OWNED BY/identity sequences. Refuse an
  // unreviewed dependent sequence before any implicit ownership transfer.
  const extraSequences = (await c.query("SELECT n.nspname||'.'||r.relname name FROM pg_depend d JOIN pg_class r ON r.oid=d.objid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE d.classid='pg_class'::regclass AND d.refclassid='pg_class'::regclass AND d.deptype IN ('a','i') AND r.relkind='S' AND d.refobjid=ANY($1::regclass[]) AND NOT (n.nspname||'.'||r.relname)=ANY($2)", [ownership.tables, ownership.sequences])).rows;
  assert.deepEqual(extraSequences, [], "Unreviewed dependent sequence ownership");
  const functions = (await c.query("SELECT pg_get_userbyid(p.proowner) owner,pg_get_function_identity_arguments(p.oid) args,p.prorettype='trigger'::regtype trigger FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname||'.'||p.proname)=ANY($1)", [ownership.functions])).rows;
  assert.equal(functions.length, ownership.functions.length, "Missing/overloaded application function");
  assert.ok(functions.every(f => f.owner === owner && f.args === "" && f.trigger), "Unexpected application function ownership/signature");
  for (const schema of ownership.schemas.filter(s => s !== "public")) {
    assert.equal((await c.query("SELECT pg_get_userbyid(nspowner) owner FROM pg_namespace WHERE nspname=$1", [schema])).rows[0]?.owner, owner, "Unexpected application schema owner");
    const extra = (await c.query("SELECT n.nspname||'.'||r.relname name FROM pg_class r JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname=$1 AND r.relkind NOT IN ('i','I') AND NOT (n.nspname||'.'||r.relname)=ANY($2)", [schema, [...ownership.tables, ...ownership.sequences]])).rows;
    assert.deepEqual(extra, [], "Unrelated objects in a schema whose ownership would transfer");
    assert.equal((await c.query("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1", [schema])).rows[0].n, 0, "Unreviewed application-schema function");
    assert.equal((await c.query("SELECT count(*)::int n FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname=$1 AND t.typrelid=0 AND NOT EXISTS(SELECT 1 FROM pg_type b WHERE b.typarray=t.oid AND b.typrelid=ANY($2::regclass[]))", [schema, ownership.tables])).rows[0].n, 0, "Unreviewed application-schema type");
  }
}
export async function provisionManagedRoles(input: RoleProvisioning) {
  validateRoleProvisioning(input);
  const pool = new Pool({ connectionString: input.databaseUrl, connectionTimeoutMillis: 10000 });
  let c: PoolClient;
  try { c = await pool.connect(); } catch (error) { await pool.end(); if (error && typeof error === "object") Object.assign(error, { roleProvisioningStage: "connection" }); throw error; }
  let stage = "identity";
  try {
    await c.query(input.operation === "verify" ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN");
    await c.query("SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='120s'; SET LOCAL search_path=pg_catalog; SET LOCAL TIME ZONE 'UTC'");
    assert.equal((await c.query("SELECT current_database() name,current_user actor,session_user session")).rows[0].name, input.databaseName);
    const identity = (await c.query("SELECT current_user actor,session_user session")).rows[0];
    assert.equal(identity.actor, identity.session, "Pre-existing SET ROLE refused");
    assert.ok(input.operation === "create" ? identity.actor === input.sourceOwner : [input.sourceOwner, input.roles.migration, input.roles.backup].includes(identity.actor), "Unexpected provisioning/verifier identity");
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended('miopages-managed-role-provision',0))");
    stage = "dependencies"; await managedDependencies(c, input.databaseUrl);
    stage = "role-precondition";
    const existing = (await c.query("SELECT rolname FROM pg_roles WHERE rolname=ANY($1)", [Object.values(input.roles)])).rows;
    if (input.operation === "verify") {
      assert.equal(existing.length, 3, "Verify requires the complete existing role set");
      stage = "verification"; const state = await managedSnapshot(c, input.databaseUrl, input.roles); stage = "commit"; await c.query("COMMIT");
      return { operation: "verify", verified: true, roles: input.roles, major: state.provider.major, migrations: state.migrations.length };
    }
    assert.equal(existing.length, 0, "Create requires all three role names absent; partial/existing roles are never repaired");
    stage = "inventory-preflight"; await preflight(c, input.sourceOwner);
    await c.query(`LOCK TABLE ${ownership.tables.map(qualified).join(",")} IN ACCESS EXCLUSIVE MODE`);
    stage = "inventory-preflight"; await preflight(c, input.sourceOwner);
    const bootstrap = await bootstrapStatus(c, bootstrapFiles()); assert.equal(bootstrap.applied, 16); assert.equal(bootstrap.pending, 0);
    const catalog = applicationSemantic(await recoveryCatalog(c, ownership.schemas)), data = await dataState(c), shared = await sharedAuthority(c, input.roles);
    stage = "role-creation"; await createManagedLoginRoles(c, input.roles, input.passwords);
    // PG17/18 non-superuser CREATEROLE may leave automatic ADMIN-only creator
    // edges. Add a temporary SET edge for ownership transfer, then revoke ours.
    stage = "ownership-transfer";
    await c.query(`GRANT ${q(input.roles.migration)} TO ${q(input.sourceOwner)} WITH INHERIT FALSE, SET TRUE`);
    await c.query(`GRANT CREATE ON DATABASE ${q(input.databaseName)} TO ${q(input.roles.migration)}`);
    for (const schema of ownership.schemas) await c.query(`GRANT USAGE ON SCHEMA ${q(schema)} TO ${q(input.roles.runtime)},${q(input.roles.backup)},${q(input.roles.migration)}; GRANT CREATE ON SCHEMA ${q(schema)} TO ${q(input.roles.migration)}`);
    for (const table of ownership.tables) await c.query(`ALTER TABLE ${qualified(table)} OWNER TO ${q(input.roles.migration)}`);
    for (const sequence of ownership.sequences) {
      const owner = (await c.query("SELECT pg_get_userbyid(relowner) owner FROM pg_class WHERE oid=to_regclass($1)", [sequence])).rows[0].owner;
      if (owner !== input.roles.migration) await c.query(`ALTER SEQUENCE ${qualified(sequence)} OWNER TO ${q(input.roles.migration)}`);
    }
    for (const fn of ownership.functions) await c.query(`ALTER FUNCTION ${qualified(fn)}() OWNER TO ${q(input.roles.migration)}`);
    for (const schema of ownership.schemas.filter(s => s !== "public")) await c.query(`ALTER SCHEMA ${q(schema)} OWNER TO ${q(input.roles.migration)}`);
    await c.query(`SET LOCAL ROLE ${q(input.roles.migration)}`);
    stage = "acl-normalization"; await applyApplicationGrants(c, input.roles);
    for (const schema of ownership.schemas.filter(s => s !== "public")) await normalizeOwnedSchemaGrants(c, input.roles, schema);
    stage = "default-privileges"; await establishApplicationDefaults(c, input.roles);
    stage = "verification"; const state = await managedSnapshot(c, input.databaseUrl, input.roles);
    assert.deepEqual(state.semantic, catalog, "Role provisioning changed application semantics");
    assert.deepEqual(await dataState(c), data, "Role provisioning changed data or sequence values");
    assert.deepEqual(await sharedAuthority(c, input.roles), shared, "Provider database/public authority changed");
    assert.deepEqual(await bootstrapStatus(c, bootstrapFiles()), bootstrap, "Bootstrap receipt/history changed");
    stage = "membership-cleanup"; await c.query("SET LOCAL ROLE NONE");
    await c.query(`REVOKE ${Object.values(input.roles).map(q).join(",")} FROM ${q(input.sourceOwner)}`);
    const membership = (await c.query("SELECT m.inherit_option,m.set_option FROM pg_auth_members m WHERE m.roleid=ANY(SELECT oid FROM pg_roles WHERE rolname=ANY($1))", [Object.values(input.roles)])).rows;
    assert.ok(membership.every(r => !r.inherit_option && !r.set_option), "Unexpected retained application-role SET/INHERIT membership");
    stage = "commit"; await c.query("COMMIT");
    return { operation: "create", verified: true, roles: input.roles, major: state.provider.major, migrations: state.migrations.length };
  } catch (error) { if (error && typeof error === "object") Object.assign(error, { roleProvisioningStage: stage }); try { await c.query("ROLLBACK"); } catch { /* A lost connection never claims a successful commit. */ } throw error; }
  finally { c.release(); await pool.end(); }
}
