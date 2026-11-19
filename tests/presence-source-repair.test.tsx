import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import test from "node:test";
import {fingerprint} from "../lib/platform/canonical/model";
import {compileSourceRepair,verifySourceRepairBytes,type SourceRepairPlan} from "../lib/platform/intake/presence-source-repair";
import type {PresenceWorkflowGrant} from "../lib/platform/intake/presence-workflow-provider";
import type {OriginalMaterial} from "../lib/platform/intake/presence-source-material";
const fp=fingerprint;
function fixture(){
 const old:OriginalMaterial={id:"old-owned-context",sha256:fp("old exact bytes"),bytes:10,mime:"text/plain",reference:"old same-case source",
  author:"Fixture owner",date:"2026-11-19",status:"approved-direction",purpose:"business-context",operations:["report","page"]};
 const added={...old,id:"actual-owned-site",reference:"actual complete site"};
 const grant:PresenceWorkflowGrant={contextDigest:fp("same customer"),approvedSources:[fp("approved business")],approvedCorrections:[],
  researchSources:[],researchResponseBytes:10000,maxOutputTokens:24000,
  marketingAuthority:{projectionVersion:2,contextDigest:fp("same customer"),sources:[{digest:fp("approved business"),use:"business-fact"}],sourceSelections:[{digest:fp("approved business"),passages:["A fixture offer."]}],brandDigest:fp("brand"),brandBrief:"Fixture brand",qualityReviewerId:"fixture-reviewer"},originalMaterials:{version:1,contextDigest:fp("same customer"),records:[old],requestBytes:100000},
  startsAt:1,expiresAt:Date.parse("2026-11-22T15:58:31.154Z"),ledger:{id:fp("same ledger"),startingLedger:fp("unchanged start"),inputTokens:128000,inputBytes:100000,capMicros:8000000,requests:65,generations:32,baselineAttempts:85},
  maxCommercialReplans:2,maxEditorialRevisions:4};
 const plan:SourceRepairPlan={version:1,contextDigest:grant.contextDigest,baseVersion:54,previousStateDigest:fp("retained54"),
  previousGrantDigest:fp(grant),previousMaterialsDigest:fp([old]),ledgerSha256:fp("unchanged usage"),expiresAt:new Date(grant.expiresAt).toISOString(),additionalMaterials:[added]};
 return{grant,plan,authorization:fp("owner's exact scoped source repair")};
}
test("source-only continuation appends the actual source while preserving every existing authority and spending field",()=>{
 const f=fixture(),before=structuredClone(f.grant),next=compileSourceRepair(f.grant,f.plan,f.authorization);
 assert.deepEqual(f.grant,before);
 assert.deepEqual(next.originalMaterials!.records,[...before.originalMaterials!.records,...f.plan.additionalMaterials]);
 for(const key of ["contextDigest","approvedSources","approvedCorrections","marketingAuthority","ledger","maxCommercialReplans","maxEditorialRevisions","expiresAt","startsAt"] as const)
  assert.deepEqual(next[key],before[key],key);
 assert.deepEqual(next.sourceRepair,{authorization:f.authorization,baseVersion:54,previousStateDigest:f.plan.previousStateDigest,materialsDigest:fp(next.originalMaterials!.records)});
});
test("wrong customer, changed baseline, expired-scope substitution, duplicate originals and unrelated rendered evidence are refused",()=>{
 for(const edit of [
  (f:ReturnType<typeof fixture>)=>{f.plan.contextDigest=fp("other customer")},
  (f:ReturnType<typeof fixture>)=>{f.grant.ledger.capMicros++},
  (f:ReturnType<typeof fixture>)=>{f.plan.previousMaterialsDigest=fp("different material")},
  (f:ReturnType<typeof fixture>)=>{f.plan.expiresAt="2026-11-23T15:58:31.154Z"},
  (f:ReturnType<typeof fixture>)=>{f.plan.additionalMaterials[0].id="old-owned-context"},
  (f:ReturnType<typeof fixture>)=>{f.plan.additionalMaterials[0].purpose="candidate-review"},
  (f:ReturnType<typeof fixture>)=>{f.grant.originalMaterials=undefined},
  (f:ReturnType<typeof fixture>)=>{f.authorization="unscoped"},
 ]){
  const f=fixture();edit(f);assert.throws(()=>compileSourceRepair(f.grant,f.plan,f.authorization));
 }
 const f=fixture(),next=compileSourceRepair(f.grant,f.plan,f.authorization);
 assert.throws(()=>compileSourceRepair(next,{...f.plan,previousGrantDigest:fp(next)},f.authorization),"No second implicit amendment");
});
test("prepared source payloads are exact bytes, not substitutes with similar filenames",()=>{
 const bytes=Buffer.from("The complete authorized source."),f=fixture();
 const source={...f.plan.additionalMaterials[0],bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")};
 verifySourceRepairBytes(source,bytes);
 assert.throws(()=>verifySourceRepairBytes(source,Buffer.from("A handoff about that source.")));
});
