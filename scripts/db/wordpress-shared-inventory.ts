import type { Pool, PoolClient } from "pg";
import { informationRevision } from "../../lib/platform/activation/information";
import { normalizeKnowledge, object, uuid } from "../../lib/platform/canonical/model";
import { projectContent } from "../../lib/platform/canonical/projections";
import { inspectCanonical } from "../../lib/platform/canonical/writes";
import type { Site } from "../../lib/platform/wordpress-delivery/authority";
import { privateStageSource } from "../../lib/platform/wordpress-delivery/permissions";

const c0: Site = {
  organizationId: "152aebd3-00b3-4296-a64e-e281522e64f0",
  webPresenceId: "926cb772-7507-4542-8acd-e7e57ce71324",
  managedSiteId: "312b8081-4582-47fa-bedb-a551fd6e2b36",
};
const c0Hosts = [
  ["runtime.miopages.com", "bfd0daa1-3a9d-429d-8b60-b2d9851f9603"],
  ["domain-test.miopages.com", "46bbd56e-9f28-4006-8bc0-df70c955cda3"],
];

export function normalizeInventoryUrl(value: string, database: string) {
  // Correct only the historical trailing backslash on the expected database
  // pathname. Leave credentials and query options untouched.
  const url = new URL(value.trim());
  if (url.pathname.replace(/(?:%5c|\\)+$/i, "") === "/" + database) url.pathname = "/" + database;
  return url.toString();
}

export function inventorySite(input: unknown): Site {
  const row = object(input, ["organizationId", "webPresenceId", "managedSiteId"]);
  return { organizationId: uuid(row.organizationId), webPresenceId: uuid(row.webPresenceId), managedSiteId: uuid(row.managedSiteId) };
}

const graph = `SELECT o.id AS organization_id,w.id AS web_presence_id,s.id AS managed_site_id,
  o.status AS organization_status,w.status AS presence_status,s.status AS site_status,w.primary_domain
  FROM public.managed_sites s JOIN public.web_presences w ON w.id=s.web_presence_id
  JOIN public.organizations o ON o.id=w.organization_id`;
const exact = "o.id=$1 AND w.id=$2 AND s.id=$3";
const ids = (site: Site) => [site.organizationId, site.webPresenceId, site.managedSiteId];

type Owner = { joins: string; key: string; scope: "organizations" | "presences" | "sites" };
function owner(table: string): Owner {
  const direct = (key: string, scope: Owner["scope"], joins = "") => ({ joins, key, scope });
  switch (table) {
    case "organizations": return direct("t.id", "organizations");
    case "web_presences": return direct("t.id", "presences");
    case "managed_sites": return direct("t.id", "sites");
    case "pages": return direct("t.managed_site_id", "sites");
    case "sections": return direct("p.managed_site_id", "sites", "LEFT JOIN public.pages p ON p.id=t.page_id");
    case "navigation_items": return direct("n.web_presence_id", "presences", "LEFT JOIN public.navigations n ON n.id=t.navigation_id");
    case "activation_customer_bindings":
    case "site_change_proposals": return direct("CASE WHEN w.id IS NOT NULL THEN s.id END", "sites", `LEFT JOIN public.managed_sites s ON s.id=t.managed_site_id AND s.web_presence_id=t.web_presence_id
      LEFT JOIN public.web_presences w ON w.id=s.web_presence_id AND w.organization_id=t.organization_id`);
    case "site_change_revisions":
    case "site_change_events": return direct("CASE WHEN w.id IS NOT NULL THEN s.id END", "sites", `LEFT JOIN public.site_change_proposals p ON p.id=t.proposal_id
      LEFT JOIN public.managed_sites s ON s.id=p.managed_site_id AND s.web_presence_id=p.web_presence_id
      LEFT JOIN public.web_presences w ON w.id=s.web_presence_id AND w.organization_id=p.organization_id`);
    default: return direct("t.web_presence_id", "presences");
  }
}

