import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { disposableCluster } from "../../scripts/backup/disposable-cluster";
import { migrateWithBootstrapCompatibility, bootstrapStatus, bootstrapFiles } from "../../scripts/db/bootstrap";

for (const major of [17, 18]) test(`PG${major} 0006 compatibility guards, truthful ledger and no-op`, { skip: !process.env[`PG${major}_BIN_DIR`], timeout: 180000 }, async t => {
  const cluster = await disposableCluster(process.env[`PG${major}_BIN_DIR`]!), folder = await mkdtemp(path.join(tmpdir(), "miopages-bootstrap-prefix-"));
  const initial = new Pool({ connectionString: cluster.url });
  const adminUrl = new URL(cluster.url); adminUrl.pathname = "/postgres"; const admin = new Pool({ connectionString: adminUrl.toString() });
  try {
    const journal = JSON.parse(await readFile("lib/platform/db/migrations/meta/_journal.json", "utf8")); await mkdir(path.join(folder, "meta"));
    await writeFile(path.join(folder, "meta/_journal.json"), JSON.stringify({ ...journal, entries: journal.entries.slice(0, 6) }));
    for (const e of journal.entries.slice(0, 6)) await copyFile(`lib/platform/db/migrations/${e.tag}.sql`, path.join(folder, e.tag + ".sql"));
    await migrate(drizzle(initial), { migrationsFolder: folder }); await initial.end();
    const template = decodeURIComponent(new URL(cluster.url).pathname.slice(1));
    const run = async (name: string, action: (p: Pool) => Promise<void>) => {
      let failure: unknown;
      await t.test(name, async () => {
        const database = "migration_rehearsal_" + randomUUID().replaceAll("-", ""); await admin.query(`CREATE DATABASE "${database}" TEMPLATE "${template}"`); const url = new URL(cluster.url); url.pathname = "/" + database; const p = new Pool({ connectionString: url.toString() });
        try { await action(p); } catch (error) { failure = error; throw error; } finally { await p.end(); await admin.query(`DROP DATABASE "${database}"`); }
      }); if (failure) throw failure;
    };
    for (const [label, sql] of [
      ["nullable invariant", "ALTER TABLE microsites ALTER COLUMN name DROP NOT NULL"],
      ["wrong column constrained", "ALTER TABLE microsites ALTER COLUMN name DROP NOT NULL; ALTER TABLE navigation_items ALTER COLUMN parent_id SET NOT NULL"],
      ["unrelated constraint changed", "ALTER TABLE pages DROP CONSTRAINT pages_microsite_id_slug_unique"],
      ["unexpected type", "ALTER TABLE microsites ALTER COLUMN name TYPE varchar(100)"],
      ["partial 0006 state", "ALTER TABLE microsites RENAME TO managed_sites"],
      ["incorrect ledger", "UPDATE drizzle.__drizzle_migrations SET hash=repeat('0',64) WHERE id=1"],
      ["forged early receipt", "COMMENT ON TABLE drizzle.__drizzle_migrations IS '{\"kind\":\"forged\"}'"],
    ]) await run(label + " refuses before progress", async p => {
      await p.query(sql); const rows = (await p.query("SELECT * FROM drizzle.__drizzle_migrations ORDER BY id")).rows;
      await assert.rejects(migrateWithBootstrapCompatibility(p)); assert.deepEqual((await p.query("SELECT * FROM drizzle.__drizzle_migrations ORDER BY id")).rows, rows); assert.equal(rows.length, 6);
      if (label !== "forged early receipt") assert.equal((await p.query("SELECT obj_description('drizzle.__drizzle_migrations'::regclass,'pg_class') value")).rows[0].value, null);
    });
    if (major === 17) await run("non-fresh PG17 data refuses", async p => { await p.query("INSERT INTO organizations(name) VALUES('Synthetic unexpected existing data')"); await assert.rejects(migrateWithBootstrapCompatibility(p), (e: unknown) => String((e as { cause?: Error }).cause?.message).includes("fresh-bootstrap")); assert.equal((await p.query("SELECT count(*)::int n FROM drizzle.__drizzle_migrations")).rows[0].n, 6); });
    if (major === 18) await run("PG18 NOT NULL catalog names remain exact", async p => {
      await p.query("ALTER TABLE microsites RENAME CONSTRAINT microsites_name_not_null TO unexpected_name");
      await assert.rejects(migrateWithBootstrapCompatibility(p));
      assert.equal((await p.query("SELECT count(*)::int n FROM drizzle.__drizzle_migrations")).rows[0].n, 6);
    });
    await run("a later migration failure rolls back the compatibility receipt and 0006", async p => {
      await p.query("CREATE TABLE contact_definitions(id uuid)");
      await assert.rejects(migrateWithBootstrapCompatibility(p));
      assert.equal((await p.query("SELECT count(*)::int n FROM drizzle.__drizzle_migrations")).rows[0].n, 6);
      assert.equal((await p.query("SELECT to_regclass('public.managed_sites') name")).rows[0].name, null);
      assert.equal((await p.query("SELECT obj_description('drizzle.__drizzle_migrations'::regclass,'pg_class') value")).rows[0].value, null);
    });
    await run("modified source checksum or unrelated appended SQL refuses", async p => {
      const copied = path.join(folder, "tampered"); await mkdir(path.join(copied, "meta"), { recursive: true }); await writeFile(path.join(copied, "meta/_journal.json"), JSON.stringify(journal));
      for (const e of journal.entries) await copyFile(`lib/platform/db/migrations/${e.tag}.sql`, path.join(copied, e.tag + ".sql"));
      const f = path.join(copied, journal.entries[6].tag + ".sql"); await writeFile(f, (await readFile(f, "utf8")) + "\nSELECT 1;\n");
      await assert.rejects(migrateWithBootstrapCompatibility(p, copied), /identities/); assert.equal((await p.query("SELECT count(*)::int n FROM drizzle.__drizzle_migrations")).rows[0].n, 6);
    });
    await run("exact prefix upgrades to sixteen; status and rerun preserve rows/sequence/receipt", async p => {
      if (major === 18) await p.query("INSERT INTO organizations(name) VALUES('Synthetic existing PG18 data preserved')");
      const prior = (await p.query("SELECT * FROM drizzle.__drizzle_migrations ORDER BY id")).rows, result = await migrateWithBootstrapCompatibility(p); assert.equal(result.applied, 16); assert.equal(result.pending, 0); assert.equal(!!result.receipt, major === 17);
      assert.deepEqual((await p.query("SELECT * FROM drizzle.__drizzle_migrations ORDER BY id LIMIT 6")).rows, prior);
      const capture = async () => ({ rows: (await p.query("SELECT * FROM drizzle.__drizzle_migrations ORDER BY id")).rows, seq: (await p.query("SELECT last_value::text,is_called FROM drizzle.__drizzle_migrations_id_seq")).rows, receipt: (await bootstrapStatus(p as never)).receipt });
      const before = await capture(); assert.deepEqual(await migrateWithBootstrapCompatibility(p), result); assert.deepEqual(await capture(), before); assert.equal(bootstrapFiles().length, 16);
      await mkdir("runtime-content/pg17-bootstrap-proof", { recursive: true }); await writeFile(`runtime-content/pg17-bootstrap-proof/bootstrap-${major}.json`, JSON.stringify({ ...result, negativeControls: true, originalHistoryPreserved: true, noOp: true, sharedTouched: false }, null, 2));
    });
  } finally { await initial.end().catch(() => {}); await admin.end(); await cluster.stop(); assert.equal(path.dirname(folder), path.resolve(tmpdir())); assert.match(path.basename(folder), /^miopages-bootstrap-prefix-/); await rm(folder, { recursive: true }); }
});
