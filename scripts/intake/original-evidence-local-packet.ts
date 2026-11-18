import {readFile,writeFile,realpath} from "node:fs/promises";
import {join} from "node:path";
import {Pool} from "pg";
import {fingerprint} from "../../lib/platform/canonical/model";
import {workflowLocalDraftInput} from "../../lib/platform/intake/presence-workflow-delivery";
import {validatePages} from "../../lib/platform/wordpress-delivery/authority";
import type {PresenceWorkflowView} from "../../lib/platform/intake/presence-workflow";
async function main(){
 const version=Number(process.argv[2]);if(!Number.isSafeInteger(version)||version<1)throw Error("Exact historical version required");
 const parent=join(await realpath(process.env.HOME??""),"miopages-private-acceptance"),root=join(parent,"presence-evaluation/4d437190-9ce3-460b-81af-edd92279271a");
 const {context}=JSON.parse(await readFile(join(root,"context.json"),"utf8"));
 const url=new URL("postgresql://postgres@127.0.0.1:36339/migration_rehearsal_4d4371909ce3460b81afedd92279271a");url.password=(await readFile(join(parent,"p0-22-c0-runtime/db/password"),"utf8")).trim();
 const db=new Pool({connectionString:url.href});
 try{
 const event=(await db.query("SELECT payload,digest FROM public.presence_workflow_events WHERE version=$1",[version])).rows[0];
 if(!event||event.payload.contextDigest!==fingerprint(context)||event.payload.work||event.payload.failure)throw Error("Exact settled version required");
 const state=event.payload;
 const view={...state,next:state.editorial?.concerns.length?"editorial-review":"operator-review",pendingOperation:null} as PresenceWorkflowView;
 const input=workflowLocalDraftInput(context,view);
 const pages=input.pages.map(p=>({id:p.pageId,path:p.slug,title:p.title.kind==="editorial"?p.title.text:"",composition:p.composition,navigationLabel:p.navigationLabel,
 sections:p.sections.map((s,i)=>({id:s.id,type:s.type,content:{heading:s.heading?.kind==="editorial"?s.heading.text:"",text:s.text?.kind==="editorial"?s.text.text:""},
 ...(state.pages.find((row:{path:string})=>row.path===p.slug).sections[i].block&&{block:state.pages.find((row:{path:string})=>row.path===p.slug).sections[i].block})}))}));
 validatePages(pages,true,true);
 const candidate={pages,navigation:input.navigation,actions:input.actions};
 const packet={candidate,images:[],unresolvedActions:input.unresolvedActions,localDraftOnly:true,contextDigest:state.contextDigest,sourceVersion:version,sourceEvent:event.digest,
 digest:fingerprint({candidate,sourceEvent:event.digest,projection:"authored-action-order/2"})};
 const file=join(root,"site-"+version+"-projection-v2.json");
 await writeFile(file,JSON.stringify(packet,null,2),{mode:0o600,flag:"wx"});
 console.log(JSON.stringify({status:"PASS",operation:"exact-historical-local-projection",version,pages:pages.length,file,digest:packet.digest,protectedInputIncluded:false}));
 }finally{await db.end()}
}
main().catch(e=>{console.error(JSON.stringify({status:"BLOCKED",detail:e.message}));process.exitCode=1});
