import { fingerprint } from "../canonical/model";
import type { QuestionContext } from "./intelligent-model";

export type AnswerScope = {
  approvedAnswerDigests: readonly string[];
  // An approved session may supply multiple curated answer projections.
  // Only exact approved text leaves Core.
  approvedProjections?: readonly { savedAnswerDigest: string; outboundText: string }[];
};

export function projectInterviewHistory(history: QuestionContext["history"], scope: AnswerScope) {
  return history.map(turn => {
    if (!turn.answer || turn.answer.disposition !== "provided" || !turn.answer.text) throw Error("Answer transmission not approved");
    const digest = fingerprint(turn.answer.text);
    const projection = scope.approvedProjections?.find(item => item.savedAnswerDigest === digest);
    const text = projection?.outboundText ?? (scope.approvedAnswerDigests.includes(digest) ? turn.answer.text : null);
    if (!text || Buffer.byteLength(text, "utf8") > 900 || /[<>\x00-\x1f\x7f]/u.test(text)) throw Error("Answer transmission not approved");
    return { id: turn.id, question: turn.question, answer: { text, disposition: turn.answer.disposition } };
  });
}
