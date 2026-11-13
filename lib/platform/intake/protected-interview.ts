import { randomUUID } from "node:crypto";
import { fingerprint } from "../canonical/model";
import { interviewAnswer, readProposal, type QuestionContext, type QuestionProvider } from "./intelligent-model";
import { IntakeError } from "./model";
import type { IntakeService } from "./service";

/** Both the review and dispatch use the current scoped, versioned intake. */
export class ProtectedInterview {
  constructor(private intake: IntakeService, private provider: QuestionProvider, private approvedEvidence: QuestionContext["evidence"]) {}

  async answer(token: string, version: number, questionId: unknown, value: unknown) {
    let answer;
    try { answer = interviewAnswer("provided", value); } catch { throw new IntakeError("invalid_request"); }
    return this.intake.editProtectedInterview(token, version, state => {
      const last = state.turns.at(-1);
      if (!last?.question || last.id !== questionId || last.answer || state.pending) throw new IntakeError("question_unavailable", 409);
      return { ...state, turns: [...state.turns.slice(0, -1), { ...last, answer }] };
    });
  }

  async next(token: string, version: number) {
    const id = randomUUID();
    const gapId = "presence-direction";
    let input: QuestionContext | undefined;
    const reserved = await this.intake.editProtectedInterview(token, version, (state, view) => {
      const last = state.turns.at(-1);
      if (state.pending || (last && (!last.question || !last.answer))) throw new IntakeError("question_unavailable", 409);
      // Leave room to save the response before reserving a provider request.
      // The existing row has a byte limit, independent of the number of turns.
      if (Buffer.byteLength(JSON.stringify(view.provenance)) + Buffer.byteLength(JSON.stringify(state)) > 10_000) {
        throw new IntakeError("payload_too_large", 413);
      }
      // Keep prior turns for readback. Send only the active question and answer
      // plus a duplicate-question index, never the raw retained capture.
      const history = last ? [last] : [];
      input = {
        entryPath: view.intent, evidence: this.approvedEvidence,
        gap: { id: gapId, questionPurpose: "Find the missing business detail most likely to change the site direction or visitor journey.",
          sourceIds: this.approvedEvidence.map(source => source.id), known: state.turns.flatMap(turn => turn.question ? [turn.question] : []) },
        history,
      };
      return { ...state, pending: { id, gapId }, failure: null };
    });
    if (!input) throw Error("Interview reservation missing");
    const { webPresenceId, managedSiteId } = this.intake.selection;
    let turn: ReturnType<typeof readProposal> | undefined;
    let failure: "provider_unavailable" | "invalid_output" | undefined;
    try {
      const output = await this.provider.propose(input, {
        ownerDigest: fingerprint({ webPresenceId, managedSiteId }), workDigest: fingerprint({ id, webPresenceId, managedSiteId }),
      });
      try { turn = readProposal(output, input, id, this.provider.version); }
      catch { failure = "invalid_output"; }
    } catch { failure = "provider_unavailable"; }
    return this.intake.editProtectedInterview(token, reserved.version, state => {
      if (state.pending?.id !== id) throw new IntakeError("draft_changed", 409);
      return { turns: turn ? [...state.turns, turn] : state.turns, pending: null,
        failure: failure ? { gapId, code: failure } : null };
    });
  }
}
