import assert from "node:assert/strict";
import {test} from "node:test";
import {fingerprint} from "../lib/platform/canonical/model";
import {createEditorialDraft,describeTextFields,editEditorialDraft,type SectionContext} from "../lib/platform/content-editing/authority";
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
function context():SectionContext{return {scope:{webPresenceId:id(1),managedSiteId:id(2)},pageId:id(3),sectionId:id(4),version:2,type:"intro",variant:"stack",content:{heading:"A clear next step",text:"Reviewed editorial explanation."},configuration:{presentation:{surface:"brand"}},metadata:{review:{source:"operator"}},projectedContent:{},canonicalSources:[{id:id(5),version:1,fingerprint:"a".repeat(64),payload:{summary:"Agreed service"}}]};}
const input=(c:SectionContext,value="A useful next step")=>({scope:c.scope,fieldId:describeTextFields(c)[0].id,value,actor:"operator:test",reason:"Review wording",at:"2026-10-08T12:00:00Z",expectedSequence:0});
test("editorial fields expose authority, constraints and provenance without presentation controls",()=>{
 const c=context(),fields=describeTextFields(c);assert.deepEqual(fields.map(f=>f.path),["/heading","/text"]);assert.ok(fields.every(f=>f.sourceType==="page-editorial"&&f.directlyEditable&&f.requiresCanonicalReconciliation));assert.equal(fields[0].revision.sectionVersion,2);assert.deepEqual(fields[0].provenance,{metadata:c.metadata,binding:null,sources:[{id:id(5),version:1,fingerprint:"a".repeat(64)}]});
});
test("canonical-bound text and derived structural text refuse local overrides",()=>{
 const c=context();c.type="relationship";c.content={source:{role:"offering-relationship",offeringId:id(5),kind:"scope",componentKeys:["launch"]},contextHeading:"Scope"};c.projectedContent={heading:"Scope",items:[{id:"included",heading:"Included scope",text:"Canonical inclusions"},{id:"expanded-launch",heading:"Expanded Launch",text:"Canonical complexity"}]};
 const fields=describeTextFields(c);assert.equal(fields.find(f=>f.path==="/contextHeading")?.sourceType,"page-editorial");assert.equal(fields.find(f=>f.path==="/items/0/heading")?.sourceType,"derived-system");assert.equal(fields.find(f=>f.path==="/items/0/text")?.sourceType,"canonical");
 assert.equal(fields.find(f=>f.path==="/items/1/heading")?.sourceType,"canonical");
 assert.equal(fields.find(f=>f.path==="/items/0/text")?.owner,`canonical:${id(5)}`);
 for(const f of fields.filter(f=>!f.directlyEditable))assert.throws(()=>editEditorialDraft(c,createEditorialDraft(c),{...input(c),fieldId:f.id}),/override/);
});
test("draft edits journal old/new values and retain source/version/configuration without publication",()=>{
 const c=context(),before=fingerprint(c),draft=createEditorialDraft(c),one=editEditorialDraft(c,draft,input(c));
 assert.equal(fingerprint(c),before);assert.equal(draft.edits.length,0);assert.equal(one.edits[0].previousValue,"A clear next step");assert.equal(one.edits[0].newValue,"A useful next step");assert.equal(one.reviewStatus,"pending-review");assert.equal(one.published,false);assert.deepEqual(one.configuration,c.configuration);assert.deepEqual(one.sourceContext,c);assert.equal(one.edits[0].reconciliation,"pending-assessment");assert.equal(one.edits[0].proofreading,"not-run");
 const two=editEditorialDraft(c,one,{...input(c,"A practical next step"),expectedSequence:1});assert.equal(two.edits[1].previousValue,"A useful next step");assert.equal(two.edits[1].sequence,2);
});
test("invalid text, foreign ownership, stale revisions and tampered drafts fail safely",()=>{
 const c=context(),draft=createEditorialDraft(c);
 for(const value of ["", "<script>oops</script>", "x".repeat(301),"unsafe\u0001"] )assert.throws(()=>editEditorialDraft(c,draft,input(c,value)));
 assert.throws(()=>editEditorialDraft(c,draft,{...input(c),scope:{...c.scope,webPresenceId:id(9)}}),/Foreign/);
 assert.throws(()=>editEditorialDraft({...c,version:3},draft,input(c)),/Stale/);
 assert.throws(()=>editEditorialDraft(c,{...draft,workingContent:{heading:"Injected",text:"Tampered"}},input(c)),/Unjournaled/);
 assert.throws(()=>editEditorialDraft(c,{...draft,configuration:{css:"x"}},input(c)),/envelope/);
 assert.throws(()=>editEditorialDraft(c,draft,{...input(c),fieldId:`section:${c.sectionId}:/configuration/presentation/surface`}),/override/);
});
