import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { lstat, readFile, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { checkServerIdentity } from "node:tls";
import { Pool } from "pg";
import { protectedPool, protectedConnection } from "../../lib/platform/wordpress-delivery/protected-connection";

const role = "miopages_core_development";
const homeExpected = "/home/virtual/vps-bef564/5/53b4381d42";
const presence = "819d007a-595d-4374-a2f0-96b900d46559";
const site = "1d92a248-416f-4e22-baaf-d2f1fca70352";
let stage = "protected-inputs";

async function main() {
  const home = await realpath(process.env.HOME ?? "");
  assert.equal(home, homeExpected);
  const password = process.env.MIOPAGES_PROVIDER_PASSWORD;
  const migrationPassword = process.env.MIOPAGES_MIGRATION_PASSWORD;
  delete process.env.MIOPAGES_PROVIDER_PASSWORD;
  delete process.env.MIOPAGES_MIGRATION_PASSWORD;
  assert.ok(password && migrationPassword);
  const recovery = join(home, "miopages-wp-db-20261105T181534Z");
  const recoveryEvidence = JSON.parse(await readFile(join(recovery, "database-rollout-evidence.json"), "utf8"));
  assert.equal(recoveryEvidence.status, "PASS");
  assert.equal(recoveryEvidence.recovery?.verified, true);
  const credentialFile = join(recovery, "wordpress-role-credentials.json");
  const metadata = await lstat(credentialFile);
  assert.ok(metadata.isFile() && metadata.uid === process.getuid?.() && (metadata.mode & 0o777) === 0o600);
  const url = new URL(JSON.parse(await readFile(credentialFile, "utf8")).operator.url);
  assert.equal(url.hostname, "aws-0-us-east-1.pooler.supabase.com");
  assert.equal(url.port, "5432");
  assert.equal(url.pathname, "/postgres");
  assert.equal(url.search, "?sslmode=verify-full");
  const login = /^miopages_wp_operator\.([a-z0-9]+)$/.exec(url.username);
  assert.ok(login);
  const ca = await readFile(join(home, "supabase-ca.crt"), "utf8");
  const sql = await readFile("lib/platform/intake/protected-core-policy.sql", "utf8");
  const runtime = new URL(url);
  const migrationUrl = new URL(url);
  migrationUrl.username = "miopages_migration." + login[1];
  migrationUrl.password = encodeURIComponent(migrationPassword);
  const runtimePassword = randomBytes(32).toString("hex");
  runtime.username = role + "." + login[1];
  runtime.password = runtimePassword;
  const token = randomBytes(32).toString("hex");
  const principal = randomUUID();
  url.username = "postgres." + login[1];
  url.password = encodeURIComponent(password);
  url.search = "";
  const admin = new Pool({ connectionString: url.href, ssl: { ca, rejectUnauthorized: true,
    checkServerIdentity: (_name, cert) => checkServerIdentity(url.hostname, cert) }, max: 1, connectionTimeoutMillis: 5000 });
  const migration = protectedPool(migrationUrl.href, "miopages_migration", ca);
  stage = "provider-login";
  let committed = false;
  try {
    const db = await admin.connect();
    try {
      const identity = (await db.query(`SELECT session_user AS login,current_user AS actor,current_database() AS database,
        (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls,rolcreaterole FROM pg_roles WHERE rolname=current_user`)).rows[0];
      assert.deepEqual(identity, { login: "postgres", actor: "postgres", database: "postgres", tls: true, rolcreaterole: true });
      stage = "migration-login";
      const owner = await migration.connect();
      try {
        await protectedConnection(owner, "miopages_migration", "postgres");
        const privileges = (await owner.query(`SELECT has_schema_privilege(current_user,'miopages_wp','CREATE') AS schema_create,
          has_database_privilege(current_user,current_database(),'CREATE') AS database_create`)).rows[0];
        assert.deepEqual(privileges, { schema_create: true, database_create: true });
        await owner.query("BEGIN");
      stage = "role-and-scope";
      await db.query("BEGIN");
      await db.query("SELECT pg_advisory_xact_lock(hashtext('miopages-protected-core-provisioning'))");
      assert.equal((await db.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role])).rowCount, 0);
      const fixture = await owner.query(`SELECT 1 FROM public.activation_customer_bindings b
        JOIN public.managed_sites m ON m.id=b.managed_site_id JOIN public.web_presences w ON w.id=b.web_presence_id
        JOIN public.organizations o ON o.id=b.organization_id
        WHERE b.web_presence_id=$1 AND b.managed_site_id=$2 AND m.status='inactive' AND w.status='inactive' AND o.status='inactive'`, [presence, site]);
      assert.equal(fixture.rowCount, 1);
      // The generated password is hex and does not contain SQL syntax.
      await db.query(`CREATE ROLE ${role} NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);
      await db.query("COMMIT");
      committed = true;
      await owner.query(sql);
      const permissions = (await owner.query(`SELECT has_table_privilege($1,'public.prospect_intakes','SELECT,INSERT,UPDATE,DELETE') AS drafts,
        has_table_privilege($1,'miopages_wp.wordpress_operator_credentials','SELECT,INSERT,UPDATE,DELETE') AS credentials,
        has_table_privilege($1,'public.managed_sites','SELECT,INSERT,UPDATE,DELETE') AS canonical`, [role])).rows[0];
      assert.deepEqual(permissions, { drafts: false, credentials: false, canonical: false });
      await owner.query("INSERT INTO miopages_wp.wordpress_operator_credentials(id,token_sha256,expires_at) VALUES($1,$2,clock_timestamp()+interval '24 hours')",
        [principal, createHash("sha256").update(Buffer.from(token, "hex")).digest("hex")]);
      for (const permission of ["inspect-site-proposal", "prepare-site-proposal"]) {
        await owner.query(`INSERT INTO miopages_wp.wordpress_operator_grants(id,operator_id,web_presence_id,managed_site_id,permission)
          VALUES($1,$2,$3,$4,$5)`, [randomUUID(), principal, presence, site, permission]);
      }
      stage = "protected-custody";
      const output = join(home, "miopages-protected-core-custody.json");
      await writeFile(output, JSON.stringify({ databaseUrl: runtime.href, operatorToken: token, principal }), { mode: 0o600, flag: "wx" });
      await owner.query("COMMIT");
      await db.query(`ALTER ROLE ${role} LOGIN PASSWORD '${runtimePassword}'`);
      } catch (error) { await owner.query("ROLLBACK"); throw error; }
      finally { owner.release(); }
    } catch (error) { await db.query("ROLLBACK"); throw error; }
    finally { db.release(); }
    stage = "independent-role-session";
    const restricted = protectedPool(runtime.href, role, ca);
    try {
      const db = await restricted.connect();
      try {
        await protectedConnection(db, role, "postgres");
        assert.equal((await db.query("SELECT 1 FROM miopages_wp.core_development_scope")).rowCount, 1);
        assert.equal((await db.query("SELECT 1 FROM miopages_wp.core_development_grants WHERE operator_id=$1", [principal])).rowCount, 2);
      } finally { db.release(); }
    } finally { await restricted.end(); }
    console.log(JSON.stringify({ status: "PASS", stage, role, principal }));
  } catch (error) {
    console.error(JSON.stringify({ status: "BLOCKED", stage, committed, code: (error as { code?: string }).code ?? "VALIDATION" }));
    process.exitCode = 1;
  } finally { await Promise.all([admin.end(), migration.end()]); }
}

main().catch(() => { console.error(JSON.stringify({ status: "BLOCKED", stage })); process.exitCode = 1; });
