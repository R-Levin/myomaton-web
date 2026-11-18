import assert from "node:assert/strict";
import {readFile,writeFile,mkdir,realpath} from "node:fs/promises";
import {join} from "node:path";
import {randomUUID,createHash} from "node:crypto";
import {Pool} from "pg";
import {intakeDatabaseUrl,intakeSchema} from "./disposable";
import {snapshotPublic} from "../customer-previews/disposable";
import {stateFingerprint} from "../../lib/platform/customer-initialization";
import {SuppliedMediaIntake,type SuppliedMediaAuthority} from "../../lib/platform/acquisition/supplied-media";
import {approvedSuppliedEvidence} from "../../lib/platform/acquisition/supplied-evidence";
import {writeProposalUsage} from "../../lib/platform/content-editing/proposal-media";
import {readManagedObject} from "../../lib/platform/assets/local-storage";
import {fingerprint} from "../../lib/platform/canonical/model";
const intakeId="4d437190-9ce3-460b-81af-edd92279271a";
const proposal="db5eea3ef55b24a4f0c9229b14968f6be4bcc49e1cc902f186961ec985ae2a75";
const sha=(bytes:Buffer)=>createHash("sha256").update(bytes).digest("hex");
let operationStage="configuration";
async function main(){
 assert.equal(process.argv[2],"resume-private-intake","Explicit diagnosed private-intake continuation required");
 Object.assign(process.env,{NODE_ENV:"development",MIOPAGES_SITE_RELEASES:"disposable-operator",MIOPAGES_SITE_PROPOSALS:"local-operator"});
 const parent=join(await realpath(process.env.HOME??""),"miopages-private-acceptance"),root=join(parent,"presence-evaluation",intakeId);
 const url=new URL("postgresql://postgres@127.0.0.1:36339/migration_rehearsal_"+intakeId.replaceAll("-",""));
 url.password=(await readFile(join(parent,"p0-22-c0-runtime/db/password"),"utf8")).trim();
 const {context}=JSON.parse(await readFile(join(root,"context.json"),"utf8"));
 const grant=JSON.parse(await readFile(join(root,"grant.json"),"utf8"));
 assert.ok(Date.now()<grant.expiresAt);assert.equal(context.evaluation.basis,proposal);
 const packet=JSON.parse(await readFile(join(root,"site-64.json"),"utf8"));
 const attempt=JSON.parse(await readFile(join(root,"media/stock-intake-attempt.json"),"utf8"));
 const checkpoint=JSON.parse(await readFile(join(root,"media/stock-intake-checkpoint.json"),"utf8"));
 assert.equal(attempt.proposal,proposal);assert.equal(attempt.sourceVersion,64);assert.equal(attempt.sourcePacket,packet.digest);
 assert.equal(checkpoint.sourceVersion,64);assert.deepEqual(checkpoint.scope,context.scope);
 const schema=intakeSchema(checkpoint.schema), source=new Pool({connectionString:url.href,options:"-c default_transaction_read_only=on"});
 const pool=new Pool({connectionString:intakeDatabaseUrl(url.href,schema)});
 try{
 operationStage="source-and-private-placement";
 const before=stateFingerprint(await snapshotPublic(source));
 const state=(await source.query("SELECT payload FROM public.presence_workflow_events WHERE version=64")).rows[0].payload;
 assert.equal(state.contextDigest,fingerprint(context));assert.equal(state.failure,null);assert.ok(state.editorial);
 const live=(await source.query("SELECT version FROM public.presence_workflow_events ORDER BY version DESC LIMIT 1")).rows[0];
 assert.equal(live.version,64,"Current Core revision changed");
 const home=packet.candidate.pages.find((p:{path:string})=>p.path==="/");
 const generated=state.pages.find((p:{path:string})=>p.path==="/");
 assert.ok(home&&generated);
 const owned=(await pool.query("SELECT * FROM pages WHERE id=$1",[home.id])).rows[0];
 const sections=(await pool.query("SELECT * FROM sections WHERE page_id=$1 ORDER BY sort_order",[home.id])).rows;
 assert.equal(owned.managed_site_id,context.scope.managedSiteId);assert.equal(owned.status,"active");
 assert.equal(owned.metadata.isolatedDraft,intakeId);assert.equal(owned.metadata.sourceVersion,64);assert.equal(owned.metadata.customerApproved,false);
 assert.equal(owned.version,1);assert.equal(sections.length,home.sections.length);
 for(let i=0;i<sections.length;i++){
  assert.equal(sections[i].id,home.sections[i].id);assert.equal(sections[i].type,home.sections[i].type);
  assert.deepEqual(sections[i].content,home.sections[i].content);assert.equal(sections[i].version,1);
  assert.equal(sections[i].metadata.isolatedDraft,intakeId);assert.equal(sections[i].metadata.sourceVersion,64);
 }
 for(const table of ["media_candidates","external_work","assets","asset_usages"]){
  assert.equal((await pool.query("SELECT count(*)::int n FROM "+table)).rows[0].n,0,"No automatic partial-ingestion retry");
 }
 const media=JSON.parse(await readFile(join(root,"media/stock-selection.json"),"utf8"));
 assert.equal(media.contextDigest,state.contextDigest);assert.equal(media.entries.length,2);
 assert.deepEqual(media.entries.map((e:{hit:{sourceId:string}})=>e.hit.sourceId).sort(),["5467838","593371"]);
 await writeFile(join(root,"media/stock-intake-resume.json"),JSON.stringify({proposal,sourceVersion:64,schema,sourcePacket:packet.digest,
  publicBaseline:before,reason:"Private pre-approval placement context; original customer activation guard remains unchanged",startedAt:new Date().toISOString()}),{flag:"wx",mode:0o600});
 const quarantine=join(root,"media/stock-staging"),managed=join(root,"media/stock-managed");
 await mkdir(quarantine,{mode:0o700,recursive:true});await mkdir(managed,{mode:0o700,recursive:true});
 const records=[],images=[];
 for(const entry of media.entries){
  const sectionIndex=generated.sections.findIndex((s:{visual:{brief:string;status:string}})=>s.visual.status==="rights-review"&&s.visual.brief.includes("sourceId "+entry.hit.sourceId));
  assert.ok(sectionIndex>0&&home.sections[sectionIndex].type==="intro","Exact Core-proposed Intro slot required");
  const target={...context.scope,pageId:home.id,sectionId:home.sections[sectionIndex].id};
  const contexts={"receive-supplied-media":Object.freeze({operation:"receive"}),"review-supplied-media":Object.freeze({operation:"review"}),"revoke-supplied-media":Object.freeze({operation:"revoke"})};
  const authority:SuppliedMediaAuthority={async authorize(token,operation,placement){
   assert.equal(token,contexts[operation]);assert.deepEqual(placement,target);
   return {operatorId:"delegated-development-media-operator",authorityReference:"Owner approved private C0 image review "+proposal};
  }};
  const intake=new SuppliedMediaIntake(pool,authority,quarantine,managed,undefined,async(db,placement)=>{
   assert.deepEqual(placement,target);assert.equal((await db.query("SELECT current_schema() s")).rows[0].s,schema);
   assert.equal((await db.query("SELECT current_database() d")).rows[0].d,url.pathname.slice(1));
   const current=(await db.query("SELECT payload FROM public.presence_workflow_events ORDER BY version DESC LIMIT 1")).rows[0].payload;
   assert.equal(fingerprint(current),fingerprint(state),"Exact current Core source required");
   const page=(await db.query("SELECT * FROM pages WHERE id=$1",[placement.pageId])).rows[0];
   const section=(await db.query("SELECT * FROM sections WHERE id=$1",[placement.sectionId])).rows[0];
   assert.deepEqual(page,owned);assert.deepEqual(section,sections[sectionIndex]);
   const graph=(await db.query("SELECT to_jsonb(w) w,to_jsonb(m) m FROM web_presences w JOIN managed_sites m ON m.web_presence_id=w.id WHERE w.id=$1 AND m.id=$2",[placement.webPresenceId,placement.managedSiteId])).rows[0];
   assert.ok(graph);assert.equal(graph.w.organization_id,"0b669145-979a-461c-9a14-e62c6276e6d4");
   return {digest:fingerprint({graph,page,section,sourceEvent:fingerprint(state)}),page,section};
  });
  const bytes=await readFile(join(root,"media",entry.sourceSha256+".original"));assert.equal(sha(bytes),entry.sourceSha256);
  operationStage="receive-stock";
  const candidate=await intake.receiveStock(contexts["receive-supplied-media"],target,{submissionId:randomUUID(),selection:entry.selection,bytes});
  operationStage="inspect-stock";
  const inspection=await intake.inspect(contexts["review-supplied-media"],target,candidate.id);assert.equal(sha(inspection.bytes),candidate.bytes_digest);
  const alt=entry.hit.sourceId==="593371"?"A person working on a laptop in a shared sitting area.":"A woman standing in a clothing shop.";
  const decision={decision:"approve" as const,candidateId:candidate.id,subjectDigest:candidate.subject_digest,
   rights:{basis:"provider-license" as const,reference:entry.selection.license.reference},altText:alt,
   reason:"Private development review: inspected photograph illustrates ordinary business activity, with no customer, endorsement or results claim. Additional third-party and publication review remains open."};
  operationStage="rights-review";
  const approved=await intake.decide(contexts["review-supplied-media"],target,decision);assert.ok(approved.assetId);
  const asset=(await pool.query("SELECT * FROM assets WHERE id=$1",[approved.assetId])).rows[0];
  operationStage="exact-asset-usage";
  const c=await pool.connect();let usage;
  try{await c.query("BEGIN");await c.query("LOCK TABLE asset_usages IN SHARE ROW EXCLUSIVE MODE");
   usage={id:randomUUID(),web_presence_id:target.webPresenceId,asset_id:asset.id,entity_type:"section",entity_id:target.sectionId,role:"image",
    configuration:{image:{altText:alt,decorative:false}},metadata:{isolatedDraft:intakeId,sourceVersion:64,publicUseApproved:false},version:1,
    created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
   await writeProposalUsage(c,null,usage);
   const proof=await approvedSuppliedEvidence(c,target,asset.id,asset.metadata.acquisition,{preparedDigest:candidate.bytes_digest,width:candidate.width,height:candidate.height,altText:alt});
   assert.equal(proof.source,"permissioned-stock");await c.query("COMMIT");
  }catch(error){await c.query("ROLLBACK");throw error}finally{c.release()}
  operationStage="prepared-byte-export";
  const prepared=await readManagedObject(managed,target.webPresenceId,asset.source_reference);assert.equal(sha(prepared),candidate.bytes_digest);
  const file="site-64-"+target.sectionId+".png";await writeFile(join(root,file),prepared,{mode:0o600,flag:"wx"});
  images.push({sectionId:target.sectionId,width:candidate.width,height:candidate.height,digest:candidate.bytes_digest,alt,file,assetId:asset.id,usageId:usage.id});
  records.push({target,sourceId:entry.hit.sourceId,sourceUrl:entry.hit.sourceUrl,creator:entry.hit.creator,candidateId:candidate.id,
   subjectDigest:candidate.subject_digest,lineage:asset.metadata.acquisition,assetId:asset.id,usageId:usage.id,preparedDigest:candidate.bytes_digest,
   sourceDigest:entry.sourceSha256,rights:decision.rights,decisionReason:decision.reason,coreVisual:generated.sections[sectionIndex].visual,publicUseApproved:false});
 }
 assert.equal(stateFingerprint(await snapshotPublic(source)),before,"Public canonical state changed");
 const result={...packet,images,localStockEvidence:{schema,scope:context.scope,sourceVersion:64,records,publicCanonicalUnchanged:true},
  originalPacketDigest:packet.digest,digest:fingerprint({candidate:packet.candidate,images,records,source:packet.digest})};
 await writeFile(join(root,"site-64-media.json"),JSON.stringify(result,null,2),{mode:0o600,flag:"wx"});
 console.log(JSON.stringify({status:"PASS",operation:"core-proposed-private-stock-intake",images:images.length,schema,
  sharedDatabaseWrites:false,publicCanonicalUnchanged:true,sourceVersion:64,digest:result.digest}));
 }finally{await pool.end();await source.end()}
}
main().catch(error=>{console.error(JSON.stringify({status:"BLOCKED",operation:"private-stock-intake",code:error.code??error.name,stage:operationStage,requirement:"Preserve the private checkpoint and inspect the exact stage before any deliberate continuation"}));process.exitCode=1});
