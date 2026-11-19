import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {fingerprint} from "../lib/platform/canonical/model";
import {exposesInternalCopy,bindCompleteAuthoringKnowledge,marketingCitationIds,marketingProjection,validateMarketingAuthority,type MarketingAuthority} from "../lib/platform/intake/presence-marketing-authority";
import {readPage} from "../lib/platform/intake/presence-workflow-artifacts";
import {resolveSourceReferences,type OriginalMaterial} from "../lib/platform/intake/presence-source-material";
import {strategyBasis} from "../lib/platform/intake/presence-decision-brief";
import {createResponsesPresenceWorkflow,type PresenceWorkflowGrant} from "../lib/platform/intake/presence-workflow-provider";
import {initializeResponsesUsageLedger,type ResponsesRates} from "../lib/platform/intake/intelligent-responses";
import type {WorkflowContext,WorkflowRun} from "../lib/platform/intake/presence-workflow";

const brief=readFileSync("docs/miopages-c0-business-brief.md","utf8").replaceAll("\r\n","\n");
const launch=brief.match(/^\| Standard Launch \| (.+) \|$/m)![1];
const ongoing=brief.match(/^\| Ongoing \| (.+) \|$/m)![1];
const internal="This isolated development server has a disabled submission endpoint.";
const processing="Keep the test submission controls disabled; this does not redefine the staffed business offer.";
const service="MioPages provides one managed Web Presence service.";
const reference={label:"Offline contract fixture",reference:"fixture source record",date:"2026-11-19"};
const context:WorkflowContext={scope:{webPresenceId:"offline-presence",managedSiteId:"offline-site"},intakeId:"offline-intake",entry:"DIRECT_START",limitations:[internal],conflicts:[],evidence:[
 {...reference,id:"service",kind:"owner-confirmed",content:service},
 {...reference,id:"complete-approved-brief",kind:"service-direction",content:brief},
 {...reference,id:"unconfirmed",kind:"customer-unconfirmed",content:"We doubled every customer's sales."},
 {...reference,id:"peer",kind:"public-research",rawDigest:fingerprint("peer fixture"),content:"An observed sequence can clarify a visitor journey."},
 {...reference,id:"development",kind:"service-direction",content:internal},
]};
const sources=context.evidence.map(fingerprint);
const authority:MarketingAuthority={projectionVersion:2,contextDigest:fingerprint(context),
 sources:sources.map((digest,index)=>({digest,use:(["business-fact","staffed-offer","analysis","analysis","excluded"] as const)[index]})),
 sourceSelections:[{digest:sources[0],passages:[service]},{digest:sources[1],passages:[launch,ongoing]}],
 processingInstructions:[{text:processing,basis:"implementation-choice",reference:"offline development controls"}],
 brandDigest:fingerprint("brand"),brandBrief:"Retain the approved identity.",qualityReviewerId:"reviewer",
 strategy:{version:1,peerIds:[],discoveredPeers:true}};
function makeRun():WorkflowRun{
 const input:WorkflowRun["input"]={...context,research:[],corrections:[],pages:[],
 report:{title:"Business understanding",summary:"Grounded proposal",findings:[{id:"service-finding",heading:"Managed service",body:service,status:"established",sourceIds:["service"]}]},
 direction:{positioning:"Help suitable prospects find and contact the business and improve the presence from evidence.",approach:"Explain the connected service.",visitorDecisions:["Understand the service"],sourceIds:["service","complete-approved-brief"]},
 blueprint:null};
 input.blueprint={pages:[{path:"/service",label:"Service",purpose:"Explain the connected service",sourceIds:["service"],decisionBrief:{
 decision:"Explain the service and its growth loop.",findingIds:["service-finding"],directionSteps:[0],claimIds:["service"],
 influences:[{sourceIds:["peer"],use:"composition",implication:"Use a distinct sequence for the visitor decision."}],avoid:["Invented proof"]}}],
 navigation:["/service"],articles:[],strategyBasis:strategyBasis(context,input)};
 return {context,input,work:{operation:"page",path:"/service",attempt:"offline-source-aware",until:0,inputDigest:fingerprint(input)}};
}

