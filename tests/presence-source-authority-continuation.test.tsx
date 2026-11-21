import assert from "node:assert/strict";
import test from "node:test";
import {fingerprint} from "../lib/platform/canonical/model";
import {sourceTransitionAuthorityMatches, type MarketingAuthority} from "../lib/platform/intake/presence-marketing-authority";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {readSourceTransitionHistory} from "../lib/platform/intake/protected-presence-workflow";
import type {PresenceWorkflowGrant} from "../lib/platform/intake/presence-workflow-provider";
import {PresenceWorkflow,type WorkflowContext} from "../lib/platform/intake/presence-workflow";
import type {Pool} from "pg";

function fixture() {
 const previous:MarketingAuthority={projectionVersion:2,contextDigest:fingerprint("customer"),sources:[{digest:fingerprint("source"),use:"analysis"}],
  sourceSelections:[{digest:fingerprint("source"),passages:["Existing authorized passage."]}],brandDigest:fingerprint("brand"),brandBrief:"Existing brand",
  qualityReviewerId:"existing-reviewer",processingInstructions:[{text:"Existing rule",basis:"owner-direction",reference:"Existing authority"}]};
 const current=structuredClone(previous);
 current.processingInstructions=[...previous.processingInstructions!,{text:"Improve this candidate",basis:"implementation-choice",reference:"Authorized continuation"}];
 return {previous,current,digest:fingerprint(previous)};
}
test("historical source authority accepts a receipt-backed append without changing the prior event",()=>{
 const {previous,current,digest}=fixture(),before=structuredClone(previous);
 assert.equal(sourceTransitionAuthorityMatches(previous,digest),true);
 assert.equal(sourceTransitionAuthorityMatches(current,digest),false,"No unproven fallback");
 assert.equal(sourceTransitionAuthorityMatches(current,digest,previous),true);
 assert.deepEqual(previous,before);
});
test("source rights, source passages, customer, brand, reviewer and original instructions remain immutable",()=>{
 const changes:((a:MarketingAuthority)=>void)[]=[
  a=>{a.sources=[{digest:fingerprint("source"),use:"business-fact"}]},
  a=>{a.sources=[...a.sources,{digest:fingerprint("new"),use:"analysis"}]},
  a=>{a.sourceSelections=[{digest:fingerprint("source"),passages:["Different words."]}]},
  a=>{a.contextDigest=fingerprint("other customer")},a=>{a.brandDigest=fingerprint("other brand")},
  a=>{a.brandBrief="Different brand"},a=>{a.qualityReviewerId="other reviewer"},
  a=>{a.processingInstructions=[...a.processingInstructions!].reverse()},
  a=>{a.processingInstructions=[{...a.processingInstructions![0],text:"Replaced historical rule"},a.processingInstructions![1]]},
 ];
 for(const change of changes){const {previous,current,digest}=fixture();change(current);assert.equal(sourceTransitionAuthorityMatches(current,digest,previous),false)}
 const f=fixture();assert.equal(sourceTransitionAuthorityMatches(f.current,fingerprint("unrelated history"),f.previous),false);
});

test("private history requires both exact grant fingerprints, intact source transition and a matching no-write receipt",{skip:process.platform!=="linux"},async()=>{
 const root=await mkdtemp(join(tmpdir(),"source-authority-continuation-"));
 const f=fixture(),authorization="a".repeat(64),sourceRepair={authorization:fingerprint("source approval"),baseVersion:1,
  previousStateDigest:fingerprint("event"),materialsDigest:fingerprint("materials"),contextTransition:{previousContextDigest:fingerprint("before"),
   previousAuthorityDigest:fingerprint("before authority"),nextContextDigest:f.previous.contextDigest,nextAuthorityDigest:f.digest,addedEvidenceDigests:[fingerprint("source")]}};
 const previous={marketingAuthority:f.previous,contextDigest:f.previous.contextDigest,sourceRepair,expiresAt:Date.now()+60000} as PresenceWorkflowGrant;
 const current={...previous,marketingAuthority:f.current};
 const receipt={authorization,beforeGrant:fingerprint(previous),nextGrant:fingerprint(current),caseUnchanged:true,providerCalls:0,version:113,expiresAt:new Date(current.expiresAt).toISOString()};
 async function save(name:string,value:unknown){await writeFile(join(root,name),JSON.stringify(value),{mode:0o600})}
 const receiptName="whole-site-continuation-aaaaaaaa.receipt.json";
 try{
  await save("grant.json.before-whole-site-aaaaaaaa",previous);await save(receiptName,receipt);
  assert.deepEqual((await readSourceTransitionHistory(root,current))?.authority,previous.marketingAuthority);
  for(const delta of [{beforeGrant:fingerprint("different")},{authorization:"b".repeat(64)},{caseUnchanged:false},{providerCalls:1},{expiresAt:new Date(0).toISOString()}]){
   await save(receiptName,{...receipt,...delta});await assert.rejects(readSourceTransitionHistory(root,current),/history differs/);
  }
  await save(receiptName,receipt);await save("grant.json.before-whole-site-aaaaaaaa",{...previous,sourceRepair:{...sourceRepair,baseVersion:2}});
  await assert.rejects(readSourceTransitionHistory(root,current),/history differs/);
  await rm(join(root,receiptName));await assert.rejects(readSourceTransitionHistory(root,current),/history unavailable/);
 }finally{await rm(root,{recursive:true,force:true})}
});

