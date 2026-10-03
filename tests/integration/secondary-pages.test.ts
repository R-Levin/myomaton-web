import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { Client, type Pool } from "pg";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { JSDOM } from "jsdom";
import { baseline, tables, updateSecondaryPagesV1, type State } from "../../scripts/customer-updates/myomaton-secondary-pages-v1";
import { updateMyomatonHomeV1 } from "../../scripts/customer-updates/myomaton-home-v1";
import { startProductionFixture } from "./production-server";
import { assetRoot, readManagedObject } from "../../lib/platform/assets/local-storage";

test("secondary Pages transition, rollback, Asset reuse and production rendering in a disposable schema", async () => {
  const url = process.env.ASSET_TEST_DATABASE_URL;
  assert.ok(url, "ASSET_TEST_DATABASE_URL required; only disposable schemas are written");
  const client = new Client({ connectionString: url }); await client.connect();
  const name = `myomaton_asset_test_${randomUUID().replaceAll("-", "")}_secondary`;
  assert.match(name, /^myomaton_asset_test_[a-f0-9]{32}_secondary$/);
  const schema = `"${name}"`;
  const scoped = { connect: async () => ({ release() {}, query: (sql: string, params?: unknown[]) => {
    const isolated = sql.replaceAll("public.", `${schema}.`);
    assert.ok(!isolated.includes("public."));
    return client.query(isolated, params);
  } }) } as unknown as Pick<Pool, "connect">;
  const read = async () => {
    const state = {} as State;
    for (const table of tables) state[table] = (await client.query(`SELECT to_jsonb(t) AS row FROM ${schema}.${table} t ORDER BY id`)).rows.map(r => r.row);
    return state;
  };
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query("BEGIN");
    await client.query(`SET LOCAL search_path TO ${schema}`);
    for (const migration of readMigrationFiles({ migrationsFolder: "lib/platform/db/migrations" })) {
      for (const sql of migration.sql) await client.query(sql.replaceAll('"public".', `${schema}.`));
    }
    await client.query("COMMIT");
    await client.query("SET TIME ZONE 'UTC'");
    const order = ["organizations", "web_presences", "subject_types", "subjects", "managed_sites", "design_systems", "actions", "pages", "sections", "navigations", "navigation_items", "assets", "asset_usages"] as const;
    for (const table of order) for (const row of baseline[table]) {
      const keys = Object.keys(row); assert.ok(keys.every(k => /^[a-z_]+$/.test(k)));
      await client.query(`INSERT INTO ${schema}.${table} (${keys.join(",")}) SELECT ${keys.join(",")} FROM jsonb_populate_record(NULL::${schema}.${table}, $1::jsonb)`, [JSON.stringify(row)]);
    }
    assert.deepEqual(await read(), baseline);
    // A real PostgreSQL failure late in the transaction must undo Pages, Actions,
    // Sections, both usages, and the two Navigation deletions.
    await client.query(`CREATE FUNCTION ${schema}.fail_navigation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced rollback'; END $$`);
    await client.query(`CREATE TRIGGER fail_navigation BEFORE INSERT ON ${schema}.navigation_items FOR EACH ROW EXECUTE FUNCTION ${schema}.fail_navigation()`);
    await assert.rejects(updateSecondaryPagesV1(scoped), /forced rollback/);
    assert.deepEqual(await read(), baseline);
    await client.query(`DROP TRIGGER fail_navigation ON ${schema}.navigation_items`);
    assert.deepEqual(await updateSecondaryPagesV1(scoped), { changed: true, inserted: 32, updated: 0, deleted: 2 });
    const applied = await read();
    assert.deepEqual(await updateSecondaryPagesV1(scoped), { changed: false, inserted: 0, updated: 0, deleted: 0 });
    assert.deepEqual(await read(), applied);
    await assert.rejects(updateMyomatonHomeV1(scoped), /Home v1 conflict/);
    assert.deepEqual(await read(), applied);
    for (const table of tables.filter(t => t !== "navigation_items")) for (const row of baseline[table]) {
      assert.deepEqual(applied[table].find(r => r.id === row.id), row);
    }
    assert.equal(applied.assets.length, 3); assert.equal(applied.asset_usages.length, 3);
    assert.equal(applied.asset_usages.filter(r => r.asset_id === "e1a699d7-19ca-43a1-9dbe-3d7d523381ef").length, 0);
    const server = await startProductionFixture(url, name, assetRoot());
    try {
      for (const [path, title, count] of [["/", "Myomaton", 9], ["/about", "About Myomaton", 6], ["/projects", "Projects", 7], ["/principles", "Principles", 7]] as const) {
        const response = await fetch(server.base + path); assert.equal(response.status, 200);
        const doc = new JSDOM(await response.text()).window.document;
        assert.equal(doc.title, title); assert.equal(doc.querySelectorAll("main > section").length, count);
        assert.deepEqual([...doc.querySelectorAll("nav a")].map(a => a.getAttribute("href")), ["/", "/projects", "/principles", "/about"]);
        if (path !== "/") assert.ok(doc.querySelectorAll("main p").length > count);
        if (path === "/about" || path === "/principles") assert.ok(doc.querySelector('main a[href="/projects"]'));
        if (path === "/projects") {
          assert.ok(doc.querySelector('main a[href="/principles"]'));
          assert.ok(doc.body.textContent?.includes("TaBot")); assert.ok(doc.body.textContent?.includes("A-Bot"));
          assert.equal(doc.querySelectorAll("img.managed-site-photo").length, 2);
        }
        for (const photo of doc.querySelectorAll("img.managed-site-photo")) {
          const src = photo.getAttribute("src")!;
          const asset = applied.assets.find(a => src.endsWith(a.id)); assert.ok(asset);
          assert.equal(photo.getAttribute("alt"), asset.alt_text);
          const media = await fetch(server.base + src); assert.equal(media.status, 200);
          assert.deepEqual(Buffer.from(await media.arrayBuffer()), await readManagedObject(assetRoot(), String(asset.web_presence_id), String(asset.source_reference)));
        }
      }
      for (const path of ["/unknown", "/media/unknown", "/a%2Fb", "/media/assets/e1a699d7-19ca-43a1-9dbe-3d7d523381ef"]) assert.equal((await fetch(server.base + path)).status, 404);
    } finally { await server.stop(); }
    assert.deepEqual(await read(), applied);
  } finally {
    await client.query("ROLLBACK");
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  }
});
