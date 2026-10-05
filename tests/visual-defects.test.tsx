import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { SectionRenderer } from "../components/managed-sites/section-renderer";
import { visualTokens } from "../components/managed-sites/visual-tokens";
import { resolveVisualDirection } from "../lib/platform/visual-direction/model";
import { heroMotion, heroSequence } from "../lib/platform/visual-direction/motion";

const direction = resolveVisualDirection({ visualDirection: { profileId: "reference", profileVersion: 2 } }).direction!;
const css = readFileSync("app/globals.css", "utf8");
const expression = css.slice(css.indexOf("/* Reference v2:"));

test("semantic heading scales remain bounded even at maximum Design System settings", () => {
  for (const baseSize of [14, 18, 22]) for (const headingScale of [1.5, 3, 3.5]) {
    const tokens = visualTokens({ typography: { baseSize, headingScale } }, direction) as Record<string, string>;
    const display = parseFloat(tokens["--visual-display"]), statement = parseFloat(tokens["--visual-statement"]), section = parseFloat(tokens["--visual-section-heading"]);
    assert.ok(display >= 56 && display <= 112);
    assert.ok(statement >= 40 && statement <= 72);
    assert.ok(section >= 24 && section <= 40);
    assert.ok(display > statement && statement > section);
  }
});

test("headings and Hero children shrink and wrap; typography does not clip overflow", () => {
  assert.match(expression, /:is\(h1, h2, h3\)[^}]+min-inline-size: 0; max-inline-size: 100%; white-space: normal; word-break: normal; overflow-wrap: anywhere/);
  assert.match(expression, /section-copy > \*[^}]+min-inline-size: 0; max-inline-size: 100%/);
  assert.match(expression, /max-width: min\(100%, 14ch\); font-size: clamp\(2.5rem, 7.5vw, var\(--visual-display\)\)/);
  assert.doesNotMatch(expression, /white-space:\s*nowrap|overflow(?:-x)?:\s*(hidden|clip)|[;{]\s*min-width:\s*\d+(px|rem)/);
  assert.match(expression, /grid-template-columns: minmax\(0, 1.35fr\) minmax\(0, 1fr\)/);
});

test("desktop, tablet and phone contracts retain final Hero geometry and canonical Action", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  for (const viewport of [1440, 1024, 320]) for (const heading of ["About Myomaton", "A longer editorial heading that wraps at natural word boundaries", "AnUnusuallyLongUnbrokenDisplayWordThatMustNeverOverflow"]) {
    const section = { id: "hero", name: "Hero", type: "hero", variant: "default", configuration: { composition: "asymmetric-field", width: "wide" },
      content: { heading, text: "Readable support.", actionId: id }, action: { id, name: "Explore", type: "page" as const, label: "Explore", destination: "/projects" } };
    const dom = new JSDOM(renderToStaticMarkup(<SectionRenderer section={section} direction={direction} motionSlot={0} />));
    Object.defineProperty(dom.window, "innerWidth", { value: viewport });
    const doc = dom.window.document;
    assert.equal(doc.querySelector("h1")?.textContent, heading);
    assert.equal(doc.querySelector("section")?.getAttribute("data-composition"), "asymmetric-field");
    assert.equal(doc.querySelector("a")?.getAttribute("href"), "/projects");
    assert.doesNotMatch(doc.querySelector("section")?.getAttribute("style") ?? "", /(?:^|;)\s*(width|height|display|grid|margin|padding|opacity|transform):/);
    // These are markup/CSS contracts, not JSDOM pixel-layout measurements.
    dom.window.close();
  }
});

test("Hero is prepared by first-render CSS; only opacity and transform animate", () => {
  const keyframes = expression.match(/@keyframes visual-hero-enter\s*\{\s*from\s*\{([^}]+)\}\s*20%\s*\{\s*opacity: .9;\s*\}\s*to\s*\{([^}]+)\}/)!;
  assert.ok(keyframes);
  for (const declarations of keyframes.slice(1)) assert.deepEqual(declarations.split(";").map(d => d.trim()).filter(Boolean).map(d => d.split(":")[0]).sort(), ["opacity", "transform"]);
  assert.match(expression, /prefers-reduced-motion: no-preference/);
  assert.match(expression, /prefers-reduced-motion: reduce[^}]+animation: none; opacity: 1; transform: none/);
  assert.match(expression, /:focus-within[^}]+animation: none; opacity: 1; transform: none/);
  const client = readFileSync("components/managed-sites/page-motion.tsx", "utf8");
  assert.doesNotMatch(client, /part.animate|requestAnimationFrame|classList|\.style\.|dataset\./);
  assert.ok(client.indexOf("if (!consumers.length) return") < client.indexOf("window.IntersectionObserver"));
  assert.deepEqual(heroMotion.heading, { duration: 1150, travel: 96, mobileTravel: 56 });
  assert.deepEqual(heroMotion.support, { duration: 650, travel: 24 });
  assert.deepEqual(heroMotion.action, { duration: 450, travel: 18 });
  assert.equal(heroSequence(true, true, true).supportStart, 100);
  assert.equal(heroSequence(true, true, true).actionStart, 260);
});
