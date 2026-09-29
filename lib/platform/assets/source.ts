import { requireAssetUuid, type Asset } from "./model";

export const MAX_MANAGED_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;

// Managed keys are durable object names, never URLs or filesystem paths.
// Format-neutral content addressing; media validation belongs to ingestion.
export function requireManagedKey(value: unknown): string {
  if (typeof value !== "string" || value.length !== 72 || !/^objects\/[a-f0-9]{64}$/.test(value)) {
    throw new Error("Invalid managed object key.");
  }
  return value;
}

export function imageDimensions(width: unknown, height: unknown): boolean {
  return typeof width === "number" && typeof height === "number"
    && Number.isSafeInteger(width) && Number.isSafeInteger(height)
    && width > 0 && height > 0 && width * height <= MAX_IMAGE_PIXELS;
}

export type SectionImage = { assetId: string; src: string; width: number; height: number; alt: string };

export function presentImage(asset: Asset): SectionImage | null {
  try {
    requireAssetUuid(asset.id);
    requireManagedKey(asset.sourceReference);
  } catch { return null; }
  if (asset.status !== "active" || asset.type !== "image" || !IMAGE_MIMES.includes(asset.mimeType)
    || asset.sourceType !== "managed" || !imageDimensions(asset.width, asset.height)
    || typeof asset.altText !== "string") return null;
  return { assetId: asset.id, src: `/media/assets/${asset.id}`, width: asset.width!, height: asset.height!, alt: asset.altText };
}

export const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
export function managedAssetEligible(asset: Asset): boolean {
  try { requireAssetUuid(asset.id); requireManagedKey(asset.sourceReference); } catch { return false; }
  return asset.status === "active" && asset.sourceType === "managed"
    && ((asset.type === "image" && IMAGE_MIMES.includes(asset.mimeType))
      || (asset.type === "document" && asset.mimeType === "application/pdf"));
}
