import assert from "node:assert/strict";
import test from "node:test";
import {fingerprint} from "../lib/platform/canonical/model";
import {sourceTransitionAuthorityMatches, type MarketingAuthority} from "../lib/platform/intake/presence-marketing-authority";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {readSourceTransitionHistory} from "../lib/platform/intake/protected-presence-workflow";
import type {PresenceWorkflowGrant} from "../lib/platform/intake/presence-workflow-provider";

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
 const receipt={authorization,beforeGrant:fingerprint(previous),nextGrant:fingerprint(current),caseUnchanged:true,providerCalls:0,expiresAt:new Date(current.expiresAt).toISOString()};
 async function save(name:string,value:unknown){await writeFile(join(root,name),JSON.stringify(value),{mode:0o600})}
 const receiptName="whole-site-continuation-aaaaaaaa.receipt.json";
 try{
  await save("grant.json.before-whole-site-aaaaaaaa",previous);await save(receiptName,receipt);
  assert.deepEqual(await readSourceTransitionHistory(root,current),previous.marketingAuthority);
  for(const delta of [{beforeGrant:fingerprint("different")},{authorization:"b".repeat(64)},{caseUnchanged:false},{providerCalls:1},{expiresAt:new Date(0).toISOString()}]){
   await save(receiptName,{...receipt,...delta});await assert.rejects(readSourceTransitionHistory(root,current),/history differs/);
  }
  await save(receiptName,receipt);await save("grant.json.before-whole-site-aaaaaaaa",{...previous,sourceRepair:{...sourceRepair,baseVersion:2}});
  await assert.rejects(readSourceTransitionHistory(root,current),/history differs/);
  await rm(join(root,receiptName));await assert.rejects(readSourceTransitionHistory(root,current),/history unavailable/);
 }finally{await rm(root,{recursive:true,force:true})}
});
