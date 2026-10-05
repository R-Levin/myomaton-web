import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { JSDOM } from "jsdom";
import { resolveDesignConfiguration } from "../lib/platform/design-systems/configuration";
import { resolveVisualDirection, allocateDecoration, allocateMotion, sectionPresentation } from "../lib/platform/visual-direction/model";
import { resolveVisualPolicy } from "../lib/platform/policy/site-policy";
import { visualTokens, readableColor } from "../components/managed-sites/visual-tokens";
import { normalizeSection } from "../lib/platform/managed-sites/sections";
import { SectionRenderer } from "../components/managed-sites/section-renderer";
import { PageMotion } from "../components/managed-sites/page-motion";

const config = { visualDirection: { profileId: "reference", profileVersion: 2 } };
const direction = resolveVisualDirection(config).direction!;
const hero = { id: "hero", type: "hero", variant: "default", name: "Hero", content: { heading: "A useful idea", eyebrow: "Real work", text: "Real content." }, configuration: {} };

test("v2 is opt-in; secondary accent is optional, strictly normalized and contrast-paired", () => {
  assert.equal(direction.profileVersion, 2);
  assert.equal(resolveVisualDirection({ visualDirection: { profileId: "editorial", profileVersion: 2 } }).direction, null);
  const defaultTokens = visualTokens({}, direction) as Record<string, string>;
  assert.equal(defaultTokens["--visual-secondary-accent"], resolveDesignConfiguration({}).colors.accent);
  const input = { colors: { secondaryAccent: "#ffffff", onSecondaryAccent: "#ffffff" } };
  const tokens = visualTokens(input, direction) as Record<string, string>;
  assert.equal(tokens["--visual-secondary-text"], "#000000");
  assert.equal(readableColor(tokens["--visual-secondary-text"], tokens["--visual-secondary-accent"]), "#000000");
  assert.equal(resolveDesignConfiguration({ colors: { secondaryAccent: "red;display:none" } }).colors.secondaryAccent, undefined);
  assert.ok(Number.parseFloat(tokens["--visual-display"]) > Number.parseFloat((visualTokens({}, resolveVisualDirection({ visualDirection: { profileId: "reference", profileVersion: 1 } }).direction!) as Record<string, string>)["--visual-display"]));
});

test("v2 defaults strengthen Hero without overriding explicit choices or copying content", () => {
  const normalized = normalizeSection(hero)!;
  assert.equal(sectionPresentation(normalized.configuration, {}, "hero", 0, direction).surface, "default");
  const explicit = { surface: "default", alignment: "center", width: "reading", spacing: "compact", divider: "rule" };
  const n = normalizeSection({ ...hero, configuration: explicit })!;
  assert.deepEqual(sectionPresentation(n.configuration, explicit, "hero", 0, direction), n.configuration);
  const html = renderToString(<SectionRenderer section={hero} direction={direction} decoration="panel" />);
  const doc = new JSDOM(html).window.document;
  assert.equal(doc.querySelectorAll("h1").length, 1);
  assert.equal(doc.querySelector("h1")?.textContent, hero.content.heading);
  assert.equal(doc.querySelector(".managed-site-eyebrow")?.textContent, "Real work");
  assert.equal(doc.querySelector(".managed-site-hero-narrative")?.textContent, "Real content.");
});

test("decoration and motion remain deterministic Page budgets with trusted policy ceilings", () => {
  const sections = [hero, ...Array.from({ length: 20 }, (_, i) => ({ ...hero, id: String(i), type: "collection" }))];
  assert.equal(allocateDecoration(sections, direction).size, 0);
  const disabled = resolveVisualDirection(config, resolveVisualPolicy({ visualDecoration: { value: false } })).direction;
  assert.equal(allocateDecoration(sections, disabled).size, 0);
  assert.equal(resolveVisualPolicy({}, {}, { visualDecoration: false }).decoration, true);
  assert.equal(resolveVisualPolicy({ visualDecoration: { value: "unsafe" } }).decoration, true);
  assert.equal(allocateMotion(sections, "minimal").size, 1);
  const css = readFileSync("app/globals.css", "utf8");
  const frame = css.match(/\[data-image-treatment="framed"\] \.managed-site-section-media \{([^}]+)\}/)![1];
  assert.doesNotMatch(frame, /border\s*:/);
  assert.match(css, /:not\(\[data-visual-version="2"\]\)/);
});

