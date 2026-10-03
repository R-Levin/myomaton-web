import { isDeepStrictEqual } from "node:util";
import type { Pool } from "pg";
import frozen from "./myomaton-secondary-pages-v1-baseline.json";
import { actionRows, pageRows, sectionRows, usageRows, navigationRows,
  presenceId, siteId, navigationId, type Row } from "./myomaton-secondary-pages-v1-content";

export const tables = ["organizations", "web_presences", "managed_sites", "pages", "sections", "actions",
  "subjects", "subject_types", "design_systems", "navigations", "navigation_items", "assets", "asset_usages"] as const;
export type Table = typeof tables[number];
export type State = Record<Table, Row[]>;
export const baseline: State = frozen;
type WriteTable = "pages" | "actions" | "sections" | "asset_usages" | "navigation_items";
type Insert = { table: WriteTable; row: Row };
const normalize = (value: unknown) => typeof value === "string" ? value.trim().toLowerCase() : "";
function refuse(message: string): never {
  throw new Error(`Myomaton secondary Pages v1 conflict: ${message}. No changes committed; inspect canonical state. No force/reset or repair mode.`);
}
// Baseline records compare every field, including microsecond timestamps read as
// UTC JSON. New records have DB-assigned timestamps, excluded from their identity
// comparison only; copy, metadata, configuration, version and all other keys match.
function withoutTimes(row: Row) {
  return Object.fromEntries(Object.entries(row).filter(([key]) => key !== "created_at" && key !== "updated_at"));
}
function equalRows(actual: Row[], expected: Row[], newIds = new Set<string>()) {
  return actual.length === expected.length && expected.every(row => {
    const found = actual.find(item => item.id === row.id);
    return found && isDeepStrictEqual(newIds.has(row.id) ? withoutTimes(found) : found,
      newIds.has(row.id) ? withoutTimes(row) : row);
  });
}

export function planSecondaryPagesV1(state: State) {
  // All pre-existing reviewed records are immutable except the two explicitly
  // retired Navigation items. Extra unrelated customer records remain untouched.
  for (const table of tables.filter(table => table !== "navigation_items")) {
    for (const row of baseline[table]) {
      if (!isDeepStrictEqual(state[table].find(item => item.id === row.id), row)) refuse(`${table} ${row.id} differs from baseline`);
    }
  }
  if (!equalRows(state.web_presences.filter(row => row.id === presenceId || normalize(row.name) === "myomaton"
    || normalize(row.primary_domain) === "myomaton.com"), baseline.web_presences)) refuse("Web Presence identity");
  if (!equalRows(state.managed_sites.filter(row => row.web_presence_id === presenceId), baseline.managed_sites)) refuse("Managed Site identity");
  if (!equalRows(state.navigations.filter(row => row.web_presence_id === presenceId
    && normalize(row.name) === "primary navigation"), baseline.navigations)) refuse("Primary Navigation identity");
  for (const subject of baseline.subjects) {
    if (!equalRows(state.subjects.filter(row => row.web_presence_id === presenceId && normalize(row.name) === normalize(subject.name)), [subject])) refuse("ambiguous Subject identity");
  }

  const inserts: Insert[] = [];
  const resolved = actionRows.map(draft => {
    const candidates = state.actions.filter(row => row.id === draft.id || (row.web_presence_id === presenceId
      && (normalize(row.name) === normalize(draft.name) || (row.type === "page" && row.label === draft.label && row.destination === draft.destination))));
    if (candidates.length > 1) refuse(`ambiguous Action ${draft.name}`);
    if (!candidates.length) { inserts.push({ table: "actions", row: draft }); return draft.id; }
    const row = candidates[0];
    if (row.id === draft.id) {
      if (!equalRows([row], [draft], new Set([draft.id]))) refuse(`reserved Action ${draft.name} is customized`);
    } else if (row.web_presence_id !== presenceId || row.status !== "active" || row.type !== "page"
      || row.label !== draft.label || row.destination !== draft.destination || !isDeepStrictEqual(row.configuration, {})) {
      refuse(`existing Action ${draft.name} is incompatible`);
    }
    return row.id;
  });
  const sections = sectionRows(resolved);
  const planned: Insert[] = [
    ...pageRows.map(row => ({ table: "pages" as const, row })), ...inserts,
    ...sections.map(row => ({ table: "sections" as const, row })),
    ...usageRows.map(row => ({ table: "asset_usages" as const, row })),
    ...navigationRows.map(row => ({ table: "navigation_items" as const, row })),
  ];
  // Include reserved identities regardless of tenant/parent to catch collisions.
  const pageIds = new Set([...baseline.pages, ...pageRows].map(row => row.id));
  const sectionIds = new Set([...baseline.sections, ...sections].map(row => row.id));
  const assetIds = new Set(baseline.assets.map(row => row.id));
  const scoped = {
    pages: state.pages.filter(row => row.managed_site_id === siteId || pageIds.has(row.id)),
    sections: state.sections.filter(row => pageIds.has(String(row.page_id)) || sectionIds.has(row.id)),
    navigation_items: state.navigation_items.filter(row => row.navigation_id === navigationId
      || [...baseline.navigation_items, ...navigationRows].some(item => item.id === row.id)),
    asset_usages: state.asset_usages.filter(row => assetIds.has(String(row.asset_id))
      || (row.entity_type === "section" && sectionIds.has(String(row.entity_id)))
      || usageRows.some(item => item.id === row.id)),
  };
  const matches = (complete: boolean) => (Object.keys(scoped) as (keyof typeof scoped)[]).every(table => {
    const additions = planned.filter(item => item.table === table).map(item => item.row);
    const expected = complete ? [...(table === "navigation_items" ? [] : baseline[table]), ...additions] : baseline[table];
    return equalRows(scoped[table], expected, complete ? new Set(additions.map(row => row.id)) : undefined);
  });
  const initial = matches(false), complete = matches(true);
  if (!initial && !complete) refuse("Pages/Sections/Navigation/AssetUsage are neither exact baseline nor complete intended state");
  if (complete) {
    if (inserts.length) refuse("Page Action dependency removed");
    return { inserts: [] as Insert[], deletes: [] as Row[], changed: false };
  }
  // Existing transition-owned Actions without Pages indicate partial state.
  if (resolved.some(id => actionRows.some(row => row.id === id) && state.actions.some(row => row.id === id))) refuse("partial reserved Action state");
  return { inserts: planned, deletes: baseline.navigation_items, changed: true };
}

