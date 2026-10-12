import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import type { Pool } from "pg";
import reviewed from "./miopages-focus-reviewed.json";
import { accepted, acceptedRevamp } from "../customer-previews/miopages-c0";
import { fingerprint } from "../../lib/platform/canonical/model";
import { customerTables, readCustomerState, stateFingerprint, type CustomerState } from "../../lib/platform/customer-initialization";
import { customerGraph, otherCustomerState } from "../../lib/platform/customer-state";

export const target = reviewed.target;
export const expectedCompleteBefore = "4758d79cea7a0ecb9019cc59b4fd8d824c2c8bdb845c37552e1b019c491cb980";
export const before: CustomerState = structuredClone(reviewed.after);
// Frozen transition preparation time, not a claim of real application/authorization.
export const preparedAt = "2026-10-12T15:31:09.213Z";
const pgTime = (iso: string) => iso.replace(/Z$/, "+00:00");
export const changeReason = "Accepted MioPages C0 revamp from checkpoint 847c575; guarded development-customer transition.";
type Row = Record<string, unknown>;
const writable: Record<string, readonly string[]> = {
  pages: ["name", "title", "status", "sort_order", "configuration", "metadata", "version", "updated_at"],
  sections: ["type", "variant", "name", "content", "configuration", "sort_order", "metadata", "status", "page_id", "version", "updated_at"],
  actions: ["label", "destination", "metadata", "version", "updated_at"],
  navigation_items: ["name", "label", "status", "target_reference", "sort_order", "metadata", "version", "updated_at"],
  business_knowledge: ["payload", "version", "updated_at"], offerings: ["payload", "version", "updated_at"],
};
const insertable = new Set(["pages", "sections", "actions", "navigation_items", "business_knowledge_revisions", "offering_revisions"]);
export const previewControlExplanation = "This preview control is disabled. No information is collected or submitted.";
const reviewHeroId = "4af04629-9b7a-4ffd-b6b3-322af962ee5d";
const reviewConversionId = "267b46a6-105b-4d14-8d4b-2fe171834c94";

function intended(): CustomerState {
  assert.equal(fingerprint(accepted), "820f4610743f9903d4c2e7d9560db51a50947e3fffc9d69f1728b2c098a4b6ee", "Accepted checkpoint content changed; transition requires new review");
  const draft = acceptedRevamp(before, preparedAt), next = structuredClone(before);
  for (const [table, rows] of [["pages", draft.pages], ["sections", draft.sections], ["actions", draft.actions], ["navigation_items", draft.navigationItems]] as const) {
    next[table] = rows.map(row => {
      const result = structuredClone(row), metadata = { ...result.metadata as Row };
      delete metadata.c0Preview; // Disposable receipt is not canonical customer state.
      result.metadata = metadata;
      for (const key of ["created_at", "updated_at"]) result[key] = pgTime(String(result[key]));
      return result;
    });
  }
  // Explicit operator correction: these two labels and this one explanation
  // belong only to the disposable accepted preview, never canonical content.
  const reviewPage = next.pages.find(p => p.slug === "/review")!;
  for (const id of [reviewHeroId, reviewConversionId]) {
    const section = next.sections.find(s => s.id === id)!;
    assert.equal(section.page_id, reviewPage.id);
    const content = section.content as Row;
    assert.equal(content.previewControlLabel, "Start My Free Review");
    delete content.previewControlLabel;
    if (id === reviewConversionId) {
      assert.equal(content.text, previewControlExplanation);
      delete content.text;
    }
  }
  for (const domain of ["knowledge", "offering"] as const) {
    const table = domain === "knowledge" ? "business_knowledge" : "offerings";
    const history = domain === "knowledge" ? "business_knowledge_revisions" : "offering_revisions";
    const parent = domain === "knowledge" ? "knowledge_id" : "offering_id";
    const old = before[table][0], payload = draft.business[domain];
    assert.notDeepEqual(payload, old.payload);
    assert.notEqual(payload.approval.at, (old.payload as { approval: { at: string } }).approval.at);
    assert.ok(before[history].length < 100);
    // Same current/revision contract as canonical/writes, with frozen audit values
    // so the complete result (including revision history) is an exact retry guard.
    const current: Row = { ...old, payload, version: Number(old.version) + 1, updated_at: pgTime(preparedAt) };
    const snapshot = { ...current, created_at: new Date(String(current.created_at)).toISOString(), updated_at: preparedAt,
      ...(domain === "offering" ? { relatedAssetUsages: before.asset_usages.filter(u => u.entity_type === "offering" && u.entity_id === old.id).sort((a,b)=>String(a.id).localeCompare(String(b.id))) } : {}) };
    next[table] = [current];
    next[history].push({ web_presence_id: target.webPresenceId, [parent]: old.id, revision_version: current.version,
      snapshot, responsible_identity: payload.approval.by, change_reason: changeReason, recorded_at: pgTime(preparedAt) });
  }
  return next;
}
export const after = intended();

const identity = (table: string, row: Row) => table.endsWith("_revisions")
  ? `${row.knowledge_id ?? row.offering_id}:${row.revision_version}` : String(row.id);
