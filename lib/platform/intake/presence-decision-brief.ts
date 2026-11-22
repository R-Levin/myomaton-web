import { canonicalPagePath } from "../managed-sites/paths";
import { choice, fingerprint, object, text } from "../canonical/model";
import type { WorkflowRun } from "./presence-workflow";
import type { PresenceEvidence } from "./presence-workflow-artifacts";

export type StrategyScope = { version: 1; peerIds: readonly string[]; copyPolicy?: "unpriced-no-testimony" | "no-testimony";
  entryJourneys?: { reviewClaimId: string; directClaimId: string }; discoveredPeers?: true; change?:
  { baseline: string; paths: readonly string[]; reason: string; observationIds: readonly string[] } };
const hash = /^[a-f0-9]{64}$/u;
const uses = ["terminology", "composition", "journey"] as const;
const string = { type: "string" };
const strings = { type: "array", items: string };
const shape = <T extends Record<string, unknown>>(properties: T) => ({ type: "object", additionalProperties: false, properties, required: Object.keys(properties) });
export const decisionBriefSchema = shape({
  decision: string, findingIds: strings, directionSteps: { type: "array", items: { type: "integer" } },
  claimIds: strings, influences: { type: "array", items: shape({ sourceIds: strings, use: { type: "string", enum: uses }, implication: string }) },
  avoid: strings,
});

function list<T>(value: unknown, parse: (value: unknown) => T, required = true) {
  if (!Array.isArray(value) || (required && !value.length) || value.length > 30) throw Error("Nonempty bounded decision evidence required");
  return value.map(parse);
}

const ids = (value: unknown) => unique(list(value, item => text(item, 160)));
function unique<T>(items: T[]): T[] {
  if (new Set(items).size !== items.length) throw Error("Duplicate decision reference");
  return items;
}

export function readDecisionBrief(value: unknown) {
  const row = object(value, ["decision", "findingIds", "directionSteps", "claimIds", "influences", "avoid"]);
  return {
    decision: text(row.decision, 900),
    findingIds: ids(row.findingIds), claimIds: ids(row.claimIds),
    directionSteps: unique(list(row.directionSteps, step => {
      if (typeof step !== "number" || !Number.isSafeInteger(step) || step < 0) throw Error("Direction step refused");
      return step;
    })),
    // A Page may rest on business knowledge alone; research must shape the plan as a
    // whole (validateStrategyBlueprint), not be cited on every Page. Nothing to avoid is valid.
    influences: list(row.influences, item => {
      const influence = object(item, ["sourceIds", "use", "implication"]);
      return { sourceIds: ids(influence.sourceIds), use: choice(influence.use, uses), implication: text(influence.implication, 800) };
    }, false),
    avoid: list(row.avoid, item => text(item, 320), false),
  };
}
export type DecisionBrief = ReturnType<typeof readDecisionBrief>;

export function checkStrategyScope(scope: StrategyScope) {
  if (scope.version !== 1 || (scope.discoveredPeers ? !Array.isArray(scope.peerIds) || new Set(scope.peerIds).size !== scope.peerIds.length : ids(scope.peerIds).length < 2) || (scope.discoveredPeers !== undefined && scope.discoveredPeers !== true) ||
      (scope.copyPolicy && !["unpriced-no-testimony", "no-testimony"].includes(scope.copyPolicy))) {
    throw Error("Independent peer evidence and valid copy policy required");
  }
  if (scope.entryJourneys) ids([scope.entryJourneys.reviewClaimId, scope.entryJourneys.directClaimId]);
  if (scope.change) {
    if (!hash.test(scope.change.baseline) || ids(scope.change.paths).some(path => !canonicalPagePath(path))) {
      throw Error("Exact Ongoing base revision and Page scope required");
    }
    text(scope.change.reason, 800);
    ids(scope.change.observationIds);
  }
}

export function strategyBasis(context: WorkflowRun["context"], input: Pick<WorkflowRun["input"], "report" | "direction" | "research">) {
  return fingerprint({ context: fingerprint(context), report: input.report, direction: input.direction, research: input.research });
}

// Legacy projections expose only the validated decision and sourced traces.
// Source-aware authoring separately carries its explicitly authorized knowledge.
export function compilePageDecision(run: WorkflowRun, brief: DecisionBrief, path: string, scope: StrategyScope,
  claims: readonly PresenceEvidence[], observations: readonly PresenceEvidence[], expectedContext: string, sourceAware = false) {
  const { report, direction } = run.input;
  if (!report || !direction || fingerprint(run.context) !== expectedContext ||
      fingerprint(run.context.evidence) !== fingerprint(run.input.evidence) ||
      (scope.change && !scope.change.paths.includes(path))) throw Error("Unbound Page decision");
  const claimIds = new Set(claims.map(item => item.id));
  const observationIds = new Set(observations.map(item => item.id));
  const peerIds = new Set([...scope.peerIds, ...(scope.discoveredPeers
    ? observations.filter(source => source.kind === "public-research" && source.date && source.rawDigest).map(source => source.id) : [])]);
  if (brief.claimIds.some(item => !claimIds.has(item)) ||
      (scope.change && scope.change.observationIds.some(id => !observationIds.has(id)))) throw Error("Page claim authority refused");
  const findings = brief.findingIds.map(id => {
    const found = report.findings.find(item => item.id === id);
    if (!found || found.sourceIds.some(source => !claimIds.has(source) && !observationIds.has(source))) {
      throw Error("Finding provenance refused");
    }
    return { id, subject: text(found.heading, 320), status: found.status, sources: found.sourceIds, digest: fingerprint(found) };
  });
  const directions = brief.directionSteps.map(index => {
    const directionDecision = direction.visitorDecisions[index];
    if (!directionDecision || !direction.sourceIds.every(id => claimIds.has(id) || observationIds.has(id))) {
      throw Error("Direction provenance refused");
    }
    return { index, decision: text(directionDecision, 1_000), digest: fingerprint(directionDecision), sources: direction.sourceIds };
  });
  // Verified DOM text can support a proposed information composition. Missing
  // viewport captures stay explicitly incomplete; they are not invented pixels
  // or a completed visual-quality review.
  // Source-aware Pages need no per-Page research citation: research must visibly shape
  // the plan as a whole (validateStrategyBlueprint), while an individual Page may rest on
  // customer knowledge, brand or Direction. Historical grants keep their peer rule.
  const researchBasis = sourceAware ? true
    : brief.influences.some(item => item.use === "composition" && item.sourceIds.some(id => peerIds.has(id)));
  if (!researchBasis || brief.influences.some(item => item.sourceIds.some(id => !observationIds.has(id)))) {
    throw Error(sourceAware ? "Page needs authorized source influence and market evidence" : "Page needs source-backed peer composition and market influence");
  }
  return { ...brief, findings, directions,
    sourceTrace: brief.influences.flatMap(item => item.sourceIds).filter((id, i, sourceIds) => sourceIds.indexOf(id) === i)
      .map(id => {
        const source = observations.find(item => item.id === id)!;
        return { id, observed: peerIds.has(id) ? text(source.content, scope.discoveredPeers ? Infinity : 2_000, true) : null,
          use: sourceAware && !peerIds.has(id) ? "authorized-customer-source-influence" as const : "market-influence" as const,
          ...(sourceAware && { sourceKind: source.kind }), observedAt: source.date, digest: fingerprint(source) };
      }),
    ...(scope.change && { change: { ...scope.change, paths: [path] } }),
    caseDigest: expectedContext, reportDigest: fingerprint(report), directionDigest: fingerprint(direction) };
}
