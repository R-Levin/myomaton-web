import { isDeepStrictEqual } from "node:util";
import type { Pool } from "pg";
import frozenBaseline from "./myomaton-visual-direction-v2-baseline.json";
import frozenIntended from "./myomaton-visual-direction-v2-intended.json";
import { tables, presenceId, siteId, type Row, type State } from "./myomaton-visual-direction-v1";

export { tables, presenceId, siteId, type State };
export const baseline: State = frozenBaseline;
export const intended: State = frozenIntended;
const guardedTables = [...tables, "migrations"] as const;
const writableFields: Partial<Record<typeof tables[number], readonly string[]>> = {
  managed_sites: ["configuration"], design_systems: ["configuration"],
  sections: ["configuration", "sort_order", "content", "status"],
  actions: ["label"], asset_usages: ["asset_id"],
};

function refuse(detail: string): never {
  throw Error(`Myomaton Visual Direction v2 conflict: ${detail}. No changes committed. No force/reset or partial repair mode.`);
}
function equalRows(actual: unknown, expected: Row[]) {
  return Array.isArray(actual) && actual.length === expected.length && expected.every(row =>
    actual.filter(item => item?.id === row.id).length === 1
    && isDeepStrictEqual(actual.find(item => item?.id === row.id), row));
}
function equalState(actual: State, expected: State) {
  return isDeepStrictEqual(Object.keys(actual).sort(), Object.keys(expected).sort())
    && guardedTables.every(t => equalRows(actual[t], expected[t]));
}

// A frozen, reviewed transition, not a presentation file interpreter or sync tool.
// Full snapshots include all unchanged values, identities, relationships and dates.
export function transitionChanges() {
  const changes: { table: typeof tables[number]; before: Row; after: Row; fields: string[] }[] = [];
  if (baseline.migrations.length !== 8 || baseline.pages.length !== 4 || baseline.sections.length !== 29) refuse("invalid frozen baseline");
  const pages = new Set(baseline.pages.filter(p => p.managed_site_id === siteId).map(p => p.id));
  for (const table of guardedTables) {
    if (baseline[table].length !== intended[table].length) refuse(`frozen ${table} cardinality differs`);
    for (const before of baseline[table]) {
      const matches = intended[table].filter(row => row.id === before.id);
      if (matches.length !== 1) refuse(`frozen ${table} identity differs`);
      const after = matches[0];
      if (!isDeepStrictEqual(Object.keys(before).sort(), Object.keys(after).sort())) refuse(`frozen ${table} fields differ`);
      const fields = Object.keys(before).filter(k => !isDeepStrictEqual(before[k], after[k]));
      if (!fields.length) continue;
      if (table === "migrations" || fields.some(k => !writableFields[table]?.includes(k))) refuse(`unapproved frozen ${table} field change`);
      const owned = table === "managed_sites" ? before.id === siteId && before.web_presence_id === presenceId
        : table === "sections" ? pages.has(before.page_id)
          : before.web_presence_id === presenceId;
      if (!owned) refuse(`foreign frozen ${table} change`);
      changes.push({ table, before, after, fields });
    }
  }
  return changes;
}

export function planVisualDirectionV2(state: State) {
  const changes = transitionChanges();
  if (equalState(state, intended)) return { changed: false, changes: [] };
  if (equalState(state, baseline)) return { changed: true, changes };
  const mismatches = guardedTables.filter(t => !equalRows(state[t], baseline[t]));
  return refuse(`state is neither exact frozen v1 nor exact accepted v2 (${mismatches.join(", ")})`);
}

export async function updateVisualDirectionV2(pool: Pick<Pool, "connect">) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    // Prevent customer-row drift/phantoms and migration inserts during the guard.
    await client.query(`LOCK TABLE ${tables.map(t => `public.${t}`).join(", ")} IN SHARE ROW EXCLUSIVE MODE`);
    await client.query("LOCK TABLE drizzle.__drizzle_migrations IN SHARE MODE");
    const read = async () => {
      const state = {} as State;
      for (const t of tables) state[t] = (await client.query<{ row: Row }>(`SELECT to_jsonb(t) AS row FROM public.${t} t ORDER BY id`)).rows.map(r => r.row);
      state.migrations = (await client.query<{ row: Row }>("SELECT to_jsonb(t) AS row FROM drizzle.__drizzle_migrations t ORDER BY id")).rows.map(r => r.row);
      return state;
    };
    const plan = planVisualDirectionV2(await read());
    for (const change of plan.changes) {
      // Identifiers come only from the fixed table/field allowlist. PostgreSQL
      // types the reviewed values through its existing row type (no new schema).
      const columns = change.fields.map(k => `"${k}"`).join(", ");
      const values = change.fields.map(k => `patched."${k}"`).join(", ");
      const result = await client.query(`UPDATE public.${change.table} AS target
        SET (${columns}) = (SELECT ${values} FROM jsonb_populate_record(NULL::public.${change.table}, $1::jsonb) AS patched)
        WHERE target.id=$2 AND to_jsonb(target)=$3::jsonb`,
      [JSON.stringify(change.after), change.before.id, JSON.stringify(change.before)]);
      if (result.rowCount !== 1) throw Error(`Expected one guarded ${change.table} update`);
    }
    if (!equalState(await read(), intended)) throw Error("Full accepted v2 postcondition failed");
    await client.query("COMMIT");
    return { changed: plan.changed, inserted: 0, updated: plan.changes.length, deleted: 0 };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
