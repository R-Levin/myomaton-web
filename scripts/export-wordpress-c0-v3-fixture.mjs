#!/usr/bin/env node
// Read-only deterministic structural fixture for WordPress adapter design.
// Not a publishable release: bound content and managed asset bytes remain unresolved.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const frozen = JSON.parse(readFileSync(resolve(root, "scripts/customer-updates/miopages-focus-reviewed.json"), "utf8"));
const data = frozen.after;
assert.equal(data.pages.length, 4);
assert.equal(data.sections.length, 23);
const routes = ["/", "/service", "/experience", "/review"];
const expectedCounts = { "/": 5, "/service": 8, "/experience": 5, "/review": 5 };
const allowedTypes = new Set(["hero", "intro", "relationship", "collection", "cta"]);
const actions = Object.fromEntries(data.actions.map(a => [a.id, { label: a.label, destinationPageId: a.target_page_id ?? a.page_id ?? null }]));
const pages = routes.map(route => {
  const page = data.pages.find(p => p.slug === route);
  assert.ok(page, "missing route " + route);
  const sections = data.sections.filter(s => s.page_id === page.id).sort((a,b) => a.sort_order-b.sort_order);
  assert.equal(sections.length,expectedCounts[route]);
  return { id:page.id, path:route, title:page.title, recipe:page.configuration.presentation?.recipe ?? null,
    sections:sections.map(s => {
      assert.ok(allowedTypes.has(s.type), "unexpected section type");
      const bound = Object.hasOwn(s.content,"source");
      const content = bound ? { status:"requires-canonical-projection", bindingRole:s.content.source.role, contextHeading:s.content.contextHeading ?? null } : { status:"reviewed-inline", fields:s.content };
      return {id:s.id, order:s.sort_order, type:s.type, variant:s.variant, presentation:s.configuration.presentation ?? {}, content};
    }) };
});
assert.equal(pages.reduce((sum,p)=>sum+p.sections.length,0),23);
const fixture = {
  schema:"miopages.wordpress.structural-fixture", version:1, publishable:false,
  source:{kind:"reviewed-frozen-development-promotion",file:"scripts/customer-updates/miopages-focus-reviewed.json", digest:frozen.sourceDigest, acceptedDirection:"A Business in Focus / service-led v3"},
  identity:{organizationId:frozen.target.organizationId,webPresenceId:frozen.target.webPresenceId,managedSiteId:frozen.target.managedSiteId},
  design:{presentation:"service-led",version:3,designSystem:data.design_systems[0].configuration,font:"Source Sans 3", managedSitePresentation:data.managed_sites[0].configuration.presentation ?? null},
  pages, actions,
  navigation:{items:data.navigation_items.map(n=>({id:n.id,label:n.label,targetPageId:n.target_page_id ?? null,sortOrder:n.sort_order}))},
  assets:{status:"asset-bytes-not-included",approvedRoles:data.asset_usages.map(u=>({role:u.role,assetId:u.asset_id})),unresolvedMediaRoles:5},
  constraints:{notForPublicDeployment:true,noFpoOrUnapprovedMedia:true,noOperationalReviewForm:true,canonicalProjectionRequired:true,assetByteVerificationRequired:true,approvalAndAuthorizationRequired:true}
};
const out = JSON.stringify(fixture,null,2)+"\n";
if (process.argv[2] === "--write") {
  const target = resolve(root,"docs/wordpress-c0-v3-structural-fixture.json");
  writeFileSync(target,out,"utf8");
  process.stdout.write(target+"\n");
} else {
  process.stdout.write(JSON.stringify({sourceDigest:frozen.sourceDigest,pages:pages.map(p=>({path:p.path,sections:p.sections.length})),unresolvedSections:pages.flatMap(p=>p.sections).filter(s=>s.content.status!=="reviewed-inline").length,publishable:false})+"\n");
}
