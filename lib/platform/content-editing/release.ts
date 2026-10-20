import type { PoolClient } from "pg";
import { fingerprint, object, text } from "../canonical/model";
import { normalizeSection } from "../managed-sites/sections";
import { record } from "../presentation/content";
import type { Scope } from "./authority";
import type { Actor, Revision } from "./proposal";
import { siteBase } from "./proposal-context";

export type ReleasePermission = "release-managed-site-change" | "rollback-managed-site-change" | "inspect-managed-site-releases";
export interface ReleaseAuthority { authorize(context: unknown, permission: ReleasePermission, scope: Scope): Promise<Actor> }
export type SiteBase = Awaited<ReturnType<typeof siteBase>>;
export type ContentSnapshot = { page: Record<string, unknown> | null; sections: Record<string, unknown>[] };
// Release snapshots retain PostgreSQL microseconds, beyond JS Date precision.
// Proposal fingerprints keep their existing definition; release fingerprints use
// this stricter current-content representation throughout release and rollback.
export async function releaseBase(c: PoolClient, scope: Scope): Promise<SiteBase> {
  const base = await siteBase(c, scope) as SiteBase & Record<string, unknown>;
  const times = (alias: string) => `jsonb_build_object('created_at',to_char(${alias}.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'updated_at',to_char(${alias}.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))`;
  base.pages = (await c.query(`SELECT to_jsonb(p)||${times("p")} row FROM pages p WHERE managed_site_id=$1 ORDER BY id`, [scope.managedSiteId])).rows.map(r => r.row);
  base.sections = (await c.query(`SELECT to_jsonb(s)||${times("s")} row FROM sections s JOIN pages p ON p.id=s.page_id WHERE p.managed_site_id=$1 ORDER BY s.id`, [scope.managedSiteId])).rows.map(r => r.row);
  for (const table of ["actions", "navigations", "design_systems", "business_knowledge", "offerings", "assets", "asset_usages", "subjects", "contact_definitions"]) base[table] = (await c.query(`SELECT to_jsonb(t) row FROM ${table} t WHERE web_presence_id=$1 ORDER BY id`, [scope.webPresenceId])).rows.map(r => r.row);
  base.navigationItems = (await c.query("SELECT to_jsonb(i) row FROM navigation_items i JOIN navigations n ON n.id=i.navigation_id WHERE n.web_presence_id=$1 ORDER BY i.id", [scope.webPresenceId])).rows.map(r => r.row);
  return base;
}
export function releaseActor(value: unknown): Actor {
  const a = object(value, ["operatorId", "authorityReference"]);
  return { operatorId: text(a.operatorId), authorityReference: text(a.authorityReference, 300) };
}
export async function releaseEnvironment(c: PoolClient, transaction = true) {
  if (process.env.NODE_ENV !== "development" || process.env.MIOPAGES_SITE_RELEASES !== "disposable-operator") throw Error("Explicit disposable DEVELOPMENT release authority required; production release unavailable");
  const r = (await c.query("SELECT current_schema() s,current_database() db,inet_server_port() port")).rows[0];
  if (!/^canonical_test_[a-f0-9]{32}_intake$/.test(r.s) || !/^migration_rehearsal_[a-f0-9]{32}$/.test(r.db) || r.port === 5432) throw Error("Content releases require private disposable PostgreSQL; shared/public refused");
  if (transaction) await c.query("SET LOCAL TIME ZONE 'UTC'");
}
export function contentSnapshot(base: SiteBase, pageId: string): ContentSnapshot {
  const result = JSON.parse(JSON.stringify({ page: base.pages.find(p => p.id === pageId) ?? null, sections: base.sections.filter(s => s.page_id === pageId) })) as ContentSnapshot;
  if (result.sections.length > 24 || Buffer.byteLength(JSON.stringify(result)) > 1024 * 1024) throw Error("Prior Page/Section snapshot exceeds bounded rollback scope");
  return result;
}
export function candidateContent(r: Revision, prior: ContentSnapshot, at: string): ContentSnapshot {
  at = at.replace(/Z$/, "000Z");
  const page = prior.page ? { ...prior.page, title: r.candidate.title, version: Number(prior.page.version) + 1, updated_at: at } : {
    id: r.page.pageId, managed_site_id: r.binding.scope.managedSiteId, slug: r.page.slug, name: r.candidate.title, title: r.candidate.title, status: "active", sort_order: 0, configuration: {}, metadata: {}, version: 1, created_at: at, updated_at: at,
  };
  const sections = r.candidate.sections.map((s, index) => {
    if (!normalizeSection(s)) throw Error("Unsupported release Section");
    const old = prior.sections.find(row => row.id === s.id);
    return { id: s.id, page_id: r.page.pageId, type: s.type, variant: s.variant, name: s.name, sort_order: index, content: s.content, configuration: s.configuration, metadata: {}, status: "active", version: old ? Number(old.version) + 1 : 1, created_at: old?.created_at ?? at, updated_at: at };
  }).sort((a, b) => a.id.localeCompare(b.id));
  return { page, sections };
}
// Strict existing-row restoration, not an arbitrary SQL/backup interface. The full
// site fingerprint and dependent-reference checks must pass before this writer.
export async function writeContent(c: PoolClient, pageId: string, from: ContentSnapshot, to: ContentSnapshot) {
  if ((await c.query("SELECT 1 FROM pages WHERE id=$1 AND managed_site_id<>$2", [pageId, (to.page ?? from.page)?.managed_site_id])).rowCount) throw Error("Foreign Page identity");
  if ((await c.query("SELECT 1 FROM sections WHERE id=ANY($1::uuid[]) AND page_id<>$2", [to.sections.map(s => s.id), pageId])).rowCount) throw Error("Foreign Section identity");
  const removed = from.sections.filter(s => !to.sections.some(t => t.id === s.id)).map(s => String(s.id));
  const lostAnchors = from.sections.filter(s => record(s.configuration).anchor && !to.sections.some(t => t.id === s.id && record(t.configuration).anchor === record(s.configuration).anchor));
  const references = [...(!to.page ? [pageId] : []), ...removed, ...lostAnchors.map(s => String(s.id))];
  const destinations = lostAnchors.flatMap(s => [`#${record(s.configuration).anchor}`, `${(from.page ?? to.page)?.slug}#${record(s.configuration).anchor}`]);
  const related = (await c.query(`SELECT 1 FROM asset_usages WHERE entity_id=ANY($1::uuid[])
    UNION ALL SELECT 1 FROM navigation_items WHERE target_reference=ANY($1::text[]) OR target_reference=ANY($2::text[])
    UNION ALL SELECT 1 FROM actions WHERE destination=ANY($1::text[]) OR destination=ANY($2::text[])`, [references, destinations])).rowCount;
  if (related) throw Error("Referenced Page/Section deletion or anchor removal requires a broader reviewed change");
  await c.query("DELETE FROM sections WHERE page_id=$1 AND NOT(id=ANY($2::uuid[]))", [pageId, to.sections.map(s => s.id)]);
  if (!to.page) { await c.query("DELETE FROM pages WHERE id=$1", [pageId]); return; }
  const persist = async (table: "pages" | "sections", row: Record<string, unknown>, columns: string[]) => {
    // Explicit columns only. jsonb_populate_record preserves exact timestamp bytes
    // semantically, JSON values, versions and metadata from the bounded snapshot.
    const updates = columns.filter(k => k !== "id").map(k => `${k}=EXCLUDED.${k}`).join(",");
    await c.query(`INSERT INTO ${table}(${columns.join(",")}) SELECT ${columns.join(",")} FROM jsonb_populate_record(NULL::${table},$1::jsonb) ON CONFLICT(id) DO UPDATE SET ${updates}`, [JSON.stringify(row)]);
  };
  await persist("pages", to.page, ["id", "managed_site_id", "slug", "name", "title", "status", "sort_order", "configuration", "metadata", "version", "created_at", "updated_at"]);
  for (const s of to.sections) await persist("sections", s, ["id", "page_id", "type", "variant", "name", "sort_order", "content", "configuration", "metadata", "status", "version", "created_at", "updated_at"]);
}
export const exactContent = (a: ContentSnapshot, b: ContentSnapshot) => fingerprint(a) === fingerprint(b);
