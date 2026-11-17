import { createHash } from "node:crypto";
import manifest from "../../../docs/presence-evaluation-activation.json";
import { fingerprint, uuid } from "../canonical/model";
import { hash } from "../content-editing/proposal";
import { bindPresenceEvaluations } from "./presence-evaluation";
import type { WorkflowContext } from "./presence-workflow";
import { evidenceKinds, type PresenceEvidence } from "./presence-workflow-artifacts";
import type { PresenceWorkflowGrant } from "./presence-workflow-provider";
import { validateMarketSearch, validateResearchSources } from "./presence-workflow-research";
import { validatePresenceImageGrant } from "./presence-workflow-visual";
import { emptyResponsesUsageLedger } from "./intelligent-responses";

export type EvaluationManifest = typeof manifest;
export type EvaluationScenario = keyof EvaluationManifest["cases"];

export function readEvaluationManifest(bytes: Buffer, approval: string, now: number | null = Date.now()): EvaluationManifest {
  if (createHash("sha256").update(bytes).digest("hex") !== hash(approval) ||
      fingerprint(JSON.parse(bytes.toString("utf8"))) !== fingerprint(manifest)) throw Error("Exact reviewed evaluation manifest required");
  const plan = structuredClone(manifest);
  const expires = Date.parse(plan.approval.expiresAt);
  if (now !== null && (expires <= now || expires > now + 72 * 3600_000)) throw Error("Evaluation approval window refused");
  const ids = [plan.original.intakeId, ...Object.values(plan.original.scope), ...Object.values(plan.cases).flatMap(item =>
    [item.organizationId, item.intakeId, ...Object.values(item.scope)])].map(uuid);
  if (new Set(ids).size !== ids.length) throw Error("Evaluation identities must be independent");
  const provider = plan.provider;
  const ordinary = Math.ceil((provider.inputTokens * provider.rates.inputPerMillion + provider.outputTokens * provider.rates.outputPerMillion) / 1_000_000);
  const market = Math.ceil((provider.researchInputReservationTokens * provider.rates.inputPerMillion + provider.outputTokens * provider.rates.outputPerMillion) / 1_000_000);
  const budgets = Object.values(plan.cases).map(item => {
    validateResearchSources(item.research.roots);
    validateMarketSearch(item.research.market);
    validatePresenceImageGrant({ model: provider.imageModel, briefs: item.images });
    const b = item.budget;
    if (item.entry !== "DIRECT_START" || b.text * 2 + b.images !== b.requests || b.images !== item.images.length ||
        b.searchCalls !== item.research.market.maxToolCalls ||
        (b.text - 1) * ordinary + market + b.searchCalls * provider.perSearchCallMicros + b.images * provider.perImageReservationMicros > b.capMicros) {
      throw Error("Evaluation budget cannot cover its approved envelope");
    }
    return b.capMicros;
  });
  if (budgets.reduce((sum, cap) => sum + cap, 0) !== plan.approval.capMicros ||
      fingerprint(plan.original.sources) !== plan.original.approvedProjectionDigest) throw Error("Evaluation envelope differs");
  return plan;
}

function evaluationDestination(plan: EvaluationManifest, scenario: EvaluationScenario): WorkflowContext {
  const { intakeId, scope } = plan.cases[scenario];
  return { intakeId, scope, entry: "DIRECT_START", evidence: [], conflicts: [], limitations: [] };
}

function fictionalEvidence(plan: EvaluationManifest): PresenceEvidence[] {
  return plan.cases.c2.fictionalEvidence.map(item => {
    if (item.kind !== "website-observation" || !item.reference.startsWith("Fictional C2 fixture: ")) throw Error("Fictional evaluation source refused");
    return { ...item, kind: "website-observation" as const };
  });
}

export function bindFictionalEvaluation(plan: EvaluationManifest): WorkflowContext {
  const evidence = fictionalEvidence(plan);
  return { ...evaluationDestination(plan, "c2"), evidence, evaluation: { scenario: "c2", basis: fingerprint(evidence) },
    limitations: ["Evaluation case C2. Generated work is for private quality review."] };
}

export function bindOriginalEvaluation(plan: EvaluationManifest, retained: { version: number; contextDigest: string; sourceSnapshot: Pick<WorkflowContext, "entry" | "evidence" | "limitations" | "conflicts"> }) {
  const original = plan.original;
  const { sourceSnapshot } = retained;
  if (retained.contextDigest !== original.contextDigest || !sourceSnapshot) throw Error("Hosted C0 evidence context differs");
  const evidence = fictionalEvidence(plan);
  return bindPresenceEvaluations({
    c0: { origin: { intakeId: original.intakeId, scope: original.scope, ...sourceSnapshot }, retained, digest: original.eventDigest,
      sources: original.sources, projectionDigest: original.approvedProjectionDigest, destination: evaluationDestination(plan, "c0") },
    c2: { destination: evaluationDestination(plan, "c2"), fictionalEvidence: evidence, digest: fingerprint(evidence) },
  }).c0;
}

export function evaluationGrant(plan: EvaluationManifest, approval: string, scenario: EvaluationScenario, context: WorkflowContext): PresenceWorkflowGrant {
  const item = plan.cases[scenario], { provider } = plan;
  const sources = context.evidence.map(fingerprint);
  const expected = scenario === "c0" ? plan.original.sources : fictionalEvidence(plan).map(fingerprint);
  const original = plan.original;
  const basis = scenario === "c0" ? fingerprint({ intake: original.intakeId, revision: original.revision,
    digest: original.eventDigest, projection: original.approvedProjectionDigest }) : fingerprint(fictionalEvidence(plan));
  if (context.evaluation?.scenario !== scenario || context.evaluation.basis !== basis || context.intakeId !== item.intakeId ||
      fingerprint(context.scope) !== fingerprint(item.scope) || context.entry !== item.entry ||
      fingerprint([...sources].sort()) !== fingerprint([...expected].sort()) ||
      !context.evidence.every(source => evidenceKinds.includes(source.kind)) || context.conflicts.length ||
      fingerprint(context.limitations) !== fingerprint([`Evaluation case ${scenario.toUpperCase()}. Generated work is for private quality review.`])) {
    throw Error("Approved evaluation evidence and case differ");
  }
  const b = item.budget;
  return { contextDigest: fingerprint(context), approvedSources: sources, approvedCorrections: [],
    approvedHomeFeedback: item.earlyFeedback.map(fingerprint), previewActionDestinations: item.previewDestinations,
    siteComposition: "managed-v1", researchSources: item.research.roots,
    marketSearch: item.research.market, researchResponseBytes: provider.researchResponseBytes,
    images: { model: provider.imageModel, briefs: item.images }, maxRetries: plan.approval.deliberateRetriesPerCase,
    maxEditorialRevisions: plan.approval.maxEditorialRevisionsPerCase, maxOutputTokens: provider.outputTokens,
    expiresAt: Date.parse(plan.approval.expiresAt), ledger: { id: fingerprint({ scenario, approval: hash(approval), scope: context.scope }),
      baselineAttempts: 0, startingLedger: createHash("sha256").update(JSON.stringify(emptyResponsesUsageLedger(provider.rates)) + "\n").digest("hex"),
      requests: b.requests, generations: b.text + b.images, capMicros: b.capMicros, inputTokens: provider.inputTokens, inputBytes: provider.inputBytes,
      breakdown: { text: b.text, images: b.images, searchCalls: b.searchCalls } } };
}