async function publicGrants(db: PoolClient) {
  const { rows: [acl] } = await db.query(`SELECT
    ARRAY(SELECT a.privilege_type FROM pg_database d
      CROSS JOIN LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a
      WHERE d.datname=current_database() AND a.grantee=0 ORDER BY 1) AS database,
    (SELECT count(*)::int FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
      WHERE n.nspname IN ('public','miopages_wp') AND a.grantee=0 AND a.privilege_type='CREATE') AS schema_create,
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 's' ELSE 'r' END::"char",c.relowner))) a
      WHERE n.nspname IN ('public','miopages_wp') AND c.relkind IN ('r','p','v','m','f','S') AND a.grantee=0) AS relation_grants,
    (SELECT count(*)::int FROM pg_attribute col JOIN pg_class c ON c.oid=col.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      CROSS JOIN LATERAL aclexplode(col.attacl) a WHERE n.nspname IN ('public','miopages_wp')
      AND col.attnum>0 AND NOT col.attisdropped AND a.grantee=0) AS column_grants,
    (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      WHERE n.nspname IN ('public','miopages_wp') AND p.prosecdef AND a.grantee=0) AS definer_grants`);
  return { ...acl, acceptable: !acl.database.includes("CREATE") && !acl.schema_create
    && !acl.relation_grants && !acl.column_grants && !acl.definer_grants };
}

async function hasApprovedSource(db: PoolClient, site: Site) {
  for (const [domain, table] of [["knowledge", "business_knowledge"], ["offering", "offerings"]] as const) {
    const { rows } = await db.query(`SELECT id FROM public.${table} WHERE web_presence_id=$1`, [site.webPresenceId]);
    for (const { id } of rows) {
      const fact = await inspectCanonical(db as unknown as Pool, domain, site.webPresenceId, id);
      if (!fact) continue;
      try {
        const row = fact.row;
        const publishable = domain === "knowledge"
          ? normalizeKnowledge(row.payload).entries.some(entry => projectContent("intro", {},
            { role: "knowledge", knowledgeId: id, keys: [entry.key] }, row))
          : !!projectContent("intro", {}, { role: "offering-overview", offeringId: id }, row);
        if (!publishable) continue;
        await informationRevision(db, { domain, recordId: id, revision: row.version,
          revisionFingerprint: fact.fingerprint }, site.webPresenceId);
        return true;
      } catch (error) {
        if (error && typeof error === "object" && "code" in error) throw error;
        // Invalid or stale facts are ineligible. Never emit their contents.
      }
    }
  }
  return false;
}

