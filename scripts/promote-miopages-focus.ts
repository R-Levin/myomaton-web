import { parseArgs } from "node:util";
import { writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { promoteMioPages, planPromotion, review } from "./customer-updates/miopages-focus";
import { snapshotPublic } from "./customer-previews/disposable";
async function main(){
 const {values}=parseArgs({options:{apply:{type:"boolean"}},allowPositionals:false});
 const pool=new Pool({connectionString:process.env.DATABASE_URL});
 try {
  const before=await snapshotPublic(pool),plan=planPromotion(before);
  if(!values.apply){console.log(JSON.stringify({target:review.target,changed:plan.changed,updated:plan.updates.length,inserted:plan.inserts.length,deleted:0,publicationAuthorized:false},null,2));return;}
  const result=await promoteMioPages(pool);await writeFile(`runtime-content/miopages-promotion/${result.changed?"applied":"rerun"}.json`,JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result,null,2));
 }finally{await pool.end();}
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1;});
