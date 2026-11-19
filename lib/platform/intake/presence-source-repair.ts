import {createHash} from "node:crypto";
import {fingerprint} from "../canonical/model";
import {validateOriginalGrant,validateOriginalMaterial,type OriginalMaterial} from "./presence-source-material";
import type {PresenceWorkflowGrant} from "./presence-workflow-provider";

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
export function verifySourceRepairBytes(source:OriginalMaterial,bytes:Buffer){
 if(bytes.length!==source.bytes||createHash("sha256").update(bytes).digest("hex")!==source.sha256)throw Error("Repaired original source bytes differ");
}
