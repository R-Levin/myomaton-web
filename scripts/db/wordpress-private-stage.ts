import assert from "node:assert/strict";
import { verifyWordPressRoles } from "./wordpress-roles";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { PoolClient } from "pg";
import { bootstrapStatus } from "./bootstrap";
import { adapterSchema, migrationRole, operatorRole, protectedConnection, protectedPool, pullRole, verifyProtectedSession } from "../../lib/platform/wordpress-delivery/protected-connection";
import { privateStageSource, privateStageProposalTables } from "../../lib/platform/wordpress-delivery/permissions";
import { inventorySite, normalizeInventoryUrl, sharedInventory } from "./wordpress-shared-inventory";
import { wordpressRehearsalFixture } from "../customer-initializers/wordpress-rehearsal";
import { quote } from "../backup/managed-permissions";

const migrations = ["0016_wordpress_delivery", "0017_private_stage_authority"];
const draftMigration = "0018_native_draft_authority";
const originMigration = "0019_active_installation_origin";
const draftTable = "wordpress_native_draft_authorizations";
const draftInsertColumns = ["installation_id", "site_proposal_id", "revision", "candidate_digest", "previous_digest",
  "reviewer_grant_id", "authorizer_grant_id"];
const backup = "miopages_backup";
const runtime = "miopages_runtime";
const tables = ["wordpress_installations", "wordpress_installation_keys", "wordpress_delivery_events",
  "wordpress_deliveries", "wordpress_request_nonces", "wordpress_operator_credentials", "wordpress_operator_grants",
  "wordpress_proposal_approvals", "wordpress_private_releases", "wordpress_schema_migrations"];
