import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Pool } from "pg";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { customerTables, readCustomerState, stateFingerprint, type CustomerManifest, type CustomerState } from "../../lib/platform/customer-initialization";
import { fingerprint } from "../../lib/platform/canonical/model";
import { inspectCanonical } from "../../lib/platform/canonical/writes";
import { normalizeSection } from "../../lib/platform/managed-sites/sections";
import { prepareManagedAsset } from "../../lib/platform/assets/ingestion";
import { provisionManagedObject } from "../../lib/platform/assets/local-storage";
import { startProductionFixture } from "../../tests/integration/production-server";
import { validateDirection, resolvePlan } from "../../lib/platform/presentation/plan";
import { validatePalette } from "../../lib/platform/presentation/tokens";
import { projectCanonicalSections } from "../../lib/platform/canonical/projections";
import promoted from "../customer-updates/miopages-focus-reviewed.json";
import { customerGraph } from "../../lib/platform/customer-state";

type Row = Record<string, unknown>;
export type PreviewSection = { type: "hero" | "intro" | "collection" | "cta" | "relationship"; content: Row; configuration: Row };
export type PreviewPlan = {
  siteConfiguration: Row; designConfiguration: Row;
  pages: Record<string, PreviewSection[]>;
  pageConfigurations?: Record<string, Row>;
  actionLabels: Record<string, string>;
  logo: { file: string; name: string; alt: string; light?: { file: string; name: string; alt: string } };
};

export async function snapshotPublic(pool: Pool): Promise<CustomerState> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await c.query("SET LOCAL search_path=public");
    await c.query("SET LOCAL TIME ZONE 'UTC'");
    return await readCustomerState(c);
  } finally { await c.query("ROLLBACK"); c.release(); }
}

export function assertCommittedCustomer(state: CustomerState, manifest: CustomerManifest) {
  if (manifest.webPresenceId === promoted.target.webPresenceId && stateFingerprint(customerGraph(state,promoted.target)) === stateFingerprint(promoted.after as CustomerState)) return;
  for (const [table, rows] of Object.entries(manifest.rows)) for (const expected of rows) {
    const actual = state[table].find(row => row.id === expected.id);
    assert.ok(actual, `Missing baseline ${table}`);
    for (const [key, value] of Object.entries(expected)) {
      const current: unknown = table === "organizations" && key === "metadata"
        ? Object.fromEntries(Object.entries(actual.metadata as Row).filter(([key]) => key !== "initialization")) : actual[key];
      assert.deepEqual(current, value, `Committed customer differs: ${table}.${key}`);
    }
  }
  for (const [table, source] of [["business_knowledge", manifest.knowledge], ["offerings", manifest.offering]] as const) {
    const rows = state[table].filter(row => row.web_presence_id === manifest.webPresenceId);
    assert.equal(rows.length, 1); assert.equal(rows[0].id, source.id);
    assert.equal(rows[0].version, 1); assert.deepEqual(rows[0].payload, source.payload);
  }
  const owned = selectedCustomer(state, manifest);
  for (const table of customerTables) {
    const expected = manifest.rows[table]?.length ?? (["business_knowledge", "offerings", "business_knowledge_revisions", "offering_revisions"].includes(table) ? 1 : 0);
    assert.equal(owned[table].length, expected, `Unexpected customer rows: ${table}`);
  }
}

function selectedCustomer(state: CustomerState, manifest: CustomerManifest): CustomerState {
  const pageIds = new Set(state.pages.filter(row => row.managed_site_id === manifest.managedSiteId).map(row => row.id));
  const navIds = new Set(state.navigations.filter(row => row.web_presence_id === manifest.webPresenceId).map(row => row.id));
  return Object.fromEntries(customerTables.map(table => [table, state[table].filter(row => table === "organizations" ? row.id === manifest.organizationId
    : table === "web_presences" ? row.id === manifest.webPresenceId
    : table === "sections" ? pageIds.has(row.page_id) : table === "pages" ? pageIds.has(row.id)
    : table === "navigation_items" ? navIds.has(row.navigation_id) : row.web_presence_id === manifest.webPresenceId)]));
}

