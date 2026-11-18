import { createHash } from "node:crypto";
import { prepareRaster } from "../assets/raster-ingestion";
import { validateStoredMedia } from "../assets/media-validation";
import { MAX_MANAGED_BYTES } from "../assets/source";
import { eligibleStock, declinedPixabayIds, type StockSelection } from "./stock";
import type { StockSearchHit } from "./stock-discovery";

export async function downloadPixabaySelection(hit: StockSearchHit, recheck: () => Promise<void>, read: typeof fetch = fetch) {
  const url = new URL(hit.representation.url);
  if (hit.provider !== "pixabay" || declinedPixabayIds.some(id => id === hit.sourceId) ||
      hit.representation.id !== "webformat" || url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash ||
      !(url.hostname === "pixabay.com" && url.pathname.startsWith("/get/") ||
        url.hostname === "cdn.pixabay.com" && url.pathname.startsWith("/photo/")) ||
      !/\.(?:jpe?g|png|webp)$/iu.test(url.pathname)) throw Error("Exact permitted Pixabay representation required");
  await recheck();
  const response = await read(url, { method: "GET", redirect: "error", signal: AbortSignal.timeout(15_000) });
  const mime = response.headers.get("content-type")?.split(";")[0].trim();
  if (response.status !== 200 || !["image/jpeg", "image/png", "image/webp"].includes(mime ?? "") || !response.body) {
    await response.body?.cancel();
    throw Error("Selected stock image unavailable");
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_MANAGED_BYTES) { await reader.cancel(); throw Error("Stock image exceeds safe ingestion envelope"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const source = Buffer.concat(chunks);
  await validateStoredMedia(source, mime!, hit.representation);
  const prepared = await prepareRaster(source, "png");
  if (prepared.width !== hit.representation.width || prepared.height !== hit.representation.height) throw Error("Selected image dimensions differ");
  await recheck();
  const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
  return { source, prepared, sourceSha256: sha(source), preparedSha256: sha(prepared.bytes) };
}

/** A proposed private use, still subject to the existing candidate rights and
 * contextual-placement review. This creates no Asset or approval. */
export function pixabayPrivateSelection(hit: StockSearchHit, sourceDigest: string, expiresAt: string): StockSelection {
  return eligibleStock({ provider: hit.provider, sourceId: hit.sourceId, sourceUrl: hit.sourceUrl, creator: hit.creator,
    representation: { id: hit.representation.id, sourceDigest },
    license: { reference: "https://pixabay.com/service/license-summary/", use: "isolated-private-site-evaluation", copy: "allowed", expiresAt },
    integration: { reference: "https://pixabay.com/api/docs/", delivery: "managed-copy", attribution: "optional" },
  });
}
