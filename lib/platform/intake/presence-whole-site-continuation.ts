import { workDigest } from "../work-products/pages";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fingerprint } from "../canonical/model";
import { validateWorkflowStagePlan, meteredPresenceWorkflow } from "./intelligent-responses";
import type {PresenceWorkflowGrant} from "./presence-workflow-provider";
import type {WorkflowContext} from "./presence-workflow";
import {sourceTransitionAuthorityMatches} from "./presence-marketing-authority";

export type WholeSiteContinuation = {
 version:1|2; caseId:string; scope:WorkflowContext["scope"]; baseVersion:number; stateDigest:string;
 contextDigest:string; previousGrant:string; ledgerSha256:string; expiresAt:string; model:string;
 usage:{generations:number;requests:number;settledMicros:number;heldMicros:number;pending:number};
 previous:{capMicros:number;generations:number;requests:number;editorialRounds:number;commercialReplans:number};
 next:{capMicros:number;generations:number;requests:number;editorialRounds:number;commercialReplans:number;reviewSequence:"site-first"};
 correction?: { pagesDigest:string; maximumNewSpendMicros:number; previousInstructionsDigest:string;
  editorialInputTokens:number; instructions:NonNullable<NonNullable<PresenceWorkflowGrant["marketingAuthority"]>["processingInstructions"]> };
};
type Baseline = { version:number; contextDigest:string; work:unknown; failure:unknown; operatorReview:unknown;
 report:unknown; direction:unknown; blueprint:unknown; pages:unknown[] };
