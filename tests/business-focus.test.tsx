import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { focusMioPagesPreview as proposal } from "../scripts/customer-previews/miopages-focus";
import { mioPagesPreview } from "../scripts/customer-previews/miopages";
import { servicePage } from "./fixtures/service-led-pages";
import { normalizeSection } from "../lib/platform/managed-sites/sections";
import { resolveVisualDirection } from "../lib/platform/visual-direction/model";
import { presentCollection } from "../lib/platform/managed-sites/collections";
import { ManagedSitePageView } from "../components/managed-sites/managed-site-page";
import { resolvePlan, validateDirection } from "../lib/platform/presentation/plan";
import { validatePalette } from "../lib/platform/presentation/tokens";
import { validateFpo } from "../lib/platform/presentation/fpo";
import { sourceSans } from "../lib/platform/presentation/fonts";

function pageFor(route: string, preview = true) {
  const page = servicePage(route);
  const actions = page.sections[0].relationshipActions;
  page.presentationPreview = preview;
  page.visual = resolveVisualDirection(proposal.siteConfiguration);
  page.designSystem.rawConfiguration = proposal.designConfiguration;
  page.page.configuration = proposal.pageConfigurations?.[route];
  page.sections = proposal.pages[route].map((s,i) => {
    const n = normalizeSection(s)!; assert.ok(n);
    return { ...s, ...n, id: String(i), name: String(i), rawConfiguration: s.configuration, relationshipActions: actions,
      action: actions?.[String(s.content.actionId)], secondaryAction: actions?.[String(s.content.secondaryActionId)],
      ...(n.type === "collection" ? { collectionItems: presentCollection(n.content) } : {}) };
  });
  return page;
}
const documentFor = (route: string, preview = true) => new JSDOM(renderToStaticMarkup(<ManagedSitePageView page={pageFor(route,preview)} />)).window.document;

test("new grammar is explicit, deterministic and does not mutate the prior proposal", () => {
  assert.equal((mioPagesPreview.siteConfiguration.visualDirection as { grammar: {version:number} }).grammar.version,2);
  const selection=validateDirection(proposal.siteConfiguration.visualDirection);
  assert.equal(selection.version,3);
  assert.throws(()=>validateDirection({contractVersion:2,grammar:{id:"service-led",version:4}}));
  assert.doesNotThrow(()=>validatePalette(proposal.designConfiguration.palette));
  assert.equal(sourceSans.resources.length,2); assert.ok(sourceSans.resources.every(f=>f.family==="Source Sans 3"));
  for(const route of Object.keys(proposal.pages)) {
    const sections=proposal.pages[route].map((s,i)=>({...s,id:String(i)}));
    assert.deepEqual(resolvePlan(selection,proposal.pageConfigurations?.[route],sections,true,true),resolvePlan(selection,proposal.pageConfigurations?.[route],sections,true,true));
    const doc=documentFor(route);
    assert.equal(doc.querySelector('[data-grammar-version="3"]')?.getAttribute('data-grammar'),"service-led");
    assert.equal(doc.querySelectorAll("h1").length,1);
    assert.equal(doc.querySelectorAll("form,input,textarea").length,0);
    assert.ok([...doc.querySelectorAll('link[as="font"]')].every(l=>!l.getAttribute('href')!.includes('serif')));
    assert.doesNotMatch(doc.body.textContent!,/TSG Performance|Ragan Design|Theia LLC|ROI|AI-powered|\$249/);
  }
});
test("layers are finite and unavailable to pinned grammars or incompatible roles",()=>{
  const selection=validateDirection(proposal.siteConfiguration.visualDirection), hero={...proposal.pages['/'][0],id:'hero'};
  for(const layer of ['freeform', {x:2}, 'artifact-bridge']) assert.throws(()=>resolvePlan(selection,{},[{...hero,configuration:{presentation:{layer}}}],true,true));
  assert.throws(()=>resolvePlan({...selection,version:2},{},[hero],true,true),/layer/);
  assert.equal(documentFor('/').querySelector('[data-layer="field-bridge"]')?.getAttribute('data-surface'),'brand');
});
test("continuity and contributions retain real accessible content and scope attachment",()=>{
  const doc=documentFor('/service');
  assert.deepEqual([...doc.querySelectorAll('.focus-continuity h3')].map(e=>e.textContent),['Standard Launch','Ongoing']);
  assert.ok(doc.querySelector('[data-stage="formation"] .focus-extension'));
  assert.equal(doc.querySelectorAll('.focus-continuity ol > li').length,2);
  assert.equal(doc.querySelectorAll('.focus-party').length,2);
  assert.equal(doc.querySelectorAll('.focus-scope > div').length,3);
  assert.equal(doc.querySelectorAll('.p-stages,.p-responsibilities').length,0);
});
test("evidence and annotated artifact positions have explicit provenance without fake data",()=>{
  const evidence=documentFor('/experience');
  assert.equal(evidence.querySelectorAll('[data-fpo-role="evidence-project"]').length,2);
  const review=documentFor('/review');
  assert.equal(review.querySelectorAll('.focus-priorities li').length,3);
  assert.equal(review.querySelectorAll('.focus-report-notes aside').length,3);
  assert.match(review.body.textContent!,/Illustrative|illustrative/);
  for(const route of Object.keys(proposal.pages)) for(const s of proposal.pages[route]) if(s.configuration.previewMedia) assert.equal(validateFpo(s.configuration.previewMedia).permission,'unresolved');
});
test("ordinary production refuses every FPO and overlap dependent on it",()=>{
  for(const route of Object.keys(proposal.pages)) {
    const doc=documentFor(route,false);
    assert.equal(doc.querySelectorAll('[data-fpo-role],[data-layer],.focus-report-sheet,.focus-evidence-mount').length,0);
    assert.equal(doc.querySelectorAll('form,input,textarea').length,0);
  }
  assert.equal(documentFor('/',false).querySelector('.p-hero')?.getAttribute('data-family'),'orientation');
});
