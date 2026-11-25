/**
 * Writing Facts to the one Knowledge: the Account's canonical Knowledge record (the same record
 * My Business shows), through the existing guarded canonical writers. Runs inside the caller's
 * transaction, so the workflow event that relies on the write commits with it or not at all.
 */
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { normalizeKnowledge } from "../canonical/model";
import { canonicalWritePool } from "../canonical/transaction";
import { inspectCanonical, writeCanonical, writeFoundationFacts } from "../canonical/writes";
import { factsIn, withFacts, withoutFacts, type Fact, type KnownFact } from "./facts";

/**
 * What the write left in Knowledge: the record's Version and fingerprint, and every Fact in it
 * at that Version. Workflows keep this receipt and check it against the record; it is never
 * edited on its own.
 */
export type KnowledgeReceipt = { recordId: string; version: number; fingerprint: string; at: string; written: string[]; facts: KnownFact[] };

export async function recordFacts(db: PoolClient, scope: { webPresenceId: string; managedSiteId: string }, facts: readonly Fact[],
  by: string, at: string, reason: string, remove: readonly string[] = []): Promise<KnowledgeReceipt> {
  if (!facts.length && !remove.length) throw Error("No Facts to record");
  const { rows: [record] } = await db.query<{ id: string }>("SELECT id FROM business_knowledge WHERE web_presence_id=$1", [scope.webPresenceId]);
  const recordId = record?.id ?? randomUUID();
  const current = record ? await inspectCanonical(db, "knowledge", scope.webPresenceId, recordId) : null;
  if (record && !current) throw Error("Knowledge record unavailable");
  const previous = current ? normalizeKnowledge(current.row.payload) : null;
  const added = withFacts(previous, facts, { by, at });
  const payload = remove.length && added ? withoutFacts(added, remove, { by, at }) : added;
  const input = { domain: "knowledge" as const, id: recordId, webPresenceId: scope.webPresenceId,
    expectedVersion: current?.row.version ?? null, expectedFingerprint: current?.fingerprint ?? null,
    payload, responsibleIdentity: by, changeReason: reason.slice(0, 1000) };
  const pool = canonicalWritePool(db);
  const { rows: [presence] } = await db.query<{ status: string }>("SELECT status FROM web_presences WHERE id=$1", [scope.webPresenceId]);
  if (presence?.status === "active") await writeCanonical(pool, input);
  else {
    // An Account still being set up: write through its exact bound foundation, Facts only.
    const { rows: [bound] } = await db.query<{ case_id: string; organization_id: string }>(
      "SELECT case_id, organization_id FROM activation_customer_bindings WHERE web_presence_id=$1 AND managed_site_id=$2", [scope.webPresenceId, scope.managedSiteId]);
    if (!bound) throw Error("No Account foundation for Knowledge");
    await writeFoundationFacts(pool, input, { caseId: bound.case_id, organizationId: bound.organization_id,
      webPresenceId: scope.webPresenceId, managedSiteId: scope.managedSiteId }, current?.row.payload ?? null);
  }
  const after = await inspectCanonical(db, "knowledge", scope.webPresenceId, recordId);
  if (!after) throw Error("Knowledge write not visible");
  return { recordId, version: after.row.version, fingerprint: after.fingerprint, at, written: [...facts.map(fact => fact.key), ...remove],
    facts: factsIn(normalizeKnowledge(after.row.payload)) };
}

/** The Facts in the Account's Knowledge record now. */
export async function currentFacts(db: Pick<PoolClient, "query">, webPresenceId: string) {
  const { rows: [record] } = await db.query<{ payload: unknown }>("SELECT payload FROM business_knowledge WHERE web_presence_id=$1", [webPresenceId]);
  return record ? factsIn(normalizeKnowledge(record.payload)) : [];
}