test("verified continuation resumes the actual workflow and records the authority transition on the next immutable claim",async()=>{
 const f=fixture(),evidence={id:"offer",kind:"owner-confirmed" as const,label:"Fixture",reference:"Offline",date:null,content:"An offline managed web service."};
 const context:WorkflowContext={intakeId:"fixture",scope:{webPresenceId:"presence",managedSiteId:"site"},entry:"DIRECT_START",evidence:[evidence],limitations:[],conflicts:[],evaluation:{scenario:"c0",basis:fingerprint("offline")}};
 f.previous.contextDigest=fingerprint(context);f.current.contextDigest=fingerprint(context);
 f.previous.sources=[{digest:fingerprint(evidence),use:"business-fact"}];f.current.sources=structuredClone(f.previous.sources);
 const initial={version:113,mode:"provider",contextDigest:fingerprint(context),marketingAuthorityDigest:fingerprint(f.previous),evaluation:context.evaluation,
  sourceSnapshot:{evidence:context.evidence,entry:context.entry,limitations:[],conflicts:[]},research:[],report:null,direction:null,blueprint:null,pages:[],corrections:[],confirmation:null,editorial:null,operatorReview:null,work:null,failure:null};
 let saved=structuredClone(initial) as Record<string,any>;const history=[structuredClone(saved)],outputs=new Map<string,Buffer>();let calls=0;
 const operations={mode:"provider" as const,marketingAuthority:f.current,processingContinuation:{authority:f.previous,authorization:fingerprint("approved amendment"),baseVersion:113},
  run:async(run:any,retain:(b:Buffer)=>Promise<void>)=>{calls++;const report={title:"Offline assessment",summary:"Fixture only",findings:[{id:"offer",heading:"Offer",body:evidence.content,status:"established",sourceIds:["offer"]}]};await retain(Buffer.from(JSON.stringify(report)));return report},recover:async()=>null};
 const workflow=new PresenceWorkflow(null as unknown as Pool,operations,{},Date.now,"disposable");
 Reflect.set(workflow,"store",{read:async()=>structuredClone(saved),append:async(_c:unknown,v:number,state:object)=>{assert.equal(v,saved.version);saved={...structuredClone(state),version:v+1};history.push(structuredClone(saved));return structuredClone(saved)},retain:async(_c:unknown,w:{attempt:string},b:Buffer)=>outputs.set(w.attempt,b),output:async(_c:unknown,w:{attempt:string})=>outputs.get(w.attempt)});
 assert.equal(await workflow.verifyResumeState(context),113);assert.equal(history.length,1);assert.equal(calls,0);
 await assert.rejects(workflow.verifyResumeState({...context,intakeId:"foreign"}));
 await workflow.advance(context,113);
 assert.equal(calls,1);assert.equal(saved.marketingAuthorityDigest,fingerprint(f.current));
 assert.equal(saved.processingContinuations.length,1);assert.equal(saved.processingContinuations[0].fromVersion,113);
 assert.deepEqual(history[0],initial);assert.deepEqual(saved.sourceSnapshot,initial.sourceSnapshot);
 assert.equal(await workflow.verifyResumeState(context),115);
 const protectedWorkflow=new PresenceWorkflow(null as unknown as Pool,operations,{},Date.now,"protected");
 Reflect.set(protectedWorkflow,"store",{read:async()=>structuredClone(initial)});
 await assert.rejects(protectedWorkflow.verifyResumeState(context),{code:"draft_changed"});
});
