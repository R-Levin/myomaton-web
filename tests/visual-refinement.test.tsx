import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { SectionRenderer } from "../components/managed-sites/section-renderer";
import { normalizeSection } from "../lib/platform/managed-sites/sections";
import { allocateMotion, resolveVisualDirection, sectionPresentation, sectionRole } from "../lib/platform/visual-direction/model";
import { heroMotion, heroSequence, serializeMotionEvents } from "../lib/platform/visual-direction/motion";
import { resolveVisualPolicy } from "../lib/platform/policy/site-policy";
import { readableColor, visualTokens } from "../components/managed-sites/visual-tokens";

const direction = resolveVisualDirection({ visualDirection: { profileId: "reference", profileVersion: 2 } }).direction!;
const intro = { id: "idea", name: "Idea", type: "intro", variant: "stack", content: { heading: "Useful work deserves clarity", text: "An honest idea, explained plainly." }, configuration: {} };
const actionId = "11111111-1111-4111-8111-111111111111";
const action = { id: actionId, name: "Next", type: "page" as const, label: "Explore", destination: "/projects" };
const hero = { ...intro, type: "hero", content: { ...intro.content, actionId }, action };
const document = (section: typeof intro | typeof hero, index = 0) => new JSDOM(renderToStaticMarkup(<SectionRenderer section={section} direction={direction} index={index} motionSlot={section.type === "hero" ? 0 : undefined} />)).window.document;

test("statement is explicit, h2, position-independent, and preserves full escaped copy", () => {
  assert.equal(document(intro).querySelector("section")?.getAttribute("data-section-role"), "intro");
  const statement = { ...intro, configuration: { treatment: "statement" } };
  for (const index of [0, 1, 10]) {
    const doc = document(statement, index);
    assert.equal(doc.querySelector("section")?.getAttribute("data-section-role"), "statement");
    assert.equal(doc.querySelector("h2")?.textContent, intro.content.heading);
    assert.equal(doc.querySelectorAll("h1").length, 0);
    assert.equal(doc.querySelector("p")?.textContent, intro.content.text);
    assert.equal(doc.querySelector("section")?.getAttribute("data-accent-surface"), "secondary-wash");
  }
  for (const treatment of [undefined, "banner", {}, false]) {
    assert.equal(document({ ...intro, configuration: { treatment } }).querySelector("section")?.getAttribute("data-section-role"), "intro");
  }
  assert.equal(normalizeSection({ ...hero, configuration: { treatment: "statement" } })?.configuration.treatment, undefined);
});

test("long copy, absent heading and associated images safely retain ordinary Editorial", () => {
  for (const content of [{ heading: "Long", text: "Full readable copy. ".repeat(40) }, { heading: "", text: "Body" },
    { heading: "Short", text: "One\n\nTwo\n\nThree" }, { heading: "A".repeat(121), text: "Body" }]) {
    const section = { ...intro, content, configuration: { treatment: "statement" } };
    const doc = document(section);
    assert.equal(doc.querySelector("section")?.getAttribute("data-section-role"), "intro");
    assert.equal(doc.querySelector("section")?.getAttribute("data-accent-surface"), null);
    assert.deepEqual([...doc.querySelectorAll("p")].map(p => p.textContent), content.text.split(/\n\s*\n/).map(p => p.trim()));
  }
  const normalized = normalizeSection({ ...intro, configuration: { treatment: "statement" } })!;
  assert.equal(sectionRole(normalized, true, direction), "image");
  assert.equal(sectionRole(normalized, false, { ...direction, profileVersion: 1 }), "intro");
});

test("role-led rhythm ignores position, respects explicit choices and decorative policy", () => {
  const defaults = normalizeSection(intro)!.configuration;
  for (const index of [0, 1, 2, 9]) {
    assert.equal(sectionPresentation(defaults, {}, "intro", index, direction).surface, "default");
    assert.equal(sectionPresentation(defaults, {}, "intro", index, direction).spacing, "normal");
    assert.equal(sectionPresentation(defaults, {}, "collection", index, direction).surface, "subtle");
    assert.equal(sectionPresentation(defaults, {}, "cta", index, direction).surface, "accent");
  }
  const raw = { treatment: "statement", surface: "accent", width: "wide", spacing: "compact", alignment: "center", divider: "rule" };
  const section = { ...intro, configuration: raw };
  const normalized = normalizeSection(section)!;
  assert.deepEqual(sectionPresentation(normalized.configuration, raw, "intro", 0, direction, "statement"), normalized.configuration);
  assert.equal(document(section).querySelector("section")?.getAttribute("data-accent-surface"), null);
  const disabled = resolveVisualDirection({ visualDirection: { profileId: "reference", profileVersion: 2 } }, resolveVisualPolicy({ visualDecoration: { value: false } })).direction!;
  const html = renderToStaticMarkup(<SectionRenderer section={{ ...intro, configuration: { treatment: "statement" } }} direction={disabled} />);
  assert.doesNotMatch(html, /secondary-wash/);
});

