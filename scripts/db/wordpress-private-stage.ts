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
const backup = "miopages_backup";
const runtime = "miopages_runtime";
const tables = ["wordpress_installations", "wordpress_installation_keys", "wordpress_delivery_events",
  "wordpress_deliveries", "wordpress_request_nonces", "wordpress_operator_credentials", "wordpress_operator_grants",
  "wordpress_proposal_approvals", "wordpress_private_releases", "wordpress_schema_migrations"];
// Called in an existing transaction after checking the protected migration connection.
export async function integratePrivateStage(db: PoolClient, canonicalSchema = "public") {
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
  if (prior.length > migrations.length) throw Error("Unknown private-stage migration");
  for (const [index, name] of migrations.entries()) {
    const sql = await readFile("lib/platform/wordpress-delivery/" + name + ".sql", "utf8");
    const digest = createHash("sha256").update(sql.replaceAll("\r\n", "\n")).digest("hex");
    if (index < prior.length) {
      if (prior[index].name !== name || prior[index].sha256 !== digest) throw Error("Private-stage migration checksum mismatch");
      continue;
    }
    await db.query(sql);
    await db.query("INSERT INTO wordpress_schema_migrations(name,sha256) VALUES($1,$2)", [name, digest]);
  }
  const managedTables = list(adapterSchema, tables);
  const subjects = ["PUBLIC", ...selected.map(quote)].join(",");
  await db.query(`REVOKE ALL ON SCHEMA ${adapter} FROM ${subjects};
    REVOKE ALL ON TABLE ${managedTables} FROM ${subjects};
    REVOKE ALL ON FUNCTION ${adapter}.wordpress_delivery_release_reference() FROM ${subjects};
    GRANT USAGE ON SCHEMA ${adapter} TO ${operatorRole},${pullRole},${backup};
    GRANT SELECT ON TABLE ${managedTables} TO ${backup};
    GRANT SELECT ON TABLE ${list(canonicalSchema, privateStageSource)} TO ${operatorRole},${pullRole};
    GRANT INSERT ON TABLE ${list(canonicalSchema, privateStageProposalTables)} TO ${operatorRole};
    GRANT UPDATE(id) ON ${canonical}.site_change_proposals TO ${operatorRole};
    GRANT SELECT ON TABLE ${list(adapterSchema, tables.filter(t => t !== "wordpress_schema_migrations"))} TO ${operatorRole};
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
    GRANT EXECUTE ON FUNCTION ${adapter}.wordpress_delivery_release_reference() TO ${operatorRole}`);
  const forbidden = await db.query(`SELECT 1 FROM unnest($1::text[]) r WHERE
    has_schema_privilege(r,$2,'CREATE') OR has_schema_privilege(r,$3,'CREATE')
    OR has_table_privilege(r,$2||'.pages','INSERT,UPDATE,DELETE')
    OR has_table_privilege(r,$2||'.sections','INSERT,UPDATE,DELETE')`, [[operatorRole, pullRole], canonicalSchema, adapterSchema]);
  if (forbidden.rowCount) throw Error("Excess private-stage privileges");
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
  migration: ["WP_MIGRATION_FAILED", "Verify migration state before retrying."],
} as const;

type DiagnosticStage = keyof typeof diagnosticStages;

// Allowlisted codes and constant descriptions only. Driver messages, assertion
// diffs, error details and stacks can contain credentials or private data.
const safeErrors = new Map<string, string>([
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
  const known = typeof candidate === "string" ? safeErrors.get(candidate) : undefined;
  const [fallbackCode, fallbackDetail] = diagnosticStages[stage];
  return { stage, code: known ? candidate : fallbackCode, detail: known ?? fallbackDetail };
}

async function main(stage: (value: DiagnosticStage) => void) {
  const action = process.env.MIOPAGES_WP_SCHEMA_ACTION;
  const probeRole = action === "probe-pull-session" ? pullRole : action === "probe-operator-session" ? operatorRole : null;
  const fixtureOperation = action === "create-rehearsal-fixture" ? "create" : action === "verify-rehearsal-fixture" ? "verify" : null;
  const inventory = action === "inventory-private-stage";
  if (!fixtureOperation && !inventory && !probeRole && action !== "apply-private-stage" && action !== "preflight-private-stage") {
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
      await integratePrivateStage(db);
      await db.query("COMMIT");
      console.log(JSON.stringify({ privateStageMigrations: migrations.length, verified: true }));
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
