import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { normalizeAction, normalizeDestination, sectionActionId } from "../lib/platform/actions/model";
import { myomatonAction, upgradeMyomatonCtaContent } from "../scripts/seed-data/myomaton-action";
import { SectionRenderer } from "../components/microsites/section-renderer";

const presenceId = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const seededRow = { ...myomatonAction, id, webPresenceId: presenceId, status: "active" };

test("seeded Action normalizes to a reusable presentation-independent value", () => {
  const action = normalizeAction(seededRow, presenceId);
  assert.deepEqual(action, { ...myomatonAction, id });
  assert.equal(sectionActionId({ actionId: id }), id);
  for (const content of [null, [], {}, { actionId: "not-a-uuid" }]) {
    assert.equal(sectionActionId(content), null);
  }
  const section = { id: "cta", type: "cta", variant: "default", name: "CTA", content: { heading: "Follow", actionId: id }, configuration: {}, action };
  const html = renderToStaticMarkup(<><SectionRenderer section={section} /><SectionRenderer section={{ ...section, id: "another-cta" }} /></>);
  assert.equal((html.match(/href="#about"/g) ?? []).length, 2);
  assert.equal((html.match(/class="microsite-action"/g) ?? []).length, 2);
});

test("destinations permit only the intended link, section, and minimal contact targets", () => {
  assert.equal(normalizeDestination("link", "/docs/../about?from=home#intro"), "/about?from=home#intro");
  assert.equal(normalizeDestination("link", "https://example.com/docs"), "https://example.com/docs");
  assert.equal(normalizeDestination("link", "http://example.com"), "http://example.com/");
  assert.equal(normalizeDestination("section", "#about"), "#about");
  assert.equal(normalizeDestination("contact", "/contact"), "/contact");
  assert.equal(normalizeDestination("contact", "#contact"), "#contact");
  assert.equal(normalizeDestination("contact", "https://example.com"), null);
  assert.equal(normalizeDestination("section", "/about"), null);
});

test("executable, ambiguous, malformed, and credential-bearing URLs are rejected", () => {
  const unsafe = ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "vbscript:x", "mailto:x@example.com", "tel:123", "//evil.example", "/%2fevil.example", "/\\evil.example", "/a/..//evil.example", "https://user:password@example.com", "https:example.com", "https:///example.com", "https://example.com/\n", "/%0d%0a", "/%5cevil", "/<script>", "/%3Cscript%3E", "/bad%", "#", "", " https://example.com", "/has space", "https://"];
  for (const destination of unsafe) {
    for (const type of ["link", "section", "contact"] as const) {
      assert.equal(normalizeDestination(type, destination), null, `${type}: ${destination}`);
    }
  }
});

test("missing, inactive, cross-tenant, malformed, and unsafe Actions fail closed", () => {
  for (const value of [null, {}, [], { ...seededRow, status: "inactive" }, { ...seededRow, webPresenceId: "another-tenant" }, { ...seededRow, type: "future" }, { ...seededRow, label: " " }, { ...seededRow, label: {} }, { ...seededRow, destination: "javascript:alert(1)" }, { ...seededRow, id: "invalid" }]) {
    assert.equal(normalizeAction(value, presenceId), null);
  }
  const section = { id: "cta", type: "cta", variant: null, name: null, content: { heading: "Still visible", actionLabel: "Legacy", actionHref: "#about" }, configuration: {}, action: null };
  const html = renderToStaticMarkup(<SectionRenderer section={section} />);
  assert.ok(html.includes("Still visible"));
  assert.ok(!html.includes("href="));
});

test("CTA seed upgrade is repeatable and preserves customized content and references", () => {
  const legacy = { heading: "Edited heading", text: "Keep this", actionLabel: "Learn more", actionHref: "#about", extra: true };
  const upgraded = upgradeMyomatonCtaContent(legacy, id);
  assert.deepEqual(upgraded, { heading: "Edited heading", text: "Keep this", extra: true, actionId: id });
  assert.equal(upgradeMyomatonCtaContent(upgraded, id), null);
  assert.equal(upgradeMyomatonCtaContent({ ...legacy, actionHref: "/custom" }, id), null);
  assert.equal(upgradeMyomatonCtaContent({ ...legacy, actionId: "existing-reference" }, id), null);
  assert.equal(legacy.actionHref, "#about");
});
