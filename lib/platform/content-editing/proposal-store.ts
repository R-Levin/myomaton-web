import { mkdir, open, readFile, readdir, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import { replayProposal, nextProposalEvent, type ProposalPersistence, type ProposalStore } from "./proposal-history";
import { binding, proposalOnly, type Event, type ProposalState } from "./proposal";
import type { Scope } from "./authority";

export const proposalRoot = () => path.resolve("runtime-content/site-change-proposals");
// Same local append-only ledger pattern as LocalReviewStore. Separate evidence,
// existing Page/Section drafts inside immutable envelopes; no database persistence.
export class LocalProposalStore implements ProposalStore {
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
        const next = nextProposalEvent(state, event);
        const file = await open(path.join(this.directory, `${String(next.sequence).padStart(6, "0")}.json`), "wx", 0o600);
        try { await file.writeFile(JSON.stringify(next, null, 2)); await file.sync(); } finally { await file.close(); }
        return next;
      });
    } finally { await lock.close(); await unlink(lockPath); }
  }
  private async read(): Promise<ProposalState> {
    await this.check();
    const names = (await readdir(this.directory)).filter(n => n !== "writer.lock").sort();
    if (names.some((name, i) => name !== String(i + 1).padStart(6, "0") + ".json")) throw Error("Broken proposal history");
    const events = await Promise.all(names.map(async name => JSON.parse(await readFile(path.join(this.directory, name), "utf8")) as Event));
    return replayProposal(this.id, this.scope, events);
  }
}

export const localProposalPersistence: ProposalPersistence = { kind: "local", open: (id, scope) => new LocalProposalStore(id, scope) };
