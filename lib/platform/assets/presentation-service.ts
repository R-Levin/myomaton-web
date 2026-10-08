import "server-only";
import { db } from "../db/connection";
import { publicAsset, sectionImages, eligibleSectionAssets, eligibleLogo } from "./presentation-queries";
import { offeringImages } from "../canonical/media";

export function getSectionImages(webPresenceId: string, sectionIds: readonly string[]) {
  return sectionImages(db, webPresenceId, sectionIds);
}

export function getPublicAsset(domain: string, assetId: string) {
  return publicAsset(db, domain, assetId);
}

export async function getDeploymentAsset(selection: {webPresenceId:string;managedSiteId:string;domain:string}, assetId: string) {
  const usages=await eligibleSectionAssets(db,selection.webPresenceId,undefined,selection.managedSiteId);
  const asset=[...usages.values()].find(u=>u.asset.id===assetId)?.asset;
  if(asset)return asset;
  const canonical=await offeringImages(db.$client,selection.webPresenceId,selection.managedSiteId);
  const offering=[...canonical.values()].find(u=>u.asset.id===assetId)?.asset;
  if(offering)return offering;
  const logo=await eligibleLogo(db,selection.webPresenceId);
  if (logo?.asset.id === assetId) return logo.asset;
  const light = await eligibleLogo(db, selection.webPresenceId, "logo-light");
  return light?.asset.id === assetId ? light.asset : null;
}
