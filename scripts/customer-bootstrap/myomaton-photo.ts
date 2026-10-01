import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sections } from "../../lib/platform/db/schema/sections";
import { pages } from "../../lib/platform/db/schema/pages";
import { microsites } from "../../lib/platform/db/schema/microsites";
import { webPresences } from "../../lib/platform/db/schema/web-presences";
import { attachSectionAsset } from "../../lib/platform/assets/writes";
import { provisionManagedObject } from "../../lib/platform/assets/local-storage";

import { prepareManagedAsset } from "../../lib/platform/assets/ingestion";

export type PhotoOptions = { file: string; assetId: string; name: string; altText: string; root: string };

export async function bootstrapMyomatonPhoto(db: NodePgDatabase, options: PhotoOptions) {
  const photo = await prepareManagedAsset(options.file);
  if (photo.type !== "image" || photo.width === null || photo.height === null) throw new Error("Bootstrap requires an image with dimensions.");
  return db.transaction(async (tx) => {
    const targets = await tx.select({ sectionId: sections.id, webPresenceId: webPresences.id }).from(webPresences)
      .innerJoin(microsites, eq(microsites.webPresenceId, webPresences.id))
      .innerJoin(pages, eq(pages.micrositeId, microsites.id))
      .innerJoin(sections, eq(sections.pageId, pages.id))
      .where(and(eq(webPresences.primaryDomain, "myomaton.com"), eq(webPresences.name, "Myomaton"),
        eq(microsites.name, "Myomaton"), eq(pages.slug, "/"), eq(pages.name, "Home"),
        eq(sections.name, "Introduction"), eq(sections.type, "intro"),
        eq(webPresences.status, "active"), eq(microsites.status, "active"), eq(pages.status, "active"), eq(sections.status, "active")))
      .limit(2).for("update");
    if (targets.length !== 1) throw new Error("Expected exactly one active Myomaton Home Introduction section. Initialize a new customer with bootstrap:myomaton first; existing customer state is never repaired automatically.");
    const target = targets[0];
    return attachSectionAsset(tx, { ...target, assetId: options.assetId, name: options.name, altText: options.altText,
      sourceReference: photo.sourceReference, width: photo.width, height: photo.height, type: photo.type, mimeType: photo.mimeType, role: "image" },
    () => provisionManagedObject(options.root, target.webPresenceId, photo.sourceReference, photo.bytes));
  });
}
