import {readFile,realpath} from "node:fs/promises";
import {join} from "node:path";
import {Pool} from "pg";
import {responseProposal} from "../../lib/platform/intake/intelligent-responses";
import {readPage} from "../../lib/platform/intake/presence-workflow-artifacts";
import {readSemanticBlock} from "../../lib/platform/intake/presence-semantic-block";
import {validateStrategyBlueprint} from "../../lib/platform/intake/presence-marketing-authority";
import type {WorkflowRun} from "../../lib/platform/intake/presence-workflow";
async function main(){
 const parent=join(await realpath(process.env.HOME??""),"miopages-private-acceptance"),root=join(parent,"presence-evaluation/4d437190-9ce3-460b-81af-edd92279271a");
 const context=JSON.parse(await readFile(join(root,"context.json"),"utf8")).context,grant=JSON.parse(await readFile(join(root,"grant.json"),"utf8"));
 const url=new URL("postgresql://postgres@127.0.0.1:36339/migration_rehearsal_4d4371909ce3460b81afedd92279271a");
 url.password=(await readFile(join(parent,"p0-22-c0-runtime/db/password"),"utf8")).trim();
 const db=new Pool({connectionString:url.href});
 try{
  const state=(await db.query("SELECT payload FROM public.presence_workflow_events ORDER BY version DESC LIMIT 1")).rows[0].payload;
  const work=state.work;if(!work||!["blueprint","page"].includes(work.operation))throw Error("Not a retained planning failure");
  const raw=(await db.query("SELECT bytes FROM public.presence_workflow_outputs WHERE attempt_id=$1",[work.attempt])).rows[0].bytes;
  const proposal=responseProposal(JSON.parse(Buffer.from(raw).toString()));
  const input={entry:context.entry,evidence:context.evidence,limitations:context.limitations,conflicts:context.conflicts,
    report:state.report,research:state.research,corrections:state.corrections,direction:state.direction,blueprint:state.blueprint,pages:state.pages};
  let failure:string|null=null;
  try{if(work.operation==="blueprint")validateStrategyBlueprint(proposal,{context,input,work} as WorkflowRun,grant.marketingAuthority,grant.previewActionDestinations);else readPage(proposal,work.path,state.blueprint.pages.map((p:{path:string})=>p.path),[...context.evidence,...state.research].map((s:{id:string})=>s.id),Object.fromEntries(Object.entries(grant.previewActionDestinations).filter(([,v])=>v!==work.path)),true,true,true)}
  catch(error){failure=(error as Error).message}
  console.log(JSON.stringify({version:state.version,failure,research:state.research.map((r:{id:string;captureStatus?:string})=>({id:r.id,captureStatus:r.captureStatus??"complete"})),
    operation:work.operation,proposal,sectionDiagnostics:work.operation==="page"?(proposal as {sections:{block?:unknown}[]}).sections.map((s,index:number)=>{try{if(s.block)readSemanticBlock(s.block,true);return {index,valid:true}}catch(error){return {index,failure:(error as Error).message}}}):[],direction:state.direction}));
 }finally{await db.end()}
}
main().catch(error=>{console.error(JSON.stringify({status:"BLOCKED",code:error.code??error.name}));process.exitCode=1});
