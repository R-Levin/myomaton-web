import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { snapshotPublic } from "../customer-previews/disposable";
import { stateFingerprint } from "../../lib/platform/customer-initialization";
import { IntakeService } from "../../lib/platform/intake/service";
import { mioPagesIntakeOwner } from "../../lib/platform/intake/availability";

export function intakeSchema(schema: string) {
  assert.match(schema, /^canonical_test_[a-f0-9]{32}_intake$/);
  return schema;
}
export function intakeDatabaseUrl(databaseUrl: string, schema: string) {
  const url = new URL(databaseUrl); url.searchParams.set("options", `-c search_path=${intakeSchema(schema)} -c timezone=UTC`); return url.toString();
}
export async function createIntakeFixture(databaseUrl: string) {
  const source = new Pool({ connectionString: databaseUrl, options: "-c default_transaction_read_only=on" });
  const admin = new Pool({ connectionString: databaseUrl });
  const schema = intakeSchema(`canonical_test_${randomUUID().replaceAll("-", "")}_intake`), quoted = `"${schema}"`;
  const pool = new Pool({ connectionString: intakeDatabaseUrl(databaseUrl, schema) });
  let created = false;
  try {
    const before = await snapshotPublic(source);
    const c = await admin.connect();
    try {
      await c.query("BEGIN"); await c.query(`CREATE SCHEMA ${quoted}`); await c.query(`SET LOCAL search_path=${quoted}`);
      for (const m of readMigrationFiles({ migrationsFolder: "lib/platform/db/migrations" })) for (const sql of m.sql) await c.query(sql.replaceAll('"public".', `${quoted}.`));
      const order = ["organizations", "subject_types", "web_presences", "managed_sites", "pages", "sections", "actions", "navigations", "navigation_items", "assets", "asset_usages", "design_systems", "subjects", "contact_definitions", "contact_submissions", "business_knowledge", "offerings", "business_knowledge_revisions", "offering_revisions"];
      for (const table of order) for (const row of before[table]) await c.query(`INSERT INTO ${table} SELECT * FROM jsonb_populate_record(NULL::${table},$1::jsonb)`, [JSON.stringify(row)]);
      await c.query("COMMIT"); created = true;
    } catch (error) { await c.query("ROLLBACK"); throw error; } finally { c.release(); }
    const verify = async () => { assert.equal(stateFingerprint(await snapshotPublic(source)), stateFingerprint(before), "Real customer/migration state changed"); return stateFingerprint(before); };
    const close = async () => { await pool.end(); await source.end(); await admin.end(); };
    const stop = async () => { try { await verify(); if (created) { await admin.query(`DROP SCHEMA ${quoted} CASCADE`); created = false; } } finally { await close(); } };
    return { schema, pool, service: new IntakeService(pool, mioPagesIntakeOwner), before, verify, stop, close };
  } catch (error) { if (created) await admin.query(`DROP SCHEMA ${quoted} CASCADE`); await pool.end(); await source.end(); await admin.end(); throw error; }
}
