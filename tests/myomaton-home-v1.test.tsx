import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Pool } from "pg";
import { renderToStaticMarkup } from "react-dom/server";
import { baseline, pageId, planHomeV1, presenceId, tables, updateMyomatonHomeV1, type Row, type State, type Table } from "../scripts/customer-updates/myomaton-home-v1";
import { homeV1Ids, projectDrafts, projectsActionDraft } from "../scripts/customer-updates/myomaton-home-v1-content";
import { normalizeSection } from "../lib/platform/microsites/sections";
import { normalizeAction } from "../lib/platform/actions/model";
import { presentCollection } from "../lib/platform/microsites/collections";
import { SectionRenderer } from "../components/microsites/section-renderer";

// Isolated SQL protocol fixture, with no pg Client/Pool construction or environment loading.
// Tests the real writer and rollback control flow; not PostgreSQL locking/constraint coverage.
function fixture() {
  let state: State = structuredClone(baseline);
  for (const rows of Object.values(state)) for (const row of rows) Object.assign(row, {
    metadata: { retained: row.id }, created_at: "original-created", updated_at: "original-updated",
  });
  let snapshot: State | undefined;
  const statements: string[] = [];
  const writes: string[] = [];
  let failAt = Infinity;
  let released = false;
  const client = {
    release() { released = true; },
    async query(sql: string, params: unknown[] = []) {
      statements.push(sql);
      if (sql === "BEGIN") { assert.equal(snapshot, undefined); snapshot = structuredClone(state); return { rows: [] }; }
      if (sql === "ROLLBACK") { assert.ok(snapshot); state = snapshot; snapshot = undefined; return { rows: [] }; }
      if (sql === "COMMIT") { assert.ok(snapshot); snapshot = undefined; return { rows: [] }; }
      assert.ok(snapshot, "Every query runs in the transaction");
      if (sql.startsWith("SET LOCAL")) return { rows: [] };
      if (sql.startsWith("LOCK TABLE")) {
        assert.equal(sql, `LOCK TABLE ${tables.map(table => `public.${table}`).join(", ")} IN SHARE ROW EXCLUSIVE MODE`);
        return { rows: [] };
      }
      assert.ok(statements.some(statement => statement.startsWith("LOCK TABLE")), "Lock before reads/writes");
      if (sql.startsWith("SELECT")) {
        const match = sql.match(/^SELECT \* FROM public\.([a-z_]+) ORDER BY id$/); assert.ok(match, sql);
        return { rows: structuredClone(state[match[1] as Table]) };
      }
      assert.match(sql, /^(INSERT INTO public\.(subjects|actions|sections)|UPDATE public\.(sections|navigation_items)) /);
      writes.push(sql);
      if (writes.length === failAt) throw new Error("Forced fixture failure");
      if (sql.startsWith("INSERT")) {
        const match = sql.match(/^INSERT INTO public\.([a-z_]+) \(([^)]+)\) VALUES \(([^)]+)\)$/); assert.ok(match, sql);
        const table = match[1] as Table;
        const keys = match[2].split(", ");
        assert.equal(match[3], keys.map((_, i) => `$${i + 1}`).join(", "));
        const row = Object.fromEntries(keys.map((key, i) => [key, structuredClone(params[i])])) as Row;
        assert.ok(!state[table].some(existing => existing.id === row.id));
        state[table].push({ ...row, created_at: "new-created", updated_at: "new-updated" });
      } else if (sql.startsWith("UPDATE public.navigation_items")) {
        assert.equal(sql, "UPDATE public.navigation_items SET target_reference = $1, version = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND navigation_id = $4");
        const row = state.navigation_items.find(row => row.id === params[2] && row.navigation_id === params[3]); assert.ok(row);
        Object.assign(row, { target_reference: params[0], version: params[1], updated_at: "new-updated" });
      } else {
        assert.equal(sql, "UPDATE public.sections SET content = $1, variant = $2, sort_order = $3, version = $4, configuration = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 AND page_id = $7");
        const row = state.sections.find(row => row.id === params[5] && row.page_id === params[6]); assert.ok(row);
        Object.assign(row, { content: structuredClone(params[0]), variant: params[1], sort_order: params[2], version: params[3], configuration: structuredClone(params[4]), updated_at: "new-updated" });
      }
      return { rows: [], rowCount: 1 };
    },
  };
  return { pool: { connect: async () => client } as unknown as Pick<Pool, "connect">,
    get state() { return state; }, get released() { return released; }, statements, writes,
    failOnWrite(number: number) { failAt = number; } };
}

