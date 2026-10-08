import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {Pool} from "pg";
import {snapshotPublic} from "./customer-previews/disposable";
import {review,planPromotion} from "./customer-updates/miopages-focus";
import {customerGraph,otherCustomerState} from "../lib/platform/customer-state";
import {stateFingerprint,type CustomerState} from "../lib/platform/customer-initialization";
import {fingerprint} from "../lib/platform/canonical/model";
async function main(){
 const pool=new Pool({connectionString:process.env.DATABASE_URL,options:"-c default_transaction_read_only=on -c timezone=UTC"});
 try{
  const before=JSON.parse(await readFile("runtime-content/miopages-promotion/before.json","utf8")) as CustomerState;
  assert.equal(stateFingerprint(before),review.completeBefore);
  const after=await snapshotPublic(pool);assert.equal(planPromotion(after).changed,false);
  const myo=before.web_presences.find(r=>r.id!==review.target.webPresenceId)!;
  const target={organizationId:String(myo.organization_id),webPresenceId:String(myo.id),managedSiteId:String(before.managed_sites.find(r=>r.web_presence_id===myo.id)!.id)};
  const result={completeBefore:stateFingerprint(before),completeAfter:stateFingerprint(after),mioBefore:stateFingerprint(customerGraph(before,review.target)),mioAfter:stateFingerprint(customerGraph(after,review.target)),myomatonBefore:stateFingerprint(customerGraph(before,target)),myomatonAfter:stateFingerprint(customerGraph(after,target)),otherBefore:stateFingerprint(otherCustomerState(before,review.target)),otherAfter:stateFingerprint(otherCustomerState(after,review.target)),migrationBefore:fingerprint(before.migrations),migrationAfter:fingerprint(after.migrations),migrationCount:after.migrations.length,unresolvedVisualNeeds:customerGraph(after,review.target).sections.filter(r=>(r.metadata as Record<string,unknown>).visualNeed).length,publicationAuthorized:false,commercialLaunchAuthorized:false};
  assert.equal(result.myomatonBefore,result.myomatonAfter);assert.equal(result.otherBefore,result.otherAfter);assert.equal(result.migrationBefore,result.migrationAfter);
  await writeFile("runtime-content/miopages-promotion/after.json",JSON.stringify(after,null,2)+"\n");
  await writeFile("runtime-content/miopages-promotion/verification.json",JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result,null,2));
 }finally{await pool.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
