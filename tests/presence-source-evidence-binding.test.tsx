import assert from "node:assert/strict";
import {createHash,randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import sourceManifest from "../docs/c0-source-recovery-amendment.json";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import type {Pool} from "pg";
import {compileSourceEvidenceRepair,type SourceEvidenceRepairPlan} from "../lib/platform/intake/presence-source-repair";
import {createResponsesPresenceWorkflow,type PresenceWorkflowGrant} from "../lib/platform/intake/presence-workflow-provider";
import {PresenceWorkflow,type WorkflowContext,type WorkflowRun} from "../lib/platform/intake/presence-workflow";
import {marketingCitationIds} from "../lib/platform/intake/presence-marketing-authority";
import {readPage} from "../lib/platform/intake/presence-workflow-artifacts";
import {initializeResponsesUsageLedger,type ResponsesRates} from "../lib/platform/intake/intelligent-responses";
import type {OriginalMaterial} from "../lib/platform/intake/presence-source-material";
import {fingerprint as fp} from "../lib/platform/canonical/model";

const manifest=sourceManifest as {additionalMaterials:OriginalMaterial[]};
const root=process.env.MIOPAGES_SOURCE_REPAIR_FIXTURES??"runtime-content/source-aware-run-e0fef9d-20261119/site-recovery";
const material=manifest.additionalMaterials.map(source=>({source,bytes:readFileSync(join(root,source.sha256+".source"))}));
const actor={id:"offline-author",role:"operator" as const,simulated:false,authority:"Offline fixture only"};
const sha=(b:Buffer)=>createHash("sha256").update(b).digest("hex");
function fixture(){
 const fact={id:"fixture-offer",kind:"owner-confirmed" as const,label:"Offline test only",reference:"Offline",date:null,content:"An offline business offers a managed web service."};
 const context:WorkflowContext={scope:{webPresenceId:randomUUID(),managedSiteId:randomUUID()},intakeId:randomUUID(),entry:"DIRECT_START",
  evidence:[fact],limitations:[],conflicts:[],evaluation:{scenario:"c0",basis:fp("isolated offline source-binding test")}};
 const authority={projectionVersion:2 as const,contextDigest:fp(context),sources:[{digest:fp(fact),use:"business-fact" as const}],
  sourceSelections:[{digest:fp(fact),passages:[fact.content]}],brandDigest:fp("offline"),brandBrief:"Offline",qualityReviewerId:"offline-reviewer"};
 const grant:PresenceWorkflowGrant={contextDigest:fp(context),approvedSources:[fp(fact)],approvedCorrections:[],marketingAuthority:authority,
  researchSources:[{id:"research:offline",url:"https://example.org/",label:"Not fetched"}],researchResponseBytes:1000,maxOutputTokens:4000,
  originalMaterials:{version:1,contextDigest:fp(context),records:material.map(m=>m.source),requestBytes:1_000_000},
  startsAt:Date.now()-1000,expiresAt:Date.now()+3_600_000,maxRetries:0,maxCommercialReplans:2,maxEditorialRevisions:4,
  ledger:{id:fp("offline source binding"),startingLedger:fp("offline ledger"),baselineAttempts:0,requests:10,generations:5,inputTokens:100000,inputBytes:1_000_000,capMicros:8_000_000}};
 const prior={mode:"provider",version:70,contextDigest:fp(context),marketingAuthorityDigest:fp(authority),evaluation:context.evaluation,
  sourceSnapshot:{evidence:context.evidence,entry:context.entry,limitations:[],conflicts:[]},report:null,direction:null,blueprint:null,pages:[],research:[],
  corrections:[],confirmation:null,editorial:null,operatorReview:null,work:null,failure:null,
  sourceRecovery:{authorization:fp("old custody repair"),baseVersion:54,previousStateDigest:fp("old54"),materialsDigest:fp(grant.originalMaterials!.records),
   actor,at:"2026-11-19",priorRevisionOrdinal:3,previous:{report:null,direction:null,blueprint:null,pages:[]}},
  revisionRequest:{paths:["/"],audit:{summary:"Offline prior audit",concerns:[{path:"/",concern:"Offline"}]},priorPages:[],actor,at:"2026-11-19",ordinal:4},
  replan:{ordinal:2,concerns:["offer-and-value"]}};
 const plan:SourceEvidenceRepairPlan={version:2,contextDigest:fp(context),baseVersion:70,previousStateDigest:fp(prior),previousGrantDigest:fp(grant),
  previousMaterialsDigest:fp(grant.originalMaterials!.records),ledgerSha256:fp("offline ledger"),expiresAt:new Date(grant.expiresAt).toISOString(),reasoningMaterialIds:material.map(m=>m.source.id)};
 return{context,grant,plan,prior,authorization:fp("explicit offline source binding authorization")};
}
function memoryStore(workflow:PresenceWorkflow,initial:unknown){
 let saved=JSON.parse(JSON.stringify(initial));
 const history=[structuredClone(saved)],outputs=new Map<string,Buffer>();
 Reflect.set(workflow,"store",{
  read:async()=>structuredClone(saved),
  append:async(_c:unknown,version:number,state:object)=>{assert.equal(version,saved.version);saved=JSON.parse(JSON.stringify({...state,version:version+1}));history.push(structuredClone(saved));return structuredClone(saved)},
  retain:async(_c:unknown,work:WorkflowRun["work"],bytes:Buffer)=>{assert.ok(!outputs.has(work.attempt)||outputs.get(work.attempt)!.equals(bytes));outputs.set(work.attempt,bytes)},
  output:async(_c:unknown,work:WorkflowRun["work"])=>outputs.get(work.attempt)??null,
 });
 return{current:()=>structuredClone(saved),history,outputs};
}

test("all five ACTUAL recovered C0 originals become exact citable analysis without becoming public claims",()=>{
 const f=fixture(),before=fp(f),next=compileSourceEvidenceRepair(f.context,f.grant,f.plan,material,f.authorization);
 assert.equal(fp(f),before);
 assert.equal(next.addedEvidence.length,5);
 for(const {source,bytes} of material){
  const actual=next.context.evidence.find(row=>row.id===source.id)!;
  assert.equal(actual.content,bytes.toString("utf8"));assert.equal(actual.rawDigest,source.sha256);
  assert.equal(next.grant.marketingAuthority!.sources.find(row=>row.digest===fp(actual))!.use,"analysis");
  const run={context:next.context,input:{...next.context,research:[],report:null,direction:null,blueprint:null,pages:[],corrections:[]},work:{operation:"report",attempt:"offline",inputDigest:"",until:0}} as WorkflowRun;
  assert.ok(marketingCitationIds(run,next.grant.marketingAuthority!).includes(source.id));
  run.work.operation="page";
  assert.ok(!marketingCitationIds(run,next.grant.marketingAuthority!).includes(source.id));
 }
 for(const key of ["ledger","expiresAt","startsAt","maxRetries","maxCommercialReplans","maxEditorialRevisions"] as const)
  assert.deepEqual(next.grant[key],f.grant[key]);
 assert.deepEqual(next.grant.marketingAuthority!.sourceSelections,f.grant.marketingAuthority!.sourceSelections);
 assert.deepEqual(next.grant.originalMaterials!.records,f.grant.originalMaterials!.records);
 assert.equal(next.context.intakeId,f.context.intakeId);assert.deepEqual(next.context.scope,f.context.scope);
});

test("changed bytes, foreign case, conflicts, missing materials, changed descriptors or attempted limit changes refuse before any dispatch",()=>{
 for(const edit of [
  (f:ReturnType<typeof fixture>,m:typeof material)=>{m[0].bytes=Buffer.from("A handoff is not the complete source");},
  (f:ReturnType<typeof fixture>)=>{f.context.scope.webPresenceId=randomUUID();},
  (f:ReturnType<typeof fixture>)=>{f.context.evidence.push({...f.context.evidence[0],id:material[0].source.id});},
  (f:ReturnType<typeof fixture>,m:typeof material)=>{m.pop();},
  (f:ReturnType<typeof fixture>,m:typeof material)=>{m[0].source.status="owner-confirmed";},
  (f:ReturnType<typeof fixture>)=>{f.grant.ledger.capMicros++;},
  (f:ReturnType<typeof fixture>)=>{f.grant.expiresAt++;},
 ]){
  const f=fixture(),m=material.map(row=>({source:structuredClone(row.source),bytes:Buffer.from(row.bytes)}));edit(f,m);
  assert.throws(()=>compileSourceEvidenceRepair(f.context,f.grant,f.plan,m,f.authorization));
 }
});

test("append-only same-case source recovery retains old history/counters, is idempotent and refuses unauthorized transitions",async()=>{
 const f=fixture(),next=compileSourceEvidenceRepair(f.context,f.grant,f.plan,material,f.authorization);
 const workflow=new PresenceWorkflow(null as unknown as Pool,{mode:"provider",marketingAuthority:next.grant.marketingAuthority,sourceRepair:next.grant.sourceRepair,
  maxEditorialRevisions:4,maxCommercialReplans:2,run:async()=>{throw Error("No dispatch")},recover:async()=>{throw Error("No dispatch")}}, {},Date.now,"disposable");
 const store=memoryStore(workflow,f.prior);
 await assert.rejects(workflow.reassessFromRepairedSources(next.context,70,{...actor,role:"customer"},f.authorization),{code:"unavailable"});
 await assert.rejects(workflow.reassessFromRepairedSources({...next.context,intakeId:randomUUID()},70,actor,f.authorization));
 const view=await workflow.reassessFromRepairedSources(next.context,70,actor,f.authorization);
 assert.equal(view!.next,"report");assert.equal(view!.version,71);
 assert.deepEqual(store.history[0],f.prior);
 assert.equal(store.current().sourceRecovery.priorRevisionOrdinal,4);
 assert.equal(store.current().replan.ordinal,2);
 assert.deepEqual(store.current().sourceSnapshot.evidence,next.context.evidence);
 assert.equal(store.current().confirmation,null);
 const repeated=await workflow.reassessFromRepairedSources(next.context,71,actor,f.authorization);
 assert.equal(repeated!.version,71);assert.equal(store.history.length,2);
 const guard=new PresenceWorkflow(null as unknown as Pool,{mode:"provider",marketingAuthority:next.grant.marketingAuthority,sourceRepair:next.grant.sourceRepair,run:async()=>null,recover:async()=>null},{},Date.now,"protected");
 memoryStore(guard,f.prior);await assert.rejects(guard.reassessFromRepairedSources(next.context,70,actor,f.authorization),{code:"unavailable"});
});

test("actual provider request -> retained response -> workflow settlement/reload carries all five sources through report, Direction and planning",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"miopages-real-sources-offline-"));
 try{
  const f=fixture();const rates:ResponsesRates={model:"offline-no-network-model",verifiedOn:"2026-11-19",inputPerMillion:2500000,cachedPerMillion:250000,outputPerMillion:15000000,cacheWritePerMillion:0,countMicros:0};
  await initializeResponsesUsageLedger(dir,rates);
  f.grant.ledger.startingLedger=sha(await readFile(join(dir,"onboarding-usage.json")));
  f.plan.previousGrantDigest=fp(f.grant);
  const next=compileSourceEvidenceRepair(f.context,f.grant,f.plan,material,f.authorization);
  const seen:string[]=[],requests:unknown[]=[];
  const provider=createResponsesPresenceWorkflow({grant:next.grant,readGrant:async()=>next.grant,readContext:async()=>next.context,ledgerDirectory:dir,rates,
   fetchPage:async()=>{throw Error("No network")},readOriginalMaterials:async()=>material,retainRequest:async()=>{},
   transport:{async send(path,body){
    const r=body as {input:{content:{type:string;text?:string}[]}[];text:{format:{name:string;schema:Record<string,unknown>}}};
    const operation=r.text.format.name.replace("presence_workflow_","");requests.push(body);
    const text=r.input[0].content.filter(c=>c.type==="input_text").map(c=>c.text!);
    for(const m of material)assert.ok(text.includes(m.bytes.toString("utf8")),"Complete original remains attached");
    const wire=JSON.stringify(r.text.format.schema);
    for(const m of material)assert.ok(wire.includes('"'+m.source.id+'"'),"Registered source is in the actual wire citation contract");
    if(path.endsWith("/input_tokens"))return{body:{input_tokens:8000}};
    seen.push(operation);
    const ids=material.map(m=>m.source.id);
    const output=operation==="report"?{title:"Offline transport fixture",summary:"Not AI reasoning",findings:ids.map((id,i)=>({id:"f"+i,heading:"Offline analysis "+i,body:"An offline proposed interpretation of an exact original.",status:"established",sourceIds:[id]}))}:
     operation==="direction"?{positioning:"Offline fixture only",approach:"Offline source propagation",visitorDecisions:["Offline decision"],sourceIds:ids}:
     {pages:[{path:"/",label:"Home",purpose:"Offline plan",sourceIds:ids},{path:"/service",label:"Service",purpose:"Offline plan",sourceIds:ids}],navigation:["/","/service"],articles:[]};
    const response={id:"resp_offline_binding_"+operation,model:rates.model,status:"completed",service_tier:"default",usage:{input_tokens:8000,output_tokens:120,total_tokens:8120,input_tokens_details:{cached_tokens:0},output_tokens_details:{reasoning_tokens:0}},
     output:[{type:"message",role:"assistant",content:[{type:"output_text",text:JSON.stringify(output)}]}]};
    return{body:response,rawBody:Buffer.from(JSON.stringify(response))};
   }}});
  const workflow=new PresenceWorkflow(null as unknown as Pool,provider,{},Date.now,"disposable"),store=memoryStore(workflow,f.prior);
  let view=(await workflow.reassessFromRepairedSources(next.context,70,actor,f.authorization))!;
  view=(await workflow.advance(next.context,view.version))!;
  assert.equal(view.next,"customer-review");assert.equal(view.report!.findings.length,5);
  assert.ok(view.report!.findings.every(f=>f.status==="proposed"),"Historical/intent sources are not independently confirmed facts");
  view=(await workflow.confirmReport(next.context,view.version,actor,true))!;
  view=(await workflow.advance(next.context,view.version))!;
  assert.deepEqual(view.direction!.sourceIds,material.map(m=>m.source.id));
  view=(await workflow.advance(next.context,view.version))!;
  assert.deepEqual(view.blueprint!.pages[0].sourceIds,material.map(m=>m.source.id));
  const reopened=(await workflow.review(next.context))!;
  assert.deepEqual(reopened.report,view.report);assert.deepEqual(reopened.direction,view.direction);assert.deepEqual(reopened.blueprint,view.blueprint);
  assert.deepEqual(seen,["report","direction","blueprint"]);assert.equal(requests.length,6);assert.equal(store.outputs.size,3);
  assert.deepEqual(store.history[0],f.prior);
  const forbidden={path:"/",heading:"Offline",searchTitle:"Offline",searchDescription:"Offline",sections:[{heading:"Offline",body:"Do not promote historical copy",sourceIds:[material[0].source.id],visual:{purpose:"None",brief:"None",altIntent:"None",status:"text-only"}}],actions:[],internalLinks:[]};
  const pageRun={context:next.context,input:{...next.context,...store.current()},work:{operation:"page",path:"/",attempt:"offline",inputDigest:"",until:0}} as WorkflowRun;
  assert.throws(()=>readPage(forbidden,"/",["/","/service"],marketingCitationIds(pageRun,next.grant.marketingAuthority!),{}));
 }finally{await rm(dir,{recursive:true,force:true})}
});