test("optional non-Hero observer reveals only allocated consumers once; reduced motion cancels, SSR stays visible", async () => {
  const tree = <PageMotion enabled><section data-motion-slot="0"><div className="managed-site-section-inner">Readable without JS</div></section><section><div className="managed-site-section-inner">Unallocated</div></section></PageMotion>;
  const html = renderToString(tree);
  assert.doesNotMatch(html, /opacity|hidden|visibility/);
  const dom = new JSDOM(`<div id="root">${html}</div>`, { pretendToBeVisual: true });
  let callback: IntersectionObserverCallback;
  const observed: Element[] = [], calls: unknown[][] = [];
  let cancelled = 0, disconnected = 0, change: (() => void) | undefined;
  const preference = { matches: false, addEventListener: (_: string, fn: () => void) => { change = fn; }, removeEventListener() {} };
  class Observer {
    constructor(fn: IntersectionObserverCallback) { callback = fn; }
    observe(el: Element) { observed.push(el); }
    unobserve() {}
    disconnect() { disconnected++; }
  }
  Object.assign(dom.window, { matchMedia: () => preference, IntersectionObserver: Observer });
  dom.window.Element.prototype.animate = ((...args: unknown[]) => { calls.push(args); return { finished: Promise.resolve(), cancel: () => { cancelled++; } }; }) as unknown as typeof Element.prototype.animate;
  const replacement = { window: dom.window, document: dom.window.document, IntersectionObserver: Observer, IS_REACT_ACT_ENVIRONMENT: true };
  const descriptors = Object.fromEntries(Object.keys(replacement).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k, value] of Object.entries(replacement)) Object.defineProperty(globalThis, k, { value, configurable: true, writable: true });
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => { root = hydrateRoot(dom.window.document.getElementById("root")!, tree); });
    assert.equal(observed.length, 1);
    const entries = [{ target: observed[0], isIntersecting: true }] as IntersectionObserverEntry[];
    callback!(entries, {} as IntersectionObserver); callback!(entries, {} as IntersectionObserver);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0][0], [{ opacity: .35, transform: "translateY(14px)" }, { opacity: 1, transform: "translateY(0)" }]);
    preference.matches = true; change!();
    assert.equal(cancelled, 1); assert.ok(disconnected);
    await act(async () => { root!.unmount(); root = undefined; });
    observed.length = 0;
    dom.window.document.getElementById("root")!.innerHTML = renderToString(<PageMotion enabled>Reduced</PageMotion>);
    await act(async () => { root = hydrateRoot(dom.window.document.getElementById("root")!, <PageMotion enabled>Reduced</PageMotion>); });
    assert.equal(observed.length, 0);
    await act(async () => { root!.unmount(); root = undefined; });
    preference.matches = false;
    const heroOnly = <PageMotion enabled><SectionRenderer section={hero} direction={direction} motionSlot={0} /></PageMotion>;
    dom.window.document.getElementById("root")!.innerHTML = renderToString(heroOnly);
    Object.defineProperty(dom.window, "IntersectionObserver", { get() { throw Error("Hero must not require IntersectionObserver"); }, configurable: true });
    await act(async () => { root = hydrateRoot(dom.window.document.getElementById("root")!, heroOnly); });
    assert.equal(observed.length, 0);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 250)); });
    assert.equal(calls.length, 1, "Hero never resets visible content through WAAPI after hydration");

  } finally {
    if (root) await act(async () => root!.unmount());
    dom.window.close();
    for (const k of Object.keys(replacement)) { if (descriptors[k]) Object.defineProperty(globalThis, k, descriptors[k]!); else Reflect.deleteProperty(globalThis, k); }
  }
});


test("all eligible Heroes expose semantic roles and visible server content", () => {
  for (const heading of ["Myomaton", "About Myomaton", "Projects", "Principles"]) {
    const section = { ...hero, content: { ...hero.content, heading } };
    const html = renderToString(<SectionRenderer section={section} direction={direction} motionSlot={0} />);
    const doc = new JSDOM(html).window.document;
    assert.equal(doc.querySelector('[data-motion-entrance="initial"] h1')?.textContent, heading);
    assert.ok(doc.querySelector(".managed-site-hero-narrative")?.textContent);
    assert.doesNotMatch(html, /hidden|opacity:/);
    assert.doesNotMatch(renderToString(<SectionRenderer section={section} direction={direction} />), /data-motion-entrance/);
    const v1 = { ...direction, profileVersion: 1 as const };
    assert.doesNotMatch(renderToString(<SectionRenderer section={section} direction={v1} motionSlot={0} />), /data-motion-entrance/);
  }
  assert.match(readFileSync("app/globals.css", "utf8"), /animation: visual-hero-enter/);
});

test("peer card presentation never assigns ordering-based prominence", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.doesNotMatch(css, /collection-item:(first-child|nth-child)/);
  assert.doesNotMatch(css, /data-decoration="group"/);
  assert.match(css, /\[data-visual-version="2"\] \.managed-site-collection-item \{ border: 0; box-shadow: none;/);
  const collections = ["principles", "projects"].map(id => ({ ...hero, id, type: "collection" }));
  assert.equal(allocateDecoration(collections, direction).size, 0);
  assert.equal(allocateDecoration(collections.toReversed(), direction).size, 0);
});
