import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { fontResources } from "../lib/platform/presentation/fonts";
import { fontDiagnostics } from "../lib/platform/presentation/fonts-server";
import { disposablePreviewEnabled, resolveFpo, validateFpo } from "../lib/platform/presentation/fpo";
import { validateDirection, resolvePlan } from "../lib/platform/presentation/plan";
import { relationship } from "../lib/platform/presentation/content";
import { contrast, validatePalette } from "../lib/platform/presentation/tokens";
import { mioPagesPreview } from "../scripts/customer-previews/miopages";
import { servicePage } from "./fixtures/service-led-pages";
import { normalizeSection } from "../lib/platform/managed-sites/sections";
import { resolveVisualDirection } from "../lib/platform/visual-direction/model";
import { ManagedSitePageView } from "../components/managed-sites/managed-site-page";
import { presentCollection } from "../lib/platform/managed-sites/collections";

function recommendedPage(route: string, preview = true) {
  const page = servicePage(route);
  page.presentationPreview = preview;
  page.visual = resolveVisualDirection(mioPagesPreview.siteConfiguration);
  page.designSystem.rawConfiguration = mioPagesPreview.designConfiguration;
  page.sections = mioPagesPreview.pages[route].map((s, i) => {
    const n = normalizeSection(s)!;
    return { ...s, ...n, id: String(i), name: String(i), rawConfiguration: s.configuration,
      ...(n.type === "collection" ? { collectionItems: presentCollection(n.content) } : {}) };
  });
  return page;
}
test("curated font pins, WOFF2 signatures, licenses and missing-resource diagnostics", () => {
  assert.equal(fontDiagnostics().length, 0);
  for (const font of fontResources) {
    const bytes = readFileSync("public" + font.path);
    assert.equal(bytes.subarray(0, 4).toString(), "wOF2");
    assert.equal(createHash("sha256").update(bytes).digest("hex"), font.sha256);
    assert.match(readFileSync("public" + font.license, "utf8"), /SIL OPEN FONT LICENSE/i);
  }
  assert.deepEqual(fontResources.map(f => f.weight), [600, 400, 600]);
});
test("FPO is explicit, bounded and refused by ordinary deployments and preparation", () => {
  const slot = mioPagesPreview.pages["/"][0].configuration.previewMedia;
  assert.equal(validateFpo(slot).role, "service-illustration");
  assert.equal(resolveFpo(slot, false), null);
  assert.throws(() => validateFpo({ ...slot as object, source: "arbitrary-url" }));
  assert.throws(() => validateFpo({ ...slot as object, purpose: "<script>" }));
  const schema = "canonical_test_" + "a".repeat(32) + "_preview";
  const url = new URL("postgres://localhost/test"); url.searchParams.set("options", `-c search_path=${schema} -c default_transaction_read_only=on`);
  assert.equal(disposablePreviewEnabled({ PRESENTATION_PREVIEW_SCHEMA: schema, DATABASE_URL: url.href }), true);
  for (const env of [{ DATABASE_URL: url.href }, { PRESENTATION_PREVIEW_SCHEMA: "public", DATABASE_URL: url.href }, { PRESENTATION_PREVIEW_SCHEMA: schema, DATABASE_URL: "postgres://localhost/test" }]) assert.equal(disposablePreviewEnabled(env), false);
  const selection = validateDirection(mioPagesPreview.siteConfiguration.visualDirection);
  const sections = mioPagesPreview.pages["/"].map((s, i) => ({ ...s, id: String(i) }));
  assert.throws(() => resolvePlan(selection, mioPagesPreview.pageConfigurations?.["/"], sections, true), /FPO/);
  assert.deepEqual(resolvePlan(selection, mioPagesPreview.pageConfigurations?.["/"], sections, true, true), resolvePlan(selection, mioPagesPreview.pageConfigurations?.["/"], sections, true, true));
  assert.equal(resolvePlan(selection, {}, sections).sections[0].hero, "orientation");
  const production = renderToStaticMarkup(<ManagedSitePageView page={recommendedPage("/", false)} />);
  assert.doesNotMatch(production, /data-fpo-role|p-service-diagram|p-artifact-sheet/);
  assert.match(production, /A clearer web presence/);
});
test("connected relationship keeps stages authoritative and attaches complexity to Launch", () => {
  const content = mioPagesPreview.pages["/service"][1].content;
  const r = relationship(content); assert.equal(r.kind, "stages");
  if (r.kind !== "stages") throw Error("stages required");
  assert.deepEqual(r.items.map(i => i.id), ["launch", "ongoing"]);
  assert.equal(r.extensions?.[0].stageId, "launch");
  assert.throws(() => relationship({ ...content, extensions: [{ ...r.extensions![0], stageId: "missing" }] }));
  assert.throws(() => relationship({ ...content, contractVersion: 1 }));
  assert.throws(() => relationship({ ...content, extensions: [{ ...r.extensions![0], text: "<table>" }] }));
});
test("one recommended four-page direction has source fonts, tangible artifacts, no fake workflow or public prices", () => {
  for (const route of ["/", "/service", "/experience", "/review"]) {
    const html = renderToStaticMarkup(<ManagedSitePageView page={recommendedPage(route)} />);
    const doc = new JSDOM(html).window.document;
    assert.equal(doc.querySelectorAll("h1").length, 1);
    assert.equal(doc.querySelectorAll("form,input,textarea,[data-motion-slot]").length, 0);
    assert.equal(doc.querySelector('.p-presence')?.getAttribute("data-grammar-version"), "2");
    assert.match(html, /Source Serif 4/); assert.match(html, /Source Sans 3/);
    assert.doesNotMatch(doc.body.textContent!, /\$1,095|\$249|scores|ROI|AI-powered/);
    for (const slot of doc.querySelectorAll("[data-fpo-role]")) assert.match(slot.textContent!, /FPO · Preview only/);
  }
  const home = new JSDOM(renderToStaticMarkup(<ManagedSitePageView page={recommendedPage("/")} />)).window.document;
  assert.equal(home.querySelector('.p-hero')?.getAttribute("data-family"), "service-illustrated");
  assert.equal(home.querySelectorAll('.p-service-diagram li').length, 3);
  const review = new JSDOM(renderToStaticMarkup(<ManagedSitePageView page={recommendedPage("/review")} />)).window.document;
  assert.equal(review.querySelectorAll('.p-artifact-priorities li').length, 3);
});
test("recommended semantic palette supports safe text and Action relationships", () => {
  const p = validatePalette(mioPagesPreview.designConfiguration.palette);
  for (const role of ["light", "strong", "tonal", "brand", "supporting", "contrast"] as const) assert.ok(contrast(p[role].background, p[role].text) >= 4.5);
  for (const role of ["light", "strong", "tonal", "supporting"] as const) assert.ok(contrast(p.brand.background, p[role].background) >= 4.5);
});