test("full source contexts use the existing authorized envelope without relaxing ownership, mode or symlink checks",{skip:process.platform!=="linux"},async()=>{
 const {privateWorkflowBytes}=await import("../lib/platform/intake/protected-presence-workflow");
 const {chmod,symlink,writeFile}=await import("node:fs/promises");
 const dir=await mkdtemp(join(tmpdir(),"miopages-context-envelope-"));
 try{
  await chmod(dir,0o700);const file=join(dir,"context.json"),bytes=Buffer.from("x".repeat(300000));
  await writeFile(file,bytes,{mode:0o600});
  await assert.rejects(privateWorkflowBytes(file,dir));
  assert.deepEqual(await privateWorkflowBytes(file,dir,1_000_000),bytes);
  await assert.rejects(privateWorkflowBytes(file,dir,Number.MAX_SAFE_INTEGER));
  await symlink(file,join(dir,"linked.json"));
  await assert.rejects(privateWorkflowBytes(join(dir,"linked.json"),dir,1_000_000));
  await chmod(file,0o644);await assert.rejects(privateWorkflowBytes(file,dir,1_000_000));
 }finally{await rm(dir,{recursive:true,force:true})}
});

test("the fixed preparation launcher refuses unexpected arguments without echoing them or reading credentials",async()=>{
 const {spawnSync}=await import("node:child_process");
 const marker="PRIVATE_ARGUMENT_MUST_NOT_BE_ECHOED",compiled=process.env.MIOPAGES_TEST_COMPILED_SOURCE_INSTALLER;
 const result=spawnSync(process.execPath,compiled?[compiled,marker]:["--import","tsx","scripts/intake/source-repair-install.ts",marker],
  {encoding:"utf8",env:{...process.env,HOME:"unavailable-for-offline-test"}});
 assert.equal(result.status,1);
 assert.ok(!result.stdout.includes(marker)&&!result.stderr.includes(marker));
 const output=JSON.parse(result.stdout.trim());
 assert.equal(output.status,"BLOCKED");assert.equal(output.operation,"unrecognized");
});
