import {readFile,writeFile,realpath} from "node:fs/promises";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {Pool} from "pg";
import {fingerprint} from "../../lib/platform/canonical/model";
import {originalMaterialInput,resolveSourceReferences,type OriginalMaterial} from "../../lib/platform/intake/presence-source-material";
import type {WorkflowContext,WorkflowRun} from "../../lib/platform/intake/presence-workflow";
async function main(){
 const parent=join(await realpath(process.env.HOME??""),"miopages-private-acceptance"),root=join(parent,"presence-evaluation/4d437190-9ce3-460b-81af-edd92279271a");
 const context=JSON.parse(await readFile(join(root,"context.json"),"utf8")).context as WorkflowContext,grant=JSON.parse(await readFile(join(root,"grant.json"),"utf8"));
 const url=new URL("postgresql://postgres@127.0.0.1:36339/migration_rehearsal_4d4371909ce3460b81afedd92279271a");url.password=(await readFile(join(parent,"p0-22-c0-runtime/db/password"),"utf8")).trim();
 const db=new Pool({connectionString:url.href});
 try{
 const state=(await db.query("SELECT payload FROM public.presence_workflow_events ORDER BY version DESC LIMIT 1")).rows[0].payload;
 if(state.version!==56||state.work?.operation!=="editorial"||state.failure!=="outcome-unknown")throw Error("Expected retained pre-dispatch state");
 const oldBytes=await readFile(join(root,"originals",state.work.attempt+".request.json")),old=JSON.parse(oldBytes.toString());
 const packed=JSON.parse(old.input[0].content[0].text).task;
 const texts=new Map<string,string>();for(const source of context.evidence)texts.set(source.id,source.content);for(const source of state.research)texts.set(source.id,source.content);
 const projected=(packed.completeInputValues?resolveSourceReferences(packed,texts):packed) as {revisions?:{priorPages?:{path:string}[];[key:string]:unknown}};
 if(projected.revisions?.priorPages){const {priorPages,...audit}=projected.revisions;projected.revisions={...audit,priorDraftReferences:priorPages.map(page=>({path:page.path,digest:fingerprint(page),retainedInWorkflowHistory:true}))}}
 const input={...state.sourceSnapshot,report:state.report,research:state.research,direction:state.direction,blueprint:state.blueprint,pages:state.pages,corrections:state.corrections};
 const records=JSON.parse(await readFile(join(root,"originals/index.json"),"utf8")) as OriginalMaterial[];
 const next={...old,input:await originalMaterialInput({context,input,work:state.work} as WorkflowRun,grant.originalMaterials,projected,async()=>Promise.all(records.map(async source=>({source,bytes:await readFile(join(root,"originals",source.sha256+".source"))}))))};
 const bytes=Buffer.from(JSON.stringify(next));
 await writeFile(join(root,"input-preflight-editorial-current-site.request.json"),bytes,{mode:0o600,flag:"wx"});
 console.log(JSON.stringify({status:"PASS",providerCalls:0,previousBytes:oldBytes.length,requestBytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex"),imageInputs:next.input[0].content.filter((x:{type:string})=>x.type==="input_image").length,fullOriginals:records.length,rawSourcesRetained:true}));
 }finally{await db.end()}
}
main().catch(error=>{console.error(JSON.stringify({status:"BLOCKED",code:error.code??error.name,detail:error.message}));process.exitCode=1});
