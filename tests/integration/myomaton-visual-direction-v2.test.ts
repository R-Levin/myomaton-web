import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { Client, type Pool } from "pg";
import { JSDOM } from "jsdom";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { baseline, intended, tables, updateVisualDirectionV2, planVisualDirectionV2, transitionChanges, type State } from "../../scripts/customer-updates/myomaton-visual-direction-v2";
import { normalizeSection } from "../../lib/platform/managed-sites/sections";
import { resolveVisualDirection, sectionRole, sectionComposition, sectionPresentation } from "../../lib/platform/visual-direction/model";
import { visualTokens } from "../../components/managed-sites/visual-tokens";
import { startProductionFixture } from "./production-server";
import { assetRoot } from "../../lib/platform/assets/local-storage";
import { readMigrationFiles } from "drizzle-orm/migrator";

function contract(doc: Document) {
  return {
    visual: Object.fromEntries([...doc.querySelector(".managed-site")!.attributes].filter(a => a.name === "style" || a.name.startsWith("data-")).map(a => [a.name,a.value])),
    navigation: [...doc.querySelectorAll('nav[aria-label="Primary Navigation"] a')].map(a => [a.textContent,a.getAttribute("href")]),
    sections: [...doc.querySelectorAll("main > section")].map(s => ({
      attributes: Object.fromEntries([...s.attributes].filter(a => a.name.startsWith("data-") || ["id","style","class"].includes(a.name)).map(a => [a.name,a.value])),
      headings: [...s.querySelectorAll("h1,h2,h3")].map(h => h.textContent),
      paragraphs: [...s.querySelectorAll("p")].map(p => p.textContent),
      actions: [...s.querySelectorAll(".managed-site-action")].map(a => [a.textContent,a.getAttribute("href"),a.getAttribute("data-action-role")]),
      images: [...s.querySelectorAll("img")].map(img => [img.getAttribute("src"),img.getAttribute("alt"),img.getAttribute("width"),img.getAttribute("height")]),
      heroParts: [...s.querySelectorAll("[data-hero-part]")].map(p => p.getAttribute("data-hero-part")),
    })),
  };
}

