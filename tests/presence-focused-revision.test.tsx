import assert from "node:assert/strict";import test from "node:test";import type {Pool} from "pg";
import {PresenceWorkflow,type WorkflowContext} from "../lib/platform/intake/presence-workflow";import {fingerprint} from "../lib/platform/canonical/model";
test("one disposable revision round selects exact existing Pages without changing other Pages or authority",async()=>{
 const context:WorkflowContext={scope:{webPresenceId:"presence",managedSiteId:"site"},intakeId:"intake",entry:"DIRECT_START",evidence:[],limitations:[],conflicts:[],evaluation:{scenario:"c0",basis:"fixture"}};
 const authority={contextDigest:fingerprint(context),sources:[],brandDigest:"a".repeat(64),brandBrief:"Fixture",qualityReviewerId:"reviewer"};
 const actor={id:"operator",role:"operator" as const,simulated:false};
 const ready={version:64,contextDigest:fingerprint(context),marketingAuthorityDigest:fingerprint(authority),mode:"provider",evaluation:context.evaluation,sourceSnapshot:{evidence:[],entry:"DIRECT_START",limitations:[],conflicts:[]},
  pages:["/","/service","/retain"].map(path=>({path,sections:[],actions:[]})),editorial:{summary:"Existing review",concerns:[{path:"/",concern:"Opening repeats"},{path:"/service",concern:"Scope repeats"}]},
  research:[],report:{findings:[]},direction:{},confirmation:{},blueprint:{pages:["/","/service","/retain"].map(path=>({path}))},homeReview:{digest:"retained"},work:null,failure:null,operatorReview:null,corrections:[],revisionRequest:{ordinal:2}};
 let saved=structuredClone(ready),writes=0;
 const build=(boundary:"disposable"|"protected"="disposable")=>{
  const workflow=new PresenceWorkflow(null as unknown as Pool,{mode:"provider",marketingAuthority:authority,maxEditorialRevisions:3,async run(){throw Error("No provider")},async recover(){throw Error("No provider")}}, {},Date.now,boundary);
  Reflect.set(workflow,"store",{read:async()=>structuredClone(saved),append:async(_context:unknown,version:number,value:typeof ready)=>{assert.equal(version,64);writes++;saved={...value,version:65};return structuredClone(saved)}});
  return workflow;
 };
 for(const selected of [[],["/","/"],["/outside"]])await assert.rejects(build().requestEditorialRevision(context,64,actor,selected),{code:"workflow_not_ready"});
 await assert.rejects(build("protected").requestEditorialRevision(context,64,actor,["/"]),{code:"workflow_not_ready"});
 await assert.rejects(build().requestEditorialRevision(context,64,{...actor,role:"customer"},["/"]),{code:"unavailable"});
 assert.equal(writes,0);
 const result=await build().requestEditorialRevision(context,64,actor,["/","/service"]);assert.ok(result);
 assert.deepEqual(saved.pages,[ready.pages[2]]);assert.equal(saved.revisionRequest.ordinal,3);
 assert.deepEqual((saved.revisionRequest as unknown as {paths:string[]}).paths,["/","/service"]);
 assert.equal(writes,1);
});
