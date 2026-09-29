import type { assets } from "../db/schema/assets";
import type { assetUsages } from "../db/schema/asset-usages";

// Canonical records, not presentation DTOs. Types and source kinds remain open
// strings so adding document/video support does not require a database enum edit.
export type Asset = typeof assets.$inferSelect;
export type AssetUsage = typeof assetUsages.$inferSelect;
export type AssetUsageTarget = Pick<AssetUsage, "entityType" | "entityId">;

export function requireAssetUuid(value: unknown): string {
  if (typeof value !== "string" || value.length !== 36 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("Asset queries require valid UUIDs.");
  }
  return value.toLowerCase();
}

export function requireAssetEntityType(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim()) {
    throw new Error("Asset queries require a nonempty, unpadded entity type.");
  }
  return value;
}
