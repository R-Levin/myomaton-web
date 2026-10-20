import type { Pool, PoolClient } from "pg";
import { fingerprint, normalizeKnowledge, normalizeOffering, text } from "../canonical/model";
import { inspectCanonical } from "../canonical/writes";
import { informationRevision } from "../activation/information";
import { normalizeAction } from "../actions/model";
import { normalizeSection } from "../managed-sites/sections";
import type { Scope } from "./authority";
import { proposalOnly, type Candidate, type Copy, type PageProposal, type ResolvedCopy } from "./proposal";

// All database access is a repeatable-read, read-only snapshot. No site writer.
export async function proposalSnapshot<T>(pool: Pool, scope: Scope, fn: (c: PoolClient, base: Awaited<ReturnType<typeof siteBase>>) => Promise<T>) {
  proposalOnly(); const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const schema = (await c.query("SELECT current_schema() s")).rows[0].s;
    if (!/^canonical_test_[a-f0-9]{32}_intake$/.test(schema)) throw Error("Site proposals require isolated disposable schema; shared/public operation refused");
    await c.query(`SET LOCAL search_path="${schema}"`);
    return await fn(c, await siteBase(c, scope));
  } finally { await c.query("ROLLBACK"); c.release(); }
}
async function siteBase(c: PoolClient, scope: Scope) {
  const graph = (await c.query(`SELECT to_jsonb(o) organization,to_jsonb(w) presence,to_jsonb(m) site,to_jsonb(b) binding FROM managed_sites m
    JOIN web_presences w ON w.id=m.web_presence_id JOIN organizations o ON o.id=w.organization_id
    JOIN activation_customer_bindings b ON b.managed_site_id=m.id AND b.web_presence_id=w.id AND b.organization_id=o.id
    WHERE m.id=$1 AND w.id=$2 AND m.status='inactive' AND w.status='inactive' AND o.status='inactive'`, [scope.managedSiteId, scope.webPresenceId])).rows;
  if (graph.length !== 1) throw Error("Exact bound inactive customer foundation required");
  const pages = (await c.query("SELECT * FROM pages WHERE managed_site_id=$1 ORDER BY id", [scope.managedSiteId])).rows;
  const sections = (await c.query("SELECT s.* FROM sections s JOIN pages p ON p.id=s.page_id WHERE p.managed_site_id=$1 ORDER BY s.id", [scope.managedSiteId])).rows;
  const owned: Record<string, unknown> = {};
  for (const table of ["actions", "navigations", "design_systems", "business_knowledge", "offerings", "assets", "asset_usages", "subjects", "contact_definitions"])
    owned[table] = (await c.query(`SELECT * FROM ${table} WHERE web_presence_id=$1 ORDER BY id`, [scope.webPresenceId])).rows;
  owned.navigationItems = (await c.query("SELECT i.* FROM navigation_items i JOIN navigations n ON n.id=i.navigation_id WHERE n.web_presence_id=$1 ORDER BY i.id", [scope.webPresenceId])).rows;
  return { graph: graph[0], pages, sections, ...owned };
}
export async function resolvePage(c: PoolClient, scope: Scope, page: PageProposal, base: Awaited<ReturnType<typeof siteBase>>) {
  const current = base.pages.find(p => p.id === page.pageId);
  if (page.operation === "create-page" ? current || base.pages.some(p => p.slug === page.slug) : !current || current.slug !== page.slug) throw Error("Page destination conflict or foreign Page");
  if (page.operation === "create-page" && (await c.query("SELECT id FROM pages WHERE id=$1", [page.pageId])).rowCount) throw Error("Foreign Page identity");
  for (const s of page.sections) if ((await c.query("SELECT id FROM sections WHERE id=$1 AND page_id<>$2", [s.id, page.pageId])).rowCount) throw Error("Foreign Section identity");
  const resolved: ResolvedCopy[] = [];
  const resolve = async (copy: Copy, path: string, max: number) => {
    if (copy.kind === "editorial") { resolved.push({ path, value: copy.text, origin: copy }); return copy.text; }
    const source = copy.source;
    const canonical = await inspectCanonical(c as unknown as Pool, source.domain, scope.webPresenceId, source.recordId);
    if (!canonical || canonical.row.version !== source.revision || canonical.fingerprint !== source.fingerprint) throw Error("Current owned canonical source revision required");
    await informationRevision(c, { domain: source.domain, recordId: source.recordId, revision: source.revision, revisionFingerprint: source.fingerprint }, scope.webPresenceId);
    let value: string, evidence: unknown;
    if (source.domain === "knowledge") {
      const entry = normalizeKnowledge(canonical.row.payload).entries.find(e => e.key === source.field);
      if (!entry || entry.evidence.confirmation !== "confirmed") throw Error("Confirmed Knowledge fact required");
      value = entry.value; evidence = entry.evidence;
    } else {
      const offering = normalizeOffering(canonical.row.payload);
      if (offering.evidence.confirmation !== "confirmed" || !["name", "summary", "detail"].includes(source.field)) throw Error("Confirmed Offering field required");
      value = source.field === "name" ? canonical.row.name : offering[source.field as "summary" | "detail"]; evidence = offering.evidence;
    }
    value = text(value, max, true); resolved.push({ path, value, origin: copy, evidence }); return value;
  };
  const candidate: Candidate = { title: await resolve(page.title, "title", 300), sections: [] };
  for (const [index, s] of page.sections.entries()) {
    const content = { heading: await resolve(s.heading, `sections/${index}/heading`, 300), ...(s.text ? { text: await resolve(s.text, `sections/${index}/text`, 2000) } : {}), ...(s.actionId ? { actionId: s.actionId } : {}) };
    let action;
    if (s.actionId) {
      const row = (await c.query("SELECT * FROM actions WHERE id=$1 AND web_presence_id=$2", [s.actionId, scope.webPresenceId])).rows[0];
      const paths = new Map(base.pages.filter(p => p.status === "active").map(p => [p.id, p.slug]));
      action = row && normalizeAction({ ...row, webPresenceId: row.web_presence_id }, scope.webPresenceId, paths);
      if (!action) throw Error("Existing eligible owned Action required");
    }
    const normalized = normalizeSection({ type: s.type, variant: s.type === "intro" ? "stack" : "default", content, configuration: {} });
    if (!normalized) throw Error("Unsupported proposal Section");
    candidate.sections.push({ id: s.id, type: normalized.type, variant: normalized.variant, name: content.heading, content, configuration: normalized.configuration, ...(action ? { action } : {}) });
  }
  if (!resolved.some(r => r.origin.kind === "canonical")) throw Error("At least one confirmed canonical factual source required");
  return { candidate, resolved, baseFingerprint: fingerprint(base) };
}
