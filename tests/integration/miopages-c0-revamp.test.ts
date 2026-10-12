import assert from "node:assert/strict";
import test from "node:test";
import { prepareAcceptedRevamp } from "../../scripts/customer-previews/miopages-c0-fixture";
import { validateAcceptedRevamp } from "../../scripts/preview-miopages-c0";
import { accepted } from "../../scripts/customer-previews/miopages-c0";
const url=process.env.ASSET_TEST_DATABASE_URL;
test("accepted C0 is reproducible without prior receipts, renders all routes and preserves real customers/assets",{skip:!url},async()=>{
 const fixture=await prepareAcceptedRevamp(url!);
 try {
  const server=await fixture.start();assert.equal((await validateAcceptedRevamp(server.base,fixture.previewState)).length,7);
  assert.deepEqual(fixture.previewState.business_knowledge[0].payload,accepted.business.knowledge);
  assert.deepEqual(fixture.previewState.offerings[0].payload,accepted.business.offering);
  for(const asset of fixture.managed) {const response=await fetch(server.base+"/media/assets/"+asset.id);assert.equal(response.status,200);assert.ok(Buffer.from(await response.arrayBuffer()).equals(asset.bytes));}
  for(const asset of fixture.before.assets.filter(a=>!fixture.managed.some(m=>m.id===a.id))) assert.equal((await fetch(server.base+"/media/assets/"+asset.id)).status,404);
  for(const route of ["/contact","/account","/sign-in","/case-studies"]) assert.equal((await fetch(server.base+route)).status,404);
  assert.equal((await fixture.verifyPreservation()).allRealCustomersUnchanged,true);
 }finally{await fixture.stop();}
});
