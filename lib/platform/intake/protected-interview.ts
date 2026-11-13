import { randomUUID } from "node:crypto";
import { fingerprint } from "../canonical/model";
import { interviewAnswer, readProposal, type InterviewState, type QuestionContext, type QuestionProvider } from "./intelligent-model";
import { IntakeError } from "./model";
import type { IntakeService } from "./service";
import { readPresencePlan } from "./presence-plan";
import { interviewDirection } from "./interview-direction";

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

  async correctAnswer(token: string, version: number, questionId: unknown, value: unknown) {
    let answer;
    try { answer = interviewAnswer("provided", value); } catch { throw new IntakeError("invalid_request"); }
    return this.intake.editProtectedInterview(token, version, state => {
      const previous = state.turns.findLast(turn => turn.question && turn.answer);
      if (!previous || previous.id !== questionId || !previous.question || state.pending) throw new IntakeError("draft_changed", 409);
      if (previous.answer?.text === answer.text) return state;
      const turn = { id: randomUUID(), gapId: previous.gapId, question: previous.question, rationale: previous.rationale,
        sourceIds: previous.sourceIds.filter(id => !id.endsWith(":answer")), respondsTo: null,
        replacesAnswerTo: previous.id, generatorVersion: previous.generatorVersion, assessment: null, answer, at: answer.at };
      return { ...state, turns: [...state.turns, turn], failure: null };
    });
  }

  async editPlan(token: string, version: number, findingId: unknown, value: unknown, improvement?: NonNullable<InterviewState["reviewedPlan"]>["improvement"]) {
    let plan;
    try { plan = readPresencePlan(value); } catch { throw new IntakeError("invalid_request"); }
    return this.intake.editProtectedInterview(token, version, state => {
      const finding = interviewDirection(state.turns);
      if (!finding || findingId !== finding.findingId || state.pending) throw new IntakeError("draft_changed", 409);
      const prior = state.reviewedPlan?.findingId === finding.findingId ? state.reviewedPlan.improvement : undefined;
      return { ...state, reviewedPlan: { findingId: finding.findingId, plan, origin: finding.plan ? "model" : "operator", ...((improvement ?? prior) && { improvement: improvement ?? prior }) } };
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
      // The approved hosted grant permits only the current answer outbound.
      // Earlier answers, corrections and their assessments remain in Core.
      const history = last ? [last] : [];
      input = {
        entryPath: view.intent, evidence: this.approvedEvidence,
        gap: { id: gapId, questionPurpose: "Identify a missing fact about customers, offerings, service boundaries or trust that would materially change positioning, site content or a visitor decision.",
          sourceIds: this.approvedEvidence.map(source => source.id), known: state.turns.flatMap(turn => turn.question ? [turn.question] : []) },
        history,
      };
      return { ...state, pending: { id, gapId }, failure: null };
    });
    if (!input) throw Error("Interview reservation missing");
    const { webPresenceId, managedSiteId } = this.intake.selection;
    let turn: ReturnType<typeof readProposal> | undefined;
    let reason: string | undefined;
    let failure: "provider_unavailable" | "invalid_output" | undefined;
    try {
      const output = await this.provider.propose(input, {
        ownerDigest: fingerprint({ webPresenceId, managedSiteId }), workDigest: fingerprint({ id, webPresenceId, managedSiteId }),
      });
      try { turn = readProposal(output, input, id, this.provider.version, true); }
      catch (error) {
        failure = "invalid_output";
        const message = error instanceof Error ? error.message : "";
        const reasons: Record<string, string> = {
          "Interview evidence references invalid": "citations",
          "Repeated or invalid question": "question-form",
          "Initial question required": "question-missing",
          "Follow-up assessment required": "assessment-missing",
          "Assessment requires an answer": "premature-assessment",
          "Interview text validation failed": "text-validation",
          "Invalid canonical text": "text-validation",
          "Expected object": "output-shape",
          "Unknown canonical field": "unexpected-field",
          "Invalid proposed page set": "page-set",
          "Invalid proposed Page": "page-path-or-sections",
          "Proposed Home page required": "home-missing",
          "Unsafe Presence Direction copy": "unsafe-copy",
        };
        reason = Object.hasOwn(reasons, message) ? reasons[message] : "shape-or-length";
      }
    } catch { failure = "provider_unavailable"; }
    const settle = (result: typeof turn, failed: typeof failure) => this.intake.editProtectedInterview(token, reserved.version, state => {
      if (state.pending?.id !== id) throw new IntakeError("draft_changed", 409);
      return { ...state, turns: result ? [...state.turns, result] : state.turns, pending: null,
        failure: failed ? { gapId, code: failed, ...(reason && { reason }) } : null };
    });
    try { return await settle(turn, failure); }
    catch (error) {
      if (!turn || !(error instanceof IntakeError) || error.code !== "payload_too_large") throw error;
      reason = "draft-capacity";
      return settle(undefined, "invalid_output");
    }
  }
}
