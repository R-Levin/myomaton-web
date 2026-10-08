import {parseArgs} from "node:util";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {Pool} from "pg";
import {uuid} from "../lib/platform/canonical/model";
import {loadSectionContext} from "../lib/platform/content-editing/service";
import {describeTextFields,createEditorialDraft,editEditorialDraft,type EditorialDraft} from "../lib/platform/content-editing/authority";
async function main(){
 const {values}=parseArgs({options:{section:{type:"string"},"web-presence":{type:"string"},"managed-site":{type:"string"},field:{type:"string"},"text-file":{type:"string"},actor:{type:"string"},reason:{type:"string"}},allowPositionals:false});
 const scope={webPresenceId:uuid(values["web-presence"]),managedSiteId:uuid(values["managed-site"])};
 const sectionId=uuid(values.section),pool=new Pool({connectionString:process.env.DATABASE_URL,options:"-c default_transaction_read_only=on"});
 try{
  const context=await loadSectionContext(pool,scope,sectionId),fields=describeTextFields(context);
  if(!values.field&&!values["text-file"]){console.log(JSON.stringify(fields,null,2));return;}
  if(!values.field||!values["text-file"]||!values.actor||!values.reason)throw Error("Draft edit needs field, text-file, actor and reason");
  const directory=`runtime-content/editorial-drafts/${scope.webPresenceId}/${scope.managedSiteId}`,file=`${directory}/${sectionId}.json`;
  let previous=createEditorialDraft(context);
  try{previous=JSON.parse(await readFile(file,"utf8")) as EditorialDraft;}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}
  const draft=editEditorialDraft(context,previous,{scope,fieldId:values.field,value:await readFile(values["text-file"],"utf8"),actor:values.actor,reason:values.reason,at:new Date().toISOString(),expectedSequence:previous.edits.length});
  await mkdir(directory,{recursive:true});await writeFile(file,JSON.stringify(draft,null,2)+"\n");
  console.log(JSON.stringify({file,edits:draft.edits.length,reviewStatus:draft.reviewStatus,published:draft.published,canonicalStateChanged:false},null,2));
 }finally{await pool.end();}
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1;});
