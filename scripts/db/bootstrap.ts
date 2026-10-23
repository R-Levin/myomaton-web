import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readMigrationFiles, type MigrationMeta } from "drizzle-orm/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Pool, PoolClient } from "pg";
import identities from "./bootstrap-identities.json";
import previous from "../../lib/platform/db/migrations/meta/0005_snapshot.json";

const tables = ["microsites", "pages", "navigations", "navigation_items"];
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const q = (value: string) => '"' + value.replaceAll('"', '""') + '"';
const suffix = `  -- PostgreSQL 18 stores named NOT NULL constraints independently of indexes.
  FOREACH column_name IN ARRAY ARRAY['id', 'web_presence_id', 'name', 'status',
    'configuration', 'metadata', 'version', 'created_at', 'updated_at'] LOOP
    EXECUTE format('ALTER TABLE "public"."managed_sites" RENAME CONSTRAINT %I TO %I',
      'microsites_' || column_name || '_not_null', 'managed_sites_' || column_name || '_not_null');
  END LOOP;
  ALTER TABLE "public"."pages" RENAME CONSTRAINT "pages_microsite_id_not_null" TO "pages_managed_site_id_not_null";
END $$;
`;
export function pg17RenamePlan(migration: MigrationMeta, major: number) {
  assert.equal(major, 17, "0006 compatibility is PG17-only");
  assert.equal(migration.hash, identities[6].hash); assert.equal(migration.folderMillis, identities[6].when);
  assert.equal(migration.sql.length, 1); const original = migration.sql[0];
  assert.equal(sha(original), identities[6].hash, "0006 SQL body/checksum differs");
  assert.ok(original.endsWith(suffix), "Exact PG18-only suffix required");
  const sql = original.slice(0, -suffix.length) + "END $$;\n";
  return { sql, originalHash: migration.hash, executedHash: sha(sql) };
}
export function bootstrapFiles(folder = "lib/platform/db/migrations") {
  const files = readMigrationFiles({ migrationsFolder: folder });
  assert.deepEqual(files.map(m => ({ hash: m.hash, when: m.folderMillis })), identities.map(({ hash, when }) => ({ hash, when })), "Immutable bootstrap migration identities differ");
  return files;
}
type Column = { name: string; type: string; notNull: boolean; default?: unknown; primaryKey: boolean };
type Table = { columns: Record<string, Column>; foreignKeys: Record<string, { name: string; columnsFrom: string[]; tableTo: string; columnsTo: string[] }>; uniqueConstraints: Record<string, { name: string; columns: string[] }> };
const snapshots = previous.tables as unknown as Record<string, Table>;
const rename = (name: string, after: boolean) => after ? name.replaceAll("microsites", "managed_sites").replaceAll("microsite_id", "managed_site_id") : name;
const sorted = <T>(rows: T[]) => rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