test("exact live baseline transitions once; exact Home v1 rerun writes nothing including timestamps", async () => {
  const f = fixture(); const before = structuredClone(f.state);
  assert.equal(before.sections.find(row => row.name === "Primary Call to Action")!.version, 2);
  const result = await updateMyomatonHomeV1(f.pool);
  assert.deepEqual({ changed: result.changed, inserted: result.inserted, updated: result.updated }, { changed: true, inserted: 9, updated: 4 });
  const ordered = f.state.sections.toSorted((a, b) => Number(a.sort_order) - Number(b.sort_order));
  assert.deepEqual(ordered.map(row => [row.name, row.type, row.sort_order, row.variant]), [
    ["Hero", "hero", 0, "default"], ["Ownership", "intro", 10, "stack"],
    ["Introduction", "intro", 20, "split-text-first"], ["Current Projects", "collection", 30, "grid"],
    ["Robot Ecosystem", "intro", 40, "stack"], ["Principles", "collection", 50, "grid"],
    ["Physical Experimentation", "intro", 60, "stack"], ["Sharing", "intro", 70, "stack"],
    ["Primary Call to Action", "cta", 80, "default"],
  ]);
  for (const old of before.sections) {
    const row = f.state.sections.find(row => row.id === old.id)!;
    assert.equal(row.name, old.name); assert.equal(row.created_at, old.created_at);
    assert.deepEqual(row.metadata, old.metadata); assert.deepEqual(row.configuration, old.name === "Introduction" ? {} : old.configuration);
    assert.equal(row.version, Number(old.version) + 1);
  }
  assert.equal(ordered[2].id, "680318d0-a606-4d70-af92-1b5a69735ca6");
  for (const table of tables.filter(table => !["sections", "subjects", "actions", "navigation_items"].includes(table))) assert.deepEqual(f.state[table], before[table]);
  const after = structuredClone(f.state), writes = f.writes.length;
  assert.equal((await updateMyomatonHomeV1(f.pool)).changed, false);
  assert.equal(f.writes.length, writes); assert.deepEqual(f.state, after); assert.ok(f.released);
});

test("projects store only durable item/Subject references, principles stay inline, and renderer accepts all copy", async () => {
  const f = fixture(); await updateMyomatonHomeV1(f.pool);
  const projects = f.state.sections.find(row => row.id === homeV1Ids.projects)!;
  assert.deepEqual(projects.configuration, { anchor: "current-projects", columns: 2 });
  assert.deepEqual(projects.content, { heading: "Current Projects", itemSource: "subjects", items: [
    { id: "project-001", subjectId: homeV1Ids.tabot }, { id: "project-002", subjectId: homeV1Ids.abot },
  ] });
  assert.equal(f.state.subjects.length, 3);
  for (const draft of projectDrafts) {
    const row = f.state.subjects.find(row => row.id === draft.id)!;
    assert.equal(row.description, draft.description); assert.equal(row.subject_type_id, baseline.subject_types[0].id);
  }
  const principles = f.state.sections.find(row => row.id === homeV1Ids.principles)!;
  const normalized = normalizeSection(principles); assert.ok(normalized?.type === "collection");
  assert.equal(normalized.configuration.columns, 3); assert.equal(normalized.content.itemSource, "inline");
  assert.equal(normalized.content.items.length, 5);
  assert.deepEqual(presentCollection(normalized.content).map(item => item.heading), ["Affordable", "Understandable", "Repairable", "Local-first", "No mandatory cloud or subscription"]);
  for (const row of f.state.sections) {
    const section = normalizeSection(row); assert.ok(section);
    assert.deepEqual(section.content, row.content, "No unsupported content fields discarded");
    const html = renderToStaticMarkup(<SectionRenderer section={{ ...section, id: row.id, name: String(row.name) }} />);
    assert.ok(html.includes("<section"));
  }
});

