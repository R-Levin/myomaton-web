import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { assets } from "../db/schema/assets";
import { assetUsages } from "../db/schema/asset-usages";
import { sections } from "../db/schema/sections";
import { pages } from "../db/schema/pages";
import { managedSites } from "../db/schema/managed-sites";
import { webPresences } from "../db/schema/web-presences";
import { requireAssetUuid } from "./model";
import { imageDimensions, IMAGE_MIMES, requireManagedKey } from "./source";

export type SectionAssetInput = {
  webPresenceId: string; sectionId: string; assetId: string;
  name: string; altText: string; sourceReference: string; width: number | null; height: number | null;
  type: "image" | "document"; mimeType: string; role: "image" | "attachment";
};

// Operator-only writer; no HTTP management endpoint. All writers of these singular Section roles
// must lock the Section before checking role cardinality (not a generic DB rule).
export async function attachSectionAsset(db: NodePgDatabase, input: SectionAssetInput, provision?: () => Promise<void>) {
  const presenceId = requireAssetUuid(input.webPresenceId);
  const sectionId = requireAssetUuid(input.sectionId);
  const assetId = requireAssetUuid(input.assetId);
  requireManagedKey(input.sourceReference);
  const validDimensions = imageDimensions(input.width, input.height)
    || (input.mimeType === "image/svg+xml" && input.width === null && input.height === null);
  const validImage = input.type === "image" && input.role === "image" && IMAGE_MIMES.includes(input.mimeType) && validDimensions;
  const validDocument = input.type === "document" && input.role === "attachment" && input.mimeType === "application/pdf"
    && input.width === null && input.height === null;
  if (!input.name.trim() || !input.altText.trim() || (!validImage && !validDocument)) throw new Error("Valid managed media, name and approved descriptive text are required.");
  return db.transaction(async (tx) => {
    // Lock the whole ownership chain so reparenting/deletion cannot race checks.
    const [target] = await tx.select({ id: sections.id }).from(sections)
      .innerJoin(pages, eq(sections.pageId, pages.id))
      .innerJoin(managedSites, eq(pages.managedSiteId, managedSites.id))
      .innerJoin(webPresences, eq(managedSites.webPresenceId, webPresences.id))
      .where(and(eq(sections.id, sectionId), eq(webPresences.id, presenceId),
        eq(sections.type, "intro"), eq(sections.status, "active"), eq(pages.status, "active"),
        eq(managedSites.status, "active"), eq(webPresences.status, "active")))
      .for("update");
    if (!target) throw new Error("Active Introduction section not found in the requested Web Presence.");
    // Include incorrectly scoped target rows as conflicts, rather than ignoring
    // them. The FK cannot enforce ownership of polymorphic targets.
    const usages = await tx.select().from(assetUsages).where(and(
      eq(assetUsages.entityType, "section"), eq(assetUsages.entityId, sectionId), eq(assetUsages.role, input.role),
    ));
    if (usages.length > 1 || usages.some((usage) => usage.webPresenceId !== presenceId || usage.assetId !== assetId)) {
      throw new Error("Section Asset role is occupied or ambiguous.");
    }
    const [existing] = await tx.select().from(assets).where(eq(assets.id, assetId)).for("update");
    if (existing && existing.webPresenceId !== presenceId) throw new Error("Asset belongs to another Web Presence.");
    if (usages.length === 1) return { assetId, created: false }; // Canonical state wins; never restore status or metadata.
    if (existing && (existing.status !== "active" || existing.type !== input.type || existing.mimeType !== input.mimeType
      || existing.sourceType !== "managed" || existing.sourceReference !== input.sourceReference
      || existing.width !== input.width || existing.height !== input.height || typeof existing.altText !== "string")) throw new Error("Existing Asset is incompatible; it will not be overwritten.");
    if (provision) await provision(); // File errors roll back dependent DB work.
    if (!existing) await tx.insert(assets).values({
      id: assetId, webPresenceId: presenceId, name: input.name, altText: input.altText,
      type: input.type, mimeType: input.mimeType, sourceType: "managed", sourceReference: input.sourceReference,
      width: input.width, height: input.height,
    });
    await tx.insert(assetUsages).values({ webPresenceId: presenceId, assetId, entityType: "section", entityId: sectionId, role: input.role });
    return { assetId, created: true };
  });
}
