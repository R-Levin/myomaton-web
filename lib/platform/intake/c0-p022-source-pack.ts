import { createHash } from "node:crypto";
import proposal from "../../../docs/c0-generation-p0-22-sources.json";
import runPlan from "../../../docs/c0-generation-p0-22-run-proposal.json";
import prior from "../../../docs/c0-commercial-authorization-proposal.json";
import { fingerprint, text } from "../canonical/model";
import type { WorkflowContext } from "./presence-workflow";
import { validateWorkflowStagePlan, type WorkflowStagePlan, type WorkflowUsageScope } from "./intelligent-responses";
import type { PresenceEvidence } from "./presence-workflow-artifacts";
import type { MarketingAuthority } from "./presence-marketing-authority";

export const p022SourcePackSha256 = "175bfeb870f4a375bb27bd6c299e7aaefe11d39731b9d5e94f806488bab6782a";

export const p022RunProposalSha256 = "f8e48f864853802cfda73907a3fdce66b266b87e202bad9dc010fdc77435dd03";

export const p022Candidate = {
  organizationId: "eaaadfb0-f89c-442a-acf1-ec30cc638c31",
  intakeId: "e3e29501-95b9-4df3-baaa-868bb1ee27a0",
  scope: { webPresenceId: "6ceab9da-9829-40d1-8bd1-730b34eb37df", managedSiteId: "d5d4d9d3-dd19-4025-a93b-e0785f5ef4ec" },
};

export function readP022SourcePack(bytes: Buffer) {
  if (createHash("sha256").update(bytes).digest("hex") !== p022SourcePackSha256 ||
      fingerprint(JSON.parse(bytes.toString("utf8"))) !== fingerprint(proposal)) {
    throw Error("Exact P0-22 research and knowledge source pack required");
  }
  return structuredClone(proposal);
}

/** Proposal-only metering compilation. A verified activation must bind the
 * exact approved ledger prefix and actual provider authority before dispatch. */
export function p022ProposedMeter(bytes: Buffer): WorkflowUsageScope {
  if (createHash("sha256").update(bytes).digest("hex") !== p022RunProposalSha256 ||
      fingerprint(JSON.parse(bytes.toString("utf8"))) !== fingerprint(runPlan) ||
      runPlan.sourcePackSha256 !== p022SourcePackSha256) throw Error("Exact P0-22 run proposal required");
  const stagePlan = Object.fromEntries(Object.entries(runPlan.stageBudgets).map(([key, budget]) => [key, {
    rates: budget.model === "mini" ? prior.budget.stages.research.rates : prior.budget.stages.report.rates,
    requestInputTokens: budget.perRequestInput, requestOutputTokens: budget.perRequestOutput,
    cumulativeInputTokens: budget.totalInput, cumulativeOutputTokens: budget.totalOutput, capMicros: budget.micros,
  }])) as WorkflowStagePlan;
  const caps = runPlan.boundaries;
  const preserved = runPlan.preservedLedger;
  const scope: WorkflowUsageScope = {
    id: fingerprint({ proposal: p022RunProposalSha256, candidate: p022Candidate }),
    startingLedger: preserved.sha256, baselineAttempts: preserved.attempts,
    requests: caps.providerRequests, generations: caps.textGenerations + caps.images,
    capMicros: caps.additionalCapMicros, inputTokens: Math.max(...Object.values(stagePlan).map(stage => stage.requestInputTokens)),
    inputBytes: 800_000, stages: stagePlan,
    breakdown: { text: caps.textGenerations, images: caps.images, searchCalls: caps.searchCalls },
    carryForward: { totalCapMicros: caps.totalCapMicros, debitMicros: preserved.debitMicros, reportHold: preserved.reportHold },
  };
  if (preserved.debitMicros + scope.capMicros > caps.totalCapMicros) throw Error("P0-22 aggregate limit refused");
  validateWorkflowStagePlan(stagePlan, scope, caps.searchCalls);
  return scope;
}

/** Compiles only approved canonical summaries and public browser observations.
 * This function creates no provider or protected WordPress authority. */
export function p022CandidateInputs(bytes: Buffer, brand: Pick<MarketingAuthority, "brandDigest" | "qualityReviewerId">,
  retainedExclusions: readonly PresenceEvidence[] = [], additional: readonly (typeof proposal.peers[number])[] = []) {
  const plan = readP022SourcePack(bytes);
  const sources = plan.sources.map(row => ({
    evidence: { id: row.id, kind: row.kind as PresenceEvidence["kind"], label: row.id, date: null,
      reference: row.reference, content: text(row.content, 1200) },
    use: row.use as MarketingAuthority["sources"][number]["use"],
  }));
  if (additional.length && (additional.length !== 2 || runPlan.additionalPublicPeerPages.some(url =>
    additional.filter(row => row.url === url).length !== 1) || new Set(additional.map(row => row.publisher)).size !== 2 ||
    additional.some(row => !/^peer-[a-z0-9-]+$/u.test(row.id) || !/^2026-11-\d\d$/u.test(row.date) ||
      ![row.desktopSha256, row.mobileSha256].every(hash => /^[a-f0-9]{64}$/u.test(hash)) || row.desktopSha256 === row.mobileSha256))) {
    throw Error("Exact authorized desktop/mobile peer records required");
  }
  const peers = [...plan.peers, ...additional].map(row => ({
    evidence: { id: row.id, kind: "public-research" as const, label: row.publisher, date: row.date, reference: row.url,
      content: text(row.observation, 2000), rawDigest: fingerprint({ desktop: row.desktopSha256, mobile: row.mobileSha256 }) },
    use: "analysis" as const,
  }));
  const records = [...sources, ...peers, ...retainedExclusions.map(evidence => ({ evidence, use: "excluded" as const }))];
  const context: WorkflowContext = {
    intakeId: p022Candidate.intakeId, scope: p022Candidate.scope, entry: "DIRECT_START", limitations: [], conflicts: [],
    evaluation: { scenario: "c0", basis: fingerprint({ sourcePack: p022SourcePackSha256, prior: plan.originalCandidateSha256 }) },
    evidence: records.map(row => row.evidence),
  };
  const authority: MarketingAuthority = {
    ...brand, contextDigest: fingerprint(context),
    brandBrief: sources.find(row => row.evidence.id === "c0-brand-authority")!.evidence.content,
    sources: records.map(({ evidence, use }) => ({ digest: fingerprint(evidence), use })),
    strategy: { version: 1, peerIds: peers.map(row => row.evidence.id), copyPolicy: "unpriced-no-testimony",
      entryJourneys: { reviewClaimId: "c0-review", directClaimId: "c0-direct" } },
  };
  return { context, authority };
}
