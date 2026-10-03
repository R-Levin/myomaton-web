import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import * as model from "../lib/platform/site-globals/model";
import * as policy from "../lib/platform/policy/site-policy";
import { SiteHeader, SiteFooter } from "../components/managed-sites/site-chrome";
import type { SiteGlobals } from "../lib/platform/site-globals/service";
import { loadService } from "./helpers/load-service";

const id = "11111111-1111-4111-8111-111111111111";
const nav = { id, name: "Primary Navigation", surface: "managedSite" as const, items: [{ id, name: "About", label: "About", targetType: "link" as const, targetReference: "/about", href: "/about", children: [] }] };
function globals(configuration: unknown = {}, site: unknown = {}): SiteGlobals {
  return { identity: model.resolveBusinessIdentity(configuration, "Business", "Site"), presentation: model.resolveSitePresentation(site),
    policy: policy.resolveSitePolicy(), logo: null, utilityNavigation: null, contactAction: null };
}
const display = { globals: { header: { showPhone: true }, footer: { showPhone: true, showEmail: true, showSocials: true, showUtilityNavigation: true } } };
function document(g: SiteGlobals) {
  return new JSDOM(renderToStaticMarkup(<><SiteHeader globals={g} navigation={nav} /><SiteFooter globals={g} year={2031} /></>)).window.document;
}

test("canonical facts are shared by Header/Footer; absent or presentation-owned facts never render", () => {
  const business = { displayName: "Our <business>", phone: "+1 (212) 555-0100", email: "hello@example.com" };
  const g = globals({ business }, display), doc = document(g);
  assert.equal(doc.querySelectorAll('a[href="tel:+12125550100"]').length, 2);
  assert.equal(doc.querySelector('a[href="mailto:hello@example.com"]')?.textContent, business.email);
  assert.equal(doc.querySelector("footer small")?.textContent, "© 2031 Our <business>");
  assert.equal(doc.querySelectorAll("header").length, 1); assert.equal(doc.querySelectorAll("footer").length, 1);
  assert.equal(doc.querySelector('header nav a')?.getAttribute("href"), "/about");
  assert.equal(doc.querySelectorAll("footer nav").length, 0, "Primary is never copied into Utility");
  assert.equal(doc.querySelectorAll("script").length, 0);
  const absent = document(globals({}, { ...display, business, phone: business.phone }));
  assert.equal(absent.querySelectorAll('a[href^="tel:"],a[href^="mailto:"],.managed-site-socials,img').length, 0);
  assert.equal(absent.querySelector("footer small")?.textContent, "© 2031 Business");
  assert.equal(document(globals({ business })).querySelectorAll('a[href^="tel:"],a[href^="mailto:"]').length, 0, "facts alone do not opt into display");
});

test("Asset logo has linked/unlinked accessible identity; null logo falls back and Utility/Contact are separate", () => {
  const g = globals({}, display);
  g.logo = { assetId: id, src: `/media/assets/${id}`, width: 120, height: 60, alt: "Generic file description" };
  g.utilityNavigation = { ...nav, name: "Utility Navigation" };
  g.contactAction = { id, name: "Contact", label: "Contact us", type: "page", destination: "/contact" };
  const doc = document(g);
  assert.equal(doc.querySelectorAll(`img[src="/media/assets/${id}"]`).length, 2);
  assert.equal(doc.querySelector("header .managed-site-brand")?.getAttribute("aria-label"), "Business — Home");
  assert.equal(doc.querySelector("footer img")?.getAttribute("alt"), "Business");
  assert.equal(doc.querySelector('header a[href="/contact"]')?.textContent, "Contact us");
  assert.ok(doc.querySelector('footer nav[aria-label="Utility Navigation"]'));
  g.logo = null; assert.equal(document(g).querySelector("header .managed-site-brand")?.textContent, "Business");
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /@media \(width < 64rem\)/); assert.match(css, /\.managed-site-global-inner[\s\S]*flex-wrap: wrap/);
});

