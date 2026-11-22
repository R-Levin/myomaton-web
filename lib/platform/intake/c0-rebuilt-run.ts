/**
 * First test of the rebuilt Core (2026-11-22): a fresh C0 evaluation case.
 *
 * Replaces the Codex-era activation chain (pinned proposal hashes, old-ledger
 * continuation, separate worker certificates) with one plain plan file
 * (docs/c0-rebuilt-run.json) and the spending ceiling as the only real limit. The
 * new case inherits the previous source-aware case's knowledge context and authority
 * read-only; none of its report, Direction, plan or pages carry over. Approval is the
 * owner's, recorded in docs/owner-critical-conversations.md; this file records scope.
 */
import { createHash } from "node:crypto";
import plan from "../../../docs/c0-rebuilt-run.json";
import { fingerprint, uuid } from "../canonical/model";
import { emptyResponsesUsageLedger, validateWorkflowStagePlan, type WorkflowStagePlan } from "./intelligent-responses";
import { validateMarketingAuthority } from "./presence-marketing-authority";
import { validateOriginalGrant } from "./presence-source-material";
import { validateMarketSearch, validateResearchSources } from "./presence-workflow-research";
import type { WorkflowContext } from "./presence-workflow";
import type { PresenceWorkflowGrant } from "./presence-workflow-provider";

export type RebuiltRunPlan = typeof plan;
/** The evaluation worker's approval argument for this run. A name, not a hash. */
export const rebuiltRunApproval = "rebuilt-2026-11-22";
export const rebuiltRunPlan = plan;
const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

export function validateRebuiltRunPlan(value: RebuiltRunPlan = plan) {
  const ids = [value.destination.organizationId, value.destination.intakeId, ...Object.values(value.destination.scope)].map(uuid);
  if (new Set(ids).size !== ids.length || ids.includes(value.knowledgeFrom.intakeId) || value.destination.entry !== "DIRECT_START" ||
      value.provider.store !== false || !Number.isSafeInteger(value.budget.capMicros) || value.budget.capMicros < 1 ||
      value.budget.capMicros > 25_000_000 || value.limits.hours < 1 || value.limits.hours > 72 ||
      value.limits.providerRequests < 2 * value.limits.textGenerations) throw Error("Rebuilt run plan refused");
  return value;
}

/** Build the new case's context and grant. Pure: no database, files or provider calls. */
export function compileRebuiltRun(prior: { context: WorkflowContext; grant: PresenceWorkflowGrant }, now = Date.now()) {
  const p = validateRebuiltRunPlan();
  if (prior.context.intakeId !== p.knowledgeFrom.intakeId || prior.context.evaluation?.scenario !== "c0" ||
      fingerprint(prior.context) !== prior.grant.contextDigest || !prior.grant.marketingAuthority ||
      prior.grant.marketingAuthority.projectionVersion !== 2 || !prior.grant.originalMaterials) {
    throw Error("Previous source-aware C0 case knowledge required");
  }
  validateMarketingAuthority(prior.grant.marketingAuthority, prior.grant.contextDigest, prior.context.evidence.map(fingerprint));
  const context: WorkflowContext = { ...structuredClone(prior.context), intakeId: p.destination.intakeId,
    scope: structuredClone(p.destination.scope), entry: "DIRECT_START",
    evaluation: { scenario: "c0", basis: sha256(JSON.stringify(p)) } };
  const contextDigest = fingerprint(context);
  const authority = { ...structuredClone(prior.grant.marketingAuthority), contextDigest };
  validateMarketingAuthority(authority, contextDigest, context.evidence.map(fingerprint));
  const originalMaterials = { ...structuredClone(prior.grant.originalMaterials), contextDigest, requestBytes: p.provider.requestBytes,
    publicResearch: { maximumRecords: p.publicResearch.maximumMaterialRecords, maximumBytes: p.publicResearch.maximumMaterialBytes, screenshots: true },
    candidateReview: structuredClone(p.review.candidateImages) as NonNullable<PresenceWorkflowGrant["originalMaterials"]>["candidateReview"] };
  validateOriginalGrant(originalMaterials, contextDigest);
  const stages = p.provider.stages as WorkflowStagePlan;
  const ledger = { id: fingerprint({ run: rebuiltRunApproval, case: p.destination }),
    startingLedger: sha256(JSON.stringify(emptyResponsesUsageLedger(p.provider.rates)) + "\n"), baselineAttempts: 0,
    requests: p.limits.providerRequests, generations: p.limits.textGenerations, capMicros: p.budget.capMicros,
    inputTokens: Math.max(...Object.values(stages).map(stage => stage.requestInputTokens)), inputBytes: p.provider.requestBytes,
    stageSpendingPolicy: "shared-aggregate" as const,
    breakdown: { text: p.limits.textGenerations, images: 0, searchCalls: p.limits.webSearchCalls }, stages };
  validateWorkflowStagePlan(stages, ledger, p.limits.webSearchCalls);
  const researchSources = p.publicResearch.roots.map((url, index) => ({ id: "research:root-" + index, url, label: new URL(url).hostname }));
  validateResearchSources(researchSources);
  const marketSearch = { publicQuery: p.publicResearch.publicQuery, maxToolCalls: p.limits.webSearchCalls,
    maxSources: p.publicResearch.maximumRetrievedSources - researchSources.length, minimumNewOrigins: p.publicResearch.minimumIndependentNewOrigins };
  validateMarketSearch(marketSearch);
  const grant: PresenceWorkflowGrant = { contextDigest, approvedSources: context.evidence.map(fingerprint), approvedCorrections: [],
    approvedRevisionFeedback: [], marketingAuthority: authority, originalMaterials, nativeComponents: 2, siteComposition: "managed-v1",
    reviewSequence: "site-first", ...(prior.grant.previewActionDestinations && { previewActionDestinations: structuredClone(prior.grant.previewActionDestinations) }),
    researchSources, researchResponseBytes: p.publicResearch.maximumResponseBytes, marketSearch,
    maxOutputTokens: Math.max(...Object.values(stages).map(stage => stage.requestOutputTokens)),
    maxRetries: p.limits.retries, maxEditorialRevisions: p.limits.editorialRevisionRounds, maxCommercialReplans: p.limits.commercialReplans,
    startsAt: now, expiresAt: now + p.limits.hours * 3_600_000, ledger };
  return { context, grant };
}