export async function updateSecondaryPagesV1(pool: Pick<Pool, "connect">) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    // Bounded operator maintenance window: protects preflight from phantoms and
    // uncoordinated writers, including the entire AssetUsage ownership chain.
    await client.query(`LOCK TABLE ${tables.map(table => `public.${table}`).join(", ")} IN SHARE ROW EXCLUSIVE MODE`);
    const state = {} as State;
    for (const table of tables) state[table] = (await client.query<{ row: Row }>(`SELECT to_jsonb(t) AS row FROM public.${table} t ORDER BY id`)).rows.map(result => result.row);
    const plan = planSecondaryPagesV1(state);
    const insert = async ({ table, row }: Insert) => {
      if (table === "asset_usages") {
        // Match the singular-role writer's chain locking and ownership checks.
        const target = await client.query(`SELECT s.id FROM public.sections s JOIN public.pages p ON p.id=s.page_id
          JOIN public.managed_sites m ON m.id=p.managed_site_id JOIN public.web_presences w ON w.id=m.web_presence_id
          WHERE s.id=$1 AND m.id=$2 AND w.id=$3 AND s.type='intro'
          AND s.status='active' AND p.status='active' AND m.status='active' AND w.status='active' FOR UPDATE`, [row.entity_id, siteId, presenceId]);
        if (target.rowCount !== 1) refuse("AssetUsage target ownership");
        const occupied = await client.query("SELECT id FROM public.asset_usages WHERE entity_type='section' AND entity_id=$1 AND role='image'", [row.entity_id]);
        if (occupied.rowCount !== 0) refuse("occupied image role");
      }
      const keys = Object.keys(row); // Private fixed plan only; never operator input.
      const result = await client.query(`INSERT INTO public.${table} (${keys.join(", ")}) VALUES (${keys.map((_, index) => `$${index + 1}`).join(", ")})`, Object.values(row));
      if (result.rowCount !== 1) throw new Error("Expected exactly one inserted record");
    };
    for (const item of plan.inserts.filter(item => item.table !== "navigation_items")) await insert(item);
    // Replace scaffolding only after all dependent Pages/Sections/Actions/usages
    // have succeeded. Deletion is limited to two reviewed Navigation item UUIDs.
    for (const row of plan.deletes) {
      const result = await client.query("DELETE FROM public.navigation_items WHERE id=$1 AND navigation_id=$2", [row.id, navigationId]);
      if (result.rowCount !== 1) throw new Error("Expected exactly one retired Navigation item");
    }
    for (const item of plan.inserts.filter(item => item.table === "navigation_items")) await insert(item);
    await client.query("COMMIT");
    return { changed: plan.changed, inserted: plan.inserts.length, updated: 0, deleted: plan.deletes.length };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
