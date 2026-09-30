import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { normalizeSection, type CollectionContent } from "../lib/platform/microsites/sections";
import { presentCollection } from "../lib/platform/microsites/collections";
import { SectionRenderer } from "../components/microsites/section-renderer";
import type { MicrositeSection } from "../lib/platform/microsites/service";

const uuid = (n: number) => `abcdefab-1111-4111-8111-${String(n).padStart(12, "0")}`;
const base: MicrositeSection = { id: uuid(1), type: "collection", name: "Collection", variant: "grid", configuration: {}, content: {} };
const normalize = (content: unknown, changes: Partial<MicrositeSection> = {}) => normalizeSection({ ...base, content, ...changes });
const inline = { heading: "Features", text: "Overview", itemSource: "inline", items: [
  { id: "second", heading: "Second", text: "Detail", actionId: uuid(2) },
  { id: "first", heading: "First" },
] };

test("collection modes whitelist content, preserve stable IDs and order, and never duplicate Subject copy", () => {
  const section = normalize({ ...inline, actionId: uuid(9), items: [
    { ...inline.items[0], html: "<b>bad</b>", assetId: uuid(8), imageUrl: "/bad", columns: 10 }, inline.items[1],
  ] });
  assert.ok(section?.type === "collection");
  assert.deepEqual(section.content, inline);
  const references = normalize({ heading: "Services", itemSource: "subjects", items: [
    { id: "service-1", subjectId: uuid(3).toUpperCase(), actionId: uuid(2).toUpperCase(), heading: "Stale name", text: "Stale description" },
  ] });
  assert.ok(references?.type === "collection");
  assert.deepEqual(references.content, { heading: "Services", itemSource: "subjects", items: [
    { id: "service-1", subjectId: uuid(3), actionId: uuid(2) },
  ] });
  for (const variant of [null, "default", "grid", "split-image-first", "masonry"]) {
    assert.equal(normalize(inline, { variant })?.variant, "grid");
  }
});

test("invalid discriminants, items, IDs, references and presentation fail safely", () => {
  for (const content of [null, [], {}, { itemSource: "query" }, { itemSource: {} }]) assert.equal(normalize(content), null);
  for (const items of [null, {}, 42, "items"]) {
    const normalized = normalize({ ...inline, items });
    assert.ok(normalized?.type === "collection"); assert.deepEqual(normalized.content.items, []);
  }
  const invalid = [null, [], {}, { heading: "No ID" }, { id: "", heading: "Empty" }, { id: "bad id", heading: "Bad" },
    { id: 1, heading: "Numeric" }, { id: "x".repeat(101), heading: "Long" }, { id: "blank", heading: " " }, { id: "wrong", heading: {} }];
  const content = { ...inline, items: [...invalid, ...inline.items, { id: "second", heading: "Duplicate" }, { id: "third", heading: "Third", text: {}, actionId: "bad" }] };
  const before = structuredClone(content);
  const section = normalize(content);
  assert.ok(section?.type === "collection");
  assert.deepEqual(section.content.items, [...inline.items, { id: "third", heading: "Third" }]);
  assert.deepEqual(content, before);
  const subjects = normalize({ itemSource: "subjects", items: [{ id: "bad", subjectId: "bad" }, { id: "missing" }, { id: "good", subjectId: uuid(3), actionId: "bad" }] });
  assert.ok(subjects?.type === "collection");
  assert.deepEqual(subjects.content.items, [{ id: "good", subjectId: uuid(3) }]);
  for (const columns of [undefined, null, "3", 1, 4, 2.5, {}, "repeat(10, 1fr)"]) {
    const normalized = normalize(inline, { configuration: { columns, width: "99%", surface: "red", alignment: "justify" } });
    assert.ok(normalized?.type === "collection");
    assert.equal(normalized.configuration.columns, 2);
    assert.equal(normalized.configuration.width, "standard");
    assert.equal(normalized.configuration.surface, "default");
    assert.equal(normalized.configuration.alignment, "left");
  }
});

