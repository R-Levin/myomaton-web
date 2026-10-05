import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { heroMotion, heroSequence } from "../lib/platform/visual-direction/motion";
import { allocateMotion } from "../lib/platform/visual-direction/model";

const css = readFileSync("app/globals.css", "utf8");

test("narrow Section padding retains three distinctions without oversized stacked intervals", () => {
  const narrow = css.slice(css.indexOf("@media (max-width: 59.99rem)"), css.indexOf("/* Prepared on initial style"));
  for (const [spacing, ceiling] of [["compact", "1.25rem"], ["normal", "1.75rem"], ["spacious", "2.5rem"]]) {
    const rule = narrow.match(new RegExp(`data-spacing="${spacing}"[^}]+padding-block: ([^;]+)`))![1];
    assert.ok(rule.includes(ceiling));
    assert.ok(rule.startsWith("clamp("));
  }
  assert.match(narrow, /section-role="hero"[^}]+clamp\(2.75rem, 8vw, 4rem\)/);
  assert.match(narrow, /section-role="statement"[^}]+clamp\(2.5rem, 10vw, 3.5rem\)/);
  assert.match(css, /section-heading > h2 \{ margin-block: 0; \}/);
});

test("deliberate responsive Hero remains one event with only opacity/transform and final geometry", () => {
  assert.equal(heroMotion.heading.travel, 96); assert.equal(heroMotion.heading.mobileTravel, 56);
  assert.equal(heroMotion.heading.duration, 1150);
  assert.ok(heroSequence(true, true, true).duration <= 1400);
  assert.equal(allocateMotion([{ id: "hero", type: "hero", content: { heading: "Title" } }, { id: "close", type: "cta", content: { heading: "Next" } }], "minimal").size, 1);
  assert.match(css, /max-width: 59.99rem[^}]*[\s\S]*--hero-travel: var\(--visual-heading-mobile-travel\)/);
  assert.match(css, /from \{ opacity: .35; transform: translateY/);
  assert.match(css, /prefers-reduced-motion: reduce[^}]+animation: none; opacity: 1; transform: none/);
});

test("peer groups avoid generic feature boxes and positional emphasis", () => {
  assert.match(css, /grouped-field[^}]+background: none; border-radius: 0; padding: .5rem 0/);
  assert.doesNotMatch(css, /collection-item:(first-child|nth-child)/);
});

test("grouped peers have equal column widths and an intentionally centered final row", () => {
  assert.match(css, /data-columns="2"[^}]+display: flex; flex-wrap: wrap; justify-content: center/);
  assert.match(css, /flex-basis: calc\(50% - 1rem\)/);
  assert.match(css, /grouped-field[^}]+row-gap: .5rem/);
  assert.doesNotMatch(css, /collection-item:(?:last-child|nth-child|first-child)/);
});

test("cold-load Hero has no initial blank reservation and message opacity rises early", () => {
  const renderer = readFileSync("components/managed-sites/section-renderer.tsx", "utf8");
  assert.match(renderer, /"--hero-sequence-delay": `\$\{motionSlot \* 1400\}ms`/);
  assert.match(css, /from \{ opacity: .35; transform: translateY/);
  assert.match(css, /20% \{ opacity: .9; \}/);
  assert.equal(heroSequence(true, true, true).supportStart, 100);
  assert.equal(heroSequence(true, true, true).actionStart, 260);
  assert.equal(heroSequence(true, true, true).duration, 1150);
});


test("finishing Hero entrance retains readable early movement with calmer deceleration", () => {
  assert.equal(heroMotion.heading.travel, 96);
  assert.equal(heroMotion.heading.mobileTravel, 56);
  assert.equal(heroMotion.heading.duration, 1150);
  assert.equal(heroMotion.easing, "cubic-bezier(.22,.6,.35,1)");
  assert.equal(heroSequence(true, true, true).supportStart, 100);
  assert.equal(heroSequence(true, true, true).actionStart, 260);
  assert.equal(heroSequence(true, true, true).duration, 1150);
  assert.match(css, /20% \{ opacity: .9; \}/);
});

test("finishing responsive rules tighten only phone Hero gaps and widen only tablet statements", () => {
  const phone = css.slice(css.indexOf("@media (max-width: 29.99rem)"), css.indexOf("@media (min-width: 30rem)"));
  assert.match(phone, /asymmetric-field[^}]+gap: .875rem/);
  assert.match(phone, /section-role="hero"[^}]+eyebrow \{ margin-block: 0/);
  assert.doesNotMatch(phone, /font-size|line-height|padding|min-height/);
  const tablet = css.slice(css.indexOf("@media (min-width: 30rem)"), css.indexOf("/* Prepared on initial style"));
  assert.match(tablet, /max-width: 59.99rem/);
  assert.match(tablet, /statement-break[^}]+max-width: min\(100%, 22ch\)/);
  assert.match(css, /statement-break[^}]+max-width: min\(100%, 13ch\)/);
});


test("major outer rhythm adds bounded top separation without changing internal spacing", () => {
  const rhythm = css.slice(css.indexOf("/* Major outer rhythm"), css.indexOf("/* Finish the existing composition"));
  assert.match(rhythm, /section-role="collection"/);
  assert.match(rhythm, /section-role="intro"\]\[data-composition="editorial-row"/);
  assert.doesNotMatch(rhythm, /hero|statement|image-evidence|conversion-band|h2|gap:|margin|padding-block-end/);
  assert.equal((rhythm.match(/padding-block-start:/g) ?? []).length, 6);
  const narrow = rhythm.slice(rhythm.indexOf("@media"));
  for (const [spacing, ceiling] of [["compact", "2rem"], ["normal", "2.5rem"], ["spacious", "3rem"]]) {
    assert.match(narrow, new RegExp(`data-spacing="${spacing}"[^}]+padding-block-start: clamp\\([^;]+, ${ceiling}\\)`));
  }
  assert.match(css, /grouped-field[^}]+row-gap: .5rem/);
  assert.match(css, /section-heading > h2 \{ margin-block: 0; \}/);
  assert.match(css, /section-copy > h2 \{ margin-block: 0 1rem; \}/);
  assert.doesNotMatch(rhythm, /Myomaton|myomaton|#[a-f0-9]{6}|nth-child|first-child/);
});
