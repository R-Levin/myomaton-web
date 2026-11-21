import assert from "node:assert/strict";
import test from "node:test";
import {unsupportedCommercialCopy} from "../lib/platform/intake/presence-marketing-authority";
const group=(heading:string,items:string[])=>({kind:"group",children:[{kind:"heading",text:heading},{kind:"list",items}]});
test("explicitly excluded outcome guarantees stay exclusions, with scope confined to their native group",()=>{
 assert.equal(unsupportedCommercialCopy(group("Not promised here",["Guaranteed rankings or lead volumes"])),false);
 assert.equal(unsupportedCommercialCopy(group("What this is not",["Guaranteed sales results"])),false);
 assert.equal(unsupportedCommercialCopy({kind:"group",children:[group("Not promised here",["Guaranteed leads"]),group("Our results",["Guaranteed rankings"])]}),true);
 assert.equal(unsupportedCommercialCopy(group("No barriers",["Guaranteed leads"])),true);
 assert.equal(unsupportedCommercialCopy(group("Not just promises",["Guaranteed rankings"])),true);
 assert.equal(unsupportedCommercialCopy({kind:"group",children:[{kind:"heading",text:"Not included"},{kind:"list",items:["Guaranteed leads"]},
  {kind:"heading",text:"Our promise"},{kind:"list",items:["Guaranteed leads"]}]}),true);
 assert.equal(unsupportedCommercialCopy({kind:"group",children:[{kind:"list",items:["Guaranteed leads"]},{kind:"heading",text:"Not included"}]}),true);
});
test("positive promises, disguised affirmative clauses, prices and customer proof remain refused",()=>{
 for(const text of ["We guarantee leads","We guarantee rankings","Guaranteed leads but we promise traffic","Our customers say it works","$500","5 stars"]){
  assert.equal(unsupportedCommercialCopy({body:text}),true,text);
  assert.equal(unsupportedCommercialCopy(group("Not promised here",[text])),true,text);
 }
});
