import assert from "node:assert/strict";
import test from "node:test";
import {fingerprint} from "../lib/platform/canonical/model";
import {ArtifactValidationError,readReport,strategyBlueprintSchema,type PresenceEvidence} from "../lib/platform/intake/presence-workflow-artifacts";
import {bindBlueprintDecisionSchema,bindCitations} from "../lib/platform/intake/presence-workflow-provider";
import type {WorkflowRun} from "../lib/platform/intake/presence-workflow";
import {marketingCitationIds,type MarketingAuthority} from "../lib/platform/intake/presence-marketing-authority";

function fixture(){
 const source={id:"business",kind:"owner-confirmed" as const,label:"Offline",reference:"Offline fixture",date:null,content:"A fixture business offer."};
 const context={intakeId:"offline",entry:"DIRECT_START" as const,scope:{webPresenceId:"offline",managedSiteId:"offline"},evidence:[source],limitations:[],conflicts:[]};
 const input={...context,research:[],corrections:[],pages:[],report:{title:"Offline",summary:"Offline",findings:[{id:"finding",heading:"Offline",body:"Offline",status:"established" as const,sourceIds:["business"]}]},
  direction:{positioning:"Offline",approach:"Offline",visitorDecisions:["Understand the offer"],sourceIds:["business"]},blueprint:null};
 const run:WorkflowRun={context,input,work:{operation:"blueprint",attempt:"offline",inputDigest:fingerprint(input),until:0}};
 const authority:MarketingAuthority={contextDigest:fingerprint(context),sources:[{digest:fingerprint(source),use:"business-fact"}],brandDigest:fingerprint("offline"),brandBrief:"Offline",qualityReviewerId:"offline",
  strategy:{version:1,peerIds:["peer-a","peer-b"]}};
 return {run,authority};
}

test("the actual serialized provider schema narrows citations without turning risk prose into source IDs",()=>{
 const {run,authority}=fixture();
 const raw=bindBlueprintDecisionSchema(run,authority),before=JSON.stringify(raw);
 const bound=bindCitations(raw,["business","observed-peer"]);
 const wire=JSON.parse(JSON.stringify(bound));
 const page=wire.properties.pages.items.properties;
 const decision=page.decisionBrief.properties;
 assert.deepEqual(page.sourceIds.items.enum,["business","observed-peer"]);
 assert.deepEqual(decision.influences.items.properties.sourceIds.items.enum,["business","observed-peer"]);
 assert.deepEqual(decision.avoid.items,{type:"string"});
 assert.equal(decision.avoid.items.enum,undefined);
 assert.match(decision.avoid.description,/plain language, not by ID/);
 assert.deepEqual(decision.findingIds.items.enum,["finding"]);
 assert.deepEqual(decision.claimIds.items.enum,["business"]);
 assert.deepEqual(decision.directionSteps.items.enum,[0]);
 assert.equal(wire.properties.navigation.items.enum,undefined);
 assert.equal(JSON.stringify(raw),before,"Do not change the source schema or historic artifact definitions");
 assert.equal(strategyBlueprintSchema.properties.pages.items.properties.decisionBrief.properties.avoid.items.type,"string");
 assert.equal("enum" in strategyBlueprintSchema.properties.pages.items.properties.decisionBrief.properties.avoid.items,false);
});

test("citation binding remains independent across grants even when their input schema shares array objects",()=>{
 const shared={type:"array",items:{type:"string"}};
 const raw={type:"object",properties:{sourceIds:shared,avoid:shared,child:{type:"object",properties:{sourceIds:shared,notes:shared}}}};
 const first=bindCitations(raw,["source-one"]) as typeof raw;
 const second=bindCitations(raw,["source-two"]) as typeof raw;
 const wire=JSON.parse(JSON.stringify(first));
 assert.deepEqual(wire.properties.sourceIds.items.enum,["source-one"]);
 assert.deepEqual(wire.properties.child.properties.sourceIds.items.enum,["source-one"]);
 assert.deepEqual(wire.properties.avoid.items,{type:"string"});
 assert.deepEqual(wire.properties.child.properties.notes.items,{type:"string"});
 assert.deepEqual(JSON.parse(JSON.stringify(second)).properties.sourceIds.items.enum,["source-two"]);
 assert.deepEqual(shared.items,{type:"string"});
});

test("source-aware wire instructions agree with customer-owned composition while historical instructions stay exact",()=>{
 const {run,authority}=fixture();
 const before=String(Reflect.get(bindBlueprintDecisionSchema(run,authority).properties.pages.items.properties.decisionBrief.properties.influences,"description"));
 const current=String(Reflect.get(bindBlueprintDecisionSchema(run,{...authority,projectionVersion:2}).properties.pages.items.properties.decisionBrief.properties.influences,"description"));
 assert.equal(before,"Each Page requires at least one composition influence citing an observed peer. Keep other uses separate.");
 assert.match(current,/may rest on business knowledge alone/);
 assert.match(current,/research must visibly shape the site as a whole/);
 assert.doesNotMatch(current,/composition influence citing an observed peer/);
});

test("attachment IDs alone cannot satisfy evidence settlement; analytical registration must not authorize public claims",()=>{
 const {run,authority}=fixture();
 const original:PresenceEvidence={id:"owned-original",kind:"historical-discovery",label:"Offline owned site",reference:"Offline only",date:null,content:"A historical description requiring current confirmation."};
 const report={title:"Offline",summary:"Offline",findings:[{id:"derived",heading:"Offline",body:"A proposed interpretation.",status:"established",sourceIds:[original.id]}]};
 assert.throws(()=>readReport(report,run.context.evidence,true),(e:unknown)=>e instanceof ArtifactValidationError&&e.issue==="citation");
 const evidence=[...run.context.evidence,original],context={...run.context,evidence};
 const analyzed={...run,context,input:{...run.input,evidence},work:{...run.work,operation:"report" as const}};
 const scoped:MarketingAuthority={...authority,contextDigest:fingerprint(context),strategy:undefined,
  sources:[...authority.sources,{digest:fingerprint(original),use:"analysis"}]};
 assert.ok(marketingCitationIds(analyzed,scoped).includes(original.id));
 assert.equal(readReport(report,evidence,true).findings[0].status,"proposed");
 assert.ok(!marketingCitationIds({...analyzed,work:{...analyzed.work,operation:"page",path:"/"}},scoped).includes(original.id));
 assert.equal(run.context.evidence.length,1,"Existing case and source authority remain unchanged");
});
