import type { Pool } from "pg";
import { fingerprint,uuid } from "../canonical/model";
import { readCustomerState,stateFingerprint } from "../customer-initialization";
import { customerGraph,type CustomerTarget } from "../customer-state";
import { normalizeBinding,projectContent } from "../canonical/projections";
import { normalizeAction } from "../actions/model";
import type { Basis,Need,Row,Technical } from "./model";

export type Scope={target:CustomerTarget;acquisitionSchema?:string;buildId:string|null};
export async function readBasis(pool:Pool,scope:Scope):Promise<Basis>{
  const target={organizationId:uuid(scope.target.organizationId),webPresenceId:uuid(scope.target.webPresenceId),managedSiteId:uuid(scope.target.managedSiteId)};
  if(scope.acquisitionSchema&&!/^canonical_test_[a-f0-9]{32}_acquisition$/.test(scope.acquisitionSchema))throw Error("Private disposable acquisition schema required");
  const db=await pool.connect();try{
    await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");await db.query("SET LOCAL search_path=public");await db.query("SET LOCAL TIME ZONE 'UTC'");
    const state=await readCustomerState(db),graph=customerGraph(state,target);
    const presence=graph.web_presences.find(r=>r.id===target.webPresenceId&&r.organization_id===target.organizationId&&r.status==="active"),site=graph.managed_sites.find(r=>r.id===target.managedSiteId&&r.status==="active");
    if(!presence||!site)throw Error("Unknown active owned QC site");
    const pages=graph.pages.filter(r=>r.managed_site_id===target.managedSiteId&&r.status==="active");if(pages.length>30||!pages.length)throw Error("Bounded route inventory required");
    const pageIds=new Set(pages.map(p=>p.id));const sections=graph.sections.filter(s=>pageIds.has(s.page_id)&&s.status==="active");if(sections.length>200)throw Error("Section review limit");
    const projected:Row[]=[],truth:Row[]=[];
    for(const s of sections){const raw=(s.content??{}) as Row;let content:unknown=raw;
      if(raw.source){try{const b=normalizeBinding(raw.source);const source=(b.role==="knowledge"?graph.business_knowledge:graph.offerings).find(r=>r.id===(b.role==="knowledge"?b.knowledgeId:b.offeringId));content=source?projectContent(String(s.type),raw,b,source as never):null;truth.push({sectionId:s.id,sourceId:source?.id??null,sourceVersion:source?.version??null,projected:content!==null});}catch{content=null;truth.push({sectionId:s.id,projected:false});}}
      projected.push({id:s.id,page_id:s.page_id,type:s.type,sort_order:s.sort_order,content,configuration:s.configuration,metadata:s.metadata,version:s.version});
    }
    const pageDestinations=new Map(pages.map(p=>[String(p.id),String(p.slug)]));
    const actions=graph.actions.map(r=>({id:r.id,valid:!!normalizeAction({...r,webPresenceId:r.web_presence_id},target.webPresenceId,pageDestinations),label:r.label,type:r.type,destination:r.type==="page"?pageDestinations.get(String(r.destination))??null:r.destination,status:r.status}));
    const sourceSchema=scope.acquisitionSchema??"public";const exists=(await db.query("SELECT to_regclass($1) AS relation",[`${sourceSchema}.external_work`])).rows[0].relation;
    let jobs:Row[]=[],candidates:Row[]=[],events:Row[]=[];
    if(exists){const q=`"${sourceSchema}"`;jobs=(await db.query(`SELECT * FROM ${q}.external_work WHERE web_presence_id=$1 AND context->>'managedSiteId'=$2 ORDER BY iteration,id LIMIT 101`,[target.webPresenceId,target.managedSiteId])).rows;
      if(jobs.length>100)throw Error("Acquisition review limit");const ids=jobs.map(w=>w.id);
      candidates=(await db.query(`SELECT * FROM ${q}.media_candidates WHERE web_presence_id=$1 AND work_id=ANY($2::uuid[]) ORDER BY id`,[target.webPresenceId,ids])).rows;
      events=(await db.query(`SELECT * FROM ${q}.external_work_events WHERE web_presence_id=$1 AND work_id=ANY($2::uuid[]) ORDER BY created_at,id LIMIT 1001`,[target.webPresenceId,ids])).rows;if(events.length>1000)throw Error("Event review limit");
    }
    const acquisition=jobs.map(w=>({id:w.id,sectionId:(w.context as Row).sectionId,contextDigest:w.context_digest,iteration:w.iteration,provider:w.provider,model:w.model,templateVersion:w.template_version,status:w.status,attempts:w.attempts,retries:w.retries,reservedMicros:w.reserved_micros,budgetMicros:w.budget_micros,actualMicros:w.actual_micros,createdAt:w.created_at,updatedAt:w.updated_at,operatorEffort:null,candidates:candidates.filter(c=>c.work_id===w.id).map(c=>({id:c.id,revision:c.revision,state:c.state,subjectDigest:c.subject_digest,bytesDigest:c.bytes_digest,provenanceDigest:c.provenance_digest,width:c.width,height:c.height,mimeType:c.mime_type,provenance:c.provenance,sourceKind:c.source_kind,rights:"Generated illustration; not real business evidence; operator suitability review required"})),events:events.filter(e=>e.work_id===w.id)}));
    const needs:Need[]=sections.flatMap(s=>{const metadata=(s.metadata??{}) as Row,n=metadata.visualNeed as Row|undefined;if(!n)return [];const page=pages.find(p=>p.id===s.page_id)!;
      return [{sectionId:String(s.id),pageId:String(page.id),route:String(page.slug),role:String(n.role),importance:String(n.importance),purpose:String(n.purpose),source:String(n.source),permission:String(n.permission),classification:"unassessed",copy:projected.find(p=>p.id===s.id)?.content,fallback:"Production omits unresolved FPO/media; inspect actual render to judge adequacy. Stored visual direction remains selected.",history:acquisition.filter(w=>w.sectionId===s.id),assets:graph.assets.map(a=>({id:a.id,name:a.name,status:a.status,type:a.type,altText:a.alt_text,usages:graph.asset_usages.filter(u=>u.asset_id===a.id).map(u=>({entityType:u.entity_type,entityId:u.entity_id,role:u.role})),rights:"Presence ownership does not itself establish reuse permission; inspect provenance"})),...(page.slug==="/"&&s.type==="hero"?{heroDecision:["atmosphere / brand reinforcement","deterministic reinforcement","no image"]}: {})} as Need];});
    const siteFingerprint=stateFingerprint(graph),acquisitionFingerprint=fingerprint({sourceSchema,jobs,candidates,events});
    const presentation={siteConfiguration:site.configuration,designSystems:graph.design_systems.map(r=>({id:r.id,version:r.version,status:r.status,configuration:r.configuration}))};
    const contextFingerprint=fingerprint({target,siteFingerprint,acquisitionFingerprint,presentation,buildId:scope.buildId,packetContract:1});
    const technical:Technical={status:"not assessed",buildId:scope.buildId,renderContext:fingerprint({siteFingerprint,presentation,buildId:scope.buildId}),routes:[],views:[],limitations:["No browser evidence collected yet; no aesthetic or semantic approval implied"]};
    return {version:1,reviewedAt:new Date().toISOString(),target,canonicalFingerprint:stateFingerprint(state),siteFingerprint,acquisitionFingerprint,contextFingerprint,presentation,routes:pages.map(p=>({id:p.id,slug:p.slug,title:p.title,version:p.version})),sections:projected,actions,truth,needs,acquisition,technical,limitations:["Operator-local report, not canonical authority or customer acceptance","Proofreading mechanism is not implemented; human assessment required","Discussion learning is not a candidate decision; recorded states/events remain authoritative","Canonical need importance does not automatically determine QC criticality",exists?"Acquisition history loaded read-only":"No acquisition table/scope available; history unavailable, not zero activity"]};
  }finally{await db.query("ROLLBACK");db.release();}
}
