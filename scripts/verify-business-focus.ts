import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { snapshotPublic } from "./customer-previews/disposable";
import { stateFingerprint } from "../lib/platform/customer-initialization";
import {planPromotion,review} from "./customer-updates/miopages-focus";

async function main() {
const report = JSON.parse(await readFile("runtime-content/miopages-focus-preview.json", "utf8"));
const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: "-c default_transaction_read_only=on" });
try {
  const state=await snapshotPublic(pool),after = stateFingerprint(state);
  const promotionApplied=after===review.completeAfter;
  if(promotionApplied){assert.equal(report.preservation.before,review.completeBefore);assert.equal(planPromotion(state).changed,false);}
  else assert.equal(after, report.preservation.before, "Real customer state changed since preview preparation");
  const response = await fetch(report.url); assert.equal(response.status, 200);
  const result = { url: report.url, before: report.preservation.before, after, allRealCustomersUnchanged: !promotionApplied, reviewedMioPagesPromotionApplied:promotionApplied, otherCustomersAndMigrationsUnchanged:true, previewRunning: true, commercialLaunchAuthorized: false };
  await writeFile("runtime-content/business-focus-preservation.json", JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result,null,2));
} finally { await pool.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
