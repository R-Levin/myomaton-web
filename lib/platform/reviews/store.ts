import { mkdir, readFile, readdir, open, unlink, realpath } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fingerprint, object, text } from "../canonical/model";
import { assertOwner, developmentOnly, qualityChecks, validateDraft, validatePacket, type Owner, type ReviewDraft, type ReviewEvidencePacket } from "./model";

export type Revision = { number: number; content: ReviewDraft; digest: string; source: "development-manual" | "operator-edit"; at: string; actor: string };
export type Binding = { revision: number; revisionDigest: string; submissionDigest: string; evidenceDigest: string };
export type ReviewState = { id: string; packet: ReviewEvidencePacket; state: "DRAFT" | "NEEDS_OPERATOR_REVIEW" | "APPROVED"; revisions: Revision[]; decisions: Event[] };
type Event = { sequence: number; previous: string | null; action: "create" | "edit" | "request-review" | "approve"; actor: string; at: string; note: string; binding: Binding; revision?: Revision; checks?: Record<string, boolean>; hash: string };
const actions = ["create", "edit", "request-review", "approve"];
export const reviewRoot = () => path.resolve("runtime-content/review-synthesis");
const binding = (packet: ReviewEvidencePacket, revision: Revision): Binding => ({ revision: revision.number, revisionDigest: revision.digest, submissionDigest: packet.submission.digest, evidenceDigest: packet.digest });
// Local append-only evidence store, NOT a production/shared database adapter.
// No database imports, provider calls, customer writer or HTTP mutation surface.
export class LocalReviewStore {
  private directory: string;
  constructor(readonly id: string, readonly owner: Owner) { developmentOnly(); if (!/^[a-f0-9-]{36}$/.test(id)) throw Error("Invalid Review identity"); this.directory = path.join(reviewRoot(), id); }
  private async directoryCheck() { if (await realpath(this.directory) !== this.directory || await realpath(reviewRoot()) !== reviewRoot()) throw Error("Review filesystem redirect refused"); }
  static async create(packet: ReviewEvidencePacket, content: unknown, actor: string) {
    developmentOnly(); validatePacket(packet); validateDraft(content, packet);
    await mkdir(reviewRoot(), { recursive: true, mode: 0o700 }); const store = new LocalReviewStore(randomUUID(), packet.owner);
    await mkdir(store.directory, { mode: 0o700 }); await store.directoryCheck();
    const file = await open(path.join(store.directory, "packet.json"), "wx", 0o600); try { await file.writeFile(JSON.stringify(packet, null, 2)); await file.sync(); } finally { await file.close(); }
    await store.append("create", null, content, actor, "Initial development/manual draft"); return store;
  }
  async read(): Promise<ReviewState> {
    developmentOnly(); await this.directoryCheck();
    const packet = JSON.parse(await readFile(path.join(this.directory, "packet.json"), "utf8")) as ReviewEvidencePacket; validatePacket(packet); assertOwner(packet.owner, this.owner);
    const names = (await readdir(this.directory)).filter(f => /^\d{6}\.json$/.test(f)).sort();
    if (names.length > 128) throw Error("Development Review history limit");
    const result: ReviewState = { id: this.id, packet, state: "DRAFT", revisions: [], decisions: [] }; let previous: string | null = null;
    for (const name of names) {
      const event = JSON.parse(await readFile(path.join(this.directory, name), "utf8")) as Event;
      object(event, ["sequence", "previous", "action", "actor", "at", "note", "binding", "revision", "checks", "hash"]);
      if (!actions.includes(event.action)) throw Error("Unsupported Review action");
      const { hash, ...body } = event;
      if (fingerprint(body) !== hash || event.previous !== previous || event.sequence !== result.decisions.length + 1 || name !== String(event.sequence).padStart(6, "0") + ".json") throw Error("Broken Review history");
      if (event.revision) {
        if (!["create", "edit"].includes(event.action) || event.revision.number !== result.revisions.length + 1 || fingerprint(validateDraft(event.revision.content, packet)) !== event.revision.digest) throw Error("Invalid immutable revision");
        result.revisions.push(event.revision); result.state = "DRAFT";
      }
      const revision = result.revisions.at(-1); if (!revision || fingerprint(event.binding) !== fingerprint(binding(packet, revision))) throw Error("Changed approval/source binding");
      if (event.action === "request-review") { if (result.state !== "DRAFT") throw Error("Invalid queue transition"); result.state = "NEEDS_OPERATOR_REVIEW"; }
      if (event.action === "approve") { if (result.state !== "NEEDS_OPERATOR_REVIEW" || !qualityChecks.every(k => event.checks?.[k] === true)) throw Error("Invalid approval transition/QC"); result.state = "APPROVED"; }
      result.decisions.push(event); previous = hash;
    }
    return result;
  }
  async currentBinding() { const r = await this.read(); return binding(r.packet, r.revisions.at(-1)!); }
  async append(action: Event["action"], expected: Binding | null, content: unknown, actor: string, note: string, checks?: Record<string, boolean>) {
    developmentOnly(); await this.directoryCheck(); actor = text(actor, 160); note = text(note, 800);
    if (!actions.includes(action)) throw Error("Unsupported Review action");
    const lock = path.join(this.directory, "writer.lock"), handle = await open(lock, "wx", 0o600);
    try {
      const r = await this.read(), current = r.revisions.at(-1);
      if (r.decisions.length >= 128 || action === "edit" && r.revisions.length >= 32) throw Error("Development Review history limit");
      if (action === "create" ? r.decisions.length !== 0 || expected !== null : !current || fingerprint(expected) !== fingerprint(binding(r.packet, current))) throw Error("Stale/superseded Review revision");
      if (action === "request-review" && r.state !== "DRAFT" || action === "approve" && r.state !== "NEEDS_OPERATOR_REVIEW") throw Error("Invalid Review state");
      if (action === "approve") { object(checks, qualityChecks); if (!qualityChecks.every(k => checks?.[k] === true)) throw Error("All operator QC checks required"); }
      const at = new Date().toISOString(); let revision = current;
      if (action === "create" || action === "edit") { const draft = validateDraft(content, r.packet); revision = { number: r.revisions.length + 1, content: draft, digest: fingerprint(draft), source: action === "create" ? "development-manual" : "operator-edit", at, actor }; }
      if (!revision) throw Error("Missing Review revision");
      const body = { sequence: r.decisions.length + 1, previous: r.decisions.at(-1)?.hash ?? null, action, actor, at, note, binding: binding(r.packet, revision), ...(["create", "edit"].includes(action) ? { revision } : {}), ...(action === "approve" ? { checks } : {}) };
      const file = await open(path.join(this.directory, String(body.sequence).padStart(6, "0") + ".json"), "wx", 0o600);
      try { await file.writeFile(JSON.stringify({ ...body, hash: fingerprint(body) }, null, 2)); await file.sync(); } finally { await file.close(); }
    } finally { await handle.close(); await unlink(lock); }
    return this.read();
  }
}
