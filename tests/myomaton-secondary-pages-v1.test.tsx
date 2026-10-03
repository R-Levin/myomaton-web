import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { baseline, planSecondaryPagesV1, updateSecondaryPagesV1, type State } from "../scripts/customer-updates/myomaton-secondary-pages-v1";
import { ids, pageRows, sectionRows, actionRows, homeId, siteId, presenceId, navigationId,
  tabotAssetId, abotAssetId, unusedAbotAssetId } from "../scripts/customer-updates/myomaton-secondary-pages-v1-content";
import { secondaryFixture } from "./helpers/secondary-pages-fixture";
import { normalizeAction } from "../lib/platform/actions/model";
import { pageDestination } from "../lib/platform/navigations/model";
import { normalizeSection } from "../lib/platform/managed-sites/sections";
import { presentImage } from "../lib/platform/assets/source";
import type { Asset } from "../lib/platform/assets/model";
import { SectionRenderer } from "../components/managed-sites/section-renderer";

test("exact baseline creates three Pages once; rerun performs zero writes and preserves all existing customer records except scaffolding", async () => {
  const fixture = secondaryFixture();
  const before = structuredClone(fixture.state);
  assert.deepEqual(await updateSecondaryPagesV1(fixture.pool), { changed: true, inserted: 32, updated: 0, deleted: 2 });
  assert.deepEqual(fixture.state.pages.map(row => [row.id, row.slug]), [[homeId, "/"], ...pageRows.map(row => [row.id, row.slug])]);
  assert.deepEqual([...fixture.state.pages].sort((a,b) => Number(a.sort_order)-Number(b.sort_order)).map(row => row.name), ["Home", "Projects", "Principles", "About"]);
  for (const [table, rows] of Object.entries(before)) {
    if (table === "navigation_items") continue;
    for (const row of rows) assert.deepEqual(fixture.state[table as keyof State].find(item => item.id === row.id), row);
  }
  const intended = structuredClone(fixture.state), writes = fixture.writes;
  assert.deepEqual(await updateSecondaryPagesV1(fixture.pool), { changed: false, inserted: 0, updated: 0, deleted: 0 });
  assert.equal(fixture.writes, writes); assert.deepEqual(fixture.state, intended);
});

test("approved About, Projects and Principles structures use only supported structured content and first-class Page Actions", async () => {
  const f = secondaryFixture(); await updateSecondaryPagesV1(f.pool);
  const expected = [
    [ids.about, ["About Myomaton", "Why this exists", "Reality is an excellent design review", "One person, amplified", "Open Practical Robotics", "See what we’re building"]],
    [ids.projects, ["Projects", "Current Projects", "TaBot", "A-Bot", "Small robot experiments", "More Than One Robot", "What makes something Myomaton?"]],
    [ids.principles, ["Principles", "Core principles", "Ownership matters", "Complexity has a cost", "Use what works", "Share what proves useful", "See the projects"]],
  ] as const;
  const routes = new Map(pageRows.map(row => [row.id, String(row.slug)]));
  for (const [pageId, headings] of expected) {
    const rows = f.state.sections.filter(row => row.page_id === pageId);
    assert.deepEqual(rows.map(row => (row.content as { heading: string }).heading), headings);
    assert.deepEqual(rows.map(row => row.sort_order), headings.map((_, i) => i * 10));
    for (const row of rows) assert.ok(normalizeSection(row));
    const cta = rows.at(-1)!; const content = cta.content as { actionId: string };
    assert.deepEqual(Object.keys(content).sort(), ["actionId", "heading"]);
    const raw = f.state.actions.find(row => row.id === content.actionId)!;
    const action = normalizeAction({ ...raw, webPresenceId: raw.web_presence_id }, presenceId, routes)!;
    assert.equal(action.type, "page"); assert.equal(action.destination, pageId === ids.projects ? "/principles" : "/projects");
    const html = renderToStaticMarkup(<SectionRenderer section={{ id: cta.id, type: "cta", variant: "default", name: null, content, configuration: {}, action }} />);
    assert.ok(html.includes(`href="${action.destination}"`));
    assert.equal(normalizeAction({ ...raw, webPresenceId: presenceId }, presenceId, new Map()), null);
  }
  const person = f.state.sections.find(row => row.id === ids.person)!;
  assert.equal((person.content as { text: string }).text.split("\n\n").length, 3);
  assert.match((person.content as { text: string }).text, /Human judgment provides continuity of purpose/);
  const collection = normalizeSection(f.state.sections.find(row => row.id === ids.currentProjects))!;
  assert.equal(collection.type, "collection"); if (collection.type !== "collection") throw Error();
  assert.deepEqual(collection.content.items, [
    { id: "project-tabot", subjectId: "5a07b8d7-a388-48c4-9bc5-9b4b575d33cd" },
    { id: "project-abot", subjectId: "845c03b7-cd6d-4cc4-b6a5-de98893cc057" },
  ]);
  const principles = f.state.sections.find(row => row.id === ids.core)!.content as { itemSource: string; items: unknown[] };
  assert.equal(principles.itemSource, "inline"); assert.equal(principles.items.length, 5);
  assert.deepEqual(principles.items, (baseline.sections.find(row => row.name === "Principles")!.content as { items: unknown[] }).items);
  assert.deepEqual(f.state.subjects, baseline.subjects);
});

