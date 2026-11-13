import { fingerprint } from "../canonical/model";
import type { QuestionContext } from "./intelligent-model";

export type AnswerScope = {
  approvedAnswerDigests: readonly string[];
  // An approved session may supply multiple curated answer projections.
  // Only exact approved text leaves Core.
  approvedProjections?: readonly { savedAnswerDigest: string; outboundText: string }[];
  interviewSession?: {
    endsAt: number;
    answers: readonly { turnId: string; savedAnswerDigest: string; outboundText: string }[];
  };
};

export function projectInterviewHistory(history: QuestionContext["history"], scope: AnswerScope, expiresAt?: number, now = Date.now()) {
  const session = scope.interviewSession;
  if (session && (!Number.isSafeInteger(session.endsAt) || expiresAt === undefined || session.endsAt > expiresAt ||
      !Array.isArray(session.answers) || new Set(session.answers.map(answer => answer.turnId)).size !== session.answers.length ||
      session.answers.some(answer => !/^[a-f0-9-]{36}$/u.test(answer.turnId) || !/^[a-f0-9]{64}$/u.test(answer.savedAnswerDigest) ||
        typeof answer.outboundText !== "string"))) throw Error("Invalid interview session authorization");
  function approvedText(outbound: string | null | undefined) {
    if (!outbound || !outbound.trim() || Buffer.byteLength(outbound, "utf8") > 900 || /[<>\x00-\x1f\x7f]/u.test(outbound)) {
      throw Error("Answer transmission not approved");
    }
    return outbound;
  }
  return history.map(turn => {
    if (!turn.answer || turn.answer.disposition !== "provided" || !turn.answer.text) throw Error("Answer transmission not approved");
    const digest = fingerprint(turn.answer.text);
    const eligible = session && session.endsAt > now
      ? session.answers.find(item => item.turnId === turn.id && item.savedAnswerDigest === digest) : undefined;
    const projection = eligible ?? scope.approvedProjections?.find(item => item.savedAnswerDigest === digest);
    const text = projection?.outboundText ?? (scope.approvedAnswerDigests.includes(digest) ? turn.answer.text : null);
    return { id: turn.id, question: turn.question, answer: { text: approvedText(text), disposition: turn.answer.disposition } };
  });
}
