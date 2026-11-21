import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fingerprint } from "../lib/platform/canonical/model";
import { artifactLineage, projectRetainedSite, type RetainedSiteReview } from "../lib/platform/intake/retained-site-review";
import type { WorkflowContext, PresenceWorkflowView } from "../lib/platform/intake/presence-workflow";
import type { MarketingAuthority } from "../lib/platform/intake/presence-marketing-authority";

const context: WorkflowContext = { scope: { webPresenceId: "owned-presence", managedSiteId: "owned-site" }, intakeId: "owned-intake", entry: "DIRECT_START",
  evidence: [{ id: "offer", kind: "owner-confirmed", label: "The managed service", reference: "Owner record", date: null, content: "Useful Launch and Ongoing service." },
    { id: "opinion", kind: "customer-unconfirmed", label: "Unconfirmed idea", reference: "Draft answer", date: null, content: "Unverified claim." }], limitations: [], conflicts: [] };
const authority: MarketingAuthority = { contextDigest: fingerprint(context), brandDigest: "a".repeat(64), brandBrief: "Recorded brand", qualityReviewerId: "existing-reviewer",
  sources: context.evidence.map((source, i) => ({ digest: fingerprint(source), use: i === 0 ? "staffed-offer" : "analysis" })) };
const page = { path: "/", heading: "Managed presence", sections: [{ heading: "A coherent service", body: "Earlier wording", sourceIds: ["offer"] }], actions: [], internalLinks: [] };
const previous = { version: 97, contextDigest: fingerprint(context), pages: [page], blueprint: { pages: [{ path: "/", label: "Home", purpose: "Explain the managed service" }], navigation: ["/"], articles: [] },
  report: { title: "Business understanding", summary: "A retained AI assessment.", findings: [] }, direction: null, editorial: null } as unknown as PresenceWorkflowView;
const current = { ...previous, version: 106, pages: [{ ...page, sections: [{ ...page.sections[0], body: "Revised wording" }] }] } as unknown as PresenceWorkflowView;

test("actual source-refresh chronology does not falsely label regenerated report and Direction stale", () => {
  const result = artifactLineage([
    { version: 70, context: "old", report: "report-old", direction: "direction-old", blueprint: "plan-old" },
    { version: 71, context: "new", report: "report-old", direction: "direction-old", blueprint: "plan-old" },
    { version: 73, context: "new", report: "report-new", direction: "direction-old", blueprint: "plan-old" },
    { version: 76, context: "new", report: "report-new", direction: "direction-new", blueprint: "plan-old" },
    { version: 78, context: "new", report: "report-new", direction: "direction-new", blueprint: "plan-new" },
  ]);
  assert.equal(result.evidenceVersion, 71);
  assert.equal(result.report.predatesEvidence, false); assert.equal(result.direction.predatesEvidence, false);
  assert.equal(result.blueprint.predatesEvidence, false);
});
test("fresh global context does not by itself establish fresh report or strategy", () => {
  const result = artifactLineage([{ version: 1, context: "old", report: "report", direction: "direction", blueprint: "plan" },
    { version: 2, context: "new", report: "report", direction: "direction", blueprint: "plan" }]);
  assert.equal(result.report.predatesEvidence, true); assert.equal(result.direction.predatesEvidence, true);
  assert.throws(() => artifactLineage([{ version: 1, context: "old", report: null, direction: null, blueprint: null },
    { version: 1, context: "new", report: null, direction: null, blueprint: null }]));
});
const history = [{ version: 97, context: fingerprint(context), report: "same-report", direction: null, blueprint: "same-plan" },
  { version: 106, context: fingerprint(context), report: "same-report", direction: null, blueprint: "same-plan" }];
test("review keeps original and revised copy exact, preserves source status and grants no mutation authority", () => {
  const original = fingerprint({ context, current, previous, authority });
  const review = projectRetainedSite(context, current, previous, authority, history);
  assert.equal(review.readonly, true); assert.equal(review.origin, "retained-core-ai");
  assert.equal(review.understanding.length, 1); assert.equal(review.understanding[0].content, context.evidence[0].content);
  assert.equal(review.references[1].kind, "customer-unconfirmed");
  assert.equal(review.changes[0].before?.sections[0].body, "Earlier wording");
  assert.equal(review.changes[0].after.sections[0].body, "Revised wording");
  assert.equal(fingerprint({ context, current, previous, authority }), original);
});
test("foreign context, swapped authority and a same-version comparison are refused", () => {
  assert.throws(() => projectRetainedSite({ ...context, intakeId: "other-customer" }, current, previous, authority, history));
  assert.throws(() => projectRetainedSite(context, current, previous, { ...authority, contextDigest: "other-context" }, history));
  assert.throws(() => projectRetainedSite(context, current, { ...previous, version: 106 }, authority, history));
});
test("current review is a readable business/site journey without fake generation or approval controls", async () => {
  const result = await build({ entryPoints: ["scripts/intake/current-site-review-panel.tsx"], bundle: true, write: false,
    platform: "node", format: "cjs", jsx: "automatic", packages: "external", loader: { ".module.css": "empty" } });
  const compiled: { exports: { CurrentSiteReviewPanel?: ComponentType<{ review: RetainedSiteReview; preview: () => Promise<string> }> } } = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(compiled, compiled.exports, createRequire(import.meta.url));
  const review = projectRetainedSite(context, current, previous, authority, history);
  const html = renderToStaticMarkup(createElement(compiled.exports.CurrentSiteReviewPanel!, { review, preview: async () => "" }));
  assert.match(html, /Business understanding/); assert.match(html, /Website proposal/); assert.match(html, /Changes and open decisions/);
  assert.match(html, /A retained AI assessment/); assert.match(html, /latest changes not applied to WordPress/);
  assert.doesNotMatch(html, /proposed pages drafted|Record Operator site review|Confirm this report|Queue reassessment/);
  assert.match(html, /Saved AI proposal/);
});
