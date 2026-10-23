import { isIP } from "node:net";
import type { Pool } from "pg";
import { deploymentSelection, type DeploymentSelection } from "./deployment";

type Environment = Record<string, string | undefined>;
export type TenantContext = Readonly<DeploymentSelection & {
  organizationId: string; bindingId: string | null; hostname: string | null;
  domain: string; managedSiteName: string;
}>;
export class UnavailableHostname extends Error {
  constructor() { super("Unavailable hostname"); }
}
// ASCII DNS names only. IDNs (including punycode), IP literals and bare names are
// deliberately deferred. A single final dot and a valid TCP port are normalized.
export function normalizeHostname(authority: string | null): string {
  if (!authority || authority.length > 260 || /[^A-Za-z0-9.:-]/.test(authority)) throw new UnavailableHostname();
  const match = /^([^:]+)(?::([0-9]{1,5}))?$/.exec(authority);
  if (!match || match[2] && (+match[2] < 1 || +match[2] > 65535)) throw new UnavailableHostname();
  const hostname = match[1].replace(/\.$/, "").toLowerCase();
  const labels = hostname.split(".");
  if (hostname.length > 253 || isIP(hostname) || /^[0-9.]+$/.test(hostname) || labels.length < 2 || labels.some(label =>
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label) || label.startsWith("xn--"))) throw new UnavailableHostname();
  return hostname;
}
export function routingMode(env: Environment = process.env) {
  const mode = env.MIOPAGES_ROUTING_MODE ?? (env.NODE_ENV === "production" ? "" : "local-single-site");
  if (mode === "shared-hostnames") {
    if (env.WEB_PRESENCE_ID || env.MANAGED_SITE_ID) throw Error("Shared hostname mode refuses environment tenant bindings");
    return mode;
  }
  if (mode === "local-single-site" && env.NODE_ENV !== "production") return mode;
  if (mode === "disposable-single-site") {
    const url = new URL(env.DATABASE_URL ?? "postgresql://invalid");
    if (url.hostname === "127.0.0.1" && (url.port || "5432") !== "5432" &&
      /^-c search_path=(?:canonical_test|myomaton_(?:asset_test|rename_test|contact_test|visual_test))_[a-f0-9]{32}(?:_\w+)?(?: -c default_transaction_read_only=on)?$/.test(url.searchParams.get("options") ?? "")) return mode;
  }
  throw Error("Explicit shared-hostnames production routing required");
}
export async function resolveTenant(pool: Pick<Pool, "query">, headers: Pick<Headers, "get">, env: Environment = process.env): Promise<TenantContext> {
  const mode = routingMode(env);
  if (mode === "shared-hostnames") {
    // Forwarded and X-Forwarded-Host are intentionally never read.
    const hostname = normalizeHostname(headers.get("host"));
    const rows = (await pool.query(`SELECT h.id AS binding_id,h.hostname,w.id AS web_presence_id,m.id AS managed_site_id,
      o.id AS organization_id,m.name AS managed_site_name FROM managed_site_hostnames h
      JOIN web_presences w ON w.id=h.web_presence_id JOIN organizations o ON o.id=w.organization_id
      JOIN managed_sites m ON m.id=h.managed_site_id AND m.web_presence_id=w.id
      WHERE h.hostname=$1 AND h.status='active' AND o.status='active' AND w.status='active' AND m.status='active'`, [hostname])).rows;
    if (rows.length !== 1) throw new UnavailableHostname();
    const row = rows[0];
    return Object.freeze({ organizationId: row.organization_id, webPresenceId: row.web_presence_id, managedSiteId: row.managed_site_id,
      bindingId: row.binding_id, hostname, domain: hostname, managedSiteName: row.managed_site_name });
  }
  const selection = deploymentSelection(env);
  const rows = (await pool.query(`SELECT o.id AS organization_id,w.primary_domain AS domain,m.name AS managed_site_name
    FROM managed_sites m JOIN web_presences w ON w.id=m.web_presence_id JOIN organizations o ON o.id=w.organization_id
    WHERE m.id=$1 AND w.id=$2 AND m.status='active' AND w.status='active' AND o.status='active'`, [selection.managedSiteId, selection.webPresenceId])).rows;
  if (rows.length !== 1) throw new UnavailableHostname();
  return Object.freeze({ ...selection, organizationId: rows[0].organization_id, bindingId: null, hostname: null,
    domain: rows[0].domain ?? "", managedSiteName: rows[0].managed_site_name });
}
