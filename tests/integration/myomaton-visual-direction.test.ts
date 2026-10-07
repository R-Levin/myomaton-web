import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { Client, Pool } from "pg";
import { JSDOM } from "jsdom";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { baseline, tables, siteId, updateVisualDirectionV1, type State } from "../../scripts/customer-updates/myomaton-visual-direction-v1";
import { startProductionFixture } from "./production-server";
import { assetRoot } from "../../lib/platform/assets/local-storage";

test("disposable PostgreSQL operator rollback/no-op and all four production preview routes", async () => {
  const url = process.env.ASSET_TEST_DATABASE_URL; assert.ok(url, "ASSET_TEST_DATABASE_URL required; only disposable schema writes");
  const schema = `myomaton_visual_test_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, /^myomaton_visual_test_[a-f0-9]{32}$/);
  const quoted = `"${schema}"`;
  const c = new Client({ connectionString: url }); await c.connect();
  let server: Awaited<ReturnType<typeof startProductionFixture>> | undefined;
  const read = async (scope: "public" | typeof schema) => {
    assert.ok(scope === "public" || scope === schema);
    const state = {} as State;
    for (const t of tables) state[t] = (await c.query(`SELECT to_jsonb(t) AS row FROM "${scope}".${t} t ORDER BY id`)).rows.map(r => r.row);
    const journal = scope === "public" ? "drizzle.__drizzle_migrations" : `${quoted}.migration_fixture`;
    state.migrations = (await c.query(`SELECT to_jsonb(t) AS row FROM ${journal} t ORDER BY id`)).rows.map(r => r.row);
    return state;
  };
  try {
    await c.query("SET TIME ZONE 'UTC'");
    await c.query("BEGIN READ ONLY"); const publicBefore = await read("public"); await c.query("ROLLBACK");
    await c.query(`CREATE SCHEMA ${quoted}`);
    // Table copies are disposable fixtures, not a migration/replacement schema.
    // LIKE copies constraints/indexes but not FKs; production relationships are
    // guarded by the complete frozen row comparison. No Asset bytes are copied.
    for (const t of tables) {
      await c.query(`CREATE TABLE ${quoted}.${t} (LIKE public.${t} INCLUDING ALL)`);
      for (const row of baseline[t]) await c.query(`INSERT INTO ${quoted}.${t} SELECT * FROM jsonb_populate_record(NULL::${quoted}.${t},$1::jsonb)`, [JSON.stringify(row)]);
    }
    await c.query(`CREATE TABLE ${quoted}.migration_fixture (LIKE drizzle.__drizzle_migrations INCLUDING ALL)`);
    for (const row of baseline.migrations) await c.query(`INSERT INTO ${quoted}.migration_fixture SELECT * FROM jsonb_populate_record(NULL::${quoted}.migration_fixture,$1::jsonb)`,[JSON.stringify(row)]);
    const fixturePool = (fail: boolean) => ({ connect: async () => ({ release() {}, query: async (sql: string, values?: unknown[]) => {
      // Production updater hardcodes public intentionally. Only this isolated
      // test adapter rewrites that qualifier, never the real CLI or implementation.
      const scoped = sql.replaceAll("public.", `${quoted}.`).replaceAll("drizzle.__drizzle_migrations",`${quoted}.migration_fixture`);
      assert.ok(!scoped.includes("public.") && !scoped.includes("drizzle."));
      const result = await c.query(scoped, values);
      if (fail && sql.startsWith("UPDATE")) throw Error("forced after PostgreSQL write");
      return result;
    } }) }) as unknown as Pick<Pool, "connect">;
    await assert.rejects(updateVisualDirectionV1(fixturePool(true)), /forced/);
    assert.deepEqual(await read(schema), baseline);
    assert.deepEqual(await updateVisualDirectionV1(fixturePool(false)), { changed: true, inserted: 0, updated: 1, deleted: 0 });
    const applied = await read(schema);
    assert.deepEqual(await updateVisualDirectionV1(fixturePool(false)), { changed: false, inserted: 0, updated: 0, deleted: 0 });
    assert.deepEqual(await read(schema), applied);
    const config = applied.managed_sites.find(s => s.id === siteId)!.configuration;
    assert.deepEqual({ ...applied, managed_sites: baseline.managed_sites }, baseline);
    assert.ok(config);
    server = await startProductionFixture(url, schema, assetRoot(), { webPresenceId: "1b72cd7d-92b9-4f55-aba6-825d69d493af", managedSiteId: "7fd60824-a933-401d-8099-7b64f24cc408" });
    for (const page of baseline.pages) {
      const response: Response = await fetch(server.base + page.slug); assert.equal(response.status, 200);
      const doc = new JSDOM(await response.text()).window.document;
      const expected = baseline.sections.filter(s => s.page_id === page.id).sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
      const sections = [...doc.querySelectorAll("main > section")]; assert.equal(sections.length, expected.length);
      assert.equal(doc.querySelector("[data-visual-direction]")?.getAttribute("data-visual-direction"), "reference");
      assert.equal(doc.querySelector("[data-elevation]")?.getAttribute("data-elevation"), "subtle");
      assert.equal(doc.querySelector("[data-backdrop]")?.getAttribute("data-backdrop"), "opaque");
      assert.equal(sections[0].getAttribute("data-hero-treatment"), "graphic");
      assert.equal(doc.querySelectorAll("[data-motion-slot]").length, 1, "default service policy Minimal");
      for (const [i, section] of sections.entries()) {
        assert.equal(section.getAttribute("data-divider"), "none");
        assert.equal(section.getAttribute("data-surface"), i % 2 || expected[i].type === "cta" ? "subtle" : "default");
        if (section.querySelector("img")) {
          assert.equal(section.getAttribute("data-image-treatment"), "framed");
          assert.equal(section.getAttribute("data-layout"), expected[i].variant);
        }
      }
      assert.deepEqual([...doc.querySelectorAll('nav[aria-label="Primary Navigation"] a')].map(a => a.getAttribute("href")), ["/", "/projects", "/principles", "/about"]);
      assert.ok(doc.querySelector("header")); assert.ok(doc.querySelector("footer"));
      for (const image of doc.querySelectorAll<HTMLImageElement>("main img")) {
        const asset = baseline.assets.find(a => image.getAttribute("src") === `/media/assets/${a.id}`)!; assert.ok(asset);
        const media: Response = await fetch(server.base + image.getAttribute("src")); assert.equal(media.status, 200);
        assert.deepEqual(Buffer.from(await media.arrayBuffer()), await readFile(path.join(assetRoot(), String(asset.web_presence_id), String(asset.source_reference))));
      }
      console.log(`Preview ${page.slug}: ${sections.length} Sections, graphic Hero, framed images, subtle elevation, one motion consumer.`);
    }
    assert.equal((await fetch(server.base + "/unknown-visual-preview")).status, 404);
    await c.query("BEGIN READ ONLY"); assert.deepEqual(await read("public"), publicBefore); await c.query("ROLLBACK");
  } finally {
    await server?.stop();
    await c.query("ROLLBACK");
    await c.query(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`);
    await c.end();
  }
});
