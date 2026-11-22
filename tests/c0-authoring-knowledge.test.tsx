import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import { fingerprint } from "../lib/platform/canonical/model";
import { proposeC0AuthoringKnowledge } from "../lib/platform/intake/c0-authoring-knowledge";
import { p022CandidateInputs } from "../lib/platform/intake/c0-p022-source-pack";
import { marketingCitationIds, marketingProjection } from "../lib/platform/intake/presence-marketing-authority";
import type { WorkflowRun } from "../lib/platform/intake/presence-workflow";

const documents = { businessBrief: readFileSync("docs/miopages-c0-business-brief.md", "utf8"),
  productModel: readFileSync("docs/miopages-c0-product-model.md", "utf8") };
function previous() {
  return p022CandidateInputs(readFileSync("docs/c0-generation-p0-22-sources.json"),
    { brandDigest: "b".repeat(64), qualityReviewerId: "offline-reviewer" });
}

test("actual canonical C0 growth proposition enters a new source-aware proposal without changing historical knowledge or authorization", () => {
  const before = previous(), original = fingerprint(before);
  const result = proposeC0AuthoringKnowledge(before.context, before.authority, documents);
  assert.equal(fingerprint(before), original);
  assert.equal(result.requiresFreshGrant, true);
  assert.notEqual(result.context.scope, undefined);
  assert.deepEqual(result.context.scope, before.context.scope);
  assert.notEqual(fingerprint(result.context), fingerprint(before.context));
  assert.notEqual(fingerprint(result.authority), fingerprint(before.authority));
  assert.deepEqual(result.context.evidence.slice(0, before.context.evidence.length), before.context.evidence);
  const input: WorkflowRun["input"] = { ...result.context, research: [], report: null, direction: null, blueprint: null, pages: [], corrections: [] };
  const run: WorkflowRun = { context: result.context, input,
    work: { operation: "direction", until: 0, attempt: "offline-canonical", inputDigest: fingerprint(input) } };
  const projected = marketingProjection(run, result.authority) as { businessKnowledge: { id: string; kind: string; content: string }[] };
  const additions = projected.businessKnowledge.filter(source => source.id.startsWith("c0-canonical:"));
  assert.equal(additions.length, result.coverage.length);
  const all = additions.map(source => source.content).join("\n");
  for (const phrase of ["find the business", "content recommendations", "conversion-path refinement", "plain-language progress/value reports",
    "business-knowledge updates", "content/optimization work", "measurement", "human/customer approval",
    // Ongoing's core value statement and the growth-loop proof obligation (previously omitted).
    "keeps helping your presence get better", "retention should come from useful progress", "commercial topics and lead-generation intent"]) assert.ok(all.includes(phrase), phrase);
  // Cross-references and implementation-status notes remain outside claim passages.
  assert.doesNotMatch(all, /remain subject to their implementation status|\]\(content-growth-loop\.md\)/);
  assert.ok(additions.every(source => source.kind === "service-direction"));
  assert.doesNotMatch(all, /\$1,095|\$249|already working|GA4|Search Console remains unrun|The optional early C0/);
  assert.ok(result.coverage.every(row => /^[a-f0-9]{64}$/.test(row.documentDigest!)));
  const policy = result.authority.processingInstructions!.at(-1)!;
  assert.match(policy.text, /not proof/);
  assert.ok(!all.includes(policy.text));
  // Page-level availability uses the complete proposed same-case knowledge, not the legacy ten-record pack alone.
  const pageRun = { ...run, work: { ...run.work, operation: "page" as const } };
  assert.ok(result.coverage.every(row => marketingCitationIds(pageRun, result.authority).includes(row.id)));
});

test("C2, changed documents, duplicate addition and old-context use cannot silently consume the C0 proposal", () => {
  const before = previous();
  assert.throws(() => proposeC0AuthoringKnowledge({ ...before.context, evaluation: { ...before.context.evaluation!, scenario: "c2" } },
    before.authority, documents), /another evaluation/);
  assert.throws(() => proposeC0AuthoringKnowledge(before.context, before.authority,
    { ...documents, productModel: documents.productModel.replace("## Continuing value after launch", "## Removed heading") }), /Exact canonical/);
  const first = proposeC0AuthoringKnowledge(before.context, before.authority, documents);
  assert.throws(() => proposeC0AuthoringKnowledge(first.context, first.authority, documents), /already present/);
  const input: WorkflowRun["input"] = { ...before.context, research: [], report: null, direction: null, blueprint: null, pages: [], corrections: [] };
  assert.throws(() => marketingProjection({ context: before.context, input,
    work: { operation: "report", until: 0, attempt: "old-grant", inputDigest: fingerprint(input) } }, first.authority), /source changed|does not match/);
});

test("canonical bytes remain exact and line-ending differences do not change the proposed meaning", () => {
  const before = previous();
  const first = proposeC0AuthoringKnowledge(before.context, before.authority, documents);
  const reformatted = { businessBrief: documents.businessBrief.replaceAll("\r\n", "\n").replaceAll("\n", "\r\n"),
    productModel: documents.productModel.replaceAll("\r\n", "\n").replaceAll("\n", "\r\n") };
  const normalized = proposeC0AuthoringKnowledge(before.context, before.authority, reformatted);
  assert.deepEqual(first.coverage.map(row => row.selectedDigest), normalized.coverage.map(row => row.selectedDigest));
  assert.equal(normalized.coverage[0].documentDigest, createHash("sha256").update(reformatted.productModel).digest("hex"));
  assert.equal(first.coverage[0].documentDigest, createHash("sha256").update(documents.productModel).digest("hex"));
  for (const selection of first.authority.sourceSelections!.filter(row => !before.authority.sources.some(old => old.digest === row.digest))) {
    const source = first.context.evidence.find(row => fingerprint(row) === selection.digest)!;
    assert.ok(selection.passages.every(passage => source.content.includes(passage)));
  }
});