export async function sharedInventory(db: PoolClient, synthetic: Site[], fixture?: Site) {
  if ((await db.query("SHOW transaction_read_only")).rows[0]?.transaction_read_only !== "on") {
    throw Error("Read-only inventory transaction required");
  }
  const c0Row = (await db.query(graph + " WHERE " + exact, ids(c0))).rows[0];
  const c0Graph = c0Row?.organization_status === "active" && c0Row.presence_status === "active" && c0Row.site_status === "active";
  const c0Bindings: Record<string, boolean> = {};
  for (const [hostname, id] of c0Hosts) {
    c0Bindings[hostname] = (await db.query(`SELECT 1 FROM public.managed_site_hostnames WHERE id=$1 AND hostname=$2 AND status='active'
      AND web_presence_id=$3 AND managed_site_id=$4`, [id, hostname, c0.webPresenceId, c0.managedSiteId])).rowCount === 1;
  }
  const reviewed: Site[] = [];
  let invalidSynthetic = 0;
  const attestations = [...synthetic, ...(fixture ? [fixture] : [])];
  for (const site of attestations) {
    if (ids(site).some((value, index) => value === ids(c0)[index])
      || !(await db.query(graph + " WHERE " + exact, ids(site))).rowCount) invalidSynthetic++;
    else reviewed.push(site);
  }
  const groups = { organizations: "organizationId", presences: "webPresenceId", sites: "managedSiteId" } as const;
  const counts = [];
  for (const table of privateStageSource) {
    const { joins, key, scope } = owner(table);
    const { rows: [row] } = await db.query(`SELECT
      count(*) FILTER (WHERE owner=$1)::int AS c0,
      count(*) FILTER (WHERE owner=ANY($2::uuid[]))::int AS "otherSynthetic",
      count(*) FILTER (WHERE owner IS NULL OR (owner<>$1 AND NOT owner=ANY($2::uuid[])))::int AS "unknownOrReal"
      FROM (SELECT ${key} AS owner FROM public.${table} t ${joins}) inventory`,
    [c0[groups[scope]], reviewed.map(site => site[groups[scope]])]);
    counts.push({ table, ...row });
  }
  const totals = counts.reduce((sum, row) => ({ c0: sum.c0 + row.c0, otherSynthetic: sum.otherSynthetic + row.otherSynthetic,
    unknownOrReal: sum.unknownOrReal + row.unknownOrReal }), { c0: 0, otherSynthetic: 0, unknownOrReal: 0 });

  const { rows: candidates } = await db.query(`SELECT g.*, count(*) OVER()::int AS total FROM (${graph}) g
    WHERE g.organization_id<>$1 AND g.presence_status='inactive' AND g.site_status='inactive' AND g.organization_status='inactive'
    AND coalesce(g.primary_domain,'')='' AND NOT EXISTS (SELECT 1 FROM public.managed_site_hostnames h
      WHERE h.web_presence_id=g.web_presence_id OR h.managed_site_id=g.managed_site_id)
    AND EXISTS (SELECT 1 FROM public.activation_customer_bindings b WHERE b.organization_id=g.organization_id
      AND b.web_presence_id=g.web_presence_id AND b.managed_site_id=g.managed_site_id)
    ORDER BY (g.managed_site_id=$2::uuid) DESC NULLS LAST LIMIT 2`, [c0.organizationId, fixture?.managedSiteId ?? null]);
  const selected = fixture ? candidates.find(row => row.managed_site_id === fixture.managedSiteId
    && row.web_presence_id === fixture.webPresenceId && row.organization_id === fixture.organizationId)
    : candidates.length === 1 ? candidates[0] : undefined;
  const sourceEligible = selected ? await hasApprovedSource(db, {
    organizationId: selected.organization_id, webPresenceId: selected.web_presence_id, managedSiteId: selected.managed_site_id,
  }) : false;
  const grants = await publicGrants(db);
  const remaining = [];
  if (!c0Graph || Object.values(c0Bindings).some(value => !value)) remaining.push("Reconcile the recorded C0 graph and both active hostname bindings without changing them.");
  if (invalidSynthetic) remaining.push("Correct reviewed synthetic graph IDs that did not match an exact non-C0 graph.");
  if (totals.unknownOrReal) remaining.push("Classify unaccounted records through reviewed synthetic graph IDs. Real or unclassified records block shared grants.");
  if (!grants.acceptable) remaining.push("Review PUBLIC application grants before allowing the shared database.");
  if (!candidates.length) remaining.push("Separately review provisioning one inactive, unhosted synthetic graph, its activation binding and one revision-linked public-scope fact.");
  else if (!selected) remaining.push("Identify the exact inactive, unhosted and activation-bound rehearsal graph in MIOPAGES_WP_REHEARSAL_SITE.");
  else if (!sourceEligible) remaining.push("Separately review one revision-linked canonical fact approved for public projection on the selected graph.");
  else if (!fixture) remaining.push("Attest the identified graph is synthetic by supplying MIOPAGES_WP_REHEARSAL_SITE.");
  return { status: remaining.length ? "BLOCKED" : "PASS", readOnly: true, c0: { graph: c0Graph, bindings: c0Bindings },
    inventory: { tables: counts.length, ...totals, unaccountedTables: counts.filter(row => row.unknownOrReal)
      .map(({ table, unknownOrReal }) => ({ table, unknownOrReal })) },
    publicGrants: grants, fixture: { inactiveUnhostedActivationBoundCandidates: candidates[0]?.total ?? 0,
      selected: !!selected, reviewedSynthetic: !!fixture && !!selected, approvedProjectionSource: sourceEligible },
    remaining: remaining.length ? remaining : ["Obtain explicit database-owner approval for the table-wide grants before rollout."] };
}
