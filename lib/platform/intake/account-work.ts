import { fingerprint } from "../canonical/model";
import type { PresenceWorkflowView, WorkflowActor, WorkflowContext } from "./presence-workflow";
import type { KnowledgeConfirmation } from "../canonical/confirmed-information";
import type { PresenceEvidence } from "./presence-workflow-artifacts";

export function confirmedKnowledgeEvidence(confirmations: readonly Pick<KnowledgeConfirmation, "recordId" | "key" | "version" | "kind" | "at" | "value" | "publicUse">[]): PresenceEvidence[] {
  return confirmations.map(item => ({ id: `confirmed-${item.recordId}-${item.key}-${item.version}`, kind: "owner-confirmed",
    label: `Confirmed ${item.kind}: ${item.key}`, reference: `canonical:knowledge/${item.recordId}/${item.version}#${item.key}`,
    date: item.at.slice(0, 10), content: `${item.value}\nConfirmation: ${item.publicUse ? "eligible for website proposals; not publication approval" : "internal understanding only; not cleared for public copy"}.` }));
}

/** Proposed source corrections live in the existing append-only workflow history.
 * They are neither canonical facts nor another approval mechanism. */
export type UnderstandingCorrection = {
  id: string; sourceId: string; sourceDigest: string; text: string;
  actor: WorkflowActor; at: string;
  confirmation?: KnowledgeConfirmation;
  withdrawn?: { actor: WorkflowActor; reason: string; at: string };
};

export function pendingUnderstanding(corrections: readonly UnderstandingCorrection[] = []) {
  return corrections.filter(item => !item.withdrawn && !item.confirmation);
}

export function accountWork(context: WorkflowContext, view: PresenceWorkflowView) {
  const sources = [...view.sources, ...view.research ?? []];
  const corrections = view.understandingCorrections ?? [];
  const pending = pendingUnderstanding(corrections);
  const previous = view.knowledgeReassessments?.at(-1)?.previous;
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
    knowledgeTargets: "knowledgeTargets" in view ? view.knowledgeTargets : [],
    canConfirmKnowledge: view.knowledgeConfirmationAvailable === true,
    reassessments: view.knowledgeReassessments ?? [],
    ...(previous && { comparison: {
      beforeSummary: previous.report?.summary ?? null, afterSummary: view.report?.summary ?? null,
      beforePositioning: previous.direction?.positioning ?? null, afterPositioning: view.direction?.positioning ?? null,
      beforeApproach: previous.direction?.approach ?? null, afterApproach: view.direction?.approach ?? null,
      findings: view.report ? [...new Set([...previous.report?.findings.map(item => item.id) ?? [], ...view.report.findings.map(item => item.id)])].map(id => {
        const before = previous.report?.findings.find(item => item.id === id), after = view.report!.findings.find(item => item.id === id);
        return { id, heading: after?.heading ?? before!.heading, before: before?.body ?? null, after: after?.body ?? null };
      }).filter(item => item.before !== item.after) : [],
      pages: view.blueprint?.pages.map(page => ({ path: page.path, change: page.change, reason: page.changeReason,
        beforeHeading: previous.pages.find(item => item.path === page.path)?.heading ?? null,
        afterHeading: view.pages.find(item => item.path === page.path)?.heading ?? null,
        contentChanged: view.pages.some(item => item.path === page.path)
          ? fingerprint(view.pages.find(item => item.path === page.path)) !== fingerprint(previous.pages.find(item => item.path === page.path) ?? null) : null,
      })) ?? [],
    } }),
    work: {
      stage: view.next, pendingOperation: view.pendingOperation,
      reportAvailable: Boolean(view.report), directionAvailable: Boolean(view.direction),
      proposedPages: view.blueprint?.pages.length ?? 0, draftedPages: view.pages.length,
      siteReviewRecorded: Boolean(view.operatorReview),
      delivery: "not-connected" as const,
    },
    nextAction: pending.length ? "Review the proposed knowledge correction and reassess dependent work before continuing."
      : view.next === "reassessment-ready" ? "The exact fact is confirmed. Queue reassessment; existing work remains available for comparison."
      : view.next === "evidence-changed" ? "Reconcile changed sources with the retained work."
      : view.failure ? "Inspect and recover the retained operation before requesting more work."
      : view.pendingOperation ? "Wait for the recorded operation; do not dispatch it again."
      : view.next === "review-complete" ? "Prepare the exact private delivery scope. This review does not apply or publish it."
      : "Continue the recorded business report and website workflow below.",
  };
}
export type AccountWorkView = ReturnType<typeof accountWork>;
