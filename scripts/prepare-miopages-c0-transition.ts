import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { JSDOM } from "jsdom";
import { prepareC0TransitionFixture } from "./customer-previews/miopages-c0-transition-fixture";
import { before, after, target, transitionChanges, transitionInventory, applyC0Transition, previewControlExplanation } from "./customer-updates/miopages-c0-revamp";
import { c0Navigation, acceptedHero } from "./customer-previews/miopages-c0";
import { stateFingerprint, type CustomerState } from "../lib/platform/customer-initialization";
import { customerGraph } from "../lib/platform/customer-state";

export async function validateTransitionRendering(previewBase: string, productionBase: string, state: CustomerState) {
  const owned = customerGraph(state,target), routes = [];
  for (const page of owned.pages.filter(p=>p.status==="active")) {
    const route = String(page.slug);
    const preview = new JSDOM(await (await fetch(previewBase+route)).text()).window.document;
    const response = await fetch(productionBase+route); assert.equal(response.status,200);
    const production = new JSDOM(await response.text()).window.document;
    for (const selector of ["main", "header nav", "footer nav"]) assert.equal(production.querySelector(selector)?.outerHTML,preview.querySelector(selector)?.outerHTML, `${route}: transitioned modes must match`);
    assert.equal(production.querySelectorAll("main button,form,input,textarea,[data-fpo-role],[data-acquired-role]").length,0);
    const main = production.querySelector("main")!;
    const sections = owned.sections.filter(s=>s.page_id===page.id && s.status==="active").sort((a,b)=>Number(a.sort_order)-Number(b.sort_order));
    assert.equal(main.children.length, sections.length);
    assert.equal(main.querySelectorAll("h1").length,1);
    const label = (id:unknown)=>owned.actions.find(a=>a.id===id)?.label;
    const blocks = (text:unknown)=>typeof text==="string" && text ? text.split("\n\n") : [];
    for (const [i,section] of sections.entries()) {
      const c = section.content as Record<string,unknown>, items = (c.items??[]) as Record<string,unknown>[];
      const expected = [c.eyebrow,c.heading,...blocks(c.text),...items.flatMap(item=>[item.heading,...blocks(item.text),label(item.actionId)]),label(c.actionId),label(c.secondaryActionId)].filter(Boolean);
      assert.deepEqual([...main.children[i].querySelectorAll("h1,h2,h3,p,a,button")].map(e=>e.textContent),expected,`${route}: exact canonical copy`);
    }
    for (const selector of ["header nav","footer nav"]) assert.deepEqual([...production.querySelectorAll(selector+" a")].map(a=>[a.textContent,a.getAttribute("href")]),c0Navigation);
    for (const a of production.querySelectorAll("a")) {
      const href = a.getAttribute("href"); assert.notEqual(href,"/experience");
      assert.ok(owned.pages.some(p=>p.slug===href && p.status==="active"));
    }
    assert.doesNotMatch(main.textContent!,/Development preview/);
    if (route==="/") assert.equal(main.querySelector("h1")?.textContent,acceptedHero);
    if (route==="/review") {
      assert.ok(!main.textContent!.includes(previewControlExplanation));
      assert.doesNotMatch(main.textContent!,/preview control|control is disabled|Start My Free Review/i);
      assert.equal(main.querySelector('a[href="/start"]')?.textContent,"Ready to get started now?");
    }
    routes.push({route,sections:sections.length});
  }
  assert.equal((await fetch(productionBase+"/experience")).status,404);
  assert.equal((await fetch(productionBase+"/api/contact",{method:"POST"})).status,503);
  assert.equal((await fetch(productionBase+"/media/assets/8e97e1e5-5da9-4843-8a5e-43f698db2a5f")).status,404);
  return { routes, difference: "Canonical content excludes exactly two disposable Review control labels and their one explanatory paragraph. Original isolated accepted preview remains unchanged; transitioned rendering has no controls/explanation in either mode." };
}

async function main() {
  const args = parseArgs({ options: { serve: { type: "boolean", default: false } }, strict: true, allowPositionals: false });
  assert.ok(process.env.DATABASE_URL);
  const fixture = await prepareC0TransitionFixture(process.env.DATABASE_URL);
  try {
    const result = await applyC0Transition(fixture.wrapped), state = await fixture.read();
    assert.equal((await applyC0Transition(fixture.wrapped)).changed,false);
    const preview = await fixture.start(true), production = await fixture.start(false);
    const rendering = await validateTransitionRendering(preview.base,production.base,state);
    const report = { preparationOnly: true, appliedToRealCustomer: false, target, schema: fixture.schema,
      previewUrl: preview.base, productionSafeUrl: production.base, result, inventory: transitionInventory(), rendering,
      preservation: await fixture.verify(), plannedMioPagesFingerprint: stateFingerprint(after) };
    await mkdir("runtime-content/miopages-c0-transition",{recursive:true});
    await writeFile("runtime-content/miopages-c0-transition/report.json",JSON.stringify(report,null,2)+"\n");
    await writeFile("runtime-content/miopages-c0-transition/exact-diff.json",JSON.stringify({before,after,...transitionChanges()},null,2)+"\n");
    console.log(JSON.stringify(report,null,2));
    if (args.values.serve) await new Promise<void>(resolve=>{process.once("SIGINT",resolve);process.once("SIGTERM",resolve);});
  } finally { await fixture.stop(); }
}
if (process.argv[1]?.replaceAll("\\","/").endsWith("/prepare-miopages-c0-transition.ts")) main().catch(e=>{console.error(e);process.exitCode=1;});
