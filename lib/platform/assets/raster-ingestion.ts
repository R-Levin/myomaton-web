import sharp from "sharp";
import { imageDimensions, MAX_IMAGE_PIXELS } from "./source";

export function rejectMultipageContainers(input: Buffer) {
  // libvips can expose only the default PNG image: reject APNG's animation
  // control chunk explicitly instead of silently flattening it.
  if (input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    let offset = 8;
    while (offset < input.length) {
      if (offset + 12 > input.length) throw new Error("Malformed PNG chunks.");
      const length = input.readUInt32BE(offset);
      if (offset + length + 12 > input.length) throw new Error("Malformed PNG chunks.");
      if (input.toString("ascii", offset + 4, offset + 8) === "acTL") throw new Error("Animated/multipage images are unsupported.");
      offset += length + 12;
    }
  }
  // MPO uses a JPEG APP2 Multi-Picture Format directory.
  if (input[0] === 0xff && input[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 <= input.length && input[offset] === 0xff) {
      while (input[offset] === 0xff) offset++;
      const marker = input[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0xe2 && input.toString("ascii", offset + 2, offset + 6) === "MPF\0") throw new Error("Animated/multipage images are unsupported.");
      const length = input.readUInt16BE(offset);
      if (length < 2) throw new Error("Malformed JPEG segment.");
      offset += length;
    }
  }
}

export async function prepareRaster(input: Buffer) {
  rejectMultipageContainers(input);
  const decoder = sharp(input, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: "warning", animated: true });
  const metadata = await decoder.metadata();
  if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) throw new Error("Unsupported raster format.");
  if ((metadata.pages ?? 1) !== 1) throw new Error("Animated/multipage images are unsupported.");
  const oriented = decoder.rotate(); // Sharp strips metadata unless explicitly retained.
  const output = metadata.format === "jpeg" ? oriented.jpeg({ quality: 90 })
    : metadata.format === "png" ? oriented.png() : oriented.webp({ quality: 90 });
  const { data, info } = await output.toBuffer({ resolveWithObject: true });
  if (!imageDimensions(info.width, info.height)) throw new Error("Invalid image dimensions.");
  return { bytes: data, type: "image" as const, mimeType: `image/${metadata.format}`, width: info.width, height: info.height };
}