// Compare the exact known four-table structure, not merely the presence of one
// nullable flag. No PG18-style synthetic CHECK/NOT NULL objects are manufactured.
export async function verifyRenameStage(c: PoolClient, schema: string, major: number, after: boolean) {
  assert.ok([17, 18].includes(major));
  const names = tables.map(t => rename(t, after));
  assert.equal((await c.query("SELECT to_regclass($1) name", [`${schema}.${after ? "microsites" : "managed_sites"}`])).rows[0].name, null, "Partial/colliding 0006 state");
  const expectedColumns: Record<string, unknown>[] = [], expectedConstraints: Record<string, unknown>[] = [], expectedIndexes: Record<string, unknown>[] = [];
  for (const name of tables) {
    const table = snapshots[`public.${name}`], target = rename(name, after);
    for (const column of Object.values(table.columns)) {
      let value = column.default === undefined ? null : String(column.default);
      if (column.type === "text" && value?.startsWith("'")) value += "::text";
      expectedColumns.push({ table_name: target, attname: rename(column.name, after), type: column.type, attnotnull: column.notNull, default_value: value });
      if (major === 18 && column.notNull) expectedConstraints.push({ table_name: target, conname: `${target}_${rename(column.name, after)}_not_null`, contype: "n", convalidated: true, condeferrable: false, condeferred: false, definition: `NOT NULL ${rename(column.name, after)}` });
    }
    const keys = Object.values(table.columns).filter(c => c.primaryKey).map(c => rename(c.name, after));
    const addUnique = (constraint: string, columns: string[], primary: boolean) => {
      expectedConstraints.push({ table_name: target, conname: constraint, contype: primary ? "p" : "u", convalidated: true, condeferrable: false, condeferred: false, definition: `${primary ? "PRIMARY KEY" : "UNIQUE"} (${columns.join(", ")})` });
      expectedIndexes.push({ table_name: target, indexname: constraint, indisvalid: true, indisready: true, indisunique: true, indisprimary: primary, definition: `CREATE UNIQUE INDEX ${constraint} ON ${schema}.${target} USING btree (${columns.join(", ")})` });
    };
    addUnique(`${target}_pkey`, keys, true);
    for (const u of Object.values(table.uniqueConstraints)) addUnique(rename(u.name, after), u.columns.map(c => rename(c, after)), false);
    for (const fk of Object.values(table.foreignKeys)) expectedConstraints.push({ table_name: target, conname: rename(fk.name, after), contype: "f", convalidated: true, condeferrable: false, condeferred: false, definition: `FOREIGN KEY (${fk.columnsFrom.map(c => rename(c, after)).join(", ")}) REFERENCES ${rename(fk.tableTo, after)}(${fk.columnsTo.map(c => rename(c, after)).join(", ")})` });
  }
  expectedConstraints.push({ table_name: "navigation_items", conname: "navigation_items_not_own_parent", contype: "c", convalidated: true, condeferrable: false, condeferred: false, definition: "CHECK (((parent_id IS NULL) OR (parent_id <> id)))" });
  const prior = (await c.query("SHOW search_path")).rows[0].search_path;
  await c.query("SELECT set_config('search_path',$1,true)", [q(schema)]);
  try {
    const columns = (await c.query("SELECT r.relname table_name,a.attname,format_type(a.atttypid,a.atttypmod) type,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) default_value FROM pg_attribute a JOIN pg_class r ON r.oid=a.attrelid JOIN pg_namespace n ON n.oid=r.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname=$1 AND r.relname=ANY($2) AND a.attnum>0 AND NOT a.attisdropped", [schema, names])).rows;
    assert.deepEqual(sorted(columns), sorted(expectedColumns), "0006 column/type/default/NOT NULL invariant differs");
    const constraints = (await c.query(`SELECT r.relname table_name,con.conname,con.contype,con.convalidated,con.condeferrable,con.condeferred,${major === 18 ? "con.conenforced" : "true AS conenforced"},pg_get_constraintdef(con.oid) definition FROM pg_constraint con JOIN pg_class r ON r.oid=con.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname=$1 AND r.relname=ANY($2)`, [schema, names])).rows;
    assert.deepEqual(sorted(constraints), sorted(expectedConstraints.map(r => ({ ...r, conenforced: true }))), "0006 constraint invariant differs");
    const indexes = (await c.query("SELECT r.relname table_name,ci.relname indexname,i.indisvalid,i.indisready,i.indisunique,i.indisprimary,pg_get_indexdef(i.indexrelid) definition FROM pg_index i JOIN pg_class r ON r.oid=i.indrelid JOIN pg_class ci ON ci.oid=i.indexrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname=$1 AND r.relname=ANY($2)", [schema, names])).rows;
    assert.deepEqual(sorted(indexes), sorted(expectedIndexes), "0006 index invariant differs");
    assert.equal((await c.query("SELECT count(*)::int n FROM pg_trigger t JOIN pg_class r ON r.oid=t.tgrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname=$1 AND r.relname=ANY($2) AND NOT t.tgisinternal", [schema, names])).rows[0].n, 0);
    assert.equal((await c.query("SELECT count(*)::int n FROM pg_class r JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname=$1 AND r.relname=ANY($2) AND (r.relrowsecurity OR r.relforcerowsecurity OR r.relkind<>'r')", [schema, names])).rows[0].n, 0);
    if (major === 17) for (const name of Object.keys(snapshots).map(t => rename(t.slice(7), after))) assert.equal((await c.query(`SELECT count(*)::int n FROM ${q(schema)}.${q(name)}`)).rows[0].n, 0, "PG17 adapter is fresh-bootstrap only");
    return sha(JSON.stringify({ columns: sorted(columns), constraints: sorted(constraints), indexes: sorted(indexes) }));
  } finally { await c.query("SELECT set_config('search_path',$1,true)", [prior]); }
}

