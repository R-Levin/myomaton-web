import assert from "node:assert/strict";
import { writeFile, readFile, lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import { readMigrationFiles } from "drizzle-orm/migrator";
import ownership from "./application-ownership.json";
import { recoveryCatalog, type RecoveryCatalog } from "./catalog";
import { native, connectionEnv, hashFile, safeFile, openRoot, type Config } from "./core";
import { fingerprint } from "../../lib/platform/canonical/model";
import { readManagedObject, provisionManagedObject } from "../../lib/platform/assets/local-storage";
import { bootstrapStatus } from "../db/bootstrap";

export type Roles = { runtime: string; migration: string; backup: string };
export type ManagedConfig = Config & { mode: "managed-postgres"; roles: Roles };
const q = (s: string) => '"' + s.replaceAll('"', '""') + '"';
const qualified = (s: string) => s.split(".").map(q).join(".");
const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";
export function supportedMajor(version: number) { assert.ok([17, 18].includes(version), "Only PostgreSQL 17/18 are supported"); return version; }
export function versionPolicy(source: number, dump: number, target = source, restore = target) {
  [source, dump, target, restore].forEach(supportedMajor);
  assert.equal(dump, source, "pg_dump must match source major");
  assert.equal(restore, target, "pg_restore must match target major");
  assert.ok(target >= source, "Cross-major downgrade is unsupported");
}
async function binaryMajor(bin: string, command: string) {
  const result = await native(bin, command, ["--version"]);
  const match = /PostgreSQL\) (\d+)\./.exec(result); assert.ok(match); return +match[1];
}
function identity(row: Record<string, unknown>) { return `${row.nspname}.${row.relname}`; }
// Only this managed-mode projection bridges the PG17/18 NOT NULL catalog change.
// attnotnull still verifies every column; controlled-cluster comparison is untouched.
export function applicationSemantic(catalog: RecoveryCatalog) {
  const tables = new Set([...ownership.tables, ...ownership.sequences]);
  const functions = new Set(ownership.functions);
  const output: Record<string, Record<string, unknown>[]> = {};
  for (const [key, rows] of Object.entries(catalog.semantic)) {
    if (key === "extensions") continue; // separately verified provider dependencies
    if (key === "schemas") output[key] = rows.filter(r => ownership.schemas.includes(String(r.name)));
    else if (key === "functions") output[key] = rows.filter(r => functions.has(`${r.nspname}.${r.proname}`));
    else if (key === "policies") output[key] = rows.filter(r => tables.has(`${r.schemaname}.${r.tablename}`));
    else output[key] = rows.filter(r => tables.has(identity(r)) && !(key === "constraints" && r.contype === "n"));
  }
  return output;
}
// Validate without normalizing: every recorded locale field remains exact recovery
// identity, including ICU locale spelling and the provider's collation version.
export function assertManagedLocale(locale: Record<string, unknown>) {
  assert.equal(locale.encoding, "UTF8");
  assert.ok(locale.datlocprovider === "c" || locale.datlocprovider === "i", "Only libc and ICU locale providers are supported");
  for (const field of ["datcollate", "datctype"]) assert.ok(typeof locale[field] === "string" && locale[field].length > 0, `Missing ${field}`);
  if (locale.datlocprovider === "i") {
    assert.ok(typeof locale.datlocale === "string" && locale.datlocale.length > 0, "ICU locale required");
    assert.ok(typeof locale.datcollversion === "string" && locale.datcollversion.length > 0, "ICU collation version required");
  } else {
    assert.equal(locale.datlocale, null, "libc uses datcollate/datctype rather than datlocale");
    assert.ok(locale.datcollversion === null || typeof locale.datcollversion === "string", "Invalid libc collation version");
  }
}
export async function managedDependencies(c: Pick<PoolClient, "query">, url: string) {
  const major = supportedMajor(Math.floor(Number((await c.query("SHOW server_version_num")).rows[0].server_version_num) / 10000));
  const u = new URL(url), local = ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname);
  if (!local) { assert.equal(u.searchParams.get("sslmode"), "verify-full", "Remote managed connections require verify-full"); assert.equal((await c.query("SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()")).rows[0]?.ssl, true); }
  const extension = (await c.query("SELECT extversion FROM pg_extension WHERE extname='plpgsql'")).rows[0]; assert.ok(extension, "Provider must supply plpgsql");
  assert.ok((await c.query("SELECT to_regprocedure('pg_catalog.gen_random_uuid()') name")).rows[0].name, "Provider UUID capability missing");
  assert.equal((await c.query("SELECT ('{\"a\":1}'::jsonb @> '{\"a\":1}'::jsonb) ok")).rows[0].ok, true);
  assert.equal((await c.query("SHOW TimeZone")).rows[0].TimeZone, "UTC");
  const { daticurules, ...locale } = (await c.query("SELECT pg_encoding_to_char(encoding) encoding,datlocprovider,datcollate,datctype,datlocale,datcollversion,daticurules FROM pg_database WHERE datname=current_database()")).rows[0];
  assertManagedLocale(locale);
  // Custom ICU rules are outside the existing six-field identity contract.
  if (locale.datlocprovider === "i") assert.equal(daticurules, null, "Custom ICU collation rules require a separate recovery contract");
  return { major, plpgsql: extension.extversion, capabilities: ["plpgsql", "jsonb", "gen_random_uuid", "advisory-locks", "deferred-triggers"], locale, timezone: "UTC", transport: local ? "loopback-test" : "tls-verify-full" };
}
async function privileges(c: PoolClient, roles: Roles) {
  assert.equal(new Set(Object.values(roles)).size, 3, "Three distinct application roles required");
  const result: unknown[] = [];
  for (const [kind, role] of Object.entries(roles)) {
    const flags = (await c.query("SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=$1", [role])).rows[0]; assert.ok(flags);
    assert.ok(Object.values(flags).every(v => v === false), "Application roles must not have provider administration flags");
    assert.equal((await c.query("SELECT count(*)::int n FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=$1)", [role])).rows[0].n, 0, "Inherited/settable role membership unsupported");
    assert.equal((await c.query("SELECT has_database_privilege($1,current_database(),'CREATE') ok", [role])).rows[0].ok, kind === "migration", "Only the migration role may create application schemas");
    const schemas = [];
    for (const schema of ownership.schemas) { const row = (await c.query("SELECT has_schema_privilege($1,$2,'USAGE') can_use,has_schema_privilege($1,$2,'CREATE') can_create", [role, schema])).rows[0]; assert.equal(row.can_use, true); assert.equal(row.can_create, kind === "migration"); schemas.push({ schema, ...row }); }
    const tables = [];
    for (const table of ownership.tables) {
      const row: Record<string, boolean> = {};
      for (const perm of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]) {
        const granted = (await c.query("SELECT has_table_privilege($1,$2,$3) ok", [role, table, perm])).rows[0].ok;
        const expected = kind === "migration" || perm === "SELECT" || kind === "runtime" && table !== "drizzle.__drizzle_migrations" && ["INSERT", "UPDATE", "DELETE"].includes(perm);
        assert.equal(granted, expected, `${kind} ${table} ${perm} differs`); row[perm] = granted;
      }
      for (const perm of ["INSERT", "UPDATE", "REFERENCES"]) { const granted = (await c.query("SELECT has_any_column_privilege($1,$2,$3) ok", [role, table, perm])).rows[0].ok; assert.equal(granted, kind === "migration" || kind === "runtime" && table !== "drizzle.__drizzle_migrations" && perm !== "REFERENCES"); }
      tables.push({ table, privileges: row });
    }
    const sequences = [];
    for (const sequence of ownership.sequences) { const row: Record<string, boolean> = {}; for (const perm of ["SELECT", "USAGE", "UPDATE"]) { row[perm] = (await c.query("SELECT has_sequence_privilege($1,$2,$3) ok", [role, sequence, perm])).rows[0].ok; assert.equal(row[perm], kind === "migration" || kind === "backup" && perm === "SELECT"); } sequences.push({ sequence, ...row }); }
    const functions = [];
    for (const fn of ownership.functions) { const execute = (await c.query("SELECT has_function_privilege($1,$2,'EXECUTE') ok", [role, fn + "()"]) ).rows[0].ok; assert.equal(execute, kind !== "backup"); functions.push({ fn, execute }); }
    const providerFunctions = [];
    if (kind === "runtime") for (const fn of ["pg_catalog.gen_random_uuid()", "pg_catalog.hashtextextended(text,bigint)", "pg_catalog.pg_advisory_lock(bigint)", "pg_catalog.pg_advisory_unlock(bigint)", "pg_catalog.pg_advisory_xact_lock(bigint)"]) { const execute = (await c.query("SELECT has_function_privilege($1,$2,'EXECUTE') ok", [role, fn])).rows[0].ok; assert.equal(execute, true, "Required provider execution capability missing"); providerFunctions.push({ fn, execute }); }
    result.push({ kind, flags, schemas, tables, sequences, functions, providerFunctions });
  }
  const relations = (await c.query("SELECT n.nspname,c.relname,pg_get_userbyid(c.relowner) owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE (n.nspname||'.'||c.relname)=ANY($1)", [[...ownership.tables, ...ownership.sequences]])).rows;
  assert.equal(relations.length, ownership.tables.length + ownership.sequences.length);
  assert.ok(relations.every(r => r.owner === roles.migration), "Application relations require migration-role ownership");
  const fns = (await c.query("SELECT n.nspname,p.proname,pg_get_userbyid(p.proowner) owner,p.prosecdef,p.proconfig,pg_get_function_identity_arguments(p.oid) arguments FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname||'.'||p.proname)=ANY($1) ORDER BY p.proname", [ownership.functions])).rows;
  assert.equal(fns.length, ownership.functions.length); assert.ok(fns.every(f => f.owner === roles.migration && f.arguments === "" && f.prosecdef === false && f.proconfig === null));
  const acl = (await c.query(`SELECT n.nspname||'.'||r.relname object,'' field,a.grantee,a.grantor,a.privilege_type,a.is_grantable FROM pg_class r JOIN pg_namespace n ON n.oid=r.relnamespace CROSS JOIN LATERAL aclexplode(r.relacl) a WHERE (n.nspname||'.'||r.relname)=ANY($1)
    UNION ALL SELECT n.nspname||'.'||r.relname,col.attname,a.grantee,a.grantor,a.privilege_type,a.is_grantable FROM pg_attribute col JOIN pg_class r ON r.oid=col.attrelid JOIN pg_namespace n ON n.oid=r.relnamespace CROSS JOIN LATERAL aclexplode(col.attacl) a WHERE (n.nspname||'.'||r.relname)=ANY($1)
    UNION ALL SELECT n.nspname||'.'||p.proname,'()',a.grantee,a.grantor,a.privilege_type,a.is_grantable FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE (n.nspname||'.'||p.proname)=ANY($2)`, [[...ownership.tables, ...ownership.sequences], ownership.functions])).rows;
  const roleRows = (await c.query("SELECT oid,rolname FROM pg_roles WHERE rolname=ANY($1)", [Object.values(roles)])).rows;
  const roleName = (oid: number) => roleRows.find(r => r.oid === oid)?.rolname;
  const edges = acl.map(a => { const name = roleName(a.grantee); assert.ok(name, "Unowned/PUBLIC application ACL grant"); assert.equal(roleName(a.grantor), roles.migration, "Unreviewed application ACL grantor"); assert.ok(name === roles.migration || a.is_grantable === false, "Application privilege delegation refused"); return { object: a.object, field: a.field, kind: Object.entries(roles).find(([, value]) => value === name)![0], privilege: a.privilege_type, grantable: a.is_grantable }; }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  result.push({ applicationAcl: edges });
  return result;
}
export async function managedSnapshot(c: PoolClient, url: string, roles: Roles) {
  await c.query("SET LOCAL search_path=public"); await c.query("SET LOCAL TIME ZONE 'UTC'");
  const provider = await managedDependencies(c, url), security = await privileges(c, roles), catalog = await recoveryCatalog(c, ownership.schemas);
  const semantic = applicationSemantic(catalog), tables = [], sequences = [];
  for (const table of ownership.tables) { const rows = (await c.query(`SELECT to_jsonb(t) row FROM ${qualified(table)} t ORDER BY to_jsonb(t)::text`)).rows.map(r => r.row); tables.push({ table, count: rows.length, hash: fingerprint(rows) }); }
  for (const sequence of ownership.sequences) sequences.push({ sequence, ...(await c.query(`SELECT last_value::text,is_called FROM ${qualified(sequence)}`)).rows[0] });
  assert.equal(semantic.relations.length, ownership.tables.length + ownership.sequences.length);
  assert.ok(semantic.relations.every(r => r.relrowsecurity === false), "RLS-enabled application objects require a separate recovery contract");
  assert.equal(semantic.functions.length, ownership.functions.length);
  const foreign = (await c.query("SELECT c.conname FROM pg_constraint c WHERE c.contype='f' AND c.conrelid=ANY($1::regclass[]) AND NOT c.confrelid=ANY($1::regclass[])", [ownership.tables])).rows; assert.deepEqual(foreign, [], "Unowned foreign-key dependency");
  const triggerDeps = (await c.query("SELECT n.nspname||'.'||p.proname fn FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE NOT t.tgisinternal AND t.tgrelid=ANY($1::regclass[])", [ownership.tables])).rows; assert.ok(triggerDeps.every(r => ownership.functions.includes(r.fn)), "Unowned trigger dependency");
  const migrations = (await c.query("SELECT hash,created_at::text FROM drizzle.__drizzle_migrations ORDER BY id")).rows;
  const expected = readMigrationFiles({ migrationsFolder: "lib/platform/db/migrations" }); assert.equal(expected.length, 16, "Ownership contract requires review for new migrations");
  assert.deepEqual(migrations, expected.map(m => ({ hash: m.hash, created_at: String(m.folderMillis) })));
  const bootstrap = await bootstrapStatus(c, expected); assert.equal(bootstrap.pending, 0);
  const media = (await c.query("SELECT id,web_presence_id,source_reference FROM assets WHERE source_type='managed' ORDER BY id")).rows;
  return { provider, semantic, security, tables, sequences, migrations, media, bootstrapReceipt: bootstrap.receipt };
}
export type ManagedState = Awaited<ReturnType<typeof managedSnapshot>>;
export function assertManagedEquivalent(source: ManagedState, target: ManagedState) {
  assertManagedLocale(source.provider.locale); assertManagedLocale(target.provider.locale);
  versionPolicy(source.provider.major, source.provider.major, target.provider.major, target.provider.major);
  assert.deepEqual(target.provider.locale, source.provider.locale, "Provider locale differs");
  assert.equal(target.provider.plpgsql, source.provider.plpgsql); assert.deepEqual(target.provider.capabilities, source.provider.capabilities);
  for (const key of ["semantic", "security", "tables", "sequences", "migrations", "media", "bootstrapReceipt"] as const) assert.deepEqual(target[key], source[key], `Managed application ${key} differs`);
}
async function snapshot(config: ManagedConfig, callback?: (c: PoolClient, state: ManagedState) => Promise<void>) {
  assert.equal(config.mode, "managed-postgres", "Explicit recovery mode required");
  const pool = new Pool({ connectionString: config.databaseUrl }); const c = await pool.connect();
  try { await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"); const state = await managedSnapshot(c, config.databaseUrl, config.roles); if (callback) await callback(c, state); return state; }
  finally { await c.query("ROLLBACK"); c.release(); await pool.end(); }
}
export async function managedBackup(config: ManagedConfig) {
  assert.equal(config.mode, "managed-postgres", "Explicit recovery mode required");
  // Reuse private-root/reparse/ACL controls, but never infer managed mode from a
  // controlled-cluster failure. A dedicated empty bundle root is required.
  await openRoot(config, true); assert.deepEqual((await readdir(config.root)).sort(), ["backup-root.json"]);
  const archive = path.join(config.root, "application.dump");
  const objects: { owner: string; key: string; file: string; sha256: string; size: number }[] = [];
  const state = await snapshot(config, async (c, current) => {
    versionPolicy(current.provider.major, await binaryMajor(config.pgBin, "pg_dump"));
    const token = (await c.query("SELECT pg_export_snapshot() token")).rows[0].token;
    await native(config.pgBin, "pg_dump", ["--no-password", "--format=custom", "--no-owner", "--no-privileges", `--snapshot=${token}`, `--file=${archive}`, ...[...ownership.tables, ...ownership.sequences].map(t => `--table=${t}`)], connectionEnv(config.databaseUrl, true));
    // pg_dump -t intentionally omits dependency functions. They are separately
    // selected by the explicit inventory, never by all of public/provider schemas.
    const functions = current.semantic.functions.map(f => String(f.definition));
    await writeFile(path.join(config.root, "functions.sql"), functions.map(f => f.trimEnd() + ";\n").join("\n"), { flag: "wx", mode: 0o600 });
    for (const item of current.media) { const owner = String(item.web_presence_id), key = String(item.source_reference), bytes = await readManagedObject(config.objectsRoot, owner, key); await provisionManagedObject(path.join(config.root, "objects"), owner, key, bytes); const file = `objects/${owner}/${key}`; objects.push({ owner, key, file, sha256: await hashFile(await safeFile(config.root, file)), size: bytes.length }); }
  });
  await writeFile(path.join(config.root, "manifest.json"), json({ kind: "miopages-managed-recovery/1", mode: config.mode, createdAt: new Date().toISOString(), ownership, state, objects }), { flag: "wx", mode: 0o600 });
  const files = ["application.dump", "functions.sql", "manifest.json", ...objects.map(o => o.file)];
  const checksums = Object.fromEntries(await Promise.all(files.map(async f => [f, await hashFile(await safeFile(config.root, f))])));
  await writeFile(path.join(config.root, "checksums.json"), json(checksums), { flag: "wx", mode: 0o600 });
  await writeFile(path.join(config.root, "COMPLETE"), json({ checksum: await hashFile(path.join(config.root, "checksums.json")) }), { flag: "wx", mode: 0o600 });
  return verifyManagedBundle(config.root);
}
export async function verifyManagedBundle(root: string) {
  const complete = JSON.parse(await readFile(await safeFile(root, "COMPLETE"), "utf8")); assert.equal(await hashFile(await safeFile(root, "checksums.json")), complete.checksum);
  const hashes = JSON.parse(await readFile(await safeFile(root, "checksums.json"), "utf8"));
  const manifest = JSON.parse(await readFile(await safeFile(root, "manifest.json"), "utf8")) as { kind: string; mode: string; ownership: typeof ownership; state: ManagedState; objects: { owner: string; key: string; file: string; sha256: string; size: number }[] };
  assert.equal(manifest.kind, "miopages-managed-recovery/1"); assert.equal(manifest.mode, "managed-postgres"); assert.deepEqual(manifest.ownership, ownership);
  assertManagedLocale(manifest.state.provider.locale);
  const expected = ["application.dump", "functions.sql", "manifest.json", ...manifest.objects.map(o => o.file)].sort(); assert.deepEqual(Object.keys(hashes).sort(), expected);
  for (const file of expected) assert.equal(await hashFile(await safeFile(root, file)), hashes[file], "Bundle checksum differs");
  for (const o of manifest.objects) { assert.equal(o.file, `objects/${o.owner}/${o.key}`); assert.equal(o.sha256, o.key.slice(8)); assert.equal(hashes[o.file], o.sha256); assert.equal((await lstat(await safeFile(root, o.file))).size, o.size); }
  assert.equal(manifest.objects.length, manifest.state.media.length);
  return manifest;
}
export async function restoreManagedBundle(root: string, target: ManagedConfig) {
  assert.equal(target.mode, "managed-postgres");
  assert.equal(new Set(Object.values(target.roles)).size, 3, "Three distinct target roles required");
  const source = await verifyManagedBundle(root);
  const pool = new Pool({ connectionString: target.databaseUrl });
  try {
    const c = await pool.connect(); try {
      await c.query("BEGIN READ ONLY"); await c.query("SET LOCAL TIME ZONE 'UTC'");
      const provider = await managedDependencies(c, target.databaseUrl); versionPolicy(source.state.provider.major, source.state.provider.major, provider.major, await binaryMajor(target.pgBin, "pg_restore"));
      assert.deepEqual(provider.locale, source.state.provider.locale); assert.equal(provider.plpgsql, source.state.provider.plpgsql);
      assert.equal((await c.query("SELECT current_user name")).rows[0].name, target.roles.migration);
      for (const role of Object.values(target.roles)) { const flags = (await c.query("SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=$1", [role])).rows[0]; assert.ok(flags); assert.ok(Object.values(flags).every(v => v === false), "Unreviewed target role authority"); }
      for (const table of [...ownership.tables, ...ownership.sequences]) assert.equal((await c.query("SELECT to_regclass($1) name", [table])).rows[0].name, null, "Restore requires an empty application namespace");
      for (const fn of ownership.functions) assert.equal((await c.query("SELECT to_regprocedure($1) name", [fn + "()"]) ).rows[0].name, null, "Restore refuses existing function identities");
    } finally { await c.query("ROLLBACK"); c.release(); }
    // Target provisioning/role creation is outside restore; only supplied app
    // migration credentials can create the reviewed application objects.
    const args = ["--no-password", "--exit-on-error", "--single-transaction", "--no-owner", "--no-privileges", "--dbname=" + decodeURIComponent(new URL(target.databaseUrl).pathname.slice(1))];
    // %ROWTYPE declarations require application table types before functions.
    // Restore data and post-data constraints/triggers only after those functions.
    await native(target.pgBin, "pg_restore", [...args, "--section=pre-data", await safeFile(root, "application.dump")], connectionEnv(target.databaseUrl, false));
    await pool.query(await readFile(await safeFile(root, "functions.sql"), "utf8"));
    await native(target.pgBin, "pg_restore", [...args, "--section=data", "--section=post-data", await safeFile(root, "application.dump")], connectionEnv(target.databaseUrl, false));
    await applyApplicationGrants(pool, target.roles);
  } finally { await pool.end(); }
  return source;
}
export async function applyApplicationGrants(pool: Pool, roles: Roles) {
  const runtime = q(roles.runtime), backup = q(roles.backup);
  for (const table of ownership.tables) {
    await pool.query(`REVOKE ALL ON TABLE ${qualified(table)} FROM PUBLIC,${runtime},${backup}`);
    await pool.query(`GRANT SELECT ON TABLE ${qualified(table)} TO ${runtime},${backup}`);
    if (table !== "drizzle.__drizzle_migrations") await pool.query(`GRANT INSERT,UPDATE,DELETE ON TABLE ${qualified(table)} TO ${runtime}`);
  }
  for (const sequence of ownership.sequences) { await pool.query(`REVOKE ALL ON SEQUENCE ${qualified(sequence)} FROM PUBLIC,${runtime},${backup}`); await pool.query(`GRANT SELECT ON SEQUENCE ${qualified(sequence)} TO ${backup}`); }
  for (const fn of ownership.functions) { await pool.query(`REVOKE ALL ON FUNCTION ${qualified(fn)}() FROM PUBLIC,${runtime},${backup}`); await pool.query(`GRANT EXECUTE ON FUNCTION ${qualified(fn)}() TO ${runtime}`); }
}
export async function verifyManagedRestore(root: string, target: ManagedConfig) {
  const source = await verifyManagedBundle(root), current = await snapshot(target);
  assertManagedEquivalent(source.state, current);
  for (const item of source.objects) { const bytes = await readManagedObject(target.objectsRoot, item.owner, item.key); assert.equal(bytes.length, item.size); const { createHash } = await import("node:crypto"); assert.equal(createHash("sha256").update(bytes).digest("hex"), item.sha256); }
  return { mode: "managed-postgres", verified: true, sourceMajor: source.state.provider.major, targetMajor: current.provider.major, migrations: current.migrations.length, objects: source.objects.length };
}
export async function restoreManagedMedia(root: string, targetRoot: string) {
  const source = await verifyManagedBundle(root);
  for (const item of source.objects) await provisionManagedObject(targetRoot, item.owner, item.key, await readFile(await safeFile(root, item.file)));
}
