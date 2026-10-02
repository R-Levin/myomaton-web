import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import path from "node:path";
import { assets } from "../../lib/platform/db/schema/assets";
import { webPresences } from "../../lib/platform/db/schema/web-presences";
import { requireAssetUuid } from "../../lib/platform/assets/model";
import { prepareManagedAsset } from "../../lib/platform/assets/ingestion";
import { provisionManagedObject } from "../../lib/platform/assets/local-storage";

export type AssetImport = { file: string; assetId: string; name: string; altText: string };

// Operator-only creation. No attachment, replacement, synchronization or automatic reuse.
export async function importManagedAssets(db: NodePgDatabase, options: {
  webPresenceId: string; root: string; items: AssetImport[];
}) {
  const presenceId = requireAssetUuid(options.webPresenceId);
  if (!options.items.length) throw new Error("At least one Asset is required.");
  const ids = new Set<string>();
  const keys = new Set<string>();
  const prepared: (Awaited<ReturnType<typeof prepareManagedAsset>> & { id: string; name: string; altText: string })[] = [];
  for (const item of options.items) {
    const id = requireAssetUuid(item.assetId);
    if (!item.name.trim() || !item.altText.trim()) throw new Error("Asset name and approved alt text are required.");
    if (ids.has(id)) throw new Error(`Duplicate Asset UUID in import batch: ${id}`);
    ids.add(id);
    const media = await prepareManagedAsset(item.file);
    if (keys.has(media.sourceReference)) throw new Error("Duplicate prepared managed bytes in import batch; nothing imported.");
    keys.add(media.sourceReference);
    prepared.push({ id, name: item.name, altText: item.altText, ...media });
  }
  return db.transaction(async tx => {
    await tx.execute(sql`set local lock_timeout = '5s'`);
    // Protect duplicate checks from all concurrent Asset inserts, not just this command.
    // A short maintenance lock; no uniqueness/schema policy is added to the model.
    await tx.execute(sql`lock table ${assets} in share row exclusive mode`);
    const [presence] = await tx.select({ id: webPresences.id }).from(webPresences)
      .where(and(eq(webPresences.id, presenceId), eq(webPresences.status, "active"))).for("share");
    if (!presence) throw new Error("Active Web Presence not found; nothing imported.");
    const existing = await tx.select({ id: assets.id, sourceReference: assets.sourceReference }).from(assets)
      .where(or(inArray(assets.id, [...ids]), and(eq(assets.webPresenceId, presenceId),
        eq(assets.sourceType, "managed"), inArray(assets.sourceReference, [...keys]))));
    if (existing.length) throw new Error(`Existing Asset UUID or same managed bytes in this Web Presence: ${existing.map(row => row.id).join(", ")}. Nothing imported. Asset sources are not unique in the current model; review explicitly instead of duplicating or auto-reusing records.`);
    // All files and database conflicts are checked before any physical object is provisioned.
    // Files cannot roll back with PostgreSQL; retain immutable retryable bytes after failure.
    for (const media of prepared) {
      await provisionManagedObject(options.root, presenceId, media.sourceReference, media.bytes);
    }
    const rows = await tx.insert(assets).values(prepared.map(media => ({
      id: media.id, webPresenceId: presenceId, name: media.name, altText: media.altText,
      type: media.type, mimeType: media.mimeType, width: media.width, height: media.height,
      status: "active", sourceType: "managed", sourceReference: media.sourceReference,
    }))).returning();
    return rows.map(row => ({ ...row, physicalPath: path.resolve(options.root, presenceId, row.sourceReference), assetUsageCreated: false }));
  });
}