// Called in an existing transaction after checking the protected migration connection.
export async function integratePrivateStage(db: PoolClient, canonicalSchema = "public", nativeDraft = false) {
  const selected = [operatorRole, pullRole, backup, runtime];
  const roles = (await db.query(`SELECT rolname FROM pg_roles
    WHERE rolname=ANY($1) AND rolcanlogin AND NOT (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication)
    AND NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE member=oid)`, [selected])).rows;
  if (roles.length !== selected.length) throw Error("Dedicated restricted roles required");
  const list = (schema: string, names: string[]) => names.map(name => quote(schema) + "." + quote(name)).join(",");
  const canonical = quote(canonicalSchema), adapter = quote(adapterSchema);
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended('miopages-private-stage-schema',0))");
  await db.query(`CREATE SCHEMA IF NOT EXISTS ${adapter}`);
  if (!(await db.query("SELECT 1 FROM pg_namespace WHERE nspname=$1 AND nspowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)",
    [adapterSchema])).rowCount) throw Error("Private-stage schema owner mismatch");
  await db.query(`SET LOCAL search_path=${adapter},${canonical}`);
  await db.query(`CREATE TABLE IF NOT EXISTS ${adapter}.wordpress_schema_migrations
    (name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
  const prior = (await db.query("SELECT name,sha256 FROM wordpress_schema_migrations ORDER BY name")).rows;
  const expectedMigrations = nativeDraft ? [...migrations, draftMigration] : migrations;
  if (prior.length > expectedMigrations.length) throw Error("Unknown private-stage migration");
  for (const [index, name] of expectedMigrations.entries()) {
    const sql = await readFile("lib/platform/wordpress-delivery/" + name + ".sql", "utf8");
    const digest = createHash("sha256").update(sql.replaceAll("\r\n", "\n")).digest("hex");
    if (index < prior.length) {
      if (prior[index].name !== name || prior[index].sha256 !== digest) throw Error("Private-stage migration checksum mismatch");
      continue;
    }
    await db.query(sql);
    await db.query("INSERT INTO wordpress_schema_migrations(name,sha256) VALUES($1,$2)", [name, digest]);
  }
  const adapterTables = nativeDraft ? [...tables, draftTable] : tables;
  const managedTables = list(adapterSchema, adapterTables);
  const subjects = ["PUBLIC", ...selected.map(quote)].join(",");
  await db.query(`REVOKE ALL ON SCHEMA ${adapter} FROM ${subjects};
    REVOKE ALL ON TABLE ${managedTables} FROM ${subjects};
    REVOKE ALL ON FUNCTION ${adapter}.wordpress_delivery_release_reference() FROM ${subjects};
    GRANT USAGE ON SCHEMA ${adapter} TO ${operatorRole},${pullRole},${backup};
    GRANT SELECT ON TABLE ${managedTables} TO ${backup};
    GRANT SELECT ON TABLE ${list(canonicalSchema, privateStageSource)} TO ${operatorRole},${pullRole};
    GRANT INSERT ON TABLE ${list(canonicalSchema, privateStageProposalTables)} TO ${operatorRole};
    GRANT UPDATE(id) ON ${canonical}.site_change_proposals TO ${operatorRole};
    GRANT SELECT ON TABLE ${list(adapterSchema, adapterTables.filter(t => t !== "wordpress_schema_migrations"))} TO ${operatorRole};
    GRANT INSERT ON TABLE ${list(adapterSchema, ["wordpress_installations", "wordpress_installation_keys", "wordpress_delivery_events",
      "wordpress_deliveries", "wordpress_proposal_approvals", "wordpress_private_releases"])} TO ${operatorRole};
    GRANT UPDATE(status,generation) ON wordpress_installations TO ${operatorRole};
    GRANT SELECT ON TABLE ${list(adapterSchema, ["wordpress_installations", "wordpress_installation_keys", "wordpress_delivery_events",
      "wordpress_deliveries", "wordpress_request_nonces", "wordpress_operator_grants", "wordpress_private_releases",
      "wordpress_proposal_approvals"])} TO ${pullRole};
    GRANT INSERT ON wordpress_delivery_events,wordpress_request_nonces TO ${pullRole};
    GRANT UPDATE(request_epoch) ON wordpress_installations TO ${pullRole};
    GRANT UPDATE(staged_at) ON wordpress_deliveries TO ${pullRole};
    GRANT DELETE ON wordpress_request_nonces TO ${pullRole};
    GRANT EXECUTE ON FUNCTION ${adapter}.wordpress_delivery_release_reference() TO ${operatorRole};
    ${nativeDraft ? `GRANT INSERT(${draftInsertColumns.join(",")}) ON ${adapter}.${draftTable} TO ${operatorRole};` : ""}`);
  const forbidden = await db.query(`SELECT 1 FROM unnest($1::text[]) r WHERE
    has_schema_privilege(r,$2,'CREATE') OR has_schema_privilege(r,$3,'CREATE')
    OR has_table_privilege(r,$2||'.pages','INSERT,UPDATE,DELETE')
    OR has_table_privilege(r,$2||'.sections','INSERT,UPDATE,DELETE')`, [[operatorRole, pullRole], canonicalSchema, adapterSchema]);
  if (forbidden.rowCount) throw Error("Excess private-stage privileges");
}

export async function verifyPrivateStageAdapter(db: PoolClient, nativeDraft = false, activeOrigin = false) {
  await verifyWordPressRoles(db);
  const recorded = (await db.query("SELECT name,sha256 FROM miopages_wp.wordpress_schema_migrations ORDER BY name")).rows;
  const adapterTables = nativeDraft ? [...tables, draftTable] : tables;
  const expectedMigrations = await Promise.all((nativeDraft ? [...migrations, draftMigration, ...(activeOrigin ? [originMigration] : [])] : migrations).map(async name => ({ name, sha256: createHash("sha256")
    .update((await readFile("lib/platform/wordpress-delivery/" + name + ".sql", "utf8")).replaceAll("\r\n", "\n")).digest("hex") })));
  assert.deepEqual(recorded, expectedMigrations, "Private-stage migration checksum mismatch");
  if (activeOrigin) {
    const { rows } = await db.query(`SELECT i.indisunique, i.indisvalid, pg_get_indexdef(i.indexrelid,1,true) AS column,
        pg_get_expr(i.indpred,i.indrelid) AS predicate
      FROM pg_index i WHERE i.indexrelid='miopages_wp.wordpress_installation_active_origin'::regclass
        AND i.indrelid='miopages_wp.wordpress_installations'::regclass AND i.indnkeyatts=1 AND i.indnatts=1`);
    assert.deepEqual(rows, [{ indisunique: true, indisvalid: true, column: "origin", predicate: "(status = 'active'::text)" }]);
    assert.equal((await db.query(`SELECT 1 FROM pg_constraint
      WHERE conrelid='miopages_wp.wordpress_installations'::regclass AND conname='wordpress_installation_origin'`)).rowCount, 0);
  }
  const owned = (await db.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='miopages_wp' AND c.relkind IN ('r','p') AND pg_get_userbyid(c.relowner)=$1 ORDER BY c.relname`, [migrationRole])).rows;
  assert.deepEqual(owned.map(row => row.relname), [...adapterTables].sort(), "Private-stage table ownership mismatch");
  assert.equal((await db.query("SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='miopages_wp'")).rows[0]?.owner, migrationRole);
  const expected = new Set<string>();
  const add = (role: string, table: string, privilege: string, column = "") => expected.add([role, table, privilege, column].join("|"));
  for (const role of [operatorRole, pullRole]) for (const table of privateStageSource) add(role, "public." + table, "SELECT");
  for (const table of privateStageProposalTables) add(operatorRole, "public." + table, "INSERT");
  add(operatorRole, "public.site_change_proposals", "UPDATE", "id");
  for (const table of adapterTables.filter(table => table !== "wordpress_schema_migrations")) add(operatorRole, "miopages_wp." + table, "SELECT");
  if (nativeDraft) for (const field of draftInsertColumns) add(operatorRole, "miopages_wp." + draftTable, "INSERT", field);
  for (const table of ["wordpress_installations", "wordpress_installation_keys", "wordpress_delivery_events",
    "wordpress_deliveries", "wordpress_proposal_approvals", "wordpress_private_releases"]) add(operatorRole, "miopages_wp." + table, "INSERT");
  for (const column of ["status", "generation"]) add(operatorRole, "miopages_wp.wordpress_installations", "UPDATE", column);
  for (const table of ["wordpress_installations", "wordpress_installation_keys", "wordpress_delivery_events",
    "wordpress_deliveries", "wordpress_request_nonces", "wordpress_operator_grants", "wordpress_private_releases",
    "wordpress_proposal_approvals"]) add(pullRole, "miopages_wp." + table, "SELECT");
  for (const table of ["wordpress_delivery_events", "wordpress_request_nonces"]) add(pullRole, "miopages_wp." + table, "INSERT");
  add(pullRole, "miopages_wp.wordpress_installations", "UPDATE", "request_epoch");
  add(pullRole, "miopages_wp.wordpress_deliveries", "UPDATE", "staged_at");
  add(pullRole, "miopages_wp.wordpress_request_nonces", "DELETE");

  const acl = (await db.query(`SELECT pg_get_userbyid(a.grantee) role,n.nspname||'.'||c.relname object,a.privilege_type privilege,
    '' AS field,pg_get_userbyid(a.grantor) grantor,a.is_grantable
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(c.relacl) a
    WHERE n.nspname IN ('public','miopages_wp') AND a.grantee=ANY(SELECT oid FROM pg_roles WHERE rolname=ANY($1))
    UNION ALL SELECT pg_get_userbyid(a.grantee),n.nspname||'.'||c.relname,a.privilege_type,col.attname,
      pg_get_userbyid(a.grantor),a.is_grantable FROM pg_attribute col JOIN pg_class c ON c.oid=col.attrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(col.attacl) a
      WHERE n.nspname IN ('public','miopages_wp') AND col.attnum>0 AND NOT col.attisdropped
      AND a.grantee=ANY(SELECT oid FROM pg_roles WHERE rolname=ANY($1))`, [[operatorRole, pullRole]])).rows;
  for (const edge of acl) {
    assert.equal(edge.grantor, migrationRole, "Unexpected adapter grantor");
    assert.equal(edge.is_grantable, false);
  }
  assert.deepEqual(new Set(acl.map(edge => [edge.role, edge.object, edge.privilege, edge.field].join("|"))), expected,
    "WordPress table/column grants differ");
  const fn = (await db.query(`SELECT pg_get_userbyid(p.proowner) owner,p.prosecdef,
    (SELECT array_agg(pg_get_userbyid(a.grantee)::text ORDER BY pg_get_userbyid(a.grantee)::text)
      FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      WHERE a.privilege_type='EXECUTE' AND a.grantee<>p.proowner) AS callers
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='miopages_wp'
      AND p.proname='wordpress_delivery_release_reference' AND pg_get_function_identity_arguments(p.oid)=''`)).rows;
  assert.equal(fn.length, 1);
  assert.equal(fn[0].owner, migrationRole);
  assert.equal(fn[0].prosecdef, false);
  assert.deepEqual(fn[0].callers, [operatorRole]);
  for (const table of adapterTables) {
    const rights = (await db.query(`SELECT has_table_privilege($1,$3,'SELECT') AS backup_read,
      has_any_column_privilege($1,$3,'INSERT,UPDATE') OR has_table_privilege($1,$3,'DELETE,TRUNCATE,REFERENCES,TRIGGER') AS backup_write,
      has_any_column_privilege($2,$3,'SELECT,INSERT,UPDATE,REFERENCES') OR has_table_privilege($2,$3,'DELETE,TRUNCATE,TRIGGER') AS runtime_access`,
    [backup, runtime, "miopages_wp." + table])).rows[0];
    assert.deepEqual(rights, { backup_read: true, backup_write: false, runtime_access: false });
  }
  return { verified: true, privateStageMigrations: recorded.length, checksumsVerified: true, grantsVerified: true };
}

