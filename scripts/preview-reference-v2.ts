// Explicit disposable preview only. No public-table writer or migration.
import { parseArgs, isDeepStrictEqual } from "node:util";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { JSDOM } from "jsdom";
import { tables, planVisualDirectionV1, siteId, type State } from "./customer-updates/myomaton-visual-direction-v1";
import { startProductionFixture } from "../tests/integration/production-server";
import { assetRoot } from "../lib/platform/assets/local-storage";
import { resolveVisualDirection } from "../lib/platform/visual-direction/model";
import { resolveVisualPolicy, servicePolicyFromEnvironment } from "../lib/platform/policy/site-policy";
import { normalizeSection } from "../lib/platform/managed-sites/sections";
import { resolveDesignConfiguration } from "../lib/platform/design-systems/configuration";

async function main() {
  const { values } = parseArgs({ options: { statements: { type: "string" }, presentation: { type: "string" } }, strict: true, allowPositionals: false });
  const presentation = values.presentation ? JSON.parse(await readFile(values.presentation, "utf8")) as { colors?: Record<string, string>; sections?: Record<string, Record<string, unknown>>; pageOrder?: Record<string, string[]>; actions?: Record<string, string>; promoteLead?: string[]; inactiveSections?: string[]; imageSelections?: Record<string, string>; actionLabels?: Record<string, string> } : {};
  if (!presentation || typeof presentation !== "object" || Object.keys(presentation).some(k => !["colors", "sections", "pageOrder", "actions", "promoteLead", "inactiveSections", "imageSelections", "actionLabels"].includes(k))) throw Error("Bounded presentation file required");
  const statementIds = values.statements?.split(",").filter(Boolean) ?? [];
  if (statementIds.some(id => !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id))) throw Error("Explicit Section UUIDs required");
  const url = process.env.DATABASE_URL;
  if (!url) throw Error("DATABASE_URL required");
  const schema = `myomaton_visual_test_${randomUUID().replaceAll("-", "")}`;
  if (!/^myomaton_visual_test_[a-f0-9]{32}$/.test(schema)) throw Error("Disposable schema required");
  const quoted = `"${schema}"`;
  const c = new Client({ connectionString: url }); await c.connect();
  const snapshot = async () => {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    try {
      await c.query("SET LOCAL TIME ZONE 'UTC'");
      const state = {} as State;
      for (const table of tables) state[table] = (await c.query(`SELECT to_jsonb(t) AS row FROM public.${table} t ORDER BY id`)).rows.map(r => r.row);
      state.migrations = (await c.query("SELECT to_jsonb(t) AS row FROM drizzle.__drizzle_migrations t ORDER BY id")).rows.map(r => r.row);
      return state;
    } finally { await c.query("ROLLBACK"); }
  };
  let server: Awaited<ReturnType<typeof startProductionFixture>> | undefined;
  let created = false;
  try {
    const before = await snapshot();
    if (before.migrations.length !== 8 || before.pages.length !== 4 || before.sections.length !== 29 || planVisualDirectionV1(before).changed) throw Error("Canonical baseline differs; preview refused");
    for (const id of statementIds) if (!before.sections.some(s => s.id === id && s.type === "intro")) throw Error("Statement selection must identify an existing Intro");
    for (const [id, choices] of Object.entries(presentation.sections ?? {})) {
      const section = before.sections.find(s => s.id === id);
      if (!section || !choices || typeof choices !== "object" || Array.isArray(choices)) throw Error("Existing Section presentation required");
      const normalized = normalizeSection({ ...section, configuration: { ...(section.configuration as object), ...choices } });
      if (!normalized || Object.entries(choices).some(([key, value]) => !["composition", "treatment", "width", "spacing", "alignment", "surface", "divider", "columns"].includes(key)
        || (normalized.configuration as Record<string, unknown>)[key] !== value)) throw Error(`Invalid finite presentation for ${id}`);
    }
    if (presentation.colors && Object.entries(presentation.colors).some(([key, value]) =>
      !Object.hasOwn(resolveDesignConfiguration({ colors: presentation.colors }).colors, key) || !/^#[a-f0-9]{6}$/i.test(value))) throw Error("Invalid Design System color");
    for (const [pageId, order] of Object.entries(presentation.pageOrder ?? {})) {
      const ids = before.sections.filter(s => s.page_id === pageId).map(s => s.id);
      if (!before.pages.some(p => p.id === pageId) || !Array.isArray(order) || order.length !== ids.length || new Set(order).size !== ids.length || order.some(id => !ids.includes(id))) throw Error("Preview order must contain every existing Page Section exactly once");
    }
    for (const [sectionId, actionId] of Object.entries(presentation.actions ?? {})) {
      if (!before.sections.some(s => s.id === sectionId && ["hero", "intro", "cta"].includes(String(s.type))) || !before.actions.some(a => a.id === actionId && a.status === "active")) throw Error("Preview requires an existing active Action and eligible Section");
    }
    for (const id of presentation.promoteLead ?? []) {
      const section = before.sections.find(s => s.id === id && s.type === "hero");
      const content = section?.content as { text?: string } | undefined;
      if (!content?.text || content.text.split(/\n\s*\n/).length < 2) throw Error("Promotion requires an existing Hero lead paragraph and support");
    }
    for (const id of presentation.inactiveSections ?? []) if (!before.sections.some(s => s.id === id && s.type !== "hero")) throw Error("Existing non-Hero Section required");
    for (const [usageId, assetId] of Object.entries(presentation.imageSelections ?? {})) {
      const usage = before.asset_usages.find(u => u.id === usageId);
      if (!usage || !before.assets.some(a => a.id === assetId && a.web_presence_id === usage.web_presence_id && a.status === "active")) throw Error("Existing same-presence Asset and usage required");
    }
    for (const [id, label] of Object.entries(presentation.actionLabels ?? {})) if (!before.actions.some(a => a.id === id && a.status === "active") || typeof label !== "string" || !label.trim() || label.length > 40 || /[<>\r\n]/.test(label)) throw Error("Concise existing Action label required");
    await c.query("BEGIN");
    try {
      await c.query(`CREATE SCHEMA ${quoted}`);
      for (const table of tables) {
        await c.query(`CREATE TABLE ${quoted}.${table} (LIKE public.${table} INCLUDING ALL)`);
        await c.query(`INSERT INTO ${quoted}.${table} SELECT * FROM public.${table}`);
      }
      await c.query(`UPDATE ${quoted}.managed_sites SET configuration=jsonb_set(configuration,'{visualDirection,profileVersion}','2') WHERE id=$1`, [siteId]);
      for (const id of statementIds) await c.query(`UPDATE ${quoted}.sections SET configuration=jsonb_set(configuration,'{treatment}','"statement"') WHERE id=$1 AND type='intro'`, [id]);
      for (const [id, choices] of Object.entries(presentation.sections ?? {})) await c.query(`UPDATE ${quoted}.sections SET configuration=configuration || $2::jsonb WHERE id=$1`, [id, JSON.stringify(choices)]);
      if (presentation.colors) await c.query(`UPDATE ${quoted}.design_systems SET configuration=jsonb_set(configuration,'{colors}',(configuration->'colors') || $1::jsonb)`, [JSON.stringify(presentation.colors)]);
      for (const [pageId, order] of Object.entries(presentation.pageOrder ?? {})) for (const [index, id] of order.entries()) await c.query(`UPDATE ${quoted}.sections SET sort_order=$3 WHERE id=$1 AND page_id=$2`, [id, pageId, (index + 1) * 10]);
      for (const id of presentation.promoteLead ?? []) {
        const content = { ...(before.sections.find(s => s.id === id)!.content as { heading: string; text: string }) };
        const [lead, ...support] = content.text.split(/\n\s*\n/);
        content.heading = lead.trim(); content.text = support.join("\n\n");
        await c.query(`UPDATE ${quoted}.sections SET content=$2::jsonb WHERE id=$1`, [id, JSON.stringify(content)]);
      }
      for (const id of presentation.inactiveSections ?? []) await c.query(`UPDATE ${quoted}.sections SET status='inactive' WHERE id=$1`, [id]);
      for (const [id, assetId] of Object.entries(presentation.imageSelections ?? {})) await c.query(`UPDATE ${quoted}.asset_usages SET asset_id=$2 WHERE id=$1`, [id, assetId]);
      for (const [id, label] of Object.entries(presentation.actionLabels ?? {})) await c.query(`UPDATE ${quoted}.actions SET label=$2 WHERE id=$1`, [id, label]);
      for (const [id, actionId] of Object.entries(presentation.actions ?? {})) await c.query(`UPDATE ${quoted}.sections SET content=jsonb_set(content,'{actionId}',$2::jsonb) WHERE id=$1`, [id, JSON.stringify(actionId)]);
      await c.query("COMMIT"); created = true;
    } catch (error) { await c.query("ROLLBACK"); throw error; }
    const policy = resolveVisualPolicy(servicePolicyFromEnvironment(process.env.WEB_PRESENCE_SERVICE_POLICY));
    const effective = resolveVisualDirection({ visualDirection: { profileId: "reference", profileVersion: 2, preferences: { hero: "graphic", density: "airy", motion: "light" } } }, policy).direction!;
    server = await startProductionFixture(url, schema, assetRoot(), { webPresenceId: "1b72cd7d-92b9-4f55-aba6-825d69d493af", managedSiteId: "7fd60824-a933-401d-8099-7b64f24cc408" });
    const routes = [];
    for (const page of before.pages) {
      const response = await fetch(server.base + page.slug); if (response.status !== 200) throw Error(`Route ${page.slug} failed`);
      const doc = new JSDOM(await response.text()).window.document;
      if (doc.querySelector("[data-visual-version]")?.getAttribute("data-visual-version") !== "2") throw Error("Preview profile mismatch");
      if (doc.querySelectorAll("main > section").length !== before.sections.filter(s => s.page_id === page.id && !(presentation.inactiveSections ?? []).includes(String(s.id))).length) throw Error("Section count mismatch");
      const hero = before.sections.find(s => s.page_id === page.id && s.type === "hero")!;
      const heading = hero.content as { heading: string; text: string };
      const expectedHeading = presentation.promoteLead?.includes(String(hero.id)) ? heading.text.split(/\n\s*\n/)[0].trim() : heading.heading;
      if (doc.querySelector("h1")?.textContent !== expectedHeading) throw Error("Canonical heading mismatch");
      for (const image of doc.querySelectorAll("main img")) {
        const asset = before.assets.find(a => image.getAttribute("src") === `/media/assets/${a.id}`);
        if (!asset) throw Error("Unexpected Asset");
        const response = await fetch(server.base + image.getAttribute("src"));
        const bytes = await readFile(path.join(assetRoot(), String(asset.web_presence_id), String(asset.source_reference)));
        if (response.status !== 200 || !Buffer.from(await response.arrayBuffer()).equals(bytes)) throw Error("Asset byte mismatch");
      }
      routes.push({ path: page.slug, status: 200, statements: [...doc.querySelectorAll('[data-section-role="statement"] h2')].map(h => h.textContent),
        compositions: [...doc.querySelectorAll('[data-composition]')].map(s => ({ heading: s.querySelector('h1,h2')?.textContent, composition: s.getAttribute('data-composition'), surface: s.getAttribute('data-surface') })),
        motionConsumers: [...doc.querySelectorAll("[data-motion-slot]")].map(s => s.getAttribute("data-section-role")),
        secondaryWashes: doc.querySelectorAll('[data-accent-surface="secondary-wash"]').length, images: doc.querySelectorAll("main img").length });
    }
    if (!isDeepStrictEqual(await snapshot(), before)) throw Error("Canonical state drift detected");
    const report = { schema, url: server.base, processId: server.processId, profile: "reference v2", effectiveMotion: effective.motion,
      selectedStatementIds: [...new Set([...statementIds, ...Object.entries(presentation.sections ?? {}).filter(([, c]) => c.treatment === "statement").map(([id]) => id)])],
      previewColors: presentation.colors ?? "unchanged palette; primary fallback", presentationFile: values.presentation, routes, visuallyApproved: false };
    await mkdir("runtime-content", { recursive: true });
    await writeFile("runtime-content/reference-v2-preview.json", JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
    console.log("Preview remains running. Ctrl+C stops it and removes only its disposable schema.");
    await new Promise<void>(resolve => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); });
  } finally {
    await server?.stop();
    if (created) await c.query(`DROP SCHEMA ${quoted} CASCADE`);
    await c.end();
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Preview failed"); process.exitCode = 1; });
