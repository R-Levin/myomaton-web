import { createHash } from "node:crypto";
import proposal from "../../../docs/c0-source-aware-run-proposal.json";
import { fingerprint, uuid } from "../canonical/model";
import { proposeC0AuthoringKnowledge } from "./c0-authoring-knowledge";
import { validateMarketingAuthority } from "./presence-marketing-authority";
import { validateOriginalGrant, type OriginalMaterial } from "./presence-source-material";
import { validateMarketSearch, validateResearchSources } from "./presence-workflow-research";
import { validateWorkflowStagePlan, verifyWorkflowUsageBaseline, type WorkflowStagePlan } from "./intelligent-responses";
import type { WorkflowContext } from "./presence-workflow";
import type { PresenceWorkflowGrant } from "./presence-workflow-provider";

export type SourceAwareC0Plan = typeof proposal;
export const sourceAwareC0ProposalSha256 = "f560374969b7abdff53fa33917c9b84f7053f5f9b092b0dccf9a505bcc8f9ddd";
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const sha256 = /^[a-f0-9]{64}$/u;
export class SourceAwareRunValidation extends Error {
  readonly code: string;
  constructor(readonly stage: "manifest" | "activation" | "source-custody" | "knowledge" | "usage-baseline" | "reviewer" | "database", detail: string) {
    super(detail);
    this.name = "SourceAwareRunValidation";
    this.code = "SOURCE_AWARE_" + stage.toUpperCase().replaceAll("-", "_");
  }
}

export function readSourceAwareC0Plan(bytes: Buffer) {
  if (hash(bytes) !== sourceAwareC0ProposalSha256 || fingerprint(JSON.parse(bytes.toString("utf8"))) !== fingerprint(proposal)) {
    throw new SourceAwareRunValidation("manifest", "Exact source-aware C0 proposal required");
  }
  validateSourceAwareC0Plan(proposal);
  return structuredClone(proposal);
}

export function validateSourceAwareC0Plan(plan: SourceAwareC0Plan) {
  const ids = [plan.destination.organizationId, plan.destination.intakeId, ...Object.values(plan.destination.scope)].map(uuid);
  if (plan.status !== "PROPOSED_NOT_AUTHORIZED" || new Set(ids).size !== ids.length || ids.includes(plan.preserve.previousIntakeId) ||
      plan.destination.entry !== "DIRECT_START" || plan.authority.automaticRetries !== 0 || plan.authority.stageSpendingPolicy !== "shared-aggregate" ||
      plan.authority.additionalProviderCapMicros + plan.preserve.previousDebitMicros !== plan.authority.cumulativeAccountedCeilingMicros ||
      plan.provider.model !== "gpt-5.4-2026-03-05" || plan.provider.store !== false ||
      ![plan.preserve.previousLedgerSha256, plan.preserve.previousContextDigest].every(value => sha256.test(value)) ||
      !Number.isSafeInteger(plan.preserve.baselineAttempts) || plan.preserve.baselineAttempts < 1 ||
      plan.authority.maximumProviderRequests < 2 * plan.authority.maximumTextGenerations ||
      plan.authority.maximumHoursAfterVerifiedActivation < 1 || plan.authority.maximumHoursAfterVerifiedActivation > 72 ||
      plan.media.newDownloads !== 0 || plan.media.newProviderSearches !== 0 || plan.media.newImageGenerations !== 0) {
    throw new SourceAwareRunValidation("manifest", "Source-aware C0 scope or budget differs");
  }
  const limits = [
    [plan.authority.additionalProviderCapMicros, 8_000_000], [plan.authority.maximumTextGenerations, 32],
    [plan.authority.maximumProviderRequests, 65], [plan.authority.maximumPaidWebSearchCalls, 8],
    [plan.authority.maximumDeliberateRetries, 3], [plan.authority.maximumEditorialRevisionRounds, 4],
    [plan.authority.maximumCommercialReplans, 2],
  ];
  if (limits.some(([value, ceiling]) => !Number.isSafeInteger(value) || value < 1 || value > ceiling) ||
      Object.values(plan.provider.stages).some(stage => fingerprint(stage.rates) !== fingerprint(plan.provider.rates))) throw new SourceAwareRunValidation("manifest", "Exact reviewed per-run ceilings and model rates required");
  const cost = plan.provider.costBasis;
  const estimate = Math.ceil((cost.uncachedInputTokens * plan.provider.rates.inputPerMillion +
    cost.outputTokens * plan.provider.rates.outputPerMillion) / 1_000_000) + cost.searchCalls * 10_000;
  if (estimate !== cost.usageEstimateMicros ||
      estimate + cost.deliberateCorrectionContingencyMicros !== plan.authority.additionalProviderCapMicros) throw new SourceAwareRunValidation("manifest", "C0 cost basis differs");
  validateWorkflowStagePlan(plan.provider.stages as WorkflowStagePlan, {
    id: "proposal-only", stageSpendingPolicy: "shared-aggregate", startingLedger: plan.preserve.previousLedgerSha256, baselineAttempts: plan.preserve.baselineAttempts,
    requests: plan.authority.maximumProviderRequests, generations: plan.authority.maximumTextGenerations,
    capMicros: plan.authority.additionalProviderCapMicros, inputTokens: Math.max(...Object.values(plan.provider.stages).map(stage => stage.requestInputTokens)),
    inputBytes: plan.provider.requestBytes, breakdown: { text: plan.authority.maximumTextGenerations, images: 0, searchCalls: plan.authority.maximumPaidWebSearchCalls },
  }, plan.authority.maximumPaidWebSearchCalls);
}

