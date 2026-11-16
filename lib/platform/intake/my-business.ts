import type { Pool } from "pg";
import { normalizeKnowledge, normalizeOffering } from "../canonical/model";

// The caller resolves scope from its authenticated workspace, never a request field.
export async function readMyBusiness(database: Pick<Pool, "query">, webPresenceId: string) {
  const [knowledge, offers] = await Promise.all([
    database.query("SELECT id, version, payload FROM business_knowledge WHERE web_presence_id = $1 ORDER BY id", [webPresenceId]),
    database.query("SELECT id, version, name, payload FROM offerings WHERE web_presence_id = $1 AND status = 'active' ORDER BY name, id", [webPresenceId]),
  ]);
  const facts = knowledge.rows.flatMap(row => {
    const record = normalizeKnowledge(row.payload);
    if (record.approval.scope !== "public") return [];
    return record.entries.filter(({ evidence }) => evidence.confirmation === "confirmed" && evidence.visibility === "public")
      .map(({ key, kind, value, evidence }) => ({
        id: `${row.id}:${key}`, kind, value, revision: Number(row.version), source: evidence.sourceKind, confirmedAt: evidence.confirmedAt!,
      }));
  });
  const offerings = offers.rows.flatMap(row => {
    const offering = normalizeOffering(row.payload);
    if (offering.evidence.confirmation !== "confirmed" || offering.evidence.visibility !== "public" || offering.approval.scope !== "public") return [];
    return [{ id: String(row.id), name: String(row.name), summary: offering.summary, revision: Number(row.version), source: offering.evidence.sourceKind,
      confirmedAt: offering.evidence.confirmedAt! }];
  });
  return { facts, offerings };
}

export type MyBusinessView = Awaited<ReturnType<typeof readMyBusiness>>;