test("Hero semantic parts and missing-part timing preserve Actions and reserve one event", () => {
  const doc = document(hero);
  assert.deepEqual([...doc.querySelectorAll("[data-hero-part]")].map(n => n.getAttribute("data-hero-part")), ["heading", "support", "action"]);
  assert.equal(doc.querySelector('[data-hero-part="action"]')?.getAttribute("href"), "/projects");
  assert.equal(doc.querySelectorAll("[data-motion-slot]").length, 1);
  assert.equal(doc.querySelector("section")?.style.getPropertyValue("--hero-support-delay"), "100ms");
  assert.equal(doc.querySelector("section")?.style.getPropertyValue("--hero-action-delay"), "260ms");
  const noSupport = document({ ...hero, content: { ...hero.content, text: "" } });
  assert.equal(noSupport.querySelector('[data-hero-part="support"]'), null);
  assert.equal(noSupport.querySelector("section")?.style.getPropertyValue("--hero-action-delay"), "160ms");
  const noAction = document({ ...hero, content: intro.content });
  assert.equal(noAction.querySelector('[data-hero-part="action"]'), null);
  assert.deepEqual(heroSequence(false, false, true), { supportStart: 0, actionStart: 0, duration: 450 });
  assert.equal(heroSequence(true, true, true).duration, 1150);
  assert.deepEqual(allocateMotion([hero, { ...intro, type: "cta", id: "end" }], "minimal"), new Map([[hero.id, 0]]));
  assert.equal(allocateMotion([hero, { ...intro, type: "cta", id: "end" }], "light").size, 2);
  assert.equal(allocateMotion([hero], "off").size, 0);
});

test("Progressively enhanced Hero keeps content without JS; finite recipe and reduced/focus overrides", () => {
  const html = renderToStaticMarkup(<SectionRenderer section={hero} direction={direction} motionSlot={0} />);
  assert.ok(html.includes(intro.content.heading)); assert.ok(html.includes(intro.content.text));
  assert.doesNotMatch(html, /opacity:|hidden|visibility/);
  assert.deepEqual(heroMotion.heading, { duration: 1150, travel: 96, mobileTravel: 56 });
  assert.deepEqual(heroMotion.support, { duration: 650, travel: 24 });
  assert.deepEqual(heroMotion.action, { duration: 450, travel: 18 });
  const client = readFileSync("components/managed-sites/page-motion.tsx", "utf8");
  assert.doesNotMatch(client, /requestAnimationFrame|part.animate|setTimeout\(start/);
  assert.match(client, /preference.matches/);
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /animation: visual-hero-enter/);
  assert.match(css, /prefers-reduced-motion: reduce[^}]*[\s\S]*animation: none; opacity: 1; transform: none/);
});

test("primary Actions differ semantically from supporting Actions, never destinations", () => {
  for (const type of ["hero", "cta", "intro"]) {
    const doc = document({ ...hero, type });
    assert.equal(doc.querySelector("a")?.getAttribute("href"), action.destination);
    assert.equal(doc.querySelector("a")?.getAttribute("data-action-role"), type === "intro" ? "supporting" : "primary");
  }
});

test("secondary wash has readable semantic pairings and safe primary fallback", () => {
  const fallback = visualTokens({ colors: { accent: "#214e43" } }, direction) as Record<string, string>;
  assert.equal(fallback["--visual-secondary-accent"], "#214e43");
  const tokens = visualTokens({ colors: { secondaryAccent: "#336699", text: "#ffffff", muted: "#ffffff" } }, direction) as Record<string, string>;
  assert.notEqual(tokens["--visual-editorial-background"], fallback["--visual-editorial-background"]);
  for (const role of ["text", "muted", "link"]) assert.equal(readableColor(tokens[`--visual-editorial-${role}`], tokens["--visual-editorial-background"]), tokens[`--visual-editorial-${role}`]);
  const css = readFileSync("app/globals.css", "utf8");
  assert.doesNotMatch(css, /collection-item:(first-child|nth-child)/);
  assert.match(css, /data-image-treatment="framed"\] \.managed-site-section-media \{ padding: 0; background: none/);
});

test("Light waits for Hero reservation, serializes downstream events, and stops safely", async () => {
  let finishHero!: () => void, finishFirst!: () => void;
  const events = [{ finished: new Promise<void>(resolve => { finishHero = resolve; }) }];
  const order: string[] = [];
  const first = serializeMotionEvents(events, () => {
    order.push("first"); return { finished: new Promise<void>(resolve => { finishFirst = resolve; }) };
  }, () => false);
  const second = first.then(() => serializeMotionEvents(events, () => { order.push("second"); return { finished: Promise.resolve() }; }, () => false));
  assert.deepEqual(order, []); finishHero(); await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(order, ["first"]); finishFirst(); await second;
  assert.deepEqual(order, ["first", "second"]);
  await serializeMotionEvents([], () => { throw Error("Stopped event must not animate"); }, () => true);
});
