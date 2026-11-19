import assert from "node:assert/strict";
import {lstat,open,readFile,realpath} from "node:fs/promises";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {Pool} from "pg";
import plan from "../../docs/c0-source-aware-run-proposal.json";
import {fingerprint} from "../../lib/platform/canonical/model";
import {renderedCaptureIntent,validateRenderedCaptureIntent,type RenderedCandidateBinding} from "../../lib/platform/intake/presence-candidate-capture";
import {prepareRenderedCandidateCustody} from "../../lib/platform/intake/presence-original-custody";
import {PresenceWorkflow} from "../../lib/platform/intake/presence-workflow";
import type {WorkflowRun} from "../../lib/platform/intake/presence-workflow";
import type {PresenceWorkflowGrant} from "../../lib/platform/intake/presence-workflow-provider";
import type {OriginalMaterial} from "../../lib/platform/intake/presence-source-material";
const sha=(b:Buffer)=>createHash("sha256").update(b).digest("hex");
const proposal="f560374969b7abdff53fa33917c9b84f7053f5f9b092b0dccf9a505bcc8f9ddd";
let operationStage="arguments";
async function bytes(file:string,root:string,maximum:number){
 const m=await lstat(file);
 assert.ok(file.startsWith(root+"/")&&m.isFile()&&!m.isSymbolicLink()&&m.uid===process.getuid?.()&&(m.mode&0o777)===0o600&&m.size<=maximum&&await realpath(file)===file);
 return readFile(file);
}
async function save(file:string,b:Buffer){
 let h;try{h=await open(file,"wx",0o600)}catch(e){if((e as NodeJS.ErrnoException).code!=="EEXIST")throw e;
 const m=await lstat(file);assert.ok(m.isFile()&&!m.isSymbolicLink()&&m.uid===process.getuid?.()&&(m.mode&0o777)===0o600&&await realpath(file)===file);
 assert.deepEqual(await readFile(file),b);return}
 try{await h.writeFile(b);await h.sync()}finally{await h.close()}
}
async function main(){
 const [op,stage,v,digest,...extra]=process.argv.slice(2),version=Number(v);
 assert.ok(!extra.length&&["intent","store"].includes(op)&&["home","site"].includes(stage)&&Number.isSafeInteger(version)&&version>0&&/^[a-f0-9]{64}$/.test(digest??""));
 assert.ok(process.platform==="linux"&&process.env.NODE_ENV!=="production");
 const parent=join(await realpath(process.env.HOME??""),"miopages-private-acceptance"),root=join(parent,"presence-evaluation",plan.destination.intakeId);
 assert.ok(!root.includes("/public_html/"));
 operationStage="retained-input-binding";
 const g=JSON.parse((await bytes(join(root,"grant.json"),root,256000)).toString()) as PresenceWorkflowGrant;
 assert.ok(g.expiresAt>Date.now()&&g.marketingAuthority?.earlyConceptReview&&g.originalMaterials);
 const run=JSON.parse((await bytes(join(root,"concept-review-input-"+digest+".json"),root,g.originalMaterials.requestBytes)).toString()) as WorkflowRun;
 assert.equal(run.work.inputDigest,digest);assert.equal(fingerprint(run.input),digest);assert.equal(fingerprint(run.context),g.contextDigest);
 assert.equal(run.context.intakeId,plan.destination.intakeId);assert.deepEqual(run.context.scope,plan.destination.scope);
 assert.equal(run.context.evaluation?.basis,proposal);
 const pw=(await readFile(join(parent,"p0-22-c0-runtime/db/password"),"utf8")).trim();
 const u=new URL("postgresql://postgres@127.0.0.1:36339/migration_rehearsal_"+plan.destination.intakeId.replaceAll("-",""));u.password=pw;
 const db=new Pool({connectionString:u.href,options:"-c default_transaction_read_only=on",connectionTimeoutMillis:5000});
 try{
  operationStage="current-core-state";
  const {rows:[identity]}=await db.query("SELECT current_database() d,host(inet_server_addr()) h");
  assert.equal(identity.d,u.pathname.slice(1));assert.equal(identity.h,"127.0.0.1");
  const {rows:[event]}=await db.query("SELECT version,payload,digest FROM presence_workflow_events WHERE intake_id=$1 ORDER BY version DESC LIMIT 1",[plan.destination.intakeId]);
  assert.equal(event.version,version);assert.equal(fingerprint(event.payload),event.digest);
  const state=event.payload;assert.equal(state.contextDigest,g.contextDigest);assert.ok(!state.work&&!state.failure);
  for(const field of ["pages","report","direction","blueprint","research","corrections","replan","revisionRequest"] as const)
   assert.equal(fingerprint(state[field]??null),fingerprint(run.input[field]??null));
  if(stage==="home"){
   operationStage="current-core-quality-target";
   const noDispatch=async()=>{throw Error("Read-only review cannot dispatch")};
   const current=await new PresenceWorkflow(db,{mode:"provider",marketingAuthority:g.marketingAuthority,run:noDispatch,recover:noDispatch}).review(run.context);
   assert.equal(current?.version,version);assert.equal(run.work.reviewStage?.target,current?.conceptQuality?.target);
  }
  else assert.ok(!run.work.reviewStage&&state.pages.length===state.blueprint.pages.length);
  const intent=renderedCaptureIntent(run,g.originalMaterials);
  const name=stage+"-"+version+".json",packetBytes=await bytes(join(root,name),root,g.originalMaterials.requestBytes),packet=JSON.parse(packetBytes.toString());
  for(const expected of intent.expectedPages){
   const page=packet.candidate.pages.find((p:{path:string})=>p.path===expected.path),source=run.input.pages.find(p=>p.path===expected.path)!;
   assert.equal(page?.title,expected.title);assert.equal(page.sections.length,source.sections.length);
   page.sections.forEach((s:{content:{heading:string;text:string};block?:unknown},i:number)=>{
    assert.equal(s.content.heading,source.sections[i].heading);assert.equal(s.content.text,source.sections[i].body);
    assert.equal(fingerprint(s.block??null),fingerprint(source.sections[i].block??null));
   });
  }
  assert.equal(packet.candidate.pages.length,intent.expectedPages.length);
  const receipt={runManifestSha256:proposal,intakeId:run.context.intakeId,scope:run.context.scope,workflowVersion:version,
   contextDigest:g.contextDigest,inputDigest:digest,packetDigest:packet.digest,packetSha256:sha(packetBytes),brandDigest:g.marketingAuthority!.brandDigest};
  if(op==="intent"){
   operationStage="capture-intent-custody";
   await save(join(root,name+".receipt.json"),Buffer.from(JSON.stringify(receipt)+"\n"));
   await save(join(root,name+".capture-intent.json"),Buffer.from(JSON.stringify({receipt,intent})+"\n"));
   console.log(JSON.stringify({status:"PASS",operation:"private-capture-intent",version,pages:intent.expectedPages.length,packet:name,inputDigest:digest,protectedSourcesExported:false,providerCalls:0}));return;
  }
  operationStage="capture-native-binding";
  const upload=join(root,"capture-upload-"+version),index=JSON.parse((await bytes(join(upload,"index.json"),root,g.originalMaterials.requestBytes)).toString()) as {
   packetSha256:string;packetDigest:string;brandDigest:string;binding:RenderedCandidateBinding;sources:OriginalMaterial[]};
  assert.equal(index.packetSha256,receipt.packetSha256);assert.equal(index.packetDigest,packet.digest);assert.equal(index.brandDigest,receipt.brandDigest);
  validateRenderedCaptureIntent(intent,index.binding);
  const rows=await Promise.all(index.sources.map(async source=>{
   assert.ok(/^[a-f0-9]{64}$/.test(source.sha256));assert.equal(source.reviewOf?.representationDigest,index.binding.representationDigest);
   const mapped=index.binding.pages.find(p=>p.path===source.reviewOf?.path);assert.ok(mapped);
   assert.equal(source.reference,index.binding.origin+"/?page_id="+mapped.wordpressPageId+"&preview=true");
   const b=await bytes(join(upload,source.sha256+".source"),root,g.originalMaterials!.requestBytes);
   assert.equal(b.length,source.bytes);assert.equal(sha(b),source.sha256);return{source,bytes:b};
  }));
  operationStage="scoped-rendered-custody";
  const result=await prepareRenderedCandidateCustody(join(root,"originals"),run,g.originalMaterials,rows);
  console.log(JSON.stringify({status:"PASS",operation:"private-rendered-review-custody",version,inputDigest:digest,...result,providerCalls:0}));
 }finally{await db.end()}
}
main().catch((e:Error&{code?:string})=>{console.error(JSON.stringify({status:"BLOCKED",operation:"private-rendered-review",stage:operationStage,code:/^[A-Z0-9_]+$/.test(e.code??"")?e.code:"REVIEW_BINDING_REFUSED",detail:"Retain the exact Core input and native capture; inspect this stage. No provider call."}));process.exitCode=1});
