import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {fingerprint} from "../lib/platform/canonical/model";
import {prepareC0ExistingWork} from "../lib/platform/intake/c0-existing-work";
import {originalMaterialInput,resolveSourceReferences} from "../lib/platform/intake/presence-source-material";
import type {WorkflowContext,WorkflowRun} from "../lib/platform/intake/presence-workflow";

const accepted=readFileSync("scripts/customer-previews/miopages-c0-accepted.json");
const editorial=readFileSync("scripts/customer-previews/miopages-editorial-r3.json");

test("the actual accepted complete site, all business records and seven reviewed editorial Pages survive the projection",()=>{
 const result=prepareC0ExistingWork(accepted,editorial),value=JSON.parse(result.bytes.toString()),site=JSON.parse(accepted.toString()),copy=JSON.parse(editorial.toString());
 assert.deepEqual(value.businessSnapshot,site.business);
 assert.deepEqual(value.acceptedSite,{pages:site.pages,actions:site.actions,navigation:site.navigation});
 assert.deepEqual(value.earlierReviewedEditorial.pages,copy.pages);
 assert.equal(result.coverage.activePages,7);
 assert.equal(result.coverage.retainedHistoricalPages,1);
 assert.equal(result.coverage.earlierReviewedPages,7);
 assert.equal(result.coverage.businessKnowledgeEntries,site.business.knowledge.entries.length);
 assert.ok(result.coverage.businessKnowledgeEntries>=25);
 assert.equal(result.coverage.excludedDevelopmentNotes,2);
 for(const note of copy.developmentNotes)assert.ok(!result.bytes.includes(Buffer.from(note)));
 assert.match(result.bytes.toString(),/online discovery/);
 assert.match(result.bytes.toString(),/content recommendations/);
 assert.match(result.bytes.toString(),/continuous analysis and improvement/);
 assert.equal(result.source.status,"historical","Previous acceptance is not a new current-fact or publication approval");
 assert.equal(result.source.purpose,"editorial-reference");
 assert.equal(result.source.operations.length,6);
});

test("a handoff document cannot substitute for actual reviewed site content, even though it describes and links to it",()=>{
 const handoff=readFileSync("docs/miopages-editorial-r3.md");
 assert.ok(handoff.includes(Buffer.from("miopages-editorial-r3.json")));
 assert.throws(()=>prepareC0ExistingWork(accepted,handoff),/Actual reviewed editorial content/);
 assert.throws(()=>prepareC0ExistingWork(handoff,editorial),/Exact accepted complete-site/);
 const changed=Buffer.from(accepted);changed[changed.length-2]^=1;
 assert.throws(()=>prepareC0ExistingWork(changed,editorial));
});

test("the actual provider-shaped input contains the entire source projection, rather than its filename or a self-confirming summary",async()=>{
 const material=prepareC0ExistingWork(accepted,editorial);
 const context:WorkflowContext={intakeId:"offline-source-repair",scope:{webPresenceId:"offline-presence",managedSiteId:"offline-site"},
  entry:"DIRECT_START",evidence:[],limitations:[],conflicts:[],evaluation:{scenario:"c0",basis:fingerprint("offline fixture only")}};
 const input={...context,research:[],report:null,direction:null,blueprint:null,pages:[],corrections:[]};
 const run:WorkflowRun={context,input,work:{operation:"report",attempt:"offline-no-provider",until:0,inputDigest:fingerprint(input)}};
 const grant={version:1 as const,contextDigest:fingerprint(context),records:[material.source],requestBytes:1_000_000};
 const projected={existingWorkSource:{id:material.source.id,bytes:material.bytes.toString()},scope:context.scope};
 const request=await originalMaterialInput(run,grant,projected,async()=>[{source:material.source,bytes:material.bytes}],true);
 const texts=request[0].content.filter((c):c is {type:"input_text";text:string}=>c.type==="input_text").map(c=>c.text);
 assert.ok(texts.includes(material.bytes.toString()));
 const packed=JSON.parse(texts[0]);
 assert.deepEqual(resolveSourceReferences(packed.task,new Map([[material.source.id,material.bytes.toString()]])),projected);
 assert.match(packed.interpretation,/Retain and improve useful customer-owned copy/);
 assert.doesNotMatch(packed.interpretation,/Do not reproduce source wording/);
 const source=JSON.parse(texts.find(t=>t.startsWith('{"originalSource"'))!).originalSource;
 assert.equal(source.sha256,material.source.sha256);
 assert.deepEqual(source.operations,material.source.operations);
 assert.equal(source.status,"historical");
 assert.equal(run.context.evidence.length,0,"No canonical fact or cross-tenant authority was created");
});