export async function advanceActiveInstallationOrigin(db: PoolClient, canonicalSchema = "public") {
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended('miopages-private-stage-schema',0))");
  await db.query(`SET LOCAL search_path=${quote(adapterSchema)},${quote(canonicalSchema)}`);
  const present = (await db.query("SELECT 1 FROM wordpress_schema_migrations WHERE name=$1", [originMigration])).rowCount;
  if (present) return;
  const prior = (await db.query("SELECT name FROM wordpress_schema_migrations ORDER BY name")).rows.map(row => row.name);
  assert.deepEqual(prior, [...migrations, draftMigration], "Verified adapter migration 0018 required");
  const sql = await readFile("lib/platform/wordpress-delivery/" + originMigration + ".sql", "utf8");
  await db.query(sql);
  await db.query("INSERT INTO wordpress_schema_migrations(name,sha256) VALUES($1,$2)", [
    originMigration, createHash("sha256").update(sql.replaceAll("\r\n", "\n")).digest("hex"),
  ]);
}

const diagnosticStages = {
  configuration: ["WP_CONFIGURATION", "Check the schema action and expected database setting."],
  connection_configuration: ["WP_CONNECTION_CONFIGURATION", "Check the role-specific URL format. Session Pooler requires port 5432, role.project-ref and sslmode=verify-full."],
  connection_tls: ["WP_CONNECTION_FAILED", "Check the authorized login, Session Pooler reachability and trusted CA."],
  role_database_identity: ["WP_IDENTITY_CHECK_FAILED", "Check the backend login, effective role, expected database and backend TLS evidence."],
  session_behavior: ["WP_SESSION_CHECK_FAILED", "The advisory lock, backend identity or session settings could not be verified across a read-only transaction and rollback."],
  canonical_migration_baseline: ["WP_BASELINE_CHECK_FAILED", "Check the exact 16 canonical migrations, ledger access and the PG17 compatibility receipt if applicable."],
  fixture_initialization: ["WP_FIXTURE_CHECK_FAILED", "Verify the fixed rehearsal fixture and baseline. Inspect committed state before any create retry."],
  shared_inventory: ["WP_INVENTORY_FAILED", "Inspect read-only inventory access and the approved graph inputs."],
  adapter_validation: ["WP_ADAPTER_VALIDATION_FAILED", "Check access to role and adapter-schema metadata."],
  managed_recovery: ["WP_RECOVERY_FAILED", "Managed recovery failed. Preserve partial artifacts and stop before database setup."],
  migration: ["WP_MIGRATION_FAILED", "Verify migration state before retrying."],
} as const;