test("a Page plan does not hide other approved same-customer knowledge or the original growth-service meaning",()=>{
 const run=makeRun();validateMarketingAuthority(authority,fingerprint(context),sources);
 const result=marketingProjection(run,authority) as {businessKnowledge:{id:string;content:string}[];customerAssertions:unknown[];direction:unknown;report:unknown;decisionBrief:{claimIds:string[]}};
 assert.deepEqual(result.decisionBrief.claimIds,["service"]);
 assert.deepEqual(marketingCitationIds(run,authority),["service","complete-approved-brief"]);
 assert.equal(result.businessKnowledge.find(row=>row.id==="complete-approved-brief")!.content,launch+"\n\n"+ongoing);
 assert.match(ongoing,/content\/optimization work, conversion refinement/);
 assert.ok(result.direction&&result.report);
 assert.equal(result.customerAssertions.length,1);
 assert.doesNotMatch(JSON.stringify(result.businessKnowledge),/doubled every|disabled submission|Keep the test/);
 assert.ok(!JSON.stringify(result).includes(internal)&&!JSON.stringify(result).includes(processing));
 assert.equal(exposesInternalCopy({body:processing},context.evidence,authority),true);
 assert.equal(exposesInternalCopy({body:ongoing},context.evidence,authority),false);
 assert.equal(run.context.evidence[1].content,brief,"The original source is unchanged");
});

test("source selections preserve exact passages, factual status, tenant binding and historical contracts",()=>{
 const run=makeRun();
 for(const change of [
  {...authority,sourceSelections:[...authority.sourceSelections!,{digest:sources[1],passages:[ongoing]}]},
  {...authority,sourceSelections:authority.sourceSelections!.slice(0,1)},
  {...authority,projectionVersion:undefined},
 ])assert.throws(()=>validateMarketingAuthority(change,fingerprint(context),sources));
 assert.throws(()=>marketingProjection(run,{...authority,sourceSelections:[authority.sourceSelections![0],{digest:sources[1],passages:["Invented promise"]}]}),/exact recorded source passages/);
 const promoted={...authority,sources:authority.sources.map((source,index)=>index===2?{...source,use:"staffed-offer" as const}:source)};
 promoted.sourceSelections=[...promoted.sourceSelections!,{digest:sources[2],passages:[context.evidence[2].content]}];
 assert.throws(()=>marketingProjection(run,promoted),/cannot authorize visitor claims/);
 const foreign=structuredClone(run);foreign.context.scope.webPresenceId="another-customer";
 assert.throws(()=>marketingProjection(foreign,authority),/does not match/);
 const stale=structuredClone(run);stale.input.direction!.positioning="Changed after planning";
 assert.throws(()=>marketingProjection(stale,authority),/brief is stale/);
 const legacy={...authority,projectionVersion:undefined,sourceSelections:undefined,processingInstructions:undefined};
 assert.deepEqual(marketingCitationIds(run,legacy),["service"],"An old grant retains its exact historical Page claim scope");
});

