import type { Pool } from "pg";
import { normalizeBinding, projectContent } from "./projections";
import { uuid, type Approval } from "./model";
import {inspectCanonical,writeCanonical} from "./writes";
import { managedAssetEligible, presentImage } from "../assets/source";
import type { Asset } from "../assets/model";

export async function attachOfferingImage(pool: Pool, input: { webPresenceId: string; offeringId: string; assetId: string; altText: string; decorative?: boolean; expectedVersion:number;expectedFingerprint:string;approval:Approval;changeReason:string }) {
  const current=await inspectCanonical(pool,"offering",input.webPresenceId,input.offeringId);
  if(!current)throw Error("Unavailable Offering");
  const row=current.row;
  return writeCanonical(pool,{domain:"offering",id:row.id,webPresenceId:input.webPresenceId,expectedVersion:input.expectedVersion,expectedFingerprint:input.expectedFingerprint,
    offering:{key:row.key,type:row.type,name:row.name,status:row.status},payload:{...row.payload,approval:input.approval},
    image:{assetId:input.assetId,altText:input.altText,decorative:input.decorative},responsibleIdentity:input.approval.by,changeReason:input.changeReason});
}
// Require an approved, valid source binding on active content in the selected site.
export async function offeringImages(pool: Pool, owner: string, siteId: string) {
  const bound=await pool.query("SELECT 1 FROM sections s JOIN pages p ON p.id=s.page_id WHERE p.managed_site_id=$1 AND s.content ? 'source' LIMIT 1",[uuid(siteId)]);
  if (!bound.rowCount) return new Map<string,{asset:Asset;image:ReturnType<typeof presentImage>}>();
  const rows=(await pool.query(`SELECT s.id section_id,s.type,s.content,o.id,o.web_presence_id,o.contract_version,o.name,o.status,o.payload,
    u.web_presence_id usage_owner,u.configuration usage_configuration,to_jsonb(a) asset
    FROM sections s JOIN pages p ON p.id=s.page_id JOIN managed_sites m ON m.id=p.managed_site_id JOIN web_presences w ON w.id=m.web_presence_id
    JOIN offerings o ON o.id::text=s.content->'source'->>'offeringId' AND o.web_presence_id=w.id
    JOIN asset_usages u ON u.entity_type='offering' AND u.entity_id=o.id AND u.role='image'
    JOIN assets a ON a.id=u.asset_id WHERE w.id=$1 AND m.id=$2 AND w.status='active' AND m.status='active' AND p.status='active' AND s.status='active' AND s.type='intro'
    AND NOT EXISTS (SELECT 1 FROM asset_usages acquired_usage WHERE acquired_usage.asset_id=a.id AND acquired_usage.role='service-illustration')`,[uuid(owner),uuid(siteId)])).rows;
  const output=new Map<string,{asset:Asset;image:ReturnType<typeof presentImage>}>();
  for (const row of rows) {
    if (rows.filter(r=>r.section_id===row.section_id).length!==1 || row.usage_owner!==owner || row.asset.web_presence_id!==owner) continue;
    try {
      const binding=normalizeBinding(row.content.source);
      if (binding.role!=="offering-overview" || !projectContent(row.type,row.content,binding,row)) continue;
      const a=row.asset;
      if(a.metadata?.acquisition)continue;
      const asset:Asset={id:a.id,webPresenceId:a.web_presence_id,name:a.name,type:a.type,mimeType:a.mime_type,sourceType:a.source_type,sourceReference:a.source_reference,altText:a.alt_text,width:a.width,height:a.height,status:a.status,configuration:a.configuration,metadata:a.metadata,version:a.version,createdAt:new Date(a.created_at),updatedAt:new Date(a.updated_at)};
      if (!managedAssetEligible(asset)) continue;
      const image=presentImage(asset,row.usage_configuration);if(image)output.set(row.section_id,{asset,image});
    } catch { /* Invalid source/media fails closed. */ }
  }
  return output;
}
