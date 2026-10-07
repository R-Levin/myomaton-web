import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { Client, type Pool } from "pg";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { JSDOM } from "jsdom";
import { schemaSignature } from "./schema-fidelity";
import { startProductionFixture } from "./production-server";
import { assetRoot, readManagedObject } from "../../lib/platform/assets/local-storage";
import { planHomeV1, updateMyomatonHomeV1, tables as operatorTables, type State } from "../../scripts/customer-updates/myomaton-home-v1";

// Old identifiers below are deliberate migration inputs, never active mappings.
const oldTables = ["organizations", "web_presences", "subject_types", "subjects", "microsites", "design_systems", "actions", "pages", "sections", "navigations", "navigation_items", "assets", "asset_usages"];
const newTables = oldTables.map(t => t === "microsites" ? "managed_sites" : t);
type Rows = Record<string, Record<string, unknown>[]>;
function renamed(state: Rows): Rows {
  const { microsites, ...rest } = state;
  return { ...rest, managed_sites: microsites, pages: state.pages.map(({ microsite_id, ...p }) => ({ ...p, managed_site_id: microsite_id })) };
}
function disposable(schema: string) {
  assert.match(schema, /^myomaton_rename_test_[a-f0-9]{32}_(upgrade|fresh)$/);
  return `"${schema}"`;
}
async function readRows(client: Client, schema: string, tables: string[]): Promise<Rows> {
  assert.ok(schema === "public" || disposable(schema));
  const result: Rows = {};
  for (const table of tables) {
    assert.ok([...oldTables, ...newTables].includes(table));
    const rows = await client.query(`SELECT to_jsonb(t) AS row FROM "${schema}"."${table}" t ORDER BY id`);
    result[table] = rows.rows.map(r => r.row);
  }
  return result;
}

