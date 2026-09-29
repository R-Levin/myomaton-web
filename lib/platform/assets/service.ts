import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/platform/db/connection";
import { assets } from "@/lib/platform/db/schema/assets";
import { assetUsages } from "@/lib/platform/db/schema/asset-usages";
import { requireAssetEntityType, requireAssetUuid, type Asset, type AssetUsage, type AssetUsageTarget } from "./model";

// Internal canonical-state reads: all statuses are intentional. Presentation
// availability and source resolution belong to the later integration slice.
export async function getAssetsByIds(webPresenceId: string, ids: readonly string[]): Promise<Map<string, Asset>> {
  const presenceId = requireAssetUuid(webPresenceId);
  const assetIds = [...new Set(ids.map(requireAssetUuid))];
  if (assetIds.length === 0) return new Map();
  const rows = await db.select().from(assets).where(and(
    eq(assets.webPresenceId, presenceId), inArray(assets.id, assetIds),
  ));
  return new Map(rows.map((row) => [row.id, row]));
}

export async function getAssetUsagesByEntity(webPresenceId: string, target: AssetUsageTarget): Promise<AssetUsage[]> {
  const presenceId = requireAssetUuid(webPresenceId);
  const entityId = requireAssetUuid(target.entityId);
  const entityType = requireAssetEntityType(target.entityType);
  return db.select().from(assetUsages).where(and(
    eq(assetUsages.webPresenceId, presenceId),
    eq(assetUsages.entityType, entityType),
    eq(assetUsages.entityId, entityId),
  )).orderBy(asc(assetUsages.role), asc(assetUsages.id));
}

// Do not filter by asset or target status: inactive entities still reference
// assets. This is a reference inventory, not authorization to purge anything.
export async function getAssetUsagesByAssetId(webPresenceId: string, assetId: string): Promise<AssetUsage[]> {
  const presenceId = requireAssetUuid(webPresenceId);
  const id = requireAssetUuid(assetId);
  return db.select().from(assetUsages).where(and(
    eq(assetUsages.webPresenceId, presenceId), eq(assetUsages.assetId, id),
  )).orderBy(asc(assetUsages.id));
}
