import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { resolveVisualDirection, allocateMotion, sectionPresentation } from "../lib/platform/visual-direction/model";
import { resolveVisualPolicy } from "../lib/platform/policy/site-policy";
import { normalizeSection } from "../lib/platform/managed-sites/sections";
import { defaultDesignConfiguration } from "../lib/platform/design-systems/configuration";
import { readableColor, visualTokens } from "../components/managed-sites/visual-tokens";
import { ManagedSitePageView } from "../components/managed-sites/managed-site-page";
import type { ManagedSitePage, ManagedSiteSection } from "../lib/platform/managed-sites/service";
import { normalizeDefinition } from "../lib/platform/contact/model";
import { resolveBusinessIdentity } from "../lib/platform/site-globals/model";
import { PrimaryNavigation } from "../components/managed-sites/primary-navigation";

const config = (preferences = {}, profileId = "reference") => ({ visualDirection: { profileId, profileVersion: 1, preferences } });
const policy = resolveVisualPolicy({ visualMaxMotion: { value: "light" }, visualPreferences: ["hero", "motion", "image", "elevation", "backdrop", "density"], visualTranslucency: { value: true } });
const direction = resolveVisualDirection(config(), policy).direction!;
const section = (id: string, type = "intro", configuration = {}): ManagedSiteSection => ({ id, type, variant: "stack", name: id, content: { heading: id, text: "First.\n\nSecond." }, configuration });
const page: ManagedSitePage = { managedSite: { id: "site", name: "Example" }, page: { id: "page", name: "Home", title: "Home", slug: "/" }, designSystem: { id: null, name: null, configuration: defaultDesignConfiguration }, sections: [section("Hero", "hero"), section("Story"), section("End", "cta")] };
const render = (p: ManagedSitePage) => renderToStaticMarkup(<ManagedSitePageView page={p} />);

test("versioned profiles fail closed to byte-identical legacy markup on invalid configuration", () => {
  const legacy = render(page);
  for (const c of [{}, { visualDirection: null }, { visualDirection: [] }, config({}, "unknown"), config({}, "__proto__"), { visualDirection: { profileId: "reference", profileVersion: 99 } }, config({ motion: "high" }), config({ css: "position:absolute" }), { visualDirection: { ...config().visualDirection, preferences: [] } }]) {
    assert.equal(resolveVisualDirection(c).direction, null);
    assert.equal(render({ ...page, visual: resolveVisualDirection(c) }), legacy);
  }
  assert.equal(resolveVisualDirection(config({}, "editorial")).direction?.motion, "off");
  assert.equal(direction.profileVersion, 1);
});

test("policy precedence and service-only preference permission constrain direction", () => {
  assert.equal(resolveVisualDirection(config()).direction?.motion, "minimal");
  const p = resolveVisualPolicy({ visualMaxMotion: { value: "light", allowPresenceOverride: true, allowSiteOverride: true } }, { visualMaxMotion: "minimal" }, { visualMaxMotion: "off", visualPreferences: ["backdrop"] });
  const d = resolveVisualDirection(config({ motion: "light", backdrop: "translucent", hero: "statement", elevation: "prominent" }), p).direction!;
  assert.equal(d.motion, "off"); assert.equal(d.backdrop, "opaque"); assert.equal(d.hero, "statement"); assert.equal(d.elevation, "subtle");
  assert.equal(resolveVisualPolicy({}, {}, { visualMaxMotion: "light", visualTranslucency: true }).maxMotion, "minimal");
  assert.equal(resolveVisualPolicy({ visualMaxMotion: { value: "invalid" } }).maxMotion, "minimal");
  assert.equal(resolveVisualDirection(config({ backdrop: "translucent" }), policy).direction?.backdrop, "translucent");
});

test("explicit Section choices survive normalization and rhythm only supplies missing defaults", () => {
  const raw = { surface: "accent", spacing: "compact", divider: "rule", width: "reading", alignment: "left", mediaFit: "cover" };
  const s = { ...section("Story", "intro", raw), variant: "split-image-first", image: { assetId: "asset", src: "/media/test", width: 600, height: 400, alt: "Context alt" } };
  const before = structuredClone(s);
  const n = normalizeSection(s)!;
  assert.deepEqual(sectionPresentation(n.configuration, raw, "intro", 1, direction), n.configuration);
  const html = render({ ...page, visual: { direction, reason: "resolved" }, sections: [{ ...s, ...n, rawConfiguration: raw }] });
  const dom = new JSDOM(html).window.document;
  assert.equal(dom.querySelector("section")?.getAttribute("data-layout"), "split-image-first");
  assert.equal(dom.querySelector("section")?.getAttribute("data-surface"), "accent");
  assert.equal(dom.querySelector("img")?.getAttribute("alt"), "Context alt");
  assert.ok(html.indexOf("<h2>") < html.indexOf("<img"));
  assert.ok(html.indexOf("<img") < html.indexOf("First."));
  assert.deepEqual(s, before);
  const automatic = sectionPresentation(n.configuration, {}, "intro", 1, direction);
  assert.equal(automatic.surface, "subtle"); assert.equal(automatic.divider, "none");
});

