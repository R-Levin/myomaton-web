import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { SectionRenderer } from "../components/managed-sites/section-renderer";
import { normalizeSection } from "../lib/platform/managed-sites/sections";
import { resolveVisualDirection, sectionComposition } from "../lib/platform/visual-direction/model";
import { readableColor, visualTokens } from "../components/managed-sites/visual-tokens";

const direction = resolveVisualDirection({ visualDirection: { profileId: "reference", profileVersion: 2 } }).direction!;
const section = { id: "idea", name: "Idea", type: "intro", variant: "stack", content: { heading: "Reality is an excellent design review", text: "One real observation.\n\nAnother useful observation.\n\nAn honest explanation." }, configuration: { treatment: "statement", composition: "statement-break", width: "wide", surface: "editorial" } };
const doc = (input = section) => new JSDOM(renderToStaticMarkup(<SectionRenderer section={input} direction={direction} />)).window.document;

test("statement break requires semantic opt-in and keeps full support at reading scale", () => {
  const rendered = doc();
  assert.equal(rendered.querySelector("section")?.getAttribute("data-section-role"), "statement");
  assert.equal(rendered.querySelector("section")?.getAttribute("data-composition"), "statement-break");
  assert.equal(rendered.querySelector(".managed-site-section-heading h2")?.textContent, section.content.heading);
  assert.deepEqual([...rendered.querySelectorAll(".managed-site-section-copy p")].map(p => p.textContent), section.content.text.split("\n\n"));
  assert.equal(rendered.querySelector("h1"), null);
  const ordinary = doc({ ...section, configuration: { ...section.configuration, treatment: "ordinary" } });
  assert.equal(ordinary.querySelector("section")?.getAttribute("data-section-role"), "intro");
  assert.equal(ordinary.querySelector("section")?.getAttribute("data-composition"), null);
  const long = doc({ ...section, content: { ...section.content, text: "Readable full copy. ".repeat(60) } });
  assert.equal(long.querySelector("section")?.getAttribute("data-section-role"), "intro");
  assert.equal(long.querySelector("p")?.textContent, "Readable full copy. ".repeat(60).trim());
});

test("finite compositions are type-specific, preserve explicit choices, and stay v2-only", () => {
  for (const [type, composition, role] of [["hero", "asymmetric-field", "hero"], ["intro", "editorial-row", "intro"], ["intro", "image-evidence", "image"], ["collection", "grouped-field", "collection"], ["cta", "conversion-band", "cta"]] as const) {
    const content = type === "collection" ? { itemSource: "inline", items: [] } : section.content;
    const normalized = normalizeSection({ ...section, type, content, configuration: { width: "wide", composition } })!;
    assert.equal(sectionComposition(normalized.configuration, role, direction), composition);
    assert.equal(sectionComposition({ ...normalized.configuration, alignment: "center" }, role, direction), undefined);
    assert.equal(sectionComposition(normalized.configuration, role, { ...direction, profileVersion: 1 }), undefined);
  }
  for (const composition of ["asymmetric-field", "free-grid", "<script>"]) assert.equal(normalizeSection({ ...section, configuration: { composition } })?.configuration.composition, undefined);
  const narrow = normalizeSection({ ...section, type: "hero", configuration: { composition: "asymmetric-field", width: "reading" } })!;
  assert.equal(sectionComposition(narrow.configuration, "hero", direction), undefined);
});

test("contrast and editorial surfaces derive accessible pairs from generic Design System roles", () => {
  const tokens = visualTokens({ colors: { text: "#132b30", background: "#f7f6f0", secondaryAccent: "#315dc4" } }, direction) as Record<string, string>;
  assert.equal(tokens["--visual-contrast-background"], "#132b30");
  assert.equal(tokens["--visual-secondary-accent"], "#315dc4");
  assert.equal(readableColor(tokens["--visual-contrast-button-text"], tokens["--visual-contrast-text"]), tokens["--visual-contrast-button-text"]);
  for (const role of ["text", "muted", "link"]) assert.equal(readableColor(tokens[`--visual-contrast-${role}`], tokens["--visual-contrast-background"]), tokens[`--visual-contrast-${role}`]);
  assert.equal(readableColor(tokens["--visual-secondary-text"], tokens["--visual-secondary-accent"]), tokens["--visual-secondary-text"]);
});
