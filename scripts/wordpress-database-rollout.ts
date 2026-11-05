import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, lstat, mkdir, open, readFile, realpath, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { protectedPool, verifyProtectedSession } from "../lib/platform/wordpress-delivery/protected-connection";
import { assertBackupRoot } from "./backup/policy";
import { privateStageDiagnostic } from "./db/wordpress-private-stage";

const exec = promisify(execFile);
export const rolloutStages = ["backup", "recovery-verify", "roles-create", "roles-verify", "migrate", "grants-verify", "operator-probe", "pull-probe"] as const;
export type RolloutStage = typeof rolloutStages[number];
const roles = ["miopages_wp_operator", "miopages_wp_pull"];
type Receipt = Record<string, unknown>;
type Environment = Record<string, string | undefined>;

// Return only fixed, verified evidence. Never copy arbitrary child output to logs.
export function checkedReceipt(stage: RolloutStage, value: Receipt): Receipt {
  const expect = (fields: Receipt) => { for (const [key, expected] of Object.entries(fields)) assert.deepEqual(value[key], expected); return fields; };
  switch (stage) {
    case "backup": return expect({ recoveryPointCreated: true, bundleVerified: true, canonicalMigrations: 16 });
    case "recovery-verify": return expect({ recoveryVerified: true, canonicalMigrations: 16 });
    case "roles-create":
    case "roles-verify": return expect({ verified: true, roles: roles.map(role => ({ role, restricted: true })),
      ...(stage === "roles-create" ? { created: 2, recoveryVerified: true } : { readOnly: true }) });
    case "migrate": return expect({ privateStageMigrations: 2, verified: true });
    case "grants-verify": return expect({ readOnly: true, privateStageMigrations: 2, checksumsVerified: true, grantsVerified: true, verified: true });
    case "operator-probe":
    case "pull-probe": return expect({ role: roles[stage === "operator-probe" ? 0 : 1], verifiedTls: true, sessionVerified: true });
  }
}

export async function databaseSequence(run: (stage: RolloutStage) => Promise<Receipt>, record: (stage: RolloutStage, receipt: Receipt) => Promise<void>) {
  for (const stage of rolloutStages) await record(stage, checkedReceipt(stage, await run(stage)));
}

export function sessionUrl(host: string, project: string, database: string, role: string, password: string) {
  assert.match(host, /^[a-z0-9-]+\.pooler\.supabase\.com$/);
  assert.match(project, /^[a-z0-9]{1,63}$/);
  assert.match(database, /^[A-Za-z0-9_-]+$/);
  assert.match(role, /^[a-z_][a-z0-9_]{0,62}$/);
  assert.ok(password.length > 0);
  const url = new URL(`postgresql://${host}:5432/${database}?sslmode=verify-full`);
  url.username = role + "." + project;
  url.password = encodeURIComponent(password);
  return url.toString();
}

// No inherited DATABASE_URL, provider/migration secrets, PGOPTIONS or NODE_OPTIONS.
export function childEnvironment(parent: Environment, common: Environment, scoped: Environment) {
  const env: NodeJS.ProcessEnv = { NODE_ENV: "production" };
  for (const name of ["PATH", "HOME", "TMPDIR", "LD_LIBRARY_PATH", "LANG", "LC_ALL"]) if (parent[name]) env[name] = parent[name];
  return { ...env, ...common, ...scoped };
}

const backupCode = `
const assert = require('node:assert/strict');
const {managedBackup} = require('./scripts/backup/managed.ts');
const {protectedPool,verifyProtectedSession} = require('./lib/platform/wordpress-delivery/protected-connection.ts');
(async()=>{
 const e=process.env;
 const pool=protectedPool(e.MIOPAGES_WP_BACKUP_URL,'miopages_backup',e.MIOPAGES_WP_DATABASE_CA);
 try { const c=await pool.connect(); try {await verifyProtectedSession(c,'miopages_backup',e.MIOPAGES_WP_EXPECTED_DATABASE);} finally {c.release();} } finally {await pool.end();}
 const bundle=await managedBackup({mode:'managed-postgres',root:e.MIOPAGES_WP_RECOVERY_ROOT,databaseUrl:e.MIOPAGES_WP_BACKUP_URL,objectsRoot:e.MIOPAGES_WP_OBJECTS_ROOT,pgBin:e.PG_BIN_DIR,repository:process.cwd(),roles:{runtime:'miopages_runtime',migration:'miopages_migration',backup:'miopages_backup'}});
 assert.equal(bundle.state.migrations.length,16);
 console.log(JSON.stringify({recoveryPointCreated:true,bundleVerified:true,canonicalMigrations:16}));
})().catch(error=>{console.error(JSON.stringify(require('./scripts/db/wordpress-private-stage.ts').privateStageDiagnostic('adapter_validation',error)));process.exitCode=1;});`;
const verifyCode = `
const assert=require('node:assert/strict');
require('./scripts/backup/managed.ts').verifyManagedBundle(process.env.MIOPAGES_WP_RECOVERY_ROOT).then(b=>{
 assert.equal(b.state.migrations.length,16);
 console.log(JSON.stringify({recoveryVerified:true,canonicalMigrations:16}));
}).catch(()=>{console.error('Recovery verification failed; stop before database writes.');process.exitCode=1;});`;

