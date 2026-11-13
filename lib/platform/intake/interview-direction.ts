import type { InterviewTurn } from "./intelligent-model";

/** Carry forward only an assessment with a matching saved answer and citation. */
export function interviewDirection(turns: readonly InterviewTurn[]) {
  const finding = turns.findLast(turn => turn.assessment);
  if (!finding?.assessment || !finding.respondsTo || !finding.sourceIds.includes(finding.respondsTo)) return null;
  const answered = turns.find(turn => turn.id + ":answer" === finding.respondsTo);
  if (!answered || answered.gapId !== finding.gapId || answered.answer?.disposition !== "provided") return null;
  return {
    findingId: finding.id,
    sourceIds: finding.sourceIds,
    recommendation: finding.assessment.recommendation,
    unresolved: finding.assessment.evidenceNeeded,
    answerReference: finding.respondsTo,
    ...(finding.presencePlan && { plan: finding.presencePlan }),
  };
}