test("inline cards render ordered escaped copy, omit malformed items, and share safe Action presentation", () => {
  const raw = { ...inline, items: [inline.items[0], { id: "bad" }, { id: "escaped", heading: "<script>", text: "<b>Text</b>" }] };
  const section = normalize(raw); assert.ok(section?.type === "collection");
  const action = { id: uuid(2), name: "Details", type: "link" as const, label: "<More>", destination: "/details" };
  const items = presentCollection(section.content, new Map(), new Map([[action.id, action]]));
  const html = renderToStaticMarkup(<SectionRenderer section={{ ...base, ...section, collectionItems: items }} />);
  assert.ok(html.indexOf("Second") < html.indexOf("&lt;script&gt;"));
  assert.match(html, /&lt;b&gt;Text&lt;\/b&gt;/);
  assert.match(html, /href="\/details"/); assert.match(html, /&lt;More&gt;/);
  assert.equal((html.match(/<li /g) ?? []).length, 2);
  const unsafe = presentCollection(section.content, new Map(), new Map([[action.id, { ...action, destination: "javascript:alert(1)" }]]));
  const fallback = renderToStaticMarkup(<SectionRenderer section={{ ...base, ...section, collectionItems: unsafe }} />);
  assert.match(fallback, /Second/); assert.ok(!fallback.includes("href="));
  assert.match(renderToStaticMarkup(<SectionRenderer section={{ ...base, content: inline }} />), /Second/);
});

test("Subject card projection follows curated order, preserves canonical references and omits unavailable Subjects", () => {
  const content: CollectionContent = { itemSource: "subjects", items: [
    { id: "b", subjectId: uuid(4), actionId: uuid(2) }, { id: "missing", subjectId: uuid(9) }, { id: "a", subjectId: uuid(3) },
  ] };
  const before = structuredClone(content);
  const subjects = new Map([[uuid(3), { id: uuid(3), name: "Service A", description: null }], [uuid(4), { id: uuid(4), name: "Service B", description: "Canonical description" }]]);
  const items = presentCollection(content, subjects);
  assert.deepEqual(items, [{ id: "b", heading: "Service B", text: "Canonical description" }, { id: "a", heading: "Service A" }]);
  assert.deepEqual(content, before);
  const html = renderToStaticMarkup(<SectionRenderer section={{ ...base, content, collectionItems: items }} />);
  assert.ok(html.indexOf("Service B") < html.indexOf("Service A")); assert.match(html, /Canonical description/);
  assert.ok(!html.includes("href="));
  const empty = renderToStaticMarkup(<SectionRenderer section={{ ...base, content }} />);
  assert.ok(!empty.includes("<ul"));
});

test("collection grid exposes only finite semantics and adapts 3 to 2 to 1 by available width", () => {
  for (const columns of [2, 3]) {
    const html = renderToStaticMarkup(<SectionRenderer section={{ ...base, content: inline,
      configuration: { columns, width: "wide", spacing: "compact", alignment: "center", surface: "accent", divider: "spacing", style: "position:absolute", color: "red" } }} />);
    for (const attribute of [`data-columns="${columns}"`, 'data-layout="grid"', 'data-width="wide"', 'data-spacing="compact"', 'data-alignment="center"', 'data-surface="accent"', 'data-divider="spacing"']) assert.ok(html.includes(attribute));
    assert.ok(!html.includes("style=")); assert.ok(!html.includes("position:absolute"));
  }
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /container-type: inline-size/);
  assert.match(css, /@container \(min-width: 36rem\)/);
  assert.match(css, /@container \(min-width: 60rem\)/);
  assert.match(css, /data-columns="3"[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /repeat\(2, minmax\(0, 1fr\)\)/);
  const card = css.slice(css.indexOf(".microsite-collection-item {"));
  for (const token of ["space", "border", "radius", "surface", "text", "muted", "accent", "on-accent", "heading-font"]) assert.ok(card.includes(`var(--design-${token})`));
});
