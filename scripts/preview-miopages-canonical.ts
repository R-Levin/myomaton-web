import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createServer} from "node:http";
import {once} from "node:events";
import {mkdir,writeFile} from "node:fs/promises";
import {Pool} from "pg";
import {snapshotPublic} from "./customer-previews/disposable";
import {planPromotion,review} from "./customer-updates/miopages-focus";
import {stateFingerprint} from "../lib/platform/customer-initialization";
async function main(){
 const pool=new Pool({connectionString:process.env.DATABASE_URL,options:"-c default_transaction_read_only=on -c timezone=UTC"});
 let child:ReturnType<typeof spawn>|undefined;
 try{
  const before=await snapshotPublic(pool);assert.equal(planPromotion(before).changed,false);
  const reserve=createServer().listen(0,"127.0.0.1");await once(reserve,"listening");const port=(reserve.address() as {port:number}).port;await new Promise<void>(r=>reserve.close(()=>r()));
  const database=new URL(process.env.DATABASE_URL!);database.searchParams.set("options","-c search_path=public -c default_transaction_read_only=on");
  child=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port",String(port)],{env:{...process.env,DATABASE_URL:database.href,WEB_PRESENCE_ID:review.target.webPresenceId,MANAGED_SITE_ID:review.target.managedSiteId,PRESENTATION_PREVIEW_SCHEMA:""},windowsHide:true,stdio:"ignore"});
  const url=`http://127.0.0.1:${port}`;let ready=false;
  for(let i=0;i<100;i++){assert.equal(child.exitCode,null);try{if((await fetch(url,{signal:AbortSignal.timeout(5000)})).status===200){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready);
  const report={url,schema:"public",target:review.target,processId:child.pid,completeFingerprint:stateFingerprint(before),readOnly:true,productionSafe:true,publicationAuthorized:false,commercialLaunchAuthorized:false};
  await mkdir("runtime-content/miopages-promotion",{recursive:true});await writeFile("runtime-content/miopages-promotion/render.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report,null,2));
  await new Promise<void>(r=>{process.once("SIGINT",r);process.once("SIGTERM",r);});
 }finally{if(child&&child.exitCode===null){const done=once(child,"exit");child.kill();await done;}await pool.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