test("contact and social normalization excludes unsafe, foreign-host and malformed destinations", () => {
  for (const email of [".x@example.com", "x..y@example.com", "x@example..com", "x@-example.com", "x@example-.com", "x@example.com\r\nBcc:bad@example.com"]) {
    assert.equal(model.resolveBusinessIdentity({ business: { email } }, "Name", "Site").email, null);
  }
  for (const bad of ["javascript:alert(1)", "https://youtube.com.evil.test/name", "//youtube.com/name", "https://u:p@youtube.com/name", "https://youtube.com/", "https://youtube.com:4000/name", "https://youtube.com/%0aevil"]) {
    assert.equal(model.resolveBusinessIdentity({ business: { socials: { youtube: bad } } }, "Name", "Site").socials.length, 0);
  }
  const g = globals({ business: { socials: { youtube: "https://www.youtube.com/@example", unknown: "https://example.com" }, phone: "123\n456789", email: "x@example.com?subject=bad" } }, display);
  assert.deepEqual(g.identity.socials, [{ label: "YouTube", href: "https://www.youtube.com/@example" }]);
  assert.equal(g.identity.phone, null); assert.equal(g.identity.email, null);
  assert.ok(document(g).querySelector('footer a[href="https://www.youtube.com/@example"]'));
  g.policy.socialLinksEnabled = false; assert.equal(document(g).querySelectorAll(".managed-site-socials").length, 0);
  assert.deepEqual(model.resolveSitePresentation({ globals: { header: { showPhone: "yes", contactActionId: "javascript:x", css: "bad" } } }), model.resolveSitePresentation({}));
});

test("policy permits only trusted scope grants, respects precedence, and rejects styling/invalid values", () => {
  const resolve = policy.resolveSitePolicy;
  assert.deepEqual(resolve(), { socialLinksEnabled: true });
  const service = { socialLinksEnabled: { value: false } }, yes = { socialLinksEnabled: true };
  assert.equal(resolve(service, yes, yes).socialLinksEnabled, false);
  assert.equal(resolve({ socialLinksEnabled: { value: false, allowPresenceOverride: true } }, yes).socialLinksEnabled, true);
  assert.equal(resolve({ socialLinksEnabled: { value: false, allowPresenceOverride: true, allowSiteOverride: true } }, yes, { socialLinksEnabled: false }).socialLinksEnabled, false);
  assert.equal(resolve(service, { ...yes, allowPresenceOverride: true }, { ...yes, allowSiteOverride: true }).socialLinksEnabled, false);
  assert.deepEqual(resolve({ socialLinksEnabled: { value: false, allowSiteOverride: true } }, {}, { socialLinksEnabled: "true", css: "red" }), { socialLinksEnabled: false });
  assert.deepEqual(policy.servicePolicyFromEnvironment("bad json"), {});
  assert.deepEqual(resolve({ socialLinksEnabled: { value: "bad", allowSiteOverride: "true" } }, {}, yes), { socialLinksEnabled: true });
});

test("global service carries one identity and resolves configured Action and separate Utility in Page context", async () => {
  const calls: unknown[] = [];
  const service = loadService("lib/platform/site-globals/service.ts", {
    "../db/connection": { db: {} }, "./model": model, "../policy/site-policy": policy,
    "../assets/presentation-queries": { logoImage: async (_db: unknown, presence: string) => { assert.equal(presence, id); return null; } },
    "../navigations/service": { getNavigationByName: async (...args: unknown[]) => { calls.push(args); return { ...nav, name: "Utility Navigation" }; } },
    "../actions/service": { getActionsByIds: async (...args: unknown[]) => { calls.push(args); return new Map(); } },
  }) as typeof import("../lib/platform/site-globals/service");
  const input = { webPresenceId: id, presenceName: "Business", presenceConfiguration: {}, managedSiteId: id, siteName: "Site", siteConfiguration: {}, pageId: id };
  const empty = await service.getSiteGlobals(input); assert.equal(empty.contactAction, null); assert.equal(calls.length, 0);
  await service.getSiteGlobals({ ...input, siteConfiguration: { globals: { header: { contactActionId: id }, footer: { showUtilityNavigation: true } } } });
  assert.deepEqual(calls, [[id, "Utility Navigation", "managedSite", { managedSiteId: id, pageId: id }], [id, [id], { managedSiteId: id, pageId: id }]]);
});
