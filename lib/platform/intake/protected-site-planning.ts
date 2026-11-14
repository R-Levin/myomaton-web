import { randomUUID } from "node:crypto";
import { choice, fingerprint, object, text } from "../canonical/model";
import type { Actor } from "../content-editing/proposal";
import { IntakeError } from "./model";
import { comparisonWorkDigest, replaySitePlanningResponse } from "./intelligent-responses";
import { PlanningFailureError, type PlanningFailure } from "./planning-diagnostics";
import type { PlanningAttempt, PlanningResponseCustody } from "./planning-response-custody";
import { readPresencePlan, type PresencePlan } from "./presence-plan";
import type { IntakeService, IntakeView } from "./service";
import type { PreparedPlanning, readSitePlanning } from "./site-planning";

type Generated = ReturnType<typeof readSitePlanning>;
type Improvement = { inquiryId: string; draftDigest: string; pagePath: string; synthetic: true };
type Decision = { status: "approved" | "rejected"; digest: string; actor: Actor; at: string; note: string };
type Action = Generated["evidence"][number]["action"];
export type SitePlanningReview = {
  pending?: { id: string; at: string; capture?: PlanningAttempt };
  recovery?: PlanningAttempt;
  failure?: PlanningFailure;
  proposal?: {
    generated: Generated;
    sources: PreparedPlanning["input"];
    model: string;
    at: string;
    basis: string;
    revision: number;
    changes?: Record<string, string>;
    routes?: Record<string, Action["destination"]>;
    improvement?: Improvement & { section: PresencePlan["pages"][number]["sections"][number] };
    decisions?: Decision[];
  };
};
type Proposal = NonNullable<SitePlanningReview["proposal"]>;

export function sitePlanningBasis(view: Pick<IntakeView, "answers" | "provenance" | "prepared" | "interview">) {
  const turns = view.interview?.turns ?? [];
  return fingerprint({ answers: view.answers, provenance: view.provenance, prepared: view.prepared, turns });
}

export function reviewedSitePlanning(proposal: Proposal) {
  const plan = structuredClone(proposal.generated.plan);
  const changes = proposal.changes ?? {};
  for (const key of ["positioning", "offering", "audience"] as const) plan[key] = changes[key] ?? plan[key];
  for (const [i, page] of plan.pages.entries()) {
    for (const key of ["title", "purpose", "seoDescription", "action"] as const) page[key] = changes[`${i}/${key}`] ?? page[key];
    for (const [j, section] of page.sections.entries()) {
      for (const key of ["heading", "body"] as const) section[key] = changes[`${i}/${j}/${key}`] ?? section[key];
    }
  }
  const actions = proposal.generated.evidence.map(({ path, action }, i) => ({
    ...action, from: path, label: plan.pages[i].action,
    destination: proposal.routes && Object.hasOwn(proposal.routes, path) ? proposal.routes[path] : action.destination,
  }));
  const { improvement } = proposal;
  if (improvement) plan.pages.find(page => page.path === improvement.pagePath)!.sections.push(improvement.section);
  const digest = fingerprint({ source: proposal.generated.digest, basis: proposal.basis, revision: proposal.revision, plan, actions, improvement: improvement ?? null });
  return { plan, actions, digest, decision: proposal.decisions?.findLast(item => item.digest === digest) };
}

type PlanningProvider = {
  model: string;
  input: (view: IntakeView) => Promise<PreparedPlanning>;
  generate: (project: () => Promise<PreparedPlanning>, retain?: (bytes: Buffer) => Promise<void>) => Promise<Generated>;
  format?: "compact/2" | "full";
  comparisonId?: string;
};

export class ProtectedSitePlanning {
  constructor(private intake: IntakeService, private provider?: PlanningProvider, private custody?: PlanningResponseCustody) {}