test("Navigation replaces only scaffolding with ordered Page identities; image usages reuse Assets with informative fallback", async () => {
  const f = secondaryFixture(); await updateSecondaryPagesV1(f.pool);
  assert.deepEqual(f.state.navigation_items.map(row => row.label), ["Home", "Projects", "Principles", "About"]);
  assert.deepEqual(f.state.navigation_items.map(row => {
    assert.equal(row.target_type, "page"); assert.equal(row.parent_id, null);
    const page = f.state.pages.find(page => page.id === row.target_reference)!;
    return pageDestination({ managedSiteId: String(page.managed_site_id), slug: page.slug }, { managedSiteId: siteId });
  }), ["/", "/projects", "/principles", "/about"]);
  assert.ok(baseline.navigation_items.every(old => !f.state.navigation_items.some(row => row.id === old.id)));
  assert.deepEqual(f.state.actions.find(row => row.name === "Learn about Myomaton"), baseline.actions.find(row => row.name === "Learn about Myomaton"));
  assert.deepEqual(f.state.assets, baseline.assets);
  assert.equal(f.state.asset_usages.filter(row => row.asset_id === tabotAssetId).length, 2);
  assert.equal(f.state.asset_usages.filter(row => row.asset_id === abotAssetId).length, 1);
  assert.equal(f.state.asset_usages.filter(row => row.asset_id === unusedAbotAssetId).length, 0);
  assert.deepEqual(f.state.asset_usages[0], baseline.asset_usages[0]);
  for (const usage of f.state.asset_usages.slice(1)) {
    assert.deepEqual(usage.configuration, { image: { decorative: false } });
    const raw = f.state.assets.find(row => row.id === usage.asset_id)!;
    const asset = { ...raw, webPresenceId: raw.web_presence_id, mimeType: raw.mime_type, sourceType: raw.source_type,
      sourceReference: raw.source_reference, altText: raw.alt_text } as unknown as Asset;
    assert.equal(presentImage(asset, usage.configuration)?.alt, raw.alt_text);
  }
});

