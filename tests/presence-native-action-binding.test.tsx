import assert from "node:assert/strict";
import test from "node:test";
import {bindNativeActionLabels,readNativeComponent,type NativeNode} from "../lib/platform/intake/presence-native-component";
import {readPage} from "../lib/platform/intake/presence-workflow-artifacts";
function node(kind:NativeNode["kind"],extra:Partial<NativeNode>={}):NativeNode{return{kind,text:null,level:null,items:[],ordered:false,reference:null,
 layout:{arrangement:"flow",columns:[],gap:"medium",inset:"none",surface:"none",align:"start",measure:"full",typeScale:"body",span:1,mobileOrder:0,border:false,rounded:false},children:[],...extra}}
function fixture(){return {path:"/",heading:"Offline offer",searchTitle:"Offline",searchDescription:"Offline",composition:"managed-v1",internalLinks:[],
 actions:[{label:"Request review",kind:"request-review",destination:null,sectionIndex:0},{label:"Learn about the service",kind:"navigate",destination:"/service",sectionIndex:0}],
 sections:[{heading:"Offline offer",body:"An offline business offer.",sourceIds:["offer"],role:"hero",visual:{purpose:"Text",brief:"No media",altIntent:"None",status:"text-only"},
 block:{version:2,name:"offline-offer",purpose:"An offline native Hero",mode:"section",root:node("group",{children:[node("heading",{text:"Offline offer",level:1}),
 node("action",{reference:"action-0"}),node("action",{reference:"action-1"})]})}}]}}
test("provider recovery binds only missing duplicate button text to exact Page Actions without modifying retained response, destinations or copy",()=>{
 const raw=fixture(),before=structuredClone(raw);
 const parsed=readPage(raw,"/",["/","/service"],["offer"],{},true,true,true);
 assert.deepEqual(raw,before);assert.deepEqual(parsed.actions,raw.actions);
 const block=parsed.sections[0].block!;assert.equal(block.version,2);
 if(block.version!==2)throw Error("Native fixture");
 assert.equal(block.root.children[1].text,raw.actions[0].label);assert.equal(block.root.children[2].text,raw.actions[1].label);
 assert.equal(parsed.actions[0].destination,null,"A disabled exact Action stays disabled, without shifting the next Action");
 assert.throws(()=>readPage(raw,"/",["/","/service"],["offer"],{},false,true,true),"Canonical authoring remains strict");
 assert.deepEqual(readNativeComponent(bindNativeActionLabels(block,raw.actions)),block);
});
test("unknown/external/negative references, empty labels and markup remain refused; existing node text is preserved",()=>{
 for(const ref of ["action-2","action--1","action-01","https://foreign.test"]){
 const raw=fixture();raw.sections[0].block.root.children[1].reference=ref;
 assert.throws(()=>readPage(raw,"/",["/","/service"],["offer"],{},true,true,true));
 }
 for(const label of ["","<script>unsafe</script>"]){const raw=fixture();raw.actions[0].label=label;assert.throws(()=>readPage(raw,"/",["/","/service"],["offer"],{},true,true,true))}
 const raw=fixture();raw.sections[0].block.root.children[1].text="Explicit unchanged label";
 const bound=bindNativeActionLabels(raw.sections[0].block,raw.actions) as typeof raw.sections[0]["block"];
 assert.equal(bound.root.children[1].text,"Explicit unchanged label");
});

test("an empty provider disclosure retains its exact visible statement without inventing expansion content or relaxing canonical structure",async()=>{
 const{recoverProviderNativeComponent,nativeComponentSchema}=await import("../lib/platform/intake/presence-native-component");
 const raw=fixture();raw.sections[0].block.root.children.push(node("details",{text:"An exact retained visible statement"}));
 const before=structuredClone(raw);
 assert.throws(()=>readNativeComponent(raw.sections[0].block));
 const parsed=readPage(raw,"/",["/","/service"],["offer"],{},true,true,true);
 assert.deepEqual(raw,before);
 const block=parsed.sections[0].block!;if(block.version!==2)throw Error("Native fixture");
 assert.equal(block.root.children.at(-1)!.kind,"paragraph");
 assert.equal(block.root.children.at(-1)!.text,"An exact retained visible statement");
 assert.deepEqual(block.root.children.at(-1)!.children,[]);
 const wire=nativeComponentSchema.$defs.nativeNode.anyOf;
 const detail=wire.find(schema=>schema.properties.kind.enum[0]==="details")!;
 assert.equal((detail.properties.children as {minItems?:number}).minItems,1,"New provider responses cannot produce empty disclosures");
 const paragraph=wire.find(schema=>schema.properties.kind.enum[0]==="paragraph")!;
 assert.equal((paragraph.properties.children as {maxItems?:number}).maxItems,0);
 const bad=fixture();bad.sections[0].block.root.children.push(node("details",{text:"<script>unsafe</script>"}));
 assert.throws(()=>readNativeComponent(recoverProviderNativeComponent(bad.sections[0].block,bad.actions)));
});

test("sections cite sources only when they make claims; any citation must still be a real supplied source",()=>{
 const raw=fixture();
 raw.sections.push({heading:"Why it matters",body:"A persuasive, structural section with no factual claim.",sourceIds:[],role:"intro",
  visual:{purpose:"Text",brief:"No media",altIntent:"None",status:"text-only"},block:null as never});
 const parsed=readPage(raw,"/",["/","/service"],["offer"],{},true,true,true);
 assert.deepEqual(parsed.sections[1].sourceIds,[]);
 raw.sections[1].sourceIds=["invented-source"];
 assert.throws(()=>readPage(raw,"/",["/","/service"],["offer"],{},true,true,true),/Unknown artifact reference/);
});
