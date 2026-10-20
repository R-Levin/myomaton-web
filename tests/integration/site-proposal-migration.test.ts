import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { customerTables, readCustomerState, stateFingerprint } from "../../lib/platform/customer-initialization";
import { recoveryCatalog, assertRecoveryEquivalent } from "../../scripts/backup/catalog";

test("0013 upgrades exact 0012 state, fresh replays and reruns without table/catalog/journal changes", async () => {
  const input = process.env.ASSET_TEST_DATABASE_URL; assert.ok(input);
  const url = new URL(input); assert.equal(url.hostname, "127.0.0.1"); assert.notEqual(url.port, "5432"); assert.match(url.pathname, /^\/migration_rehearsal_[a-f0-9]{32}$/);
  const admin = new Pool({ connectionString: input }), token = randomUUID().replaceAll("-", ""), names = [`proposal_upgrade_${token}`, `proposal_fresh_${token}`];
  const prefix = await mkdtemp(path.join(tmpdir(), "site-proposal-migrations-"));
  const pools: Pool[] = [];
  const capture = async (pool: Pool) => {
    const c = await pool.connect(); try {
      await c.query("BEGIN READ ONLY"); const state = await readCustomerState(c), tables: Record<string, unknown> = {};
      for (const row of (await c.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','drizzle') ORDER BY schemaname,tablename")).rows)
        tables[`${row.schemaname}.${row.tablename}`] = (await c.query(`SELECT to_jsonb(t) r FROM "${row.schemaname}"."${row.tablename}" t ORDER BY to_jsonb(t)::text`)).rows;
      return { state, tables, catalog: await recoveryCatalog(c, ["public", "drizzle"]), sequence: (await c.query("SELECT last_value::text,is_called FROM drizzle.__drizzle_migrations_id_seq")).rows };
    } finally { await c.query("ROLLBACK"); c.release(); }
  };
  try {
    const fullJournal = JSON.parse(await readFile("lib/platform/db/migrations/meta/_journal.json", "utf8"));
    // Historical 0013 rehearsal stays pinned to its exact migration prefix.
    const journal = { ...fullJournal, entries: fullJournal.entries.slice(0, 14) }; assert.equal(journal.entries.length, 14); assert.equal(journal.entries[13].tag, "0013_site_change_proposals");
    const current = path.join(prefix, "current"); await mkdir(path.join(current, "meta"), { recursive: true });
    await writeFile(path.join(current, "meta/_journal.json"), JSON.stringify(journal));
    for (const e of journal.entries) await copyFile(path.join("lib/platform/db/migrations", `${e.tag}.sql`), path.join(current, `${e.tag}.sql`));
    await mkdir(path.join(prefix, "meta")); await writeFile(path.join(prefix, "meta/_journal.json"), JSON.stringify({ ...journal, entries: journal.entries.slice(0, 13) }));
    for (const e of journal.entries.slice(0, 13)) await copyFile(path.join("lib/platform/db/migrations", `${e.tag}.sql`), path.join(prefix, `${e.tag}.sql`));
    for (const name of names) { await admin.query(`CREATE DATABASE "${name}"`); const next = new URL(input); next.pathname = "/" + name; pools.push(new Pool({ connectionString: next.toString() })); }
    const [upgrade, fresh] = pools; await migrate(drizzle(upgrade), { migrationsFolder: prefix });
    const source = await readCustomerState(admin), order = ["organizations", "subject_types", "web_presences", "managed_sites", ...customerTables.filter(t => !["organizations", "subject_types", "web_presences", "managed_sites"].includes(t))];
    for (const table of order) for (const row of source[table]) await upgrade.query(`INSERT INTO ${table} SELECT * FROM jsonb_populate_record(NULL::${table},$1::jsonb)`, [JSON.stringify(row)]);
    const before = await capture(upgrade); assert.equal(before.state.migrations.length, 13);
    await migrate(drizzle(upgrade), { migrationsFolder: current });
    const after = await capture(upgrade); assert.equal(after.state.migrations.length, 14);
    for (const [name, rows] of Object.entries(before.tables)) if (name !== "drizzle.__drizzle_migrations") assert.deepEqual(after.tables[name], rows, name);
    for (const table of customerTables) assert.equal(stateFingerprint({ rows: after.state[table] }), stateFingerprint({ rows: before.state[table] }), table);
    for (const table of ["site_change_proposals", "site_change_revisions", "site_change_events"]) assert.deepEqual(after.tables[`public.${table}`], []);
    await migrate(drizzle(fresh), { migrationsFolder: current }); const replay = await capture(fresh); assert.equal(replay.state.migrations.length, 14); assertRecoveryEquivalent(after.catalog, replay.catalog);
    await migrate(drizzle(upgrade), { migrationsFolder: current }); const rerun = await capture(upgrade);
    assert.deepEqual(rerun, after);
    await mkdir("runtime-content/site-proposal-durable-proof", { recursive: true });
    await writeFile("runtime-content/site-proposal-durable-proof/migration.json", JSON.stringify({ upgradedFrom: 13, upgradedTo: 14, freshReplay: true, noOpRerun: true, priorTablesUnchanged: true, sharedDatabaseTouched: false }, null, 2));
  } finally {
    for (const pool of pools) await pool.end();
    for (const name of names) await admin.query(`DROP DATABASE IF EXISTS "${name}"`); await admin.end();
    assert.equal(path.dirname(prefix), path.resolve(tmpdir())); assert.equal(await realpath(prefix), prefix); assert.match(path.basename(prefix), /^site-proposal-migrations-/); await rm(prefix, { recursive: true });
  }
});