test("0006 preserves a customer graph on upgrade and matches fresh replay without migrating public", async () => {
  const url = process.env.ASSET_TEST_DATABASE_URL;
  assert.ok(url, "ASSET_TEST_DATABASE_URL is required; only disposable schemas are written");
  const client = new Client({ connectionString: url }); await client.connect();
  const prefix = `myomaton_rename_test_${randomUUID().replaceAll("-", "")}`;
  const upgrade = `${prefix}_upgrade`, fresh = `${prefix}_fresh`;
  const migrations = readMigrationFiles({ migrationsFolder: "lib/platform/db/migrations" });
  assert.ok(migrations.length >= 7); // This historical rehearsal covers the first seven migrations.
  const replay = async (schema: string, from: number, to: number) => {
    disposable(schema);
    await client.query("BEGIN");
    try {
      await client.query(`SET LOCAL search_path TO ${disposable(schema)}`);
      for (const migration of migrations.slice(from, to)) for (const sql of migration.sql) {
        await client.query(sql.replaceAll('"public".', `${disposable(schema)}.`));
      }
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  };
  try {
    // Read the complete real graph in a separate read-only transaction. No public
    // mutation is possible here; copied data is inserted only into the fixture.
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const journal = (await client.query("SELECT * FROM drizzle.__drizzle_migrations ORDER BY id")).rows;
    assert.ok(journal.length >= 6 && journal.length <= 9);
    assert.deepEqual(journal.map(r => ({ hash: r.hash, created_at: r.created_at })),
      migrations.slice(0, journal.length).map(m => ({ hash: m.hash, created_at: String(m.folderMillis) })));
    const live = await readRows(client, "public", journal.length === 6 ? oldTables : newTables);
    const source: Rows = journal.length === 6 ? live : {
      ...live, microsites: live.managed_sites,
      pages: live.pages.map(({ managed_site_id, ...p }) => ({ ...p, microsite_id: managed_site_id })),
    };
    await client.query("ROLLBACK");

    for (const schema of [upgrade, fresh]) await client.query(`CREATE SCHEMA ${disposable(schema)}`);
    await replay(upgrade, 0, 6);
    for (const table of oldTables) for (const row of source[table]) {
      const keys = Object.keys(row);
      assert.ok(keys.every(k => /^[a-z_]+$/.test(k)));
      // Explicit columns preserve every value, including timestamp microseconds.
      await client.query(`INSERT INTO ${disposable(upgrade)}."${table}" (${keys.map(k => `"${k}"`).join(",")})
        SELECT ${keys.map(k => `"${k}"`).join(",")} FROM jsonb_populate_record(NULL::${disposable(upgrade)}."${table}", $1::jsonb)`, [JSON.stringify(row)]);
    }
    const before = await readRows(client, upgrade, oldTables);
    const tablesBefore = (await client.query("SELECT oid FROM pg_class WHERE relnamespace=$1::regnamespace AND relkind='r' ORDER BY oid", [upgrade])).rows;
    const constraintsBefore = (await client.query("SELECT oid FROM pg_constraint WHERE connamespace=$1::regnamespace ORDER BY oid", [upgrade])).rows;
    const indexesBefore = (await client.query("SELECT indexrelid FROM pg_index JOIN pg_class ON pg_class.oid=indrelid WHERE relnamespace=$1::regnamespace ORDER BY indexrelid", [upgrade])).rows;

    // Refuse legacy visibility on either owning table, including null/conflicting
    // values. A failed migration must leave names, data and constraints intact.
    for (const table of ["navigations", "navigation_items"]) {
      assert.ok(before[table].length);
      const row = before[table][0];
      for (const value of [false, true, null]) {
        await client.query(`UPDATE ${disposable(upgrade)}."${table}" SET configuration=$1 WHERE id=$2`, [{ surfaces: { microsite: value, managedSite: true } }, row.id]);
        await assert.rejects(replay(upgrade, 6, 7), /Legacy surfaces\.microsite/);
        assert.equal((await client.query("SELECT to_regclass($1)::text AS name", [`${upgrade}.managed_sites`])).rows[0].name, null);
      }
      await client.query(`UPDATE ${disposable(upgrade)}."${table}" SET configuration=$1 WHERE id=$2`, [row.configuration, row.id]);
    }
    assert.deepEqual(await readRows(client, upgrade, oldTables), before);
    await replay(upgrade, 6, 7);
    assert.deepEqual(await readRows(client, upgrade, newTables), renamed(before), "all UUIDs, copy, JSON, versions, timestamps and relationships preserved");
    assert.deepEqual((await client.query("SELECT oid FROM pg_class WHERE relnamespace=$1::regnamespace AND relkind='r' ORDER BY oid", [upgrade])).rows, tablesBefore);
    assert.deepEqual((await client.query("SELECT oid FROM pg_constraint WHERE connamespace=$1::regnamespace ORDER BY oid", [upgrade])).rows, constraintsBefore);
    assert.deepEqual((await client.query("SELECT indexrelid FROM pg_index JOIN pg_class ON pg_class.oid=indrelid WHERE relnamespace=$1::regnamespace ORDER BY indexrelid", [upgrade])).rows, indexesBefore);
    const constraints = (await client.query("SELECT conname,convalidated FROM pg_constraint WHERE connamespace=$1::regnamespace", [upgrade])).rows;
    assert.ok(constraints.every(r => r.convalidated && !r.conname.includes("microsite")));
    assert.ok(constraints.some(r => r.conname === "pages_managed_site_id_not_null"));
    assert.equal(constraints.filter(r => /^managed_sites_.*_not_null$/.test(r.conname)).length, 9);
    const indexes = (await client.query("SELECT indexname FROM pg_indexes WHERE schemaname=$1", [upgrade])).rows;
    assert.ok(indexes.every(r => !r.indexname.includes("microsite")));
    for (const name of ["managed_sites_pkey", "pages_managed_site_id_slug_unique"]) assert.ok(indexes.some(r => r.indexname === name));

    await replay(fresh, 0, 7);
    await client.query("BEGIN"); await client.query("SET LOCAL search_path TO pg_catalog");
    const signature = await schemaSignature(client, upgrade, newTables);
    assert.deepEqual(signature, await schemaSignature(client, fresh, newTables));
    assert.ok(signature.indexes.every(r => r.indisvalid && r.indisready));
    await client.query("ROLLBACK");

    // The unchanged operator is schema-qualified for real operation. This test
    // bridge redirects ALL its public references to the guarded fixture schema.
    const scopedPool = { connect: async () => ({ release() {}, query: (sql: string, params?: unknown[]) => {
      const isolated = sql.replaceAll("public.", `${disposable(upgrade)}.`);
      assert.ok(!isolated.includes("public."));
      return client.query(isolated, params);
    } }) } as unknown as Pick<Pool, "connect">;
    const expectedState = renamed(before) as State;
    const operatorState = Object.fromEntries(operatorTables.map(t => [t, expectedState[t]])) as State;
    // Later customer edits may legitimately make this one-time transition refuse.
    // The rename must preserve either exact no-op or the original refusal.
    let accepted = false;
    try { accepted = !planHomeV1(operatorState).changed; } catch { /* canonical customization */ }
    if (accepted) {
      assert.equal((await updateMyomatonHomeV1(scopedPool)).changed, false);
      assert.equal((await updateMyomatonHomeV1(scopedPool)).changed, false);
    } else await assert.rejects(updateMyomatonHomeV1(scopedPool), /Home v1 conflict/);
    assert.deepEqual(await readRows(client, upgrade, newTables), renamed(before));
    const section = before.sections[0];
    await client.query(`UPDATE ${disposable(upgrade)}.sections SET content='{"heading":"Customized rehearsal"}' WHERE id=$1`, [section.id]);
    await assert.rejects(updateMyomatonHomeV1(scopedPool), /Home v1 conflict/);
    await client.query(`UPDATE ${disposable(upgrade)}.sections SET content=$1 WHERE id=$2`, [section.content, section.id]);
    assert.deepEqual(await readRows(client, upgrade, newTables), renamed(before));

    // The live site can have evolved to Page Navigation. Establish the historical
    // anchor cases explicitly in this fixture instead of requiring old customer data.
    const aboutSection = before.sections.find(s => (s.configuration as { anchor?: string })?.anchor === "about")!;
    const aboutAction = before.actions.find(a => a.destination === "#about")!;
    const primary = before.navigations.find(n => n.name === "Primary Navigation")!;
    assert.ok(aboutSection && aboutAction && primary);
    for (const [type, reference] of [["section", aboutSection.id], ["action", aboutAction.id]]) {
      if (!before.navigation_items.some(i => i.navigation_id === primary.id && i.target_type === type && i.target_reference === reference)) {
        await client.query(`INSERT INTO ${disposable(upgrade)}.navigation_items
          (navigation_id,name,label,target_type,target_reference,sort_order) VALUES ($1,$2,$2,$3,$4,100)`,
          [primary.id, `Rehearsal ${type}`, type, reference]);
      }
    }
    const server = await startProductionFixture(url, upgrade, assetRoot(), { webPresenceId: "1b72cd7d-92b9-4f55-aba6-825d69d493af", managedSiteId: "7fd60824-a933-401d-8099-7b64f24cc408" });
    try {
      const home = await fetch(server.base); assert.equal(home.status, 200);
      const document = new JSDOM(await home.text()).window.document;
      assert.equal(document.title, "Myomaton"); assert.equal(document.querySelectorAll("main > section").length, 9);
      assert.equal(document.querySelectorAll('nav a[href="#about"]').length, 2);
      const photo = document.querySelector("img.managed-site-photo"); assert.ok(photo);
      const src = photo.getAttribute("src")!; const media = await fetch(server.base + src); assert.equal(media.status, 200);
      const asset = before.assets.find(a => src.endsWith(String(a.id)))!; assert.ok(asset);
      assert.equal(media.headers.get("content-type"), asset.mime_type);
      assert.deepEqual(Buffer.from(await media.arrayBuffer()), await readManagedObject(assetRoot(), String(asset.web_presence_id), String(asset.source_reference)));
      for (const path of ["/unknown", "/teams/northeast", "/media/unknown", "/a%2Fb"]) assert.equal((await fetch(server.base + path)).status, 404);
      // Secondary content is created only in this disposable schema.
      const secondary = (await client.query(`INSERT INTO ${disposable(upgrade)}.pages (managed_site_id,slug,name,title) VALUES ($1,'/teams/northeast','Northeast','Northeast team') RETURNING id`, [before.microsites[0].id])).rows[0];
      await client.query(`INSERT INTO ${disposable(upgrade)}.sections (page_id,type,content) VALUES ($1,'intro',$2)`, [secondary.id, { heading: "Team", text: "First.\n\nSecond." }]);
      const response = await fetch(server.base + "/teams/northeast"); assert.equal(response.status, 200);
      const secondaryDoc = new JSDOM(await response.text()).window.document;
      assert.equal(secondaryDoc.title, "Northeast team"); assert.equal(secondaryDoc.querySelectorAll("main p").length, 2);
      assert.ok(secondaryDoc.querySelector('nav a[href="/#about"]')); assert.ok(secondaryDoc.querySelector('nav a[href="#about"]'));
    } finally { await server.stop(); }
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    assert.deepEqual(await readRows(client, "public", journal.length === 6 ? oldTables : newTables), live);
    assert.deepEqual((await client.query("SELECT * FROM drizzle.__drizzle_migrations ORDER BY id")).rows, journal);
    await client.query("ROLLBACK");
    console.log(`Rename rehearsal: upgrade/fresh fidelity passed; Home v1 ${accepted ? "exact no-op twice" : "customization refusal preserved"}; production routing/media passed; public unchanged.`);
  } finally {
    await client.query("ROLLBACK");
    for (const schema of [upgrade, fresh]) await client.query(`DROP SCHEMA IF EXISTS ${disposable(schema)} CASCADE`);
    await client.end();
  }
});
