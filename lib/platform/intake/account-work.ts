import { fingerprint } from "../canonical/model";
import type { PresenceWorkflowView, WorkflowActor, WorkflowContext } from "./presence-workflow";

/** Proposed source corrections live in the existing append-only workflow history.
 * They are neither canonical facts nor another approval mechanism. */
export type UnderstandingCorrection = {
  id: string; sourceId: string; sourceDigest: string; text: string;
  actor: WorkflowActor; at: string;
  withdrawn?: { actor: WorkflowActor; reason: string; at: string };
};

export function pendingUnderstanding(corrections: readonly UnderstandingCorrection[] = []) {
  return corrections.filter(item => !item.withdrawn);
}

export function accountWork(context: WorkflowContext, view: PresenceWorkflowView) {
  const sources = [...view.sources, ...view.research ?? []];
  const corrections = view.understandingCorrections ?? [];
  const pending = pendingUnderstanding(corrections);
  const affected = (id: string) => {
    const findings = view.report?.findings.filter(item => item.sourceIds.includes(id)).map(item => item.heading) ?? [];
    const direction = view.direction?.sourceIds.includes(id) ?? false;
    const pages = [...new Set([
      ...view.blueprint?.pages.filter(item => item.sourceIds.includes(id)).map(item => item.path) ?? [],
      ...view.pages.filter(page => page.sections.some(section => section.sourceIds.includes(id))).map(page => page.path),
    ])];
    return { findings, direction, pages };
  };
  return {
    scope: context.scope, intakeId: context.intakeId, version: view.version,
    evidenceCurrent: view.next !== "evidence-changed" && view.contextDigest === fingerprint(context), mode: view.mode,
    sources: sources.map(source => ({ ...source, digest: fingerprint(source) })),
    corrections: corrections.map(item => ({ ...item, impact: affected(item.sourceId) })),
    pendingCorrections: pending.length,
    work: {
      stage: view.next, pendingOperation: view.pendingOperation,
      reportAvailable: Boolean(view.report), directionAvailable: Boolean(view.direction),
      proposedPages: view.blueprint?.pages.length ?? 0, draftedPages: view.pages.length,
      siteReviewRecorded: Boolean(view.operatorReview),
      delivery: "not-connected" as const,
    },
    nextAction: pending.length ? "Review the proposed knowledge correction and reassess dependent work before continuing."
      : view.next === "evidence-changed" ? "Reconcile changed sources with the retained work."
      : view.failure ? "Inspect and recover the retained operation before requesting more work."
      : view.pendingOperation ? "Wait for the recorded operation; do not dispatch it again."
      : view.next === "review-complete" ? "Prepare the exact private delivery scope. This review does not apply or publish it."
      : "Continue the recorded business report and website workflow below.",
  };
}
export type AccountWorkView = ReturnType<typeof accountWork>;
