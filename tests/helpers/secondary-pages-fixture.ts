import assert from "node:assert/strict";
import type { Pool } from "pg";
import { baseline, type State } from "../../scripts/customer-updates/myomaton-secondary-pages-v1";

export function secondaryFixture(initial: State = baseline, failAt = Infinity) {
  let state = structuredClone(initial), saved: State | undefined, writes = 0;
  const client = { release() {}, async query(sql: string, values: unknown[] = []) {
    if (sql === "BEGIN") { saved = structuredClone(state); return { rows: [], rowCount: 0 }; }
    if (sql === "ROLLBACK") { state = saved!; return { rows: [], rowCount: 0 }; }
    if (sql === "COMMIT" || sql.startsWith("SET LOCAL") || sql.startsWith("LOCK TABLE")) return { rows: [], rowCount: 0 };
    const select = sql.match(/^SELECT to_jsonb\(t\) AS row FROM public\.(\w+) t ORDER BY id$/);
    if (select) return { rows: state[select[1] as keyof State].map(row => ({ row: structuredClone(row) })) };
    if (sql.startsWith("SELECT s.id")) {
      const section = state.sections.find(row => row.id === values[0]);
      const page = state.pages.find(row => row.id === section?.page_id);
      const site = state.managed_sites.find(row => row.id === page?.managed_site_id);
      const presence = state.web_presences.find(row => row.id === site?.web_presence_id);
      const valid = section?.type === "intro" && site?.id === values[1] && presence?.id === values[2]
        && [section, page, site, presence].every(row => row?.status === "active");
      return { rows: valid ? [{ id: section!.id }] : [], rowCount: valid ? 1 : 0 };
    }
    if (sql.startsWith("SELECT id FROM public.asset_usages")) {
      const rows = state.asset_usages.filter(row => row.entity_type === "section" && row.entity_id === values[0] && row.role === "image");
      return { rows, rowCount: rows.length };
    }
    writes++; if (writes === failAt) throw new Error("forced failure");
    const insert = sql.match(/^INSERT INTO public\.(\w+) \((.+)\) VALUES/);
    if (insert) {
      const row: Record<string, unknown> = { ...Object.fromEntries(insert[2].split(", ").map((key, i) => [key, structuredClone(values[i])])),
        created_at: "2030-01-01T00:00:00+00:00", updated_at: "2030-01-01T00:00:00+00:00" };
      assert.equal(typeof row.id, "string");
      state[insert[1] as keyof State].push(row as State["pages"][number]);
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("DELETE FROM public.navigation_items")) {
      const before = state.navigation_items.length;
      state.navigation_items = state.navigation_items.filter(row => !(row.id === values[0] && row.navigation_id === values[1]));
      return { rows: [], rowCount: before - state.navigation_items.length };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  } };
  return { pool: { connect: async () => client } as unknown as Pick<Pool, "connect">, get state() { return state; }, get writes() { return writes; } };
}
