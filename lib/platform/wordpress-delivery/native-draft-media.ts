import sharp from "sharp";
import { managedKey, readManagedObject } from "../assets/local-storage";
import { validateStoredMedia } from "../assets/media-validation";
import { fingerprint, object, text, uuid } from "../canonical/model";
import { hash } from "../content-editing/proposal";
import type { PrivateProposalMedia, ProposalMedia } from "../content-editing/proposal-media";

export type NativeDraftMedia = ReturnType<typeof readNativeDraftMedia>;

// Only the verified proposal composition supplies these fields. They travel in
// the exact site authorization; the optimized bytes travel separately.
export function readNativeDraftMedia(value: unknown) {
  const item = object(value, ["pageId", "sectionId", "assetId", "usageId", "masterDigest", "evidenceDigest", "copyDigest", "width", "height", "alt"]);
  const { width, height } = item;
  if (typeof width !== "number" || typeof height !== "number" || !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) || width < 1 || height < 1 || width > 1600 || height > 1600) {
    throw Error("Draft media dimensions refused");
  }
  return {
    pageId: uuid(item.pageId), sectionId: uuid(item.sectionId), assetId: uuid(item.assetId), usageId: uuid(item.usageId),
    masterDigest: hash(item.masterDigest), evidenceDigest: hash(item.evidenceDigest), copyDigest: hash(item.copyDigest),
    width, height, alt: text(item.alt, 500),
  };
}

export async function prepareNativeDraftMedia(root: string, webPresenceId: string, pageId: string, media: ProposalMedia | PrivateProposalMedia) {
  const master = await readManagedObject(root, webPresenceId, "objects/" + hash(media.preparedDigest));
  await validateStoredMedia(master, media.mimeType, { width: media.width, height: media.height });
  const { data: bytes, info } = await sharp(master).rotate()
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  if (bytes.length > 2_000_000) throw Error("Draft media copy exceeds file envelope");
  const descriptor = readNativeDraftMedia({
    pageId, sectionId: media.sectionId, assetId: media.assetId, usageId: media.usageId,
    masterDigest: media.preparedDigest, evidenceDigest: fingerprint(media.evidence), copyDigest: managedKey(bytes).slice(8),
    width: info.width, height: info.height, alt: media.configuration.image.altText,
  });
  return { descriptor, bytes };
}
