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
  propose(context: QuestionContext, attribution: QuestionAttribution): Promise<unknown>;
}

const safeText = (value: unknown, max: number) => {
  const result = text(value, max);
  if (/[<>\u0000-\u001f\u007f-\u009f]/u.test(result) || Buffer.byteLength(JSON.stringify(result)) > max + 2) throw Error("Interview text validation failed");
  return result;
};
const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
export function readProposal(value: unknown, context: QuestionContext, id: string, generatorVersion: string): InterviewTurn {
  const output = object(value, ["question", "rationale", "sourceIds", "assessment"]);
  const previous = context.history.at(-1);
  const answerRef = previous?.answer ? previous.id + ":answer" : null;
  const permitted = new Set(context.evidence.map(item => item.id));
  const references = output.sourceIds;
  if (answerRef) permitted.add(answerRef);
  if (!Array.isArray(references) || references.length < 1 || references.length > 6 ||
      new Set(references).size !== references.length || references.some(ref => typeof ref !== "string" || !permitted.has(ref)) ||
      !references.some(ref => context.gap.sourceIds.includes(ref)) || (answerRef && !references.includes(answerRef))) {
    throw Error("Interview evidence references invalid");
  }
  const question = output.question === null ? null : safeText(output.question, 420);
  const known = [...context.gap.known, ...context.history.flatMap(turn => turn.question ? [turn.question] : [])];
  if (question && (!question.endsWith("?") || known.some(prior => normalize(prior) === normalize(question)))) throw Error("Repeated or invalid question");
  if (!answerRef && !question) throw Error("Initial question required");
  if (answerRef && output.assessment === null) throw Error("Follow-up assessment required");
  let assessment: InterviewTurn["assessment"] = null;
  if (output.assessment !== null) {
    if (!answerRef) throw Error("Assessment requires an answer");
    const candidate = object(output.assessment, ["recommendation", "evidenceNeeded"]);
    const evidenceNeeded = candidate.evidenceNeeded === null ? null : safeText(candidate.evidenceNeeded, 280);
    if (!evidenceNeeded && previous?.answer?.disposition !== "provided") throw Error("Unanswered gap cannot be planning evidence");
    assessment = { recommendation: safeText(candidate.recommendation, 380), evidenceNeeded };
  }
  return { id, gapId: context.gap.id, question, rationale: safeText(output.rationale, 280), sourceIds: [...references],
    respondsTo: answerRef, generatorVersion: safeText(generatorVersion, 80), assessment, at: new Date().toISOString() };
}

export function interviewAnswer(disposition: Answer["disposition"], value: unknown): Answer {
  if (!["provided", "unknown", "deferred"].includes(disposition) || (disposition !== "provided" && value !== null)) throw Error("Invalid interview answer");
  return { disposition, text: disposition === "provided" ? safeText(value, 900) : null, at: new Date().toISOString() };
}

export function interviewReadiness(gaps: readonly InterviewGap[], state: InterviewState) {
  return gaps.map(gap => {
    const finding = state.turns.findLast(turn => turn.gapId === gap.id && turn.assessment);
    const deferred = finding?.answer && finding.answer.disposition !== "provided";
    const evidenceNeeded = finding?.assessment?.evidenceNeeded ?? (deferred ? "The follow-up evidence is still unresolved." : null);
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
