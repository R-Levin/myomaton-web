import type { PoolClient } from "pg";
import type { Scope } from "./authority";
import { fingerprint } from "../canonical/model";
import { binding, proposalScope, revisionDigest, type Event, type ProposalState } from "./proposal";

export type AppendProposalEvent = (event: Omit<Event, "sequence" | "previous" | "hash">) => Promise<Event>;
export interface ProposalStore {
  locked<T>(create: boolean, fn: (state: ProposalState, append: AppendProposalEvent, client?: PoolClient) => Promise<T>): Promise<T>;
}
export interface ProposalPersistence {
  readonly kind: "local" | "postgres";
  open(id: string, scope: Scope): ProposalStore;
}
export function nextProposalEvent(state: ProposalState, event: Parameters<AppendProposalEvent>[0]): Event {
  if (state.events.length >= 128) throw Error("Proposal history limit");
  const body = { ...event, sequence: state.events.length + 1, previous: state.events.at(-1)?.hash ?? null };
  return JSON.parse(JSON.stringify({ ...body, hash: fingerprint(body) }));
}
// One replay/validation implementation for filesystem, PostgreSQL and recovery.
export function replayProposal(id: string, scope: Scope, events: Event[]): ProposalState {
  const state: ProposalState = { id, scope: proposalScope(scope), revisions: [], events: [], state: "PROPOSED", approval: null, createdAt: "", updatedAt: "" };
  if (events.length > 128) throw Error("Proposal history limit");
  for (const event of events) {
    const { hash, ...body } = event;
    if (hash !== fingerprint(body) || event.sequence !== state.events.length + 1 || event.previous !== (state.events.at(-1)?.hash ?? null) || state.events.some(e => e.requestId === event.requestId)) throw Error("Broken proposal history");
    if (event.action === "revise" && event.revision && !event.preview && !event.approval) {
      const { binding: b, ...revision } = event.revision; binding(b);
      if (b.proposalId !== id || fingerprint(b.scope) !== fingerprint(scope) || b.revision !== state.revisions.length + 1 || b.digest !== revisionDigest(revision, { proposalId: b.proposalId, scope: b.scope, revision: b.revision, baseFingerprint: b.baseFingerprint }) || b.baseFingerprint !== fingerprint(revision.base) || fingerprint(revision.author) !== fingerprint(event.actor)) throw Error("Broken proposal revision");
      state.revisions.push(event.revision); state.approval = null; state.state = "PROPOSED";
    } else {
      const current = state.revisions.at(-1); if (!current || event.revision) throw Error("Missing proposal revision");
      if (event.action === "preview" && event.preview && !event.approval && fingerprint(event.preview.binding) === fingerprint(current.binding)) {
        // Exact rendered candidate identity is retained in the immutable event.
      } else if (event.action === "approve" && event.approval && !event.preview && state.state === "PROPOSED") {
        const a = event.approval, preview = state.events.find(e => e.hash === a.previewEvent);
        if (fingerprint(a.binding) !== fingerprint(current.binding) || preview?.action !== "preview" || preview.preview?.digest !== a.previewDigest || fingerprint(preview.preview.binding) !== fingerprint(current.binding) || fingerprint(a.recordedBy) !== fingerprint(event.actor)) throw Error("Broken exact proposal approval");
        state.approval = a; state.state = "APPROVED";
      } else throw Error("Unsupported proposal event/publication refused");
    }
    state.events.push(event); state.createdAt ||= event.at; state.updatedAt = event.at;
  }
  return state;
}
