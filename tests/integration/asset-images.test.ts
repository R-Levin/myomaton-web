import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client, Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import { prepareManagedBytes } from "../../lib/platform/assets/ingestion";
import { provisionManagedObject, readManagedObject } from "../../lib/platform/assets/local-storage";
import { importManagedAssets } from "../../scripts/operator-assets/import-managed-assets";
import { mediaFixtures } from "../helpers/managed-media";

import { eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { organizations } from "../../lib/platform/db/schema/organizations";
import { webPresences } from "../../lib/platform/db/schema/web-presences";
import { microsites } from "../../lib/platform/db/schema/microsites";
import { pages } from "../../lib/platform/db/schema/pages";
import { sections } from "../../lib/platform/db/schema/sections";
import { assets } from "../../lib/platform/db/schema/assets";
import { assetUsages } from "../../lib/platform/db/schema/asset-usages";
import { attachSectionAsset } from "../../lib/platform/assets/writes";
import { publicAsset, sectionImages } from "../../lib/platform/assets/presentation-queries";
import { bootstrapMyomatonPhoto } from "../../scripts/customer-bootstrap/myomaton-photo";
import { deliverPublicAsset } from "../../lib/platform/assets/delivery";

import { startProductionFixture } from "./production-server";
import { assertMigrationFidelity, assertFixtureFidelity, fixtureTables } from "./schema-fidelity";

// Required explicit opt-in. Clone definitions into a randomly named schema.
// All fixtures use that schema; public Myomaton records are never mutated.
test("live PostgreSQL Asset write, presentation, delivery and operator integrity", async (t) => {
  const adminUrl = process.env.ASSET_TEST_DATABASE_URL;
  assert.ok(adminUrl, "ASSET_TEST_DATABASE_URL is required (role needs CREATE SCHEMA); integration tests never silently skip.");
  const name = `myomaton_asset_test_${randomUUID().replaceAll("-", "")}`;
  assert.match(name, /^myomaton_asset_test_[a-f0-9]{32}$/);
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  let created = false;
  let pool: Pool | undefined;
  const temp = await mkdtemp(path.join(os.tmpdir(), "asset-pg-"));
  try {
    await assertMigrationFidelity(admin, name);
    await admin.query(`CREATE SCHEMA "${name}"`); created = true;
    pool = new Pool({ connectionString: adminUrl, options: `-c search_path=${name},public` });
    const db = drizzle({ client: pool });
    const tables = fixtureTables;
    for (const table of tables) await admin.query(`CREATE TABLE "${name}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
    const foreignKeys = await admin.query<{ table_name: string; name: string; definition: string }>(
      "SELECT rel.relname AS table_name, con.conname AS name, pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con JOIN pg_class rel ON rel.oid=con.conrelid JOIN pg_namespace ns ON ns.oid=rel.relnamespace WHERE ns.nspname='public' AND con.contype='f' AND rel.relname=ANY($1::text[])", [tables]);
    for (const fk of foreignKeys.rows) {
      const definition = fk.definition.replace(/REFERENCES (?:public\.)?([a-z_]+)/, (_match, target: string) => {
        assert.ok(tables.includes(target), "Foreign key must stay within fixture schema");
        return `REFERENCES "${name}"."${target}"`;
      });
      assert.ok(definition.includes(`REFERENCES "${name}".`));
      await admin.query(`ALTER TABLE "${name}"."${fk.table_name}" ADD CONSTRAINT "${fk.name}" ${definition}`);
    }
    await assertFixtureFidelity(admin, name);
    const scope = await pool.query("SELECT current_schema() AS schema"); assert.equal(scope.rows[0].schema, name);
    async function fixture(myomaton = false) {
      const [org] = await db.insert(organizations).values({ name: "Disposable test" }).returning();
      const [presence] = await db.insert(webPresences).values({ organizationId: org.id, name: myomaton ? "Myomaton" : "Test", primaryDomain: myomaton ? "myomaton.com" : `${randomUUID()}.test` }).returning();
      const [site] = await db.insert(microsites).values({ webPresenceId: presence.id, name: "Myomaton" }).returning();
      const [page] = await db.insert(pages).values({ micrositeId: site.id, name: "Home", title: "Home", slug: "/" }).returning();
      const [section] = await db.insert(sections).values({ pageId: page.id, type: "intro", name: "Introduction", content: { text: "Preserve" }, metadata: { custom: true } }).returning();
      return { presence, site, page, section };
    }
    const first = await fixture(); const second = await fixture();
    await t.test("standalone batch import preserves PNG, creates no usages, refuses duplicates and rolls back atomically", async () => {
      const target = await fixture();
      const root = path.join(temp, "standalone-storage");
      const file = path.join(temp, "standalone-one.png"), otherFile = path.join(temp, "standalone-two.png");
      const png = await sharp({ create: { width: 12, height: 9, channels: 4, background: "blue" } }).png().toBuffer();
      const otherPng = await sharp({ create: { width: 13, height: 10, channels: 4, background: "green" } }).png().toBuffer();
      await writeFile(file, png); await writeFile(otherFile, otherPng);
      const items = [
        { file, assetId: randomUUID(), name: "Fixture close-up", altText: "Approved fixture one" },
        { file: otherFile, assetId: randomUUID(), name: "Fixture angle", altText: "Approved fixture two" },
      ];
      const beforeUsages = await db.select().from(assetUsages);
      const beforeSections = await db.select().from(sections);
      const beforeAssets = await db.select().from(assets);
      const options = { webPresenceId: target.presence.id, root, items };
      await assert.rejects(importManagedAssets(db, { ...options, items: [items[0], { ...items[1], file }] }), /Duplicate prepared/);
      await assert.rejects(importManagedAssets(db, { ...options, items: [items[0], { ...items[1], assetId: items[0].assetId }] }), /Duplicate Asset UUID/);
      await assert.rejects(importManagedAssets(db, { ...options, webPresenceId: randomUUID() }), /Active Web Presence not found/);
      assert.deepEqual(await db.select().from(assets), beforeAssets);
      const imported = await importManagedAssets(db, options);
      assert.equal(imported.length, 2);
      for (const [index, row] of imported.entries()) {
        assert.equal(row.id, items[index].assetId); assert.equal(row.name, items[index].name);
        assert.equal(row.altText, items[index].altText); assert.equal(row.webPresenceId, target.presence.id);
        assert.equal(row.mimeType, "image/png"); assert.equal(row.type, "image");
        assert.equal(row.width, 12 + index); assert.equal(row.height, 9 + index);
        assert.equal(row.status, "active"); assert.equal(row.sourceType, "managed");
        assert.equal(row.assetUsageCreated, false);
        const prepared = await prepareManagedBytes(index ? otherPng : png);
        assert.deepEqual(await readManagedObject(root, target.presence.id, row.sourceReference), prepared.bytes);
      }
      assert.deepEqual(await db.select().from(assetUsages), beforeUsages);
      assert.deepEqual(await db.select().from(sections), beforeSections);
      const afterAssets = await db.select().from(assets).orderBy(assets.id);
      await assert.rejects(importManagedAssets(db, options), /Existing Asset UUID or same managed bytes/);
      await assert.rejects(importManagedAssets(db, { ...options, items: items.map(item => ({ ...item, assetId: randomUUID() })) }), /same managed bytes/);
      assert.deepEqual(await db.select().from(assets).orderBy(assets.id), afterAssets);
      await db.update(assets).set({ status: "inactive" }).where(eq(assets.id, items[0].assetId));
      await assert.rejects(importManagedAssets(db, { ...options, items: [{ ...items[0], assetId: randomUUID() }] }), /same managed bytes/);
      // The same UUID is a conflict even when requested in a different tenant.
      await assert.rejects(importManagedAssets(db, { ...options, webPresenceId: second.presence.id }), /Existing Asset UUID/);
      const rollbackTarget = await fixture();
      const rollbackOptions = { ...options, webPresenceId: rollbackTarget.presence.id, items: items.map(item => ({ ...item, assetId: randomUUID() })) };
      await assert.rejects(db.transaction(async tx => {
        await importManagedAssets(tx, rollbackOptions);
        throw new Error("Forced import rollback");
      }), /Forced import rollback/);
      assert.deepEqual(await db.select().from(assets).where(eq(assets.webPresenceId, rollbackTarget.presence.id)), []);
      // Retry uses the immutable objects left by rollback, not new Asset identities for duplicates.
      assert.equal((await importManagedAssets(db, rollbackOptions)).length, 2);
      const concurrentTarget = await fixture();
      const concurrentOptions = { ...options, webPresenceId: concurrentTarget.presence.id, items: [{ ...items[0], assetId: randomUUID() }] };
      const outcomes = await Promise.allSettled([
        importManagedAssets(db, concurrentOptions),
        importManagedAssets(db, { ...concurrentOptions, items: [{ ...items[0], assetId: randomUUID() }] }),
      ]);
      assert.equal(outcomes.filter(outcome => outcome.status === "fulfilled").length, 1);
      assert.equal((await db.select().from(assets).where(eq(assets.webPresenceId, concurrentTarget.presence.id))).length, 1);
      assert.deepEqual(await db.select().from(assetUsages), beforeUsages);
    });
    const input = (f = first, id = randomUUID()) => ({ webPresenceId: f.presence.id, sectionId: f.section.id, assetId: id, type: "image" as const, mimeType: "image/jpeg", role: "image" as const, name: "Photo", altText: "Approved photo", width: 8, height: 6, sourceReference: `objects/${"a".repeat(64)}` });
    const firstInput = input();
    await t.test("writer creates once, preserves Section and canonical Asset fields, and rejects conflicts", async () => {
      assert.equal((await attachSectionAsset(db, firstInput)).created, true);
      let provisioned = false;
      assert.equal((await attachSectionAsset(db, { ...firstInput, altText: "Do not overwrite" }, async () => { provisioned = true; })).created, false);
      assert.equal(provisioned, false);
      const [asset] = await db.select().from(assets).where(eq(assets.id, firstInput.assetId)); assert.equal(asset.altText, "Approved photo");
      const [section] = await db.select().from(sections).where(eq(sections.id, first.section.id)); assert.deepEqual(section, first.section);
      await assert.rejects(attachSectionAsset(db, input()), /occupied/);
      await assert.rejects(attachSectionAsset(db, { ...input(), sectionId: randomUUID() }), /not found/);
      await assert.rejects(attachSectionAsset(db, { ...input(), sectionId: second.section.id }), /not found/);
      await assert.rejects(attachSectionAsset(db, { ...input(second), assetId: firstInput.assetId }), /another Web Presence/);
    });
    await t.test("PostgreSQL rejects cross-presence, missing, duplicate and referenced-delete operations", async () => {
      const usage = { webPresenceId: first.presence.id, assetId: firstInput.assetId, entityType: "section", entityId: first.section.id, role: "image" };
      const code = (expected: string) => (error: unknown) => (error as { cause?: { code?: string } }).cause?.code === expected;
      await assert.rejects(db.insert(assetUsages).values({ ...usage, webPresenceId: second.presence.id }), code("23503"));
      await assert.rejects(db.insert(assetUsages).values({ ...usage, assetId: randomUUID() }), code("23503"));
      await assert.rejects(db.insert(assetUsages).values(usage), code("23505"));
      await assert.rejects(db.delete(assets).where(eq(assets.id, firstInput.assetId)), code("23503"));
    });
    await t.test("dependent writes roll back when usage insertion fails", async () => {
      // Isolated test schema only: force failure after Asset insertion to verify the
      // writer's actual transaction, rather than simulating an early rejection.
      await db.execute(sql`CREATE FUNCTION reject_test_usage() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test usage failure'; END $$`);
      await db.execute(sql`CREATE TRIGGER reject_test_usage BEFORE INSERT ON asset_usages FOR EACH ROW EXECUTE FUNCTION reject_test_usage()`);
      const failed = input(second);
      try { await assert.rejects(attachSectionAsset(db, failed)); }
      finally { await db.execute(sql`DROP TRIGGER reject_test_usage ON asset_usages`); await db.execute(sql`DROP FUNCTION reject_test_usage()`); }
      assert.equal((await db.select().from(assets).where(eq(assets.id, failed.assetId))).length, 0);
      await assert.rejects(attachSectionAsset(db, failed, async () => { throw new Error("storage failed"); }), /storage failed/);
      assert.equal((await db.select().from(assets).where(eq(assets.id, failed.assetId))).length, 0);
    });
    await t.test("concurrent writers serialize singular role and ambiguity is rejected", async () => {
      const candidates = [input(second), input(second)];
      const results = await Promise.allSettled(candidates.map((candidate) => attachSectionAsset(db, candidate)));
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(results.filter((r) => r.status === "rejected").length, 1);
      const [extra] = await db.insert(assets).values({ webPresenceId: second.presence.id, name: "extra", mimeType: "image/jpeg", sourceType: "managed", sourceReference: firstInput.sourceReference }).returning();
      await db.insert(assetUsages).values({ webPresenceId: second.presence.id, assetId: extra.id, entityType: "section", entityId: second.section.id, role: "image" });
      await assert.rejects(attachSectionAsset(db, candidates[0]), /ambiguous/);
      await assert.rejects(sectionImages(db, second.presence.id, [second.section.id]), /Ambiguous/);
    });
    await t.test("presentation follows ownership, active ancestors, role, and excludes source details", async () => {
      const images = await sectionImages(db, first.presence.id, [first.section.id]);
      assert.equal(images.get(first.section.id)?.assetId, firstInput.assetId);
      assert.ok(!JSON.stringify([...images]).includes("sourceReference"));
      assert.equal((await sectionImages(db, second.presence.id, [first.section.id])).size, 0);
      assert.equal(await publicAsset(db, first.presence.primaryDomain!, randomUUID()), null);
      for (const [table, id] of [[assets, firstInput.assetId], [sections, first.section.id], [pages, first.page.id], [microsites, first.site.id], [webPresences, first.presence.id]] as const) {
        await db.update(table).set({ status: "inactive" }).where(eq(table.id, id));
        assert.equal((await sectionImages(db, first.presence.id, [first.section.id])).size, 0);
        assert.equal(await publicAsset(db, first.presence.primaryDomain!, firstInput.assetId), null);
        await db.update(table).set({ status: "active" }).where(eq(table.id, id));
      }
      await db.update(assetUsages).set({ role: "social" }).where(eq(assetUsages.assetId, firstInput.assetId));
      assert.equal((await sectionImages(db, first.presence.id, [first.section.id])).size, 0);
      await db.update(assetUsages).set({ role: "image" }).where(eq(assetUsages.assetId, firstInput.assetId));
    });
    await t.test("malformed polymorphic target associations cannot expose another presence's Asset", async () => {
      const target = await fixture();
      await db.insert(assetUsages).values({ webPresenceId: first.presence.id, assetId: firstInput.assetId, entityType: "section", entityId: target.section.id, role: "image" });
      assert.equal((await sectionImages(db, target.presence.id, [target.section.id])).size, 0);
      assert.equal(await publicAsset(db, target.presence.primaryDomain!, firstInput.assetId), null);
      await assert.rejects(attachSectionAsset(db, input(target)), /occupied/);
    });
    await t.test("all supported representations persist and deliver with ownership and usage eligibility", async () => {
      const server = process.env.ASSET_TEST_PRODUCTION === "1" ? await startProductionFixture(adminUrl, name, temp) : null;
      try { for (const bytes of await mediaFixtures()) {
        const f = await fixture();
        await db.update(webPresences).set({ primaryDomain: "myomaton.com" }).where(eq(webPresences.id, f.presence.id));
        const prepared = await prepareManagedBytes(bytes);
        const candidate = { ...input(f), ...prepared, role: prepared.type === "image" ? "image" as const : "attachment" as const };
        await attachSectionAsset(db, candidate, () => provisionManagedObject(temp, f.presence.id, prepared.sourceReference, prepared.bytes));
        const [stored] = await db.select().from(assets).where(eq(assets.id, candidate.assetId));
        assert.equal(stored.mimeType, prepared.mimeType); assert.equal(stored.type, prepared.type);
        assert.equal(stored.width, prepared.width); assert.equal(stored.height, prepared.height);
        const lookup = (id: string) => publicAsset(db, "myomaton.com", id);
        const response = await deliverPublicAsset(candidate.assetId, lookup, temp);
        assert.equal(response.status, 200); assert.equal(response.headers.get("content-type"), prepared.mimeType);
        if (server) {
          const live = await fetch(`${server.base}/media/assets/${candidate.assetId}`);
          assert.equal(live.status, 200, `Production ${prepared.mimeType}`);
          assert.equal(live.headers.get("content-type"), prepared.mimeType);
          assert.deepEqual(Buffer.from(await live.arrayBuffer()), prepared.bytes);
        }
        assert.equal(await publicAsset(db, first.presence.primaryDomain!, candidate.assetId), null);
        await db.delete(assetUsages).where(eq(assetUsages.assetId, candidate.assetId));
        assert.equal((await deliverPublicAsset(candidate.assetId, lookup, temp)).status, 404);
        if (server) assert.equal((await fetch(`${server.base}/media/assets/${candidate.assetId}`)).status, 404);
        await db.update(webPresences).set({ primaryDomain: f.presence.primaryDomain }).where(eq(webPresences.id, f.presence.id));
      } } finally { await server?.stop(); }
    });
    await t.test("fidelity checks detect altered fixture constraints", async () => {
      await admin.query(`ALTER TABLE "${name}".assets DROP CONSTRAINT assets_width_positive`);
      try { await assert.rejects(assertFixtureFidelity(admin, name), /Fixture constraints/); }
      finally { await admin.query(`ALTER TABLE "${name}".assets ADD CONSTRAINT assets_width_positive CHECK (width IS NULL OR width > 0)`); }
      await assertFixtureFidelity(admin, name);
    });
    await t.test("operator initialization uses current state only; no marker, no overwrites, real delivery eligibility", async () => {
      const f = await fixture(true);
      const file = path.join(temp, "input.jpg");
      await writeFile(file, await sharp({ create: { width: 8, height: 6, channels: 3, background: "blue" } }).jpeg().toBuffer());
      const options = { file, root: path.join(temp, "store"), assetId: randomUUID(), name: "Robot", altText: "Approved robot photograph" };
      assert.equal((await bootstrapMyomatonPhoto(db, options)).created, true);
      assert.equal((await bootstrapMyomatonPhoto(db, { ...options, name: "Do not overwrite" })).created, false);
      await db.update(assets).set({ status: "inactive" }).where(eq(assets.id, options.assetId));
      assert.equal((await bootstrapMyomatonPhoto(db, options)).created, false);
      assert.equal((await db.select().from(assets).where(eq(assets.id, options.assetId)))[0].status, "inactive");
      await db.update(assets).set({ status: "active" }).where(eq(assets.id, options.assetId));
      const [current] = await db.select().from(sections).where(eq(sections.id, f.section.id)); assert.deepEqual(current, f.section);
      const before = await readdir(path.join(options.root, f.presence.id, "objects"));
      await assert.rejects(bootstrapMyomatonPhoto(db, { ...options, assetId: randomUUID() }), /occupied/);
      assert.deepEqual(await readdir(path.join(options.root, f.presence.id, "objects")), before);
      const lookup = (id: string) => publicAsset(db, "myomaton.com", id);
      assert.equal((await deliverPublicAsset(options.assetId, lookup, options.root)).status, 200);
      assert.equal((await deliverPublicAsset(firstInput.assetId, lookup, options.root)).status, 404);
      await db.delete(assetUsages).where(eq(assetUsages.assetId, options.assetId));
      assert.equal((await deliverPublicAsset(options.assetId, lookup, options.root)).status, 404);
      assert.equal((await sectionImages(db, f.presence.id, [f.section.id])).size, 0);
      // Only another explicit operator invocation may attach it again.
      assert.equal((await bootstrapMyomatonPhoto(db, options)).created, true);
      const [after] = await db.select().from(sections).where(eq(sections.id, f.section.id)); assert.deepEqual(after, f.section);
    });
  } finally {
    await pool?.end();
    if (created) await admin.query(`DROP SCHEMA "${name}" CASCADE`);
    await admin.end();
    await rm(temp, { recursive: true, force: true });
  }
});
