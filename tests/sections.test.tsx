import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { normalizeSection } from "../lib/platform/managed-sites/sections";
import { SectionRenderer } from "../components/managed-sites/section-renderer";
import type { ManagedSiteSection } from "../lib/platform/managed-sites/service";
import { designTokens } from "../components/managed-sites/design-tokens";

const id = "abcdefab-1111-4111-8111-111111111111";
const base: ManagedSiteSection = { id: "section", name: "Introduction", type: "intro", variant: null,
  content: { heading: "Heading", text: "Body", actionId: id }, configuration: { anchor: "about" } };
const action = { id, type: "section" as const, name: "About", label: "Read more", destination: "#about" };
const image = { assetId: id, src: `/media/assets/${id}`, width: 640, height: 480, alt: "Robot" };
const render = (changes: Partial<ManagedSiteSection> = {}) => renderToStaticMarkup(<SectionRenderer section={{ ...base, ...changes }} />);

test("typed sections allow only supported content, type/variant pairs, and semantic options", () => {
  for (const type of ["hero", "intro", "cta"]) {
    const normalized = normalizeSection({ ...base, type, variant: "split-image-first", content: {
      heading: "Heading", text: "Body", eyebrow: "Eyebrow", actionId: id.toUpperCase(), html: "<b>bad</b>", imageUrl: "https://bad.example", assetId: id,
    }, configuration: { anchor: "about", width: "wide", spacing: "spacious", alignment: "center", surface: "accent", divider: "none", mediaFit: "cover", css: "bad" } });
    assert.ok(normalized);
    assert.deepEqual(normalized.content, { heading: "Heading", text: "Body", ...(type === "hero" ? { eyebrow: "Eyebrow" } : {}), actionId: id });
    assert.equal(normalized.variant, type === "intro" ? "split-image-first" : "default");
    assert.deepEqual(normalized.configuration, { anchor: "about", width: "wide", spacing: "spacious", alignment: "center", surface: "accent", divider: "none", mediaFit: type === "intro" ? "cover" : "natural" });
  }
  for (const variant of ["stack", "split-text-first", "split-image-first"]) assert.equal(normalizeSection({ ...base, variant })?.variant, variant);
  for (const variant of [null, "default", "unknown", {}, 1]) assert.equal(normalizeSection({ ...base, variant })?.variant, "stack");
  assert.equal(normalizeSection({ ...base, type: "collection" }), null);
});

test("malformed inputs fall back field by field without mutating canonical objects", () => {
  for (const input of [null, [], false, 1, "raw", { heading: {}, text: [], actionId: "bad" }]) {
    assert.deepEqual(normalizeSection({ ...base, content: input })?.content, {});
    assert.doesNotThrow(() => render({ content: input }));
  }
  for (const configuration of [null, [], "raw", { width: "99%", spacing: -10, alignment: "justify", surface: "#ff0000", divider: "dashed", mediaFit: "stretch", anchor: "bad anchor" }]) {
    assert.deepEqual(normalizeSection({ ...base, configuration })?.configuration, {
      width: "standard", spacing: "normal", alignment: "left", surface: "default", divider: "rule", mediaFit: "natural",
    });
  }
  const before = structuredClone(base);
  normalizeSection(base);
  assert.deepEqual(base, before);
  assert.equal(normalizeSection(null), null);
});

test("all section types render one resolved Action and escaped text; unsafe or unrelated Actions disappear", () => {
  for (const type of ["hero", "intro", "cta"]) {
    const html = render({ type, action, content: { heading: "<script>", text: "<b>Body</b>", eyebrow: "<em>Eye</em>", actionId: id } });
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /&lt;b&gt;Body&lt;\/b&gt;/);
    assert.equal(html.includes("&lt;em&gt;Eye"), type === "hero");
    assert.equal((html.match(/href="#about"/g) ?? []).length, 1);
    for (const invalid of [null, { ...action, destination: "javascript:alert(1)" }, { ...action, label: " " }, { ...action, id: "invalid" }]) {
      const fallback = render({ type, action: invalid });
      assert.match(fallback, /Heading/); assert.match(fallback, /Body/); assert.ok(!fallback.includes("href="));
    }
    assert.ok(!render({ type, action, content: { heading: "Heading", actionId: "bad" } }).includes("href="));
  }
});

