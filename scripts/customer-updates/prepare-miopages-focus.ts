import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { manifest } from "../customer-initializers/miopages-c0";
import { focusMioPagesPreview as accepted } from "../customer-previews/miopages-focus";
import { customerGraph, otherCustomerState } from "../../lib/platform/customer-state";
import { stateFingerprint, type CustomerState } from "../../lib/platform/customer-initialization";
import { fingerprint } from "../../lib/platform/canonical/model";
import { normalizeBinding, projectContent } from "../../lib/platform/canonical/projections";
import { prepareManagedAsset } from "../../lib/platform/assets/ingestion";
import { normalizeSection } from "../../lib/platform/managed-sites/sections";
import { validateDirection, resolvePlan } from "../../lib/platform/presentation/plan";
type Row=Record<string,unknown>;
const fixedId=(key:string)=>{const h=createHash("sha256").update("miopages-focus-promotion-v1:"+key).digest("hex");return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
async function main() {
 const complete=JSON.parse(await readFile("runtime-content/miopages-promotion/before.json","utf8")) as CustomerState;
 const actual=JSON.parse(await readFile("runtime-content/miopages-promotion/accepted-preview.json","utf8")).state as CustomerState;
 // Match PostgreSQL to_jsonb(timestamptz), including trimmed fractional zeros.
 const before=customerGraph(complete,manifest),after=structuredClone(before),at=new Date().toISOString().replace(/\.000Z$/,"Z").replace(/(\.\d*?[1-9])0+Z$/,"$1Z").replace("Z","+00:00");
 assert.equal(stateFingerprint(complete),"85f900ac2af0086690955e59517ea07473ea5a7e17c4133fb1cd34e9354f5a30");
 for(const [route,ss] of Object.entries(accepted.pages)) {
  const page=actual.pages.find(p=>p.slug===route)!;
  const rows=actual.sections.filter(s=>s.page_id===page.id).sort((a,b)=>Number(a.sort_order)-Number(b.sort_order));
  assert.deepEqual(rows.map(r=>({type:r.type,content:r.content,configuration:r.configuration})),ss);
 }
 assert.deepEqual(actual.managed_sites[0].configuration,accepted.siteConfiguration);
 assert.deepEqual(actual.design_systems[0].configuration,accepted.designConfiguration);
 const provenance={by:"operator:accepted-miopages-focus",at,sourceCommit:"6c782aa1b9352e510ebab633b0e931d854216cc6",source:"docs/miopages-business-focus.md",reviewStatus:"reviewed",publicationAuthorized:false};
 const patch=(r:Row,fields:Row)=>({...r,...fields,version:Number(r.version)+1,updated_at:at});
 after.managed_sites=before.managed_sites.map(r=>patch(r,{configuration:accepted.siteConfiguration,metadata:{...(r.metadata as Row),copyStatus:"reviewed-development",visualDirectionStatus:"accepted-canonical",promotion:provenance}}));
 after.design_systems=before.design_systems.map(r=>patch(r,{name:"A Business in Focus",configuration:accepted.designConfiguration,metadata:{...(r.metadata as Row),promotion:provenance}}));
 after.actions=before.actions.map(r=>patch(r,{label:accepted.actionLabels[String(r.id)]}));
 after.pages=before.pages.map(r=>patch(r,{configuration:accepted.pageConfigurations?.[String(r.slug)]??{},metadata:{...(r.metadata as Row),copyStatus:"reviewed-development",promotion:provenance}}));
 after.sections=[];
 for(const page of after.pages) {
  const route=String(page.slug),old=before.sections.filter(s=>s.page_id===page.id).sort((a,b)=>Number(a.sort_order)-Number(b.sort_order));
  for(const [i,s]of accepted.pages[route].entries()) {
   const configuration=structuredClone(s.configuration),metadata:Row={copyStatus:"reviewed-development",promotion:provenance,canonicalContext:{knowledgeId:manifest.knowledge.id,offeringId:manifest.offering.id}};
   if(configuration.previewMedia){metadata.visualNeed=configuration.previewMedia;delete configuration.previewMedia;}
   let content=structuredClone(s.content);
   if(s.type==="relationship"&&content.kind==="stages") content={source:{role:"offering-continuity",offeringId:manifest.offering.id},contextHeading:content.heading};
   if(s.type==="relationship"&&content.kind==="scope") content={source:{role:"offering-relationship",offeringId:manifest.offering.id,kind:"scope",componentKeys:["standard-launch","expanded-launch","ongoing"]},contextHeading:content.heading};
   if(route==="/service"&&i===3) content={source:{role:"offering-commercial-structure",offeringId:manifest.offering.id},contextHeading:content.heading};
   if(route==="/service"&&i===6) content={source:{role:"knowledge",knowledgeId:manifest.knowledge.id,keys:["ownership"]},contextHeading:content.heading};
   const base=old[i]??{id:fixedId(`section:${route}:${i}`),page_id:page.id,created_at:at,version:0};
   after.sections.push(patch(base,{type:s.type,variant:s.type==="collection"?"grid":"default",name:`reviewed-focus-${i}`,sort_order:i*10,content,configuration,metadata,status:"active"}));
  }
 }
 for(const [role,file]of [["logo",accepted.logo.file],["logo-light",accepted.logo.light!.file]]) {
  const image=await prepareManagedAsset(file),assetId=fixedId(role);
  after.assets.push({id:assetId,web_presence_id:manifest.webPresenceId,name:`MioPages approved ${role}`,type:"image",mime_type:image.mimeType,width:image.width,height:image.height,alt_text:"MioPages",status:"active",source_type:"managed",source_reference:image.sourceReference,configuration:{},metadata:{approval:provenance,source:`brand/miopages/${role==="logo"?"MioPagesDV.png":"MioPagesDVw.png"}`},version:1,created_at:at,updated_at:at});
  after.asset_usages.push({id:fixedId(`usage:${role}`),web_presence_id:manifest.webPresenceId,asset_id:assetId,entity_type:"web_presence",entity_id:manifest.webPresenceId,role,configuration:{image:{altText:"MioPages",decorative:false}},metadata:{approval:provenance},version:1,created_at:at,updated_at:at});
 }
 for(const page of after.pages) {
  const ss=after.sections.filter(s=>s.page_id===page.id).map(s=>{
   const c=s.content as Row;
   if(!c.source)return s;
   const binding=normalizeBinding(c.source),record=binding.role==="knowledge"?after.business_knowledge[0]:after.offerings[0];
   const content=projectContent(String(s.type),c,binding,record as never);assert.ok(content);return {...s,content};
  });
  assert.ok(ss.every(s=>normalizeSection(s)));
  // Validate accepted media intent without granting production eligibility.
  resolvePlan(validateDirection(accepted.siteConfiguration.visualDirection),page.configuration,ss.map(s=>({...s,id:String(s.id),type:String(s.type),content:s.content,configuration:{...(s.configuration as Row),...((s.metadata as Row).visualNeed?{previewMedia:(s.metadata as Row).visualNeed}:{})}})),true,true);
 }
 const intendedComplete:CustomerState={migrations:complete.migrations,...Object.fromEntries(Object.keys(before).map(t=>[t,[...otherCustomerState(complete,manifest)[t],...after[t]]]))};
 const review={contractVersion:1,target:{organizationId:manifest.organizationId,webPresenceId:manifest.webPresenceId,managedSiteId:manifest.managedSiteId},at,sourceDigest:fingerprint({site:accepted.siteConfiguration,design:accepted.designConfiguration,pages:accepted.pages,pageConfigurations:accepted.pageConfigurations,actionLabels:accepted.actionLabels}),completeBefore:stateFingerprint(complete),completeAfter:stateFingerprint(intendedComplete),otherFingerprint:stateFingerprint(otherCustomerState(complete,manifest)),migrationFingerprint:fingerprint(complete.migrations),before,after};
 await writeFile("scripts/customer-updates/miopages-focus-reviewed.json",JSON.stringify(review,null,2)+"\n");
 console.log(JSON.stringify({before:review.completeBefore,intendedAfter:review.completeAfter,other:review.otherFingerprint,migrations:review.migrationFingerprint,counts:Object.fromEntries(Object.keys(before).map(t=>[t,{before:before[t].length,after:after[t].length}]))},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
