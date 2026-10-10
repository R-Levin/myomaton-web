import "server-only";
import { db } from "../db/connection";
import { publicAsset, sectionImages, eligibleSectionAssets, eligibleLogo } from "./presentation-queries";
import { offeringImages } from "../canonical/media";
import { acquiredHeroAssets } from "../acquisition/eligibility";
import { assetRoot } from "./local-storage";

export async function getServiceIllustrations(webPresenceId:string,managedSiteId:string) {
  const eligible=await acquiredHeroAssets(db.$client,webPresenceId,managedSiteId,assetRoot());
  return new Map([...eligible].map(([id,value])=>[id,value.image]));
}

export function getSectionImages(webPresenceId: string, sectionIds: readonly string[]) {
  return sectionImages(db, webPresenceId, sectionIds);
}

export function getPublicAsset(domain: string, assetId: string) {
  return publicAsset(db, domain, assetId);
}

export async function getDeploymentAsset(selection: {webPresenceId:string;managedSiteId:string;domain:string}, assetId: string) {
  const acquired=await db.$client.query("SELECT metadata,EXISTS(SELECT 1 FROM asset_usages u WHERE u.asset_id=a.id AND u.role='service-illustration') AS acquired_role FROM assets a WHERE id=$1 AND web_presence_id=$2",[assetId,selection.webPresenceId]);
  if(acquired.rows[0]?.metadata?.acquisition || acquired.rows[0]?.acquired_role){
    const eligible=await acquiredHeroAssets(db.$client,selection.webPresenceId,selection.managedSiteId,assetRoot());
    return [...eligible.values()].find(value=>value.asset.id===assetId)?.asset??null;
  }
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
