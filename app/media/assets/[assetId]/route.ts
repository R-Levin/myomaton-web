import { getDeploymentAsset } from "@/lib/platform/assets/presentation-service";
import { deliverPublicAsset } from "@/lib/platform/assets/delivery";
import { assetRoot } from "@/lib/platform/assets/local-storage";
import { deploymentContext } from "@/lib/platform/managed-sites/context";
import { actionId } from "@/lib/platform/actions/model";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await context.params;
  if (!actionId(assetId)) return new Response("Not found",{status:404});
  // Assets belong to the selected Web Presence, independently of its Pages.
  const selected=await deploymentContext();
  return deliverPublicAsset(assetId, (id) => getDeploymentAsset(selected, id), assetRoot());
}
