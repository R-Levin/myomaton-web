import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Pool } from "pg";
import { readMigrationFiles } from "drizzle-orm/migrator";
import reviewed from "../customer-updates/miopages-focus-reviewed.json";
import { snapshotPublic } from "./disposable";
import { customerGraph } from "../../lib/platform/customer-state";
import { readCustomerState, stateFingerprint } from "../../lib/platform/customer-initialization";
import { inspectCanonical, writeCanonical } from "../../lib/platform/canonical/writes";
import { projectCanonicalSections } from "../../lib/platform/canonical/projections";
import { normalizeSection } from "../../lib/platform/managed-sites/sections";
import { resolvePlan, validateDirection } from "../../lib/platform/presentation/plan";
import { assetRoot, readManagedObject, provisionManagedObject } from "../../lib/platform/assets/local-storage";
import { startProductionFixture } from "../../tests/integration/production-server";
import { acceptedRevamp } from "./miopages-c0";

// No public-schema write mode or caller-supplied schema. Always create a new
// isolated copy of the current approved graph, never the historical experiment.
export async function prepareAcceptedRevamp(databaseUrl: string) {
  const source = new Pool({ connectionString: databaseUrl, options: "-c default_transaction_read_only=on -c timezone=UTC" });
  const admin = new Pool({ connectionString: databaseUrl });
  const schema = `canonical_test_${randomUUID().replaceAll("-", "")}_preview`;
  const quoted = `"${schema}"`;
  const connection = new URL(databaseUrl);
  connection.searchParams.set("options", `-c search_path=${schema} -c timezone=UTC`);
  const pool = new Pool({ connectionString: connection.toString() });
  const root = await mkdtemp(path.join(os.tmpdir(), "miopages-c0-"));
  let created = false, server: Awaited<ReturnType<typeof startProductionFixture>> | undefined;
  try {
    const before = await snapshotPublic(source), owned = customerGraph(before, reviewed.target);
    assert.equal(stateFingerprint(owned), stateFingerprint(reviewed.after), "Current accepted MioPages graph required");
    const at = new Date().toISOString(), draft = acceptedRevamp(owned, at);
    const { business, sections } = draft;
    const c = await admin.connect();
    try {
      await c.query("BEGIN");
      await c.query(`CREATE SCHEMA ${quoted}`);
      await c.query(`SET LOCAL search_path=${quoted}`);
      for (const migration of readMigrationFiles({ migrationsFolder: "lib/platform/db/migrations" })) for (const sql of migration.sql) {
        await c.query(sql.replaceAll('"public".', `${quoted}.`));
      }
      const order = ["organizations", "subject_types", "web_presences", "managed_sites", "pages", "sections", "actions", "navigations", "navigation_items", "assets", "asset_usages", "design_systems", "subjects", "contact_definitions", "contact_submissions", "business_knowledge", "offerings", "business_knowledge_revisions", "offering_revisions"];
      for (const table of order) for (const row of owned[table]) {
        await c.query(`INSERT INTO ${quoted}.${table} SELECT * FROM jsonb_populate_record(NULL::${quoted}.${table},$1::jsonb)`, [JSON.stringify(row)]);
      }
      await c.query("COMMIT"); created = true;
    } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
    const managed: { id: string; owner: string; reference: string; bytes: Buffer }[] = [];
    for (const asset of owned.assets) {
      assert.equal(asset.source_type, "managed");
      const bytes = await readManagedObject(assetRoot(), String(asset.web_presence_id), String(asset.source_reference));
      await provisionManagedObject(root, String(asset.web_presence_id), String(asset.source_reference), bytes);
      managed.push({ id: String(asset.id), owner: String(asset.web_presence_id), reference: String(asset.source_reference), bytes });
    }
    for (const domain of ["knowledge", "offering"] as const) {
      const row = domain === "knowledge" ? owned.business_knowledge[0] : owned.offerings[0];
      const current = await inspectCanonical(pool, domain, reviewed.target.webPresenceId, String(row.id));
      assert.ok(current);
      const approval = business[domain].approval; assert.ok(approval);
      await writeCanonical(pool, { domain, id: String(row.id), webPresenceId: reviewed.target.webPresenceId,
        expectedVersion: Number(row.version), expectedFingerprint: current.fingerprint, payload: business[domain],
        ...(domain === "offering" ? { offering: { key: String(row.key), type: "service" as const, name: String(row.name), status: "active" as const } } : {}),
        responsibleIdentity: approval.by, changeReason: "Reproduce the accepted business payload and its original approval in an isolated preview only" });
    }
    const projected = await projectCanonicalSections(pool, reviewed.target.webPresenceId, sections);
    assert.equal(projected.length, sections.length);
    const direction = validateDirection((owned.managed_sites[0].configuration as Record<string, unknown>).visualDirection);
    for (const page of draft.pages.filter(p=>p.status === "active")) {
      resolvePlan(direction, page.configuration, projected.filter(s => s.page_id === page.id && s.status === "active"), true, true);
    }
    for (const s of projected) assert.ok(normalizeSection(s), "Supported projected Home Section required");
    const home = owned.pages.find(p => p.slug === "/")!;
    const writer = await pool.connect();
    try {
      await writer.query("BEGIN");
      {
        for (const table of ["pages", "actions", "navigation_items"] as const) {
          const rows = table === "pages" ? draft.pages : table === "actions" ? draft.actions : draft.navigationItems;
          for (const row of rows) {
            if (owned[table].some(r => r.id === row.id)) {
              const fields = table === "pages" ? ["name", "title", "status", "sort_order", "configuration", "metadata", "version", "updated_at"]
                : table === "actions" ? ["label", "destination", "metadata", "version", "updated_at"] : ["name", "label", "status", "target_reference", "sort_order", "metadata", "version", "updated_at"];
              await writer.query(`UPDATE ${table} target SET (${fields.join(",")})=(SELECT ${fields.map(f => `p.${f}`).join(",")} FROM jsonb_populate_record(NULL::${table},$1::jsonb) p) WHERE target.id=$2`, [JSON.stringify(row), row.id]);
            } else await writer.query(`INSERT INTO ${table} SELECT * FROM jsonb_populate_record(NULL::${table},$1::jsonb)`, [JSON.stringify(row)]);
          }
        }
      }
      for (const section of sections) {
        if (owned.sections.some(s => s.id === section.id)) {
          await writer.query("UPDATE sections SET type=$2,variant=$3,name=$4,content=$5,configuration=$6,sort_order=$7,version=$8,updated_at=$9,metadata=$10,page_id=$11,status=$12 WHERE id=$1",
            [section.id, section.type, section.variant, section.name, section.content, section.configuration, section.sort_order, section.version, at, section.metadata, section.page_id, section.status]);
        } else await writer.query("INSERT INTO sections SELECT * FROM jsonb_populate_record(NULL::sections,$1::jsonb)", [JSON.stringify(section)]);
      }
      await writer.query("COMMIT");
    } catch (e) { await writer.query("ROLLBACK"); throw e; } finally { writer.release(); }
    const state = async () => {
      const c = await pool.connect();
      try { await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"); return await readCustomerState(c); }
      finally { await c.query("ROLLBACK"); c.release(); }
    };
    const previewState = await state();
    for (const table of ["organizations", "web_presences", "managed_sites", "design_systems", "navigations", "subjects", "subject_types", "assets", "asset_usages", "contact_definitions", "contact_submissions"]) {
      assert.equal(stateFingerprint({ [table]: previewState[table] }), stateFingerprint({ [table]: owned[table] }), `${table} must remain exact`);
    }
    {
      for (const table of ["pages", "actions", "navigation_items", "sections"]) assert.ok(owned[table].every(r => previewState[table].some(n => n.id === r.id)), `${table}: preserve existing identities`);
      assert.equal(previewState.pages.length, draft.pages.length);
      assert.equal(previewState.sections.length, draft.sections.length);
    }
    const verifyPreservation = async () => {
      const after = await snapshotPublic(source);
      assert.equal(stateFingerprint(after), stateFingerprint(before), "Real customer state changed");
      for (const asset of managed) assert.ok((await readManagedObject(assetRoot(), asset.owner, asset.reference)).equals(asset.bytes), "Real managed bytes changed");
      return { before: stateFingerprint(before), after: stateFingerprint(after), allRealCustomersUnchanged: true, liveMigrationsUnchanged: true, managedBytesUnchanged: true };
    };
    await verifyPreservation();
    const stop = async () => {
      await server?.stop();
      if (created) { await admin.query(`DROP SCHEMA ${quoted} CASCADE`); created = false; }
      await verifyPreservation(); await pool.end(); await source.end(); await admin.end();
    };
    const start = async () => {
      assert.ok(!server, "Preview already started");
      server = await startProductionFixture(databaseUrl, schema, root, reviewed.target, true);
      return server;
    };
    return { schema, root, before, owned, previewState, state, home, sections, managed, start, stop, verifyPreservation };
  } catch (e) {
    await server?.stop();
    if (created) await admin.query(`DROP SCHEMA ${quoted} CASCADE`);
    await pool.end(); await source.end(); await admin.end(); throw e;
  }
}
