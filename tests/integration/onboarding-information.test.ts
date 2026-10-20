import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdir,writeFile } from "node:fs/promises";
import { activationFixture } from "../../scripts/activation/disposable";
import { intakeAnswersV2 } from "../helpers/intake";
import { inspectionText } from "../../lib/platform/activation/service";
import { fingerprint } from "../../lib/platform/canonical/model";
import { inspectCanonical, writeCanonical } from "../../lib/platform/canonical/writes";
import type { InformationFact,InformationRequest } from "../../lib/platform/activation/information";

test("onboarding information: explicit scoped confirmation, canonical revisions and atomic assessment",async t=>{
  const url=process.env.ASSET_TEST_DATABASE_URL;assert.ok(url,"Isolated PostgreSQL URL required");
  const old={NODE_ENV:process.env.NODE_ENV,MIOPAGES_REVIEW_SYNTHESIS:process.env.MIOPAGES_REVIEW_SYNTHESIS};Object.assign(process.env,{NODE_ENV:"development",MIOPAGES_REVIEW_SYNTHESIS:"local-operator"});
  const f=await activationFixture(url),svc=f.service();
  const prepare=async(path:"FREE_REVIEW"|"DIRECT_START",bind=true)=>{
    const a=await f.submit(path,intakeAnswersV2()),review=path==="FREE_REVIEW"?await f.review(a.submission):null;
    const created=await svc.create(a.context,{requestId:randomUUID(),scope:a.scope,submissionId:a.submission.id,submissionDigest:a.submission.digest,...(review?{review:review.request}:{})});
    await svc.update(a.context,created.id,a.scope,1,randomUUID(),"confirm-commercial",{source:"agreement-order",reference:"Synthetic external agreement",confirmedAt:new Date().toISOString(),launchScope:"One Launch",ongoingScope:"Continuing care"});
    const init=f.grant(a.scope,["initialize-customer","inspect"]),plan=await svc.canonicalReadiness(init,created.id,a.scope);
    const initialized=bind?await svc.initializeCanonicalCustomer(init,created.id,a.scope,{requestId:randomUUID(),expectedVersion:2,expectedCustomerFingerprint:plan.customerStateFingerprint,identity:{organizationName:"Synthetic information customer",webPresenceName:"Synthetic presence",managedSiteName:"Synthetic site",confirmation:{reference:"Explicit identity attestation",confirmedAt:new Date().toISOString()}}}):null;
    const b=initialized?.canonicalBinding,customer=b?{organizationId:b.organizationId,webPresenceId:b.webPresenceId,managedSiteId:b.managedSiteId}:{organizationId:randomUUID(),webPresenceId:randomUUID(),managedSiteId:randomUUID()};
    const target={webPresenceId:customer.webPresenceId,managedSiteId:customer.managedSiteId,pendingCustomerId:a.scope.pendingCustomerId};
    const context=f.grantScopes([a.scope,target],["confirm-business-information","inspect"]);
    return {...a,created,review,customer,target,sourceContext:a.context,context,init};
  };
  type Prepared=Awaited<ReturnType<typeof prepare>>;
  const request=async(a:Prepared,fact:InformationFact):Promise<InformationRequest>=>{
    const current=await svc.inspect(a.init,a.created.id,a.scope),domain=fact.field==="offer"?"offering":"knowledge";
    const row=(await f.pool.query(domain==="knowledge"?"SELECT id FROM business_knowledge WHERE web_presence_id=$1":"SELECT id FROM offerings WHERE web_presence_id=$1 AND key=$2",domain==="knowledge"?[a.customer.webPresenceId]:[a.customer.webPresenceId,fact.key])).rows[0];
    const canonical=row?await inspectCanonical(f.pool,domain,a.customer.webPresenceId,row.id):null;
    const at=new Date().toISOString();return {requestId:randomUUID(),expectedVersion:current.version,customer:a.customer,record:canonical?{id:row.id,expectedVersion:canonical.row.version,expectedFingerprint:canonical.fingerprint}:{id:null,expectedVersion:null,expectedFingerprint:null},fact,source:{kind:"onboarding",reference:"Synthetic customer conversation",suppliedAt:at},confirmation:{confirmed:true,reference:"Customer confirmed every supplied value",at}};
  };
  const state=async()=>fingerprint((await f.pool.query("SELECT to_jsonb(t) row FROM activation_case_events t ORDER BY id")).rows);
  try{
    const a=await prepare("FREE_REVIEW"),unbound=await prepare("DIRECT_START",false),reviewBefore=fingerprint(await a.review!.store.read());
    const audience:InformationFact={field:"audience",key:"audience",value:String(a.submission.answers.audience)},input=await request(a,audience);
    input.source={kind:"intake",field:"audience",valueDigest:fingerprint(a.submission.answers.audience)};
    await t.test("unbound, untrusted, foreign scope, missing attestation, Review evidence and stale case refuse",async()=>{
      const baseline=await state();
      await assert.rejects(svc.confirmBusinessInformation(unbound.context,unbound.created.id,unbound.scope,{...input,expectedVersion:2,customer:unbound.customer}),/bound/);
      for(const ctx of ["forged",a.sourceContext,f.grant(a.scope,["confirm-information"]),f.grant(a.scope,["confirm-business-information"])])await assert.rejects(svc.confirmBusinessInformation(ctx,a.created.id,a.scope,input),/authority/);
      await assert.rejects(svc.confirmBusinessInformation(a.context,a.created.id,a.scope,{...input,customer:{...a.customer,webPresenceId:randomUUID()}}),/scope/);
      await assert.rejects(svc.confirmBusinessInformation(a.context,a.created.id,a.scope,{...input,confirmation:{...input.confirmation,reference:""}}));
      await assert.rejects(svc.confirmBusinessInformation(a.context,a.created.id,a.scope,{...input,confirmation:{...input.confirmation,confirmed:false}} as unknown as InformationRequest),/confirmed/);
      await assert.rejects(svc.confirmBusinessInformation(a.context,a.created.id,a.scope,{...input,source:{kind:"review"}} as unknown as InformationRequest),/Review/);
      await assert.rejects(svc.confirmBusinessInformation(a.context,a.created.id,a.scope,{...input,expectedVersion:2}),/Stale activation/);
      await assert.rejects(svc.confirmBusinessInformation(a.context,a.created.id,a.scope,{...input,source:{kind:"intake",field:"audience",valueDigest:"0".repeat(64)}}),/source mismatch/);
      await assert.rejects(svc.confirmBusinessInformation(a.context,a.created.id,a.scope,{...input,fact:{field:"audience",key:"audience",value:"Untraceable edited intake text"}}),/onboarding source/);
      assert.equal(await state(),baseline);
    });
    let first:Awaited<ReturnType<typeof svc.confirmBusinessInformation>>;
    await t.test("confirmed intake produces internal Knowledge revision and exact concurrent retries without changing Review/source",async()=>{
      const before=(await svc.inspect(a.init,a.created.id,a.scope)).state.assessment;
      assert.equal(before.find(v=>v.area==="audience")!.state,"UNCONFIRMED");
      const replies=await Promise.all([svc.confirmBusinessInformation(a.context,a.created.id,a.scope,input),svc.confirmBusinessInformation(a.context,a.created.id,a.scope,input)]);assert.deepEqual(replies[0],replies[1]);first=replies[0];
      assert.equal(first.previous,null);assert.equal(first.confirmation.revision,1);assert.equal(first.revision.snapshot.payload.entries[0].evidence.confirmation,"confirmed");assert.equal(first.revision.snapshot.payload.approval.scope,"internal");
      assert.equal(first.case.state.assessment.find(v=>v.area==="audience")!.state,"CONFIRMED");assert.equal(first.case.state.assessment.find(v=>v.area==="operating-access")!.state,"MISSING");assert.equal(fingerprint(await a.review!.store.read()),reviewBefore);
      const source=(await f.pool.query("SELECT answers,provenance,digest FROM prospect_intake_submissions WHERE id=$1",[a.submission.id])).rows[0];assert.deepEqual(source,{answers:a.submission.answers,provenance:a.submission.provenance,digest:a.submission.digest});
      const current=await inspectCanonical(f.pool,"knowledge",a.customer.webPresenceId,first.confirmation.recordId);assert.ok(current);
      await assert.rejects(writeCanonical(f.pool,{domain:"knowledge",id:current.row.id,webPresenceId:a.customer.webPresenceId,expectedVersion:current.row.version,expectedFingerprint:current.fingerprint,payload:current.row.payload,responsibleIdentity:current.row.payload.approval.by,changeReason:"Default writer still requires an active owner"}),/Active owner/);
    });
    await t.test("manual gaps use existing Knowledge; service-area remains partial until both required aspects are confirmed",async()=>{
      const area=await request(a,{field:"serviceArea",key:"service-area",value:"Customer-confirmed regional work"});const partial=await svc.confirmBusinessInformation(a.context,a.created.id,a.scope,area);
      assert.equal(partial.confirmation.revision,2);assert.equal(partial.previous.snapshot.version,1);assert.equal(partial.case.state.assessment.find(v=>v.area==="service-area")!.state,"UNCONFIRMED");
      const location=await request(a,{field:"locations",key:"locations",value:"Remote delivery; no visitor-facing office"});const complete=await svc.confirmBusinessInformation(a.context,a.created.id,a.scope,location);assert.equal(complete.case.state.assessment.find(v=>v.area==="service-area")!.state,"CONFIRMED");
      const before=await state();const stale={...area,requestId:randomUUID(),expectedVersion:complete.case.version};await assert.rejects(svc.confirmBusinessInformation(a.context,a.created.id,a.scope,stale),/Stale canonical/);assert.equal(await state(),before);
      const conflicting={...input,fact:{...audience,value:"Changed under the original key"}};await assert.rejects(svc.confirmBusinessInformation(a.context,a.created.id,a.scope,conflicting),/idempotency conflict/);
      const retarget=await request(a,{field:"audience",key:"other-audience",value:"Unintended duplicate"});await assert.rejects(svc.confirmBusinessInformation(a.context,a.created.id,a.scope,retarget),/exact canonical target/);
      const reusedKey=await request(a,{field:"locations",key:"service-area",value:"Wrong field key"});await assert.rejects(svc.confirmBusinessInformation(a.context,a.created.id,a.scope,reusedKey),/exact canonical target|another information field/);
      const retry=await svc.confirmBusinessInformation(a.context,a.created.id,a.scope,input);assert.equal(retry.confirmation.revision,1);assert.equal(retry.revision.snapshot.version,1);
    });
    await t.test("confirmed canonical source is scoped/current and preserves value while recording explicit re-attestation",async()=>{
      const next=await request(a,audience);next.source={kind:"canonical",domain:"knowledge",recordId:next.record.id!,version:next.record.expectedVersion!,fingerprint:next.record.expectedFingerprint!,key:"audience"};
      const forged={...next,source:{...next.source,recordId:randomUUID()}};await assert.rejects(svc.confirmBusinessInformation(a.context,a.created.id,a.scope,forged),/owned canonical/);
      const result=await svc.confirmBusinessInformation(a.context,a.created.id,a.scope,next);assert.equal(result.confirmation.source.kind,"canonical");assert.equal(result.revision.snapshot.payload.entries.find((e:{key:string})=>e.key==="audience").value,audience.value);
    });
    const b=await prepare("DIRECT_START");
    await t.test("an existing record belonging to another customer is not a writable target",async()=>{
      const other=await request(b,{field:"audience",key:"audience",value:"Foreign target attempt"}),owned=await inspectCanonical(f.pool,"knowledge",a.customer.webPresenceId,first.confirmation.recordId);assert.ok(owned);
      await assert.rejects(svc.confirmBusinessInformation(b.context,b.created.id,b.scope,{...other,record:{id:owned.row.id,expectedVersion:owned.row.version,expectedFingerprint:owned.fingerprint}}),/Owned canonical/);
    });
    await t.test("Direct Start confirms a manually collected Offering without Review, content, publication or active-state changes",async()=>{
      const fact:InformationFact={field:"offer",key:"consulting",type:"service",name:"Confirmed consulting",summary:"A confirmed advisory service",detail:"Customer-confirmed bounded service description"};
      const output=await svc.confirmBusinessInformation(b.context,b.created.id,b.scope,await request(b,fact));assert.equal(output.case.review,null);assert.equal(output.confirmation.domain,"offering");assert.equal(output.revision.snapshot.status,"inactive");assert.equal(output.case.state.assessment.find(v=>v.area==="offering")!.state,"CONFIRMED");
      assert.deepEqual(output.revision.snapshot.payload.components,[]);assert.deepEqual(output.revision.snapshot.payload.actionIds,[]);
      for(const table of ["pages","design_systems","navigations","actions"])assert.equal((await f.pool.query(`SELECT count(*)::int n FROM ${table} WHERE ${table==="pages"?"managed_site_id":"web_presence_id"}=$1`,[table==="pages"?b.customer.managedSiteId:b.customer.webPresenceId])).rows[0].n,0);
      assert.equal((await f.pool.query("SELECT status FROM web_presences WHERE id=$1",[b.customer.webPresenceId])).rows[0].status,"inactive");
    });
    await t.test("revision and later assessment-event failures roll back canonical current/history and permit safe retry",async()=>{
      const next=await request(b,{field:"audience",key:"audience",value:"Customer-confirmed local clients"});
      await f.pool.query("CREATE FUNCTION synthetic_information_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Forced information rollback'; END $$");
      try{for(const table of ["business_knowledge_revisions","activation_case_events"]){const before=await state();await f.pool.query(`CREATE TRIGGER synthetic_information_failure BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION synthetic_information_failure()`);try{
        await assert.rejects(svc.confirmBusinessInformation(b.context,b.created.id,b.scope,next),/Forced information/);assert.equal((await f.pool.query("SELECT count(*)::int n FROM business_knowledge WHERE web_presence_id=$1",[b.customer.webPresenceId])).rows[0].n,0);assert.equal(await state(),before);
      }finally{await f.pool.query(`DROP TRIGGER synthetic_information_failure ON ${table}`)}}}finally{await f.pool.query("DROP FUNCTION synthetic_information_failure()")}
      assert.equal((await svc.confirmBusinessInformation(b.context,b.created.id,b.scope,next)).confirmation.revision,1);
    });
    await t.test("two distinct operators cannot overwrite a competing confirmation or clobber canonical assessment links",async()=>{
      const next=await request(b,{field:"audience",key:"audience",value:"Customer-confirmed updated clients"}),second=f.grantScopes([b.scope,b.target],["confirm-business-information"],"second-synthetic-operator");
      const results=await Promise.allSettled([svc.confirmBusinessInformation(b.context,b.created.id,b.scope,next),svc.confirmBusinessInformation(second,b.created.id,b.scope,{...next,requestId:randomUUID(),fact:{field:"audience",key:"audience",value:"Competing confirmed clients"}})]);assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.ok(results.some(r=>r.status==="rejected"&&/Stale activation/.test(r.reason.message)));
      const current=await svc.inspect(b.init,b.created.id,b.scope),value=current.state.assessment.map(({area,state,fields,reference})=>({area,state,fields,...(reference===undefined?{}:{reference})}));value.find(v=>v.area==="audience")!.state="UNCONFIRMED";
      await assert.rejects(svc.update(b.sourceContext,b.created.id,b.scope,current.version,randomUUID(),"assess",value),/Canonical confirmations/);
      const unchanged=current.state.assessment.map(({area,state,fields,reference})=>({area,state,fields,...(reference===undefined?{}:{reference})}));
      const access=unchanged.find(v=>v.area==="operating-access")!;access.state="CONFIRMED";access.reference="Separate synthetic operating-access attestation";
      const assessed=await svc.update(b.sourceContext,b.created.id,b.scope,current.version,randomUUID(),"assess",unchanged);
      assert.deepEqual(assessed.state.assessment.find(v=>v.area==="audience"),current.state.assessment.find(v=>v.area==="audience"));assert.equal(assessed.state.assessment.find(v=>v.area==="operating-access")!.state,"CONFIRMED");
      await assert.rejects(f.pool.query("UPDATE business_knowledge_revisions SET change_reason='overwrite' WHERE web_presence_id=$1",[b.customer.webPresenceId]),/immutable/);
    });
    const inspection=await svc.inspectBusinessInformation(a.context,a.created.id,a.scope,a.customer);
    await mkdir("runtime-content/onboarding-information-proof",{recursive:true});await writeFile("runtime-content/onboarding-information-proof/synthetic-operator.txt","SYNTHETIC DISPOSABLE EXAMPLE; fixture removed after verification.\n\nInitial assessment:\n"+JSON.stringify(a.created.state.assessment,null,2)+"\n\n"+inspectionText(inspection.case)+"\nIntake candidates (still prospect supplied):\n"+JSON.stringify(inspection.intakeCandidates,null,2)+"\nExplicit confirmations, previous/new immutable revisions and provenance:\n"+JSON.stringify(inspection.confirmations,null,2));
    await f.verify();
  }finally{await f.stop();Object.assign(process.env,old)}
});
