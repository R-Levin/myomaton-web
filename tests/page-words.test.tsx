import assert from "node:assert/strict";
import test from "node:test";
import type { PageContent } from "../lib/platform/service/cycle";
import { applyWordEdits, arrangementOf, compareWords, fillLayout, pageWords, type Layout } from "../lib/platform/service/page-words";

const layout = { arrangement: "flow", columns: [], gap: "medium", inset: "none", surface: "none", align: "start", measure: "reading",
  typeScale: "body", span: 12, mobileOrder: 0, border: false, rounded: false };
const node = (kind: string, text: string | null, extra: Record<string, unknown> = {}) =>
  ({ kind, text, level: null, items: [], ordered: false, reference: null, layout, children: [], ...extra });
const component = (...children: unknown[]) => ({ version: 2, name: "made-up", purpose: "A test page", mode: "section", root: node("group", null, { children }) });

/** A made-up page: an opening, a designed section with a list and a button, and an older plain section of two paragraphs. */
function page(): PageContent {
  return { path: "/service", heading: "Service", searchTitle: "Service", searchDescription: "What we do", composition: "managed-v1",
    sections: [
      { heading: "We fix bicycles", body: "Summary", role: "hero", sourceIds: [], visual: { status: "text-only" },
        block: component(node("heading", "We fix bicycles", { level: 1 }), node("paragraph", "Same-day repairs in town."), node("action", "Book a repair", { reference: "action-0" })) },
      { heading: "What we repair", body: "Summary 2", role: "intro", sourceIds: ["knowledge:a"], visual: { status: "text-only" },
        block: component(node("heading", "What we repair", { level: 2 }), node("list", null, { items: ["Flat tires", "Brakes", "Gears"] })) },
      { heading: "Why us", body: "Twenty years in the trade.\n\nWe stand behind every repair.", role: "intro", sourceIds: [], visual: { status: "text-only" } },
    ],
    actions: [{ label: "Book a repair", kind: "contact", destination: null, sectionIndex: 0 }], internalLinks: [] };
}

/** The current arrangement, as Core would return it unchanged, with the plain section turned into a designed one. */
function sameLayout(p: PageContent): Layout {
  const arranged = arrangementOf(p);
  return { sections: arranged.sections.map((section, index) => {
    const s = section as Record<string, unknown> & { block?: { root: unknown } };
    if (index < 2) return { heading: firstHeading(s.block!.root), role: s.role as string, visual: s.visual, block: s.block };
    const [a, b] = String(s.body).split("\n\n");
    const heading = String(s.heading);
    return { heading, role: "intro", visual: s.visual, block: component(node("heading", heading, { level: 2 }), node("paragraph", a!), node("paragraph", b!)) };
  }) };
}
const firstHeading = (root: unknown): string => {
  const n = root as { kind: string; text: string; children: unknown[] };
  return n.kind === "heading" ? n.text : n.children.map(firstHeading).find(Boolean) ?? "";
};

test("a page's words are numbered pieces, in reading order, button labels excluded", () => {
  const words = pageWords(page());
  assert.deepEqual(words.map(w => w.text), ["We fix bicycles", "Same-day repairs in town.", "What we repair", "Flat tires", "Brakes", "Gears",
    "Why us", "Twenty years in the trade.", "We stand behind every repair."]);
  assert.equal(words[0]!.id, "w1");
  assert.equal(words[0]!.kind, "heading");
  const arranged = JSON.stringify(arrangementOf(page()));
  assert.ok(!arranged.includes("Flat tires") && arranged.includes('"w4"'), "the arrangement holds numbers, not words");
});

test("a layout change can move and restyle pieces, and the words come back exactly", () => {
  const before = page(), next = sameLayout(before);
  // Core reorders the list and moves the paragraph into the last section.
  const list = (next.sections[1]!.block as { root: { children: { items: string[] }[] } }).root.children[1]!;
  list.items.reverse();
  const after = fillLayout(before, next);
  assert.equal(compareWords(before, after).unchanged, true);
  assert.equal((after.actions as { label: string; sectionIndex: number }[])[0]!.sectionIndex, 0, "the button's section is found from its placement");
  assert.equal(after.heading, "Service");
  assert.equal(after.searchDescription, "What we do");
  assert.deepEqual((after.sections[1] as unknown as { sourceIds: string[] }).sourceIds, ["knowledge:a"], "a section keeps its sources by its heading");
});

test("a layout change can't change, drop, repeat or invent a word", () => {
  const before = page();
  const tamper = (change: (layout: Layout) => void) => { const next = sameLayout(before); change(next); return () => fillLayout(before, next); };
  const root = (layout: Layout, i: number) => (layout.sections[i]!.block as { root: { children: Record<string, unknown>[] } }).root;
  assert.throws(tamper(l => { root(l, 0).children[1]!.text = "Fast, friendly repairs."; }), /not one of the page's pieces/u, "new words refused");
  assert.throws(tamper(l => { root(l, 0).children.splice(1, 1); }), /leaves out 1/u, "a dropped piece refused");
  assert.throws(tamper(l => { root(l, 2).children.push(node("paragraph", "w2")); }), /more than once/u, "a repeated piece refused");
  assert.throws(tamper(l => { root(l, 0).children[1]!.kind = "heading"; root(l, 0).children[1]!.level = 3; }), /is text, not a heading/u);
  assert.throws(tamper(l => { root(l, 0).children[2]!.reference = "action-4"; }), /doesn't have/u, "a button the page doesn't have refused");
  assert.throws(tamper(l => { l.sections.reverse(); }), /opening/u, "the opening stays first");
});

test("a word change edits only its pieces; the arrangement is otherwise identical", () => {
  const before = page();
  const after = applyWordEdits(before, {
    change: [{ id: "w2", text: "Repairs while you wait." }, { id: "w1", text: "Bicycle repair, done right" }],
    remove: ["w5"],
    add: [{ after: "w6", text: "Wheels", as: "item" }, { after: "w2", text: "Open six days a week.", as: "paragraph" }] });
  const diff = compareWords(before, after);
  assert.deepEqual(diff.gone.sort(), ["Brakes", "Same-day repairs in town.", "We fix bicycles"]);
  assert.deepEqual(diff.added.sort(), ["Bicycle repair, done right", "Open six days a week.", "Repairs while you wait.", "Wheels"]);
  assert.equal(after.sections[0]!.heading, "Bicycle repair, done right", "a designed section's title changes with its heading");
  assert.equal(JSON.stringify(after.sections[2]), JSON.stringify(before.sections[2]), "an untouched section is byte-identical");
  const layoutOnly = (p: PageContent) => JSON.stringify(p.sections[1]).replace(/"(text|items)":("[^"]*"|\[[^\]]*\])/gu, "");
  assert.equal(layoutOnly(after), layoutOnly(before), "an edited section keeps its arrangement");
  assert.throws(() => applyWordEdits(before, { remove: ["w3"] }), /whole-page change/u, "removing a section's heading removes a section");
  assert.throws(() => applyWordEdits(before, { change: [{ id: "w99", text: "x" }] }), /No piece/u);
  assert.throws(() => applyWordEdits(before, { change: [{ id: "w2", text: "<b>bold</b>" }] }), /plain words/u);
});

test("restoring the words of an earlier version", () => {
  const earlier = page();
  const drifted = applyWordEdits(earlier, { change: [{ id: "w8", text: "Two decades of experience." }] });
  const restore = compareWords(drifted, earlier);
  assert.deepEqual(restore.gone, ["Two decades of experience."]);
  assert.deepEqual(restore.added, ["Twenty years in the trade."]);
});
