import assert from "node:assert/strict";
import { test } from "node:test";
import type { Pool } from "pg";
import { baseline, intendedConfiguration, planVisualDirectionV1, updateVisualDirectionV1,
  visualDirectionV1, siteId, presenceId, type State } from "../scripts/customer-updates/myomaton-visual-direction-v1";
import { resolveVisualDirection, allocateMotion, sectionPresentation } from "../lib/platform/visual-direction/model";
import { resolveVisualPolicy } from "../lib/platform/policy/site-policy";
import { normalizeSection } from "../lib/platform/managed-sites/sections";
import { SectionRenderer } from "../components/managed-sites/section-renderer";
import { renderToStaticMarkup } from "react-dom/server";

function fixture(initial = baseline, failAfterWrite = false) {
  let state = structuredClone(initial), saved: State, writes = 0;
  const client = { release() {}, async query(sql: string, values: unknown[] = []) {
    if (sql === "BEGIN") { saved = structuredClone(state); return { rows: [] }; }
    if (sql === "ROLLBACK") { state = saved; return { rows: [] }; }
    if (sql === "COMMIT" || sql.startsWith("SET LOCAL") || sql.startsWith("LOCK TABLE")) return { rows: [] };
    if (sql.includes("FROM drizzle.__drizzle_migrations")) return { rows: state.migrations.map(row => ({ row })) };
    const select = sql.match(/^SELECT to_jsonb\(t\) AS row FROM public\.(\w+) t ORDER BY id$/);
    if (select) return { rows: state[select[1] as keyof State].map(row => ({ row: structuredClone(row) })) };
    assert.match(sql, /^UPDATE public.managed_sites/);
    assert.match(sql, /SET configuration = jsonb_set/);
    assert.equal(values[1], siteId); assert.equal(values[2], presenceId);
    const site = state.managed_sites.find(row => row.id === siteId)!;
    assert.deepEqual(site.configuration, JSON.parse(String(values[3])));
    site.configuration = { ...site.configuration as object, visualDirection: JSON.parse(String(values[0])) };
    writes++;
    if (failAfterWrite) throw Error("forced failure after write");
    return { rowCount: 1, rows: [] };
  } };
  return { pool: { connect: async () => client } as unknown as Pick<Pool, "connect">, get state() { return state; }, get writes() { return writes; } };
}

test("reviewed baseline changes only Visual Direction intent; exact rerun performs zero writes", async () => {
  const f = fixture(), before = structuredClone(f.state);
  assert.deepEqual(await updateVisualDirectionV1(f.pool), { changed: true, inserted: 0, updated: 1, deleted: 0 });
  const expected = structuredClone(before);
  expected.managed_sites[0].configuration = intendedConfiguration(before.managed_sites[0].configuration as Record<string, unknown>);
  assert.deepEqual(f.state, expected); // Includes every value, timestamp and relationship.
  assert.deepEqual(await updateVisualDirectionV1(f.pool), { changed: false, inserted: 0, updated: 0, deleted: 0 });
  assert.equal(f.writes, 1); assert.deepEqual(f.state, expected);
});

test("configuration merge preserves unrelated keys; unreviewed keys never bypass the guard", async () => {
  const other = { globals: { header: { showPhone: false } }, policy: { socialLinksEnabled: false } };
  assert.deepEqual(intendedConfiguration(other), { ...other, visualDirection: visualDirectionV1 });
  assert.equal(Object.hasOwn(other, "visualDirection"), false);
  const state = structuredClone(baseline); state.managed_sites[0].configuration = other;
  const f = fixture(state); await assert.rejects(updateVisualDirectionV1(f.pool), /conflict/);
  assert.deepEqual(f.state, state); assert.equal(f.writes, 0);
});

test("customized, malformed, partial and foreign state refuses rather than repairing", async () => {
  const cases: ((s: State) => void)[] = [
    s => { s.managed_sites[0].configuration = { visualDirection: null }; },
    s => { s.managed_sites[0].configuration = { visualDirection: { profileId: "reference" } }; },
    s => { s.managed_sites[0].configuration = { visualDirection: { ...visualDirectionV1, preferences: { motion: "off" } } }; },
    s => { s.managed_sites[0].configuration = []; },
    s => { s.managed_sites[0].id = "wrong-site"; },
    s => { s.managed_sites[0].web_presence_id = "wrong-presence"; },
    s => { s.web_presences[0].id = "wrong-presence"; },
    s => { s.sections[0].content = { heading: "Customized" }; },
    s => { s.navigation_items.pop(); },
    s => { s.design_systems[0].configuration = {}; },
    s => { s.assets[0].alt_text = "Changed"; },
    s => { s.asset_usages.pop(); },
    s => { s.migrations.pop(); },
    s => { s.managed_sites.push(structuredClone(s.managed_sites[0])); },
  ];
  for (const change of cases) {
    const state = structuredClone(baseline); change(state);
    const f = fixture(state); await assert.rejects(updateVisualDirectionV1(f.pool), /conflict/);
    assert.deepEqual(f.state, state); assert.equal(f.writes, 0);
  }
});

test("failure after mutation rolls back the complete transaction", async () => {
  const f = fixture(baseline, true);
  await assert.rejects(updateVisualDirectionV1(f.pool), /forced failure/);
  assert.equal(f.writes, 1); assert.deepEqual(f.state, baseline);
});

test("all four reviewed Pages use supported treatment and preserve explicit layout/content", () => {
  const config = planVisualDirectionV1(baseline).configuration;
  const direction = resolveVisualDirection(config).direction!;
  assert.equal(direction.profileId, "reference"); assert.equal(direction.hero, "graphic");
  assert.equal(direction.image, "framed"); assert.equal(direction.elevation, "subtle");
  assert.equal(direction.icons, "functional"); assert.equal(direction.backdrop, "opaque");
  assert.equal(direction.motion, "minimal", "current default policy caps the Light request");
  for (const page of baseline.pages) {
    const rows = baseline.sections.filter(s => s.page_id === page.id).sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
    const projected = rows.map(s => ({ id: String(s.id), type: String(s.type), content: s.content }));
    assert.deepEqual([...allocateMotion(projected, direction.motion)], [[String(rows[0].id), 0]]);
    const light = resolveVisualDirection(config, resolveVisualPolicy({ visualMaxMotion: { value: "light" } })).direction!;
    assert.equal(allocateMotion(projected, light.motion).size, 2, "only Hero and closing CTA qualify");
    for (const [index, row] of rows.entries()) {
      const n = normalizeSection(row)!; assert.ok(n);
      const presentation = sectionPresentation(n.configuration, row.configuration, n.type, index, direction);
      assert.equal(presentation.surface, index % 2 === 1 || n.type === "cta" ? "subtle" : "default");
      assert.equal(presentation.divider, "none"); assert.equal(presentation.spacing, "spacious");
      for (const [key, value] of Object.entries(row.configuration as object)) {
        if (key in n.configuration) assert.equal(presentation[key as keyof typeof presentation], value);
      }
      const html = renderToStaticMarkup(<SectionRenderer section={{ id: String(row.id), type: String(row.type),
        variant: String(row.variant), name: String(row.name), content: row.content, configuration: row.configuration }} direction={direction} index={index} />);
      assert.ok(html.includes('data-divider="none"')); assert.ok(html.includes('data-spacing="spacious"'));
      if (n.type === "hero") assert.ok(html.includes('data-hero-treatment="graphic"'));
    }
  }
});