export function transitionChanges() {
  const updates: { table: string; before: Row; after: Row; fields: string[] }[] = [];
  const inserts: { table: string; row: Row }[] = [];
  for (const table of customerTables) {
    for (const old of before[table]) {
      const matches = after[table].filter(r => identity(table,r) === identity(table,old));
      assert.equal(matches.length, 1, "No deletion or identity replacement");
      const next = matches[0];
      assert.deepEqual(Object.keys(next).sort(), Object.keys(old).sort());
      const fields = Object.keys(next).filter(k => !isDeepStrictEqual(old[k], next[k]));
      if (fields.length) {
        assert.ok(fields.every(k => writable[table]?.includes(k)), `Unapproved ${table} field`);
        assert.equal(next.version, Number(old.version) + 1);
        updates.push({ table, before: old, after: next, fields });
      }
    }
    for (const row of after[table].filter(r => !before[table].some(b => identity(table,b) === identity(table,r)))) {
      assert.ok(insertable.has(table), `Unapproved insert ${table}`);
      inserts.push({ table, row });
    }
  }
  // All preserved rows, moved Sections and additions must stay inside this owner.
  assert.equal(stateFingerprint(customerGraph(after,target)), stateFingerprint(after));
  for (const table of ["assets", "asset_usages", "organizations", "managed_sites", "design_systems", "navigations"]) assert.deepEqual(after[table], before[table]);
  return { updates, inserts };
}

export function planC0Transition(state: CustomerState) {
  assert.deepEqual(Object.keys(state).sort(), [...customerTables,"migrations"].sort(), "Complete customer tables/migrations required; no repair mode");
  assert.ok(Object.values(state).every(Array.isArray), "Complete customer row arrays required");
  assert.equal(stateFingerprint(otherCustomerState(state,target)), reviewed.otherFingerprint, "Other-customer/migration drift; no repair mode");
  const graph = customerGraph(state,target), digest = stateFingerprint(graph);
  if (digest === stateFingerprint(after)) return { changed: false, updates: [], inserts: [] };
  assert.equal(digest, stateFingerprint(before), "MioPages baseline conflict; no repair mode");
  assert.equal(stateFingerprint(state), expectedCompleteBefore, "Complete customer baseline conflict");
  return { changed: true, ...transitionChanges() };
}

// Specific frozen transition; no force, sync, delete or partial-repair mode.
// Deliberately no real-application CLI in this preparation checkpoint.
export async function applyC0Transition(pool: Pick<Pool, "connect">, options: { failAfter?: number } = {}) {
  const c = await pool.connect(); let writes = 0;
  const step = () => { if (++writes === options.failAfter) throw Error("Forced C0 transition rollback"); };
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL search_path=public");
    await c.query("SET LOCAL TIME ZONE 'UTC'");
    await c.query("SET LOCAL lock_timeout='5s'");
    await c.query("SET LOCAL statement_timeout='30s'");
    await c.query(`LOCK TABLE ${customerTables.map(t=>`public.${t}`).join(",")} IN SHARE ROW EXCLUSIVE MODE`);
    await c.query("LOCK TABLE drizzle.__drizzle_migrations IN SHARE MODE");
    const current = await readCustomerState(c), plan = planC0Transition(current);
    // Insert dependencies before updates; no existing row is deleted/recreated.
    for (const {table,row} of plan.inserts) {
      await c.query(`INSERT INTO public.${table} SELECT * FROM jsonb_populate_record(NULL::public.${table},$1::jsonb)`, [JSON.stringify(row)]); step();
    }
    for (const change of plan.updates) {
      const columns = change.fields.map(k=>`"${k}"`).join(","), values = change.fields.map(k=>`p."${k}"`).join(",");
      const result = await c.query(`UPDATE public.${change.table} target SET (${columns})=(SELECT ${values} FROM jsonb_populate_record(NULL::public.${change.table},$1::jsonb) p) WHERE target.id=$2 AND to_jsonb(target)=$3::jsonb`, [JSON.stringify(change.after), change.before.id, JSON.stringify(change.before)]);
      assert.equal(result.rowCount, 1, "Guarded update must affect one row"); step();
    }
    const resulting = await readCustomerState(c);
    assert.equal(planC0Transition(resulting).changed, false, "Complete postcondition required");
    await c.query("COMMIT");
    return { changed: plan.changed, updated: plan.updates.length, inserted: plan.inserts.length, deleted: 0,
      before: stateFingerprint(current), after: stateFingerprint(resulting) };
  } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
}

export function transitionInventory() {
  const {updates,inserts} = transitionChanges();
  return customerTables.map(table => ({ table, current: before[table].length, planned: after[table].length,
    update: updates.filter(c=>c.table===table && c.after.status!=="inactive").length,
    retire: updates.filter(c=>c.table===table && c.after.status==="inactive").length,
    add: inserts.filter(c=>c.table===table).length,
    unchanged: before[table].length - updates.filter(c=>c.table===table).length }));
}
