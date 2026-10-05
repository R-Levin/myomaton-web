import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const presentation = JSON.parse(readFileSync("scripts/previews/myomaton-composition.json", "utf8"));
const baseline = JSON.parse(readFileSync("scripts/customer-updates/myomaton-visual-direction-v1-baseline.json", "utf8"));
const order = (slug: string): { id: string; type: string; content: { heading: string } }[] => presentation.pageOrder[baseline.pages.find((p: { slug: string }) => p.slug === slug).id].map((id: string) => baseline.sections.find((s: { id: string }) => s.id === id));

test("preview preserves every Section and existing Action, while evidence leads discovery", () => {
  for (const page of baseline.pages) {
    const ids = baseline.sections.filter((s: { page_id: string }) => s.page_id === page.id).map((s: { id: string }) => s.id).sort();
    assert.deepEqual([...presentation.pageOrder[page.id]].sort(), ids);
    assert.equal(new Set(presentation.pageOrder[page.id]).size, ids.length);
    assert.equal(order(page.slug)[0].type, "hero");
  }
  assert.equal(order("/")[1].content.heading, "Build. Test. Learn. Repeat.");
  assert.deepEqual(order("/projects").slice(1, 3).map(s => s.content.heading), ["TaBot", "A-Bot"]);
  const projectsId = baseline.pages.find((p: { slug: string }) => p.slug === "/projects").id;
  for (const actionId of Object.values(presentation.actions)) assert.equal(baseline.actions.find((a: { id: string }) => a.id === actionId).destination, projectsId);
  assert.equal(Object.keys(presentation.actions).length, 2);
});

test("page progressions use existing vocabulary and equal peers without feature-box emphasis", () => {
  assert.equal(presentation.sections[order("/about")[1].id].composition, undefined);
  assert.equal(order("/principles")[1].content.heading, "Ownership matters");
  assert.equal(presentation.sections[order("/principles")[2].id].surface, "default");
  assert.equal(presentation.sections[order("/principles")[2].id].columns, 2);
});

test("six-review corrections use existing content and Assets only in disposable state", () => {
  const homeHero = order("/")[0];
  assert.deepEqual(presentation.promoteLead, [homeHero.id]);
  const content = baseline.sections.find((s: { id: string }) => s.id === homeHero.id).content;
  assert.equal(content.text.split(/\n\s*\n/)[0], "What should a useful personal robot actually be?");
  assert.equal(presentation.sections[homeHero.id].spacing, "compact");
  const usageId = Object.keys(presentation.imageSelections)[0];
  assert.equal(baseline.asset_usages.find((u: { id: string }) => u.id === usageId).entity_id, order("/")[1].id);
  const robotAsset = presentation.imageSelections[usageId];
  assert.equal(robotAsset, baseline.asset_usages.find((u: { entity_id: string }) => u.entity_id === order("/projects")[2].id).asset_id);
  assert.ok(baseline.assets.some((a: { id: string }) => a.id === robotAsset));
  const omitted = baseline.sections.find((s: { id: string }) => s.id === presentation.inactiveSections[0]);
  assert.equal(omitted.content.heading, "Current Projects");
  assert.ok(presentation.pageOrder[omitted.page_id].includes(omitted.id));
  assert.ok(!presentation.inactiveSections.includes(order("/")[3].id));
  for (const [id, label] of Object.entries(presentation.actionLabels)) {
    assert.ok(baseline.actions.some((a: { id: string }) => a.id === id));
    assert.ok(["Explore projects", "Read the principles"].includes(String(label)));
  }
});
