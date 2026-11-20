import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {fingerprint as fp} from "../lib/platform/canonical/model";
import {compileWholeSiteContinuation,type WholeSiteContinuation} from "../lib/platform/intake/presence-whole-site-continuation";
import type {PresenceWorkflowGrant} from "../lib/platform/intake/presence-workflow-provider";
import type {WorkflowContext} from "../lib/platform/intake/presence-workflow";

function fixture(){
 const context:WorkflowContext={intakeId:"fixture-intake",scope:{webPresenceId:"fixture-presence",managedSiteId:"fixture-site"},
 entry:"DIRECT_START",evidence:[],limitations:[],conflicts:[],evaluation:{scenario:"c0",basis:fp("offline-only")}};
 const rates={model:"gpt-5.4-2026-03-05",verifiedOn:"2026-11-19",inputPerMillion:2500000,cachedPerMillion:250000,
 outputPerMillion:15000000,cacheWritePerMillion:0,countMicros:0};
 const cap=8000000;
 const stages=Object.fromEntries(["research","report","direction","blueprint","page","revision","editorial"].map(stage=>[stage,{
 rates,requestInputTokens:128000,requestOutputTokens:24000,cumulativeInputTokens:3200000,cumulativeOutputTokens:533333,capMicros:cap}]));
 const grant:PresenceWorkflowGrant={contextDigest:fp(context),approvedSources:[],approvedCorrections:[],researchSources:[],researchResponseBytes:1000,
 expiresAt:Date.now()+60000,maxOutputTokens:24000,maxRetries:3,maxEditorialRevisions:4,maxCommercialReplans:2,
 marketingAuthority:{projectionVersion:2,contextDigest:fp(context),earlyConceptReview:true,sources:[],brandDigest:fp("brand"),brandBrief:"Offline",qualityReviewerId:"reviewer"},
 ledger:{id:fp("retained-id"),startingLedger:fp("retained-prefix"),baselineAttempts:1,requests:65,generations:32,capMicros:cap,inputTokens:240000,inputBytes:36000000,
 stageSpendingPolicy:"shared-aggregate",stages:stages as PresenceWorkflowGrant["ledger"]["stages"],
 carryForward:{debitMicros:11881103,totalCapMicros:19881103,reportHold:{receiptDigest:fp("receipt"),originalWorkDigest:fp("original"),replacementWorkDigest:fp("replacement")}},
 breakdown:{text:32,images:0,searchCalls:8}}};
 const state={version:71,contextDigest:fp(context),work:null,failure:null,operatorReview:null,report:null,direction:null,blueprint:null,pages:[]};
 const ledger=Buffer.from(JSON.stringify({attempts:[{status:"pending"},...Array.from({length:25},(_,i)=>({status:"completed",generationDispatched:true,
 countDispatched:i!==0,estimatedMicros:i===0?5652224:0,...(i===0?{webSearchCalls:1,reservedMicros:6012396}:{})}))]}));
 const plan:WholeSiteContinuation={version:1,caseId:context.intakeId,scope:context.scope,baseVersion:71,stateDigest:fp(state),contextDigest:fp(context),
 previousGrant:fp(grant),ledgerSha256:createHash("sha256").update(ledger).digest("hex"),expiresAt:new Date(grant.expiresAt).toISOString(),model:rates.model,
 usage:{generations:25,requests:49,settledMicros:5652224,heldMicros:6012396,pending:0},
 previous:{capMicros:8000000,generations:32,requests:65,editorialRounds:4,commercialReplans:2},
 next:{capMicros:13000000,generations:44,requests:89,editorialRounds:7,commercialReplans:3,reviewSequence:"site-first"}};
 return{grant,context,state,ledger,plan};
}
test("resource amendment preserves existing custody, permissions, expiry, request sizes, spent ledger and historical counters",()=>{
 const f=fixture(),before=structuredClone(f.grant),bytes=Buffer.from(f.ledger);
 const next=compileWholeSiteContinuation(f.grant,f.context,f.state,f.ledger,f.plan);
 assert.deepEqual(f.grant,before);assert.deepEqual(f.ledger,bytes);
 assert.equal(next.reviewSequence,"site-first");assert.equal(next.ledger.capMicros-f.plan.usage.heldMicros,6987604);
 assert.equal(next.ledger.carryForward!.totalCapMicros,24881103);
 const restored=structuredClone(next);delete restored.reviewSequence;
 restored.maxCommercialReplans=before.maxCommercialReplans;restored.maxEditorialRevisions=before.maxEditorialRevisions;
 restored.ledger.capMicros=before.ledger.capMicros;restored.ledger.generations=before.ledger.generations;restored.ledger.requests=before.ledger.requests;
 restored.ledger.carryForward!.totalCapMicros=before.ledger.carryForward!.totalCapMicros;restored.ledger.breakdown!.text=before.ledger.breakdown!.text;
 for(const [stage,rule]of Object.entries(restored.ledger.stages!))rule.capMicros=before.ledger.stages![stage as keyof NonNullable<typeof before.ledger.stages>].capMicros;
 assert.deepEqual(restored,before,"Only explicitly enumerated resource and sequencing fields change");
});
test("changed source, tenant, event, ledger, pending work, model, rates, expired grant and reset ceilings refuse",()=>{
 for(const mutate of [
  (f:ReturnType<typeof fixture>)=>{f.context.scope.managedSiteId="foreign"},
  (f:ReturnType<typeof fixture>)=>{f.state.version++},
  (f:ReturnType<typeof fixture>)=>{f.ledger=Buffer.concat([f.ledger,Buffer.from(" ")])},
  (f:ReturnType<typeof fixture>)=>{f.plan.model="different"},
  (f:ReturnType<typeof fixture>)=>{f.plan.next.generations=1},
  (f:ReturnType<typeof fixture>)=>{f.plan.usage.settledMicros=1},
  (f:ReturnType<typeof fixture>)=>{f.grant.expiresAt=0;f.plan.previousGrant=fp(f.grant);f.plan.expiresAt=new Date(0).toISOString()},
  (f:ReturnType<typeof fixture>)=>{Reflect.set(f.state,"work",{});f.plan.stateDigest=fp(f.state)},
  (f:ReturnType<typeof fixture>)=>{f.grant.ledger.stages!.page.rates.inputPerMillion=1;f.plan.previousGrant=fp(f.grant)},
  (f:ReturnType<typeof fixture>)=>{const j=JSON.parse(f.ledger.toString());j.attempts.at(-1).status="pending";f.ledger=Buffer.from(JSON.stringify(j));f.plan.ledgerSha256=createHash("sha256").update(f.ledger).digest("hex")},
 ]){const f=fixture();mutate(f);assert.throws(()=>compileWholeSiteContinuation(f.grant,f.context,f.state,f.ledger,f.plan))}
});
