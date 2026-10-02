import { and, eq, getTableColumns, inArray, or } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { assets } from "../db/schema/assets";
import { assetUsages } from "../db/schema/asset-usages";
import { sections } from "../db/schema/sections";
import { pages } from "../db/schema/pages";
import { managedSites } from "../db/schema/managed-sites";
import { webPresences } from "../db/schema/web-presences";
import { requireAssetUuid, type Asset } from "./model";
import { managedAssetEligible, presentImage, type SectionImage } from "./source";

// The current site has active content, not a draft/published workflow. Only
// active intro image/document associations are public in this slice.
export async function eligibleSectionAssets(db: NodePgDatabase, webPresenceId: string, sectionIds?: readonly string[]) {
  const presenceId = requireAssetUuid(webPresenceId);
  const ids = sectionIds?.map(requireAssetUuid);
  if (ids?.length === 0) return new Map<string, Asset>();
  const rows = await db.select({ sectionId: sections.id, usagePresenceId: assetUsages.webPresenceId, role: assetUsages.role, asset: getTableColumns(assets) })
    .from(sections)
    .innerJoin(pages, eq(sections.pageId, pages.id))
    .innerJoin(managedSites, eq(pages.managedSiteId, managedSites.id))
    .innerJoin(webPresences, eq(managedSites.webPresenceId, webPresences.id))
    .innerJoin(assetUsages, and(eq(assetUsages.entityId, sections.id), eq(assetUsages.entityType, "section"), or(eq(assetUsages.role, "image"), eq(assetUsages.role, "attachment"))))
    .innerJoin(assets, eq(assets.id, assetUsages.assetId))
    .where(and(eq(webPresences.id, presenceId), eq(webPresences.status, "active"),
      eq(managedSites.status, "active"), eq(pages.status, "active"), eq(sections.status, "active"), eq(sections.type, "intro"),
      ids ? inArray(sections.id, ids) : undefined));
  const groups = new Map<string, typeof rows>();
  for (const row of rows) groups.set(`${row.sectionId}:${row.role}`, [...(groups.get(`${row.sectionId}:${row.role}`) ?? []), row]);
  const result = new Map<string, Asset>();
  for (const [sectionId, group] of groups) {
    if (group.length !== 1) throw new Error("Ambiguous Section Asset association.");
    const row = group[0];
    if (row.usagePresenceId === presenceId && row.asset.webPresenceId === presenceId && managedAssetEligible(row.asset) && (row.role === "image" ? row.asset.type === "image" : row.asset.type === "document")) result.set(sectionId, row.asset);
  }
  return result;
}

export async function sectionImages(db: NodePgDatabase, webPresenceId: string, sectionIds: readonly string[]): Promise<Map<string, SectionImage>> {
  const eligible = await eligibleSectionAssets(db, webPresenceId, sectionIds);
  return new Map([...eligible].flatMap(([id, asset]) => { const image = presentImage(asset); return image ? [[id.split(":")[0], image] as const] : []; }));
}

export async function publicAsset(db: NodePgDatabase, domain: string, assetId: string): Promise<Asset | null> {
  const id = requireAssetUuid(assetId);
  const presences = await db.select({ id: webPresences.id }).from(webPresences)
    .where(and(eq(webPresences.primaryDomain, domain), eq(webPresences.status, "active"))).limit(2);
  if (presences.length > 1) throw new Error("Ambiguous public Web Presence.");
  if (!presences.length) return null;
  const eligible = await eligibleSectionAssets(db, presences[0].id);
  return [...eligible.values()].find((asset) => asset.id === id) ?? null;
}