for (const includeOriginals of [false,true]) test("actual metered request carries growth knowledge and separate policy "+(includeOriginals?"with original attachments":"without original attachments"),async()=>{
 const root=await mkdtemp(join(tmpdir(),"miopages-source-aware-"));
 try{
 const rates:ResponsesRates={model:"offline-model",verifiedOn:"2026-11-19",inputPerMillion:750000,cachedPerMillion:75000,outputPerMillion:4500000,cacheWritePerMillion:0,countMicros:0};
 await initializeResponsesUsageLedger(root,rates);
 const grant:PresenceWorkflowGrant={contextDigest:fingerprint(context),approvedSources:sources,approvedCorrections:[],marketingAuthority:authority,
  researchSources:[{id:"research:offline",url:"https://example.org/",label:"Never fetched"}],researchResponseBytes:10000,expiresAt:Date.now()+60000,maxOutputTokens:1000,
  ledger:{id:fingerprint("source-aware-fixture"),startingLedger:createHash("sha256").update(await readFile(join(root,"onboarding-usage.json"))).digest("hex"),
   baselineAttempts:0,requests:2,generations:1,inputTokens:2000,inputBytes:100000,capMicros:20000}};
 const originalBytes=Buffer.from(launch+"\n\n"+ongoing);
 const original:OriginalMaterial={id:"complete-approved-brief",sha256:createHash("sha256").update(originalBytes).digest("hex"),bytes:originalBytes.length,mime:"text/plain",
  reference:"Canonical approved fixture projection",author:"Recorded C0 direction",date:"2026-11-19",status:"approved-direction",purpose:"business-context",operations:["page"]};
 if(includeOriginals)grant.originalMaterials={version:1,contextDigest:fingerprint(context),records:[original],requestBytes:100000};
 let calls=0;const page={path:"/service",heading:"Managed service",searchTitle:"Managed service",searchDescription:"A connected service.",composition:"managed-v1",
  sections:[{heading:"Managed service",body:ongoing,sourceIds:["complete-approved-brief"],role:"hero",block:null,visual:{purpose:"Text only",brief:"No image",altIntent:"No image",status:"text-only"}}],actions:[{label:"Discuss your presence",kind:"request-contact",destination:null,sectionIndex:0}],internalLinks:[]};
 const provider=createResponsesPresenceWorkflow({grant,readGrant:async()=>grant,readContext:async()=>context,ledgerDirectory:root,rates,fetchPage:async()=>{throw Error("No external requests")},
  ...(includeOriginals&&{readOriginalMaterials:async()=>[{source:original,bytes:originalBytes}],retainRequest:async()=>{}}),
  transport:{async send(path,body){
   calls++;const request=body as {input:string|{content:{type:string;text?:string}[]}[];instructions:string;text:{format:{schema:unknown}}};
   const projected=typeof request.input==="string"?JSON.parse(request.input):resolveSourceReferences(JSON.parse(request.input[0].content[0].text!).task,new Map([[original.id,originalBytes.toString()]]));
   const knowledge=JSON.stringify(projected);
   assert.ok(knowledge.includes(ongoing)&&knowledge.includes(launch));
   assert.ok(!knowledge.includes(internal)&&!knowledge.includes(processing));
   assert.ok(request.instructions.includes(processing));
   assert.match(request.instructions,/permitted customer-owned brand assets/);
   assert.match(request.instructions,/third-party expression/);
   if(Array.isArray(request.input))assert.match(JSON.parse(request.input[0].content[0].text!).interpretation,/permitted customer-owned brand assets/);
   const encoded=JSON.stringify(request.text.format.schema);
   assert.ok(encoded.includes("complete-approved-brief"));
   assert.ok(!encoded.includes('"unconfirmed"'));
   if(path.endsWith("/input_tokens"))return {body:{input_tokens:1000}};
   const response={id:"resp_offline_source_aware",model:rates.model,status:"completed",service_tier:"default",
    usage:{input_tokens:1000,output_tokens:30,total_tokens:1030,input_tokens_details:{cached_tokens:0},output_tokens_details:{reasoning_tokens:0}},
    output:[{type:"message",role:"assistant",content:[{type:"output_text",text:JSON.stringify(page)}]}]};
   return {body:response,rawBody:Buffer.from(JSON.stringify(response))};
  }}});
 let retained:Buffer|undefined;
 const output=await provider.run(makeRun(),async bytes=>{retained=bytes});
 assert.ok(retained);assert.equal(JSON.parse(retained.toString()).id,"resp_offline_source_aware");
 assert.deepEqual(output,page);
 const parsed=readPage(output,"/service",["/service"],marketingCitationIds(makeRun(),authority),{},false,false,true);
 assert.equal(parsed.sections[0].body,ongoing);assert.equal(calls,2);
 }finally{await rm(root,{recursive:true,force:true})}
});

test("whole canonical records retain exact provenance without a new manual passage-curation workflow",()=>{
 const {projectionVersion,sourceSelections,...existing}=authority;void projectionVersion;void sourceSelections;
 const cleanEvidence=context.evidence.map(source=>source.id==="complete-approved-brief"?{...source,content:launch+"\n\n"+ongoing}:source);
 const canonicalAuthority={...existing,contextDigest:fingerprint({...context,evidence:cleanEvidence}),
  sources:existing.sources.map((row,index)=>({...row,digest:fingerprint(cleanEvidence[index])}))};
 const complete=bindCompleteAuthoringKnowledge(canonicalAuthority,cleanEvidence);
 assert.equal(complete.projectionVersion,2);
 assert.deepEqual(complete.sourceSelections!.map(row=>row.passages),[[service],[launch+"\n\n"+ongoing]]);
 assert.equal(complete.sources[2].use,"analysis");
 const changed=structuredClone(cleanEvidence);changed[1].content="Changed after binding";
 assert.throws(()=>marketingProjection({...makeRun(),context:{...context,evidence:cleanEvidence},input:{...makeRun().input,evidence:changed}},complete),/source changed/);
});

test("strategic replanning retains the specific Core-generated concept critique as fallible advice, not new business facts", () => {
 const run=makeRun();
 run.work.operation="direction";
 const critique={target:fingerprint("exact reviewed concept"),inputDigest:fingerprint("exact reviewed input"),
  editorial:{summary:"The concept reduces a continuing growth service to maintenance.",concerns:[{path:"/",concern:"Explain supported content work and useful conversion as continuing value."}]}};
 run.input.replan={ordinal:1,concerns:["offer-and-value"],conceptCritique:critique};
 run.work.inputDigest=fingerprint(run.input);
 const projected=marketingProjection(run,authority) as {priorCoreConceptCritique:unknown;businessKnowledge:unknown};
 assert.deepEqual(projected.priorCoreConceptCritique,critique);
 assert.ok(!JSON.stringify(projected.businessKnowledge).includes(critique.editorial.summary));
 assert.deepEqual((run.input.replan as {conceptCritique:unknown}).conceptCritique,critique);
});