async function main() {
  let stage: string = "configuration";
  let runRoot: string | undefined;
  const gates: { stage: RolloutStage; receipt: Receipt }[] = [];
  const evidence: Record<string, unknown> = { status: "BLOCKED", gates };
  const saveEvidence = async () => {
    if (!runRoot) return;
    const temporary = path.join(runRoot, "evidence.tmp");
    await writeFile(temporary, JSON.stringify(evidence, null, 2) + "\n", { mode: 0o600 });
    await rename(temporary, path.join(runRoot, "database-rollout-evidence.json"));
  };
  try {
    const e = process.env;
    const required = (name: string) => { assert.ok(e[name]); return e[name]!; };
    assert.equal(process.platform, "linux");
    assert.equal(required("WP_DB_STORAGE_APPROVAL"), "private-file-0600");
    const home = path.resolve(required("HOME"));
    const repository = await realpath(process.cwd());
    assert.equal(repository, "/home/virtual/vps-bef564/5/53b4381d42/miopages-wp-rehearsal");
    await exec("git", ["diff", "--exit-code", "HEAD", "--", "scripts", "lib/platform"], { cwd: repository });
    evidence.sourceCommit = (await exec("git", ["rev-parse", "HEAD"], { cwd: repository })).stdout.trim();
    const expected = required("MIOPAGES_WP_EXPECTED_DATABASE");
    const owner = required("MIOPAGES_WP_PROVIDER_OWNER");
    assert.ok(!["miopages_runtime", "miopages_backup", "miopages_migration", ...roles].includes(owner));
    const url = (role: string, password: string) => sessionUrl(required("WP_DB_HOST"), required("WP_DB_PROJECT"), expected, role, password);
    const backupUrl = url("miopages_backup", required("WP_DB_BACKUP_PASSWORD"));
    const migrationUrl = url("miopages_migration", required("WP_DB_MIGRATION_PASSWORD"));
    const providerUrl = url(owner, required("WP_DB_PROVIDER_PASSWORD"));
    // Originals stay only in this temporary process and are never stored.
    delete e.WP_DB_BACKUP_PASSWORD; delete e.WP_DB_MIGRATION_PASSWORD; delete e.WP_DB_PROVIDER_PASSWORD;
    const caFile = required("MIOPAGES_WP_DATABASE_CA_FILE");
    assert.equal(e.NODE_EXTRA_CA_CERTS, caFile); assert.equal(e.PGSSLROOTCERT, caFile);
    const ca = await readFile(caFile, "utf8");
    const assets = await realpath(required("MIOPAGES_WP_OBJECTS_ROOT"));
    await access(assets);
    const pgBin = await realpath(required("PG_BIN_DIR"));
    for (const tool of ["pg_dump", "pg_restore"]) assert.match((await exec(path.join(pgBin, tool), ["--version"])).stdout, /PostgreSQL\) 17\./);
    const root = assertBackupRoot(required("WP_DB_RUN_ROOT"), [repository, path.join(home, "public_html"), assets, path.dirname(pgBin), path.join(home, ".config")]);
    assert.equal(await realpath(path.dirname(root)), path.dirname(root));
    await mkdir(root, { mode: 0o700 }); // Never reuse a partial run or overwrite saved credentials.
    runRoot = root;
    const rootStat = await lstat(root);
    assert.ok(rootStat.isDirectory() && !rootStat.isSymbolicLink() && (rootStat.mode & 0o077) === 0 && rootStat.uid === process.getuid!());
    const recoveryRoot = path.join(root, "recovery");
    const common = { MIOPAGES_WP_EXPECTED_DATABASE: expected, MIOPAGES_WP_DATABASE_CA: ca,
      NODE_EXTRA_CA_CERTS: caFile, PGSSLROOTCERT: caFile };
    const child = async (args: string[], scoped: Environment) => {
      try {
        const result = await exec(process.execPath, ["--import", "tsx", ...args], {
          cwd: repository, env: childEnvironment(e, common, scoped), timeout: 600000, maxBuffer: 1024 * 1024 });
        return JSON.parse(result.stdout.trim()) as Receipt;
      } catch (error) {
        // Existing CLIs have safe JSON diagnostics, but still allowlist the code.
        let code: unknown;
        try { code = JSON.parse(String((error as { stderr?: string }).stderr ?? "").trim()).code; } catch { /* No raw output. */ }
        throw Object.assign(new Error("Database rollout step refused or uncertain"), { code });
      }
    };
    stage = "migration-credential";
    const migrationPool = protectedPool(migrationUrl, "miopages_migration", ca);
    try { const c = await migrationPool.connect(); try { await verifyProtectedSession(c, "miopages_migration", expected); } finally { c.release(); } } finally { await migrationPool.end(); }
    stage = "provider-credential";
    const providerPool = protectedPool(providerUrl, owner, ca);
    try {
      const c = await providerPool.connect();
      try {
        const r = (await c.query(`SELECT session_user::text login,current_user::text actor,current_database() database,
          (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) tls,
          (SELECT rolcreaterole OR rolsuper FROM pg_roles WHERE rolname=current_user) can_create`)).rows[0];
        assert.ok(r?.login === owner && r.actor === owner && r.database === expected && r.tls && r.can_create);
      } finally { c.release(); }
    } finally { await providerPool.end(); }
    let operatorUrl = "", pullUrl = "";
    await databaseSequence(async next => {
      stage = next;
      switch (next) {
        case "backup": return child(["-e", backupCode], { MIOPAGES_WP_BACKUP_URL: backupUrl, MIOPAGES_WP_RECOVERY_ROOT: recoveryRoot, MIOPAGES_WP_OBJECTS_ROOT: assets, PG_BIN_DIR: pgBin });
        case "recovery-verify": return child(["-e", verifyCode], { MIOPAGES_WP_RECOVERY_ROOT: recoveryRoot });
        case "roles-create": {
          const operatorPassword = randomBytes(32).toString("hex"), pullPassword = randomBytes(32).toString("hex");
          operatorUrl = url(roles[0], operatorPassword); pullUrl = url(roles[1], pullPassword);
          const credentials = { operator: { role: roles[0], password: operatorPassword, url: operatorUrl }, pull: { role: roles[1], password: pullPassword, url: pullUrl } };
          const file = path.join(root, "wordpress-role-credentials.json");
          const handle = await open(file, "wx", 0o600);
          try { await handle.writeFile(JSON.stringify(credentials) + "\n"); await handle.sync(); } finally { await handle.close(); }
          const saved = await lstat(file);
          assert.ok(saved.isFile() && !saved.isSymbolicLink() && (saved.mode & 0o077) === 0 && saved.uid === process.getuid!());
          assert.deepEqual(JSON.parse(await readFile(file, "utf8")), credentials);
          const directory = await open(root, "r");
          try { await directory.sync(); } finally { await directory.close(); }
          return child(["scripts/provision-wordpress-roles.ts"], { MIOPAGES_WP_ROLE_ACTION: "create", MIOPAGES_WP_PROVIDER_OWNER: owner,
            MIOPAGES_WP_PROVIDER_URL: providerUrl, MIOPAGES_WP_OPERATOR_PASSWORD: operatorPassword, MIOPAGES_WP_PULL_PASSWORD: pullPassword, MIOPAGES_WP_RECOVERY_ROOT: recoveryRoot });
        }
        case "roles-verify": return child(["scripts/provision-wordpress-roles.ts"], { MIOPAGES_WP_ROLE_ACTION: "verify", MIOPAGES_WP_MIGRATION_URL: migrationUrl });
        case "migrate":
        case "grants-verify": return child(["scripts/db/wordpress-private-stage.ts"], { MIOPAGES_WP_SCHEMA_ACTION: next === "migrate" ? "apply-private-stage" : "verify-private-stage", MIOPAGES_WP_MIGRATION_URL: migrationUrl });
        case "operator-probe": return child(["scripts/db/wordpress-private-stage.ts"], { MIOPAGES_WP_SCHEMA_ACTION: "probe-operator-session", MIOPAGES_WP_OPERATOR_URL: operatorUrl });
        case "pull-probe": return child(["scripts/db/wordpress-private-stage.ts"], { MIOPAGES_WP_SCHEMA_ACTION: "probe-pull-session", MIOPAGES_WP_PULL_URL: pullUrl });
      }
    }, async (next, receipt) => { gates.push({ stage: next, receipt }); await saveEvidence(); console.log(JSON.stringify({ stage: next, ...receipt })); });
    evidence.status = "PASS";
    evidence.nextBoundary = "Database-only setup complete; Core listener and WordPress deployment require separate approval.";
    await saveEvidence();
    console.log(JSON.stringify({ status: "PASS", evidence: path.join(root, "database-rollout-evidence.json"), credentialsStored: true, recoveryRetained: true }));
  } catch (error) {
    const diagnostic = privateStageDiagnostic("adapter_validation", error);
    evidence.failedStage = stage; evidence.code = diagnostic.code;
    evidence.requirement = "Stop. Preserve recovery and saved credentials. An uncertain write requires independent verification before any retry; never reset or recreate existing roles.";
    await saveEvidence().catch(() => {});
    console.error(JSON.stringify(evidence));
    process.exitCode = 1;
  }
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/wordpress-database-rollout.ts")) void main();