test("About anchor and existing Navigation item move together, preserving all other Navigation and Action fields", async () => {
  const f = fixture(); const before = structuredClone(f.state);
  await updateMyomatonHomeV1(f.pool);
  assert.deepEqual(f.state.sections.filter(row => (row.configuration as Record<string, unknown>).anchor === "about").map(row => row.id), [homeV1Ids.ownership]);
  assert.deepEqual(f.state.sections.find(row => row.name === "Introduction")!.configuration, {});
  for (const old of before.navigation_items) {
    const row = f.state.navigation_items.find(row => row.id === old.id)!;
    assert.deepEqual(row, old.name === "About" ? {
      ...old, target_reference: homeV1Ids.ownership, version: 2, updated_at: "new-updated",
    } : old);
  }
  assert.deepEqual(f.state.navigations, before.navigations);
  assert.deepEqual(f.state.actions.find(row => row.id === before.actions[0].id), before.actions[0]);
  assert.deepEqual(f.state.asset_usages, before.asset_usages);
  assert.deepEqual(f.state.assets, before.assets);
});

test("partial About moves, customized Navigation and the superseded Home v1 anchor arrangement refuse", async () => {
  for (const phase of ["baseline", "intended"]) {
    for (const change of ["target", "label", "version", "identity", "extra", "anchor", "old-arrangement"]) {
      const f = fixture();
      if (phase === "intended") await updateMyomatonHomeV1(f.pool);
      const about = f.state.navigation_items.find(row => row.name === "About")!;
      if (change === "target") about.target_reference = phase === "baseline" ? homeV1Ids.ownership : "680318d0-a606-4d70-af92-1b5a69735ca6";
      if (change === "label") about.label = "Customized";
      if (change === "version") about.version = 42;
      if (change === "identity") about.id = randomUUID();
      if (change === "extra") f.state.navigation_items.push({ ...about, id: randomUUID() });
      if (change === "anchor" || change === "old-arrangement") {
        f.state.sections.find(row => row.name === "Introduction")!.configuration = phase === "baseline" ? {} : { anchor: "about" };
        const ownership = f.state.sections.find(row => row.id === homeV1Ids.ownership);
        if (ownership) ownership.configuration = {};
        if (change === "old-arrangement") Object.assign(about, { target_reference: "680318d0-a606-4d70-af92-1b5a69735ca6", version: 1 });
      }
      const before = structuredClone(f.state), writes = f.writes.length;
      await assert.rejects(updateMyomatonHomeV1(f.pool), /conflict/);
      assert.deepEqual(f.state, before); assert.equal(f.writes.length, writes);
    }
  }
});

test("Hero uses first-class anchor Action and CTA contains no invented YouTube Action/URL", async () => {
  const f = fixture(); const result = await updateMyomatonHomeV1(f.pool);
  const hero = normalizeSection(f.state.sections.find(row => row.type === "hero")); assert.ok(hero?.type === "hero");
  assert.equal(hero.content.eyebrow, "My Own Robot"); assert.equal(hero.content.heading, "Myomaton");
  assert.equal(hero.content.actionId, homeV1Ids.projectsAction);
  const row = f.state.actions.find(row => row.id === hero.content.actionId)!;
  const action = normalizeAction({ ...row, webPresenceId: row.web_presence_id }, presenceId); assert.ok(action);
  assert.equal(action.destination, "#current-projects"); assert.equal(action.label, "See what we're building");
  const cta = normalizeSection(f.state.sections.find(row => row.type === "cta")); assert.ok(cta?.type === "cta");
  assert.equal(cta.content.heading, "See what happens next."); assert.equal(cta.content.actionId, undefined);
  assert.ok(!JSON.stringify(f.state).match(/youtube\.com|youtu\.be/)); assert.match(result.youtube, /Unconfirmed/);
  assert.deepEqual(f.state.actions[0], { ...baseline.actions[0], metadata: { retained: baseline.actions[0].id }, created_at: "original-created", updated_at: "original-updated" });
});

