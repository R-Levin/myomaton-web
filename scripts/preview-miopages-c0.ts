import assert from "node:assert/strict";
import { mkdir,writeFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { prepareAcceptedRevamp } from "./customer-previews/miopages-c0-fixture";
import { c0Navigation as iaNavigation,acceptedHero } from "./customer-previews/miopages-c0";
import { stateFingerprint,type CustomerState } from "../lib/platform/customer-initialization";
export async function validateAcceptedRevamp(base:string,state:CustomerState) {
 const routes=[];
 for(const page of state.pages.filter(p=>p.status==="active")) {
  const route=String(page.slug), response=await fetch(base+route);assert.equal(response.status,200,route);
  const doc=new JSDOM(await response.text()).window.document,main=doc.querySelector("main")!;
  const sections=state.sections.filter(s=>s.page_id===page.id&&s.status==="active").sort((a,b)=>Number(a.sort_order)-Number(b.sort_order));
  assert.equal(main.children.length,sections.length);assert.equal(main.querySelectorAll("h1").length,1);
  const label=(id:unknown)=>state.actions.find(a=>a.id===id)?.label;
  const blocks=(t:unknown)=>typeof t==="string"&&t?t.split("\n\n"):[];
  for(const [i,row] of sections.entries()) {
   const c=row.content as Record<string,unknown>,items=(c.items??[]) as Record<string,unknown>[];
   const expected=[c.eyebrow,c.heading,...blocks(c.text),...items.flatMap(item=>[item.heading,...blocks(item.text),label(item.actionId)]),c.previewControlLabel,label(c.actionId),label(c.secondaryActionId)].filter(Boolean);
   assert.deepEqual([...main.children[i].querySelectorAll("h1,h2,h3,p,a,button")].map(e=>e.textContent),expected,route+" exact structured copy");
  }
  for(const selector of ["header nav","footer nav"]) assert.deepEqual([...doc.querySelectorAll(selector+" a")].map(a=>[a.textContent,a.getAttribute("href")]),iaNavigation);
  for(const a of doc.querySelectorAll("a")) {
   const href=a.getAttribute("href");assert.notEqual(href,"/experience");assert.ok(state.pages.some(p=>p.slug===href&&p.status==="active"));
   if(a.closest("main")) assert.ok(state.actions.some(action=>action.label===a.textContent&&state.pages.find(p=>p.id===action.destination)?.slug===href));
  }
  assert.equal(main.querySelectorAll("form,input,textarea,[data-fpo-role],[data-acquired-role]").length,0);
  assert.doesNotMatch(main.textContent!,/Development preview/);
  if(route==="/") {
   assert.equal(main.querySelector("h1")!.textContent,acceptedHero);
   assert.equal(main.querySelector("a.p-action")?.textContent,"Get Your Free Web Presence Review");
   assert.equal(main.querySelector("a.focus-secondary")?.getAttribute("href"),"/start");
  }
  if(route==="/review") {
   const buttons=[...main.querySelectorAll("button")];assert.equal(buttons.length,2);
   for(const button of buttons) {assert.equal(button.textContent,"Start My Free Review");assert.ok(button.disabled);assert.equal(button.type,"button");}
   assert.equal(main.querySelector('a[href="/start"]')?.textContent,"Ready to get started now?");
   assert.ok([...main.querySelectorAll('a[href="/start"]')].some(a=>a.textContent==="Start Now"));
  } else assert.equal(main.querySelectorAll("button").length,0);
  routes.push({route,sections:sections.length,links:[...main.querySelectorAll("a")].map(a=>({label:a.textContent,href:a.getAttribute("href")}))});
 }
 assert.equal((await fetch(base+"/experience")).status,404);
 assert.equal((await fetch(base+"/api/contact",{method:"POST"})).status,503);
 assert.equal((await fetch(base+"/media/assets/8e97e1e5-5da9-4843-8a5e-43f698db2a5f")).status,404);
 return routes;
}

async function main() {
 assert.ok(process.env.DATABASE_URL,"DATABASE_URL required");
 const preview=await prepareAcceptedRevamp(process.env.DATABASE_URL);
 try {
  const server=await preview.start(),routes=await validateAcceptedRevamp(server.base,preview.previewState);
  const report={url:server.base,schema:preview.schema,processId:server.processId,assetRoot:preview.root,previewFingerprint:stateFingerprint(preview.previewState),preservation:await preview.verifyPreservation(),routes,humanAcceptedForStage:true,publicationAuthorized:false,appliedToRealCustomer:false};
  await mkdir("runtime-content/miopages-c0",{recursive:true});
  await writeFile("runtime-content/miopages-c0/checkpoint.json",JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify(report));
  await new Promise<void>(resolve=>{process.once("SIGINT",resolve);process.once("SIGTERM",resolve);});
 } finally {await preview.stop();}
}
if(process.argv[1]?.replaceAll("\\","/").endsWith("/preview-miopages-c0.ts")) main().catch(e=>{console.error(e);process.exitCode=1;});
