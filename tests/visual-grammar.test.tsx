import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToStaticMarkup } from "react-dom/server";
import { ManagedSitePageView } from "../components/managed-sites/managed-site-page";
import { resolveVisualDirection, sectionPresentation } from "../lib/platform/visual-direction/model";
import { normalizeSection } from "../lib/platform/managed-sites/sections";
import { grammarFixture, renderGrammarFixtures } from "./fixtures/visual-grammar-pages";
import { restrainedMioPagesPreview as mioPagesPreview } from "../scripts/customer-previews/miopages";
import { visualTokens } from "../components/managed-sites/visual-tokens";

const grammar = { id: "restrained-editorial", version: 1 };
const direction = resolveVisualDirection({ visualDirection: { grammar } }).direction!;
test("finite grammar is deterministic and opt-in; unknown or malformed selection fails closed", () => {
  assert.deepEqual(direction.grammar, grammar);
  assert.deepEqual(direction, resolveVisualDirection({ visualDirection: { grammar } }).direction);
  const page = grammarFixture("professional");
  const render = (visual = page.visual) => renderToStaticMarkup(<ManagedSitePageView page={{ ...page, visual }} />);
  const legacy = render({ direction: null, reason: "missing" });
  for (const value of [null, {}, { id: "unknown", version: 1 }, { ...grammar, version: 2 }, { ...grammar, version: "1" }, { ...grammar, css: "custom" }]) {
    const visual = resolveVisualDirection({ visualDirection: { grammar: value } });
    assert.equal(visual.direction, null); assert.equal(render(visual), legacy);
  }
  for (const preferences of [null, { hero: "statement" }, { motion: "fast" }, { padding: 50 }]) assert.equal(resolveVisualDirection({ visualDirection: { grammar, preferences } }).direction, null);
  assert.equal(resolveVisualDirection({ visualDirection: { grammar, profileId: "reference", profileVersion: 2 } }).reason, "invalid");
  for (const profileVersion of [1, 2]) assert.equal(resolveVisualDirection({ visualDirection: { profileId: "reference", profileVersion } }).direction?.grammar, undefined);
});
test("omitted presentation inherits grammar while explicit and invalid-present choices remain stable", () => {
  const base = grammarFixture("professional").sections[1];
  const normalized = (configuration: object) => normalizeSection({ ...base, configuration })!.configuration;
  const airy = resolveVisualDirection({ visualDirection: { grammar, preferences: { density: "airy" } } }).direction!;
  const automatic = sectionPresentation(normalized({}), {}, "intro", 0, airy);
  assert.equal(automatic.width, "reading"); assert.equal(automatic.spacing, "spacious");
  const explicit = { width: "wide", alignment: "center", spacing: "compact", surface: "accent", divider: "rule" };
  assert.deepEqual(sectionPresentation(normalized(explicit), explicit, "intro", 0, airy), normalized(explicit));
  const invalid = { width: "bad", spacing: null };
  const result = sectionPresentation(normalized(invalid), invalid, "intro", 0, airy);
  assert.equal(result.width, normalized(invalid).width); assert.equal(result.spacing, normalized(invalid).spacing);
  const page = grammarFixture("professional");
  const html = renderToStaticMarkup(<ManagedSitePageView page={{ ...page, sections: [{ ...base, configuration: normalized({}), rawConfiguration: null }] }} />);
  assert.equal(new JSDOM(html).window.document.querySelector('section')?.getAttribute('data-width'), 'reading');
});
test("representative business fixtures use real components, distinct measures and no v2 rules", () => {
  for (const html of Object.values(renderGrammarFixtures())) {
    const doc = new JSDOM(html).window.document;
    assert.ok(doc.querySelector('[data-visual-grammar="restrained-editorial"][data-grammar-version="1"]'));
    assert.equal(doc.querySelectorAll('[data-visual-version="2"], [data-motion-slot], form').length, 0);
    assert.equal(doc.querySelectorAll("h1").length, 1); assert.equal(doc.querySelectorAll("main > section").length, 4);
    assert.ok(doc.querySelector('[data-action-role="primary"]'));
    assert.match(html, /--grammar-prose-measure:64ch/); assert.match(html, /--grammar-support-measure:54ch/);
  }
  assert.deepEqual(mioPagesPreview.pages["/"][0].configuration, {});
  for (const baseSize of [14, 22]) for (const headingScale of [1.5, 3.5]) {
    const tokens = visualTokens({ typography: { baseSize, headingScale } }, direction) as Record<string, string>;
    assert.ok(parseFloat(tokens['--grammar-heading-size']) < 32, 'Section heading stays below minimum responsive Hero size');
  }
});
