import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { confirmedAssessment, informationRequest, type InformationRequest } from "../lib/platform/activation/information";
import { initialAssessment } from "../lib/platform/activation/model";
import { fingerprint } from "../lib/platform/canonical/model";
import type { Submission } from "../lib/platform/reviews/model";

const input=():InformationRequest=>({requestId:randomUUID(),expectedVersion:3,customer:{organizationId:randomUUID(),webPresenceId:randomUUID(),managedSiteId:randomUUID()},record:{id:null,expectedVersion:null,expectedFingerprint:null},fact:{field:"audience",key:"audience",value:"Confirmed customers"},source:{kind:"onboarding",reference:"Customer conversation",suppliedAt:new Date().toISOString()},confirmation:{confirmed:true,reference:"Customer explicitly confirmed this bounded fact",at:new Date().toISOString()}});
test("business-information input requires explicit attestation and closed source/customer/record contracts",()=>{
  const good=input();assert.deepEqual(informationRequest(good),good);
  for(const bad of [{...good,confirmation:{...good.confirmation,confirmed:false}},{...good,confirmation:{...good.confirmation,reference:""}},{...good,confirmation:{...good.confirmation,by:"forged"}},{...good,source:{kind:"review",reference:"recommendation"}},{...good,source:{...good.source,transcript:"private transcript"}},{...good,record:{id:null,expectedVersion:1,expectedFingerprint:"0".repeat(64)}},{...good,fact:{...good.fact,kind:"invented-business-description"}},{...good,customer:{...good.customer,organizationId:""}}])assert.throws(()=>informationRequest(bad));
});
test("partial confirmation retains missing required service-area material and unrelated assessment",()=>{
  const before=initialAssessment({answers:{audience:"x",serviceArea:"local"}} as unknown as Submission),request=input();
  const confirmation={requestId:request.requestId,field:"serviceArea" as const,key:"service-area",domain:"knowledge" as const,recordId:randomUUID(),previousVersion:null,previousFingerprint:null,revision:1,revisionFingerprint:"0".repeat(64),source:{kind:"onboarding" as const,reference:"Conversation",suppliedAt:request.confirmation.at,confirmedValueDigest:fingerprint(request.fact)},confirmation:{by:"trusted-operator",reference:"Explicit confirmation",at:request.confirmation.at}};
  const partial=confirmedAssessment(before,confirmation);assert.equal(partial.find(a=>a.area==="service-area")!.state,"UNCONFIRMED");
  assert.deepEqual(partial.filter(a=>a.area!=="service-area"),before.filter(a=>a.area!=="service-area"));
  const complete=confirmedAssessment(partial,{...confirmation,field:"locations",requestId:randomUUID(),key:"locations",revision:2});assert.equal(complete.find(a=>a.area==="service-area")!.state,"CONFIRMED");assert.equal(complete.find(a=>a.area==="operating-access")!.state,"MISSING");
});