test("source-aware Page decisions can compose from authorized customer knowledge while retaining a real market influence",async()=>{
 const {compilePageDecision}=await import("../lib/platform/intake/presence-decision-brief");
 const run=makeRun(),page=run.input.blueprint!.pages[0],base=page.decisionBrief!;
 base.influences=[
  {sourceIds:["peer"],use:"terminology",implication:"Clarify the market distinction without copying."},
  {sourceIds:["complete-approved-brief"],use:"composition",implication:"Organize this customer's own service relationship."},
 ];
 const projection=marketingProjection(run,authority) as {decisionBrief:{sourceTrace:{id:string;use:string;sourceKind?:string}[]}};
 assert.equal(projection.decisionBrief.sourceTrace.find(x=>x.id==="complete-approved-brief")!.use,"authorized-customer-source-influence");
 assert.equal(projection.decisionBrief.sourceTrace.find(x=>x.id==="complete-approved-brief")!.sourceKind,"service-direction");
 assert.equal(projection.decisionBrief.sourceTrace.find(x=>x.id==="peer")!.use,"market-influence");
 assert.throws(()=>compilePageDecision(run,base,page.path,authority.strategy!,context.evidence.slice(0,2),[context.evidence[3]],authority.contextDigest),/Page needs source-backed/,"Historical grants keep their exact peer-composition contract");
 for(const change of [
  ()=>{base.influences=base.influences.filter(x=>!x.sourceIds.includes("peer"));},
  ()=>{base.influences.push({sourceIds:["foreign-source"],use:"journey",implication:"Refused foreign influence"});},
  ()=>{base.influences.push({sourceIds:["development"],use:"journey",implication:"Refused excluded processing source"});},
  ()=>{base.claimIds.push("unconfirmed");},
 ]){
  const original=structuredClone(base);change();
  assert.throws(()=>marketingProjection(run,authority));
  Object.assign(base,original);
 }
});

test("source-aware media expiry and invalid context refuse before any count with safe actionable diagnostics",async()=>{
 const {WorkflowMediaUnavailable}=await import("../lib/platform/intake/presence-workflow-provider");
 const root=await mkdtemp(join(tmpdir(),"miopages-media-preflight-"));
 try{
  const run=makeRun(),rates:ResponsesRates={model:"offline-media-model",verifiedOn:"2026-11-19",inputPerMillion:750000,cachedPerMillion:75000,outputPerMillion:4500000,cacheWritePerMillion:0,countMicros:0};
  await initializeResponsesUsageLedger(root,rates);const file=join(root,"onboarding-usage.json"),before=await readFile(file);
  const grant:PresenceWorkflowGrant={contextDigest:fingerprint(context),approvedSources:sources,approvedCorrections:[],marketingAuthority:authority,
   researchSources:[{id:"research:fixture",url:"https://example.org/",label:"Offline"}],researchResponseBytes:10000,expiresAt:Date.now()+60000,maxOutputTokens:1000,
   ledger:{id:fingerprint("offline media grant"),startingLedger:createHash("sha256").update(before).digest("hex"),baselineAttempts:0,requests:2,generations:1,inputTokens:2000,inputBytes:100000,capMicros:20000}};
  let calls=0,expired=true;
  const provider=createResponsesPresenceWorkflow({grant,readGrant:async()=>grant,readContext:async()=>context,rates,ledgerDirectory:root,
   transport:{async send(){calls++;throw Error("No network permitted")}},fetchPage:async()=>{throw Error("No network")},
   readAvailableMedia:async()=>{throw Error(expired?"Current stock permission required":"PRIVATE_DETAIL_MUST_NOT_ESCAPE")}});
  await assert.rejects(provider.preflight!(run),(e:unknown)=>e instanceof WorkflowMediaUnavailable&&e.code==="MEDIA_PERMISSION_EXPIRED");
  await assert.rejects(provider.run(run,async()=>{}),(e:unknown)=>e instanceof WorkflowMediaUnavailable&&e.code==="MEDIA_PERMISSION_EXPIRED");
  expired=false;
  await assert.rejects(provider.preflight!(run),(e:unknown)=>e instanceof WorkflowMediaUnavailable&&e.code==="MEDIA_CONTEXT_UNAVAILABLE"&&!e.message.includes("PRIVATE_DETAIL"));
  assert.equal(calls,0);assert.deepEqual(await readFile(file),before);
 }finally{await rm(root,{recursive:true,force:true})}
});
