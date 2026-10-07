import assert from "node:assert/strict";
import {test} from "node:test";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {readMigrationFiles} from "drizzle-orm/migrator";
import {baseline,manifest,initializeMioPages} from "../../scripts/customer-initializers/miopages-c0";
import {initializeCustomer,readCustomerState,stateFingerprint,customerTables} from "../../lib/platform/customer-initialization";
import {startProductionFixture} from "./production-server";
import {assetRoot} from "../../lib/platform/assets/local-storage";
import {JSDOM} from "jsdom";

test("MioPages guarded establishment, rollback, refusal and isolated four-route rendering",async t=>{
  assert.ok(process.env.ASSET_TEST_DATABASE_URL);
  const schema=`canonical_test_${randomUUID().replaceAll("-","")}_miopages`;
  const admin=new Pool({connectionString:process.env.ASSET_TEST_DATABASE_URL});
  const p=new Pool({connectionString:process.env.ASSET_TEST_DATABASE_URL,options:`-c search_path=${schema}`});
  const quoted=`"${schema}"`;const servers:Awaited<ReturnType<typeof startProductionFixture>>[]=[];
  const scoped={connect:async()=>{const c=await p.connect();return {release:()=>c.release(),query:(sql:string,values?:unknown[])=>c.query(sql.replaceAll("drizzle.__drizzle_migrations",`${quoted}.migration_fixture`),values)};}} as unknown as Pool;
  const read=async()=>{const c=await scoped.connect();try{await c.query("BEGIN READ ONLY");await c.query("SET LOCAL TIME ZONE 'UTC'");return await readCustomerState(c);}finally{await c.query("ROLLBACK");c.release();}};
  try {
    await admin.query(`CREATE SCHEMA ${quoted}`);
    const c=await p.connect();try{await c.query("BEGIN");for(const migration of readMigrationFiles({migrationsFolder:"lib/platform/db/migrations"}))for(const sql of migration.sql)await c.query(sql.replaceAll('"public".',`${quoted}.`));await c.query("COMMIT");}catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
    await p.query(`CREATE TABLE migration_fixture (LIKE drizzle.__drizzle_migrations INCLUDING ALL)`);
    const order=["organizations","subject_types","web_presences","managed_sites","pages","sections","actions","navigations","navigation_items","assets","asset_usages","design_systems","subjects","contact_definitions","contact_submissions","business_knowledge","offerings","business_knowledge_revisions","offering_revisions","migrations"];
    for(const table of order)for(const row of baseline[table]){const target=table==="migrations"?"migration_fixture":table;await p.query(`INSERT INTO ${target} SELECT * FROM jsonb_populate_record(NULL::${target},$1::jsonb)`,[JSON.stringify(row)]);}
    assert.equal(stateFingerprint(await read()),stateFingerprint(baseline));
    await t.test("forced failures roll back ordinary graph and canonical revisions",async()=>{for(const failAfter of [1,35,36,37]){await assert.rejects(initializeMioPages(scoped,{failAfter}),/Forced/);assert.equal(stateFingerprint(await read()),stateFingerprint(baseline));}});
    await t.test("partial state, foreign references and existing customer drift refuse",async()=>{
      const foreign=structuredClone(manifest);foreign.rows.actions[0].destination=baseline.pages[0].id;await assert.rejects(initializeCustomer(scoped,foreign,baseline));
      assert.equal(stateFingerprint(await read()),stateFingerprint(baseline));
      await p.query("INSERT INTO organizations(id,name) VALUES($1,'MioPages')",[manifest.organizationId]);await assert.rejects(initializeMioPages(scoped));await p.query("DELETE FROM organizations WHERE id=$1",[manifest.organizationId]);
      await p.query("UPDATE organizations SET name='Customized' WHERE id=$1",[baseline.organizations[0].id]);await assert.rejects(initializeMioPages(scoped),/baseline drift/);await p.query("UPDATE organizations SET name=$2 WHERE id=$1",[baseline.organizations[0].id,baseline.organizations[0].name]);
    });
    await t.test("exact first application and receipt-protected rerun",async()=>{
      assert.deepEqual(await initializeMioPages(scoped),{inserted:38,updated:1,deleted:0});
      const state=await read();assert.deepEqual(await initializeMioPages(scoped),{inserted:0,updated:0,deleted:0});assert.equal(stateFingerprint(await read()),stateFingerprint(state));
      await p.query("UPDATE pages SET title='Customized' WHERE id=$1",[manifest.rows.pages[0].id]);await assert.rejects(initializeMioPages(scoped));await p.query("UPDATE pages SET title=$2 WHERE id=$1",[manifest.rows.pages[0].id,manifest.rows.pages[0].title]);
      await p.query("UPDATE pages SET updated_at=updated_at+interval '1 second' WHERE id=$1",[manifest.rows.pages[0].id]);await assert.rejects(initializeMioPages(scoped),/Customized/);await p.query("UPDATE pages SET updated_at=updated_at-interval '1 second' WHERE id=$1",[manifest.rows.pages[0].id]);
      for(const table of customerTables)for(const original of baseline[table])assert.ok((await read())[table].some(row=>JSON.stringify(row)===JSON.stringify(original)),`${table} preserved`);
    });
    await t.test("MioPages and Myomaton render independently without cross-customer leakage",async()=>{
      const mio=await startProductionFixture(process.env.ASSET_TEST_DATABASE_URL!,schema,assetRoot(),manifest);servers.push(mio);
      const myo=await startProductionFixture(process.env.ASSET_TEST_DATABASE_URL!,schema,assetRoot(),{webPresenceId:String(baseline.web_presences[0].id),managedSiteId:String(baseline.managed_sites[0].id)});servers.push(myo);
      for(const [route,count]of [["/",4],["/service",6],["/experience",4],["/review",4]] as const){const response=await fetch(mio.base+route);assert.equal(response.status,200);const html=await response.text(),doc=new JSDOM(html).window.document;
        assert.match(doc.title,/MioPages/);assert.doesNotMatch(html,/Myomaton|TaBot|A-Bot|\$1,095|\$249/);assert.equal(doc.querySelectorAll("main > section").length,count);assert.equal(doc.querySelectorAll("img,form").length,0);
        assert.deepEqual([...doc.querySelectorAll('nav[aria-label="Primary Navigation"] a')].map(a=>a.getAttribute("href")),["/service","/experience","/review"]);
        for(const link of doc.querySelectorAll("main a"))assert.ok(["/service","/experience","/review"].includes(link.getAttribute("href")!));
        if(route==="/service")for(const name of ["Standard Launch","Expanded Launch","Ongoing"])assert.match(doc.body.textContent!,new RegExp(name));
        if(route==="/review")assert.match(doc.body.textContent!,/No Review request form or operational Review workflow/);
      }
      assert.equal((await fetch(mio.base+"/unknown")).status,404);assert.equal((await fetch(mio.base+"/api/contact",{method:"POST"})).status,503);
      for(const asset of baseline.assets)assert.equal((await fetch(mio.base+`/media/assets/${asset.id}`)).status,404);
      for(const route of ["/","/about","/projects","/principles"]){const response=await fetch(myo.base+route);assert.equal(response.status,200);const html=await response.text();assert.match(html,/data-visual-version="2"/);assert.doesNotMatch(html,/MioPages/);}
    });
  }finally{for(const server of servers)await server.stop();await p.end();await admin.query(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`);await admin.end();}
});
