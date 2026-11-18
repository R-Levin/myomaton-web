import assert from "node:assert/strict";
import {fingerprint} from "../lib/platform/canonical/model";
import test from "node:test";
import {createHash} from "node:crypto";
import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {losslessSourceReferences,resolveSourceReferences} from "../lib/platform/intake/presence-source-material";
import {initializeResponsesUsageLedger,confirmUndispatchedPlanningRequest} from "../lib/platform/intake/intelligent-responses";
const sha=(b:Buffer|string)=>createHash("sha256").update(b).digest("hex");
test("full sources and repeated objects remain exactly recoverable inside the same input",()=>{
 const original="Complete unchanged source. ".repeat(300),body={status:"unconfirmed",content:original,reason:"Proposed, not customer approval."};
 const input={first:body,other:body,originals:[original],difference:{...body,status:"owner-confirmed"}};
 const packed=losslessSourceReferences(input,new Map([[original,{originalText:"exact-source",sha256:sha(original)}]]));
 const root=(packed as {completeInputValues:Record<string,{sha256:string;value:unknown}>}).completeInputValues;
 function expand(v:unknown):unknown{
  if(!v||typeof v!=="object")return v;
  if(Array.isArray(v))return v.map(expand);
  const r=v as Record<string,unknown>;
  if(typeof r.originalText==="string"){assert.equal(r.originalText,"exact-source");assert.equal(r.sha256,sha(original));return original}
  if(typeof r.sameInputValue==="string"){
   const target=root[r.sameInputValue];assert.ok(target);
   const expanded=expand(target.value);assert.equal(fingerprint(expanded),target.sha256);return expanded;
  }
  return Object.fromEntries(Object.entries(r).map(([k,v])=>[k,expand(v)]));
 }
 assert.deepEqual(expand((packed as {value:unknown}).value),input);
 assert.ok(JSON.stringify(packed).length<JSON.stringify(input).length/10);
 assert.equal((expand((packed as {value:unknown}).value) as typeof input).difference.status,"owner-confirmed");
});
test("manual unsent resume requires a unique, rejected, zero-cost, never-generated scoped receipt",async()=>{
 const directory=await mkdtemp(join(tmpdir(),"miopages-unsent-"));
 try{
 await initializeResponsesUsageLedger(directory,{model:"offline-test",verifiedOn:"2026-11-18",inputPerMillion:100,cachedPerMillion:10,cacheWritePerMillion:0,outputPerMillion:100,countMicros:0});
 const file=join(directory,"onboarding-usage.json"),bytes=await readFile(file),initial=JSON.parse(bytes.toString());
 const scope={id:"scope",baselineAttempts:0,startingLedger:sha(bytes),requests:4,generations:2,capMicros:1000,inputTokens:1000,inputBytes:10000};
 const receipt={ownerDigest:"owner",workDigest:"work",workflowScope:"scope",status:"rejected",countDispatched:true,countRequestId:"count_fixture",generationDispatched:false,estimatedMicros:0,reservedMicros:100};
 const save=async(rows:unknown[])=>writeFile(file,JSON.stringify({...initial,attempts:rows})+"\n",{mode:0o600});
 await save([receipt]);await confirmUndispatchedPlanningRequest(directory,scope,"owner","work");
 for(const patch of [{generationDispatched:true},{status:"pending"},{estimatedMicros:1},{countDispatched:false},{generationRequestId:"request"},{responseId:"response"},{usage:{}},{ownerDigest:"other"}]){
  await save([{...receipt,...patch}]);await assert.rejects(confirmUndispatchedPlanningRequest(directory,scope,"owner","work"));
 }
 await save([receipt,receipt]);await assert.rejects(confirmUndispatchedPlanningRequest(directory,scope,"owner","work"));
 }finally{await rm(directory,{recursive:true,force:true})}
});

test("native fields and defaults reconstruct exactly including non-default presentation and nullable planning text",()=>{
 const layout={arrangement:"flow",columns:[],gap:"none",inset:"none",surface:"none",align:"start",measure:"full",typeScale:"body",span:1,mobileOrder:0,border:false,rounded:false};
 const node={kind:"paragraph",text:"Keep complete visitor copy",reference:null,level:null,ordered:false,items:[],layout,children:[]};
 const input={pages:[{root:node},{root:node}],other:{...node,layout:{...layout,gap:"large",rounded:true}}};
 const packed=losslessSourceReferences(input,new Map());
 assert.deepEqual(resolveSourceReferences(packed,new Map()),input);
 const modified=JSON.parse(JSON.stringify(packed));
 const first=Object.values(modified.completeInputValues)[0] as {sha256:string};
 first.sha256="0".repeat(64);
 assert.throws(()=>resolveSourceReferences(modified,new Map()),/differs/);
});
