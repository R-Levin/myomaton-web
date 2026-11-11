import { object, text } from "../canonical/model";
import type { EntryIntent } from "./model";

export type InterviewEvidence = {
  id: string;
  kind: "owner-confirmed" | "website-observation" | "historical-review-answer" | "historical-review-assessment" | "review-answer" | "review-assessment" | "synthetic-review";
  reference: string;
  at: string;
  statement: string;
  reviewDigest?: string;
};
export type InterviewGap = { id: string; questionPurpose: string; sourceIds: string[]; known: string[] };
export const answerRelevances = ["direct", "partial", "off-topic", "needs-confirmation"] as const;
export type AnswerReview = {
  relevance: typeof answerRelevances[number];
  topic: string;
  excerpt: string | null;
  unresolved: string | null;
};
type Answer = { text: string | null; disposition: "provided" | "unknown" | "deferred"; at: string };
export type InterviewTurn = {
  id: string;
  gapId: string;
  question: string | null;
  rationale: string;
  sourceIds: string[];
  respondsTo: string | null;
  generatorVersion: string;
  assessment: { recommendation: string; evidenceNeeded: string | null } | null;
  answerReview?: AnswerReview;
  answer?: Answer;
  at: string;
};
export type InterviewState = {
  turns: InterviewTurn[];
  pending: { id: string; gapId: string } | null;
  failure: { gapId: string; code: "provider_unavailable" | "invalid_output" } | null;
};
export type QuestionContext = {
  entryPath: EntryIntent;
  gap: InterviewGap;
  evidence: InterviewEvidence[];
  history: InterviewTurn[];
};
export type QuestionAttribution = { ownerDigest: string; workDigest: string };
export interface QuestionProvider {
  readonly version: string;
  readonly reviewAnswers?: boolean;
  propose(context: QuestionContext, attribution: QuestionAttribution): Promise<unknown>;
}

export class ProposalValidationError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

function checked<T>(code: string, read: () => T): T {
  try { return read(); }
  catch { throw new ProposalValidationError(code, "Interview proposal field refused"); }
}

const safeText = (value: unknown, max: number) => {
  const result = text(value, max);
  if (/[<>\u0000-\u001f\u007f-\u009f]/u.test(result) || Buffer.byteLength(JSON.stringify(result)) > max + 2) throw Error("Interview text validation failed");
  return result;
};
const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
export function readProposal(value: unknown, context: QuestionContext, id: string, generatorVersion: string, reviewAnswers = false): InterviewTurn {
  const previous = context.history.at(-1);
  const answerRef = previous?.answer ? previous.id + ":answer" : null;
  const reviewRequired = reviewAnswers && answerRef !== null;
  const output = checked("proposal_shape", () => object(value,
    ["question", "rationale", "sourceIds", "assessment", ...(reviewRequired ? ["answerReview"] : [])]));
  const permitted = new Set(context.evidence.map(item => item.id));
  const references = output.sourceIds;
  if (answerRef) permitted.add(answerRef);
  if (!Array.isArray(references) || references.length < 1 || references.length > 6 ||
      new Set(references).size !== references.length || references.some(ref => typeof ref !== "string" || !permitted.has(ref)) ||
      !references.some(ref => context.gap.sourceIds.includes(ref)) || (answerRef && !references.includes(answerRef))) {
    throw new ProposalValidationError("evidence_references", "Interview evidence references invalid");
  }
  const question = output.question === null ? null : checked("question_text", () => safeText(output.question, 420));
  const known = [...context.gap.known, ...context.history.flatMap(turn => turn.question ? [turn.question] : [])];
  if (question && (!question.endsWith("?") || known.some(prior => normalize(prior) === normalize(question)))) throw new ProposalValidationError("question_form", "Repeated or invalid question");
  if (!answerRef && !question) throw new ProposalValidationError("initial_question_missing", "Initial question required");
  const answerReview = reviewRequired ? ((): AnswerReview => {
    const review = checked("answer_relevance", () => object(output.answerReview, ["relevance", "topic", "excerpt", "unresolved"]));
    const relevance = answerRelevances.find(status => status === review.relevance);
    const excerpt = review.excerpt === null ? null : checked("answer_excerpt", () => safeText(review.excerpt, 450));
    const unresolved = review.unresolved === null ? null : checked("answer_unresolved", () => safeText(review.unresolved, 280));
    const supplied = previous?.answer?.text;
    if ((excerpt !== null && !supplied?.includes(excerpt)) || (supplied && !excerpt)) {
      throw new ProposalValidationError("answer_excerpt", "Answer excerpt did not match the saved reply");
    }
    if (!relevance || (relevance === "direct" && (!excerpt || unresolved)) ||
        (relevance !== "direct" && (!unresolved || !question))) {
      throw new ProposalValidationError("answer_review_consistency", "Answer relevance and clarification were inconsistent");
    }
    return { relevance, topic: checked("answer_topic", () => safeText(review.topic, 120)), excerpt, unresolved };
  })() : undefined;
  const mayAssess = !answerReview || answerReview.relevance === "direct";
  if (mayAssess && answerRef && output.assessment === null) throw new ProposalValidationError("followup_assessment_missing", "Follow-up assessment required");
  let assessment: InterviewTurn["assessment"] = null;
  if (mayAssess && output.assessment !== null) {
    if (!answerRef) throw new ProposalValidationError("assessment_before_answer", "Assessment requires an answer");
    const candidate = checked("assessment_shape", () => object(output.assessment, ["recommendation", "evidenceNeeded"]));
    const evidenceNeeded = candidate.evidenceNeeded === null ? null : checked("evidence_needed_text", () => safeText(candidate.evidenceNeeded, 280));
    if (!evidenceNeeded && previous?.answer?.disposition !== "provided") throw new ProposalValidationError("unanswered_readiness", "Unanswered gap cannot be planning evidence");
    if (answerReview && evidenceNeeded !== null) throw new ProposalValidationError("answer_review_consistency", "Unresolved scope requires clarification");
    assessment = { recommendation: checked("recommendation_text", () => safeText(candidate.recommendation, 380)), evidenceNeeded };
  }
  return { id, gapId: context.gap.id, question, rationale: checked("rationale_text", () => safeText(output.rationale, 280)), sourceIds: [...references],
    respondsTo: answerRef, generatorVersion: safeText(generatorVersion, 80), assessment,
    ...(answerReview && { answerReview }), at: new Date().toISOString() };
}

export function interviewAnswer(disposition: Answer["disposition"], value: unknown): Answer {
  if (!["provided", "unknown", "deferred"].includes(disposition) || (disposition !== "provided" && value !== null)) throw Error("Invalid interview answer");
  return { disposition, text: disposition === "provided" ? safeText(value, 900) : null, at: new Date().toISOString() };
}

export function interviewReadiness(gaps: readonly InterviewGap[], state: InterviewState) {
  return gaps.map(gap => {
    const finding = state.turns.findLast(turn => turn.gapId === gap.id && (turn.assessment || turn.answerReview));
    const deferred = finding?.answer && finding.answer.disposition !== "provided";
    const evidenceNeeded = finding?.answerReview?.unresolved ?? finding?.assessment?.evidenceNeeded ??
      (deferred ? "The follow-up evidence is still unresolved." : null);
    const planning = !!finding?.assessment && evidenceNeeded === null && state.failure?.gapId !== gap.id;
    return {
      gapId: gap.id, status: planning ? "planning-review" : "open",
      recommendation: finding?.assessment?.recommendation ?? null,
      evidenceNeeded,
      sourceIds: finding?.sourceIds ?? [],
      publication: "separate-approval-required",
    };
  });
}
