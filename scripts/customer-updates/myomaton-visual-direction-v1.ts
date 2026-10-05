import { isDeepStrictEqual } from "node:util";
import type { Pool } from "pg";
import frozen from "./myomaton-visual-direction-v1-baseline.json";

export const presenceId = "1b72cd7d-92b9-4f55-aba6-825d69d493af";
export const siteId = "7fd60824-a933-401d-8099-7b64f24cc408";
export const visualDirectionV1 = {
  profileId: "reference", profileVersion: 1,
  preferences: { hero: "graphic", density: "airy", motion: "light" },
} as const;
export const tables = ["organizations", "web_presences", "managed_sites", "pages", "sections", "actions",
  "subjects", "subject_types", "design_systems", "navigations", "navigation_items", "assets", "asset_usages",
  "contact_definitions", "contact_submissions"] as const;
export type Row = Record<string, unknown>;
export type State = Record<typeof tables[number] | "migrations", Row[]>;
export const baseline: State = frozen;

// This is a frozen transition, not a continuing synchronization authority.
export function intendedConfiguration(configuration: Record<string, unknown>) {
  return { ...configuration, visualDirection: structuredClone(visualDirectionV1) };
}
function refuse(detail: string): never {
  throw new Error(`Myomaton Visual Direction v1 conflict: ${detail}. No changes committed. Inspect canonical state; no force/reset or repair mode.`);
}
function equalRows(actual: Row[], expected: Row[]) {
  return actual.length === expected.length && expected.every(row =>
    actual.filter(item => item.id === row.id).length === 1 && isDeepStrictEqual(actual.find(item => item.id === row.id), row));
}
export function planVisualDirectionV1(state: State) {
  const reviewed = baseline.managed_sites.find(row => row.id === siteId)!;
  const configuration = intendedConfiguration(reviewed.configuration as Record<string, unknown>);
  for (const table of [...tables, "migrations"] as const) {
    if (table === "managed_sites") continue;
    if (!equalRows(state[table], baseline[table])) refuse(`${table} differs from the reviewed baseline`);
  }
  if (equalRows(state.managed_sites, baseline.managed_sites)) return { changed: true, configuration };
  const intended = baseline.managed_sites.map(row => row.id === siteId ? { ...row, configuration } : row);
  if (equalRows(state.managed_sites, intended)) return { changed: false, configuration };
  return refuse("Managed Site identity/configuration is neither exact baseline nor exact intended state");
}

export async function updateVisualDirectionV1(pool: Pick<Pool, "connect">) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    // Short explicit maintenance operation: prevent drift/phantoms between guard
    // and mutation, including records that must remain unchanged.
    await client.query(`LOCK TABLE ${tables.map(t => `public.${t}`).join(", ")} IN SHARE ROW EXCLUSIVE MODE`);
    const read = async () => {
      const state = {} as State;
      for (const table of tables) state[table] = (await client.query<{ row: Row }>(`SELECT to_jsonb(t) AS row FROM public.${table} t ORDER BY id`)).rows.map(r => r.row);
      state.migrations = (await client.query<{ row: Row }>("SELECT to_jsonb(t) AS row FROM drizzle.__drizzle_migrations t ORDER BY id")).rows.map(r => r.row);
      return state;
    };
    const plan = planVisualDirectionV1(await read());
    if (plan.changed) {
      const reviewed = baseline.managed_sites.find(row => row.id === siteId)!;
      const result = await client.query(`UPDATE public.managed_sites
        SET configuration = jsonb_set(configuration, '{visualDirection}', $1::jsonb, true)
        WHERE id=$2 AND web_presence_id=$3 AND configuration=$4::jsonb`,
      [JSON.stringify(visualDirectionV1), siteId, presenceId, JSON.stringify(reviewed.configuration)]);
      if (result.rowCount !== 1) throw new Error("Expected exactly one Managed Site configuration update");
      if (planVisualDirectionV1(await read()).changed) throw new Error("Visual Direction postcondition failed");
    }
    await client.query("COMMIT");
    return { changed: plan.changed, inserted: 0, updated: plan.changed ? 1 : 0, deleted: 0 };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
