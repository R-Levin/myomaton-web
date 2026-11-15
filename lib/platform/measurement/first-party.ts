import type { Pool } from "pg";
import { choice, fingerprint, object, text, uuid } from "../canonical/model";
import type { DeploymentSelection } from "../managed-sites/deployment";

const kinds = ["page-observed", "action-selected", "contact-accepted"] as const;
type Kind = typeof kinds[number];
export type MeasurementSource = {
  id: string; selection: DeploymentSelection; environment: "synthetic" | "live"; activatedAt: string;
  coverage: readonly Kind[]; revision: string; routes: Readonly<Record<string, readonly string[]>>;
};

function timestamp(value: unknown) {
  const iso = text(value, 24);
  if (new Date(iso).toISOString() !== iso) throw Error("Invalid event time");
  return iso;
}
function scope(source: MeasurementSource) {
  if (!/^[a-f0-9]{64}$/u.test(source.revision)) throw Error("Measurement revision refused");
  return [uuid(source.selection.webPresenceId), uuid(source.selection.managedSiteId), uuid(source.id), source.environment, source.revision];
}

export class FirstPartyMeasurement {
  constructor(private pool: Pool, private clock = Date.now) {}

  async record(source: MeasurementSource, value: unknown) {
    const row = object(value, ["id", "kind", "at", "page", "action", "attribution"]);
    const event = {
      id: uuid(row.id), kind: choice(row.kind, kinds), at: timestamp(row.at), page: text(row.page, 120),
      action: row.action === null ? null : text(row.action, 160),
      attribution: row.attribution === null ? null : choice(row.attribution, ["direct-or-unattributed", "search", "referral", "campaign"]),
    };
    if (!Object.hasOwn(source.routes, event.page) || !source.coverage.includes(event.kind) ||
        event.at < timestamp(source.activatedAt) || Date.parse(event.at) > this.clock() ||
        (event.kind === "action-selected" ? !event.action || !source.routes[event.page].includes(event.action) : event.action !== null)) {
      throw Error("Measurement scope refused");
    }
    const parameters = scope(source);
    const digest = fingerprint(event);
    await this.pool.query(`
      INSERT INTO first_party_events (web_presence_id,managed_site_id,source_id,environment,revision,event_id,observed_at,kind,page,action,attribution,digest)
      SELECT web_presence_id,id,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12 FROM managed_sites WHERE web_presence_id=$1 AND id=$2
      ON CONFLICT DO NOTHING`, [...parameters, event.id, event.at, event.kind, event.page, event.action, event.attribution, digest]);
    const { rows: [stored] } = await this.pool.query<{ digest: string }>(`
      SELECT digest FROM first_party_events
      WHERE web_presence_id=$1 AND managed_site_id=$2 AND source_id=$3 AND environment=$4 AND revision=$5 AND event_id=$6`, [...parameters, event.id]);
    if (stored?.digest !== digest) throw Error("Conflicting or unscoped measurement receipt");
  }

  async snapshot(source: MeasurementSource, from: string, to: string) {
    const starts = timestamp(from), ends = timestamp(to), activatedAt = timestamp(source.activatedAt);
    if (starts >= ends || Date.parse(ends) > this.clock()) throw Error("Invalid measurement period");
    const { rows } = await this.pool.query<{ kind: Kind; count: number }>(`
      SELECT kind, count(*)::int AS count FROM first_party_events
      WHERE web_presence_id=$1 AND managed_site_id=$2 AND source_id=$3 AND environment=$4 AND revision=$5
      AND observed_at >= $6 AND observed_at < $7 GROUP BY kind`,
    [...scope(source), starts, ends]);
    const counts = Object.fromEntries(kinds.map(kind => [kind, source.coverage.includes(kind) && starts >= activatedAt
      ? rows.find(row => row.kind === kind)?.count ?? 0 : null])) as Record<Kind, number | null>;
    return { environment: source.environment, from: starts, to: ends, activatedAt, counts,
      notification: null, qualifiedLead: null, customerOutcome: null,
      recommendation: (counts["action-selected"] ?? 0) > 0 && counts["contact-accepted"] === 0
        ? { observation: "Selections were recorded and no Contact acceptance was observed in the covered period.",
          next: "Check that the selected Action leads to the intended inquiry path and the collector can observe acceptance.",
          remeasure: "Compare selections and accepted Contacts across the same covered surfaces after review.",
          limitation: "These counts do not establish abandonment or conversion." } : null };
  }
}
export type PerformanceSnapshot = Awaited<ReturnType<FirstPartyMeasurement["snapshot"]>>;