test("pre-existing matching Subjects and equivalent Action retain canonical UUIDs and metadata", async () => {
  const f = fixture();
  const plan = planHomeV1(f.state);
  for (const insert of plan.inserts.filter(insert => insert.table !== "sections")) {
    f.state[insert.table].push({ ...insert.row, id: randomUUID(), version: 7, metadata: { canonical: true },
      ...(insert.table === "actions" ? { name: "Explore our projects" } : {}) });
  }
  const before = structuredClone({ subjects: f.state.subjects, actions: f.state.actions });
  assert.equal((await updateMyomatonHomeV1(f.pool)).inserted, 6);
  assert.deepEqual(f.state.subjects, before.subjects); assert.deepEqual(f.state.actions, before.actions);
  assert.equal((await updateMyomatonHomeV1(f.pool)).changed, false);
});

test("customized content, config, name, status, version, identity, order, extra or missing Home Sections refuse before writes", async () => {
  const alterations: ((state: State) => void)[] = [
    state => { state.sections[0].content = { heading: "Customer edit" }; },
    state => { state.sections[0].configuration = { anchor: "custom" }; },
    state => { state.sections[0].name = "Renamed"; },
    state => { state.sections[0].status = "inactive"; },
    state => { state.sections[0].version = 42; },
    state => { state.sections[0].id = randomUUID(); },
    state => { state.sections[0].sort_order = 99; },
    state => { state.sections.push({ ...state.sections[0], id: randomUUID(), status: "inactive" }); },
    state => { state.sections.pop(); },
    state => { state.sections.push({ ...state.sections[0], id: homeV1Ids.projects, page_id: randomUUID() }); },
  ];
  for (const alter of alterations) {
    const f = fixture(); alter(f.state); const before = structuredClone(f.state);
    await assert.rejects(updateMyomatonHomeV1(f.pool), /conflict/);
    assert.deepEqual(f.state, before); assert.deepEqual(f.writes, []); assert.ok(f.released);
  }
});

test("conflicting, ambiguous, inactive, foreign-ID Subjects/Actions are never overwritten", async () => {
  for (const table of ["subjects", "actions"] as const) {
    for (const change of ["description", "inactive", "foreign", "duplicate", "configuration", "rename-reserved"]) {
      const f = fixture(); const insert = planHomeV1(f.state).inserts.find(insert => insert.table === table)!;
      const row = structuredClone(insert.row); f.state[table].push(row);
      if (change === "description") row[table === "subjects" ? "description" : "destination"] = "Customized";
      if (change === "inactive") row.status = "inactive";
      if (change === "foreign") row.web_presence_id = randomUUID();
      if (change === "duplicate") f.state[table].push({ ...row, id: randomUUID() });
      if (change === "configuration") row.configuration = { custom: true };
      if (change === "rename-reserved") row.name = "Renamed";
      const before = structuredClone(f.state);
      await assert.rejects(updateMyomatonHomeV1(f.pool), /conflict/);
      assert.deepEqual(f.state, before); assert.deepEqual(f.writes, []);
    }
  }
});

test("photograph/usage removal, reassignment, edits and ambiguous or foreign usages safely refuse", async () => {
  for (const change of ["remove", "asset", "target", "duplicate", "foreign", "bytes-reference", "metadata-config"]) {
    const f = fixture();
    if (change === "remove") f.state.asset_usages.length = 0;
    if (change === "asset") f.state.asset_usages[0].asset_id = randomUUID();
    if (change === "target") f.state.asset_usages[0].entity_id = randomUUID();
    if (change === "duplicate") f.state.asset_usages.push({ ...f.state.asset_usages[0], id: randomUUID() });
    if (change === "foreign") f.state.asset_usages[0].web_presence_id = randomUUID();
    if (change === "bytes-reference") f.state.assets[0].source_reference = "objects/changed";
    if (change === "metadata-config") f.state.asset_usages[0].configuration = { custom: true };
    const before = structuredClone(f.state);
    await assert.rejects(updateMyomatonHomeV1(f.pool), /conflict/);
    assert.deepEqual(f.state, before); assert.deepEqual(f.writes, []);
  }
});

