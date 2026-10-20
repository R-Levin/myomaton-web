import type { Pool } from "pg";
import { choice, fingerprint, object, text, uuid } from "../canonical/model";
import type { Scope } from "./authority";
import { binding, hash, pageProposal, proposalOnly, proposalScope, revisionDigest, type Actor, type Binding, type CustomerAuthority, type PageProposal, type Permission, type ProposalAuthority, type ProposalState, type Revision } from "./proposal";
import { proposalSnapshot, resolvePage } from "./proposal-context";
import { LocalProposalStore } from "./proposal-store";
import { proposalPreview } from "./proposal-preview";

// Trusted private composition root only. No default grant, HTTP/Server Action,
// canonical/content writer, release operation or production authentication claim.
export class SiteProposalService {
  constructor(private pool: Pool, private authority: ProposalAuthority) {}
  private async actor(context: unknown, operation: Permission, scope: Scope) {
    proposalOnly(); const grant = await this.authority.authorize(context, operation, structuredClone(scope));
    object(grant, ["operatorId", "authorityReference", "customer"]);
    const actor: Actor = { operatorId: text(grant.operatorId), authorityReference: text(grant.authorityReference, 300) };
    let customer: CustomerAuthority | undefined;
    if (operation === "approve-site-proposal") {
      const c = object(grant.customer, ["kind", "subjectId", "authorityReference"]);
      customer = { kind: choice(c.kind, ["business-representative", "accepted-authority"]), subjectId: text(c.subjectId), authorityReference: text(c.authorityReference, 500) };
    }
    return { actor, customer };
  }
  private exact(state: ProposalState, expected: Binding) {
    if (fingerprint(state.revisions.at(-1)?.binding) !== fingerprint(expected)) throw Error("Stale proposal revision/digest/destination");
  }
  private retry(state: ProposalState, requestId: string, digest: string, actor: Actor) {
    const previous = state.events.find(e => e.requestId === requestId);
    if (previous && (previous.requestDigest !== digest || fingerprint(previous.actor) !== fingerprint(actor))) throw Error("Proposal idempotency conflict");
    return previous;
  }
  async prepare(context: unknown, id: string, selection: Scope, requestId: string, value: PageProposal, expected: Binding | null = null) {
    id = uuid(id); requestId = uuid(requestId); const scope = proposalScope(selection), page = pageProposal(structuredClone(value));
    const before = expected === null ? null : binding(expected), { actor } = await this.actor(context, before ? "revise-site-proposal" : "prepare-site-proposal", scope);
    const digest = fingerprint({ operation: "revise", id, scope, requestId, page, expected: before });
    return new LocalProposalStore(id, scope).locked(before === null, async (state, append) => {
      const retry = this.retry(state, requestId, digest, actor); if (retry) return retry;
      if (before) this.exact(state, before); else if (state.events.length) throw Error("Existing proposal requires exact revision");
      return proposalSnapshot(this.pool, scope, async (c, base) => {
        const { candidate, resolved, baseFingerprint } = await resolvePage(c, scope, page, base);
        const identity = { proposalId: id, scope, revision: state.revisions.length + 1, baseFingerprint };
        const body = { at: new Date().toISOString(), author: actor, page, resolved, candidate, base };
        const revision: Revision = { ...body, binding: { ...identity, digest: revisionDigest(body, identity) } };
        return append({ requestId, requestDigest: digest, action: "revise", actor, at: revision.at, revision });
      });
    });
  }
  async inspect(context: unknown, id: string, selection: Scope) {
    const scope = proposalScope(selection); await this.actor(context, "inspect-site-proposal", scope);
    return new LocalProposalStore(uuid(id), scope).locked(false, async state => {
      if (!state.revisions.length) throw Error("Missing proposal");
      return proposalSnapshot(this.pool, scope, async (_c, base) => {
        const stale = fingerprint(base) !== state.revisions.at(-1)!.binding.baseFingerprint;
        const previewMatches = state.approval !== null && fingerprint(proposalPreview(state.revisions.at(-1)!)) === state.approval.previewDigest;
        return { ...state, stale, approvalValid: state.state === "APPROVED" && !stale && previewMatches, published: false as const };
      });
    });
  }
  async preview(context: unknown, expectedValue: Binding, requestId: string) {
    const expected = binding(expectedValue), { actor } = await this.actor(context, "preview-site-proposal", expected.scope); requestId = uuid(requestId);
    return new LocalProposalStore(expected.proposalId, expected.scope).locked(false, async (state, append) => {
      const requestDigest = fingerprint({ operation: "preview", expected, requestId });
      const retry = this.retry(state, requestId, requestDigest, actor); this.exact(state, expected);
      return proposalSnapshot(this.pool, expected.scope, async (c, base) => {
        if (fingerprint(base) !== expected.baseFingerprint) throw Error("Stale site base; explicit refresh/new revision required");
        const r = state.revisions.at(-1)!, resolved = await resolvePage(c, expected.scope, r.page, base);
        if (fingerprint(resolved.candidate) !== fingerprint(r.candidate) || fingerprint(resolved.resolved) !== fingerprint(r.resolved)) throw Error("Changed proposal canonical source");
        const html = proposalPreview(r), digest = fingerprint(html);
        const event = retry ?? await append({ requestId, requestDigest, action: "preview", actor, at: new Date().toISOString(), preview: { binding: expected, digest } });
        if (event.preview?.digest !== digest) throw Error("Preview renderer changed; new preview required");
        return { html, digest, event: event.hash, binding: expected };
      });
    });
  }
  async approve(context: unknown, value: { binding: Binding; requestId: string; previewDigest: string; previewEvent: string; reference: string }) {
    const input = object(structuredClone(value), ["binding", "requestId", "previewDigest", "previewEvent", "reference"]);
    const expected = binding(input.binding), requestId = uuid(input.requestId), previewDigest = hash(input.previewDigest), previewEvent = hash(input.previewEvent), reference = text(input.reference, 500);
    const { actor, customer } = await this.actor(context, "approve-site-proposal", expected.scope);
    const requestDigest = fingerprint({ operation: "approve", expected, requestId, previewDigest, previewEvent, reference, customer });
    return new LocalProposalStore(expected.proposalId, expected.scope).locked(false, async (state, append) => {
      const retry = this.retry(state, requestId, requestDigest, actor); this.exact(state, expected);
      if (state.state !== "PROPOSED" && !retry) throw Error("Proposal already approved");
      const preview = state.events.find(e => e.hash === previewEvent);
      if (!preview?.preview || preview.preview.digest !== previewDigest || fingerprint(preview.preview.binding) !== fingerprint(expected)) throw Error("Exact reviewed preview required");
      return proposalSnapshot(this.pool, expected.scope, async (c, base) => {
        if (fingerprint(base) !== expected.baseFingerprint) throw Error("Stale site base; explicit refresh/new revision required");
        const r = state.revisions.at(-1)!, resolved = await resolvePage(c, expected.scope, r.page, base);
        if (fingerprint(resolved.candidate) !== fingerprint(r.candidate) || fingerprint(resolved.resolved) !== fingerprint(r.resolved) || fingerprint(proposalPreview(r)) !== previewDigest) throw Error("Changed candidate/renderer; inspect a new preview");
        if (retry) return retry;
        const at = new Date().toISOString();
        return append({ requestId, requestDigest, action: "approve", actor, at, approval: { binding: expected, previewDigest, previewEvent, recordedBy: actor, customer: customer!, reference, at } });
      });
    });
  }
  async publish(): Promise<never> { throw Error("Publication is not implemented or authorized by site proposals"); }
}