type DiagnosticStage = keyof typeof diagnosticStages;

// Allowlisted codes and constant descriptions only. Driver messages, assertion
// diffs, error details and stacks can contain credentials or private data.
const safeErrors = new Map<string, string>([
  ["PG_NATIVE_LIBRARY_MISMATCH", "The PostgreSQL client could not load its required native library or symbols. Check its matching bundled libpq."],
  ["PG_NATIVE_LIBRARY_PATH", "The bundled PostgreSQL client library path failed validation."],
  ["PG_NATIVE_NOT_FOUND", "The required PostgreSQL client executable was not found."],
  ["PG_NATIVE_TIMEOUT", "The PostgreSQL client timed out; no successful backup is claimed."],
  ["PG_NATIVE_FAILED", "The PostgreSQL client failed. No successful backup is claimed; raw native output remains suppressed."],
  ["ENOTFOUND", "The database hostname did not resolve."],
  ["EAI_AGAIN", "DNS lookup failed temporarily."],
  ["ENETUNREACH", "The database network was unreachable."],
  ["ECONNREFUSED", "The database connection was refused."],
  ["ETIMEDOUT", "The database connection timed out."],
  ["ECONNRESET", "The connection was reset."],
  ["ERR_TLS_CERT_ALTNAME_INVALID", "The certificate did not match the configured hostname."],
  ["CERT_HAS_EXPIRED", "The certificate has expired."],
  ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "The certificate chain could not be verified."],
  ["SELF_SIGNED_CERT_IN_CHAIN", "The certificate chain contains an untrusted self-signed certificate."],
  ["UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "The certificate issuer is not trusted."],
  ["ERR_OSSL_PEM_NO_START_LINE", "Check that the configured CA contains valid PEM."],
  ["28P01", "PostgreSQL rejected the supplied login credentials."],
  ["28000", "PostgreSQL rejected the authorization request."],
  ["3D000", "PostgreSQL rejected the requested database."],
  ["42501", "The role lacks permission for this check."],
  ["42704", "A required PostgreSQL object is missing."],
  ["42P01", "A required table is missing."],
  ["ERR_ASSERTION", "The canonical migration ledger or compatibility receipt failed validation."],
  ["WP_BACKEND_TLS_UNVERIFIED", "The authenticated backend did not report positive TLS evidence."],
  ["WP_ROLE_MISMATCH", "The backend session or effective role did not match the expected restricted role."],
  ["WP_ROLE_PRIVILEGES", "The backend role has disallowed privileges or role membership."],
  ["WP_DATABASE_MISMATCH", "The backend database did not match the expected rehearsal database."],
]);

