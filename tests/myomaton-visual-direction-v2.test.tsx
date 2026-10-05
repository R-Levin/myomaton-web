import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import type { Pool } from "pg";
import { baseline, intended, tables, siteId, transitionChanges, planVisualDirectionV2,
  updateVisualDirectionV2, type State } from "../scripts/customer-updates/myomaton-visual-direction-v2";
import { resolveVisualDirection, allocateMotion } from "../lib/platform/visual-direction/model";

function fixture(initial = baseline, failAt = 0, corruptPostcondition = false, wrongRowCount = false) {
  let state = structuredClone(initial), saved: State, writes = 0;
  const client = { release() {}, async query(sql: string, values: unknown[] = []) {
    if (sql === "BEGIN") { saved = structuredClone(state); return { rows: [] }; }
    if (sql === "ROLLBACK") { state = saved; return { rows: [] }; }
    if (sql === "COMMIT" || sql.startsWith("SET LOCAL") || sql.startsWith("LOCK TABLE")) return { rows: [] };
    if (sql.includes("FROM drizzle.__drizzle_migrations")) return { rows: state.migrations.map(row => ({ row })) };
    const select = sql.match(/^SELECT to_jsonb\(t\) AS row FROM public\.(\w+) t ORDER BY id$/);
    if (select) return { rows: state[select[1] as keyof State].map(row => ({ row: structuredClone(row) })) };
    const update = sql.match(/^UPDATE public\.(\w+) AS target/); assert.ok(update);
    assert.match(sql, /WHERE target.id=\$2 AND to_jsonb\(target\)=\$3::jsonb/);
    const table = update[1] as typeof tables[number];
    const row = state[table].find(r => r.id === values[1])!;
    assert.deepEqual(row, JSON.parse(String(values[2])));
    const after = JSON.parse(String(values[0]));
    for (const field of transitionChanges().find(c => c.table === table && c.before.id === row.id)!.fields) row[field] = after[field];
    writes++;
    if (failAt === writes) throw Error("forced write failure");
    if (corruptPostcondition) state.navigation_items[0].sort_order = -999;
    return { rows: [], rowCount: wrongRowCount ? 0 : 1 };
  } };
  return { pool: { connect: async () => client } as unknown as Pick<Pool, "connect">,
    get state() { return state; }, get writes() { return writes; } };
}

test("exact frozen v1 applies accepted v2; exact rerun performs zero writes", async () => {
  const f = fixture(); assert.equal(planVisualDirectionV2(f.state).changed, true);
  assert.equal(transitionChanges().length, 35);
  assert.deepEqual(await updateVisualDirectionV2(f.pool), { changed: true, inserted: 0, updated: 35, deleted: 0 });
  assert.deepEqual(f.state, intended);
  assert.deepEqual(await updateVisualDirectionV2(f.pool), { changed: false, inserted: 0, updated: 0, deleted: 0 });
  assert.equal(f.writes, 35); assert.deepEqual(f.state, intended);
  const shuffled = structuredClone(baseline);
  for (const rows of Object.values(shuffled)) rows.reverse();
  assert.equal(planVisualDirectionV2(shuffled).changed, true, "row order is not identity");
});

test("every guarded table, customization, foreign state and partial transition refuses before writes", async () => {
  const cases: State[] = [];
  for (const table of [...tables, "migrations"] as const) {
    const s = structuredClone(baseline);
    if (s[table].length) s[table][0].updated_at = "unreviewed";
    else s[table].push({ id: "unexpected-record" });
    cases.push(s);
  }
  for (const c of transitionChanges()) {
    const s = structuredClone(baseline);
    s[c.table] = s[c.table].map(r => r.id === c.before.id ? structuredClone(c.after) : r);
    cases.push(s);
  }
  const customized = structuredClone(intended); customized.sections[0].content = { heading: "Customized" }; cases.push(customized);
  const foreign = structuredClone(baseline); foreign.web_presences.push({ id: "another-customer" }); cases.push(foreign);
  const missing = structuredClone(baseline); missing.sections.pop(); cases.push(missing);
  const duplicate = structuredClone(baseline); duplicate.actions.push(structuredClone(duplicate.actions[0])); cases.push(duplicate);
  for (const initial of cases) {
    const f = fixture(initial); await assert.rejects(updateVisualDirectionV2(f.pool), /v2 conflict/);
    assert.deepEqual(f.state, initial); assert.equal(f.writes, 0);
  }
});

