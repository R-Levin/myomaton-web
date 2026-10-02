import { isDeepStrictEqual } from "node:util";
import type { Pool } from "pg";
import baselineJson from "./myomaton-home-v1-baseline.json";
import { homeV1Ids, homeV1Sections, projectDrafts, projectsActionDraft } from "./myomaton-home-v1-content";

export type Row = Record<string, unknown> & { id: string };
export const tables = ["web_presences", "microsites", "pages", "sections", "actions", "subjects", "subject_types", "navigations", "navigation_items", "assets", "asset_usages"] as const;
export type Table = typeof tables[number];
export type State = Record<Table, Row[]>;
type WriteTable = "sections" | "subjects" | "actions";
type Insert = { table: WriteTable; row: Row };
export const baseline: State = baselineJson;
export const presenceId = baseline.web_presences[0].id;
export const pageId = baseline.pages[0].id;
const intro = baseline.sections.find(row => row.name === "Introduction")!;
const about = baseline.navigation_items.find(row => row.name === "About")!;
const intendedAbout: Row = { ...about, target_reference: homeV1Ids.ownership, version: Number(about.version) + 1 };

function refuse(message: string): never {
  throw new Error(`Myomaton Home v1 conflict: ${message}. No changes committed; inspect canonical state. There is no force/reset mode.`);
}
function sameFields(actual: Row | undefined, expected: Row) {
  return !!actual && Object.entries(expected).every(([key, value]) => isDeepStrictEqual(actual[key], value));
}
function requireRows(actual: Row[], expected: Row[], context: string) {
  if (actual.length !== expected.length || expected.some(row => !sameFields(actual.find(item => item.id === row.id), row))) {
    refuse(`${context} differs from reviewed state`);
  }
}
const normalized = (value: unknown) => typeof value === "string" ? value.trim().toLowerCase() : "";

// Pure preflight: build the entire plan before executing any INSERT or UPDATE.
// The baseline is a frozen, reviewed 2026-10-01 snapshot, never regenerated at run time.
export function planHomeV1(state: State) {
  const root = baseline.web_presences[0];
  requireRows(state.web_presences.filter(row => row.id === presenceId || normalized(row.name) === "myomaton"
    || normalized(row.primary_domain) === "myomaton.com"), [root], "Web Presence identity");
  requireRows(state.microsites.filter(row => row.web_presence_id === presenceId || row.id === baseline.microsites[0].id), baseline.microsites, "Microsite identity");
  requireRows(state.pages.filter(row => row.id === pageId || (row.microsite_id === baseline.microsites[0].id && row.slug === "/")), baseline.pages, "Home Page identity");
  for (const table of ["subject_types", "subjects", "actions", "navigations", "assets"] as const) {
    for (const expected of baseline[table]) {
      if (!sameFields(state[table].find(row => row.id === expected.id), expected)) refuse(`${table} ${expected.id} differs from baseline`);
    }
  }
  requireRows(state.navigations.filter(row => row.web_presence_id === presenceId && normalized(row.name) === "primary navigation"), baseline.navigations, "Primary Navigation");

  const inserts: Insert[] = [];
  function resolve(table: "subjects" | "actions", draft: Row): string {
    const expected: Row = { ...draft, web_presence_id: presenceId, status: "active", configuration: {},
      ...(table === "subjects" ? { subject_type_id: baseline.subject_types[0].id, legal_name: null } : {}) };
    // Global reserved-ID check also catches a collision in a different customer.
    const candidates = state[table].filter(row => row.id === draft.id || (row.web_presence_id === presenceId
      && (normalized(row.name) === normalized(draft.name) || (table === "actions"
        && row.type === draft.type && row.label === draft.label && row.destination === draft.destination))));
    if (candidates.length > 1) refuse(`ambiguous ${table} identity for ${draft.name}`);
    if (candidates.length === 1) {
      const row = candidates[0];
      // An equivalent pre-existing Action may have a different internal name.
      const comparison = { ...expected, id: row.id, ...(table === "actions" && row.id !== draft.id ? { name: row.name } : {}) };
      if (!sameFields(row, comparison)) refuse(`existing ${table} ${draft.name} is customized/incompatible`);
      return row.id;
    }
    inserts.push({ table, row: { ...expected, metadata: {}, version: 1 } });
    return draft.id;
  }
  const tabot = resolve("subjects", projectDrafts[0]);
  const abot = resolve("subjects", projectDrafts[1]);
  const action = resolve("actions", projectsActionDraft);
  const intended: Row[] = homeV1Sections({
    hero: baseline.sections.find(row => row.type === "hero")!.id,
    introduction: intro.id, cta: baseline.sections.find(row => row.type === "cta")!.id,
    action, tabot, abot,
  }).map(row => ({ ...row, page_id: pageId, status: "active",
    version: Number(baseline.sections.find(old => old.id === row.id)?.version ?? 0) + 1 }));
  const home = state.sections.filter(row => row.page_id === pageId);
  const matches = (expected: Row[]) => home.length === expected.length
    && expected.every(row => sameFields(home.find(item => item.id === row.id), row));
  const isBaseline = matches(baseline.sections);
  const isIntended = matches(intended);
  if (!isBaseline && !isIntended) refuse("Home Section identities/content/configuration/order/version are neither the exact baseline nor complete Home v1");
  // Navigation must match the same phase as Sections; partial anchor moves are not repaired.
  requireRows(state.navigation_items.filter(row => row.navigation_id === baseline.navigations[0].id),
    baseline.navigation_items.map(row => isIntended && row.id === about.id ? intendedAbout : row), "Primary Navigation items");

  // Guard polymorphic usages across tenants, not only correctly scoped usages.
  const homeIds = new Set(intended.map(row => row.id));
  requireRows(state.asset_usages.filter(row => row.id === baseline.asset_usages[0].id
    || (row.entity_type === "section" && homeIds.has(String(row.entity_id)))), baseline.asset_usages, "Home photograph AssetUsage");
  for (const row of intended) {
    const existing = state.sections.find(item => item.id === row.id);
    if (existing && existing.page_id !== pageId) refuse(`reserved Section UUID ${row.id} belongs to another Page`);
  }
  if (isIntended) {
    if (inserts.length) refuse("Home v1 dependencies were removed; refusing to restore them");
    return { inserts: [], updates: [], navigationUpdates: [], changed: false };
  }
  const updates = intended.filter(row => baseline.sections.some(old => old.id === row.id));
  inserts.push(...intended.filter(row => !baseline.sections.some(old => old.id === row.id))
    .map(row => ({ table: "sections" as const, row: { ...row, metadata: {} } })));
  return { inserts, updates, navigationUpdates: [intendedAbout], changed: true };
}

