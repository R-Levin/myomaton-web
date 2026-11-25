import type { Pool } from "pg";
import { normalizeKnowledge, normalizeOffering } from "../canonical/model";

/**
 * Everything Core knows about an Account's business, as the engine gives it to its writer: every
 * entry of the one Knowledge record with its standing (confirmed or proposed) and whether it may
 * appear on the website, and the Client's active Offerings. Read from the same records My Business
 * shows; nothing is copied anywhere else.
 */
export type KnownItem = { key: string; kind: string; value: string; status: "confirmed" | "proposed"; forWebsite: boolean };
export type KnownOffering = { name: string; summary: string; detail: string; audiences: string[]; inclusions: string[]; exclusions: string[];
  status: "confirmed" | "proposed" };

export async function accountKnowledge(db: Pick<Pool, "query">, webPresenceId: string) {
  const [knowledge, offers] = await Promise.all([
    db.query("SELECT payload FROM business_knowledge WHERE web_presence_id=$1 AND contract_version=1 ORDER BY id", [webPresenceId]),
    db.query("SELECT name,payload FROM offerings WHERE web_presence_id=$1 AND status='active' AND contract_version=1 ORDER BY name,id", [webPresenceId]),
  ]);
  const items: KnownItem[] = knowledge.rows.flatMap(row => normalizeKnowledge(row.payload).entries.map(entry => ({
    key: entry.key, kind: entry.kind, value: entry.value,
    status: entry.evidence.confirmation === "confirmed" ? "confirmed" as const : "proposed" as const,
    forWebsite: entry.evidence.visibility === "public" })));
  const offerings: KnownOffering[] = offers.rows.map(row => {
    const offering = normalizeOffering(row.payload);
    return { name: String(row.name), summary: offering.summary, detail: offering.detail, audiences: offering.audiences,
      inclusions: offering.inclusions, exclusions: offering.exclusions,
      status: offering.evidence.confirmation === "confirmed" ? "confirmed" : "proposed" };
  });
  return { items, offerings };
}
