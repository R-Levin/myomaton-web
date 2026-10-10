import { and, eq, getTableColumns, inArray, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { assets } from "../db/schema/assets";
import { assetUsages } from "../db/schema/asset-usages";
import { sections } from "../db/schema/sections";
import { pages } from "../db/schema/pages";
import { managedSites } from "../db/schema/managed-sites";
import { webPresences } from "../db/schema/web-presences";
import { requireAssetUuid, type Asset } from "./model";
import { managedAssetEligible, presentImage, type SectionImage } from "./source";

type EligibleUsage = { asset: Asset; configuration: unknown };

// The current site has active content, not a draft/published workflow. Only
// active intro image/document associations are public in this slice.
export async function eligibleSectionAssets(db: NodePgDatabase, webPresenceId: string, sectionIds?: readonly string[], managedSiteId?: string) {
  const presenceId = requireAssetUuid(webPresenceId);
  const ids = sectionIds?.map(requireAssetUuid);
  if (ids?.length === 0) return new Map<string, EligibleUsage>();
  const rows = await db.select({ sectionId: sections.id, usagePresenceId: assetUsages.webPresenceId, role: assetUsages.role, asset: getTableColumns(assets), configuration: assetUsages.configuration })
    .from(sections)
    .innerJoin(pages, eq(sections.pageId, pages.id))
    .innerJoin(managedSites, eq(pages.managedSiteId, managedSites.id))
    .innerJoin(webPresences, eq(managedSites.webPresenceId, webPresences.id))
    .innerJoin(assetUsages, and(eq(assetUsages.entityId, sections.id), eq(assetUsages.entityType, "section"), or(eq(assetUsages.role, "image"), eq(assetUsages.role, "attachment"))))
    .innerJoin(assets, eq(assets.id, assetUsages.assetId))
    .where(and(eq(webPresences.id, presenceId), eq(webPresences.status, "active"),
      eq(managedSites.status, "active"), eq(pages.status, "active"), eq(sections.status, "active"), eq(sections.type, "intro"),
      ids ? inArray(sections.id, ids) : undefined, managedSiteId ? eq(managedSites.id,managedSiteId) : undefined,
      sql`NOT (${sections.content} ? 'source')`,
      sql`NOT EXISTS (SELECT 1 FROM asset_usages acquired_usage WHERE acquired_usage.asset_id=${assets.id} AND acquired_usage.role='service-illustration')`));
  const groups = new Map<string, typeof rows>();
  for (const row of rows) groups.set(`${row.sectionId}:${row.role}`, [...(groups.get(`${row.sectionId}:${row.role}`) ?? []), row]);
  const result = new Map<string, EligibleUsage>();
  for (const [sectionId, group] of groups) {
    if (group.length !== 1) throw new Error("Ambiguous Section Asset association.");
    const row = group[0];
    // Acquired media may not gain eligibility from an unrelated legacy slot.
    if (row.asset.metadata && typeof row.asset.metadata === "object" && "acquisition" in row.asset.metadata) continue;
    if (row.usagePresenceId === presenceId && row.asset.webPresenceId === presenceId && managedAssetEligible(row.asset) && (row.role === "image" ? row.asset.type === "image" : row.asset.type === "document")) result.set(sectionId, { asset: row.asset, configuration: row.configuration });
  }
  return result;
}

export async function sectionImages(db: NodePgDatabase, webPresenceId: string, sectionIds: readonly string[]): Promise<Map<string, SectionImage>> {
  const eligible = await eligibleSectionAssets(db, webPresenceId, sectionIds);
  return new Map([...eligible].flatMap(([id, usage]) => { const image = presentImage(usage.asset, usage.configuration); return image ? [[id.split(":")[0], image] as const] : []; }));
}

export async function publicAsset(db: NodePgDatabase, domain: string, assetId: string): Promise<Asset | null> {
  const id = requireAssetUuid(assetId);
  const presences = await db.select({ id: webPresences.id }).from(webPresences)
    .where(and(eq(webPresences.primaryDomain, domain), eq(webPresences.status, "active"))).limit(2);
  if (presences.length > 1) throw new Error("Ambiguous public Web Presence.");
  if (!presences.length) return null;
  const eligible = await eligibleSectionAssets(db, presences[0].id);
  const sectionAsset = [...eligible.values()].find(({ asset }) => asset.id === id)?.asset;
  if (sectionAsset) return sectionAsset;
  const logo = await eligibleLogo(db, presences[0].id);
  if (logo?.asset.id === id) return logo.asset;
  const light = await eligibleLogo(db, presences[0].id, "logo-light");
  return light?.asset.id === id ? light.asset : null;
}

// AssetUsage is the single logo reference. Never duplicate its Asset UUID in
// configuration. Inspect all usages for the target, including foreign ownership,
// so malformed or ambiguous associations cannot expose an image.
export async function eligibleLogo(db: NodePgDatabase, webPresenceId: string, role: "logo" | "logo-light" = "logo"): Promise<EligibleUsage | null> {
  const id = requireAssetUuid(webPresenceId);
  const rows = await db.select({ usagePresenceId: assetUsages.webPresenceId, asset: getTableColumns(assets), configuration: assetUsages.configuration })
    .from(webPresences)
    .innerJoin(assetUsages, and(eq(assetUsages.entityId, webPresences.id), eq(assetUsages.entityType, "web_presence"), eq(assetUsages.role, role)))
    .innerJoin(assets, eq(assets.id, assetUsages.assetId))
    .where(and(eq(webPresences.id, id), eq(webPresences.status, "active"),
      sql`NOT EXISTS (SELECT 1 FROM asset_usages acquired_usage WHERE acquired_usage.asset_id=${assets.id} AND acquired_usage.role='service-illustration')`));
  if (rows.length !== 1) return null;
  const row = rows[0];
  if (row.asset.metadata && typeof row.asset.metadata === "object" && "acquisition" in row.asset.metadata) return null;
  if (row.usagePresenceId !== id || row.asset.webPresenceId !== id || !presentImage(row.asset, row.configuration)) return null;
  // Delivery requires an active Managed Site; inactive-only presences do not
  // expose a logo merely because the presence record remains active.
  const sites = await db.select({ id: managedSites.id }).from(managedSites)
    .where(and(eq(managedSites.webPresenceId, id), eq(managedSites.status, "active"))).limit(1);
  return sites.length ? { asset: row.asset, configuration: row.configuration } : null;
}

export async function logoImage(db: NodePgDatabase, webPresenceId: string, role: "logo" | "logo-light" = "logo"): Promise<SectionImage | null> {
  const logo = await eligibleLogo(db, webPresenceId, role);
  return logo ? presentImage(logo.asset, logo.configuration) : null;
}
