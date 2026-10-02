import { and, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { pages } from "../db/schema/pages";
import { managedSites } from "../db/schema/managed-sites";
import { webPresences } from "../db/schema/web-presences";
import { actionId as uuid } from "../actions/model";
import { canonicalPagePath } from "./paths";

export type PageTargetContext = { managedSiteId: string };

// Shared identity-to-route eligibility for Actions and Navigation. No inferred
// deployment, slug aliases or cross-site URLs; callers must supply the context.
export async function resolvePageDestinations(db: NodePgDatabase, webPresenceId: string,
  pageIds: readonly string[], context?: PageTargetContext): Promise<Map<string, string>> {
  const presenceId = uuid(webPresenceId), siteId = uuid(context?.managedSiteId);
  const ids = [...new Set(pageIds.map(uuid).filter(id => id !== null))];
  const result = new Map<string, string>();
  if (!presenceId || !siteId || !ids.length) return result;
  const rows = await db.select({ id: pages.id, managedSiteId: pages.managedSiteId, slug: pages.slug })
    .from(pages).innerJoin(managedSites, eq(pages.managedSiteId, managedSites.id))
    .innerJoin(webPresences, eq(managedSites.webPresenceId, webPresences.id))
    .where(and(inArray(pages.id, ids), eq(managedSites.id, siteId), eq(managedSites.webPresenceId, presenceId),
      eq(managedSites.status, "active"), eq(pages.status, "active"), eq(webPresences.status, "active")));
  for (const row of rows) {
    const path = canonicalPagePath(row.slug);
    if (path && ids.includes(row.id) && row.managedSiteId === siteId
      && rows.filter(other => other.id === row.id || (other.managedSiteId === siteId && other.slug === path)).length === 1) {
      result.set(row.id, path);
    }
  }
  return result;
}