export function privateStageDiagnostic(stage: DiagnosticStage, error: unknown) {
  const candidate = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (stage === "managed_recovery" && candidate === "ERR_ASSERTION") return {
    stage, code: candidate, detail: "A managed recovery invariant failed at the reported backup stage. Preserve artifacts and verify that stage before retrying.",
  };
  const known = typeof candidate === "string" ? safeErrors.get(candidate) : undefined;
  const [fallbackCode, fallbackDetail] = diagnosticStages[stage];
  return { stage, code: known ? candidate : fallbackCode, detail: known ?? fallbackDetail };
}

async function main(stage: (value: DiagnosticStage) => void) {
  const action = process.env.MIOPAGES_WP_SCHEMA_ACTION;
  const probeRole = action === "probe-pull-session" ? pullRole : action === "probe-operator-session" ? operatorRole : null;
  const fixtureOperation = action === "create-rehearsal-fixture" ? "create" : action === "verify-rehearsal-fixture" ? "verify" : null;
  const activeOrigin = action === "apply-active-installation-origin" || action === "verify-active-installation-origin";
  const nativeDraft = activeOrigin || action === "apply-native-draft-stage" || action === "verify-native-draft-stage";
  const verifyAdapter = action === "verify-private-stage" || action === "verify-native-draft-stage" || action === "verify-active-installation-origin";
  const inventory = action === "inventory-private-stage";
  if (!verifyAdapter && !fixtureOperation && !inventory && !probeRole && !nativeDraft && action !== "apply-private-stage" && action !== "preflight-private-stage") {
    throw Error("Explicit schema operation required");
  }
  const expected = process.env.MIOPAGES_WP_EXPECTED_DATABASE;
  if (!expected) throw Error("Explicit rehearsal database identity required");
  const readOnly = action === "preflight-private-stage";
  const url = probeRole === pullRole ? process.env.MIOPAGES_WP_PULL_URL :
    probeRole === operatorRole ? process.env.MIOPAGES_WP_OPERATOR_URL : process.env.MIOPAGES_WP_MIGRATION_URL;
  stage("connection_configuration");
  const pool = protectedPool(inventory || fixtureOperation ? normalizeInventoryUrl(url ?? "", expected) : url ?? "", probeRole ?? migrationRole, process.env.MIOPAGES_WP_DATABASE_CA);
  try {
    stage("connection_tls");
    const db = await pool.connect();
    try {
      stage("role_database_identity");
      if (verifyAdapter) {
        await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        await protectedConnection(db, migrationRole, expected);
        stage("adapter_validation");
        const result = await verifyPrivateStageAdapter(db, nativeDraft, activeOrigin);
        await db.query("ROLLBACK");
        console.log(JSON.stringify({ ...result, readOnly: true }));
        return;
      }
      if (fixtureOperation) {
        if (fixtureOperation === "create" && process.env.MIOPAGES_WP_FIXTURE_APPROVAL !== "create-synthetic-rehearsal") {
          throw Error("Explicit fixture creation approval required");
        }
        await db.query(fixtureOperation === "verify" ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN");
        await protectedConnection(db, migrationRole, expected);
        await db.query("SET LOCAL search_path=public");
        stage("canonical_migration_baseline");
        const baseline = await bootstrapStatus(db);
        if (baseline.applied !== 16 || baseline.pending) throw Error("Exact canonical migration baseline required");
        stage("fixture_initialization");
        const result = await wordpressRehearsalFixture(db, fixtureOperation);
        await db.query(fixtureOperation === "verify" ? "ROLLBACK" : "COMMIT");
        console.log(JSON.stringify({ ...result, operation: fixtureOperation, readOnly: fixtureOperation === "verify" }));
        return;
      }
      if (inventory) {
        await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        await protectedConnection(db, migrationRole, expected);
        await db.query("SET LOCAL search_path=public");
        stage("shared_inventory");
        const synthetic: unknown = JSON.parse(process.env.MIOPAGES_WP_SYNTHETIC_SITES ?? "[]");
        if (!Array.isArray(synthetic) || synthetic.length > 32) throw Error("Bounded synthetic graph list required");
        const fixtureInput = process.env.MIOPAGES_WP_REHEARSAL_SITE;
        const result = await sharedInventory(db, synthetic.map(inventorySite),
          fixtureInput ? inventorySite(JSON.parse(fixtureInput)) : undefined);
        await db.query("ROLLBACK");
        console.log(JSON.stringify(result));
        if (result.status === "BLOCKED") process.exitCode = 2;
        return;
      }
      await verifyProtectedSession(db, probeRole ?? migrationRole, expected, () => stage("session_behavior"));
      if (probeRole) {
        console.log(JSON.stringify({ role: probeRole, verifiedTls: true, sessionVerified: true }));
        return;
      }
      await db.query(readOnly ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN");
      stage("role_database_identity");
      await protectedConnection(db, migrationRole, expected, () => stage("session_behavior"));
      await db.query("SET LOCAL search_path=public");
      stage("canonical_migration_baseline");
      const baseline = await bootstrapStatus(db);
      if (baseline.pending || baseline.applied !== 16) throw Error("Exact canonical migration baseline required");
      if (readOnly) {
        stage("adapter_validation");
        const roles = (await db.query(`SELECT r.rolname AS role,
          r.rolcanlogin AND NOT (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication)
          AND NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE member=r.oid)
          AND has_database_privilege(r.oid,current_database(),'CONNECT')
          AND has_schema_privilege(r.oid,'public','USAGE')
          AND NOT has_schema_privilege(r.oid,'public','CREATE')
          AND NOT has_database_privilege(r.oid,current_database(),'CREATE') AS restricted
          FROM pg_roles r WHERE r.rolname=ANY($1) ORDER BY r.rolname`,
        [[operatorRole, pullRole, backup, runtime]])).rows;
        const namespace = (await db.query(`SELECT nspowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) AS owned
          FROM pg_namespace WHERE nspname=$1`, [adapterSchema])).rows[0];
        const canCreateSchema = (await db.query("SELECT has_database_privilege(current_database(),'CREATE') AS allowed")).rows[0].allowed;
        await db.query("ROLLBACK");
        console.log(JSON.stringify({ readOnly: true, verifiedTls: true, sessionVerified: true, canonicalMigrations: baseline.applied,
          pgMajor: baseline.major, pg17CompatibilityReceipt: baseline.receipt !== null, roles,
          adapterSchema: !namespace ? "absent" : namespace.owned ? "present-owned" : "unexpected-owner", canCreateSchema }));
        return;
      }
      stage("migration");
      if (activeOrigin) {
        const present = (await db.query("SELECT 1 FROM miopages_wp.wordpress_schema_migrations WHERE name=$1", [originMigration])).rowCount;
        await verifyPrivateStageAdapter(db, true, Boolean(present));
        await advanceActiveInstallationOrigin(db);
        await verifyPrivateStageAdapter(db, true, true);
      } else await integratePrivateStage(db, "public", nativeDraft);
      await db.query("COMMIT");
      console.log(JSON.stringify({ privateStageMigrations: migrations.length + Number(nativeDraft) + Number(activeOrigin), verified: true }));
    } catch (error) { await db.query("ROLLBACK").catch(() => {}); throw error; }
    finally { db.release(); }
  } finally { await pool.end(); }
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/db/wordpress-private-stage.ts")) {
  let failedStage: DiagnosticStage = "configuration";
  main(value => { failedStage = value; }).catch(error => {
    const diagnostic = privateStageDiagnostic(failedStage, error);
    console.error(JSON.stringify(process.env.MIOPAGES_WP_SCHEMA_ACTION === "inventory-private-stage"
      ? { status: "BLOCKED", ...diagnostic } : diagnostic));
    process.exitCode = 1;
  });
}
