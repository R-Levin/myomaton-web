import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import proposal from "../../../docs/c0-commercial-authorization-proposal.json";
import previous from "../../../docs/presence-evaluation-activation.json";
import { focusMioPagesPreview } from "../../../scripts/customer-previews/miopages-focus";
import { fingerprint, uuid } from "../canonical/model";
import { draftBrand } from "../wordpress-delivery/draft-brand";
import { c0MarketingEditorial } from "./c0-marketing-editorial";
import { emptyResponsesUsageLedger, validateWorkflowStagePlan, type WorkflowUsageScope } from "./intelligent-responses";
import type { MarketingAuthority } from "./presence-marketing-authority";
import type { WorkflowContext } from "./presence-workflow";
import type { PresenceEvidence } from "./presence-workflow-artifacts";
import type { PresenceWorkflowGrant } from "./presence-workflow-provider";
import { validateMarketSearch, validateResearchSources } from "./presence-workflow-research";
import { validatePresenceImageGrant } from "./presence-workflow-visual";

const sha = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const shaPattern = /^[a-f0-9]{64}$/u;

export function readC0CommercialProposal(bytes: Buffer, expectedSha256: string) {
  if (sha(bytes) !== expectedSha256 || fingerprint(JSON.parse(bytes.toString("utf8"))) !== fingerprint(proposal)) {
    throw Error("Exact C0 commercial authorization proposal required");
  }
  return structuredClone(proposal);
}

export async function commercialC0Inputs(plan: typeof proposal) {
  const { original, destination, assets, image, research, budget } = plan;
  if (original.revision !== previous.original.revision || original.contextDigest !== previous.original.contextDigest ||
      original.eventDigest !== previous.original.eventDigest || original.ledgerDigest !== previous.original.ledgerDigest) {
    throw Error("Retained C0 evidence differs from the proposal");
  }
  const old = [...Object.values(previous.original.scope), previous.original.intakeId,
    ...Object.values(previous.cases.c0.scope), previous.cases.c0.intakeId, previous.cases.c0.organizationId,
    ...Object.values(previous.cases.c2.scope), previous.cases.c2.intakeId, previous.cases.c2.organizationId];
  const ids = [destination.organizationId, destination.intakeId, ...Object.values(destination.scope), assets.assetId, assets.usageId].map(uuid);
  if (ids.length !== new Set(ids).size || ids.some(id => old.includes(id)) || destination.entry !== "DIRECT_START") {
    throw Error("Fresh isolated C0 identities required");
  }
  const [png, copy] = await Promise.all([readFile(assets.logoPath), readFile(assets.editorialReference)]);
  if (sha(png) !== assets.logoSha256 || sha(copy) !== assets.editorialSha256) throw Error("Canonical C0 brand or editorial bytes differ");
  const { siteConfiguration, designConfiguration } = focusMioPagesPreview;
  const brand = draftBrand({ scope: destination.scope, visualDirection: siteConfiguration.visualDirection, design: designConfiguration,
    logo: { assetId: assets.assetId, usageId: assets.usageId, sha256: assets.logoSha256, alt: assets.alt } });
  const researchPlan = research.scopes;
  validateResearchSources(research.roots);
  validateMarketSearch(researchPlan);
  const images = validatePresenceImageGrant({ model: image.model, briefs: image.briefs });
  const primary = budget.stages.research.rates;
  if (image.reserveEachMicros !== 500_000 || budget.images !== image.maximum || budget.images !== images.briefs.length ||
      budget.capMicros !== plan.approval.capMicros || budget.requests !== budget.text * 2 + budget.images ||
      budget.searchCalls !== researchPlan.maxToolCalls ||
      plan.cycle.independentAcceptance.length !== 5 || plan.boundary.publication || plan.boundary.store) {
    throw Error("C0 proposal limits differ");
  }
  const reviewLedger: WorkflowUsageScope = {
    id: fingerprint(plan), baselineAttempts: 0, startingLedger: sha(JSON.stringify(emptyResponsesUsageLedger(primary)) + "\n"),
    requests: budget.requests, generations: budget.text + budget.images, capMicros: budget.capMicros,
    inputTokens: Math.max(...Object.values(budget.stages).map(stage => stage.requestInputTokens)), inputBytes: 800_000,
    breakdown: { text: budget.text, images: budget.images, searchCalls: budget.searchCalls }, stages: budget.stages,
  };
  validateWorkflowStagePlan(budget.stages, reviewLedger, researchPlan.maxToolCalls);
  return { brand, images, primary, reviewLedger };
}