test("complete Home v1 with later customization or removal is refused, never synchronized/repaired", async () => {
  for (const change of ["copy", "section", "subject", "action", "photo"]) {
    const f = fixture(); await updateMyomatonHomeV1(f.pool);
    if (change === "copy") f.state.sections.at(-1)!.content = { heading: "Later editorial change" };
    if (change === "section") f.state.sections.pop();
    if (change === "subject") f.state.subjects.pop();
    if (change === "action") f.state.actions.pop();
    if (change === "photo") f.state.asset_usages.length = 0;
    const before = structuredClone(f.state), writes = f.writes.length;
    await assert.rejects(updateMyomatonHomeV1(f.pool), /conflict/);
    assert.deepEqual(f.state, before); assert.equal(f.writes.length, writes);
  }
});

test("all dependent writes roll back at every forced insertion/update failure", async () => {
  for (let failure = 1; failure <= 13; failure++) {
    const f = fixture(); const before = structuredClone(f.state); f.failOnWrite(failure);
    await assert.rejects(updateMyomatonHomeV1(f.pool), /Forced fixture failure/);
    assert.deepEqual(f.state, before); assert.equal(f.statements.at(-1), "ROLLBACK"); assert.ok(f.released);
  }
});

test("unrelated customer state, additional pages and unrelated current-customer Subjects/Actions remain untouched", async () => {
  const f = fixture(); const unrelatedPresence = randomUUID(); const unrelatedPage = randomUUID();
  for (const table of tables) f.state[table].push({ id: randomUUID(), web_presence_id: unrelatedPresence,
    page_id: unrelatedPage, name: "Unrelated", metadata: { untouched: true } });
  f.state.subjects.push({ id: randomUUID(), web_presence_id: presenceId, name: "Another Subject" });
  f.state.actions.push({ id: randomUUID(), web_presence_id: presenceId, name: "Another Action" });
  f.state.pages.push({ id: unrelatedPage, microsite_id: baseline.microsites[0].id, slug: "/other", name: "Other" });
  const before = structuredClone(f.state);
  await updateMyomatonHomeV1(f.pool);
  for (const table of tables) for (const row of before[table]) {
    if (table === "sections" && row.page_id === pageId) continue;
    if (table === "navigation_items" && row.id === "4d8b5c08-534e-4566-ac8d-8a84351d2b13") continue;
    assert.deepEqual(f.state[table].find(item => item.id === row.id), row);
  }
});

test("ambiguous roots, reparented Page and changed Navigation/reference data refuse", async () => {
  for (const alter of [
    (state: State) => { state.web_presences.push({ ...state.web_presences[0], id: randomUUID(), name: " MYOMATON " }); },
    (state: State) => { state.pages[0].microsite_id = randomUUID(); },
    (state: State) => { state.subject_types[0].status = "inactive"; },
    (state: State) => { state.navigation_items[0].target_reference = randomUUID(); },
  ]) {
    const f = fixture(); alter(f.state); const before = structuredClone(f.state);
    await assert.rejects(updateMyomatonHomeV1(f.pool), /conflict/);
    assert.deepEqual(f.state, before); assert.deepEqual(f.writes, []);
  }
});

test("entry point is explicit and not connected to initialization", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(pkg.scripts["update:myomaton-home-v1"], "tsx --env-file=.env.local scripts/update-myomaton-home-v1.ts");
  for (const file of ["scripts/seed.ts", "scripts/bootstrap-myomaton.ts", "scripts/bootstrap-myomaton-photo.ts"]) {
    assert.ok(!readFileSync(file, "utf8").includes("home-v1"));
  }
  assert.equal(projectsActionDraft.destination, "#current-projects");
});
