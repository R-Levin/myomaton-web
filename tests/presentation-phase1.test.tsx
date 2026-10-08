import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToStaticMarkup } from "react-dom/server";
import { validateDirection, readDirection, resolvePlan, serviceLed } from "../lib/platform/presentation/plan";
import { relationship, valuePoints } from "../lib/platform/presentation/content";
import { validatePalette, contrast, presentationTokens } from "../lib/platform/presentation/tokens";
import { resolveVisualDirection } from "../lib/platform/visual-direction/model";
import { normalizeSection } from "../lib/platform/managed-sites/sections";
import { normalizeBinding, projectContent, projectCanonicalSections } from "../lib/platform/canonical/projections";
import { ManagedSitePageView } from "../components/managed-sites/managed-site-page";
import { servicePage, serviceFixtures } from "./fixtures/service-led-pages";
import { phase1MioPagesPreview as mioPagesPreview, restrainedMioPagesPreview } from "../scripts/customer-previews/miopages";
import { manifest } from "../scripts/customer-initializers/miopages-c0";
import type { Pool } from "pg";

const input = mioPagesPreview.siteConfiguration.visualDirection;
const selected = validateDirection(input);
test("contract-v2 is strict, versioned, deterministic, opt-in and separate from pinned paths", () => {
  assert.deepEqual(selected, validateDirection(input));
  for (const value of [null, {}, { ...input as object, contractVersion: 3 }, { contractVersion: 2, grammar: { id: "unknown", version: 1 } }, { contractVersion: 2, grammar: { id: "service-led", version: 99 } }, { ...input as object, profileId: "editorial" }, { ...input as object, preferences: { css: "x" } }]) {
    assert.throws(() => validateDirection(value)); assert.equal(readDirection(value).grammar, "basic"); assert.ok(readDirection(value).diagnostics.length);
  }
  assert.equal(resolveVisualDirection(restrainedMioPagesPreview.siteConfiguration).presentation, undefined);
  assert.equal(resolveVisualDirection({ visualDirection: { profileId: "reference", profileVersion: 2 } }).presentation, undefined);
  assert.equal(resolveVisualDirection(mioPagesPreview.siteConfiguration).direction, null);
  assert.equal(serviceLed.compositionVersion, 1);
  const page = servicePage(); page.visual = resolveVisualDirection({visualDirection: {contractVersion:2,grammar:{id:"unknown",version:1}}});
  const html = renderToStaticMarkup(<ManagedSitePageView page={page} />);
  assert.match(html, /data-grammar="basic"/); assert.match(html, /Explain your expertise/);
  assert.match(html, /A clearer web presence/); assert.doesNotMatch(html, /p-value-scaffold/);

});
test("complete plan is deterministic; explicit > recipe > grammar > basic with strict refusal", () => {
  const page = servicePage();
  const resolve = (config = page.page.configuration, sections = page.sections, strict = true) => resolvePlan(selected, config, sections, strict);
  assert.deepEqual(resolve(), resolve()); assert.equal(resolve().sections[0].hero, "service-value");
  assert.equal(resolve({}).recipe, null); assert.equal(resolve({}).sections[0].hero, "editorial-masthead");
  const explicit = [{ ...page.sections[0], rawConfiguration: { presentation: { hero: "orientation", surface: "supporting" }, width: "reading", spacing: "compact" } }];
  const plan = resolve(undefined, explicit); assert.equal(plan.sections[0].hero, "orientation"); assert.equal(plan.sections[0].surface, "supporting"); assert.equal(plan.sections[0].width, "reading");
  for (const configuration of [{ composition: "asymmetric-field" }, { css: "x" }, { presentation: { hero: "image-led" } }, { width: 900 }]) {
    const sections = [{ ...page.sections[0], rawConfiguration: configuration }];
    assert.throws(() => resolve(undefined, sections)); assert.ok(resolvePlan(selected, {}, sections).diagnostics.length);
  }
  assert.throws(() => resolve({ presentation: { recipe: { id: "arrival", version: 9 } } }));
  assert.equal(resolvePlan(selected, { presentation: { recipe: { id: "portfolio", version: 1 } } }, page.sections).recipe, null);
  const basic = resolvePlan(readDirection({}), page.page.configuration, page.sections); assert.equal(basic.recipe, null); assert.ok(basic.sections.every(s => s.hero === "orientation" && s.surface === "light"));
});
test("three Hero structures preserve source content, and missing scaffold cannot fabricate values", () => {
  const page = servicePage();
  const docs = ["orientation", "editorial-masthead", "service-value"].map(hero => {
    const first = { ...page.sections[0], rawConfiguration: { presentation: { hero } } };
    return new JSDOM(renderToStaticMarkup(<ManagedSitePageView page={{ ...page, sections: [first] }} />)).window.document;
  });
  assert.equal(docs[0].querySelectorAll('.p-hero-title .p-hero-introduction').length, 1);
  assert.equal(docs[1].querySelectorAll('.p-hero > .p-hero-introduction').length, 1);
  assert.equal(docs[2].querySelectorAll('.p-value-scaffold > div').length, 3);
  const missing = { ...page.sections[0], content: { heading: "Approved heading", text: "Approved lead" }, rawConfiguration: {} };
  assert.equal(resolvePlan(selected, page.page.configuration, [missing]).sections[0].hero, "editorial-masthead");
  const html = renderToStaticMarkup(<ManagedSitePageView page={{ ...page, sections: [missing] }} />); assert.match(html, /Approved heading/); assert.doesNotMatch(html, /p-value-scaffold/);
  assert.throws(() => valuePoints([{ id: "x", heading: "Only one" }]));
});
test("relationship contracts preserve ordered stages and aligned parties; reject unsafe or unbounded structures", () => {
  const stages = mioPagesPreview.pages['/service'][1].content;
  const r = relationship(stages); assert.equal(r.kind, "stages"); if (r.kind === "stages") assert.deepEqual(r.items.map(i => i.id), ['launch', 'ongoing']);
  const responsibility = relationship(mioPagesPreview.pages['/service'][4].content); assert.equal(responsibility.kind, "responsibilities");
  if (responsibility.kind === "responsibilities") assert.deepEqual(responsibility.rows[0].cells.map(c => c.partyId), responsibility.parties.map(p => p.id));
  assert.equal(relationship(mioPagesPreview.pages['/service'][2].content).kind, 'scope');
  for (const content of [{ ...stages, contractVersion: 99 }, { ...stages, items: Array(9).fill({ id: 'x', heading: 'H', text: 'T' }) }, { ...stages, items: [{ id:'a',heading:'<script>',text:'T' },{id:'b',heading:'H',text:'T'}] }, { ...stages, items: [{ id:'a',heading:'H',text:'T',actionId:'foreign-string' },{id:'b',heading:'H',text:'T'}] }]) assert.throws(() => relationship(content));
  assert.equal(normalizeSection({ type: 'relationship', content: { ...stages, contractVersion: 99 } }), null);
});
test("finite canonical relationships honor public approval, selected component order and private pricing", async () => {
  const binding = normalizeBinding({ role: "offering-relationship", offeringId: manifest.offering.id, kind: "stages", componentKeys: ['standard-launch','ongoing'] });
  const row = { id: manifest.offering.id, web_presence_id: manifest.webPresenceId, status:'active', name:'MioPages', contract_version:1, payload: manifest.offering.payload };
  const content = projectContent('relationship', { source: binding }, binding, row)!;
  assert.equal(relationship(content).kind, 'stages'); assert.doesNotMatch(JSON.stringify(content), /109500|24900|pricing/);
  const expanded = normalizeBinding({ ...binding, componentKeys: ['standard-launch','expanded-launch'] }); assert.equal(projectContent('relationship',{source:expanded},expanded,row),null);
  assert.equal(projectContent('relationship', {source:binding}, binding, {...row,payload:{...manifest.offering.payload as object,approval:{by:'operator',at:'2026-10-07T00:00:00Z',scope:'internal'}}}),null);
  let owner = '';
  const pool = { query: async (_sql: string, params: string[]) => { owner = params[0]; return { rows: [] }; } } as unknown as Pool;
  assert.deepEqual(await projectCanonicalSections(pool, manifest.webPresenceId,[{type:'relationship',content:{source:binding}}]),[]); assert.equal(owner,manifest.webPresenceId);
});
test("finite palette pairs remain contrast-safe without changing legacy tokens", () => {
  const p = validatePalette(mioPagesPreview.designConfiguration.palette);
  for (const role of ['light','strong','tonal','brand','supporting','contrast'] as const) assert.ok(contrast(p[role].background,p[role].text)>=4.5);
  assert.throws(()=>validatePalette({...mioPagesPreview.designConfiguration.palette as object,brand:{background:'#ffffff',text:'#ffffff'}}));
  assert.throws(()=>validatePalette({...mioPagesPreview.designConfiguration.palette as object,custom:'#ff00ff'}));
  assert.equal(presentationTokens(mioPagesPreview.designConfiguration)['--p-font' as keyof ReturnType<typeof presentationTokens>], 'var(--font-geist-sans), system-ui, sans-serif');
});
test("MioPages recipes, relationships, conversion families and chrome differ without workflows or invented evidence", () => {
  const docs = Object.entries(serviceFixtures()).slice(0, 4).map(([route,html])=>({route,doc:new JSDOM(html).window.document,html}));
  assert.deepEqual(docs.map(d=>d.doc.querySelector('.p-presence')?.getAttribute('data-recipe')),['arrival','service','evidence','assessment']);
  assert.deepEqual(docs.map(d=>d.doc.querySelector('.p-section-cta')?.getAttribute('data-conversion') ?? d.doc.querySelector('[data-type="cta"]')?.getAttribute('data-conversion')),['closing-emphasis','integrated-invitation','focused-next-step','focused-next-step']);
  for (const {doc,html} of docs) { assert.equal(doc.querySelectorAll('h1').length,1); assert.equal(doc.querySelectorAll('form,input,textarea,[data-motion-slot],.managed-site').length,0); assert.doesNotMatch(html,/\$1,095|\$249|<script|TaBot|A-Bot/); }
  assert.equal(docs[0].doc.querySelector('header')?.getAttribute('data-chrome'),'brand-prominent');
  assert.equal(docs[1].doc.querySelector('header')?.getAttribute('data-chrome'),'compact');
  assert.equal(docs[3].doc.querySelector('footer')?.getAttribute('data-chrome'),'compact');
  assert.equal(docs[1].doc.querySelectorAll('.p-responsibility').length,3);
  const page=servicePage(); page.sections[0].action={id:'x',name:'unsafe',type:'link',label:'Submit',destination:'javascript:alert(1)'};
  assert.doesNotMatch(renderToStaticMarkup(<ManagedSitePageView page={page}/>),/javascript:|>Submit</);
});


test("service-led accepts distinct representative approved content without an industry theme", () => {
  const fixtures = serviceFixtures();
  for (const route of ["/law", "/local", "/technical"]) {
    const doc = new JSDOM(fixtures[route]).window.document;
    assert.equal(doc.querySelector(".p-presence")?.getAttribute("data-grammar"), "service-led");
    assert.equal(doc.querySelectorAll(".p-value-scaffold > div").length, 3);
    assert.equal(doc.querySelectorAll("h1").length, 1);
    assert.equal(doc.querySelectorAll("form,input,textarea").length, 0);
    assert.equal(doc.querySelector(".p-action")?.getAttribute("href"), "/review");
  }
  assert.equal(new Set(["/law", "/local", "/technical"].map(route => new JSDOM(fixtures[route]).window.document.querySelector("h1")?.textContent)).size, 3);
});
