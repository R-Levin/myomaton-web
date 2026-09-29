import { validateStoredMedia } from "./media-validation";
import type { Asset } from "./model";
import { requireAssetUuid } from "./model";
import { managedAssetEligible } from "./source";
import { readManagedObject } from "./local-storage";

export async function deliverPublicAsset(assetId: string, lookup: (id: string) => Promise<Asset | null>, root: string): Promise<Response> {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  let id: string;
  try { id = requireAssetUuid(assetId); } catch { return new Response("Not found", { status: 404, headers }); }
  let asset: Asset | null;
  try { asset = await lookup(id); } catch { return new Response("Unable to deliver Asset", { status: 500, headers }); }
  if (!asset || asset.id !== id || !managedAssetEligible(asset)) return new Response("Not found", { status: 404, headers });
  try {
    const bytes = await readManagedObject(root, asset.webPresenceId, asset.sourceReference);
    await validateStoredMedia(bytes, asset.mimeType);
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": asset.mimeType, "Content-Security-Policy": "default-src 'none'; sandbox", "Content-Disposition": asset.mimeType === "application/pdf" ? 'attachment; filename="document.pdf"' : "inline", "Content-Length": String(bytes.length) } });
  } catch {
    // Missing, corrupt or unsafe storage must never expose local paths.
    return new Response("Not found", { status: 404, headers });
  }
}
