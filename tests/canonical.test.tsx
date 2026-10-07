import assert from "node:assert/strict";
import {test} from "node:test";
import {fingerprint,formatPrice,identityConfirmed,normalizeKnowledge,normalizeOffering,normalizePrice} from "../lib/platform/canonical/model";
import {normalizeBinding,projectContent} from "../lib/platform/canonical/projections";
import {deploymentSelection} from "../lib/platform/managed-sites/deployment";
import {approval,evidence,id,knowledge,offering,price} from "./helpers/canonical";

test("canonical contracts reject unknown, unsafe, contradictory and duplicate values",()=>{
  for(const payload of [{...knowledge,unknown:true},{...knowledge,entries:[{...knowledge.entries[0],value:"<script>"}]},{...knowledge,entries:[knowledge.entries[0],knowledge.entries[0]]}]) assert.throws(()=>normalizeKnowledge(payload));
  assert.throws(()=>normalizeOffering({...offering,components:[...offering.components,...offering.components]}));
  assert.throws(()=>normalizeOffering({...offering,evidence:{...evidence,confirmation:"provisional",confirmedBy:undefined,confirmedAt:undefined}}));
  for(const patch of [{amount:2.5},{currency:"XYZ"},{interval:"day"},{mode:"included"},{mode:"scope-confirmed"},{approval:{...approval,scope:"automatic"}}])assert.throws(()=>normalizePrice({...price,...patch}));
  assert.throws(()=>normalizePrice({...price,basis:"one-time"}));
  assert.throws(()=>normalizePrice({...price,mode:"scope-confirmed",amount:undefined,applicability:"complexity-increment",incrementKey:"larger-scope"}));
  assert.equal(normalizeOffering({...offering,detail:"First paragraph.\n\nSecond paragraph."}).detail,"First paragraph.\n\nSecond paragraph.");
});
test("price modes, minor units and permitted public use remain distinct",()=>{
  assert.equal(formatPrice(normalizePrice(price)),"$25/month");
  assert.equal(formatPrice(normalizePrice({...price,amount:2501})),"$25.01/month");
  assert.equal(formatPrice(normalizePrice({...price,amount:0})),"$0/month");
  assert.equal(formatPrice(undefined),null);
  const {amount: _amount,...base}=price; void _amount;
  assert.equal(formatPrice(normalizePrice({...base,mode:"included"})),"Included");
  assert.equal(formatPrice(normalizePrice({...base,mode:"scope-confirmed"})),"Price confirmed after scope review");
  assert.equal(formatPrice(normalizePrice({...base,mode:"not-published"})),null);
  assert.equal(formatPrice(normalizePrice({...price,approval:{...approval,scope:"internal"}})),null);
  assert.match(formatPrice(normalizePrice({...price,commercialStatus:"provisional-hypothesis"}))!,/provisional/);
});
test("public knowledge projection requires confirmed public entries and valid identity digest",()=>{
  const binding=normalizeBinding({role:"knowledge",knowledgeId:id(1),keys:["audience"]});
  const row={id:id(1),web_presence_id:id(2),contract_version:1,payload:knowledge};
  assert.match(String(projectContent("intro",{source:binding},binding,row)?.text),/Established/);
  for(const patch of [{visibility:"internal"},{confirmation:"provisional",confirmedBy:undefined,confirmedAt:undefined}]) assert.equal(projectContent("intro",{source:binding},binding,{...row,payload:{...knowledge,entries:[{...knowledge.entries[0],evidence:{...evidence,...patch}}]}}),null);
  const entry={field:"displayName" as const,digest:fingerprint("Example"),evidence};
  assert.ok(identityConfirmed(entry,{displayName:"Example"}));assert.equal(identityConfirmed(entry,{displayName:"Changed"}),false);
  assert.equal(fingerprint({b:2,a:1}),fingerprint({a:1,b:2}));
});
test("finite Offering projection uses existing DTOs without conflicting copied fields",()=>{
  const row={id:id(1),web_presence_id:id(2),contract_version:1,name:"Example service",status:"active",payload:offering};
  const overview=normalizeBinding({role:"offering-overview",offeringId:id(1)});
  assert.equal(projectContent("hero",{source:overview},overview,row)?.heading,"Example service");
  assert.throws(()=>projectContent("intro",{source:overview,heading:"Copied truth"},overview,row));
  const component=normalizeBinding({role:"offering-component",offeringId:id(1),componentKey:"ongoing"});
  assert.match(String(projectContent("intro",{source:component},component,row)?.text),/\$25\/month/);
  const prices=normalizeBinding({role:"offering-pricing",offeringId:id(1)});
  assert.equal(projectContent("collection",{source:prices},prices,row)?.itemSource,"inline");
  assert.equal(projectContent("hero",{source:overview},overview,{...row,status:"inactive"}),null);
  assert.equal(projectContent("hero",{source:overview},overview,{...row,payload:{...offering,approval:{...approval,scope:"internal"}}}),null);
  assert.throws(()=>normalizeBinding({role:"expression",offeringId:id(1)}));
});
test("deployment has no implicit customer and requires both valid IDs",()=>{
  for(const env of [{},{WEB_PRESENCE_ID:id(1)},{MANAGED_SITE_ID:id(2)},{WEB_PRESENCE_ID:"invalid",MANAGED_SITE_ID:id(2)}])assert.throws(()=>deploymentSelection(env));
  assert.deepEqual(deploymentSelection({WEB_PRESENCE_ID:id(1),MANAGED_SITE_ID:id(2)}),{webPresenceId:id(1),managedSiteId:id(2)});
});
