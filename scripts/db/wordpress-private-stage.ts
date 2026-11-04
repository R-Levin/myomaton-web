import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { PoolClient } from "pg";
import { bootstrapStatus } from "./bootstrap";
import { adapterSchema, migrationRole, operatorRole, protectedConnection, protectedPool, pullRole } from "../../lib/platform/wordpress-delivery/protected-connection";
import { privateStageSource, privateStageProposalTables } from "../../lib/platform/wordpress-delivery/permissions";
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

async function main() {
  if (process.env.MIOPAGES_WP_SCHEMA_ACTION !== "apply-private-stage") throw Error("Explicit schema operation required");
  const pool = protectedPool(process.env.MIOPAGES_WP_MIGRATION_URL ?? "", migrationRole, process.env.MIOPAGES_WP_DATABASE_CA);
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await protectedConnection(db, migrationRole);
    const expected = process.env.MIOPAGES_WP_EXPECTED_DATABASE;
    const actual = (await db.query("SELECT current_database() AS name")).rows[0].name;
    if (!expected || expected !== actual) throw Error("Explicit rehearsal database identity required");
    await db.query("SET LOCAL search_path=public");
    const baseline = await bootstrapStatus(db);
    if (baseline.pending || baseline.applied !== 16) throw Error("Exact canonical migration baseline required");
    await integratePrivateStage(db);
    await db.query("COMMIT");
    console.log(JSON.stringify({ privateStageMigrations: migrations.length, verified: true }));
  } catch (error) { await db.query("ROLLBACK"); throw error; }
  finally { db.release(); await pool.end(); }
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/db/wordpress-private-stage.ts")) {
  main().catch(() => { console.error("Private-stage migration refused or failed. Verify state before retry."); process.exitCode = 1; });
}
