import type { Pool } from "pg";
import { normalizeKnowledge, normalizeOffering, type Approval, type Evidence } from "../canonical/model";

type Revision = { version: number; snapshot: { payload: unknown; contract_version: number; name?: string; status?: string } };

function confirmedPublic(approval: Approval, evidence: Evidence) {
  return approval.scope === "public" && evidence.confirmation === "confirmed" && evidence.visibility === "public";
}

function earlierRevisions<T>(revisions: Revision[], current: string, display: (snapshot: Revision["snapshot"]) => { key: string; entry: T } | null) {
  const history: (T & { revision: number })[] = [];
  let previous = current;
  for (const { version, snapshot } of revisions) {
    if (snapshot.contract_version !== 1) break;
    const item = display(snapshot);
    if (!item) break;
    if (item.key !== previous) {
      history.push({ ...item.entry, revision: version });
      previous = item.key;
    }
  }
  return history;
}

// The caller resolves scope from its authenticated workspace, never a request field.
export async function readMyBusiness(database: Pick<Pool, "query">, webPresenceId: string) {
  const [knowledge, offers] = await Promise.all([
    database.query(`SELECT k.id, k.version, k.payload, COALESCE((
      SELECT jsonb_agg(jsonb_build_object('version', h.revision_version, 'snapshot', h.snapshot) ORDER BY h.revision_version DESC)
      FROM business_knowledge_revisions h WHERE h.web_presence_id=k.web_presence_id AND h.knowledge_id=k.id AND h.revision_version<k.version
    ), '[]'::jsonb) AS history FROM business_knowledge k WHERE k.web_presence_id=$1 AND k.contract_version=1 ORDER BY k.id`, [webPresenceId]),
    database.query(`SELECT o.id, o.version, o.name, o.payload, COALESCE((
      SELECT jsonb_agg(jsonb_build_object('version', h.revision_version, 'snapshot', h.snapshot) ORDER BY h.revision_version DESC)
      FROM offering_revisions h WHERE h.web_presence_id=o.web_presence_id AND h.offering_id=o.id AND h.revision_version<o.version
    ), '[]'::jsonb) AS history FROM offerings o WHERE o.web_presence_id=$1 AND o.status='active' AND o.contract_version=1 ORDER BY o.name, o.id`, [webPresenceId]),
  ]);
  const facts = knowledge.rows.flatMap(row => {
    const record = normalizeKnowledge(row.payload);
    return record.entries.filter(({ evidence }) => confirmedPublic(record.approval, evidence))
      .map(({ key, kind, value, evidence }) => ({
        id: `${row.id}:${key}`, kind, value, revision: Number(row.version), source: evidence.sourceKind, confirmedAt: evidence.confirmedAt!,
        history: earlierRevisions(row.history, value, snapshot => {
          const prior = normalizeKnowledge(snapshot.payload);
          const entry = prior.entries.find(item => item.key === key);
          return entry && confirmedPublic(prior.approval, entry.evidence)
            ? { key: entry.value, entry: { value: entry.value, confirmedAt: entry.evidence.confirmedAt! } } : null;
        }),
      }));
  });
  const offerings = offers.rows.flatMap(row => {
    const offering = normalizeOffering(row.payload);
    if (!confirmedPublic(offering.approval, offering.evidence)) return [];
    return [{ id: String(row.id), name: String(row.name), summary: offering.summary, revision: Number(row.version), source: offering.evidence.sourceKind,
      confirmedAt: offering.evidence.confirmedAt!, history: earlierRevisions(row.history, JSON.stringify([row.name, offering.summary]), snapshot => {
        if (snapshot.status !== "active" || !snapshot.name) return null;
        const prior = normalizeOffering(snapshot.payload);
        return confirmedPublic(prior.approval, prior.evidence) ? {
          key: JSON.stringify([snapshot.name, prior.summary]),
          entry: { name: snapshot.name, summary: prior.summary, confirmedAt: prior.evidence.confirmedAt! },
        } : null;
      }),
    }];
  });
  return { facts, offerings };
}

export type MyBusinessView = Awaited<ReturnType<typeof readMyBusiness>>;