test("conflicting slugs, identities, partial state and customized reviewed records refuse without writes", async () => {
  const cases: ((state: State) => void)[] = [
    s => { s.pages.push({ ...pageRows[0], id: randomUUID() }); },
    s => { s.pages.push({ ...pageRows[0], slug: "/unexpected" }); },
    s => { s.pages.push({ ...pageRows[0], managed_site_id: randomUUID() }); },
    s => { s.sections.push({ ...sectionRows()[0], page_id: randomUUID() }); },
    s => { s.actions.push(structuredClone(actionRows[0])); },
    s => { s.asset_usages.push({ ...baseline.asset_usages[0], id: randomUUID(), asset_id: unusedAbotAssetId }); },
    s => { s.managed_sites[0].web_presence_id = randomUUID(); },
    s => { s.pages[0].managed_site_id = randomUUID(); },
    s => { s.subjects[0].description = "Customized"; },
    s => { s.sections[0].content = { heading: "Customized" }; },
    s => { s.navigation_items[0].configuration = { custom: true }; },
    s => { s.asset_usages[0].configuration = { image: { decorative: true } }; },
    s => { s.assets[0].alt_text = "Customized"; },
    s => { s.web_presences[0].primary_domain = "other.example"; },
  ];
  for (const change of cases) {
    const state = structuredClone(baseline); change(state); const f = secondaryFixture(state);
    await assert.rejects(updateSecondaryPagesV1(f.pool), /secondary Pages v1 conflict/);
    assert.equal(f.writes, 0); assert.deepEqual(f.state, state);
  }
  const complete = secondaryFixture(); await updateSecondaryPagesV1(complete.pool);
  for (const table of ["pages", "sections", "actions", "asset_usages", "navigation_items"] as const) {
    for (const remove of [true, false]) {
      const state = structuredClone(complete.state); const row = state[table].find(row => !baseline[table].some(old => old.id === row.id))!;
      if (remove) state[table] = state[table].filter(item => item.id !== row.id);
      else row.metadata = { customized: true };
      assert.throws(() => planSecondaryPagesV1(state), /conflict/);
    }
  }
});

test("equivalent pre-existing Page Actions are reused; unrelated customer state is unchanged", async () => {
  const state = structuredClone(baseline);
  const equivalent = { ...actionRows[0], id: randomUUID(), name: "Existing projects link", metadata: { owner: "customer" }, version: 4 };
  state.actions.push(equivalent);
  const otherPresence = randomUUID(), otherSite = randomUUID(), otherPage = randomUUID(), otherNavigation = randomUUID();
  state.web_presences.push({ id: otherPresence, name: "Other", primary_domain: "other.test" });
  state.managed_sites.push({ id: otherSite, web_presence_id: otherPresence });
  state.pages.push({ id: otherPage, managed_site_id: otherSite, slug: "/about" });
  state.sections.push({ id: randomUUID(), page_id: otherPage });
  state.navigations.push({ id: otherNavigation, web_presence_id: otherPresence });
  state.navigation_items.push({ id: randomUUID(), navigation_id: otherNavigation });
  state.assets.push({ id: randomUUID(), web_presence_id: otherPresence });
  state.asset_usages.push({ id: randomUUID(), asset_id: state.assets.at(-1)!.id, entity_id: otherPage, entity_type: "page" });
  const f = secondaryFixture(state); assert.equal((await updateSecondaryPagesV1(f.pool)).inserted, 31);
  assert.equal((f.state.sections.find(row => row.id === ids.aboutCta)!.content as { actionId: string }).actionId, equivalent.id);
  assert.deepEqual(f.state.actions.find(row => row.id === equivalent.id), equivalent);
  for (const table of Object.keys(state) as (keyof State)[]) for (const row of state[table]) {
    if (table === "navigation_items" && row.navigation_id === navigationId) continue;
    assert.deepEqual(f.state[table].find(item => item.id === row.id), row);
  }
  assert.equal((await updateSecondaryPagesV1(f.pool)).changed, false);
  const conflict = structuredClone(baseline); conflict.actions.push({ ...equivalent, status: "inactive" });
  assert.throws(() => planSecondaryPagesV1(conflict), /incompatible/);
});

test("every dependent write rolls back on forced failure; entry point stays explicit", async () => {
  for (let at = 1; at <= 34; at++) {
    const f = secondaryFixture(baseline, at);
    await assert.rejects(updateSecondaryPagesV1(f.pool), /forced failure/);
    assert.deepEqual(f.state, baseline, `write ${at}`);
  }
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.match(pkg.scripts["update:myomaton-secondary-pages-v1"], /scripts\/update-myomaton-secondary-pages-v1.ts$/);
  for (const command of ["db:seed", "bootstrap:myomaton", "db:bootstrap-photo"]) assert.ok(!pkg.scripts[command].includes("secondary"));
});
