import { fingerprint, uuid } from "../canonical/model";
import { hash } from "../content-editing/proposal";
import type { WorkflowContext } from "./presence-workflow";
import type { PresenceEvidence } from "./presence-workflow-artifacts";

export type EvaluationBinding = {
  scenario: "c0" | "c2";
  basis: string;
};

export function bindPresenceEvaluations(input: {
  c0: { origin: WorkflowContext; retained: unknown; digest: string; sources: readonly string[]; projectionDigest: string; destination: WorkflowContext };
  c2: { destination: WorkflowContext; fictionalEvidence: readonly PresenceEvidence[]; digest: string };
}) {
  const { c0, c2 } = input;
  const identities = [c0.origin, c0.destination, c2.destination];
  for (const item of identities) {
    uuid(item.intakeId);
    uuid(item.scope.webPresenceId);
    uuid(item.scope.managedSiteId);
    if (item.evaluation) throw Error("Expected an ordinary intake binding");
  }
  for (const getId of [(item: WorkflowContext) => item.intakeId,
    (item: WorkflowContext) => item.scope.webPresenceId, (item: WorkflowContext) => item.scope.managedSiteId]) {
    if (new Set(identities.map(getId)).size !== 3) throw Error("Evaluation cases require distinct intake and tenant identities");
  }

  const retained = c0.retained as { version?: unknown; contextDigest?: unknown; sourceSnapshot?: { evidence?: unknown } } | null;
  if (!retained || retained.version !== 41 || fingerprint(retained) !== hash(c0.digest) ||
      retained.contextDigest !== fingerprint(c0.origin) || fingerprint(retained.sourceSnapshot?.evidence ?? null) !== fingerprint(c0.origin.evidence)) {
    throw Error("C0 revision-41 provenance differs");
  }
  const selected = c0.origin.evidence.filter(source => c0.sources.includes(fingerprint(source)));
  if (fingerprint(c0.sources) !== hash(c0.projectionDigest) || selected.length !== c0.sources.length || new Set(c0.sources).size !== c0.sources.length ||
      !selected.some(source => source.kind === "owner-confirmed")) throw Error("Exact permitted C0 sources required");
  if (fingerprint(c2.fictionalEvidence) !== hash(c2.digest) ||
      !c2.fictionalEvidence.length || !c2.fictionalEvidence.every(source =>
        source.kind !== "owner-confirmed" && source.reference.startsWith("Fictional C2 fixture: ") && !c0.origin.evidence.some(original => fingerprint(original) === fingerprint(source)))) {
    throw Error("Exact independent fictional C2 sources required");
  }
  const bind = (destination: WorkflowContext, evidence: readonly PresenceEvidence[], scenario: EvaluationBinding["scenario"], basis: string): WorkflowContext =>
    ({ intakeId: destination.intakeId, scope: structuredClone(destination.scope), entry: destination.entry, evidence: structuredClone([...evidence]),
      limitations: [`Evaluation case ${scenario.toUpperCase()}. Generated work is for private quality review.`], conflicts: [],
      evaluation: { scenario, basis } });
  return {
    c0: bind(c0.destination, selected, "c0", fingerprint({ intake: c0.origin.intakeId, revision: 41, digest: c0.digest, projection: c0.projectionDigest })),
    c2: bind(c2.destination, c2.fictionalEvidence, "c2", c2.digest),
  };
}

export function requireEvaluationContext(context: WorkflowContext) {
  if (!context.evaluation || !["c0", "c2"].includes(context.evaluation.scenario)) throw Error("Isolated evaluation binding required");
  return { scope: context.scope, intake: uuid(context.intakeId), scenario: context.evaluation.scenario, basis: hash(context.evaluation.basis) };
}