  async generate(token: string, version: number) {
    const provider = this.provider;
    if (!provider) throw new IntakeError("ai_authorization_required", 403);
    const original = await this.intake.resume(token).catch(error => {
      if (error instanceof IntakeError) throw error;
      throw new IntakeError("draft_persistence", 503);
    });
    if (original.version !== version) throw new IntakeError("draft_changed", 409);
    let projection: PreparedPlanning;
    try { projection = await provider.input(original); } catch { throw new IntakeError("ai_authorization_required", 403); }
    const attempt: PlanningAttempt = {
      id: randomUUID(), at: new Date().toISOString(), basis: sitePlanningBasis(original),
      ownerDigest: projection.ownerDigest, inputDigest: projection.inputDigest, model: provider.model,
      workDigest: comparisonWorkDigest(projection.inputDigest, provider.format === "compact/2", provider.comparisonId),
    };
    const custody = this.custody;
    if (custody) {
      try { await custody.ready(attempt); }
      catch { throw new IntakeError("custody_write", 503); }
    }
    try {
      await this.intake.editProtectedSitePlanning(token, version, (state, view) => {
        if (state.pending || state.proposal || state.recovery || view.interview?.pending ||
            sitePlanningBasis(view) !== attempt.basis) throw new IntakeError("draft_changed", 409);
        return { pending: { id: attempt.id, at: attempt.at, ...(custody && { capture: attempt }) } };
      });
    } catch (error) {
      if (error instanceof IntakeError) throw error;
      throw new IntakeError("draft_persistence", 503);
    }

    let retained = false;
    let next: SitePlanningReview;
    try {
      const generated = await provider.generate(async () => {
        const current = await this.intake.resume(token).catch(() => { throw new PlanningFailureError("draft_persistence"); });
        if (current.sitePlanning?.pending?.id !== attempt.id || sitePlanningBasis(current) !== attempt.basis) {
          throw new PlanningFailureError("evidence_changed");
        }
        const projected = await provider.input(current);
        if (projected.inputDigest !== projection.inputDigest || projected.ownerDigest !== projection.ownerDigest) {
          throw new PlanningFailureError("evidence_changed");
        }
        return projected;
      }, custody ? async bytes => {
        await custody.save(attempt, provider.format ?? "full", projection, bytes);
        retained = true;
      } : undefined);
      if (custody && !retained) throw new PlanningFailureError("custody_write");
      next = { proposal: this.proposal(attempt, generated, projection.input) };
    } catch (error) {
      const failure = error instanceof PlanningFailureError ? error.code :
        error instanceof Error && "code" in error && error.code === "output_token_limit" ? "output_token_limit" : "provider_transport";
      next = { failure, ...(custody && { recovery: attempt }) };
    }
    return this.settle(token, attempt, next);
  }

  private proposal(attempt: PlanningAttempt, generated: Generated, sources: PreparedPlanning["input"]): Proposal {
    if (generated.ownerDigest !== attempt.ownerDigest || generated.inputDigest !== attempt.inputDigest) {
      throw new PlanningFailureError("evidence_changed");
    }
    return { generated, sources, basis: attempt.basis, model: attempt.model, at: attempt.at, revision: 1 };
  }

  private async settle(token: string, attempt: PlanningAttempt, next: SitePlanningReview, version?: number): Promise<IntakeView> {
    const save = (state: SitePlanningReview) => this.intake.editProtectedSitePlanning(token, version, (current, view) => {
      if (current.proposal || (current.pending ?? current.recovery)?.id !== attempt.id) throw new IntakeError("draft_changed", 409);
      if (sitePlanningBasis(view) !== attempt.basis) {
        state = { failure: "evidence_changed", ...(this.custody && { recovery: attempt }) };
      }
      if (fingerprint(current) === fingerprint(state)) return current;
      return state;
    });
    try { return await save(next); }
    catch (error) {
      if (error instanceof IntakeError && error.code === "draft_changed") throw error;
      if (next.proposal) {
        // A lost DB acknowledgement can mean the write actually committed.
        const current = await this.intake.resume(token).catch(() => undefined);
        if (current?.sitePlanning?.proposal && fingerprint(current.sitePlanning.proposal) === fingerprint(next.proposal)) return current;
        const failure = error instanceof IntakeError && error.code === "payload_too_large" ? "draft_capacity" : "draft_persistence";
        try { return await save({ failure, ...(this.custody && { recovery: attempt }) }); }
        catch { throw new IntakeError("draft_persistence", 503); }
      }
      throw new IntakeError("draft_persistence", 503);
    }
  }

  async recover(token: string, version: number) {
    const current = await this.intake.resume(token);
    const state = current.sitePlanning;
    const pending = state?.pending;
    if (current.version !== version || !state || state.proposal ||
        (pending && Date.now() - Date.parse(pending.at) < 180_000)) throw new IntakeError("draft_changed", 409);
    if (!pending && !state.recovery) throw new IntakeError("draft_changed", 409);
    const attempt = pending?.capture ?? state.recovery;
    if (!attempt || !this.custody) {
      return this.intake.editProtectedSitePlanning(token, version, () => ({ failure: "interrupted" }));
    }
    // A recorded scope change is final for this capture. The receipt is checked separately.
    if (state.failure === "evidence_changed") return current;
    if (sitePlanningBasis(current) !== attempt.basis || fingerprint(this.intake.selection) !== attempt.ownerDigest) {
      return this.settle(token, attempt, { failure: "evidence_changed", recovery: attempt }, version);
    }
    let proposal: Proposal;
    try {
      const capture = await this.custody.read(attempt);
      if (!capture) throw new PlanningFailureError(state.failure ?? "interrupted");
      await this.custody.verifyReceipt(attempt, capture.bytes);
      const normalized = replaySitePlanningResponse(capture.bytes, capture.prepared, attempt.model, capture.format === "compact/2");
      proposal = this.proposal(attempt, normalized, capture.prepared.input);
    } catch (error) {
      const failure = error instanceof PlanningFailureError ? error.code : "response_decode";
      return this.settle(token, attempt, { failure, recovery: attempt }, version);
    }
    return this.settle(token, attempt, { proposal }, version);
  }

