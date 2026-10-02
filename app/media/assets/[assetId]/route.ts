import { getPublicAsset } from "@/lib/platform/assets/presentation-service";
import { deliverPublicAsset } from "@/lib/platform/assets/delivery";
import { assetRoot } from "@/lib/platform/assets/local-storage";
import { managedSiteDeployment } from "@/lib/platform/managed-sites/deployment";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await context.params;
  // Assets belong to the selected Web Presence, independently of its Pages.
  return deliverPublicAsset(assetId, (id) => getPublicAsset(managedSiteDeployment.domain, id), assetRoot());
}