// Dedicated checked-out client: never run a multi-statement transaction via pool.query.
export async function updateMyomatonHomeV1(pool: Pick<Pool, "connect">) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    // A short operator maintenance lock blocks inserts as well as updates/deletes.
    // Unlike an advisory lock alone this protects against uncoordinated writers and
    // phantom Section/Subject identities. Readers remain available. No auto-retry.
    await client.query(`LOCK TABLE ${tables.map(table => `public.${table}`).join(", ")} IN SHARE ROW EXCLUSIVE MODE`);
    const state = {} as State;
    for (const table of tables) state[table] = (await client.query<Row>(`SELECT * FROM public.${table} ORDER BY id`)).rows;
    const plan = planHomeV1(state);
    for (const { table, row } of plan.inserts) {
      // Identifiers come only from the private, fixed plan above; all values are parameters.
      const keys = Object.keys(row);
      const result = await client.query(`INSERT INTO public.${table} (${keys.join(", ")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")})`, Object.values(row));
      if (result.rowCount !== 1) throw new Error("Home v1 insert did not affect exactly one record.");
    }
    for (const row of plan.updates) {
      // Only Introduction loses its reviewed anchor; all other configuration is retained.
      // Never replace identity/name/metadata/created_at, or touch Assets.
      const result = await client.query("UPDATE public.sections SET content = $1, variant = $2, sort_order = $3, version = $4, configuration = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 AND page_id = $7",
        [row.content, row.variant, row.sort_order, row.version, row.configuration, row.id, pageId]);
      if (result.rowCount !== 1) throw new Error("Home v1 update did not affect exactly one Section.");
    }
    for (const row of plan.navigationUpdates) {
      const result = await client.query("UPDATE public.navigation_items SET target_reference = $1, version = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND navigation_id = $4",
        [row.target_reference, row.version, row.id, row.navigation_id]);
      if (result.rowCount !== 1) throw new Error("Home v1 update did not affect exactly one Navigation item.");
    }
    await client.query("COMMIT");
    return { changed: plan.changed, inserted: plan.inserts.length, updated: plan.updates.length + plan.navigationUpdates.length,
      youtube: "Unconfirmed: CTA has no Action. Customer confirmation is required before adding a YouTube destination." };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