  private change(token: string, version: number, digest: unknown, change: (proposal: Proposal) => Proposal) {
    return this.intake.editProtectedSitePlanning(token, version, (state, view) => {
      if (!state.proposal || state.pending || state.proposal.basis !== sitePlanningBasis(view)
        || reviewedSitePlanning(state.proposal).digest !== digest) throw new IntakeError("draft_changed", 409);
      const proposal = change(state.proposal);
      return proposal === state.proposal ? state : { proposal };
    });
  }

  edit(token: string, version: number, digest: unknown, value: unknown, targets: unknown, editedImprovement?: unknown) {
    return this.change(token, version, digest, proposal => {
      const original = proposal.generated.plan;
      let plan: PresencePlan;
      let routes: Record<string, string | null> = {};
      try {
        plan = readPresencePlan(value);
        const paths = original.pages.map(page => page.path);
        if (fingerprint(plan.pages.map(page => [page.path, page.sections.length])) !==
            fingerprint(original.pages.map(page => [page.path, page.sections.length]))) throw Error("Generated Page layout changed");
        const routeInput = object(targets, paths);
        routes = Object.fromEntries(proposal.generated.evidence.flatMap(({ path, action }) => {
          const destination = routeInput[path];
          if (destination === null ? action.kind !== "request-contact" : typeof destination !== "string" ||
              !paths.includes(destination) || destination === path) throw Error("Visitor destination refused");
          return destination === action.destination ? [] : [[path, destination as string | null]];
        }));
      } catch { throw new IntakeError("invalid_request"); }
      const changes: Record<string, string> = {};
      const save = (key: string, next: string, previous: string) => { if (next !== previous) changes[key] = next; };
      for (const key of ["positioning", "offering", "audience"] as const) save(key, plan[key], original[key]);
      for (const [i, page] of plan.pages.entries()) {
        for (const key of ["title", "purpose", "seoDescription", "action"] as const) save(`${i}/${key}`, page[key], original.pages[i][key]);
        for (const [j, section] of page.sections.entries()) {
          for (const key of ["heading", "body"] as const) save(`${i}/${j}/${key}`, section[key], original.pages[i].sections[j][key]);
        }
      }
      let improvement = proposal.improvement;
      if (editedImprovement !== undefined) {
        if (!improvement) throw new IntakeError("invalid_request");
        try {
          const part = object(editedImprovement, ["heading", "body"]);
          improvement = { ...improvement, section: { heading: text(part.heading, 160, true), body: text(part.body, 1000, true) } };
        } catch { throw new IntakeError("invalid_request"); }
      }
      if (fingerprint(proposal.changes ?? {}) === fingerprint(changes) &&
          fingerprint(proposal.routes ?? {}) === fingerprint(routes) &&
          fingerprint(proposal.improvement ?? null) === fingerprint(improvement ?? null)) return proposal;
      return { ...proposal, changes, routes, ...(improvement && { improvement }), revision: proposal.revision + 1 };
    });
  }

  improve(token: string, version: number, digest: unknown, improvement: NonNullable<Proposal["improvement"]>) {
    return this.change(token, version, digest, proposal => {
      if (!proposal.generated.plan.pages.some(page => page.path === improvement.pagePath)) throw new IntakeError("invalid_request");
      if (proposal.improvement?.inquiryId === improvement.inquiryId && proposal.improvement.draftDigest === improvement.draftDigest &&
          proposal.improvement.pagePath === improvement.pagePath) return proposal;
      return { ...proposal, improvement, revision: proposal.revision + 1 };
    });
  }

  decide(token: string, version: number, digest: unknown, status: unknown, note: unknown, actor: Actor) {
    let review: Decision["status"], reason: string;
    try { review = choice(status, ["approved", "rejected"]); reason = text(note, 280); }
    catch { throw new IntakeError("invalid_request"); }
    return this.change(token, version, digest, proposal => ({
      ...proposal, decisions: [...proposal.decisions ?? [], { status: review, digest: digest as string, actor, at: new Date().toISOString(), note: reason }],
    }));
  }

  async delivery(token: string, version: unknown) {
    const view = await this.intake.resume(token);
    const proposal = view.sitePlanning?.proposal;
    if (view.version !== version || !proposal || proposal.basis !== sitePlanningBasis(view)) throw new IntakeError("draft_changed", 409);
    const review = reviewedSitePlanning(proposal);
    if (review.decision?.status !== "approved") throw new IntakeError("authorization_required", 403);
    if (review.actions.some(action => action.destination === null)) throw new IntakeError("action_destination_required", 409);
    const packet = { scope: this.intake.selection, origin: "ai-site-planning" as const, version: view.version,
      inputDigest: proposal.generated.inputDigest, generatedDigest: proposal.generated.digest, reviewedDigest: review.digest,
      decision: review.decision, plan: review.plan, actions: review.actions, evidence: proposal.generated.evidence,
      directionSourceIds: proposal.generated.directionSourceIds, unresolved: proposal.generated.unresolved,
      ...(proposal.improvement && { improvement: proposal.improvement }) };
    return { packet, digest: fingerprint(packet) };
  }
}