test("Intro layouts use one image and heading/media/body/Action split source order with clean text-only fallback", () => {
  for (const variant of ["stack", "split-text-first", "split-image-first"]) {
    const html = render({ variant, image, action });
    assert.ok(html.includes(`data-layout="${variant}"`));
    assert.ok(html.includes(image.src));
    assert.ok(html.indexOf("Heading") < html.indexOf("<img"));
    assert.equal((html.match(/<h2/g) ?? []).length, 1);
    assert.equal((html.match(/<img/g) ?? []).length, 1);
    if (variant !== "stack") {
      assert.ok(html.indexOf("<img") < html.indexOf("Body"));
      assert.ok(html.indexOf("Body") < html.indexOf("Read more"));
      const withoutAction = render({ variant, image, action: null });
      assert.ok(withoutAction.includes("Heading") && withoutAction.includes("Body") && withoutAction.includes("<img"));
      assert.ok(!withoutAction.includes("href="));
    }
    assert.match(html, /width="640" height="480"/);
    const absent = render({ variant, image: null, content: { heading: "Heading", imageUrl: "https://bad.example", assetId: id } });
    assert.match(absent, /data-layout="stack"/);
    assert.ok(!absent.includes("managed-site-section-media"));
    assert.ok(!absent.includes("<img"));
    assert.ok(!absent.includes("bad.example"));
  }
});

test("finite presentation values reach markup without emitting raw style controls", () => {
  const options = { width: ["reading", "standard", "wide"], spacing: ["compact", "normal", "spacious"], alignment: ["left", "center"], surface: ["default", "subtle", "accent"], divider: ["none", "rule", "spacing"], mediaFit: ["natural", "contain", "cover"] };
  for (const [key, values] of Object.entries(options)) for (const value of values) {
    const html = render({ configuration: { [key]: value } });
    assert.ok(html.includes(`data-${key === "mediaFit" ? "media-fit" : key}="${value}"`));
  }
  const html = render({ configuration: { width: "99%", surface: "red", style: "position:absolute", css: "display:none", anchor: 'x" onclick="bad' } });
  for (const unsafe of ["99%", "position:absolute", "display:none", "onclick", "style="]) assert.ok(!html.includes(unsafe));
});

test("platform CSS owns responsive geometry and maps presentation to existing Design System tokens", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /@media \(min-width: 48rem\)/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  assert.match(css, /split-image-first"\] \.managed-site-section-media \{ grid-column: 1; grid-row: 1 \/ 5;/);
  assert.match(css, /data-layout\^="split-"\] \.managed-site-section-heading \{ grid-column: 1; grid-row: 2;/);
  assert.match(css, /data-layout\^="split-"\] \.managed-site-section-copy \{ grid-column: 1; grid-row: 3;/);
  assert.match(css, /data-layout\^="split-"\] \.managed-site-section-media \{ grid-column: 2;/);
  assert.match(css, /split-image-first"\] :is\(\.managed-site-section-heading, \.managed-site-section-copy\) \{ grid-column: 2;/);
  assert.match(css, /height: auto/);
  assert.match(css, /object-fit: contain/);
  assert.match(css, /object-fit: cover/);
  for (const token of ["space", "section-space", "radius", "surface", "accent", "on-accent", "border"]) assert.ok(css.includes(`var(--design-${token})`));
  assert.match(css, /--section-copy: var\(--design-on-accent\)/);
  assert.match(css, /--section-action-background: var\(--design-on-accent\)/);
  assert.match(css, /--section-action-text: var\(--design-accent\)/);
  assert.deepEqual(designTokens({ colors: { accent: "unsafe" }, spacing: { section: "giant" } }), designTokens(null));
});
