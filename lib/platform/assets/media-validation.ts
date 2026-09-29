import sharp from "sharp";
import { MAX_IMAGE_PIXELS } from "./source";
import { prepareSvg } from "./svg-ingestion";
import { preparePdf } from "./pdf-ingestion";
import { rejectMultipageContainers } from "./raster-ingestion";

// Defense against canonical MIME/content mismatch, outside generic storage.
export async function validateStoredMedia(bytes: Buffer, mime: string) {
  if (mime === "image/svg+xml") {
    if (!prepareSvg(bytes).bytes.equals(bytes)) throw new Error("Noncanonical SVG.");
  } else if (mime === "application/pdf") {
    await preparePdf(bytes);
  } else {
    rejectMultipageContainers(bytes);
    const decoder = sharp(bytes, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: "warning", animated: true });
    const meta = await decoder.metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format ?? "") || mime !== `image/${meta.format}` || (meta.pages ?? 1) !== 1) throw new Error("MIME/content mismatch.");
    await decoder.stats();
  }
}
