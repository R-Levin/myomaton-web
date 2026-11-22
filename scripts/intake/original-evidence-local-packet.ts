import {readFile,writeFile,realpath} from "node:fs/promises";
import {join} from "node:path";
import {Pool} from "pg";
import {createHash} from "node:crypto";
import {intakeDatabaseUrl,intakeSchema} from "./disposable";
import {approvedSuppliedEvidence} from "../../lib/platform/acquisition/supplied-evidence";
import {readManagedObject} from "../../lib/platform/assets/local-storage";
import {fingerprint} from "../../lib/platform/canonical/model";
import {sectionVisual,workflowLocalDraftInput} from "../../lib/platform/intake/presence-workflow-delivery";
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
 ...(state.pages.find((row:{path:string})=>row.path===p.slug).sections[i].block&&{block:state.pages.find((row:{path:string})=>row.path===p.slug).sections[i].block}),
 ...(p.composition&&sectionVisual(state,p.slug,i))}))}));
 validatePages(pages,true,true);
 const candidate={pages,navigation:input.navigation,actions:input.actions};
 const images:{sectionId:string;width:number;height:number;digest:string;alt:string;file:string;assetId:string;usageId:string}[]=[];
 let retainedStock:{sourcePacket:string;sourceVersion:number;placementSectionsUnchanged:boolean;rightsAndUsageReverified:boolean;publicUseApproved:boolean}|undefined;
 if(process.argv[3]!==undefined){
  if(process.argv[3]!=="reuse-reviewed-home-stock")throw Error("Media continuation refused");
  const prior=(await db.query("SELECT payload FROM public.presence_workflow_events WHERE version=64")).rows[0]?.payload;
  // The rights/context review covers the exact section an image sits in. Changes
  // elsewhere on Home do not alter that context; a changed placement section does.
  if(!prior||prior.contextDigest!==state.contextDigest)throw Error("Reviewed media context changed; new media review required");
  const media=JSON.parse(await readFile(join(root,"site-64-media.json"),"utf8"));
  if(media.digest!=="8082c6949f5d026383e4fd3b67ea1bd23f66cd710e10ae22942d8a02cedb8bce"||media.images.length!==2)throw Error("Exact reviewed stock packet required");
  const checkpoint=JSON.parse(await readFile(join(root,"media/stock-intake-checkpoint.json"),"utf8"));
  const pool=new Pool({connectionString:intakeDatabaseUrl(url.href,intakeSchema(checkpoint.schema))});
  try{const c=await pool.connect();try{await c.query("BEGIN");
   for(const image of media.images){
    const record=media.localStockEvidence.records.find((row:{assetId:string})=>row.assetId===image.assetId);
    const home=pages.find(page=>page.path==="/");
    if(!record||!home||record.target.pageId!==home.id||!home.sections.some(section=>section.id===image.sectionId&&section.type==="intro"))throw Error("Exact media placement differs");
    const placed=home.sections.findIndex(section=>section.id===image.sectionId);
    const homeOf=(payload:{pages:{path:string;sections:unknown[]}[]})=>payload.pages.find(page=>page.path==="/")!.sections[placed];
    if(fingerprint(homeOf(prior))!==fingerprint(homeOf(state)))throw Error("Reviewed image section changed; new media review required");
    const asset=(await c.query("SELECT * FROM assets WHERE id=$1 AND web_presence_id=$2 AND status='active'",[image.assetId,context.scope.webPresenceId])).rows[0];
    const usage=(await c.query("SELECT * FROM asset_usages WHERE id=$1",[image.usageId])).rows[0];
    if(!asset||usage?.asset_id!==asset.id||usage.entity_type!=="section"||usage.entity_id!==image.sectionId||usage.web_presence_id!==context.scope.webPresenceId||usage.role!=="image")throw Error("Owned stock AssetUsage differs");
    await approvedSuppliedEvidence(c,record.target,asset.id,asset.metadata.acquisition,{preparedDigest:image.digest,width:image.width,height:image.height,altText:image.alt});
    const bytes=await readManagedObject(join(root,"media/stock-managed"),context.scope.webPresenceId,asset.source_reference);
    if(createHash("sha256").update(bytes).digest("hex")!==image.digest)throw Error("Prepared stock bytes differ");
    images.push(image);
   }
   await c.query("ROLLBACK");
  }finally{c.release()}}finally{await pool.end()}
  const permissionContext={contextDigest:state.contextDigest,schema:checkpoint.schema,homeDigest:fingerprint(state.pages.find((page:{path:string})=>page.path==="/")),
   records:media.localStockEvidence.records.map((record:{assetId:string;target:unknown;lineage:unknown;sourceId:string})=>({...record,image:images.find(image=>image.assetId===record.assetId)}))};
  const permissionFile=join(root,"media/reviewed-stock-context.json");
  await writeFile(permissionFile,JSON.stringify(permissionContext),{mode:0o600,flag:"wx"}).catch(async(error:NodeJS.ErrnoException)=>{
   if(error.code!=="EEXIST"||fingerprint(JSON.parse(await readFile(permissionFile,"utf8")))!==fingerprint(permissionContext))throw Error("Conflicting private stock permission context");
  });
  retainedStock={sourcePacket:media.digest,sourceVersion:64,placementSectionsUnchanged:true,rightsAndUsageReverified:true,publicUseApproved:false};
 }
 if(process.argv[4]==="--refresh-media-context"){
  if(!retainedStock)throw Error("Reviewed media required");
  console.log(JSON.stringify({status:"PASS",operation:"refresh-private-stock-context",version,images:images.length,providerCalls:0,permissionsChanged:false}));return;
 }
 const packet={candidate,images,...(retainedStock&&{retainedStock}),unresolvedActions:input.unresolvedActions,localDraftOnly:true,contextDigest:state.contextDigest,sourceVersion:version,sourceEvent:event.digest,
 digest:fingerprint({candidate,sourceEvent:event.digest,projection:"authored-action-order/2",images,...(retainedStock&&{retainedStock})})};
 const file=join(root,"site-"+version+"-projection-v2.json");
 await writeFile(file,JSON.stringify(packet,null,2),{mode:0o600,flag:"wx"});
 console.log(JSON.stringify({status:"PASS",operation:"exact-historical-local-projection",version,pages:pages.length,file,digest:packet.digest,protectedInputIncluded:false}));
 }finally{await db.end()}
}
main().catch(()=>{console.error(JSON.stringify({status:"BLOCKED",operation:"exact-historical-local-projection",code:"PROJECTION_OR_MEDIA_VERIFICATION_FAILED"}));process.exitCode=1});
