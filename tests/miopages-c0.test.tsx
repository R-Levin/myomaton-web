import assert from "node:assert/strict";
import {test} from "node:test";
import {manifest} from "../scripts/customer-initializers/miopages-c0";
import {normalizeKnowledge,normalizeOffering,formatPrice,identityConfirmed} from "../lib/platform/canonical/model";
import {normalizeBinding} from "../lib/platform/canonical/projections";
test("reviewed C0 manifest has exactly the authorized neutral IA and real destinations",()=>{
  assert.deepEqual(manifest.rows.pages.map(r=>r.slug),["/","/service","/experience","/review"]);
  assert.equal(manifest.rows.sections.length,19);assert.equal(manifest.rows.actions.length,3);
  assert.deepEqual(manifest.rows.navigation_items.map(r=>r.label),["Service","Experience","Review"]);
  assert.deepEqual(manifest.rows.managed_sites[0].configuration,{});assert.deepEqual(manifest.rows.design_systems[0].configuration,{});
  assert.deepEqual(manifest.rows.web_presences[0].configuration,{business:{displayName:"MioPages"}});
  assert.ok(manifest.rows.actions.every(a=>a.type==="page" && manifest.rows.pages.some(p=>p.id===a.destination)));
  assert.ok(manifest.rows.sections.every(s=>s.type!=="contact"));
  for(const s of manifest.rows.sections){const content=s.content as Record<string,unknown>;if(content.source)normalizeBinding(content.source);}
});
test("C0 trusted knowledge and provisional commercial terms preserve authority boundaries",()=>{
  const k=normalizeKnowledge(manifest.knowledge.payload),o=normalizeOffering(manifest.offering.payload);
  assert.equal(k.entries.length,25);assert.ok(k.entries.every(e=>e.evidence.confirmation==="confirmed"));
  assert.ok(identityConfirmed(k.identityEvidence[0],{displayName:"MioPages"}));
  assert.deepEqual(o.components.map(c=>c.key),["standard-launch","expanded-launch","ongoing"]);
  assert.equal(o.components[0].pricing?.amount,109500);assert.equal(o.components[2].pricing?.amount,24900);
  assert.equal(o.components[1].pricing?.mode,"scope-confirmed");assert.equal(o.components[1].pricing?.amount,undefined);
  assert.ok(o.components.every(c=>c.pricing?.commercialStatus==="provisional-hypothesis" && c.pricing.approval.scope==="internal" && formatPrice(c.pricing)===null));
});
