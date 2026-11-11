import { randomUUID } from "node:crypto";
import type { ActivationService } from "../activation/service";
import { fingerprint } from "../canonical/model";
import type { Scope } from "../activation/model";
import { IntakeError } from "./model";
import type { IntakeService } from "./service";
import { interviewAnswer, interviewReadiness, ProposalValidationError, readProposal, type InterviewEvidence, type InterviewGap, type InterviewState, type QuestionContext, type QuestionProvider } from "./intelligent-model";

type ScopedEvidence = InterviewEvidence & Pick<Scope, "webPresenceId" | "managedSiteId">;
type Sources = { scope: Scope; evidence: ScopedEvidence[]; gaps: InterviewGap[] };
type Entry = { context: unknown; caseId: string; token: string };
const maxTurns = 4;
export type InterviewStage = { stage: "draft-reservation" | "provider" | "proposal-validation" | "draft-persistence"; code: string };

export class IntelligentOnboarding {
  private readonly sources: Sources;

  constructor(private readonly activation: ActivationService, private readonly intake: IntakeService, sources: Sources, private readonly provider: QuestionProvider) {
    // Trusted source loader supplies this narrow, sanitized projection. Retain
    // ownership and exact prepared inputs across all draft operations.
    this.sources = structuredClone(sources);
    const ids = new Set(sources.evidence.map(item => item.id));
    if (ids.size !== sources.evidence.length || new Set(sources.gaps.map(gap => gap.id)).size !== sources.gaps.length ||
        sources.evidence.some(item => !/^[a-z0-9-]{1,64}$/.test(item.id) ||
          item.webPresenceId !== sources.scope.webPresenceId || item.managedSiteId !== sources.scope.managedSiteId) ||
        sources.gaps.some(gap => !/^[a-z0-9-]{1,64}$/.test(gap.id) || !gap.sourceIds.length || gap.sourceIds.some(id => !ids.has(id))) ||
        Buffer.byteLength(JSON.stringify(sources)) > 9_000) throw Error("Invalid onboarding source projection");
  }

  private access(entry: Entry, open = false, change?: (state: InterviewState, version: number, path: QuestionContext["entryPath"], evidence: InterviewEvidence[]) => InterviewState) {
    return this.activation.withOnboardingDraft(entry.context, entry.caseId, this.sources.scope, (db, authority) => {
      const evidence = this.evidenceFor(authority.source.path, authority.review?.digest);
      const digest = fingerprint({ scope: this.sources.scope, gaps: this.sources.gaps, evidence });
      return this.intake.intelligentDraft(db, authority, entry.token, digest, open,
        change && ((state, version) => change(state, version, authority.source.path, evidence)));
    });
  }

  private evidenceFor(path: QuestionContext["entryPath"], reviewDigest?: string) {
    return this.sources.evidence.filter(item => item.kind === "owner-confirmed" || item.kind === "website-observation" ||
      (path === "FREE_REVIEW" && !!reviewDigest && (item.kind.startsWith("historical-review-") || item.reviewDigest === reviewDigest)))
      .map(({ id, kind, reference, at, statement }) => ({ id, kind, reference, at, statement }));
  }

  async open(entry: Entry) {
    const draft = await this.access(entry, true);
    return { ...draft, readiness: interviewReadiness(this.sources.gaps, draft.state) };
  }

  async resume(entry: Entry) {
    const draft = await this.access(entry);
    return { ...draft, readiness: interviewReadiness(this.sources.gaps, draft.state) };
  }

  async answer(entry: Entry, expectedVersion: number, questionId: string, disposition: "provided" | "unknown" | "deferred", value: unknown) {
    const answer = interviewAnswer(disposition, value);
    const draft = await this.access(entry, false, (state, version) => {
      this.expectVersion(version, expectedVersion);
      const question = state.turns.find(turn => turn.id === questionId);
      if (state.pending || !question?.question || question.answer || question !== state.turns.at(-1)) throw new IntakeError("question_unavailable", 409);
      return { ...state, turns: state.turns.map(turn => turn === question ? { ...turn, answer } : turn) };
    });
    return { ...draft, readiness: interviewReadiness(this.sources.gaps, draft.state) };
  }

  async propose(entry: Entry, expectedVersion: number, gapId: string, observe?: (stage: InterviewStage) => void) {
    const gap = this.sources.gaps.find(item => item.id === gapId);
    if (!gap) throw new IntakeError("invalid_request");
    const id = randomUUID();
    let input: QuestionContext | undefined;
    observe?.({ stage: "draft-reservation", code: "started" });
    const started = await this.access(entry, false, (state, version, entryPath, evidence) => {
      this.expectVersion(version, expectedVersion);
      const last = state.turns.at(-1);
      const history = state.turns.filter(turn => turn.gapId === gapId);
      if (state.pending || state.turns.length >= maxTurns || history.length >= 2 ||
          (last?.question && !last.answer)) throw new IntakeError("question_unavailable", 409);
      const selected = evidence.filter(item => gap.sourceIds.includes(item.id));
      if (!selected.length) throw new IntakeError("prepared_source_changed", 409);
      input = { entryPath, gap: { ...gap, sourceIds: selected.map(item => item.id) }, evidence: selected, history };
      return { ...state, pending: { id, gapId }, failure: null };
    });
    let turn: InterviewState["turns"][number] | undefined;
    let failure: InterviewState["failure"] = null;
    if (!input) throw Error("Reserved interview context missing");
    let rejection: InterviewStage | undefined;
    observe?.({ stage: "provider", code: "started" });
    try {
      const { webPresenceId, managedSiteId } = this.sources.scope;
      const result = await this.provider.propose(structuredClone(input), {
        ownerDigest: fingerprint({ webPresenceId, managedSiteId }), workDigest: fingerprint({ caseId: entry.caseId, id }),
      });
      try { turn = readProposal(result, input, id, this.provider.version, this.provider.reviewAnswers); }
      catch (error) {
        failure = { gapId, code: "invalid_output" };
        rejection = { stage: "proposal-validation", code: error instanceof ProposalValidationError ? error.code : "invalid_output" };
      }
    } catch {
      failure = { gapId, code: "provider_unavailable" };
      rejection = { stage: "provider", code: "unavailable" };
    }
    observe?.(rejection ?? { stage: "proposal-validation", code: "validated" });
    observe?.({ stage: "draft-persistence", code: "started" });
    const draft = await this.access(entry, false, (state, version) => {
      this.expectVersion(version, started.version);
      if (state.pending?.id !== id) throw new IntakeError("draft_changed", 409);
      return { turns: turn ? [...state.turns, turn] : state.turns, pending: null, failure };
    });
    observe?.(rejection ?? { stage: "draft-persistence", code: "saved" });
    return { ...draft, readiness: interviewReadiness(this.sources.gaps, draft.state) };
  }

  private expectVersion(actual: number, expected: number) {
    if (actual !== expected) throw new IntakeError("draft_changed", 409);
  }
}
