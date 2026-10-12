import assert from "node:assert/strict";
import accepted from "./miopages-c0-accepted.json";
import reviewed from "../customer-updates/miopages-focus-reviewed.json";
import { stateFingerprint, type CustomerState } from "../../lib/platform/customer-initialization";
import { normalizeKnowledge, normalizeOffering } from "../../lib/platform/canonical/model";
import { normalizeSection } from "../../lib/platform/managed-sites/sections";
import { resolvePlan, validateDirection } from "../../lib/platform/presentation/plan";

export { accepted };
export const acceptedHero = "Help the right people find you online. Make contacting you a breeze.";
export const c0Actor = "operator:accepted-miopages-c0-preview";
export const c0Navigation = accepted.navigation.map(n=>[n.label,n.route]);
type Row = Record<string,unknown>;
type C0Section = Row & {id:string;type:string;content:Row;configuration:Row};

// Curated customer-content fixture, not an applied database snapshot. No IO or real writer.
export function acceptedRevamp(owned:CustomerState,at:string) {
 assert.equal(stateFingerprint(owned),stateFingerprint(reviewed.after),"Current canonical MioPages baseline required");
 const next=structuredClone(owned);
 const metadata=(old:unknown)=>({...old as object,c0Preview:{at,actor:c0Actor,humanAcceptedForStage:true,publicationAuthorized:false}});
 const row=(base:Row,definition:Row,old?:Row):Row=>({...base,...definition,version:old?Number(old.version)+1:1,created_at:old?.created_at??at,updated_at:at,metadata:metadata(old?.metadata)});
 next.pages=accepted.pages.map(p=>{
  const {sections:ignored,...definition}=p;void ignored;
  const old=owned.pages.find(old=>old.id===p.id);
  return row(old??owned.pages[0],definition,old);
 });
 const page=(route:string)=>{const p=next.pages.find(p=>p.slug===route);assert.ok(p);return p;};
 // Preserve canonical identities no longer displayed as inactive history, without replaying obsolete slices.
 next.sections=owned.sections.map(s=>row(s,{status:"inactive"},s));
 for(const p of accepted.pages) for(const definition of p.sections) {
  const old=owned.sections.find(s=>s.id===definition.id),s=row(old??owned.sections[0],{...definition,page_id:p.id,status:"active"},old);
  const i=next.sections.findIndex(r=>r.id===s.id);if(i<0)next.sections.push(s);else next.sections[i]=s;
 }
 next.actions=structuredClone(owned.actions);
 for(const definition of accepted.actions) {
  const {route,...fields}=definition,old=owned.actions.find(a=>a.id===fields.id);
  const a=row(old??owned.actions[0],{...fields,status:"active",destination:page(route).id},old);
  const i=next.actions.findIndex(r=>r.id===a.id);if(i<0)next.actions.push(a);else next.actions[i]=a;
 }
 next.navigation_items=owned.navigation_items.map(n=>row(n,{status:"inactive"},n));
 for(const definition of accepted.navigation) {
  const {route,...fields}=definition,old=owned.navigation_items.find(n=>n.id===fields.id);
  const n=row(old??owned.navigation_items[0],{...fields,status:"active",target_reference:page(route).id},old);
  const i=next.navigation_items.findIndex(r=>r.id===n.id);if(i<0)next.navigation_items.push(n);else next.navigation_items[i]=n;
 }
 const sections=next.sections.map(s=>{
  assert.equal(typeof s.id,"string");assert.equal(typeof s.type,"string");
  assert.ok(s.content&&typeof s.content==="object");assert.ok(s.configuration&&typeof s.configuration==="object");
  return s as C0Section;
 });
 const direction=validateDirection((owned.managed_sites[0].configuration as Row).visualDirection);
 for(const p of next.pages.filter(p=>p.status==="active")) {
  const visible=sections.filter(s=>s.page_id===p.id&&s.status==="active").sort((a,b)=>Number(a.sort_order)-Number(b.sort_order));
  assert.ok(visible.every(s=>normalizeSection(s)));resolvePlan(direction,p.configuration,visible,true,true);
 }
 return {pages:next.pages,sections,actions:next.actions,navigationItems:next.navigation_items,
  business:{knowledge:normalizeKnowledge(structuredClone(accepted.business.knowledge)),offering:normalizeOffering(structuredClone(accepted.business.offering))}};
}