test("whole Page motion is deterministic, capped, Hero-first, and never a per-card allowance", () => {
  const sections = [section("cta", "cta"), ...Array.from({ length: 20 }, (_, i) => section(`s${i}`, "cta")), section("hero", "hero"), section("cards", "collection")];
  assert.equal(allocateMotion(sections, "off").size, 0);
  assert.deepEqual([...allocateMotion(sections, "minimal")], [["hero", 0]]);
  assert.deepEqual([...allocateMotion(sections, "light")], [["hero", 0], ["cta", 1], ["s0", 2]]);
  const html = render({ ...page, sections, visual: { direction, reason: "resolved" } });
  assert.equal(new JSDOM(html).window.document.querySelectorAll("[data-motion-slot]").length, 3);
});

test("semantic image/elevation/Hero treatments do not change content or assets", () => {
  for (const image of ["plain", "framed", "elevated", "bordered"]) for (const elevation of ["none", "subtle", "prominent"]) {
    const visual = resolveVisualDirection(config({ image, elevation, hero: "statement" }), policy);
    const html = render({ ...page, visual, sections: [...page.sections, { ...section("Photo"), image: { assetId: "asset", src: "/media/asset", width: 600, height: 400, alt: "" } }] });
    const dom = new JSDOM(html).window.document;
    assert.equal(dom.querySelector("[data-image-treatment]")?.getAttribute("data-image-treatment"), image);
    assert.equal(dom.querySelector("[data-elevation]")?.getAttribute("data-elevation"), elevation);
    assert.equal(dom.querySelector(".managed-site-section-hero")?.getAttribute("data-alignment"), "center");
    assert.equal(dom.querySelector("img")?.getAttribute("src"), "/media/asset");
    assert.equal(dom.querySelector("img")?.getAttribute("alt"), "");
    assert.equal(dom.querySelector("h1")?.textContent, "Hero");
  }
  assert.equal(resolveVisualDirection(config({ elevation: "0 0 50px red" }), policy).direction, null);
});

test("semantic contrast roles and scoped CSS provide links, forms, focus and reduced motion", () => {
  assert.equal(readableColor("#ffffff", "#ffffff"), "#000000");
  assert.equal(readableColor("#000000", "#000000"), "#ffffff");
  const tokens = visualTokens(defaultDesignConfiguration, direction) as Record<string, string>;
  for (const key of ["display", "page-title", "section-heading", "body", "meta", "label", "help", "error", "shadow-none", "shadow-subtle", "shadow-prominent", "base-link", "alternate-link", "emphasized-link"]) assert.ok(tokens[`--visual-${key}`], key);
  const css = readFileSync("app/globals.css", "utf8").split("/* Opt-in semantic presentation.")[1];
  assert.match(css, /text-decoration: underline/); assert.match(css, /nav a[^}]+text-decoration: none/);
  // Keep the default inline rule weaker than Navigation's explicit role.
  assert.match(css, /:where\(a:not\(\.managed-site-action\):not\(\.managed-site-contact-action\)\)/);
  assert.match(css, /data-backdrop="translucent"\] \.managed-site-header \.managed-site-global-inner/);
  assert.match(css, /:focus-visible[^}]+outline: 2px solid/);
  assert.match(css, /prefers-reduced-motion: reduce[^}]+animation: none/);
  assert.match(css, /prefers-reduced-motion: no-preference/);
  assert.doesNotMatch(css, /infinite|visibility:\s*hidden/);
  // v2 opacity lives only in the finite no-preference entrance, never base content.
  assert.match(css, /@keyframes visual-hero-enter/);
  assert.match(css, /managed-site-form-help/); assert.match(css, /data-form-state="error"/); assert.match(css, /data-form-state="success"/);
  const id = "11111111-1111-4111-8111-111111111111";
  const definition = normalizeDefinition({ id, version: 1, status: "active", configuration: { fields: [{ key: "email", label: "Email", required: true }], privacyText: "Private inquiry" } });
  const html = render({ ...page, visual: { direction, reason: "resolved" }, sections: [{ ...section("contact", "contact"), content: { contact_definition_id: id }, contact: { sectionId: id, definition, identity: resolveBusinessIdentity({}, "Business", "Site") } }] });
  const dom = new JSDOM(html).window.document;
  assert.ok(dom.querySelector("label[for]")); assert.ok(dom.querySelector("input[required]")); assert.ok(dom.querySelector(".managed-site-form-help")); assert.ok(dom.querySelector('[role="status"]'));
});

test("Navigation keeps destinations and children while exposing exact current Page semantics", () => {
  const child = { id: "child", name: "Child", label: "Child", href: "/child", targetType: "page" as const, targetReference: "page", children: [] };
  const navigation = { id: "nav", name: "Primary Navigation", surface: "managedSite" as const, items: [{ ...child, id: "home", href: "/", label: "Home", children: [child] }] };
  const dom = new JSDOM(renderToStaticMarkup(<PrimaryNavigation navigation={navigation} currentPath="/child" />)).window.document;
  assert.deepEqual([...dom.querySelectorAll("a")].map(a => a.getAttribute("href")), ["/", "/child"]);
  assert.equal(dom.querySelectorAll('[aria-current="page"]').length, 1);
  assert.equal(dom.querySelector('[aria-current="page"]')?.textContent, "Child");
  assert.ok(dom.querySelector("ul ul"));
  assert.doesNotMatch(renderToStaticMarkup(<PrimaryNavigation navigation={navigation} />), /aria-current/);
});