// This operator fixture is intentionally separate from every real customer writer.
// Only random, self-created schemas are mutated; runtime connections fail closed to
// that schema (no public fallback) and are transaction-read-only.
export async function prepareDisposablePreview(databaseUrl: string, manifest: CustomerManifest, plan: PreviewPlan) {
  const visual = plan.siteConfiguration.visualDirection as Row;
  if (visual?.contractVersion !== undefined) {
    const selection = validateDirection(visual);
    validatePalette(plan.designConfiguration.palette);
    void selection;
  }
  const source = new Pool({ connectionString: databaseUrl, options: "-c default_transaction_read_only=on" });
  const admin = new Pool({ connectionString: databaseUrl });
  const schema = `canonical_test_${randomUUID().replaceAll("-", "")}_preview`;
  const quoted = `"${schema}"`;
  const root = await mkdtemp(path.join(os.tmpdir(), "managed-presence-preview-"));
  let created = false;
  let server: Awaited<ReturnType<typeof startProductionFixture>> | undefined;
  try {
    const before = await snapshotPublic(source);
    assertCommittedCustomer(before, manifest);
    // Pinned experiments continue from their exact historical source graph after
    // the separately reviewed real promotion; never reinterpret the experiments.
    const owned = manifest.webPresenceId === promoted.target.webPresenceId && stateFingerprint(customerGraph(before,promoted.target)) === stateFingerprint(promoted.after as CustomerState)
      ? structuredClone(promoted.before as CustomerState) : selectedCustomer(before, manifest);
    const projectedPages: Record<string, PreviewSection[]> = {};
    for (const [route, sections] of Object.entries(plan.pages)) {
      const projected = await projectCanonicalSections(source, manifest.webPresenceId, sections.map((s, i) => ({ ...s, id: String(i) })));
      assert.equal(projected.length, sections.length, "Unavailable canonical source refuses preparation");
      projectedPages[route] = projected;
      if (visual?.contractVersion !== undefined) resolvePlan(validateDirection(visual), plan.pageConfigurations?.[route], projected, true, true);
      for (const s of projected) {
        const references = [s.content, ...(Array.isArray(s.content.items) ? s.content.items : [])] as Row[];
        for (const ref of references) for (const key of ["actionId", "secondaryActionId"]) if (ref[key] !== undefined) assert.ok(owned.actions.some(a => a.id === ref[key]), "Unknown or foreign Action refuses preparation");
      }
    }
    assert.deepEqual(Object.keys(plan.pages).sort(), owned.pages.map(p => String(p.slug)).sort(), "Preview preserves approved routes");
    for (const [domain, id, history, parent] of [["knowledge", manifest.knowledge.id, "business_knowledge_revisions", "knowledge_id"], ["offering", manifest.offering.id, "offering_revisions", "offering_id"]] as const) {
      const current = await inspectCanonical(source, domain, manifest.webPresenceId, id);
      const revision = before[history].find(r => r[parent] === id);
      assert.equal(current?.fingerprint, fingerprint(revision?.snapshot), "Canonical revision differs");
    }
    const prepared = await prepareManagedAsset(plan.logo.file);
    assert.equal(prepared.type, "image");
    const assetId = randomUUID();
    const light = plan.logo.light ? { prepared: await prepareManagedAsset(plan.logo.light.file), id: randomUUID() } : null;
    const c = await admin.connect();
    try {
      await c.query("BEGIN");
      await c.query(`CREATE SCHEMA ${quoted}`);
      await c.query(`SET LOCAL search_path=${quoted}`);
      for (const migration of readMigrationFiles({ migrationsFolder: "lib/platform/db/migrations" })) for (const sql of migration.sql) {
        await c.query(sql.replaceAll('"public".', `${quoted}.`));
      }
      const copyOrder = ["organizations", "subject_types", "web_presences", "managed_sites", "pages", "sections", "actions", "navigations", "navigation_items", "assets", "asset_usages", "design_systems", "subjects", "contact_definitions", "contact_submissions", "business_knowledge", "offerings", "business_knowledge_revisions", "offering_revisions"];
      for (const table of copyOrder) {
        for (const row of owned[table]) await c.query(`INSERT INTO ${quoted}.${table} SELECT * FROM jsonb_populate_record(NULL::${quoted}.${table},$1::jsonb)`, [JSON.stringify(row)]);
      }
      await c.query(`UPDATE ${quoted}.managed_sites SET configuration=$2::jsonb WHERE id=$1`, [manifest.managedSiteId, JSON.stringify(plan.siteConfiguration)]);
      await c.query(`UPDATE ${quoted}.design_systems SET configuration=$2::jsonb WHERE web_presence_id=$1`, [manifest.webPresenceId, JSON.stringify(plan.designConfiguration)]);
      for (const [id, label] of Object.entries(plan.actionLabels)) {
        assert.ok(owned.actions.some(a => a.id === id)); assert.ok(label.trim() && label.length <= 80);
        await c.query(`UPDATE ${quoted}.actions SET label=$2 WHERE id=$1`, [id, label]);
      }
      for (const [route, sections] of Object.entries(plan.pages)) {
        const page = owned.pages.find(p => p.slug === route)!;
        if (plan.pageConfigurations?.[route]) await c.query(`UPDATE ${quoted}.pages SET configuration=$2::jsonb WHERE id=$1`, [page.id, JSON.stringify(plan.pageConfigurations[route])]);
        const old = owned.sections.filter(s => s.page_id === page.id).sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
        await c.query(`DELETE FROM ${quoted}.sections WHERE page_id=$1`, [page.id]);
        for (const [index, section] of sections.entries()) {
          const normalized = normalizeSection({ ...projectedPages[route][index], variant: section.type === "collection" ? "grid" : "default" });
          // Canonical bindings project before Section normalization at runtime.
          assert.ok(normalized, "Supported Section required");
          for (const [key, value] of Object.entries(section.configuration)) assert.deepEqual((normalized.configuration as unknown as Row)[key], value, `Invalid semantic choice: ${key}`);
          const row = { ...(old[index] ?? old[0]), id: old[index]?.id ?? randomUUID(), type: section.type, variant: section.type === "collection" ? "grid" : "default", content: section.content, configuration: section.configuration, sort_order: index * 10, name: `preview-${index}`, metadata: { provisional: true, previewOnly: true } };
          await c.query(`INSERT INTO ${quoted}.sections SELECT * FROM jsonb_populate_record(NULL::${quoted}.sections,$1::jsonb)`, [JSON.stringify(row)]);
        }
      }
      await provisionManagedObject(root, manifest.webPresenceId, prepared.sourceReference, prepared.bytes);
      await c.query(`INSERT INTO ${quoted}.assets(id,web_presence_id,name,type,mime_type,width,height,alt_text,source_type,source_reference) VALUES($1,$2,$3,'image',$4,$5,$6,$7,'managed',$8)`, [assetId, manifest.webPresenceId, plan.logo.name, prepared.mimeType, prepared.width, prepared.height, plan.logo.alt, prepared.sourceReference]);
      await c.query(`INSERT INTO ${quoted}.asset_usages(id,web_presence_id,asset_id,entity_type,entity_id,role,configuration) VALUES($1,$2,$3,'web_presence',$2,'logo',$4::jsonb)`, [randomUUID(), manifest.webPresenceId, assetId, JSON.stringify({ image: { altText: plan.logo.alt, decorative: false } })]);
      if (light && plan.logo.light) {
        assert.equal(light.prepared.type, "image");
        await provisionManagedObject(root, manifest.webPresenceId, light.prepared.sourceReference, light.prepared.bytes);
        await c.query(`INSERT INTO ${quoted}.assets(id,web_presence_id,name,type,mime_type,width,height,alt_text,source_type,source_reference) VALUES($1,$2,$3,'image',$4,$5,$6,$7,'managed',$8)`, [light.id, manifest.webPresenceId, plan.logo.light.name, light.prepared.mimeType, light.prepared.width, light.prepared.height, plan.logo.light.alt, light.prepared.sourceReference]);
        await c.query(`INSERT INTO ${quoted}.asset_usages(id,web_presence_id,asset_id,entity_type,entity_id,role,configuration) VALUES($1,$2,$3,'web_presence',$2,'logo-light',$4::jsonb)`, [randomUUID(), manifest.webPresenceId, light.id, JSON.stringify({ image: { altText: plan.logo.light.alt, decorative: false } })]);
      }
      await c.query("COMMIT"); created = true;
    } catch (error) { await c.query("ROLLBACK"); throw error; } finally { c.release(); }
    assert.equal(stateFingerprint(await snapshotPublic(source)), stateFingerprint(before), "Real customer state changed");
    const verifyPreservation = async () => {
      const after = await snapshotPublic(source);
      assert.equal(stateFingerprint(after), stateFingerprint(before), "Real customer state changed");
      return { before: stateFingerprint(before), after: stateFingerprint(after), allRealCustomersUnchanged: true };
    };
    const stop = async () => {
      await server?.stop();
      if (created) { await admin.query(`DROP SCHEMA ${quoted} CASCADE`); created = false; }
      await verifyPreservation(); await source.end(); await admin.end();
    };
    const start = async () => {
      assert.ok(!server, "Preview already started");
      server = await startProductionFixture(databaseUrl, schema, root, manifest, true);
      return server;
    };
    return { schema, root, before, logo: { id: assetId, bytes: prepared.bytes, mimeType: prepared.mimeType, ...(light ? { light: { id: light.id, bytes: light.prepared.bytes, mimeType: light.prepared.mimeType } } : {}) }, start, stop, verifyPreservation };
  } catch (error) {
    if (created) await admin.query(`DROP SCHEMA ${quoted} CASCADE`);
    await source.end(); await admin.end(); throw error;
  }
}
