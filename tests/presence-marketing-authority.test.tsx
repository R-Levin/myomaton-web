import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { fingerprint } from "../lib/platform/canonical/model";
import type { WorkflowContext, WorkflowRun } from "../lib/platform/intake/presence-workflow";
import { exposesInternalCopy, marketingCitationIds, marketingProjection, qualityCriteria, qualityPass,
  validateMarketingAuthority, type MarketingAuthority, type QualityReview } from "../lib/platform/intake/presence-marketing-authority";
import { marketResearchInput, marketSources, validateMarketSearch, type MarketSearch } from "../lib/platform/intake/presence-workflow-research";
import { c0MarketingEditorial } from "../lib/platform/intake/c0-marketing-editorial";
import { draftBrand } from "../lib/platform/wordpress-delivery/draft-brand";
import { focusMioPagesPreview } from "../scripts/customer-previews/miopages-focus";

const scope = { webPresenceId: "d1d4c09a-b098-4e80-9c1a-af44db7c1b3c", managedSiteId: "3015abd9-232e-4bcc-a58c-bf4ff45fcad5" };
const offer = "An Operator manages launch and ongoing improvements.";
const internal = "The old development preview still has no automated handoff";
const market = "A competitor observation about demand";
const base = { reference: "private-custody", date: null, label: "Fixture" };
const context: WorkflowContext = { scope, intakeId: "fixture", entry: "DIRECT_START", limitations: [internal], conflicts: [internal],
  evidence: [
    { ...base, id: "staffed", kind: "service-direction", content: offer },
    { ...base, id: "tooling", kind: "owner-confirmed", content: internal },
    { ...base, id: "market", kind: "website-observation", content: market },
  ] };
const sources = context.evidence.map(fingerprint);
const authority: MarketingAuthority = { contextDigest: fingerprint(context),
  sources: [{ digest: sources[0], use: "staffed-offer" }, { digest: sources[1], use: "excluded" }, { digest: sources[2], use: "analysis" }],
  brandDigest: fingerprint("reviewed fixture brand"), brandBrief: "Example approved design brief", qualityReviewerId: "reviewer" };
function run(operation: WorkflowRun["work"]["operation"]): WorkflowRun {
  const input: WorkflowRun["input"] = { ...context, research: null, corrections: [], direction: null, blueprint: null, pages: [],
    report: { title: "Contaminated derived report", summary: internal, findings: [] } };
  return { context, input, work: { operation, inputDigest: fingerprint(input), attempt: "fixture", until: 0, path: "/" } };
}

test("buyer drafting sends only explicitly approved copy authority and no raw research, internal context or stale derived prose", () => {
  validateMarketingAuthority(authority, fingerprint(context), sources);
  const buyer = JSON.stringify(marketingProjection(run("page"), authority));
  assert.ok(buyer.includes(offer));
  for (const forbidden of [internal, market, "private-custody", "Contaminated derived report"]) assert.ok(!buyer.includes(forbidden));
  assert.deepEqual(marketingCitationIds(run("page"), authority), ["staffed"]);
  const strategy = JSON.stringify(marketingProjection(run("direction"), authority));
  assert.ok(strategy.includes(market));
  assert.ok(!strategy.includes("private-custody"));
  assert.deepEqual(marketingCitationIds(run("direction"), authority), ["staffed", "market"]);
  assert.equal(exposesInternalCopy({ sections: [{ body: "Visit us. " + internal + "." }] }, context.evidence, authority), true);
  assert.equal(exposesInternalCopy({ sections: [{ body: offer }] }, context.evidence, authority), false);
});

test("authority refuses changed case versions, missing classifications and market material relabeled as a visitor claim", () => {
  assert.throws(() => validateMarketingAuthority(authority, fingerprint("other case"), sources));
  assert.throws(() => validateMarketingAuthority({ ...authority, sources: authority.sources.slice(1) }, fingerprint(context), sources));
  assert.throws(() => marketingProjection(run("page"), { ...authority, sources: authority.sources.map(source =>
    source.use === "analysis" ? { ...source, use: "staffed-offer" } : source) }), /cannot authorize/);
  const changed = run("page");
  changed.input.evidence = [{ ...changed.input.evidence[0], content: "Different offer" }, ...changed.input.evidence.slice(1)];
  assert.throws(() => marketingProjection(changed, authority), /source changed/);
});

