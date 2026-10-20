import { mkdir, open, readFile, readdir, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import { fingerprint } from "../canonical/model";
import { binding, proposalOnly, proposalScope, revisionDigest, type Event, type ProposalState } from "./proposal";
import type { Scope } from "./authority";

export const proposalRoot = () => path.resolve("runtime-content/site-change-proposals");
// Same local append-only ledger pattern as LocalReviewStore. Separate evidence,
// existing Page/Section drafts inside immutable envelopes; no database persistence.
export class LocalProposalStore {
  private directory: string;
  constructor(readonly id: string, readonly scope: Scope) {
    proposalOnly(); binding({ proposalId: id, scope, revision: 1, digest: "0".repeat(64), baseFingerprint: "0".repeat(64) });
    this.directory = path.join(proposalRoot(), id);
  }
  private async check() {
    proposalOnly(); if (await realpath(proposalRoot()) !== proposalRoot() || await realpath(this.directory) !== this.directory) throw Error("Proposal filesystem redirect refused");
  }
  async locked<T>(create: boolean, fn: (state: ProposalState, append: (event: Omit<Event, "sequence" | "previous" | "hash">) => Promise<Event>) => Promise<T>): Promise<T> {
    proposalOnly();
    if (create) { await mkdir(proposalRoot(), { recursive: true, mode: 0o700 }); if (await realpath(proposalRoot()) !== proposalRoot()) throw Error("Proposal filesystem redirect refused"); await mkdir(this.directory, { recursive: true, mode: 0o700 }); }
    await this.check(); const lockPath = path.join(this.directory, "writer.lock"), lock = await open(lockPath, "wx", 0o600);
    try {
      const state = await this.read();
      return await fn(state, async event => {
        if (state.events.length >= 128) throw Error("Local proposal history limit");
        const body = { ...event, sequence: state.events.length + 1, previous: state.events.at(-1)?.hash ?? null };
        // Return the persisted JSON representation on first write as well as retry
        // (PostgreSQL timestamps otherwise remain Date objects only on first use).
        const next: Event = JSON.parse(JSON.stringify({ ...body, hash: fingerprint(body) }));
        const file = await open(path.join(this.directory, `${String(next.sequence).padStart(6, "0")}.json`), "wx", 0o600);
        try { await file.writeFile(JSON.stringify(next, null, 2)); await file.sync(); } finally { await file.close(); }
        return next;
      });
    } finally { await lock.close(); await unlink(lockPath); }
  }
  private async read(): Promise<ProposalState> {
    await this.check();
    const state: ProposalState = { id: this.id, scope: proposalScope(this.scope), revisions: [], events: [], state: "PROPOSED", approval: null, createdAt: "", updatedAt: "" };
    const names = (await readdir(this.directory)).filter(n => n !== "writer.lock").sort();
    if (names.length > 128) throw Error("Local proposal history limit");
    for (const name of names) {
      const event: Event = JSON.parse(await readFile(path.join(this.directory, name), "utf8")), { hash, ...body } = event;
      if (name !== `${String(state.events.length + 1).padStart(6, "0")}.json` || hash !== fingerprint(body) || event.sequence !== state.events.length + 1 || event.previous !== (state.events.at(-1)?.hash ?? null) || state.events.some(e => e.requestId === event.requestId)) throw Error("Broken proposal history");
      if (event.action === "revise" && event.revision && !event.preview && !event.approval) {
        const { binding: b, ...revision } = event.revision;
        binding(b);
        if (b.proposalId !== this.id || fingerprint(b.scope) !== fingerprint(this.scope) || b.revision !== state.revisions.length + 1 || b.digest !== revisionDigest(revision, { proposalId: b.proposalId, scope: b.scope, revision: b.revision, baseFingerprint: b.baseFingerprint }) || b.baseFingerprint !== fingerprint(revision.base) || fingerprint(revision.author) !== fingerprint(event.actor)) throw Error("Broken proposal revision");
        state.revisions.push(event.revision); state.approval = null; state.state = "PROPOSED";
      } else {
        const current = state.revisions.at(-1); if (!current || event.revision) throw Error("Missing proposal revision");
        if (event.action === "preview" && event.preview && !event.approval && fingerprint(event.preview.binding) === fingerprint(current.binding)) {
          // Preview records the exact full rendered candidate, not only its input.
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
}
