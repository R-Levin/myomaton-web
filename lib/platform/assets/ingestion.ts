import { managedKey, readBounded } from "./local-storage";
import { MAX_MANAGED_BYTES } from "./source";
import { prepareRaster } from "./raster-ingestion";
import { prepareSvg } from "./svg-ingestion";
import { preparePdf } from "./pdf-ingestion";

export async function prepareManagedBytes(input: Buffer) {
  if (!input.length || input.length > MAX_MANAGED_BYTES) throw new Error("Invalid Asset size.");
  const prefix = input.subarray(0, 1024).toString("utf8").trimStart();
  const result = prefix.startsWith("%PDF-") ? await preparePdf(input)
    : prefix.startsWith("<") ? prepareSvg(input) : await prepareRaster(input);
  if (!result.bytes.length || result.bytes.length > MAX_MANAGED_BYTES) throw new Error("Invalid prepared Asset size.");
  return { ...result, sourceReference: managedKey(result.bytes) };
}

export async function prepareManagedAsset(file: string) {
  return prepareManagedBytes(await readBounded(file));
}
