import { randomUUID } from "node:crypto";
import { choice, fingerprint, object, text } from "../canonical/model";
import type { Actor } from "../content-editing/proposal";
import { IntakeError } from "./model";
import { readPresencePlan, type PresencePlan } from "./presence-plan";
import type { IntakeService, IntakeView } from "./service";
import type { PreparedPlanning, readSitePlanning } from "./site-planning";

type Generated = ReturnType<typeof readSitePlanning>;
type Improvement = { inquiryId: string; draftDigest: string; pagePath: string; synthetic: true };
type Decision = { status: "approved" | "rejected"; digest: string; actor: Actor; at: string; note: string };
type Action = Generated["evidence"][number]["action"];
export type SitePlanningReview = {
  pending?: { id: string; at: string };
  failure?: "generation_failed" | "draft_capacity" | "interrupted" | "evidence_changed" | "output_token_limit";
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

export class ProtectedSitePlanning {
  constructor(private intake: IntakeService, private provider?: {
    model: string;
    input: (view: IntakeView) => Promise<PreparedPlanning>;
    generate: (project: () => Promise<PreparedPlanning>) => Promise<Generated>;
  }) {}

  async generate(token: string, version: number) {
    const provider = this.provider;
    if (!provider) throw new IntakeError("ai_authorization_required", 403);
    const original = await this.intake.resume(token);
    if (original.version !== version) throw new IntakeError("draft_changed", 409);
    const basis = sitePlanningBasis(original);
    try { await provider.input(original); } catch { throw new IntakeError("ai_authorization_required", 403); }
    const id = randomUUID();
    await this.intake.editProtectedSitePlanning(token, version, (state, view) => {
      if (state.pending || state.proposal || view.interview?.pending) throw new IntakeError("draft_changed", 409);
      return { pending: { id, at: new Date().toISOString() } };
    });
    let sources: PreparedPlanning["input"] | undefined;
    let generated: Generated | undefined;
    let generationFailure: SitePlanningReview["failure"] = "generation_failed";
    try {
      generated = await provider.generate(async () => {
        const current = await this.intake.resume(token);
        if (current.sitePlanning?.pending?.id !== id || sitePlanningBasis(current) !== basis) throw Error("Site planning evidence changed");
        const projected = await provider.input(current);
        sources = projected.input;
        return projected;
      });
    } catch (error) {
      // Keep the input and ledger intact, including an incomplete response reservation.
      if (error instanceof Error && "code" in error && error.code === "output_token_limit") generationFailure = error.code;
    }
    const settle = (proposal: Proposal | undefined, failure: SitePlanningReview["failure"]) =>
      this.intake.editProtectedSitePlanning(token, undefined, (state, view) => {
        if (state.pending?.id !== id) throw new IntakeError("draft_changed", 409);
        if (sitePlanningBasis(view) !== basis) return { failure: "evidence_changed" };
        return proposal ? { proposal } : { failure };
      });
    try {
      return await settle(generated && sources ? { generated, sources, basis, revision: 1, model: provider.model, at: new Date().toISOString() } : undefined, generationFailure);
    } catch (error) {
      if (!(error instanceof IntakeError) || error.code !== "payload_too_large") throw error;
      return settle(undefined, "draft_capacity");
    }
  }

  recover(token: string, version: number) {
    return this.intake.editProtectedSitePlanning(token, version, state => {
      if (!state.pending || Date.now() - Date.parse(state.pending.at) < 180_000) throw new IntakeError("draft_changed", 409);
      return { failure: "interrupted" };
    });
  }

  private change(token: string, version: number, digest: unknown, change: (proposal: Proposal) => Proposal) {
    return this.intake.editProtectedSitePlanning(token, version, (state, view) => {
      if (!state.proposal || state.pending || state.proposal.basis !== sitePlanningBasis(view)
        || reviewedSitePlanning(state.proposal).digest !== digest) throw new IntakeError("draft_changed", 409);
      return { proposal: change(state.proposal) };
    });
  }

  edit(token: string, version: number, digest: unknown, value: unknown, targets: unknown) {
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
      return { ...proposal, changes, routes, revision: proposal.revision + 1 };
    });
  }

  improve(token: string, version: number, digest: unknown, improvement: NonNullable<Proposal["improvement"]>) {
    return this.change(token, version, digest, proposal => {
      if (!proposal.generated.plan.pages.some(page => page.path === improvement.pagePath)) throw new IntakeError("invalid_request");
      if (proposal.improvement && fingerprint(proposal.improvement) === fingerprint(improvement)) return proposal;
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
