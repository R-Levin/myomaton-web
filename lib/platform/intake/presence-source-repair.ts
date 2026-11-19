import {createHash} from "node:crypto";
import {fingerprint} from "../canonical/model";
import {validateOriginalGrant,validateOriginalMaterial,type OriginalMaterial,type OriginalMaterialGrant} from "./presence-source-material";
import type {PresenceWorkflowGrant} from "./presence-workflow-provider";
import {validateMarketingAuthority,type MarketingAuthority} from "./presence-marketing-authority";
import type {WorkflowContext} from "./presence-workflow";
import type {PresenceEvidence} from "./presence-workflow-artifacts";

export type SourceRepairPlan={
 version:1;contextDigest:string;baseVersion:number;previousStateDigest:string;previousGrantDigest:string;previousMaterialsDigest:string;
 ledgerSha256:string;expiresAt:string;additionalMaterials:OriginalMaterial[];
};
export function compileSourceRepair(grant:PresenceWorkflowGrant,plan:SourceRepairPlan,authorization:string){
 const digest=/^[a-f0-9]{64}$/u;
 if(plan.version!==1||!Number.isSafeInteger(plan.baseVersion)||plan.baseVersion<1||
  ![authorization,plan.contextDigest,plan.previousStateDigest,plan.previousGrantDigest,plan.previousMaterialsDigest,plan.ledgerSha256].every(x=>digest.test(x))||
  grant.contextDigest!==plan.contextDigest||fingerprint(grant)!==plan.previousGrantDigest||grant.sourceRepair||
  !grant.originalMaterials||grant.marketingAuthority?.projectionVersion!==2||
  fingerprint(grant.originalMaterials.records)!==plan.previousMaterialsDigest||new Date(grant.expiresAt).toISOString()!==plan.expiresAt||
  !plan.additionalMaterials.length)throw Error("Exact unchanged source-repair baseline required");
 const ids=new Set(grant.originalMaterials.records.map(r=>r.id));
 for(const source of plan.additionalMaterials){
  validateOriginalMaterial(source);
  if(ids.has(source.id)||source.purpose==="candidate-review"||source.researchSourceId||source.reviewOf)throw Error("Source-repair addition conflicts");
  ids.add(source.id);
 }
 const next=structuredClone(grant);
 next.originalMaterials!.records=[...next.originalMaterials!.records,...structuredClone(plan.additionalMaterials)];
 validateOriginalGrant(next.originalMaterials!,next.contextDigest);
 next.sourceRepair={authorization,baseVersion:plan.baseVersion,previousStateDigest:plan.previousStateDigest,
  materialsDigest:fingerprint(next.originalMaterials!.records)};
 // Nothing in the existing knowledge, authority, credentials, meter or expiration changes.
 const {originalMaterials:oldMaterials,sourceRepair:oldRepair,...before}=grant;void oldMaterials;void oldRepair;
 const {originalMaterials:newMaterials,sourceRepair:newRepair,...after}=next;void newMaterials;void newRepair;
 if(fingerprint(before)!==fingerprint(after))throw Error("Source repair changed unrelated authority");
 return next;
}
/** The custody index is the provider reader's actual input catalog. Preserve every
 * existing research record and add required grant originals explicitly. */
export function sourceRepairIndex(grant:PresenceWorkflowGrant,index:readonly OriginalMaterial[]){
 if(!grant.originalMaterials||!grant.sourceRepair||grant.sourceRepair.materialsDigest!==fingerprint(grant.originalMaterials.records))throw Error("Repaired source authority required");
 const ids=new Set<string>();
 for(const source of index){validateOriginalMaterial(source);if(ids.has(source.id))throw Error("Duplicate custody source");ids.add(source.id)}
 for(const expected of grant.originalMaterials.records){
  const old=index.find(source=>source.id===expected.id);
  if(old&&fingerprint(old)!==fingerprint(expected))throw Error("Original custody identity conflicts with grant");
 }
 return [...index,...grant.originalMaterials.records.filter(source=>!ids.has(source.id))];
}
export function verifySourceRepairBytes(source:OriginalMaterial,bytes:Buffer){
 if(bytes.length!==source.bytes||createHash("sha256").update(bytes).digest("hex")!==source.sha256)throw Error("Repaired original source bytes differ");
}

/** Version 1 remains the exact historical custody-only amendment. Version 2
 * explicitly binds already-authorized originals into ANALYTICAL evidence. */