/** Offline compiler for the exact authorization proposal. A protected activation
 * must verify the owner decision, reviewer identity and artifact before installing
 * its output. The proposal carries no executable enrollment or provider grants. */
export async function prepareCommercialC0(plan: typeof proposal, verifiedOriginal: WorkflowContext, binding: {
  manifestSha256: string; artifactSha256: string; independentReviewerId: string; startsAt: number; expiresAt: number;
}) {
  const exact = readC0CommercialProposal(await readFile("docs/c0-commercial-authorization-proposal.json"), binding.manifestSha256);
  if (fingerprint(exact) !== fingerprint(plan)) throw Error("Compiled proposal differs from approved bytes");
  const { destination, evidence, cycle, research } = plan;
  if (fingerprint(verifiedOriginal.scope) !== fingerprint(previous.cases.c0.scope) ||
      verifiedOriginal.intakeId !== previous.cases.c0.intakeId ||
      verifiedOriginal.evaluation?.basis !== fingerprint({ intake: previous.original.intakeId, revision: 41,
        digest: previous.original.eventDigest, projection: previous.original.approvedProjectionDigest }) ||
      fingerprint(verifiedOriginal.evidence.map(fingerprint).sort()) !== fingerprint([...previous.original.sources].sort())) {
    throw Error("Verified pinned C0 original projection required");
  }
  const reviewer = uuid(binding.independentReviewerId);
  if (![binding.artifactSha256, binding.manifestSha256].every(value => shaPattern.test(value)) ||
      !Number.isSafeInteger(binding.startsAt) || !Number.isSafeInteger(binding.expiresAt) ||
      binding.expiresAt <= binding.startsAt || binding.expiresAt - binding.startsAt > plan.approval.maximumHours * 3_600_000) {
    throw Error("Exact artifact, reviewer and approval window required");
  }
  const prepared = evidence.prepared.map(item => ({ evidence: { id: item.id, kind: item.kind as PresenceEvidence["kind"],
    label: item.id, date: null, reference: item.reference, content: item.content } satisfies PresenceEvidence,
    use: item.use as MarketingAuthority["sources"][number]["use"] }));
  const excluded = evidence.originalExclusions.map(id => {
    const source = verifiedOriginal.evidence.find(item => item.id === id);
    if (!source || source.kind !== "customer-unconfirmed") throw Error("Excluded C0 evidence differs");
    return source;
  });
  const editorial = c0MarketingEditorial();
  const inputs = await commercialC0Inputs(plan);
  const context: WorkflowContext = { scope: destination.scope, intakeId: destination.intakeId, entry: "DIRECT_START",
    evaluation: { scenario: "c0", basis: fingerprint({ binding, original: verifiedOriginal.evaluation.basis }) },
    evidence: [...prepared.map(item => item.evidence), ...editorial.pages, ...excluded], conflicts: [], limitations: [] };
  const policy: MarketingAuthority = { contextDigest: fingerprint(context), brandDigest: inputs.brand.digest,
    brandBrief: evidence.brandBrief, qualityReviewerId: reviewer,
    sources: [...prepared.map(item => ({ digest: fingerprint(item.evidence), use: item.use })), ...editorial.sources,
      ...excluded.map(item => ({ digest: fingerprint(item), use: "excluded" as const }))] };
  const grant: PresenceWorkflowGrant = {
    contextDigest: policy.contextDigest, marketingAuthority: policy, approvedSources: context.evidence.map(fingerprint),
    approvedCorrections: [], approvedRevisionFeedback: [], researchSources: research.roots, marketSearch: research.scopes,
    researchResponseBytes: research.responseBytes, images: inputs.images, previewActionDestinations: cycle.previewDestinations,
    siteComposition: "managed-v1", maxOutputTokens: 16_000, maxRetries: cycle.deliberateRetries,
    maxEditorialRevisions: cycle.operatorPageRevisionRounds, maxCommercialReplans: cycle.wholeSiteReplans,
    startsAt: binding.startsAt, expiresAt: binding.expiresAt, ledger: { ...inputs.reviewLedger, id: fingerprint({ binding, context: policy.contextDigest }) },
  };
  return { context, grant, brand: inputs.brand, primary: inputs.primary };
}
