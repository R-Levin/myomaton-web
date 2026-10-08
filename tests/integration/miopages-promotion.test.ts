import assert from "node:assert/strict";
import {test} from "node:test";
import {randomUUID} from "node:crypto";
import {mkdtemp} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {Pool} from "pg";
import {readMigrationFiles} from "drizzle-orm/migrator";
import {JSDOM} from "jsdom";
import {customerTables,readCustomerState,stateFingerprint,type CustomerState} from "../../lib/platform/customer-initialization";
import {customerGraph,otherCustomerState} from "../../lib/platform/customer-state";
import {snapshotPublic} from "../../scripts/customer-previews/disposable";
import {promoteMioPages,planPromotion,promotionChanges,review} from "../../scripts/customer-updates/miopages-focus";
import {loadSectionContext} from "../../lib/platform/content-editing/service";
import {describeTextFields,createEditorialDraft,editEditorialDraft} from "../../lib/platform/content-editing/authority";
import {startProductionFixture} from "./production-server";
test("guarded MioPages promotion, rollback, idempotence, real isolation and editorial-only drafts",async t=>{
 const url=process.env.ASSET_TEST_DATABASE_URL;assert.ok(url);
 const schema=`canonical_test_${randomUUID().replaceAll("-","")}_promotion`,quoted=`"${schema}"`,admin=new Pool({connectionString:url}),p=new Pool({connectionString:url,options:`-c search_path=${schema} -c timezone=UTC`});
 const root=await mkdtemp(path.join(os.tmpdir(),"miopages-promotion-test-"));let server:Awaited<ReturnType<typeof startProductionFixture>>|undefined;
 const wrapped={connect:async()=>{const c=await p.connect();return {release:()=>c.release(),query:(sql:string,v?:unknown[])=>c.query(sql.replaceAll("public.",`${quoted}.`).replaceAll("search_path=public",`search_path=${schema}`).replaceAll("drizzle.__drizzle_migrations",`${quoted}.migration_fixture`),v)};}} as unknown as Pool;
 const read=async()=>{const c=await wrapped.connect();try{return await readCustomerState(c);}finally{c.release();}};
 const realBefore=await snapshotPublic(admin),rest=otherCustomerState(realBefore,review.target);
 const baseline:CustomerState={migrations:realBefore.migrations,...Object.fromEntries(customerTables.map(table=>[table,[...rest[table],...(review.before as CustomerState)[table]]]))};
 try{
  assert.equal(stateFingerprint(baseline),review.completeBefore);
  await admin.query(`CREATE SCHEMA ${quoted}`);
  for(const migration of readMigrationFiles({migrationsFolder:"lib/platform/db/migrations"}))for(const sql of migration.sql)await p.query(sql.replaceAll('"public".',`${quoted}.`));
  await p.query("CREATE TABLE migration_fixture (LIKE drizzle.__drizzle_migrations INCLUDING ALL)");
  const order=["organizations","subject_types","web_presences","managed_sites","pages","sections","actions","navigations","navigation_items","assets","asset_usages","design_systems","subjects","contact_definitions","contact_submissions","business_knowledge","offerings","business_knowledge_revisions","offering_revisions","migrations"];
  for(const table of order)for(const row of baseline[table]){const target=table==="migrations"?"migration_fixture":table;await p.query(`INSERT INTO ${target} SELECT * FROM jsonb_populate_record(NULL::${target},$1::jsonb)`,[JSON.stringify(row)]);}
  await t.test("exact frozen baseline, drift refusal and deterministic bounded changes",()=>{
   assert.equal(planPromotion(baseline).changed,true);const changes=promotionChanges();assert.equal(changes.updates.length,28);assert.equal(changes.inserts.length,8);
   for(const table of ["pages","organizations"]){const changed=structuredClone(baseline);changed[table][0].name="Unexpected";assert.throws(()=>planPromotion(changed));}
   const migration=structuredClone(baseline);migration.migrations[0].hash="drift";assert.throws(()=>planPromotion(migration));
  });
  await t.test("first and final write failures roll back the complete transaction",async()=>{
   for(const failAfter of [1,36]){await assert.rejects(promoteMioPages(wrapped,{root,failAfter}),/Forced/);assert.equal(stateFingerprint(await read()),review.completeBefore);}
  });
  await t.test("promotion succeeds exactly once; all other rows and migrations remain exact",async()=>{
   const result=await promoteMioPages(wrapped,{root});assert.equal(result.updated,28);assert.equal(result.inserted,8);assert.equal(result.after,review.completeAfter);
   const state=await read();assert.equal(stateFingerprint(customerGraph(state,review.target)),stateFingerprint(review.after));assert.equal(stateFingerprint(otherCustomerState(state,review.target)),review.otherFingerprint);
   assert.equal((await promoteMioPages(wrapped,{root})).changed,false);assert.equal(stateFingerprint(await read()),review.completeAfter);
  });
  await t.test("owner-scoped text contracts and draft edits never mutate canonical or presentation state",async()=>{
   const scope={webPresenceId:review.target.webPresenceId,managedSiteId:review.target.managedSiteId};const editorial=review.after.sections.find(s=>!(s.content as Record<string,unknown>).source)!;
   const c=await loadSectionContext(p,scope,String(editorial.id)),f=describeTextFields(c).find(f=>f.path==="/heading")!;
   const draft=editEditorialDraft(c,createEditorialDraft(c),{scope,fieldId:f.id,value:"A wording-only draft",actor:"operator:test",reason:"Draft validation",expectedSequence:0,at:review.at});assert.equal(draft.published,false);assert.deepEqual(draft.configuration,c.configuration);
   await assert.rejects(loadSectionContext(p,{...scope,webPresenceId:"00000000-0000-4000-8000-000000000000"},String(editorial.id)),/foreign/);
   const bound=review.after.sections.find(s=>(s.content as Record<string,unknown>).source)!;const b=await loadSectionContext(p,scope,String(bound.id));assert.ok(describeTextFields(b).some(f=>f.sourceType==="canonical"));
   assert.equal(stateFingerprint(await read()),review.completeAfter);
  });
  await t.test("canonical production-safe rendering preserves v3 truth and refuses all unresolved artwork",async()=>{
   server=await startProductionFixture(url,schema,root,review.target);
   for(const [route,count]of [["/",5],["/service",8],["/experience",5],["/review",5]] as const){const response:Response=await fetch(server.base+route);assert.equal(response.status,200);const doc=new JSDOM(await response.text()).window.document;
    assert.ok(doc.querySelector('[data-grammar="service-led"][data-grammar-version="3"]'));assert.equal(doc.querySelectorAll("main > section").length,count);assert.equal(doc.querySelectorAll("[data-fpo-role],[data-layer],form,input,textarea").length,0);assert.equal(doc.querySelectorAll("img").length,2);assert.doesNotMatch(doc.body.textContent!,/\$1,095|\$249|Myomaton|TSG Performance|Ragan Design|Theia LLC/);if(route==="/service"){assert.equal(doc.querySelectorAll(".focus-continuity ol > li").length,2);assert.equal(doc.querySelectorAll(".focus-extension").length,1);} }
   assert.equal((await fetch(server.base+"/api/contact",{method:"POST"})).status,503);
   for(const asset of rest.assets)assert.equal((await fetch(server.base+`/media/assets/${asset.id}`)).status,404);
  });
 }finally{await server?.stop();await p.end();await admin.query(`DROP SCHEMA ${quoted} CASCADE`);assert.equal(stateFingerprint(await snapshotPublic(admin)),stateFingerprint(realBefore));await admin.end();}
});