test("an incomplete, duplicated, stale or negative independent decision cannot pass", () => {
  const target = fingerprint("candidate with exact approved media");
  const review: QualityReview = { target, desktopEvidence: fingerprint("one"), mobileEvidence: fingerprint("two"),
    findings: qualityCriteria.map(criterion => ({ criterion, status: "pass", observation: "Inspected this candidate in a fixture." })) };
  assert.ok(qualityPass(review, target));
  assert.throws(() => qualityPass(review, fingerprint("changed image")), /desktop and mobile/);
  assert.throws(() => qualityPass({ ...review, mobileEvidence: review.desktopEvidence }, target));
  assert.throws(() => qualityPass({ ...review, findings: review.findings.slice(1) }, target));
  assert.equal(qualityPass({ ...review, findings: [{ ...review.findings[0], status: "revise" }, ...review.findings.slice(1)] }, target), false);
});

test("market scope separates the public research purposes and refuses superficial completed-search coverage", () => {
  const search: MarketSearch = { publicQuery: "Market for managed small business websites", maxToolCalls: 6, minimumNewOrigins: 1, maxSources: 6,
    questions: {
      "buying-needs": "What small businesses expect when buying managed websites",
      "alternatives": "How managed studios differ from self service and agencies",
      "objections": "Reported frustrations with website access and ownership",
      "search-and-content": "Common search questions for small business website help",
      "launch-and-ongoing": "How ongoing improvements create value after site launch",
    } };
  validateMarketSearch(search);
  assert.match(marketResearchInput(search), /launch-and-ongoing/);
  assert.throws(() => validateMarketSearch({ ...search, maxToolCalls: 4 }));
  assert.throws(() => marketSources({ output: [{ type: "web_search_call", status: "completed",
    action: { sources: [{ type: "url", url: "https://example.org/" }] } }] }, [], search), /too few completed search passes/);
});

test("the C0 authority pack binds exact R3 page references and excludes both development notes", () => {
  const { pages, sources } = c0MarketingEditorial();
  assert.equal(pages.length, 7);
  assert.deepEqual(sources.map(source => source.digest), pages.map(fingerprint));
  assert.ok(sources.every(source => source.use === "editorial"));
  assert.doesNotMatch(JSON.stringify(pages), /developmentNotes|development note:/iu);
});

test("the accepted design produces a hash-bound portable brand from the exact original PNG", () => {
  const c0 = focusMioPagesPreview;
  const logo = { assetId: "78bd24e7-180c-423f-a1e1-2e857ea3b484", usageId: "5924ea47-a333-47d6-89b2-a394c0d749fb",
    sha256: createHash("sha256").update(readFileSync("brand/miopages/MioPagesDV.png")).digest("hex"), alt: "MioPages" };
  const input = { scope, logo, design: c0.designConfiguration, visualDirection: c0.siteConfiguration.visualDirection };
  const brand = draftBrand(input);
  assert.equal(logo.sha256, "09b1d3c6e189ce74538d75be63386116be0dee464d6b70d86577430963d91b5e");
  assert.equal(brand.projection.design.palette.brand.background, "#322f7e");
  assert.equal(brand.projection.design.palette.light.background, "#fbf7ef");
  assert.equal(brand.projection.design.typography.baseSize, 18);
  assert.equal(brand.projection.design.motion, "off");
  assert.notEqual(brand.digest, draftBrand({ ...input, scope: { ...scope, managedSiteId: "26fd41e8-592b-4fb0-8d5b-72993831888d" } }).digest);
  assert.throws(() => draftBrand({ ...input, logo: { ...logo, sha256: "external asset" } }));
  assert.throws(() => draftBrand({ ...input, design: { ...c0.designConfiguration,
    typography: { ...(c0.designConfiguration.typography as object), bodyFont: "url(https://example.org)" } } }));
});
