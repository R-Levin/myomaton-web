import assert from "node:assert/strict";
import {test} from "node:test";
import {randomUUID} from "node:crypto";
import {Client,Pool} from "pg";
import {readMigrationFiles} from "drizzle-orm/migrator";
import {schemaSignature} from "./schema-fidelity";
import {inspectCanonical,writeCanonical,type WriteInput} from "../../lib/platform/canonical/writes";
import {projectCanonicalSections} from "../../lib/platform/canonical/projections";
import {attachOfferingImage,offeringImages} from "../../lib/platform/canonical/media";
import {approval,knowledge,offering} from "../helpers/canonical";
import {managedKey} from "../../lib/platform/assets/local-storage";
import {acceptContactSubmission} from "../../lib/platform/contact/submissions";
import {prepareManagedBytes} from "../../lib/platform/assets/ingestion";
import {startProductionFixture} from "./production-server";
import {mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("canonical upgrade/fresh replay, scoped revisions, projections and two isolated deployments",async t=>{
  const url=process.env.ASSET_TEST_DATABASE_URL;assert.ok(url,"Disposable PostgreSQL URL required");
  const c=new Client({connectionString:url});await c.connect();
  const base=`canonical_test_${randomUUID().replaceAll("-","")}`,fresh=`${base}_fresh`,upgrade=`${base}_upgrade`;
  const quote=(s:string)=>{assert.match(s,/^canonical_test_[a-f0-9]{32}_(fresh|upgrade)$/);return `"${s}"`;};
  const migrations=readMigrationFiles({migrationsFolder:"lib/platform/db/migrations"});assert.equal(migrations.length,9);
  const replay=async(s:string,from:number,to:number)=>{await c.query("BEGIN");try{await c.query(`SET LOCAL search_path TO ${quote(s)}`);for(const m of migrations.slice(from,to))for(const sql of m.sql)await c.query(sql.replaceAll('"public".',`${quote(s)}.`));await c.query("COMMIT");}catch(e){await c.query("ROLLBACK");throw e;}};
  const real=async()=>{const state:Record<string,unknown>={};await c.query("BEGIN READ ONLY");try{await c.query("SET LOCAL TIME ZONE 'UTC'");const tables=(await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;for(const {tablename}of tables)state[tablename]=(await c.query(`SELECT to_jsonb(t) row FROM public."${tablename}" t ORDER BY to_jsonb(t)::text`)).rows;return state;}finally{await c.query("ROLLBACK");}};
  const before=await real();const root=await mkdtemp(path.join(os.tmpdir(),"canonical-media-"));let p:Pool|undefined;
  const servers:Awaited<ReturnType<typeof startProductionFixture>>[]=[];
  try{
    for(const s of [fresh,upgrade])await c.query(`CREATE SCHEMA ${quote(s)}`);
    await replay(upgrade,0,8);
    const copyOrder=["organizations","subject_types","web_presences","managed_sites","pages","sections","actions","navigations","navigation_items","assets","asset_usages","design_systems","subjects","contact_definitions","contact_submissions"];
    for(const table of copyOrder)for(const wrapped of before[table] as {row:unknown}[]) await c.query(`INSERT INTO ${quote(upgrade)}."${table}" SELECT * FROM jsonb_populate_record(NULL::${quote(upgrade)}."${table}",$1::jsonb)`,[JSON.stringify(wrapped.row)]);
    await replay(upgrade,8,9);await replay(fresh,0,9);
    await c.query("SET TIME ZONE 'UTC'");
    for(const table of copyOrder)assert.deepEqual((await c.query(`SELECT to_jsonb(t) row FROM ${quote(upgrade)}."${table}" t ORDER BY to_jsonb(t)::text`)).rows,before[table],`Upgrade preserves ${table}`);
    for(const table of ["business_knowledge","business_knowledge_revisions","offerings","offering_revisions"])assert.equal((await c.query(`SELECT count(*)::int n FROM ${quote(upgrade)}.${table}`)).rows[0].n,0,"No backfill");
    const names=["business_knowledge","business_knowledge_revisions","offerings","offering_revisions"];
    await c.query("BEGIN");await c.query("SET LOCAL search_path TO pg_catalog");assert.deepEqual(await schemaSignature(c,fresh,names),await schemaSignature(c,upgrade,names));await c.query("ROLLBACK");
    p=new Pool({connectionString:url,options:`-c search_path=${fresh}`,max:4});const pool=p;
    const fixture=async(name:string)=>{
      const org=(await pool.query("INSERT INTO organizations(name) VALUES($1) RETURNING id",[name])).rows[0].id;
      const wp=(await pool.query("INSERT INTO web_presences(organization_id,name,primary_domain) VALUES($1,$2,$3) RETURNING id",[org,name,`${randomUUID()}.test`])).rows[0].id;
      const site=(await pool.query("INSERT INTO managed_sites(web_presence_id,name,configuration) VALUES($1,$2,$3) RETURNING id",[wp,name,{visualDirection:{profileId:"reference",profileVersion:2}}])).rows[0].id;
      const page=(await pool.query("INSERT INTO pages(managed_site_id,slug,name,title) VALUES($1,'/','Home',$2) RETURNING id",[site,name])).rows[0].id;
      await pool.query("INSERT INTO design_systems(web_presence_id,name) VALUES($1,$2)",[wp,name]);
      return {webPresenceId:wp,managedSiteId:site,pageId:page};
    };
    const first=await fixture("Fixture One"),second=await fixture("Fixture Two");
    const oid=randomUUID(),kid=randomUUID();
    const input:WriteInput={domain:"offering",id:oid,webPresenceId:first.webPresenceId,expectedVersion:null,expectedFingerprint:null,payload:offering,offering:{key:"service",type:"service",name:"Fixture service",status:"active"},responsibleIdentity:approval.by,changeReason:"Approved initial fixture"};
    await t.test("atomic initial state, exact rerun and revision immutability",async()=>{
      assert.deepEqual(await writeCanonical(pool,input),{inserted:1,updated:0,revisions:1,version:1});
      const before=await inspectCanonical(pool,"offering",first.webPresenceId,oid);
      assert.deepEqual(await writeCanonical(pool,input),{inserted:0,updated:0,revisions:0,version:1});assert.deepEqual(await inspectCanonical(pool,"offering",first.webPresenceId,oid),before);
      await assert.rejects(pool.query("UPDATE offering_revisions SET change_reason='changed' WHERE offering_id=$1",[oid]),/immutable/);
      await assert.rejects(pool.query("DELETE FROM offering_revisions WHERE offering_id=$1",[oid]),/immutable/);
      await assert.rejects(pool.query("INSERT INTO offering_revisions(web_presence_id,offering_id,revision_version,snapshot,change_reason,responsible_identity) VALUES($1,$2,99,$3,'Bad snapshot','operator:test')",[first.webPresenceId,oid,{id:oid,web_presence_id:first.webPresenceId,version:1}]),/check/);
    });
    const knowledgeInput:WriteInput={...input,domain:"knowledge",id:kid,payload:knowledge,offering:undefined};
    await writeCanonical(pool,knowledgeInput);
    await t.test("knowledge correction preserves evidence and exact no-op history",async()=>{
      assert.equal((await writeCanonical(pool,knowledgeInput)).revisions,0);
      const current=(await inspectCanonical(pool,"knowledge",first.webPresenceId,kid))!;
      const next={...knowledgeInput,expectedVersion:1,expectedFingerprint:current.fingerprint,payload:{...knowledge,entries:[{...knowledge.entries[0],value:"Updated trusted audience",evidence:{...knowledge.entries[0].evidence,correction:"Customer correction"}}],approval:{...approval,at:"2026-10-06T12:01:00Z"}}};
      await assert.rejects(writeCanonical(pool,next,{failAfterCurrent:true}),/Forced/);
      assert.equal((await writeCanonical(pool,next)).version,2);
      assert.equal((await writeCanonical(pool,next)).revisions,0);
      assert.equal((await pool.query("SELECT count(*)::int n FROM business_knowledge_revisions WHERE knowledge_id=$1",[kid])).rows[0].n,2);
    });
    await t.test("foreign scope, references and optimistic conflict refuse",async()=>{
      await assert.rejects(writeCanonical(pool,{...input,webPresenceId:second.webPresenceId}),/Foreign/);
      await assert.rejects(writeCanonical(pool,{...input,id:randomUUID(),payload:{...offering,actionIds:[randomUUID()]}}),/Action/);
      await assert.rejects(writeCanonical(pool,{...input,payload:{...offering,summary:"Changed"}}),/Optimistic/);
      await assert.rejects(pool.query("INSERT INTO business_knowledge(web_presence_id,payload,version) VALUES($1,'{}',0)",[second.webPresenceId]),/check/);
      const customized={...input,id:randomUUID(),offering:{...input.offering!,key:"customized"}};
      await writeCanonical(pool,customized);
      await pool.query("UPDATE offerings SET name='Out-of-band change' WHERE id=$1",[customized.id]);
      await assert.rejects(writeCanonical(pool,customized),/partial or customized/);
    });
    await t.test("correction, forced rollback and concurrent version control",async()=>{
      const current=(await inspectCanonical(pool,"offering",first.webPresenceId,oid))!;
      const next={...input,expectedVersion:1,expectedFingerprint:current.fingerprint,payload:{...offering,summary:"Corrected summary",approval:{...approval,at:"2026-10-06T12:01:00Z"}}};
      await assert.rejects(writeCanonical(pool,next,{failAfterCurrent:true}),/Forced/);assert.deepEqual(await inspectCanonical(pool,"offering",first.webPresenceId,oid),current);
      const attempts=await Promise.allSettled([writeCanonical(pool,next),writeCanonical(pool,{...next,payload:{...next.payload,summary:"Competing summary"}})]);
      assert.equal(attempts.filter(r=>r.status==="fulfilled").length,1);
      assert.equal((await pool.query("SELECT count(*)::int n FROM offering_revisions WHERE offering_id=$1",[oid])).rows[0].n,2);
      const rows=(await pool.query("SELECT snapshot FROM offering_revisions WHERE offering_id=$1 ORDER BY revision_version",[oid])).rows;
      assert.equal(rows[0].snapshot.payload.summary,offering.summary);assert.equal(rows[1].snapshot.version,2);
    });
    const binding={role:"offering-overview",offeringId:oid};
    await t.test("projection reuses canonical values and refuses foreign/missing sources",async()=>{
      const sections=[{type:"intro",content:{source:binding}}];
      const projected=await projectCanonicalSections(pool,first.webPresenceId,sections);assert.equal(projected.length,1);assert.deepEqual(sections[0].content,{source:binding});
      assert.equal((await projectCanonicalSections(pool,second.webPresenceId,sections)).length,0);
      assert.equal((await projectCanonicalSections(pool,first.webPresenceId,[{type:"intro",content:{source:{...binding,offeringId:randomUUID()}}}])).length,0);
    });
    const bytes=(await prepareManagedBytes(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="green"/></svg>'))).bytes;
    const asset=randomUUID(),source=managedKey(bytes);
    await mkdir(path.join(root,first.webPresenceId,"objects"),{recursive:true});await writeFile(path.join(root,first.webPresenceId,source),bytes);
    await pool.query("INSERT INTO assets(id,web_presence_id,name,mime_type,width,height,alt_text,source_type,source_reference) VALUES($1,$2,'Evidence','image/svg+xml',100,100,'Fixture evidence','managed',$3)",[asset,first.webPresenceId,source]);
    await t.test("Offering image association is scoped, singular and idempotent",async()=>{
      const inspected=(await inspectCanonical(pool,"offering",first.webPresenceId,oid))!;
      const attach={webPresenceId:first.webPresenceId,offeringId:oid,assetId:asset,altText:"Approved fixture image",expectedVersion:inspected.row.version,expectedFingerprint:inspected.fingerprint,approval:{...approval,at:"2026-10-06T12:02:00Z"},changeReason:"Approved image association"};
      assert.deepEqual(await attachOfferingImage(pool,attach),{inserted:0,updated:1,revisions:1,version:3});assert.deepEqual(await attachOfferingImage(pool,attach),{inserted:0,updated:0,revisions:0,version:3});
      await assert.rejects(attachOfferingImage(pool,{...attach,webPresenceId:second.webPresenceId}),/Offering/);
      assert.equal((await offeringImages(pool,first.webPresenceId,first.managedSiteId)).size,0,"No rendered usage means no eligibility");
    });
    await pool.query("INSERT INTO sections(page_id,type,content,configuration,sort_order) VALUES($1,'hero',$2,'{}',0),($1,'intro',$3,'{}',1)",[first.pageId,{heading:"Fixture One",text:"Public fixture"},{source:binding}]);
    await pool.query("INSERT INTO sections(page_id,type,content) VALUES($1,'hero',$2)",[second.pageId,{heading:"Fixture Two",text:"Independent fixture"}]);
    await t.test("Contact service honors explicit UUID context and rejects foreign content",async()=>{
      const definition=(await pool.query("INSERT INTO contact_definitions(web_presence_id,name,configuration) VALUES($1,'Inquiry',$2) RETURNING id",[first.webPresenceId,{fields:[{key:"email",label:"Email",required:true}]}])).rows[0].id;
      const section=(await pool.query("INSERT INTO sections(page_id,type,content) VALUES($1,'contact',$2) RETURNING id",[first.pageId,{contact_definition_id:definition}])).rows[0].id;
      const input={sectionId:section,definitionId:definition,version:1,fields:{email:"visitor@example.test"},idempotencyKey:randomUUID()};
      const scope={...first,domain:"unused",managedSiteName:"unused"};
      assert.equal((await acceptContactSubmission(pool,scope,input,{abuse:{allow:async()=>true}})).accepted,true);
      await assert.rejects(acceptContactSubmission(pool,{...scope,...second},input,{abuse:{allow:async()=>true}}),/unavailable/);
    });
    await t.test("two production processes select independent customers and exact managed bytes",async()=>{
      const a=await startProductionFixture(url,fresh,root,first);servers.push(a);const b=await startProductionFixture(url,fresh,root,second);servers.push(b);
      const html=await(await fetch(a.base)).text();assert.match(html,/Fixture One/);assert.match(html,/Fixture service/);assert.doesNotMatch(html,/Fixture Two/);
      const other=await(await fetch(b.base)).text();assert.match(other,/Fixture Two/);assert.doesNotMatch(other,/Fixture service/);
      const image=await fetch(`${a.base}/media/assets/${asset}`);assert.equal(image.status,200);assert.deepEqual(Buffer.from(await image.arrayBuffer()),await readFile(path.join(root,first.webPresenceId,source)));
      assert.equal((await fetch(`${b.base}/media/assets/${asset}`)).status,404);
      assert.equal((await fetch(`${a.base}/unknown`)).status,404);
      assert.equal((await fetch(`${a.base}/api/contact`,{method:"POST"})).status,503);
      const invalid=await startProductionFixture(url,fresh,root,{webPresenceId:first.webPresenceId,managedSiteId:second.managedSiteId});servers.push(invalid);
      assert.equal((await fetch(invalid.base)).status,404);
      await pool.query("UPDATE managed_sites SET status='inactive' WHERE id=$1",[first.managedSiteId]);
      assert.equal((await fetch(a.base)).status,404);
      await pool.query("UPDATE managed_sites SET status='active' WHERE id=$1",[first.managedSiteId]);
    });
    assert.deepEqual(await real(),before,"No real customer state changes");
  }finally{for(const server of servers)await server.stop();await p?.end();for(const s of [fresh,upgrade])await c.query(`DROP SCHEMA IF EXISTS ${quote(s)} CASCADE`);await c.end();await rm(root,{recursive:true,force:true});}
});
