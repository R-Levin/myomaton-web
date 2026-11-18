import assert from "node:assert/strict";
import test from "node:test";
import type {Pool,PoolClient} from "pg";
import {SuppliedMediaIntake,type SuppliedMediaAuthority} from "../lib/platform/acquisition/supplied-media";
test("trusted private placements retain exact Intro ownership and subject checks",async()=>{
 const target={webPresenceId:"11111111-1111-4111-8111-111111111111",managedSiteId:"22222222-2222-4222-8222-222222222222",
  pageId:"33333333-3333-4333-8333-333333333333",sectionId:"44444444-4444-4444-8444-444444444444"};
 const authority:SuppliedMediaAuthority={async authorize(){throw Error("No authority")}};
 const page={id:target.pageId,managed_site_id:target.managedSiteId,status:"active"};
 const section={id:target.sectionId,page_id:target.pageId,type:"intro",status:"active"};
 const invoke=async(value:unknown)=>{
  const adapter=new SuppliedMediaIntake(null as unknown as Pool,authority,"/private/staging","/private/managed",undefined,
   async()=>value as never);
  return Reflect.get(adapter,"placement").call(adapter,null as unknown as PoolClient,target);
 };
 assert.equal((await invoke({digest:"a".repeat(64),page,section})).digest,"a".repeat(64));
 for(const changed of [{digest:"invalid",page,section},{digest:"a".repeat(64),page:{...page,managed_site_id:"foreign"},section},
  {digest:"a".repeat(64),page,section:{...section,page_id:"foreign"}},{digest:"a".repeat(64),page,section:{...section,type:"hero"}},
  {digest:"a".repeat(64),page,section:{...section,status:"inactive"}}])await assert.rejects(invoke(changed));
 const intake=new SuppliedMediaIntake(null as unknown as Pool,authority,"/private/staging","/private/managed",undefined,async()=>{throw Error("Must not run")});
 await assert.rejects(intake.receive({},target,{submissionId:"55555555-5555-4555-8555-555555555555",source:{kind:"upload",reference:"fixture",suppliedBy:"fixture",claim:"ownership",evidenceReference:null,existingAssetId:null},bytes:Buffer.from("fixture")}),/No authority/);
});