/** Resource/sequence-only proposal. This never writes or authorizes a provider request. */
export function compileWholeSiteContinuation(grant:PresenceWorkflowGrant, context:WorkflowContext,
 state:Baseline, ledger:Buffer, plan:WholeSiteContinuation, now=Date.now()) {
 assert.ok(plan.version===1||plan.version===2);
 for(const hash of [plan.previousGrant,plan.contextDigest,plan.stateDigest,plan.ledgerSha256])assert.match(hash,/^[a-f0-9]{64}$/);
 assert.equal(fingerprint(grant),plan.previousGrant,"Current grant differs");
 assert.equal(fingerprint(context),plan.contextDigest);assert.equal(context.intakeId,plan.caseId);
 assert.deepEqual(context.scope,plan.scope);assert.ok(context.evaluation);
 assert.equal(grant.contextDigest,plan.contextDigest);assert.equal(grant.marketingAuthority?.projectionVersion,2);
 assert.equal(grant.marketingAuthority?.earlyConceptReview,true);
 assert.equal(state.version,plan.baseVersion);assert.equal(fingerprint(state),plan.stateDigest,"Current event differs");
 assert.equal(state.contextDigest,plan.contextDigest);
 for(const value of [state.work,state.failure,state.operatorReview])assert.equal(value,null,"Idle case required");
 if(plan.version===1){
  for(const value of [state.report,state.direction,state.blueprint])assert.equal(value,null,"Idle upstream recovery required");
  assert.equal(state.pages.length,0);assert.equal(plan.correction,undefined);
 }else{
  assert.ok(state.report&&state.direction&&state.blueprint&&state.pages.length>0,"Retained complete candidate required");
  const correction=plan.correction;assert.ok(correction);
  assert.equal(workDigest(state.pages),correction.pagesDigest);
  assert.equal(correction.maximumNewSpendMicros,5_000_000,"Owner-approved new-round ceiling required");
  assert.equal(plan.next.capMicros,plan.usage.heldMicros+correction.maximumNewSpendMicros,"Unused prior allowance cannot be stacked");
  assert.ok(plan.next.generations<=plan.usage.generations+8&&plan.next.requests<=plan.usage.requests+16);
  assert.ok(plan.next.editorialRounds<=plan.previous.editorialRounds+3);
  assert.equal(plan.next.commercialReplans,plan.previous.commercialReplans);
  assert.equal(fingerprint(grant.marketingAuthority!.processingInstructions??[]),correction.previousInstructionsDigest);
  assert.ok(correction.instructions.length>0&&correction.instructions.every(rule=>rule.text.trim()&&rule.reference.trim()&&
   ["owner-direction","implementation-choice"].includes(rule.basis)));
  assert.ok(Number.isSafeInteger(correction.editorialInputTokens)&&correction.editorialInputTokens>=grant.ledger.stages!.editorial.requestInputTokens&&
   correction.editorialInputTokens<=grant.ledger.inputTokens,"Existing global context envelope required");
 }
 assert.equal(createHash("sha256").update(ledger).digest("hex"),plan.ledgerSha256,"Usage ledger differs");
 const actual=JSON.parse(ledger.toString()) as {attempts:{status:string;countDispatched?:boolean;generationDispatched?:boolean;estimatedMicros?:number;webSearchCalls?:number;reservedMicros?:number}[]};
 assert.ok(actual.attempts.length>=grant.ledger.baselineAttempts);
 const recent=actual.attempts.slice(grant.ledger.baselineAttempts);
 assert.ok(recent.every(row=>row.status==="completed"&&Number.isSafeInteger(row.estimatedMicros)),"Pending/uncertain work cannot be amended");
 assert.deepEqual({generations:recent.filter(r=>r.generationDispatched).length,requests:recent.filter(r=>r.countDispatched).length+recent.filter(r=>r.generationDispatched).length,
  settledMicros:recent.reduce((n,r)=>n+r.estimatedMicros!,0),heldMicros:recent.reduce((n,r)=>n+(r.webSearchCalls?r.reservedMicros!:r.estimatedMicros!),0),pending:0},plan.usage,"Actual usage differs");
 assert.equal(grant.expiresAt,Date.parse(plan.expiresAt));assert.ok(now<grant.expiresAt,"Original authority expired");
 assert.equal(plan.model,"gpt-5.4-2026-03-05");
 const before={capMicros:grant.ledger.capMicros,generations:grant.ledger.generations,requests:grant.ledger.requests,
  editorialRounds:grant.maxEditorialRevisions,commercialReplans:grant.maxCommercialReplans};
 assert.deepEqual(before,plan.previous,"Original resource ceilings differ");
 assert.equal(plan.next.reviewSequence,"site-first");
 for(const key of Object.keys(plan.previous) as (keyof typeof plan.previous)[]){
  assert.ok(Number.isSafeInteger(plan.next[key])&&plan.next[key]>=plan.previous[key],"Forward-only explicit ceilings required");
 }
 assert.equal(plan.usage.pending,0);assert.ok(plan.next.capMicros>plan.usage.heldMicros);
 assert.ok(plan.next.generations>plan.usage.generations&&plan.next.requests>plan.usage.requests);
 assert.ok(plan.next.editorialRounds<=plan.next.generations&&plan.next.commercialReplans<=plan.next.generations);
 const next=structuredClone(grant),delta=plan.next.capMicros-grant.ledger.capMicros;
 assert.ok(next.ledger.carryForward&&next.ledger.breakdown&&next.ledger.stages);
 next.ledger.capMicros=plan.next.capMicros;next.ledger.generations=plan.next.generations;next.ledger.requests=plan.next.requests;
 next.ledger.breakdown.text=plan.next.generations;next.ledger.carryForward.totalCapMicros+=delta;
 next.maxEditorialRevisions=plan.next.editorialRounds;next.maxCommercialReplans=plan.next.commercialReplans;
 next.reviewSequence="site-first";
 for(const stage of Object.values(next.ledger.stages)){
  assert.equal(stage.rates.model,plan.model);
  assert.deepEqual(stage.rates,{model:plan.model,verifiedOn:"2026-11-19",inputPerMillion:2500000,cachedPerMillion:250000,
   outputPerMillion:15000000,cacheWritePerMillion:0,countMicros:0},"Approved rate card differs");
  stage.capMicros+=delta;
 }
 if(plan.version===2){
  next.marketingAuthority!.processingInstructions=[...next.marketingAuthority!.processingInstructions??[],...structuredClone(plan.correction!.instructions)];
  next.ledger.stages.editorial.requestInputTokens=plan.correction!.editorialInputTokens;
  if(next.sourceRepair?.contextTransition)assert.ok(sourceTransitionAuthorityMatches(next.marketingAuthority!,
   next.sourceRepair.contextTransition.nextAuthorityDigest,grant.marketingAuthority),"Historical source authority must remain exact");
 }
 validateWorkflowStagePlan(next.ledger.stages,next.ledger,next.marketSearch?.maxToolCalls);
 // Exercise the real dispatcher configuration without invoking its transport.
 meteredPresenceWorkflow("unused-preflight-directory",next.ledger.stages.editorial.rates,
  {send:async()=>{throw Error("Configuration preflight forbids provider dispatch")}},next.ledger,
  next.maxOutputTokens,next.retainedReservation,undefined,"editorial");
 return next;
}
