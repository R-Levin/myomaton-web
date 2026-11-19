import assert from "node:assert/strict";
import {readFile,open,rename,realpath,unlink,lstat} from "node:fs/promises";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {Pool} from "pg";
import plan from "../../docs/c0-source-recovery-amendment.json";
import {fingerprint} from "../../lib/platform/canonical/model";
import {sourceRepairIndex,verifySourceRepairBytes} from "../../lib/platform/intake/presence-source-repair";
import {privateWorkflowBytes,privateWorkflowFile,verifyDirectory,reviewedStockForWorkflow} from "../../lib/platform/intake/protected-presence-workflow";
import {createResponsesPresenceWorkflow,type PresenceWorkflowGrant} from "../../lib/platform/intake/presence-workflow-provider";
import {runInput,type WorkflowContext,type WorkflowRun} from "../../lib/platform/intake/presence-workflow";
import {readRenderedCandidateCustody} from "../../lib/platform/intake/presence-original-custody";
import type {OriginalMaterial} from "../../lib/platform/intake/presence-source-material";
const sha=(b:Buffer)=>createHash("sha256").update(b).digest("hex");
let stage="arguments";
async function main(){
 const op=process.argv[2];assert.ok(process.argv.length===3&&["index","request"].includes(op)&&process.platform==="linux"&&process.env.NODE_ENV!=="production");
 const parent=join(await realpath(process.env.HOME??""),"miopages-private-acceptance"),root=join(parent,"presence-evaluation",plan.scope.intakeId),originals=join(root,"originals");
 await verifyDirectory(root);await verifyDirectory(originals);
 const grant=await privateWorkflowFile<PresenceWorkflowGrant>(join(root,"grant.json"),root),context=(await privateWorkflowFile<{context:WorkflowContext}>(join(root,"context.json"),root)).context;
 assert.equal(grant.sourceRepair?.authorization,"76bb9ca171c604f30007bf0ee3ce0706b1a6c4b8d5dd18995647b2e248083b53");assert.equal(grant.contextDigest,fingerprint(context));assert.ok(Date.now()<grant.expiresAt);
 const ledgerBytes=await privateWorkflowBytes(join(root,"usage/onboarding-usage.json"),root);assert.equal(sha(ledgerBytes),plan.ledgerSha256);
 const password=(await readFile(join(parent,"p0-22-c0-runtime/db/password"),"utf8")).trim(),url=new URL("postgresql://postgres@127.0.0.1:36339/migration_rehearsal_"+plan.scope.intakeId.replaceAll("-",""));url.password=password;
 const db=new Pool({connectionString:url.href,options:"-c default_transaction_read_only=on",connectionTimeoutMillis:5000});
 try{
  const {rows:[event]}=await db.query("SELECT version,digest,payload FROM presence_workflow_events WHERE intake_id=$1 ORDER BY version DESC LIMIT 1",[plan.scope.intakeId]);
  assert.equal(event.version,55);assert.equal(fingerprint(event.payload),event.digest);assert.equal(event.payload.sourceRecovery.authorization,grant.sourceRepair.authorization);
  assert.equal(event.payload.work,null);assert.equal(event.payload.failure,null);assert.equal(event.payload.report,null);
  stage="required-source-registry";
  const indexBytes=await privateWorkflowBytes(join(originals,"index.json"),originals),index=JSON.parse(indexBytes.toString()) as OriginalMaterial[];
  const expected=sourceRepairIndex(grant,index);
  const sourceBytes=async(source:OriginalMaterial)=>{
   const path=join(originals,source.sha256+".source"),m=await lstat(path);
   assert.ok(m.isFile()&&!m.isSymbolicLink()&&m.uid===process.getuid?.()&&(m.mode&0o777)===0o600&&await realpath(path)===path);
   assert.ok(source.bytes<=grant.originalMaterials!.requestBytes&&m.size===source.bytes);
   const bytes=await readFile(path);verifySourceRepairBytes(source,bytes);return bytes;
  };
  if(op==="index"){
   if(fingerprint(expected)!==fingerprint(index)){
    const lock=await open(join(originals,"index.json.lock"),"wx",0o600);
    try{
     assert.deepEqual(await privateWorkflowBytes(join(originals,"index.json"),originals),indexBytes);
     for(const source of expected)await sourceBytes(source);
     const backup=await open(join(originals,"index.before-source-repair.json"),"wx",0o600);try{await backup.writeFile(indexBytes);await backup.sync()}finally{await backup.close()}
     const temp=await open(join(originals,"index.source-repair-next"),"wx",0o600);try{await temp.writeFile(JSON.stringify(expected)+"\n");await temp.sync()}finally{await temp.close()}
     await rename(join(originals,"index.source-repair-next"),join(originals,"index.json"));
    }finally{await lock.close();await unlink(join(originals,"index.json.lock"))}
   }
   console.log(JSON.stringify({status:"PASS",operation:"source-repair-reader-index",records:expected.length,requiredOriginals:grant.originalMaterials!.records.length,previousResearchPreserved:true,ledgerUnchanged:true,providerCalls:0}));return;
  }
  assert.equal(fingerprint(index),fingerprint(expected));
  const input=runInput(context,event.payload),run:WorkflowRun={context,input,work:{operation:"report",attempt:"00000000-0000-4000-8000-000000000001",until:0,inputDigest:fingerprint(input)}};
  let captured:Buffer|undefined,network=0;
  const unavailable=async()=>{throw Error("Preflight network forbidden")};
  const provider=createResponsesPresenceWorkflow({grant,readGrant:async()=>grant,readContext:async()=>context,rates:JSON.parse(ledgerBytes.toString()).rateCard,
   ledgerDirectory:join(root,"usage"),transport:{send:async()=>{network++;return unavailable()}},fetchPage:unavailable,fetchMarketPages:()=>unavailable,
   researchOriginals:{retain:unavailable,render:unavailable},verifyResearchAccess:unavailable,
   readAvailableMedia:async current=>reviewedStockForWorkflow(db,root,current,await privateWorkflowFile(join(root,"media/stock-selection.json"),root)),
   readOriginalMaterials:async current=>[
    ...await Promise.all(index.map(async source=>({source,bytes:await sourceBytes(source)}))),
    ...await readRenderedCandidateCustody(originals,current,grant.originalMaterials!)],
   retainRequest:async(_run,bytes)=>{captured=bytes;throw Error("INSPECTION_COMPLETE")}
  });
  stage="exact-request";
  try{await provider.run(run,unavailable)}catch(error){if(!(error instanceof Error)||error.message!=="INSPECTION_COMPLETE")throw error}
  assert.ok(captured&&network===0);
  const request=JSON.parse(captured.toString()),texts=request.input[0].content.filter((c:{type:string})=>c.type==="input_text").map((c:{text:string})=>c.text) as string[];
  const added=plan.additionalMaterials.map(s=>index.find(row=>row.id===s.id)!);assert.ok(added.every(Boolean));
  for(const source of added)assert.ok(texts.includes((await sourceBytes(source)).toString()),"Complete actual source absent");
  assert.ok(texts.some(t=>t.includes('"businessSnapshot"')&&t.includes('"earlierReviewedEditorial"')));
  assert.ok(request.instructions.includes("Retain strong accurate content or wording"));
  assert.ok(request.instructions.includes("complete supported value"));
  const file=await open(join(root,"source-repair-report-input.request.json"),"wx",0o600);try{await file.writeFile(captured);await file.sync()}finally{await file.close()}
  assert.equal(sha(await privateWorkflowBytes(join(root,"usage/onboarding-usage.json"),root)),plan.ledgerSha256);
  console.log(JSON.stringify({status:"PASS",operation:"source-repair-actual-request",version:55,inputDigest:run.work.inputDigest,requestSha256:sha(captured),requestBytes:captured.length,
   requiredOriginals:grant.originalMaterials!.records.length,addedFullSourcesVerified:5,all29KnowledgeAndCompleteSitesPresent:true,actualImageInputs:request.input[0].content.filter((c:{type:string})=>c.type==="input_image").length,
   priorUsefulWorkRetained:!!input.sourceRecovery?.previous.pages.length,researchRetained:input.research?.length,providerCalls:network,ledgerUnchanged:true}));
 }finally{await db.end()}
}
main().catch(()=>{console.error(JSON.stringify({status:"BLOCKED",operation:"source-repair-preflight",stage,providerCalls:0,requirement:"No provider request dispatched; inspect retained inputs/index and fix within the same authorized source scope."}));process.exitCode=1});
