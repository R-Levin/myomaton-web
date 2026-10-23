import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { customerTables, readCustomerState } from "../../lib/platform/customer-initialization";
import { recoveryCatalog, assertRecoveryEquivalent } from "../../scripts/backup/catalog";

test("0014 ordered upgrade preserves prior rows, fresh replay matches and rerun is a no-op", async () => {
  const input = process.env.ASSET_TEST_DATABASE_URL; assert.ok(input); const url = new URL(input);
  assert.equal(url.hostname, "127.0.0.1"); assert.notEqual(url.port, "5432"); assert.match(url.pathname, /^\/migration_rehearsal_[a-f0-9]{32}$/);
  const admin = new Pool({ connectionString: input }), token = randomUUID().replaceAll("-", ""), names = [`release_upgrade_${token}`, `release_fresh_${token}`], pools: Pool[] = [];
  const prefix = await mkdtemp(path.join(tmpdir(), "site-release-migrations-"));
  const capture = async (pool: Pool) => {
    const c = await pool.connect(); try { await c.query("BEGIN READ ONLY"); const tables: Record<string, unknown> = {};
      for (const t of (await c.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','drizzle') ORDER BY schemaname,tablename")).rows) tables[`${t.schemaname}.${t.tablename}`] = (await c.query(`SELECT to_jsonb(t) row FROM "${t.schemaname}"."${t.tablename}" t ORDER BY to_jsonb(t)::text`)).rows;
      return { tables, state: await readCustomerState(c), catalog: await recoveryCatalog(c, ["public", "drizzle"]), sequence: (await c.query("SELECT last_value::text,is_called FROM drizzle.__drizzle_migrations_id_seq")).rows };
    } finally { await c.query("ROLLBACK"); c.release(); }
  };
  try {
    const fullJournal = JSON.parse(await readFile("lib/platform/db/migrations/meta/_journal.json", "utf8")); const journal = { ...fullJournal, entries: fullJournal.entries.slice(0, 15) }; assert.equal(journal.entries.length, 15); assert.equal(journal.entries[14].tag, "0014_site_content_releases");
    const current = path.join(prefix, "current"); await mkdir(path.join(current, "meta"), { recursive: true });
    await writeFile(path.join(current, "meta/_journal.json"), JSON.stringify(journal));
    for (const e of journal.entries) await copyFile(path.join("lib/platform/db/migrations", `${e.tag}.sql`), path.join(current, `${e.tag}.sql`));
    await mkdir(path.join(prefix, "meta")); await writeFile(path.join(prefix, "meta/_journal.json"), JSON.stringify({ ...journal, entries: journal.entries.slice(0, 14) }));
    for (const e of journal.entries.slice(0, 14)) await copyFile(path.join("lib/platform/db/migrations", `${e.tag}.sql`), path.join(prefix, `${e.tag}.sql`));
    for (const name of names) { await admin.query(`CREATE DATABASE "${name}"`); const next = new URL(input); next.pathname = "/" + name; pools.push(new Pool({ connectionString: next.toString() })); }
    const [upgrade, fresh] = pools; await migrate(drizzle(upgrade), { migrationsFolder: prefix });
    const source = await readCustomerState(admin), order = ["organizations", "subject_types", "web_presences", "managed_sites", ...customerTables.filter(t => !["organizations", "subject_types", "web_presences", "managed_sites"].includes(t))];
    for (const table of order) for (const row of source[table]) await upgrade.query(`INSERT INTO ${table} SELECT * FROM jsonb_populate_record(NULL::${table},$1::jsonb)`, [JSON.stringify(row)]);
    const before = await capture(upgrade); assert.equal(before.state.migrations.length, 14);
    await migrate(drizzle(upgrade), { migrationsFolder: current }); const after = await capture(upgrade); assert.equal(after.state.migrations.length, 15);
    for (const [name, rows] of Object.entries(before.tables)) if (name !== "drizzle.__drizzle_migrations") assert.deepEqual(after.tables[name], rows, name);
    assert.deepEqual(after.tables["public.site_content_events"], []);
    await migrate(drizzle(fresh), { migrationsFolder: current }); const replay = await capture(fresh); assertRecoveryEquivalent(after.catalog, replay.catalog);
    await migrate(drizzle(upgrade), { migrationsFolder: current }); assert.deepEqual(await capture(upgrade), after);
    await mkdir("runtime-content/site-release-proof", { recursive: true }); await writeFile("runtime-content/site-release-proof/migration.json", JSON.stringify({ upgradedFrom: 14, upgradedTo: 15, freshReplay: true, noOp: true, priorRowsPreserved: true, sharedTouched: false }, null, 2));
  } finally {
    for (const pool of pools) await pool.end(); for (const name of names) await admin.query(`DROP DATABASE IF EXISTS "${name}"`); await admin.end();
    assert.equal(path.dirname(prefix), path.resolve(tmpdir())); assert.equal(await realpath(prefix), prefix); assert.match(path.basename(prefix), /^site-release-migrations-/); await rm(prefix, { recursive: true });
  }
});
