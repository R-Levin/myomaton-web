import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { fingerprint } from "../lib/platform/canonical/model";
import { compileRebuiltRun, rebuiltRunPlan } from "../lib/platform/intake/c0-rebuilt-run";
import { emptyResponsesUsageLedger } from "../lib/platform/intake/intelligent-responses";
import type { WorkflowContext } from "../lib/platform/intake/presence-workflow";
import type { PresenceWorkflowGrant } from "../lib/platform/intake/presence-workflow-provider";
import type { MarketingAuthority } from "../lib/platform/intake/presence-marketing-authority";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
function prior() {
  const service = "MioPages provides one managed Web Presence service.";
  const reference = { label: "Fixture", reference: "fixture", date: "2026-11-19" };
  const context: WorkflowContext = { intakeId: rebuiltRunPlan.knowledgeFrom.intakeId, entry: "DIRECT_START",
    scope: { webPresenceId: "2a08e054-902c-400b-9b96-3c2274bcadc2", managedSiteId: "2c0d637d-4ded-4597-ac8b-661519aba358" },
    limitations: [], conflicts: [], evaluation: { scenario: "c0", basis: sha("prior") },
    evidence: [{ ...reference, id: "service", kind: "owner-confirmed", content: service }] };
  const digest = fingerprint(context);
  const authority: MarketingAuthority = { projectionVersion: 2, contextDigest: digest,
    sources: [{ digest: fingerprint(context.evidence[0]), use: "business-fact" }],
    sourceSelections: [{ digest: fingerprint(context.evidence[0]), passages: [service] }],
    brandDigest: sha("brand"), brandBrief: "Brand inputs.", qualityReviewerId: "reviewer", strategy: { version: 1, peerIds: [], discoveredPeers: true } };
  const original = { id: "brief", sha256: sha("brief"), bytes: 5, mime: "text/markdown" as const, reference: "docs/brief.md",
    author: "Owner", date: "2026-11-19", status: "owner-confirmed" as const, purpose: "business-context" as const, operations: ["report" as const] };
  const grant = { contextDigest: digest, approvedSources: [fingerprint(context.evidence[0])], approvedCorrections: [], marketingAuthority: authority,
    originalMaterials: { version: 1, contextDigest: digest, records: [original], requestBytes: 1_000_000 },
    previewActionDestinations: { "request-review": "/free-review", "start-onboarding": "/direct-start" },
    researchSources: [], researchResponseBytes: 1, maxOutputTokens: 1, expiresAt: 0,
    ledger: { id: sha("old"), startingLedger: sha("old"), baselineAttempts: 9, requests: 2, generations: 1, capMicros: 1, inputTokens: 1, inputBytes: 1 } } as unknown as PresenceWorkflowGrant;
  return { context, grant };
}

test("the rebuilt test case inherits knowledge only, under a new identity, with the $25 ceiling as the real limit", () => {
  const before = prior();
  const { context, grant } = compileRebuiltRun(before, 1_000);
  assert.equal(context.intakeId, rebuiltRunPlan.destination.intakeId);
  assert.deepEqual(context.scope, rebuiltRunPlan.destination.scope);
  assert.deepEqual(context.evidence, before.context.evidence, "knowledge carries over unchanged");
  assert.equal(grant.contextDigest, fingerprint(context));
  assert.equal(grant.marketingAuthority?.contextDigest, fingerprint(context));
  assert.equal(grant.ledger.capMicros, 25_000_000);
  assert.equal(grant.ledger.baselineAttempts, 0, "a fresh ledger, not a continuation of the old one");
  assert.equal(grant.ledger.startingLedger, sha(JSON.stringify(emptyResponsesUsageLedger(rebuiltRunPlan.provider.rates)) + "\n"));
  assert.ok(grant.ledger.generations >= 100 && grant.ledger.requests >= 200, "counters are generous");
  assert.equal(grant.marketSearch?.maxToolCalls, 10);
  assert.equal(grant.reviewSequence, "site-first");
  assert.equal(grant.sourceRepair, undefined, "no Codex-era repair authorization carries over");
  assert.equal(grant.expiresAt, 1_000 + 72 * 3_600_000);
  assert.throws(() => compileRebuiltRun({ ...before, context: { ...before.context, intakeId: rebuiltRunPlan.destination.intakeId } }));
  assert.throws(() => compileRebuiltRun({ context: before.context, grant: { ...before.grant, contextDigest: sha("other") } }));
});
