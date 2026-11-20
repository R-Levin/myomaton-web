import type { PoolClient } from "pg";
import { fingerprint, normalizeKnowledge, object, text, uuid } from "./model";
import { inspectCanonical, writeCanonical } from "./writes";
import { canonicalWritePool } from "./transaction";
import type { CustomerAuthority } from "../content-editing/proposal";
import type { DeploymentSelection } from "../managed-sites/deployment";

export type KnowledgeTarget = { id: string; version: number; fingerprint: string; facts: {
  key: string; kind: string; value: string; publicUse: boolean;
}[] };
export type KnowledgeConfirmationInput = { correctionId: string; requestId: string;
  target: { id: string; key: string; version: number; fingerprint: string };
  value: string; confirmed: true; publicUse: boolean; reference: string };
export type KnowledgeConfirmation = { requestId: string; inputDigest: string; correctionId: string;
  recordId: string; key: string; kind: string; value: string; publicUse: boolean;
  previousVersion: number; previousFingerprint: string; previousValue: string;
  version: number; fingerprint: string; by: string; authorityReference: string; customer: CustomerAuthority; at: string };
export class KnowledgeConfirmationError extends Error {
  constructor(readonly code: "invalid" | "stale" | "authority") { super("Knowledge confirmation " + code); }
}
export function knowledgeConfirmationInput(value: unknown): KnowledgeConfirmationInput {
  try {
    const input = object(value, ["correctionId", "requestId", "target", "value", "confirmed", "publicUse", "reference"]);
    const target = object(input.target, ["id", "key", "version", "fingerprint"]);
    if (input.confirmed !== true || typeof input.publicUse !== "boolean" || !Number.isSafeInteger(target.version) || Number(target.version) < 1 ||
        typeof target.fingerprint !== "string" || !/^[a-f0-9]{64}$/u.test(target.fingerprint)) throw Error();
    return { correctionId: uuid(input.correctionId), requestId: uuid(input.requestId),
      target: { id: uuid(target.id), key: text(target.key, 64), version: Number(target.version), fingerprint: target.fingerprint },
      value: text(input.value, 2000, true), confirmed: true, publicUse: input.publicUse, reference: text(input.reference, 300) };
  } catch { throw new KnowledgeConfirmationError("invalid"); }
}

export async function knowledgeTargets(db: PoolClient, selection: DeploymentSelection): Promise<KnowledgeTarget[]> {
  const { rows } = await db.query("SELECT id FROM business_knowledge WHERE web_presence_id=$1 AND contract_version=1 ORDER BY id", [selection.webPresenceId]);
  return Promise.all(rows.map(async ({ id }) => {
    const current = await inspectCanonical(db, "knowledge", selection.webPresenceId, id);
    if (!current) throw new KnowledgeConfirmationError("stale");
    const payload = normalizeKnowledge(current.row.payload);
    return { id, version: current.row.version, fingerprint: current.fingerprint,
      facts: payload.entries.map(entry => ({ key: entry.key, kind: entry.kind, value: entry.value,
        publicUse: payload.approval.scope === "public" && entry.evidence.visibility === "public" })) };
  }));
}

/** Trusted service call: permission/customer authority is resolved independently
 * of the body. Existing classification stays fixed; no new public-use eligibility
 * or publication is silently granted while confirming a correction. */
export async function confirmKnowledge(db: PoolClient, selection: DeploymentSelection, input: KnowledgeConfirmationInput,
  actor: { id: string; authorityReference: string; customer: CustomerAuthority }, source: unknown, at: string): Promise<KnowledgeConfirmation> {
  const owned = await db.query(`SELECT m.id FROM managed_sites m JOIN web_presences w ON w.id=m.web_presence_id
    WHERE m.id=$1 AND w.id=$2 AND m.status='active' AND w.status='active'`, [selection.managedSiteId, selection.webPresenceId]);
  if (owned.rowCount !== 1) throw new KnowledgeConfirmationError("authority");
  const current = await inspectCanonical(db, "knowledge", selection.webPresenceId, input.target.id);
  if (!current || current.row.version !== input.target.version || current.fingerprint !== input.target.fingerprint) throw new KnowledgeConfirmationError("stale");
  const previous = normalizeKnowledge(current.row.payload), entry = previous.entries.find(item => item.key === input.target.key);
  if (!entry || input.publicUse !== (previous.approval.scope === "public" && entry.evidence.visibility === "public")) throw new KnowledgeConfirmationError("invalid");
  const evidence = { sourceKind: actor.customer.kind === "business-representative" ? "customer" as const : "operator" as const,
    sourceReference: JSON.stringify({ kind: "account-information-confirmation/1", correctionId: input.correctionId,
      requestId: input.requestId, source, authority: actor.authorityReference, customer: actor.customer, reference: input.reference }),
    confirmation: "confirmed" as const, visibility: entry.evidence.visibility,
    confirmedBy: actor.customer.subjectId, confirmedAt: at };
  const payload = { ...previous, entries: previous.entries.map(item => item.key !== entry.key ? item : { ...entry, value: input.value, evidence }),
    approval: { ...previous.approval, by: actor.id, at } };
  const result = await writeCanonical(canonicalWritePool(db), { domain: "knowledge", id: input.target.id,
    webPresenceId: selection.webPresenceId, expectedVersion: input.target.version, expectedFingerprint: input.target.fingerprint,
    payload, responsibleIdentity: actor.id, changeReason: `Confirmed business correction ${input.correctionId}; ${input.reference}` });
  const after = await inspectCanonical(db, "knowledge", selection.webPresenceId, input.target.id);
  if (!after || result.version !== after.row.version) throw new KnowledgeConfirmationError("stale");
  return { requestId: input.requestId, inputDigest: fingerprint(input), correctionId: input.correctionId,
    recordId: input.target.id, key: entry.key, kind: entry.kind, value: input.value, publicUse: input.publicUse,
    previousVersion: current.row.version, previousFingerprint: current.fingerprint, previousValue: entry.value,
    version: after.row.version, fingerprint: after.fingerprint, by: actor.id, authorityReference: actor.authorityReference, customer: actor.customer, at };
}