export type SourceAwareC0Activation = {
  proposalSha256: string;
  approvalRecord: number;
  artifactSha256: string;
  linuxProofSha256: string;
  startsAt: number;
  reviewerId: string;
  reviewerCredentialExpiresAt: number;
};

/** Pure compilation after the runtime has verified the owner's private activation
 * record, artifact/Linux proof and isolated reviewer credential. This function
 * creates no database records, secrets, approval events or provider requests.
 * Live callers must obtain plan from readSourceAwareC0Plan. */
export function compileSourceAwareC0(plan: SourceAwareC0Plan, activation: SourceAwareC0Activation, prior: {
  context: WorkflowContext;
  grant: PresenceWorkflowGrant;
  ledger: Buffer;
  materials: readonly { source: OriginalMaterial; bytes: Buffer }[];
  brandDigest: string;
}, now = Date.now()) {
  validateSourceAwareC0Plan(plan);
  if (activation.proposalSha256 !== sourceAwareC0ProposalSha256 || !Number.isSafeInteger(activation.approvalRecord) || activation.approvalRecord < 1 ||
      ![activation.artifactSha256, activation.linuxProofSha256, prior.brandDigest].every(value => sha256.test(value)) ||
      activation.reviewerId !== plan.review.existingReviewerId || !Number.isSafeInteger(activation.startsAt) || activation.startsAt > now ||
      (!Number.isSafeInteger(activation.reviewerCredentialExpiresAt) ||
        activation.reviewerCredentialExpiresAt > activation.startsAt + plan.authority.maximumHoursAfterVerifiedActivation * 3_600_000)) throw new SourceAwareRunValidation("activation", "Verified owner activation, artifact and reviewer required");
  const expiresAt = Math.min(activation.startsAt + plan.authority.maximumHoursAfterVerifiedActivation * 3_600_000, activation.reviewerCredentialExpiresAt);
  if (expiresAt <= now || expiresAt <= activation.startsAt) throw new SourceAwareRunValidation("activation", "Fresh C0 authorization expired");
  if (prior.context.intakeId !== plan.preserve.previousIntakeId || fingerprint(prior.context) !== plan.preserve.previousContextDigest ||
      prior.context.evaluation?.scenario !== "c0" || prior.context.evidence.length !== plan.sources.previousEvidenceRecords ||
      fingerprint(prior.context) !== prior.grant.contextDigest || !prior.grant.marketingAuthority ||
      hash(prior.ledger) !== plan.preserve.previousLedgerSha256) throw new SourceAwareRunValidation("source-custody", "Retained C0 case or immutable usage prefix differs");
  if (!prior.grant.ledger.carryForward?.reportHold) throw new SourceAwareRunValidation("usage-baseline", "Original report reservation must be carried forward");
  const oldAuthority = prior.grant.marketingAuthority;
  validateMarketingAuthority(oldAuthority, fingerprint(prior.context), prior.context.evidence.map(fingerprint));
  const expected = plan.sources.originalMaterials.map(source => ({
    id: source.id, bytes: source.bytes, sha256: source.sha256, mime: source.mime, reference: source.path,
    author: source.author, date: source.date, status: source.status, purpose: source.purpose, operations: source.operations,
  }));
  if (prior.materials.length !== expected.length || new Set(prior.materials.map(row => row.source.id)).size !== expected.length ||
      expected.some(source => !prior.materials.some(row => fingerprint(row.source) === fingerprint(source))) ||
      prior.materials.some(row => hash(row.bytes) !== row.source.sha256 || row.bytes.length !== row.source.bytes)) throw new SourceAwareRunValidation("source-custody", "Complete approved original-material custody required");
  const documents = plan.sources.canonicalKnowledge.map(source => {
    const row = prior.materials.find(row => row.source.reference === source.path);
    if (!row || row.source.sha256 !== source.sha256 || row.bytes.length !== source.bytes) throw new SourceAwareRunValidation("knowledge", "Canonical C0 knowledge version differs");
    return row.bytes.toString("utf8");
  });
  if (documents.length !== 2) throw new SourceAwareRunValidation("knowledge", "Exact canonical C0 knowledge documents required");
  const retained = prior.context.evidence.find(source => source.id === "c0-retained-ten-answers");
  if (!retained || retained.kind !== "customer-unconfirmed") throw new SourceAwareRunValidation("knowledge", "Retained C0 answers must remain unconfirmed");
  const prepared = proposeC0AuthoringKnowledge(prior.context, oldAuthority, { businessBrief: documents[0], productModel: documents[1] });
  const context: WorkflowContext = { ...prepared.context, scope: structuredClone(plan.destination.scope), intakeId: plan.destination.intakeId,
    entry: plan.destination.entry as "DIRECT_START", evaluation: { scenario: "c0", basis: sourceAwareC0ProposalSha256 } };
  if (Object.values(context.scope).some(id => Object.values(prior.context.scope).includes(id))) throw new SourceAwareRunValidation("database", "New C0 evaluation must not overwrite an existing tenant");
  const authority = { ...prepared.authority, contextDigest: fingerprint(context), brandDigest: prior.brandDigest,
    qualityReviewerId: activation.reviewerId };
  const stages = plan.provider.stages as WorkflowStagePlan;
  const ledger = { id: fingerprint({ proposal: sourceAwareC0ProposalSha256, case: plan.destination, startsAt: activation.startsAt }),
    startingLedger: plan.preserve.previousLedgerSha256, baselineAttempts: plan.preserve.baselineAttempts,
    requests: plan.authority.maximumProviderRequests, generations: plan.authority.maximumTextGenerations,
    capMicros: plan.authority.additionalProviderCapMicros, inputTokens: Math.max(...Object.values(stages).map(stage => stage.requestInputTokens)),
    inputBytes: plan.provider.requestBytes, stageSpendingPolicy: "shared-aggregate" as const,
    breakdown: { text: plan.authority.maximumTextGenerations, images: 0, searchCalls: plan.authority.maximumPaidWebSearchCalls },
    carryForward: { debitMicros: plan.preserve.previousDebitMicros, totalCapMicros: plan.authority.cumulativeAccountedCeilingMicros,
      reportHold: prior.grant.ledger.carryForward!.reportHold }, stages };
  try { verifyWorkflowUsageBaseline(prior.ledger, ledger); }
  catch { throw new SourceAwareRunValidation("usage-baseline", "Prior usage or reservation evidence differs; retain the original ledger"); }
  const roots = plan.publicResearch.roots.map((url, index) => ({ id: "research:root-" + index, url, label: new URL(url).hostname }));
  validateResearchSources(roots);
  const marketSearch = { publicQuery: plan.publicResearch.publicQuery, maxToolCalls: plan.authority.maximumPaidWebSearchCalls,
    maxSources: plan.publicResearch.maximumRetrievedSources - roots.length, minimumNewOrigins: plan.publicResearch.minimumIndependentNewOrigins };
  validateMarketSearch(marketSearch);
  const originalMaterials = { version: 1 as const, contextDigest: fingerprint(context), records: prior.materials.map(row => row.source),
    requestBytes: plan.provider.requestBytes, publicResearch: { maximumRecords: plan.publicResearch.maximumMaterialRecords,
      maximumBytes: plan.publicResearch.maximumMaterialBytes, screenshots: true }, candidateReview: plan.review.candidateImages as {
        operations: readonly ("page" | "editorial")[]; maximumRecords: number; maximumBytes: number; includeOperatorProjections: boolean;
      } };
  validateOriginalGrant(originalMaterials, fingerprint(context));
  const grant: PresenceWorkflowGrant = { contextDigest: fingerprint(context), approvedSources: context.evidence.map(fingerprint), approvedCorrections: [],
    approvedRevisionFeedback: [], marketingAuthority: authority, originalMaterials, nativeComponents: 2, siteComposition: "managed-v1",
    previewActionDestinations: { "request-review": "/free-review", "start-onboarding": "/direct-start" }, researchSources: roots,
    researchResponseBytes: plan.publicResearch.maximumResponseBytes, marketSearch, maxOutputTokens: Math.max(...Object.values(stages).map(stage => stage.requestOutputTokens)),
    maxRetries: plan.authority.maximumDeliberateRetries, maxEditorialRevisions: plan.authority.maximumEditorialRevisionRounds,
    maxCommercialReplans: plan.authority.maximumCommercialReplans, startsAt: activation.startsAt, expiresAt, ledger };
  return { context, grant, coverage: prepared.coverage, previousLedgerUnchanged: true as const };
}