export type SourceEvidenceRepairPlan = Omit<SourceRepairPlan,"version"|"additionalMaterials"> & {
 version:2;reasoningMaterialIds:string[];
};
export function compileSourceEvidenceRepair(context:WorkflowContext,grant:PresenceWorkflowGrant,
 plan:SourceEvidenceRepairPlan,material:readonly {source:OriginalMaterial;bytes:Buffer}[],authorization:string){
 const digest=/^[a-f0-9]{64}$/u;
 if(plan.version!==2||!Number.isSafeInteger(plan.baseVersion)||plan.baseVersion<1||
  ![authorization,plan.contextDigest,plan.previousStateDigest,plan.previousGrantDigest,plan.previousMaterialsDigest,plan.ledgerSha256].every(x=>digest.test(x))||
  fingerprint(context)!==plan.contextDigest||grant.contextDigest!==plan.contextDigest||
  fingerprint(grant)!==plan.previousGrantDigest||!grant.originalMaterials||grant.marketingAuthority?.projectionVersion!==2||
  fingerprint(grant.originalMaterials.records)!==plan.previousMaterialsDigest||
  new Date(grant.expiresAt).toISOString()!==plan.expiresAt||
  !plan.reasoningMaterialIds.length||new Set(plan.reasoningMaterialIds).size!==plan.reasoningMaterialIds.length||
  material.length!==plan.reasoningMaterialIds.length)throw Error("Exact source-evidence repair baseline required");
 validateOriginalGrant(grant.originalMaterials,grant.contextDigest);
 validateMarketingAuthority(grant.marketingAuthority,grant.contextDigest,context.evidence.map(fingerprint));
 if(fingerprint([...grant.approvedSources].sort())!==fingerprint(context.evidence.map(fingerprint).sort()))throw Error("Existing evidence authorization differs");
 const ordered=plan.reasoningMaterialIds.map(id=>{
  const matching=material.filter(row=>row.source.id===id);
  if(matching.length!==1)throw Error("Exact reasoning material required");
  return matching[0];
 });
 const bound=bindOriginalReasoningEvidence(context,grant.marketingAuthority,grant.originalMaterials,ordered);
 const {context:nextContext,authority:nextAuthority,addedEvidence:additions}=bound;
 const nextDigest=fingerprint(nextContext);
 const next:PresenceWorkflowGrant={...structuredClone(grant),contextDigest:nextDigest,
  approvedSources:nextContext.evidence.map(fingerprint),marketingAuthority:nextAuthority,
  originalMaterials:{...structuredClone(grant.originalMaterials),contextDigest:nextDigest},
  sourceRepair:{authorization,baseVersion:plan.baseVersion,previousStateDigest:plan.previousStateDigest,
   materialsDigest:fingerprint(grant.originalMaterials.records),contextTransition:{
    previousContextDigest:fingerprint(context),previousAuthorityDigest:fingerprint(grant.marketingAuthority),
    nextContextDigest:nextDigest,nextAuthorityDigest:fingerprint(nextAuthority),addedEvidenceDigests:additions.map(fingerprint)}}};
 validateOriginalGrant(next.originalMaterials!,nextDigest);
 validateMarketingAuthority(nextAuthority,nextDigest,next.approvedSources);
 // Public claim classifications/selections, rights, model, credentials and all
 // financial/request/retry/expiry limits are unchanged. Originals are not edited.
 const rest=(g:PresenceWorkflowGrant)=>{const {contextDigest,approvedSources,marketingAuthority,originalMaterials,sourceRepair,...r}=g;
  void contextDigest;void approvedSources;void marketingAuthority;void originalMaterials;void sourceRepair;return r};
 if(fingerprint(rest(next))!==fingerprint(rest(grant))||
  fingerprint(next.originalMaterials!.records)!==fingerprint(grant.originalMaterials.records)||
  fingerprint(nextAuthority.sourceSelections)!==fingerprint(grant.marketingAuthority.sourceSelections)||
  fingerprint(nextAuthority.sources.slice(0,grant.marketingAuthority.sources.length))!==fingerprint(grant.marketingAuthority.sources))
  throw Error("Source binding changed unrelated authority");
 return{context:nextContext,grant:next,addedEvidence:additions,requiresRecovery:true as const};
}

/** Shared ingestion binding for NEW contexts and explicit retained-case repair.
 * Exact authorized text becomes citable analysis, never an extra public claim. */
export function bindOriginalReasoningEvidence(context:WorkflowContext,authority:MarketingAuthority,originals:OriginalMaterialGrant,
 material:readonly {source:OriginalMaterial;bytes:Buffer}[]){
 validateOriginalGrant(originals,fingerprint(context));
 validateMarketingAuthority(authority,fingerprint(context),context.evidence.map(fingerprint));
 if(authority.projectionVersion!==2||new Set(material.map(row=>row.source.id)).size!==material.length)throw Error("Source-aware unique reasoning binding required");
 const additions:PresenceEvidence[]=material.map(supplied=>{
  const expected=originals.records.find(row=>row.id===supplied.source.id);
  if(!expected||fingerprint(expected)!==fingerprint(supplied.source)||context.evidence.some(row=>row.id===expected.id)||
   !["text/plain","text/markdown"].includes(expected.mime)||!["business-context","brand-reference","editorial-reference"].includes(expected.purpose)||
   expected.status==="public-observation"||expected.researchSourceId||expected.reviewOf||
   !["report","direction","blueprint","page","editorial"].every(operation=>expected.operations.includes(operation as OriginalMaterial["operations"][number])))
   throw Error("Authorized own-source evidence binding required");
  verifySourceRepairBytes(expected,supplied.bytes);
  const content=new TextDecoder("utf-8",{fatal:true}).decode(supplied.bytes);
  if(!content.trim()||content.includes("\u0000"))throw Error("Readable complete source required");
  const kind:PresenceEvidence["kind"]=expected.status==="unconfirmed"?"customer-unconfirmed":
   expected.status==="approved-direction"?"service-direction":expected.status==="owner-confirmed"?"owner-confirmed":"historical-discovery";
  return{id:expected.id,kind,label:expected.reference,reference:expected.reference,date:expected.date,content,rawDigest:expected.sha256};
 });
 const nextContext={...structuredClone(context),evidence:[...structuredClone(context.evidence),...additions]};
 const nextAuthority={...structuredClone(authority),contextDigest:fingerprint(nextContext),
  sources:[...structuredClone(authority.sources),...additions.map(source=>({digest:fingerprint(source),use:"analysis" as const}))]};
 validateMarketingAuthority(nextAuthority,fingerprint(nextContext),nextContext.evidence.map(fingerprint));
 return{context:nextContext,authority:nextAuthority,addedEvidence:additions};
}