test("forced failure at every write, affected-row mismatch and postcondition drift roll back completely", async () => {
  for (let i = 1; i <= transitionChanges().length; i++) {
    const f = fixture(baseline, i); await assert.rejects(updateVisualDirectionV2(f.pool), /forced/);
    assert.deepEqual(f.state, baseline);
  }
  const wrong = fixture(baseline, 0, false, true);
  await assert.rejects(updateVisualDirectionV2(wrong.pool), /Expected one guarded/); assert.deepEqual(wrong.state, baseline);
  const corrupt = fixture(baseline, 0, true);
  await assert.rejects(updateVisualDirectionV2(corrupt.pool), /postcondition/); assert.deepEqual(corrupt.state, baseline);
});

test("frozen contract preserves identities, dates, facts, destinations and all nonselected records", () => {
  for (const t of [...tables, "migrations"] as const) {
    assert.deepEqual(intended[t].map(r => r.id), baseline[t].map(r => r.id));
    for (const row of baseline[t]) {
      const target = intended[t].find(r => r.id === row.id)!;
      for (const k of ["created_at", "updated_at", "version", "metadata"]) assert.deepEqual(target[k], row[k]);
    }
  }
  for (const t of ["organizations", "web_presences", "pages", "navigations", "navigation_items", "subjects", "subject_types", "assets", "contact_definitions", "contact_submissions", "migrations"] as const) assert.deepEqual(intended[t], baseline[t]);
  for (const a of baseline.actions) assert.equal(intended.actions.find(r => r.id === a.id)!.destination, a.destination);
  for (const section of baseline.sections) {
    const target = intended.sections.find(r => r.id === section.id)!;
    if (section.id === "6c763a29-4404-4fe7-be6f-ab60de3bfcbe") {
      const before = section.content as { text: string }, after = target.content as { heading: string; text: string };
      assert.equal([after.heading, after.text].join("\n\n"), before.text, "lead moved, not invented or truncated");
    } else assert.deepEqual({ ...target.content as object, actionId: (section.content as { actionId?: string }).actionId }, { ...section.content as object, actionId: (section.content as { actionId?: string }).actionId });
  }
  for (const usage of baseline.asset_usages) {
    const target = intended.asset_usages.find(r => r.id === usage.id)!;
    assert.deepEqual({ ...target, asset_id: usage.asset_id }, usage);
    if (usage.id !== "9475a91c-e0ad-4373-b5e9-65ca6fe649e7") assert.deepEqual(target, usage);
  }
  const beforeDesign = baseline.design_systems[0].configuration as { colors: unknown };
  assert.deepEqual({ ...intended.design_systems[0].configuration as object, colors: beforeDesign.colors }, beforeDesign);
});

test("accepted presentation file maps exactly to frozen intended state without preview dependencies", () => {
  const p = JSON.parse(readFileSync("scripts/previews/myomaton-composition.json", "utf8"));
  for (const [id, order] of Object.entries(p.pageOrder as Record<string, string[]>)) {
    assert.deepEqual(intended.sections.filter(s => s.page_id === id).sort((a,b) => Number(a.sort_order)-Number(b.sort_order)).map(s => s.id), order);
  }
  for (const [id, config] of Object.entries(p.sections)) {
    const original = baseline.sections.find(s => s.id === id)!;
    assert.deepEqual(intended.sections.find(s => s.id === id)!.configuration, { ...original.configuration as object, ...config as object });
  }
  assert.deepEqual((intended.design_systems[0].configuration as { colors: object }).colors, { ...(baseline.design_systems[0].configuration as { colors: object }).colors, ...p.colors });
  assert.deepEqual(intended.sections.filter(s => s.status === "inactive").map(s => s.id), p.inactiveSections);
  for (const [id, label] of Object.entries(p.actionLabels)) assert.equal(intended.actions.find(a => a.id === id)!.label, label);
  for (const [id, actionId] of Object.entries(p.actions)) assert.equal((intended.sections.find(s => s.id === id)!.content as { actionId: string }).actionId, actionId);
  for (const [id, assetId] of Object.entries(p.imageSelections)) assert.equal(intended.asset_usages.find(u => u.id === id)!.asset_id, assetId);
  const direction = resolveVisualDirection(intended.managed_sites.find(s => s.id === siteId)!.configuration).direction!;
  assert.equal(direction.profileVersion, 2); assert.equal(direction.motion, "minimal");
  for (const page of intended.pages) {
    const ss = intended.sections.filter(s => s.page_id === page.id && s.status === "active").sort((a,b) => Number(a.sort_order)-Number(b.sort_order));
    assert.deepEqual([...allocateMotion(ss.map(s => ({ id: String(s.id), type: String(s.type), content: s.content })), direction.motion)], [[ss[0].id, 0]]);
  }
  const source = readFileSync("scripts/customer-updates/myomaton-visual-direction-v2.ts", "utf8");
  assert.doesNotMatch(source, /previews\/|myomaton-composition|preview-reference/);
});
