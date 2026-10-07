import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { JSDOM } from "jsdom";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { startProductionFixture } from "./production-server";
import { assetRoot } from "../../lib/platform/assets/local-storage";
import { baseline } from "../../scripts/customer-updates/myomaton-visual-direction-v2";

test("reference v2 four-Page production preview uses disposable state and unchanged managed bytes", async () => {
  const url = process.env.ASSET_TEST_DATABASE_URL; assert.ok(url);
  const schema = `myomaton_visual_test_${randomUUID().replaceAll("-", "")}`;
  const quoted = `"${schema}"`;
  const c = new Client({ connectionString: url }); await c.connect();
  let server: Awaited<ReturnType<typeof startProductionFixture>> | undefined;
  const snapshot = async () => {
    await c.query("BEGIN READ ONLY");
    try {
      const tables = (await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r => r.tablename as string);
      const state: Record<string, Record<string, unknown>[]> = {};
      for (const table of tables) {
        assert.match(table, /^[a-z_]+$/);
        state[table] = (await c.query(`SELECT to_jsonb(t) AS row FROM public.${table} t ORDER BY to_jsonb(t)::text`)).rows.map(r => r.row);
      }
      state.migrations = (await c.query("SELECT to_jsonb(t) AS row FROM drizzle.__drizzle_migrations t ORDER BY id")).rows.map(r => r.row);
      return state;
    } finally { await c.query("ROLLBACK"); }
  };
  try {
    const realBefore = await snapshot();
    // Exercise the approved pre-transition fixture, even after real v2 is applied.
    // Public state is only read and compared before/after.
    const before = { ...realBefore, ...baseline };
    await c.query(`CREATE SCHEMA ${quoted}`);
    for (const table of Object.keys(before).filter(t => t !== "migrations")) {
      await c.query(`CREATE TABLE ${quoted}.${table} (LIKE public.${table} INCLUDING ALL)`);
      if (Object.hasOwn(baseline, table)) {
        for (const row of baseline[table as keyof typeof baseline]) await c.query(`INSERT INTO ${quoted}.${table} SELECT * FROM jsonb_populate_record(NULL::${quoted}.${table},$1::jsonb)`, [JSON.stringify(row)]);
      } else await c.query(`INSERT INTO ${quoted}.${table} SELECT * FROM public.${table}`);
    }
    // The only preview mutation is in a disposable schema, never public.
    await c.query(`UPDATE ${quoted}.managed_sites SET configuration=jsonb_set(configuration,'{visualDirection,profileVersion}','2') WHERE configuration->'visualDirection'->>'profileId'='reference'`);
    const presentation = JSON.parse(await readFile("scripts/previews/myomaton-composition.json", "utf8"));
    for (const [id, config] of Object.entries(presentation.sections)) await c.query(`UPDATE ${quoted}.sections SET configuration=configuration || $2::jsonb WHERE id=$1`, [id, JSON.stringify(config)]);
    await c.query(`UPDATE ${quoted}.design_systems SET configuration=jsonb_set(configuration,'{colors}',(configuration->'colors') || $1::jsonb)`, [JSON.stringify(presentation.colors)]);
    for (const [pageId, order] of Object.entries(presentation.pageOrder as Record<string, string[]>)) for (const [index, id] of order.entries()) await c.query(`UPDATE ${quoted}.sections SET sort_order=$3 WHERE id=$1 AND page_id=$2`, [id, pageId, (index + 1) * 10]);
      for (const id of presentation.promoteLead ?? []) {
        const content = { ...(before.sections.find(s => s.id === id)!.content as { heading: string; text: string }) };
        const [lead, ...support] = content.text.split(/\n\s*\n/);
        content.heading = lead.trim(); content.text = support.join("\n\n");
        await c.query(`UPDATE ${quoted}.sections SET content=$2::jsonb WHERE id=$1`, [id, JSON.stringify(content)]);
      }
      for (const id of presentation.inactiveSections ?? []) await c.query(`UPDATE ${quoted}.sections SET status='inactive' WHERE id=$1`, [id]);
      for (const [id, assetId] of Object.entries(presentation.imageSelections ?? {})) await c.query(`UPDATE ${quoted}.asset_usages SET asset_id=$2 WHERE id=$1`, [id, assetId]);
      for (const [id, label] of Object.entries(presentation.actionLabels ?? {})) await c.query(`UPDATE ${quoted}.actions SET label=$2 WHERE id=$1`, [id, label]);
    for (const [id, actionId] of Object.entries(presentation.actions)) await c.query(`UPDATE ${quoted}.sections SET content=jsonb_set(content,'{actionId}',$2::jsonb) WHERE id=$1`, [id, JSON.stringify(actionId)]);
    server = await startProductionFixture(url, schema, assetRoot(), { webPresenceId: "1b72cd7d-92b9-4f55-aba6-825d69d493af", managedSiteId: "7fd60824-a933-401d-8099-7b64f24cc408" });
    for (const page of before.pages) {
      const response: Response = await fetch(server.base + page.slug); assert.equal(response.status, 200);
      const doc = new JSDOM(await response.text()).window.document;
      assert.equal(doc.querySelector("[data-visual-version]")?.getAttribute("data-visual-version"), "2");
      assert.equal(doc.querySelectorAll("main > section").length, before.sections.filter(s => s.page_id === page.id && !presentation.inactiveSections.includes(s.id)).length);
      const originals = (presentation.pageOrder[page.id as string] as string[]).filter(id => !presentation.inactiveSections.includes(id)).map(id => before.sections.find(s => s.id === id)!);
      const rendered = [...doc.querySelectorAll("main > section")];
      for (const [index, source] of originals.entries()) {
        const content = { ...(source.content as { heading?: string; text?: string; actionId?: string }) };
        if (presentation.promoteLead.includes(source.id)) { const [lead, ...support] = content.text!.split(/\n\s*\n/); content.heading = lead.trim(); content.text = support.join("\n\n"); }
        assert.equal(rendered[index].querySelector("h1,h2")?.textContent, content.heading);
        if (content.text) assert.deepEqual([...rendered[index].querySelectorAll(".managed-site-section-copy p")].filter(p => !p.classList.contains("managed-site-eyebrow")).map(p => p.textContent), content.text.split(/\n\s*\n/).map(p => p.trim()));
        const actionId = presentation.actions[source.id as string] ?? content.actionId;
        if (actionId) {
          const action = before.actions.find(a => a.id === actionId)!;
          const destination = action.type === "page" ? before.pages.find(p => p.id === action.destination)?.slug ?? action.destination : action.destination;
          assert.equal(rendered[index].querySelector(".managed-site-action")?.getAttribute("href"), destination);
          assert.equal(rendered[index].querySelector(".managed-site-action")?.textContent, presentation.actionLabels[actionId] ?? action.label);
        }
      }
      assert.equal(doc.querySelector("main > section")?.getAttribute("data-surface"), "contrast");
      assert.equal(doc.querySelectorAll("[data-motion-slot]").length, 1);
      assert.equal(doc.querySelectorAll("[data-decoration]").length, 0);
      const entrance = doc.querySelector('[data-motion-entrance="initial"]');
      assert.ok(entrance?.classList.contains("managed-site-section-hero"));
      assert.equal(entrance?.getAttribute("data-motion-slot"), "0");
      assert.equal(doc.querySelectorAll("[data-motion-entrance]").length, 1);
      assert.equal(doc.querySelectorAll('[data-decoration="group"]').length, 0);
      const cards = [...doc.querySelectorAll(".managed-site-collection-item")];
      assert.ok(cards.every(card => card.className === "managed-site-collection-item" && !card.hasAttribute("style")));
      assert.equal(doc.querySelector("main > section")?.getAttribute("data-composition"), "asymmetric-field");
      assert.deepEqual([...doc.querySelectorAll('nav[aria-label="Primary Navigation"] a')].map(a => a.getAttribute("href")), ["/", "/projects", "/principles", "/about"]);
      for (const image of doc.querySelectorAll("main img")) {
        const asset = before.assets.find(a => image.getAttribute("src") === `/media/assets/${a.id}`)!; assert.ok(asset);
        const media: Response = await fetch(server.base + image.getAttribute("src")); assert.equal(media.status, 200);
        assert.deepEqual(Buffer.from(await media.arrayBuffer()), await readFile(path.join(assetRoot(), String(asset.web_presence_id), String(asset.source_reference))));
      }
      const sourceHeroSection = before.sections.find(s => s.page_id === page.id && s.type === "hero")!;
      const sourceHero = sourceHeroSection.content as { heading: string; text: string };
      assert.equal(doc.querySelector('[data-hero-part="heading"] h1')?.textContent, presentation.promoteLead.includes(sourceHeroSection.id) ? sourceHero.text.split(/\n\s*\n/)[0].trim() : sourceHero.heading);
      assert.equal(doc.querySelector('[data-hero-part="support"]') !== null, true);
      assert.equal(doc.querySelectorAll('[data-section-role="statement"]').length, page.slug === "/projects" ? 0 : 1);
      assert.equal(doc.querySelectorAll('[data-surface="editorial"]').length, page.slug === "/principles" ? 1 : 0);
      assert.equal(doc.querySelector("main > section")?.getAttribute("style")?.includes("--hero-support-delay:100ms"), true);
      console.log(`${page.slug}: v2, asymmetric ink Hero, explicit compositions, one motion consumer, no ornament, canonical Navigation and media bytes`);
    }
    assert.equal((await fetch(server.base + "/unknown-expression-preview")).status, 404);
    assert.deepEqual(await snapshot(), realBefore);
  } finally {
    await server?.stop();
    await c.query(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`); await c.end();
  }
});
