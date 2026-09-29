import assert from "node:assert/strict";
import { readMigrationFiles } from "drizzle-orm/migrator";
import type { Client } from "pg";

export const fixtureTables = ["organizations", "web_presences", "microsites", "pages", "sections", "assets", "asset_usages"];

// Use PostgreSQL itself to interpret the checked-in SQL, not another handwritten
// Asset schema. Only schema qualification changes during disposable replay.
export async function schemaSignature(client: Client, schema: string) {
  const normalize = (value: string) => value.replaceAll(`${schema}.`, "");
  const columns = await client.query(`SELECT c.relname AS table_name, a.attname, format_type(a.atttypid,a.atttypmod) AS type,
    a.attnotnull, a.attidentity, a.attgenerated, pg_get_expr(d.adbin,d.adrelid) AS default_value
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname=$1 AND c.relname=ANY($2) AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum`, [schema, fixtureTables]);
  const constraints = await client.query(`SELECT c.relname AS table_name, con.contype, con.convalidated, pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=$1 AND c.relname=ANY($2) ORDER BY c.relname,con.contype,pg_get_constraintdef(con.oid)`, [schema, fixtureTables]);
  const indexes = await client.query(`SELECT c.relname AS table_name, i.indisvalid, i.indisready, pg_get_indexdef(i.indexrelid) AS definition
    FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=$1 AND c.relname=ANY($2) ORDER BY c.relname,pg_get_indexdef(i.indexrelid)`, [schema, fixtureTables]);
  return {
    columns: columns.rows,
    constraints: constraints.rows.map(r => ({ ...r, definition: normalize(r.definition) })).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    // LIKE assigns fresh index names; compare complete definitions apart from names.
    indexes: indexes.rows.map(r => ({ ...r, definition: normalize(r.definition).replace(/INDEX \S+ ON /, "INDEX ON ") })).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

export async function assertMigrationFidelity(client: Client, fixtureSchema: string) {
  const migrations = readMigrationFiles({ migrationsFolder: "lib/platform/db/migrations" });
  const installed = await client.query("SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at,id");
  assert.deepEqual(installed.rows, migrations.map(m => ({ hash: m.hash, created_at: String(m.folderMillis) })), "Installed migration journal differs from checked-in migration chain");
  const expectedSchema = `${fixtureSchema}_expected`;
  assert.match(expectedSchema, /^myomaton_asset_test_[a-f0-9]{32}_expected$/);
  await client.query("BEGIN");
  try {
    await client.query(`CREATE SCHEMA "${expectedSchema}"`);
    await client.query(`SET LOCAL search_path TO "${expectedSchema}"`);
    for (const migration of migrations) for (const statement of migration.sql) {
      await client.query(statement.replaceAll('"public".', `"${expectedSchema}".`));
    }
    // Make qualification deterministic for both catalog reads.
    await client.query("SET LOCAL search_path TO pg_catalog");
    assert.deepEqual(await schemaSignature(client, "public"), await schemaSignature(client, expectedSchema), "Installed schema differs from replayed checked-in migrations");
  } finally { await client.query("ROLLBACK"); }
}

export async function assertFixtureFidelity(client: Client, schema: string) {
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL search_path TO pg_catalog");
    assert.deepEqual(await schemaSignature(client, schema), await schemaSignature(client, "public"), "Fixture constraints/indexes/columns differ from installed schema");
    const targets = await client.query(`SELECT target_ns.nspname FROM pg_constraint con
      JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_class target ON target.oid=con.confrelid JOIN pg_namespace target_ns ON target_ns.oid=target.relnamespace
      WHERE n.nspname=$1 AND con.contype='f'`, [schema]);
    assert.ok(targets.rows.length > 0);
    assert.ok(targets.rows.every(row => row.nspname === schema), "Fixture FK escaped into another schema");
  } finally { await client.query("ROLLBACK"); }
}
