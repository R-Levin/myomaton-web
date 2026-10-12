import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import reviewed from "../scripts/customer-updates/miopages-focus-reviewed.json";
import { disposablePreviewEnabled } from "../lib/platform/presentation/fpo";
import { normalizeSection } from "../lib/platform/managed-sites/sections";
import { servicePage } from "./fixtures/service-led-pages";
import { focusMioPagesPreview } from "../scripts/customer-previews/miopages-focus";
import { resolveVisualDirection } from "../lib/platform/visual-direction/model";
import { ManagedSitePageView } from "../components/managed-sites/managed-site-page";
import { acceptedRevamp,accepted,acceptedHero,c0Navigation } from "../scripts/customer-previews/miopages-c0";
import r3 from "../scripts/customer-previews/miopages-editorial-r3.json";
import { resolvePlan,validateDirection } from "../lib/platform/presentation/plan";
import type { CustomerState } from "../lib/platform/customer-initialization";

test("accepted fixture is deterministic, non-mutating and preserves canonical identities and unrelated state",()=>{
 const owned=structuredClone(reviewed.after) as CustomerState,saved=structuredClone(owned),at="2026-10-12T13:00:00.000Z";
 const next=acceptedRevamp(owned,at);assert.deepEqual(owned,saved);assert.deepEqual(next,acceptedRevamp(owned,at));
 for(const table of ["pages","sections","actions"] as const) assert.ok(owned[table].every(r=>next[table].some(n=>n.id===r.id)));
 assert.ok(owned.navigation_items.every(r=>next.navigationItems.some(n=>n.id===r.id)));
 const stale=structuredClone(owned);stale.pages[0].title="Unexpected change";assert.throws(()=>acceptedRevamp(stale,at),/baseline required/);
 assert.deepEqual(next.business.knowledge,accepted.business.knowledge);assert.deepEqual(next.business.offering,accepted.business.offering);
});
test("final IA and conversion destinations preserve the accepted Hero, contextual Start and disabled Review",()=>{
 assert.equal(accepted.pages.find(p=>p.slug==="/")!.sections[0].content.heading,acceptedHero);
 assert.deepEqual(c0Navigation,[["Why MioPages?","/service"],["What You Get","/what-you-get"],["How It Works","/getting-started"],["Questions & Answers","/faq"],["Get Your Free Review","/review"]]);
 assert.equal(accepted.pages.find(p=>p.slug==="/experience")!.status,"inactive");assert.ok(accepted.actions.every(a=>a.route!=="/experience"));
 const review=accepted.pages.find(p=>p.slug==="/review")!;assert.equal(review.sections.filter(s=>"previewControlLabel" in s.content).length,2);
 for(const label of ["Ready to start now?","Ready to get started now?","Start Now","What happens if I continue?"]) assert.equal(accepted.actions.find(a=>a.label===label)!.route,"/start");
 const copy=JSON.stringify(accepted.pages.filter(p=>p.status==="active").flatMap(p=>p.sections.map(s=>s.content)));assert.doesNotMatch(copy,/Development preview|Contact an Operator/);
 const start=JSON.stringify(accepted.pages.find(p=>p.slug==="/start")!.sections.map(s=>s.content));for(const phrase of ["only for missing details","commercial commitment","paid onboarding","no information is collected or submitted"]) assert.ok(start.includes(phrase));
});
test("all fifteen FAQ answers retain approved human R3 wording",()=>{
 const faq=accepted.pages.find(p=>p.slug==="/faq")!;
 const actual=faq.sections.flatMap(s=>"items" in s.content?s.content.items??[]:[]).map(i=>({heading:i.heading,text:i.text}));
 const expected=r3.pages[6].sections.flatMap(s=>s.items).map(i=>({heading:i.heading,text:i.paragraphs.join("\n\n")}));
 assert.equal(actual.length,15);assert.deepEqual(actual,expected);assert.equal(accepted.authority.editorialSha256,r3.sha256);
});
test("overview is opt-in to v3 and leaves the pinned existing recipes available",()=>{
 const direction=(version:number)=>validateDirection({contractVersion:2,grammar:{id:"service-led",version},preferences:{motion:"off"}});
 for(const version of [1,2]) assert.throws(()=>resolvePlan(direction(version),{presentation:{recipe:{id:"overview",version:1}}},[],true),/requires service-led v3/);
 assert.equal(resolvePlan(direction(3),{presentation:{recipe:{id:"overview",version:1}}},[],true).recipe,"overview");
 for(const id of ["arrival","service","evidence","assessment","editorial"]) assert.equal(resolvePlan(direction(3),{presentation:{recipe:{id,version:1}}},[],true).recipe,id);
});

test("prototype Review controls render disabled only behind explicit read-only disposable preview authorization",()=>{
 const p=servicePage("/");p.visual=resolveVisualDirection(focusMioPagesPreview.siteConfiguration);p.designSystem.rawConfiguration=focusMioPagesPreview.designConfiguration;
 const n=normalizeSection({type:"hero",content:{heading:"Review",previewControlLabel:"Start My Free Review"},configuration:{}})!;
 p.sections=[{...n,id:"hero",name:"Review"}];
 for(const preview of [false,true]) {p.presentationPreview=preview;const doc=new JSDOM(renderToStaticMarkup(<ManagedSitePageView page={p}/>)).window.document;
  const buttons=doc.querySelectorAll<HTMLButtonElement>('main button');assert.equal(buttons.length,preview?1:0);if(preview){assert.ok(buttons[0].disabled);assert.equal(buttons[0].type,"button");}assert.equal(doc.querySelectorAll('form,input,textarea').length,0);
 }
 const schema="canonical_test_"+"a".repeat(32)+"_preview",url=new URL("postgres://localhost/test");url.searchParams.set("options",`-c search_path=${schema} -c default_transaction_read_only=on`);
 assert.ok(disposablePreviewEnabled({PRESENTATION_PREVIEW_SCHEMA:schema,DATABASE_URL:url.href}));
 for(const env of [{PRESENTATION_PREVIEW_SCHEMA:"public",DATABASE_URL:url.href},{DATABASE_URL:url.href},{PRESENTATION_PREVIEW_SCHEMA:schema,DATABASE_URL:"postgres://localhost/test"}]) assert.equal(disposablePreviewEnabled(env),false);
});
