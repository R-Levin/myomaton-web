import assert from "node:assert/strict";
import test from "node:test";
import { verifyProtectedOwner } from "../lib/platform/intake/protected-owner-verification";

for(const failedRead of [false,true])test(`existing owner verification uses real logout header and cleans up ${failedRead?'failed':'successful'} read`,async()=>{
 let step=0;
 const send:typeof fetch=async(input,init)=>{
  assert.equal(String(input),"https://wp-acceptance.miopages.com/api/protected-core");assert.equal(init?.redirect,"error");
  const headers=new Headers(init?.headers);assert.equal(headers.get("Origin"),"https://wp-acceptance.miopages.com");
  const current=step++;
  if(current===0){assert.deepEqual(JSON.parse(String(init?.body)),{operation:"sign-in",username:"owner",password:"fixture-only-not-a-credential"});
   return Response.json({status:"signed_in"},{headers:{"Set-Cookie":"__Host-miopages_core=fixture; HttpOnly; Secure; SameSite=Strict; Max-Age=28800"}});}
  assert.equal(headers.get("Cookie"),"__Host-miopages_core=fixture");
  if(current===1)return Response.json({version:28,prepared:{scenario:"c0"},sitePlanning:{proposal:{privateText:"Never returned by the verifier"}},sitePlanningReview:{current:true},workflow:{version:41}},{status:failedRead?503:200});
  if(current===2){assert.equal(init?.method,"POST");assert.equal(headers.get("X-Core-Operation"),"logout");return Response.json({status:"signed_out"});}
  assert.equal(current,3);return Response.json({error:"sign_in_required"},{status:401});
 };
 if(failedRead){await assert.rejects(verifyProtectedOwner("fixture-only-not-a-credential",undefined,send));assert.equal(step,3);}
 else {assert.deepEqual(await verifyProtectedOwner("fixture-only-not-a-credential",{draftVersion:28,workflowRevision:41},send),
  {draftVersion:28,workflowRevision:41,logoutVerified:true});assert.equal(step,4);}
});
