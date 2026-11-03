#!/usr/bin/env node
/**
 * Read-only reviewed C0 v3 projection proof. Uses the *existing* canonical
 * projector; no database, secrets, hosting API, or public-site mutation.
 *
 * node --import tsx scripts/project-wordpress-c0-v3.ts
 * node --import tsx scripts/project-wordpress-c0-v3.ts --write
 *
 * Output deliberately cannot be consumed as a production release: approval,
 * asset-byte verification, and deployment gates are still missing.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { projectContent, normalizeBinding } from "../lib/platform/canonical/projections";
import { fingerprint } from "../lib/platform/canonical/model";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const frozen = JSON.parse(readFileSync(resolve(root, "scripts/customer-updates/miopages-focus-reviewed.json"), "utf8"));
const data = frozen.after;
const routes = ["/", "/service", "/experience", "/review"];
const counts = [5,8,5,5];
assert.equal(data.pages.length,4);
assert.equal(data.sections.length,23);
assert.equal(data.business_knowledge.length,1);
assert.equal(data.offerings.length,1);
const pageById = new Map(data.pages.map((p:any)=>[p.id,p]));
const actions = data.actions.map((a:any)=>{
  assert.equal(a.type,"page");
  const dest = pageById.get(a.destination) as any;
  assert.ok(dest,"Action destination must be an owned Page");
  return {id:a.id,label:a.label, pageId:a.destination,path:dest.slug};
});
const actionIds = new Set(actions.map((a:any)=>a.id));
const nav = data.navigation_items
  .filter((n:any)=>n.status==="active")
  .sort((a:any,b:any)=>a.sort_order-b.sort_order)
  .map((n:any)=>{
    assert.equal(n.target_type,"page");
    const target = pageById.get(n.target_reference) as any;
    assert.ok(target,"Navigation must target an owned Page");
    return {id:n.id,label:n.label,pageId:n.target_reference,path:target.slug};
  });
let projected=0;
const pages = routes.map((route,i)=>{
  const p = data.pages.find((x:any)=>x.slug===route);
  assert.ok(p);
  const sections = data.sections.filter((s:any)=>s.page_id===p.id).sort((a:any,b:any)=>a.sort_order-b.sort_order);
  assert.equal(sections.length,counts[i]);
  return {id:p.id,path:route,title:p.title,recipe:p.configuration.presentation.recipe,
    sections:sections.map((s:any)=>{
      let content=s.content;
      if (Object.hasOwn(content,"source")) {
        const binding=normalizeBinding(content.source);
        const source = binding.role==="knowledge"
          ? data.business_knowledge.find((r:any)=>r.id===binding.knowledgeId)
          : data.offerings.find((r:any)=>r.id===binding.offeringId);
        assert.ok(source && source.web_presence_id===frozen.target.webPresenceId,"Missing or foreign canonical source");
        content=projectContent(s.type,content,binding,source);
        assert.ok(content,`Public content projection refused: ${route} ${s.id}`);
        projected++;
      }
      // Actions must be canonical Page actions, not external and not fabricated forms.
      for(const field of ["actionId","secondaryActionId"]){
        const actionId=content?.[field];
        if(actionId!==undefined)assert.ok(actionIds.has(actionId),`Unresolved action ${field}`);
      }
      assert.ok(!JSON.stringify(content).includes("previewMedia"),"No preview media");
      return {id:s.id,order:s.sort_order,type:s.type,variant:s.variant,
        presentation:s.configuration.presentation,content};
    })};
});
assert.equal(projected,5);
assert.equal(pages.reduce((n,p)=>n+p.sections.length,0),23);
const fixture={
  schema:"miopages.wordpress.public-projection-fixture",version:1,publishable:false,
  source:{file:"scripts/customer-updates/miopages-focus-reviewed.json",sourceDigest:frozen.sourceDigest,
    accepted:"A Business in Focus / service-led v3",graphDigest:fingerprint({pages,actions,nav})},
  identity:frozen.target,
  design:{version:3,font:"Source Sans 3",configuration:data.design_systems[0].configuration},
  pages, actions, navigation:nav,
  assets:{state:"bytes-not-verified",roles:data.asset_usages.map((u:any)=>({role:u.role,assetId:u.asset_id}))},
  restrictions:{approvalNeeded:true,unresolvedVisualRoles:5,allowPreviewMedia:false,
    liveReviewWorkflow:false,pluginReleaseTransportNotYetImplemented:true}
};
const json=JSON.stringify(fixture,null,2)+"\n";
if(process.argv.slice(2).includes("--write")){
  const path=resolve(root,"docs/wordpress-c0-v3-public-projection-fixture.json");
  writeFileSync(path,json,"utf8");
  process.stdout.write(path+"\n");
}else process.stdout.write(JSON.stringify({pages:pages.map(p=>[p.path,p.sections.length]),projected,
  contentDigest:fixture.source.graphDigest,publishable:false})+"\n");
