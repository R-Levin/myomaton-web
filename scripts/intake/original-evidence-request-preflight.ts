import {readFile,writeFile,realpath} from "node:fs/promises";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {fingerprint} from "../../lib/platform/canonical/model";
import {createResponsesPresenceWorkflow,type PresenceWorkflowGrant} from "../../lib/platform/intake/presence-workflow-provider";
import type {WorkflowContext,WorkflowRun} from "../../lib/platform/intake/presence-workflow";
async function main(){
 const parent=join(await realpath(process.env.HOME??""),"miopages-private-acceptance");
 const root=join(parent,"presence-evaluation/4d437190-9ce3-460b-81af-edd92279271a");
 const {context}=JSON.parse(await readFile(join(root,"context.json"),"utf8")) as {context:WorkflowContext};
 const grant=JSON.parse(await readFile(join(root,"grant.json"),"utf8")) as PresenceWorkflowGrant;
 const rates=JSON.parse(await readFile(join(root,"usage/onboarding-usage.json"),"utf8")).rateCard;
 const input={entry:context.entry,evidence:context.evidence,limitations:context.limitations,conflicts:context.conflicts,
  research:null,report:null,direction:null,blueprint:null,pages:[],corrections:[]};
 const run:WorkflowRun={context,input,work:{attempt:"00000000-0000-4000-8000-000000000001",operation:"research",inputDigest:fingerprint(input),until:0}};
 let requests=0,captured:Buffer|undefined;
 const unreachable=async()=>{throw Error("Preflight forbids network or source operations")};
 const provider=createResponsesPresenceWorkflow({grant,readGrant:async()=>grant,readContext:async()=>context,rates,ledgerDirectory:join(root,"usage"),
  transport:{send:async()=>{requests++;throw Error("Network prohibited")}},fetchPage:unreachable,fetchMarketPages:()=>unreachable,
  researchOriginals:{retain:unreachable,render:unreachable},verifyResearchAccess:unreachable,
  readOriginalMaterials:async()=>Promise.all(grant.originalMaterials!.records.map(async source=>({source,bytes:await readFile(join(root,"originals",source.sha256+".source"))}))),
  retainRequest:async(_run,bytes)=>{captured=bytes;throw Error("INSPECTION_COMPLETE")}
 });
 try{await provider.run(run,async()=>{throw Error("No response permitted")})}catch(error){if(!(error instanceof Error)||error.message!=="INSPECTION_COMPLETE")throw error}
 if(!captured||requests)throw Error("Preflight did not inspect exact request");
 await writeFile(join(root,"input-preflight.request.json"),captured,{flag:"wx",mode:0o600});
 const packet=JSON.parse(captured.toString()),content=packet.input[0].content;
 const summary={status:"PASS",operation:"exact-core-request-inspection",requestSha256:createHash("sha256").update(captured).digest("hex"),
  requestBytes:captured.length,model:packet.model,sourceRecords:grant.originalMaterials!.records.length,
  actualImageInputs:content.filter((c:{type:string})=>c.type==="input_image").length,providerRequests:requests,unconfirmedStatusPreserved:content.filter((c:{type:string})=>c.type==="input_text").some((c:{text:string})=>{try{return JSON.parse(c.text).originalSource?.status==="unconfirmed"}catch{return false}})};
 await writeFile(join(root,"input-preflight.json"),JSON.stringify(summary)+"\n",{flag:"wx",mode:0o600});
 console.log(JSON.stringify(summary));
}
main().catch((error:Error)=>{console.error(JSON.stringify({status:"BLOCKED",operation:"exact-core-request-inspection",category:error.name,detail:error.message}));process.exitCode=1});
