import assert from "node:assert/strict";
import test from "node:test";
import { privateStockPlacements,stockReviewMatchesPages } from "../lib/platform/intake/presence-stock-placement";
import { editorialScopeInstructions,stockPlacementInstructions } from "../lib/platform/intake/presence-review-instructions";
import { fingerprint } from "../lib/platform/canonical/model";
import type {WorkflowRun} from "../lib/platform/intake/presence-workflow";

const pool=[{hit:{sourceId:"one"}},{hit:{sourceId:"two"}}];
function page(path:string, ids:string[]):WorkflowRun["input"]["pages"][number] {
 return {path,heading:"Offline",searchTitle:"Offline",searchDescription:"Offline",composition:"managed-v1",
 sections:ids.map((id,index)=>({heading:"Section "+index,body:"Offline content",sourceIds:["offer"],role:"intro",
 visual:{purpose:"Illustrative context",brief:"sourceId "+id,altIntent:"Offline",status:"rights-review"}})),actions:[],internalLinks:[]};
}
function packet(pages:WorkflowRun["input"]["pages"]){
 return {pages:pages.map(page=>({path:page.path,sections:page.sections.map((s,i)=>({id:page.path+"-"+i,type:s.role!,content:{heading:s.heading,text:s.body}}))}))};
}
test("zero, one and two meaningful placements follow Core choices across Pages without treating stock as a quota",()=>{
 const none=[page("/",[])];assert.equal(privateStockPlacements(none,packet(none),pool).length,0);
 const one=[page("/",[]),page("/service",["one"])];
 const selected=privateStockPlacements(one,packet(one),pool);assert.equal(selected.length,1);assert.equal(selected[0].sourcePage.path,"/service");
 const two=[page("/",["two"]),page("/service",["one"])];assert.equal(privateStockPlacements(two,packet(two),pool).length,2);
 const stale=packet(one);stale.pages[1].sections[0].content.text="Changed";
 assert.throws(()=>privateStockPlacements(one,stale,pool));
 const duplicated=[page("/",["one"]),page("/service",["one"])];assert.throws(()=>privateStockPlacements(duplicated,packet(duplicated),pool),/Ambiguous/);
 const combined=[page("/",["one sourceId two"])];assert.throws(()=>privateStockPlacements(combined,packet(combined),pool),/one exact photo/i);
});
test("a supporting Page's rights review expires when that actual Page changes; old Home-only bindings stay scoped",()=>{
 const pages=[page("/",[]),page("/service",["one"])];
 const reviewed={pageDigests:{"/service":fingerprint(pages[1])},records:[{pagePath:"/service"}]};
 assert.equal(stockReviewMatchesPages(reviewed,pages),true);
 const changed=structuredClone(pages);changed[1].sections[0].body="Changed context";
 assert.equal(stockReviewMatchesPages(reviewed,changed),false);
 assert.equal(stockReviewMatchesPages(reviewed,pages.slice(0,1)),false);
 assert.equal(stockReviewMatchesPages({...reviewed,records:[{}]},pages),false);
 assert.equal(stockReviewMatchesPages({homeDigest:fingerprint(pages[0]),records:[{}]},pages),true);
 assert.equal(stockReviewMatchesPages({homeDigest:fingerprint(pages[0]),records:[{pagePath:"/service"}]},pages),false);
});
test("review separates actual commercial defects from preview/launch dependencies and stock remains optional",()=>{
 assert.match(editorialScopeInstructions(true),/only the supplied Home/);
 assert.doesNotMatch(editorialScopeInstructions(true),/Critically review the complete supplied site/);
 assert.match(editorialScopeInstructions(false),/complete supplied site/);
 for(const early of [true,false]){
  const scope=editorialScopeInstructions(early);
  assert.match(scope,/operational requirements/);assert.match(scope,/Broken navigation between actually drafted Pages/);
  assert.match(scope,/not customer acceptance or publication/);
 }
 assert.match(stockPlacementInstructions(true),/optional selection pool/);
 assert.doesNotMatch(stockPlacementInstructions(true),/requires both/);
 assert.match(stockPlacementInstructions(false),/requires both selected photographs/,"Historical grant instructions unchanged");
});
