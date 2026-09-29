import "server-only";
import { db } from "../db/connection";
import { publicAsset, sectionImages } from "./presentation-queries";

export function getSectionImages(webPresenceId: string, sectionIds: readonly string[]) {
  return sectionImages(db, webPresenceId, sectionIds);
}

export function getPublicAsset(domain: string, assetId: string) {
  return publicAsset(db, domain, assetId);
}
