import { getPublicAsset } from "@/lib/platform/assets/presentation-service";
import { deliverPublicAsset } from "@/lib/platform/assets/delivery";
import { assetRoot } from "@/lib/platform/assets/local-storage";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await context.params;
  // Same explicit single-site context as app/page.tsx; do not trust Host input.
  return deliverPublicAsset(assetId, (id) => getPublicAsset("myomaton.com", id), assetRoot());
}
