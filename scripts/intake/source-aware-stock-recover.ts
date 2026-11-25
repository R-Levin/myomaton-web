
/** Finish exact retained image custody; never rerun ingestion or create Assets. */
import { workDigest } from "../../lib/platform/work-products/pages";
import assert from"node:assert/strict";
import{readFile,writeFile,realpath,lstat}from"node:fs/promises";
import{join}from"node:path";
import{Pool}from"pg";
import{fingerprint}from"../../lib/platform/canonical/model";
import{verifySourceAwareStock}from"./source-aware-stock";
import{verifyDirectory}from"../../lib/platform/intake/protected-presence-workflow";
import{snapshotPublic}from"../customer-previews/disposable";
import{stateFingerprint}from"../../lib/platform/customer-initialization";
const proposal="f560374969b7abdff53fa33917c9b84f7053f5f9b092b0dccf9a505bcc8f9ddd";
let stage="configuration";
async function read(file:string){const m=await lstat(file);assert.ok(m.isFile()&&!m.isSymbolicLink()&&m.uid===process.getuid?.()&&(m.mode&0o777)===0o600);return JSON.parse(await readFile(file,"utf8"));}
async function save(file:string,value:unknown){await writeFile(file,JSON.stringify(value,null,2)+"\n",{flag:"wx",mode:0o600});}
async function main(){
 assert.deepEqual(process.argv.slice(2),["RECOVER-HOME-42-MEDIA"]);assert.equal(process.platform,"linux");assert.notEqual(process.env.NODE_ENV,"production");
 const parent=join(await realpath(process.env.HOME??""),"miopages-private-acceptance"),id="41a83e7e-1765-4517-941a-b2b151bb7c4a",root=join(parent,"presence-evaluation",id);
 await verifyDirectory(parent);await verifyDirectory(root);
 const {context}=await read(join(root,"context.json")),grant=await read(join(root,"grant.json"));
 assert.equal(context.intakeId,id);assert.equal(context.evaluation.basis,proposal);assert.ok(grant.expiresAt>Date.now());assert.equal(grant.contextDigest,fingerprint(context));assert.ok(grant.originalMaterials.candidateReview.includeOperatorProjections);
 const checkpoint=await read(join(root,"media/stock-intake-home-42.json")),packet=await read(join(root,"home-42.json"));
 assert.equal(checkpoint.proposal,proposal);assert.equal(checkpoint.sourceVersion,42);assert.equal(checkpoint.sourcePacket,packet.digest);assert.deepEqual(checkpoint.scope,context.scope);
 const records=await Promise.all(["5467838","593371"].map(n=>read(join(root,"media/stock-record-42-"+n+".json"))));
 assert.deepEqual(records.map(r=>r.sourceId).sort(),["5467838","593371"]);const images=records.map(r=>r.image);
 const selected=await read(join(root,"media/stock-selection.json"));
 for(const r of records){const item=selected.entries.find((x:{hit:{sourceId:string}})=>x.hit.sourceId===r.sourceId);assert.ok(item);assert.equal(item.preparedSha256,r.image.digest);assert.equal(r.image.assetId,r.assetId);assert.equal(r.image.sectionId,r.target.sectionId);}
 const u=new URL("postgresql://postgres@127.0.0.1:36339/migration_rehearsal_"+id.replaceAll("-",""));u.password=(await readFile(join(parent,"p0-22-c0-runtime/db/password"),"utf8")).trim();
 const db=new Pool({connectionString:u.href,options:"-c default_transaction_read_only=on"});
 try{
  stage="exact-current-event-and-existing-records";
  const event=(await db.query("SELECT version,payload,digest FROM public.presence_workflow_events WHERE intake_id=$1 ORDER BY version DESC LIMIT 1",[id])).rows[0];
  assert.equal(event.version,42);assert.equal(event.digest,checkpoint.sourceEvent);assert.equal(event.digest,fingerprint(event.payload));assert.ok(!event.payload.work&&!event.payload.failure);
  const before=stateFingerprint(await snapshotPublic(db));
  const result={...packet,images,originalPacketDigest:packet.digest,sourceVersion:42,
   localStockEvidence:{schema:checkpoint.schema,scope:context.scope,contextDigest:fingerprint(context),sourceVersion:42,sourceEvent:event.digest,records,publicCanonicalUnchanged:true},
   digest:fingerprint({candidate:packet.candidate,images,records,source:packet.digest})};
  stage="independent-locked-rights-usage-and-bytes-verification";
  await verifySourceAwareStock(db,root,{context},result);
  assert.equal(stateFingerprint(await snapshotPublic(db)),before);
  stage="complete-existing-private-packet";
  await save(join(root,"home-42-media.json"),result);
  const reviewed={contextDigest:fingerprint(context),schema:checkpoint.schema,homeDigest:workDigest(event.payload.pages.find((p:{path:string})=>p.path==="/")),records};
  await save(join(root,"media/reviewed-stock-context-42.json"),reviewed);
  await save(join(root,"media/reviewed-stock-context.json"),reviewed);
  await save(join(root,"media/stock-recovery-42.json"),{proposal,sourceEvent:event.digest,packet:result.digest,assets:images.map(i=>i.assetId),usages:images.map(i=>i.usageId),publicBaseline:before,ingestionRepeated:false,newAssets:0,providerCalls:0});
  console.log(JSON.stringify({status:"PASS",operation:"recover-exact-retained-private-media",version:42,images:2,digest:result.digest,newAssets:0,publicCanonicalUnchanged:true,providerCalls:0,publicUseApproved:false}));
 }finally{await db.end()}
}
main().catch((e:Error&{code?:string})=>{console.error(JSON.stringify({status:"BLOCKED",operation:"recover-retained-private-media",stage,code:/^[A-Z0-9_]+$/.test(e.code??"")?e.code:"PRIVATE_MEDIA_REFUSED",requirement:"Preserve exact existing records; no duplicate ingestion or automatic retry."}));process.exitCode=1});
