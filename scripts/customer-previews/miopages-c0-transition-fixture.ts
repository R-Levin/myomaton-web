import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Pool } from "pg";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { customerTables, readCustomerState, stateFingerprint, type CustomerState } from "../../lib/platform/customer-initialization";
import { assetRoot, readManagedObject, provisionManagedObject } from "../../lib/platform/assets/local-storage";
import { snapshotPublic } from "./disposable";
import { expectedCompleteBefore, planC0Transition, target } from "../customer-updates/miopages-c0-revamp";
import { startProductionFixture } from "../../tests/integration/production-server";
import { customerGraph, otherCustomerState } from "../../lib/platform/customer-state";
import { before as transitionBefore } from "../customer-updates/miopages-c0-revamp";

// Only creates/writes a random schema. Real source connection is read-only.
export async function prepareC0TransitionFixture(databaseUrl: string) {
  const source = new Pool({ connectionString: databaseUrl, options: "-c default_transaction_read_only=on" });
  const admin = new Pool({ connectionString: databaseUrl });
  const schema = `canonical_test_${randomUUID().replaceAll("-", "")}_preview`, quoted = `"${schema}"`;
  const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema} -c timezone=UTC` });
  const root = await mkdtemp(path.join(os.tmpdir(), "miopages-c0-transition-"));
  const servers: Awaited<ReturnType<typeof startProductionFixture>>[] = [];
  let created = false;
  // Established integration adapter: redirect every fixed public/migration query
  // to this self-created schema, including locks and canonical writer queries.
  const wrapped = { connect: async () => {
    const c = await pool.connect();
    return { release: () => c.release(), query: (sql: string, values?: unknown[]) => c.query(sql
      .replaceAll("public.", `${quoted}.`).replaceAll("search_path=public", `search_path=${schema}`)
      .replaceAll("drizzle.__drizzle_migrations", `${quoted}.migration_fixture`), values) };
  } } as unknown as Pool;
  try {
    const realBaseline = await snapshotPublic(source);
    // Accept only either exact guarded endpoint. Historical testing always seeds
    // the frozen predecessor inside its own schema, never resets real state.
    planC0Transition(realBaseline);
    const rest = otherCustomerState(realBaseline,target);
    const baseline: CustomerState = { migrations: realBaseline.migrations, ...Object.fromEntries(customerTables.map(table=>[table,[...rest[table],...transitionBefore[table]]])) };
    assert.equal(stateFingerprint(baseline), expectedCompleteBefore);
    assert.equal(stateFingerprint(customerGraph(baseline,target)),stateFingerprint(transitionBefore));
    const managed: {id:string;owner:string;reference:string;bytes:Buffer}[] = [];
    for (const asset of baseline.assets) {
      assert.equal(asset.source_type, "managed");
      const owner = String(asset.web_presence_id), reference = String(asset.source_reference);
      const bytes = await readManagedObject(assetRoot(), owner, reference);
      await provisionManagedObject(root, owner, reference, bytes);
      managed.push({ id: String(asset.id), owner, reference, bytes });
    }
    const c = await admin.connect();
    try {
      await c.query("BEGIN"); await c.query(`CREATE SCHEMA ${quoted}`); await c.query(`SET LOCAL search_path=${quoted}`);
      for (const migration of readMigrationFiles({ migrationsFolder: "lib/platform/db/migrations" })) for (const sql of migration.sql) await c.query(sql.replaceAll('"public".', `${quoted}.`));
      await c.query("CREATE TABLE migration_fixture (LIKE drizzle.__drizzle_migrations INCLUDING ALL)");
      const order = ["organizations", "subject_types", "web_presences", "managed_sites", "pages", "sections", "actions", "navigations", "navigation_items", "assets", "asset_usages", "design_systems", "subjects", "contact_definitions", "contact_submissions", "business_knowledge", "offerings", "business_knowledge_revisions", "offering_revisions", "migrations"];
      assert.equal(order.length, customerTables.length + 1);
      for (const table of order) for (const row of baseline[table]) {
        const name = table === "migrations" ? "migration_fixture" : table;
        await c.query(`INSERT INTO ${name} SELECT * FROM jsonb_populate_record(NULL::${name},$1::jsonb)`, [JSON.stringify(row)]);
      }
      await c.query("COMMIT"); created = true;
    } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
    const read = async () => {
      const c = await wrapped.connect();
      try { await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"); return await readCustomerState(c); }
      finally { await c.query("ROLLBACK"); c.release(); }
    };
    const verify = async () => {
      assert.equal(stateFingerprint(await snapshotPublic(source)), stateFingerprint(realBaseline), "Real state changed");
      for (const asset of managed) {
        assert.ok((await readManagedObject(assetRoot(), asset.owner, asset.reference)).equals(asset.bytes), "Real managed bytes changed");
        assert.ok((await readManagedObject(root, asset.owner, asset.reference)).equals(asset.bytes), "Disposable managed bytes changed");
      }
      return { realFingerprint: stateFingerprint(realBaseline), allCustomersUnchanged: true, migrationRowsUnchanged: baseline.migrations.length, managedObjectsUnchanged: managed.length };
    };
    const start = async (preview = false) => {
      const server = await startProductionFixture(databaseUrl, schema, root, target, preview);
      servers.push(server); return server;
    };
    const stop = async () => {
      try { for (const server of servers) await server.stop(); await verify(); }
      finally { if (created) { await admin.query(`DROP SCHEMA ${quoted} CASCADE`); created = false; } await pool.end(); await source.end(); await admin.end(); }
    };
    const seededBaseline = await read();
    assert.equal(stateFingerprint(seededBaseline), expectedCompleteBefore);
    return { baseline: seededBaseline, schema, root, wrapped, pool, managed, read, start, verify, stop };
  } catch (e) {
    if (created) await admin.query(`DROP SCHEMA ${quoted} CASCADE`);
    await pool.end(); await source.end(); await admin.end(); throw e;
  }
}