export type BootstrapReceipt = { kind: "miopages-pg17-bootstrap/1"; tag: string; originalHash: string; executedHash: string; serverMajor: 17; equivalence: "column-NOT-NULL-preserved;PG18-name-renames-inapplicable"; preflight: string; postflight: string; at: string };
export async function bootstrapStatus(c: Pick<PoolClient, "query">, files = bootstrapFiles()) {
  const exists = (await c.query("SELECT to_regclass('drizzle.__drizzle_migrations') name")).rows[0].name;
  const rows = exists ? (await c.query("SELECT id,hash,created_at::text FROM drizzle.__drizzle_migrations ORDER BY id")).rows : [];
  assert.ok(rows.length <= files.length);
  assert.deepEqual(rows.map(r => ({ hash: r.hash, when: Number(r.created_at) })), files.slice(0, rows.length).map(m => ({ hash: m.hash, when: m.folderMillis })), "Incorrect migration ledger prefix");
  const major = Math.floor(Number((await c.query("SHOW server_version_num")).rows[0].server_version_num) / 10000); assert.ok([17, 18].includes(major), "Unsupported bootstrap major");
  const comment = exists ? (await c.query("SELECT obj_description('drizzle.__drizzle_migrations'::regclass,'pg_class') comment")).rows[0].comment : null;
  let receipt: BootstrapReceipt | null = null;
  if (comment !== null) {
    receipt = JSON.parse(comment); assert.ok(receipt); const plan = pg17RenamePlan(files[6], 17);
    assert.equal(receipt.kind, "miopages-pg17-bootstrap/1"); assert.equal(receipt.tag, identities[6].tag); assert.equal(receipt.originalHash, plan.originalHash); assert.equal(receipt.executedHash, plan.executedHash); assert.equal(receipt.serverMajor, 17); assert.equal(receipt.equivalence, "column-NOT-NULL-preserved;PG18-name-renames-inapplicable"); assert.ok(rows.length >= 7);
    assert.match(receipt.preflight, /^[a-f0-9]{64}$/); assert.match(receipt.postflight, /^[a-f0-9]{64}$/); assert.ok(Number.isFinite(Date.parse(receipt.at)));
  }
  if (major === 17 && rows.length >= 7) assert.ok(receipt, "PG17 0006 requires truthful compatibility receipt");
  return { major, applied: rows.length, pending: files.length - rows.length, receipt };
}

export async function migrateWithBootstrapCompatibility(pool: Pool, folder = "lib/platform/db/migrations") {
  const files = bootstrapFiles(folder), c = await pool.connect();
  try {
    const status = await bootstrapStatus(c, files); if (!status.pending) return status;
    const original = files[6].sql[0];
    const proxy = new Proxy(c, { get(target, property) {
      if (property === "query") return async (...args: unknown[]) => {
        const first = args[0], text = typeof first === "string" ? first : (first as { text?: string })?.text;
        if (text !== original) return Reflect.apply(target.query, target, args);
        assert.equal((await bootstrapStatus(c, files)).applied, 6, "0006 must follow the exact six-migration prefix");
        const preflight = await verifyRenameStage(c, "public", status.major, false);
        if (status.major === 18) { const result = await Reflect.apply(target.query, target, args); await verifyRenameStage(c, "public", 18, true); return result; }
        const plan = pg17RenamePlan(files[6], status.major); const result = await c.query(plan.sql); const postflight = await verifyRenameStage(c, "public", 17, true);
        const receipt: BootstrapReceipt = { kind: "miopages-pg17-bootstrap/1", tag: identities[6].tag, originalHash: plan.originalHash, executedHash: plan.executedHash, serverMajor: 17, equivalence: "column-NOT-NULL-preserved;PG18-name-renames-inapplicable", preflight, postflight, at: new Date().toISOString() };
        await c.query(`COMMENT ON TABLE drizzle.__drizzle_migrations IS '${JSON.stringify(receipt).replaceAll("'", "''")}'`);
        return result;
      };
      const value = Reflect.get(target, property); return typeof value === "function" ? value.bind(target) : value;
    } });
    // Drizzle retains transaction/order/checksum recording. The only intercepted
    // statement is the pinned 0006 body. Receipt and ledger commit or roll back together.
    await migrate(drizzle(proxy), { migrationsFolder: folder });
    return await bootstrapStatus(c, files);
  } finally { c.release(); }
}

// Existing disposable fixtures replay into random schemas without a separate
// journal. Reuse the same PG17 equivalence guard; never touch the public receipt.
export async function replayDisposableMigration(c: PoolClient, migration: MigrationMeta, schema: string) {
  assert.match(schema, /^canonical_test_[a-f0-9]{32}(?:_\w+)?$/);
  const major = Math.floor(Number((await c.query("SHOW server_version_num")).rows[0].server_version_num) / 10000);
  const qualify = (sql: string) => sql.replaceAll('"public".', `${q(schema)}.`);
  if (major === 17 && migration.folderMillis === identities[6].when) {
    assert.notEqual((await c.query("SELECT inet_server_port() port")).rows[0].port, 5432, "PG17 fixture replay requires private cluster");
    const plan = pg17RenamePlan(migration, major); await verifyRenameStage(c, schema, 17, false); await c.query(qualify(plan.sql)); await verifyRenameStage(c, schema, 17, true);
  } else for (const sql of migration.sql) await c.query(qualify(sql));
}