test("guarded v2 PostgreSQL rollback/no-op reproduces the accepted four-Page presentation", async () => {
  const url = process.env.ASSET_TEST_DATABASE_URL; assert.ok(url, "Disposable PostgreSQL test URL required");
  const schema = `myomaton_visual_test_${randomUUID().replaceAll("-", "")}`;
  const quoted = `"${schema}"`;
  const c = new Client({ connectionString: url }); await c.connect();
  let server: Awaited<ReturnType<typeof startProductionFixture>> | undefined;
  const read = async (scope: "public" | typeof schema): Promise<State> => {
    const state = {} as State;
    for (const t of tables) state[t] = (await c.query(`SELECT to_jsonb(t) row FROM "${scope}".${t} t ORDER BY id`)).rows.map(r => r.row);
    const migrations = scope === "public" ? "drizzle.__drizzle_migrations" : `${quoted}.migration_fixture`;
    state.migrations = (await c.query(`SELECT to_jsonb(t) row FROM ${migrations} t ORDER BY id`)).rows.map(r => r.row);
    return state;
  };
  const pool = (failAt = 0) => {
    let writes = 0;
    return { value: { connect: async () => ({ release() {}, query: async (sql: string, values?: unknown[]) => {
      const scoped = sql.replaceAll("public.", `${quoted}.`).replaceAll("drizzle.__drizzle_migrations", `${quoted}.migration_fixture`);
      assert.ok(!scoped.includes("public.") && !scoped.includes("drizzle."));
      const result = await c.query(scoped, values);
      if (sql.startsWith("UPDATE")) { writes++; if (writes === failAt) throw Error("forced after disposable SQL write"); }
      return result;
    } }) } as unknown as Pick<Pool,"connect">, get writes() { return writes; } };
  };
  try {
    await c.query("SET TIME ZONE 'UTC'");
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"); const realBefore = await read("public"); await c.query("ROLLBACK");
    const installed = readMigrationFiles({migrationsFolder:"lib/platform/db/migrations"});
    // Operational 0009 may remain pending while the canonical nine-row journal
    // stays exact. Every installed row must still match the checked-in prefix.
    assert.ok(realBefore.migrations.length >= 8 && realBefore.migrations.length <= installed.length);
    for (const [index, row] of realBefore.migrations.entries()) assert.equal(row.hash,installed[index].hash,"Installed migration prefix remains exact");
    const historical = Object.fromEntries(tables.map(table => [table,realBefore[table].filter(row=>baseline[table].some(original=>original.id===row.id))])) as State;
    historical.migrations=realBefore.migrations.slice(0,8);
    assert.doesNotThrow(() => planVisualDirectionV2(historical), "Historical Myomaton rows remain exact; other customers are preserved by the complete before/after comparison");
    await c.query(`CREATE SCHEMA ${quoted}`);
    for (const t of tables) {
      await c.query(`CREATE TABLE ${quoted}.${t} (LIKE public.${t} INCLUDING ALL)`);
      for (const row of baseline[t]) await c.query(`INSERT INTO ${quoted}.${t} SELECT * FROM jsonb_populate_record(NULL::${quoted}.${t},$1::jsonb)`, [JSON.stringify(row)]);
    }
    await c.query(`CREATE TABLE ${quoted}.migration_fixture (LIKE drizzle.__drizzle_migrations INCLUDING ALL)`);
    for (const row of baseline.migrations) await c.query(`INSERT INTO ${quoted}.migration_fixture SELECT * FROM jsonb_populate_record(NULL::${quoted}.migration_fixture,$1::jsonb)`, [JSON.stringify(row)]);
    for (const failure of [1, transitionChanges().length]) {
      await assert.rejects(updateVisualDirectionV2(pool(failure).value), /forced/);
      assert.deepEqual(await read(schema), baseline);
    }
    await c.query(`UPDATE ${quoted}.sections SET content=jsonb_set(content,'{heading}','"Unreviewed"') WHERE id=$1`, [baseline.sections[0].id]);
    const conflict = pool(); await assert.rejects(updateVisualDirectionV2(conflict.value), /conflict/); assert.equal(conflict.writes, 0);
    await c.query(`UPDATE ${quoted}.sections SET content=$2::jsonb WHERE id=$1`, [baseline.sections[0].id,JSON.stringify(baseline.sections[0].content)]);
    assert.deepEqual(await updateVisualDirectionV2(pool().value), { changed: true, inserted: 0, updated: 35, deleted: 0 });
    assert.deepEqual(await read(schema), intended);
    const rerun = pool(); assert.deepEqual(await updateVisualDirectionV2(rerun.value), { changed: false, inserted: 0, updated: 0, deleted: 0 }); assert.equal(rerun.writes, 0);
    assert.deepEqual(await read(schema), intended);
    server = await startProductionFixture(url, schema, assetRoot(), { webPresenceId: "1b72cd7d-92b9-4f55-aba6-825d69d493af", managedSiteId: "7fd60824-a933-401d-8099-7b64f24cc408" });
    const direction = resolveVisualDirection(intended.managed_sites[0].configuration).direction!;
    assert.equal(direction.motion,"minimal");
    const contracts: Record<string, ReturnType<typeof contract>> = {};
    for (const page of intended.pages) {
      const response: Response = await fetch(server.base + page.slug); assert.equal(response.status,200);
      const doc = new JSDOM(await response.text()).window.document;
      contracts[String(page.slug)] = contract(doc);
      const ss = intended.sections.filter(s => s.page_id === page.id && s.status === "active").sort((a,b) => Number(a.sort_order)-Number(b.sort_order));
      const rendered = [...doc.querySelectorAll("main > section")]; assert.equal(rendered.length,ss.length);
      assert.equal(doc.querySelector(".managed-site")?.getAttribute("data-visual-version"),"2");
      assert.equal(doc.querySelectorAll("[data-motion-slot]").length,1);
      assert.deepEqual([...doc.querySelectorAll('nav[aria-label="Primary Navigation"] a')].map(a => a.getAttribute("href")), ["/","/projects","/principles","/about"]);
      const tokenStyle = doc.querySelector<HTMLElement>(".managed-site")!.style;
      for (const [key,value] of Object.entries(visualTokens(intended.design_systems[0].configuration,direction))) assert.equal(tokenStyle.getPropertyValue(key),String(value));
      for (const [index,s] of ss.entries()) {
        const n = normalizeSection(s)!;
        const usage = intended.asset_usages.find(u => u.entity_id === s.id && u.role === "image");
        const role = sectionRole(n,Boolean(usage),direction);
        const p = sectionPresentation(n.configuration,s.configuration,n.type,index,direction,role);
        assert.equal(rendered[index].getAttribute("data-section-role"),role);
        assert.equal(rendered[index].getAttribute("data-composition"),sectionComposition(p,role,direction) ?? null);
        for (const key of ["spacing","alignment","width","surface","divider"] as const) assert.equal(rendered[index].getAttribute(`data-${key}`),p[key]);
        assert.equal(rendered[index].querySelector("h1,h2")?.textContent,n.content.heading);
        if (n.content.text) assert.deepEqual([...rendered[index].querySelectorAll(".managed-site-section-copy p")].filter(p => !p.classList.contains("managed-site-eyebrow")).map(p => p.textContent), n.content.text.split(/\n\s*\n/).map(p => p.trim()));
        if (s.type !== "collection" && (s.content as { actionId?: string }).actionId) {
          const action = intended.actions.find(a => a.id === (s.content as { actionId?: string }).actionId)!;
          const href = action.type === "page" ? intended.pages.find(p => p.id === action.destination)!.slug : action.destination;
          assert.equal(rendered[index].querySelector(".managed-site-action")?.textContent,action.label);
          assert.equal(rendered[index].querySelector(".managed-site-action")?.getAttribute("href"),href);
        }
        if (usage) assert.equal(rendered[index].querySelector("img")?.getAttribute("src"),`/media/assets/${usage.asset_id}`);
      }
      for (const img of doc.querySelectorAll("main img")) {
        const asset = intended.assets.find(a => img.getAttribute("src") === `/media/assets/${a.id}`)!; assert.ok(asset);
        const bytes: Response = await fetch(server.base + img.getAttribute("src")); assert.equal(bytes.status,200);
        assert.deepEqual(Buffer.from(await bytes.arrayBuffer()),await readFile(path.join(assetRoot(),String(asset.web_presence_id),String(asset.source_reference))));
      }
      assert.equal(doc.querySelectorAll("form").length,0,"No invented Contact state");
      console.log(`${page.slug}: guarded v2, ${rendered.length} Sections, accepted roles/order/Actions/images, one Hero event, exact media bytes`);
    }
    assert.equal((await fetch(server.base + "/unknown-v2-transition")).status,404);
    await mkdir("runtime-content",{recursive:true});
    await writeFile("runtime-content/myomaton-v2-reproduction.json",JSON.stringify(contracts,null,2)+"\n");
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"); assert.deepEqual(await read("public"),realBefore); await c.query("ROLLBACK");
  } finally {
    await server?.stop(); await c.query("ROLLBACK");
    await c.query(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`); await c.end();
  }
});
