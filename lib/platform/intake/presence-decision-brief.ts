import { canonicalPagePath } from "../managed-sites/paths";
import { choice, fingerprint, object, text } from "../canonical/model";
import type { WorkflowRun } from "./presence-workflow";
import type { PresenceEvidence } from "./presence-workflow-artifacts";

export type StrategyScope = { version: 1; peerIds: readonly string[]; copyPolicy?: "unpriced-no-testimony";
  entryJourneys?: { reviewClaimId: string; directClaimId: string }; change?:
  { baseline: string; paths: readonly string[]; reason: string; observationIds: readonly string[] } };
const hash = /^[a-f0-9]{64}$/u;
const uses = ["terminology", "composition", "journey"] as const;
const string = { type: "string" };
const strings = { type: "array", items: string };
const shape = (properties: object) => ({ type: "object", additionalProperties: false, properties, required: Object.keys(properties) });
export const decisionBriefSchema = shape({
  decision: string, findingIds: strings, directionSteps: { type: "array", items: { type: "integer" } },
  claimIds: strings, influences: { type: "array", items: shape({ sourceIds: strings, use: { type: "string", enum: uses }, implication: string }) },
  avoid: strings,
});

function list<T>(value: unknown, parse: (value: unknown) => T) {
  if (!Array.isArray(value) || !value.length || value.length > 30) throw Error("Nonempty bounded decision evidence required");
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
    influences: list(row.influences, item => {
      const influence = object(item, ["sourceIds", "use", "implication"]);
      return { sourceIds: ids(influence.sourceIds), use: choice(influence.use, uses), implication: text(influence.implication, 800) };
    }),
    avoid: list(row.avoid, item => text(item, 320)),
  };
}
export type DecisionBrief = ReturnType<typeof readDecisionBrief>;

export function checkStrategyScope(scope: StrategyScope) {
  if (scope.version !== 1 || ids(scope.peerIds).length < 2 || (scope.copyPolicy && scope.copyPolicy !== "unpriced-no-testimony")) {
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

// Raw source bodies and narrative reports stay behind this compiler. Only the
// originally validated decision and the specific sourced traces reach the writer.
export function compilePageDecision(run: WorkflowRun, brief: DecisionBrief, path: string, scope: StrategyScope,
  claims: readonly PresenceEvidence[], observations: readonly PresenceEvidence[], expectedContext: string) {
  const { report, direction } = run.input;
  if (!report || !direction || fingerprint(run.context) !== expectedContext ||
      fingerprint(run.context.evidence) !== fingerprint(run.input.evidence) ||
      (scope.change && !scope.change.paths.includes(path))) throw Error("Unbound Page decision");
  const claimIds = new Set(claims.map(item => item.id));
  const observationIds = new Set(observations.map(item => item.id));
  const peerIds = new Set(scope.peerIds);
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
  const visualBasis = brief.influences.some(item => item.use === "composition" && item.sourceIds.some(id => peerIds.has(id)));
  if (!visualBasis || brief.influences.some(item => item.sourceIds.some(id => !observationIds.has(id)))) {
    throw Error("Page needs source-backed peer composition and market influence");
  }
  return { ...brief, findings, directions,
    sourceTrace: brief.influences.flatMap(item => item.sourceIds).filter((id, i, sourceIds) => sourceIds.indexOf(id) === i)
      .map(id => {
        const source = observations.find(item => item.id === id)!;
        return { id, observed: peerIds.has(id) ? text(source.content, 2_000, true) : null,
          use: "market-influence" as const, observedAt: source.date, digest: fingerprint(source) };
      }),
    ...(scope.change && { change: { ...scope.change, paths: [path] } }),
    caseDigest: expectedContext, reportDigest: fingerprint(report), directionDigest: fingerprint(direction) };
}
