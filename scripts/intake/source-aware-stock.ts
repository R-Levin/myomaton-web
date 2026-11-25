
/** Trusted, disposable composition of the existing stock intake and AssetUsage writers. */
import { workDigest } from "../../lib/platform/work-products/pages";
import assert from "node:assert/strict";
import{readFile,writeFile,mkdir,lstat,realpath,rename}from"node:fs/promises";
import{join}from"node:path";
import{createHash,randomUUID}from"node:crypto";
import{Pool}from"pg";
import plan from"../../docs/c0-source-aware-run-proposal.json";
import{fingerprint}from"../../lib/platform/canonical/model";
import{SuppliedMediaIntake,type SuppliedMediaAuthority}from"../../lib/platform/acquisition/supplied-media";
import{approvedSuppliedEvidence}from"../../lib/platform/acquisition/supplied-evidence";
import{writeProposalUsage}from"../../lib/platform/content-editing/proposal-media";
import{readManagedObject}from"../../lib/platform/assets/local-storage";
import{createIntakeFixture,intakeSchema}from"./disposable";
import{enableDisposableSuppliedMedia}from"../acquisition/supplied-disposable";
import{verifyDirectory}from"../../lib/platform/intake/protected-presence-workflow";
import type{WorkflowRun}from"../../lib/platform/intake/presence-workflow";
import{privateStockPlacements}from"../../lib/platform/intake/presence-stock-placement";
const proposal="f560374969b7abdff53fa33917c9b84f7053f5f9b092b0dccf9a505bcc8f9ddd";
const sha=(b:Buffer)=>createHash("sha256").update(b).digest("hex");
async function privateJson(file:string){const m=await lstat(file);assert.ok(m.isFile()&&!m.isSymbolicLink()&&m.uid===process.getuid?.()&&(m.mode&0o777)===0o600);return JSON.parse(await readFile(file,"utf8"));}
async function save(file:string,value:unknown){await writeFile(file,JSON.stringify(value,null,2)+"\n",{flag:"wx",mode:0o600});}
async function currentStockContext(root:string,version:number,value:{contextDigest:string;records:{target:{webPresenceId:string;managedSiteId:string};publicUseApproved:boolean}[]}) {
 const file=join(root,"media/reviewed-stock-context.json");
 let previous;
 try{previous=await privateJson(file)}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;await save(file,value);return}
 const bytes=await readFile(file);
 assert.equal(previous.contextDigest,value.contextDigest);
 assert.ok(previous.records.every((r:{target:{webPresenceId:string;managedSiteId:string};publicUseApproved:boolean})=>r.publicUseApproved===false&&r.target.webPresenceId===plan.destination.scope.webPresenceId&&r.target.managedSiteId===plan.destination.scope.managedSiteId));
 await writeFile(join(root,"media/reviewed-stock-context-before-"+version+"-"+sha(bytes)+".json"),bytes,{flag:"wx",mode:0o600});
 const next=join(root,"media/reviewed-stock-context-current-"+version+".json");await save(next,value);await rename(next,file);
}
let operationStage="configuration";
export function privateStockFilename(name:unknown):string {
 assert.ok(typeof name==="string"&&/^(home|site)-[1-9][0-9]*-[a-f0-9-]{36}\.png$/.test(name),"Exact scoped prepared image filename required");return name;
}
export async function verifySourceAwareStock(db:Pool,root:string,run:Pick<WorkflowRun,"context">,packet:ReturnType<typeof JSON.parse>){
 await verifyDirectory(root);
 const proof=packet.localStockEvidence;
 assert.ok(proof&&proof.contextDigest===fingerprint(run.context)&&proof.sourceVersion>0&&proof.publicCanonicalUnchanged===true);
 const schema=intakeSchema(proof.schema),c=await db.connect();
 try{
  await c.query("BEGIN READ WRITE");await c.query("SELECT set_config('search_path',$1,true)",[schema]);
  assert.equal(proof.records.length,packet.images.length);
  for(const image of packet.images){
   privateStockFilename(image.file);
   const record=proof.records.find((r:{assetId:string})=>r.assetId===image.assetId);assert.ok(record);
   assert.equal(record.publicUseApproved,false);assert.deepEqual({webPresenceId:record.target.webPresenceId,managedSiteId:record.target.managedSiteId},run.context.scope);
   const page=packet.candidate.pages.find((p:{id:string})=>p.id===record.target.pageId);
   assert.ok(page&&page.sections.some((s:{id:string})=>s.id===image.sectionId));assert.equal(record.target.sectionId,image.sectionId);
   const asset=(await c.query("SELECT * FROM assets WHERE id=$1 AND web_presence_id=$2 AND status='active'",[image.assetId,run.context.scope.webPresenceId])).rows[0];
   const usage=(await c.query("SELECT * FROM asset_usages WHERE id=$1",[image.usageId])).rows[0];
   assert.ok(asset&&usage&&usage.web_presence_id===record.target.webPresenceId&&usage.asset_id===asset.id&&usage.entity_type==="section"&&usage.entity_id===image.sectionId&&usage.role==="image");
   await approvedSuppliedEvidence(c,record.target,asset.id,asset.metadata.acquisition,{preparedDigest:image.digest,width:image.width,height:image.height,altText:image.alt});
   const b=await readManagedObject(join(root,"media/stock-managed"),record.target.webPresenceId,asset.source_reference);
   assert.equal(sha(b),image.digest);
   assert.equal(sha(await readFile(join(root,image.file))),image.digest);
  }
 }finally{try{await c.query("ROLLBACK")}finally{c.release()}}
}
async function main(){
 const[stage,v,...extra]=process.argv.slice(2),version=Number(v);
 assert.ok(process.platform==="linux"&&process.env.NODE_ENV!=="production"&&!extra.length&&["home","site"].includes(stage)&&Number.isSafeInteger(version)&&version>0);
 Object.assign(process.env,{NODE_ENV:"development",MIOPAGES_SITE_RELEASES:"disposable-operator",MIOPAGES_SITE_PROPOSALS:"local-operator"});
 const parent=join(await realpath(process.env.HOME??""),"miopages-private-acceptance"),root=join(parent,"presence-evaluation",plan.destination.intakeId);
 await verifyDirectory(parent);await verifyDirectory(root);
 const context=(await privateJson(join(root,"context.json"))).context as WorkflowRun["context"],grant=await privateJson(join(root,"grant.json"));
 assert.equal(context.evaluation?.basis,proposal);assert.deepEqual(context.scope,plan.destination.scope);assert.equal(grant.contextDigest,fingerprint(context));assert.ok(Date.now()<grant.expiresAt&&grant.originalMaterials.candidateReview.includeOperatorProjections);
 const name=stage+"-"+version+".json",packet=await privateJson(join(root,name)),receipt=await privateJson(join(root,name+".receipt.json"));
 assert.equal(receipt.packetSha256,sha(await readFile(join(root,name))));assert.equal(receipt.runManifestSha256,proposal);
 assert.equal(receipt.workflowVersion,version);assert.equal(packet.digest,receipt.packetDigest);assert.equal(packet.localDraftOnly,true);assert.equal((packet.images??[]).length,0);
 const url=new URL("postgresql://postgres@127.0.0.1:36339/migration_rehearsal_"+plan.destination.intakeId.replaceAll("-",""));url.password=(await readFile(join(parent,"p0-22-c0-runtime/db/password"),"utf8")).trim();
 const source=new Pool({connectionString:url.href,options:"-c default_transaction_read_only=on"});
 let f:Awaited<ReturnType<typeof createIntakeFixture>>|undefined;
 try{
  operationStage="exact-current-core-and-placement";
  const event=(await source.query("SELECT version,payload,digest FROM public.presence_workflow_events WHERE intake_id=$1 ORDER BY version DESC LIMIT 1",[plan.destination.intakeId])).rows[0];
  assert.equal(event.version,version);assert.equal(fingerprint(event.payload),event.digest);assert.ok(!event.payload.work&&!event.payload.failure);
  const state=event.payload as WorkflowRun["input"]&{contextDigest:string};
  assert.equal(state.contextDigest,fingerprint(context));
  const selection=await privateJson(join(root,"media/stock-selection.json"));assert.equal(selection.contextDigest,state.contextDigest);assert.equal(selection.entries.length,2);
  const placements=privateStockPlacements<typeof selection.entries[number],typeof packet.candidate.pages[number]>(state.pages,packet.candidate,selection.entries);
  if(!placements.length){
   await save(join(root,stage+"-"+version+"-media.json"),{...packet,images:[]});
   console.log(JSON.stringify({status:"PASS",operation:"exact-private-stock-placement",version,images:0,reason:"No suitable Core-proposed placement",publicCanonicalUnchanged:true,providerCalls:0}));return;
  }
  assert.ok(["5467838","593371"].every(id=>selection.entries.some((e:{hit:{sourceId:string}})=>e.hit.sourceId===id)));
  const checkpoint=join(root,"media/stock-intake-"+stage+"-"+version+".json");await assert.rejects(lstat(checkpoint),{code:"ENOENT"});
  operationStage="disposable-existing-contract-fixture";
  f=await createIntakeFixture(url.href);await enableDisposableSuppliedMedia(f.pool);
  await save(checkpoint,{proposal,sourceVersion:version,sourceEvent:event.digest,sourcePacket:packet.digest,schema:f.schema,scope:context.scope,customerApproved:false,publicUseApproved:false});
  const c=await f.pool.connect();
  try{await c.query("BEGIN");
   for(const page of packet.candidate.pages){
    await c.query("INSERT INTO pages(id,managed_site_id,slug,name,title,metadata) VALUES($1,$2,$3,$4,$4,$5)",[page.id,context.scope.managedSiteId,page.path,page.title,{isolatedDraft:context.intakeId,sourceVersion:version,customerApproved:false}]);
    for(let i=0;i<page.sections.length;i++){const s=page.sections[i];
     await c.query("INSERT INTO sections(id,page_id,type,name,sort_order,content,metadata) VALUES($1,$2,$3,$4,$5,$6,$7)",[s.id,page.id,s.type,s.content.heading,i,s.content,{isolatedDraft:context.intakeId,sourceVersion:version,customerApproved:false}]);
    }
   }await c.query("COMMIT");
  }catch(e){await c.query("ROLLBACK");throw e}finally{c.release()}
  const quarantine=join(root,"media/stock-staging"),managed=join(root,"media/stock-managed");
  await mkdir(quarantine,{recursive:true,mode:0o700});await mkdir(managed,{recursive:true,mode:0o700});
  const images=[],records=[];
  for(const p of placements){
   const{entry,page,section}=p,target={...context.scope,pageId:page.id,sectionId:section.id};
   const tokens={"receive-supplied-media":{},"review-supplied-media":{},"revoke-supplied-media":{}};
   const authority:SuppliedMediaAuthority={async authorize(t,op,placement){assert.equal(t,tokens[op]);assert.deepEqual(placement,target);return{operatorId:"delegated-private-candidate-media-review",authorityReference:"Approved exact private C0 evaluation "+proposal}}};
   const intake:SuppliedMediaIntake=new SuppliedMediaIntake(f.pool,authority,quarantine,managed,undefined,async(db,placement)=>{
    assert.deepEqual(placement,target);assert.equal((await db.query("SELECT current_schema() s")).rows[0].s,f!.schema);
    const current=(await db.query("SELECT version,digest FROM public.presence_workflow_events WHERE intake_id=$1 ORDER BY version DESC LIMIT 1",[context.intakeId])).rows[0];assert.equal(current.version,version);assert.equal(current.digest,event.digest);
    const owned=(await db.query("SELECT * FROM pages WHERE id=$1 AND managed_site_id=$2",[target.pageId,target.managedSiteId])).rows[0];
    const slot=(await db.query("SELECT * FROM sections WHERE id=$1 AND page_id=$2",[target.sectionId,target.pageId])).rows[0];
    assert.equal(owned.metadata.isolatedDraft,context.intakeId);assert.equal(owned.metadata.sourceVersion,version);assert.equal(owned.metadata.customerApproved,false);
    assert.equal(slot.type,section.type);assert.deepEqual(slot.content,section.content);
    return{page:owned,section:slot,digest:fingerprint({owned,slot,sourceEvent:event.digest})};
   },["intro","cta"]);
   operationStage="receive-and-contextual-review";
   const bytes=await readFile(join(root,"media",entry.sourceSha256+".original"));assert.equal(sha(bytes),entry.sourceSha256);
   const candidate=await intake.receiveStock(tokens["receive-supplied-media"],target,{submissionId:randomUUID(),selection:entry.selection,bytes});
   assert.equal(candidate.bytes_digest,entry.preparedSha256);
   const inspected=await intake.inspect(tokens["review-supplied-media"],target,candidate.id);assert.equal(sha(inspected.bytes),candidate.bytes_digest);
   const alt=entry.hit.sourceId==="5467838"?"A woman standing in a clothing shop.":"A person working on a laptop in a shared sitting area.";
   const approved=await intake.decide(tokens["review-supplied-media"],target,{decision:"approve",candidateId:candidate.id,subjectDigest:candidate.subject_digest,
    rights:{basis:"provider-license",reference:entry.selection.license.reference},altText:alt,
    reason:"Delegated private development review: ordinary business context, no claim that the depicted person is a customer or endorses MioPages. Exact private placement only; public third-party rights remain open."});
   assert.ok(approved.assetId);const asset=(await f.pool.query("SELECT * FROM assets WHERE id=$1",[approved.assetId])).rows[0];
   operationStage="exact-private-asset-usage";
   const writer=await f.pool.connect();let usageId:string;
   try{await writer.query("BEGIN");await writer.query("LOCK TABLE asset_usages IN SHARE ROW EXCLUSIVE MODE");usageId=randomUUID();
    await writeProposalUsage(writer,null,{id:usageId,web_presence_id:target.webPresenceId,asset_id:asset.id,entity_type:"section",entity_id:target.sectionId,role:"image",
     configuration:{image:{altText:alt,decorative:false}},metadata:{isolatedDraft:context.intakeId,sourceVersion:version,publicUseApproved:false},version:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
    await approvedSuppliedEvidence(writer,target,asset.id,asset.metadata.acquisition,{preparedDigest:candidate.bytes_digest,width:candidate.width,height:candidate.height,altText:alt});
    await writer.query("COMMIT");
   }catch(e){await writer.query("ROLLBACK");throw e}finally{writer.release()}
   const prepared=await readManagedObject(managed,target.webPresenceId,asset.source_reference);assert.equal(sha(prepared),candidate.bytes_digest);
   const file=stage+"-"+version+"-"+target.sectionId+".png";await writeFile(join(root,file),prepared,{flag:"wx",mode:0o600});
   const image={sectionId:target.sectionId,width:candidate.width,height:candidate.height,digest:candidate.bytes_digest,alt,file,assetId:asset.id,usageId:usageId!};
   images.push(image);records.push({target,pagePath:p.sourcePage.path,sourceId:entry.hit.sourceId,sourceUrl:entry.hit.sourceUrl,creator:entry.hit.creator,assetId:asset.id,lineage:asset.metadata.acquisition,image,publicUseApproved:false});
   await save(join(root,"media/stock-record-"+version+"-"+entry.hit.sourceId+".json"),records.at(-1));
  }
  operationStage="independent-usage-readback";
  await f.verify();
  const packetWithMedia={...packet,images,originalPacketDigest:packet.digest,sourceVersion:version,
   localStockEvidence:{schema:f.schema,scope:context.scope,contextDigest:state.contextDigest,sourceVersion:version,sourceEvent:event.digest,records,publicCanonicalUnchanged:true},
   digest:fingerprint({candidate:packet.candidate,images,records,source:packet.digest})};
  await verifySourceAwareStock(f.pool,root,{context},packetWithMedia);
  await save(join(root,stage+"-"+version+"-media.json"),packetWithMedia);
  const reviewedContext={contextDigest:state.contextDigest,schema:f.schema,
   pageDigests:Object.fromEntries(placements.map(p=>[p.sourcePage.path,workDigest(p.sourcePage)])),records};
  await save(join(root,"media/reviewed-stock-context-"+version+".json"),reviewedContext);
  await currentStockContext(root,version,reviewedContext);
  console.log(JSON.stringify({status:"PASS",operation:"exact-private-stock-placement",version,images:images.length,schema:f.schema,publicCanonicalUnchanged:true,publicUseApproved:false,providerCalls:0}));
 }finally{await f?.close();await source.end()}
}
if(process.argv[1]&&/source-aware-stock\.(cjs|ts)$/.test(process.argv[1]))main().catch((e:Error&{code?:string})=>{
 console.error(JSON.stringify({status:"BLOCKED",operation:"exact-private-stock-placement",stage:operationStage,code:/^[A-Z0-9_]+$/.test(e.code??"")?e.code:"PRIVATE_MEDIA_REFUSED",requirement:"Preserve fixture and exact source/usage records; no automatic retry."}));process.exitCode=1;
});
