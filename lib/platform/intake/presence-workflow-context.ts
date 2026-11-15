import type { IntakeView } from "./service";
import type { WorkflowContext } from "./presence-workflow";
import type { PresenceEvidence } from "./presence-workflow-artifacts";

const preparedKinds = {
  "Owner-confirmed": "owner-confirmed",
  "Website observation": "website-observation",
  "Earlier Review answer": "earlier-review-answer",
  "Earlier Review assessment": "earlier-review-assessment",
} as const;

export function workflowContextFromIntake(scope: WorkflowContext["scope"], intakeId: string, view: IntakeView): WorkflowContext {
  const evidence: PresenceEvidence[] = (view.prepared?.sources ?? []).map(source => ({
    id: source.id, kind: preparedKinds[source.kind], label: source.title, reference: source.reference,
    date: source.date ?? null, content: [source.detail, ...source.entries.map(item => item.label + ": " + item.value)].join("\n"),
  }));
  // The caller has already verified draft ownership. Local inclusion is not provider consent.
  for (const [key, record] of Object.entries(view.provenance ?? {})) {
    const answer = view.answers[key];
    if (record?.confirmation === "unconfirmed" && (typeof answer === "string" || Array.isArray(answer))) {
      evidence.push({ id: "intake:" + key, kind: "customer-unconfirmed", label: key, reference: record.reference,
        date: record.suppliedAt, content: Array.isArray(answer) ? answer.join("\n") : answer });
    }
  }
  return { scope, intakeId, entry: view.intent, evidence,
    limitations: [view.prepared?.context, view.prepared?.reviewGap].filter((value): value is string => Boolean(value)),
    conflicts: view.prepared?.reconciliation ? [view.prepared.reconciliation.detail] : [],
  };
}
