import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fingerprint } from "../lib/platform/canonical/model";
import { artifactLineage, projectRetainedSite, historicalRetainedReview, type RetainedSiteReview } from "../lib/platform/intake/retained-site-review";
import {workflowLocalDraftInput} from "../lib/platform/intake/presence-workflow-delivery";
import type { WorkflowContext, PresenceWorkflowView } from "../lib/platform/intake/presence-workflow";
import type { MarketingAuthority } from "../lib/platform/intake/presence-marketing-authority";
import { validateWordPressReviewObservation, wordpressDraftReviewUrl } from "../lib/platform/intake/wordpress-review-observation";

const context: WorkflowContext = { scope: { webPresenceId: "owned-presence", managedSiteId: "owned-site" }, intakeId: "owned-intake", entry: "DIRECT_START",
  evidence: [{ id: "offer", kind: "owner-confirmed", label: "The managed service", reference: "Owner record", date: null, content: "Useful Launch and Ongoing service." },
    { id: "opinion", kind: "customer-unconfirmed", label: "Unconfirmed idea", reference: "Draft answer", date: null, content: "Unverified claim." }], limitations: [], conflicts: [] };
const authority: MarketingAuthority = { contextDigest: fingerprint(context), brandDigest: "a".repeat(64), brandBrief: "Recorded brand", qualityReviewerId: "existing-reviewer",
  sources: context.evidence.map((source, i) => ({ digest: fingerprint(source), use: i === 0 ? "staffed-offer" : "analysis" })) };
const page = { path: "/", heading: "Managed presence", sections: [{ heading: "A coherent service", body: "Earlier wording", sourceIds: ["offer"] }], actions: [], internalLinks: [] };
const previous = { version: 97, contextDigest: fingerprint(context), pages: [page], blueprint: { pages: [{ path: "/", label: "Home", purpose: "Explain the managed service" }], navigation: ["/"], articles: [] },
  report: { title: "Business understanding", summary: "A retained AI assessment.", findings: [] }, direction: null, editorial: null } as unknown as PresenceWorkflowView;
const current = { ...previous, version: 106, pages: [{ ...page, sections: [{ ...page.sections[0], body: "Revised wording" }] }] } as unknown as PresenceWorkflowView;

test("historical complete drafts remain previewable after the current candidate receives a critique",()=>{
 const evaluationContext={...context,intakeId:"33333333-3333-4333-8333-333333333333",
  scope:{webPresenceId:"11111111-1111-4111-8111-111111111111",managedSiteId:"22222222-2222-4222-8222-222222222222"},
  evaluation:{scenario:"c0" as const,basis:fingerprint("isolated preview")}};
 const digest=fingerprint(evaluationContext),snapshot={...previous,contextDigest:digest,work:null,failure:null};
 const latest={...current,contextDigest:digest,version:131,next:"editorial-review" as const,canRenderForEditorial:undefined,
  editorial:{summary:"Latest critique",concerns:[]}};
 const before=fingerprint({snapshot,latest}),view=historicalRetainedReview(latest,snapshot);
 assert.equal(view.version,97);assert.equal(view.next,"editorial");assert.equal(view.canRenderForEditorial,true);
 assert.equal(view.canQueueEditorialRevision,false);assert.equal(view.deliveryQuality,undefined);
 const copy=workflowLocalDraftInput(evaluationContext,view).pages[0].sections[0].text;
 assert.ok(copy?.kind==="editorial");assert.equal(copy.text,"Earlier wording");
 assert.equal(fingerprint({snapshot,latest}),before);
 for(const changed of [{...snapshot,pages:[]},{...snapshot,work:{operation:"page"}},{...snapshot,failure:"output-invalid" as const}]){
  const refused=historicalRetainedReview(latest,changed);assert.equal(refused.canRenderForEditorial,undefined);
  assert.throws(()=>workflowLocalDraftInput(evaluationContext,refused));
 }
 assert.throws(()=>historicalRetainedReview(latest,{...snapshot,contextDigest:fingerprint("foreign")}));
});

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
test("revising a Page retains the earlier critique without silently resolving it", () => {
  const editorial = { summary: "Controlled earlier critique", concerns: [{ path: "/", concern: "Controlled concern still needs recheck" }] };
  const critique = { version: 97, contextDigest: fingerprint(context), editorial, pages: previous.pages };
  const review = projectRetainedSite(context, current, previous, authority, history, critique);
  assert.deepEqual(review.lastCritique?.editorial, editorial);
  assert.deepEqual(review.lastCritique?.changedPaths, ["/"]);
  assert.equal(review.lastCritique?.version, 97);
  assert.equal(review.editorial, null);
  assert.throws(() => projectRetainedSite(context, current, previous, authority, history, { ...critique, contextDigest: "foreign" }));
  assert.throws(() => projectRetainedSite(context, current, previous, authority, history, { ...critique, version: 107 }));
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
  assert.match(html, /Temporary review guide/);
  assert.match(html, /Source records, AI interpretations and unconfirmed ideas remain distinct/);
});

test("WordPress observation cannot redirect review to another origin or imply live delivery", () => {
  const observation = { kind: "wordpress-review-observation/1", observedAt: "2026-11-21T17:00:00Z",
    installationId: "d84ebc69-46d5-4c64-adc6-ac7b87468f89", revision: 6, candidateDigest: "a".repeat(64),
    pluginVersion: "0.0.12", themeVersion: "0.1.0", pages: [{ path: "/", postId: 13 }] };
  assert.deepEqual(validateWordPressReviewObservation(observation), observation);
  assert.equal(wordpressDraftReviewUrl(13), "https://miopages.org/?page_id=13&preview=true");
  for (const invalid of [{ ...observation, installationId: "foreign" }, { ...observation, candidateDigest: "wrong" },
    { ...observation, pages: [{ path: "//other.example", postId: 13 }] }, { ...observation, pages: [observation.pages[0], observation.pages[0]] },
    { ...observation, pages: [{ path: "/", postId: -1 }] }]) assert.throws(() => validateWordPressReviewObservation(invalid));
  assert.throws(() => wordpressDraftReviewUrl(NaN));
});
