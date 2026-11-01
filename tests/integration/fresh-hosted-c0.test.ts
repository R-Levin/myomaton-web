import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { Pool } from "pg";
import { disposableCluster } from "../../scripts/backup/disposable-cluster";
import { managedEnvironment } from "../helpers/managed-postgres";
import { initializeFreshHostedC0 } from "../../scripts/customer-initializers/fresh-hosted-miopages-c0";
import { initializeMioPages,manifest } from "../../scripts/customer-initializers/miopages-c0";
import { manageHostname } from "../../scripts/db/managed-hostname";
import { readCustomerState,stateFingerprint } from "../../lib/platform/customer-initialization";
import { resolveTenant,UnavailableHostname } from "../../lib/platform/managed-sites/hostname";
import ownership from "../../scripts/backup/application-ownership.json";
import { qualified } from "../../scripts/backup/managed-permissions";

for(const major of [17,18])test(`PG${major} fresh-hosted C0 and independent hostname operator contracts`,{skip:!process.env[`PG${major}_BIN_DIR`],timeout:180000},async t=>{
  const cluster=await disposableCluster(process.env[`PG${major}_BIN_DIR`]!);
  const env=await managedEnvironment(cluster.url,true),migration=new Pool({connectionString:env.urls.migration}),runtime=new Pool({connectionString:env.urls.runtime});
  const config={databaseUrl:env.urls.migration,databaseName:new URL(cluster.url).pathname.slice(1),roles:env.roles};
  const binding={hostname:"runtime.miopages.com",webPresenceId:manifest.webPresenceId,managedSiteId:manifest.managedSiteId};
  const cli=(file:string,extra:Record<string,string>)=>{
    const result=spawnSync(process.execPath,["--import","tsx",file],{windowsHide:true,encoding:"utf8",env:{...process.env,DATABASE_URL:config.databaseUrl,MIOPAGES_DATABASE_NAME:config.databaseName,MIOPAGES_RUNTIME_ROLE:config.roles.runtime,MIOPAGES_MIGRATION_ROLE:config.roles.migration,MIOPAGES_BACKUP_ROLE:config.roles.backup,...extra}});
    assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
  };
  const capture=async()=>{
    const rows=[];for(const table of ownership.tables)rows.push({table,rows:(await env.admin.query(`SELECT to_jsonb(t) row,xmin::text xmin FROM ${qualified(table)} t ORDER BY to_jsonb(t)::text`)).rows});return rows;
  };
  const check=async(name:string,work:()=>Promise<void>)=>{let failure:unknown;await t.test(name,async()=>{try{await work();}catch(e){failure=e;throw e;}});if(failure)throw failure;};
  try{
    const original=await capture();
    await check("historical baseline remains guarded and runtime cannot take journal SHARE lock",async()=>{
      await assert.rejects(initializeMioPages(migration),/baseline drift/);
      const c=await runtime.connect();try{await c.query("BEGIN");await assert.rejects(c.query("LOCK TABLE drizzle.__drizzle_migrations IN SHARE MODE"));}finally{await c.query("ROLLBACK");c.release();}
      await assert.rejects(initializeFreshHostedC0({...config,databaseUrl:env.urls.runtime},"create"));
      await assert.rejects(initializeFreshHostedC0(config,"verify"));await assert.rejects(manageHostname(config,"bind",binding));
      assert.deepEqual(await capture(),original);
    });
    await check("15 migrations, changed hash/order and invalid PG17 receipt refuse without writes",async()=>{
      const last=(await env.admin.query("SELECT * FROM drizzle.__drizzle_migrations ORDER BY id DESC LIMIT 1")).rows[0];
      await env.admin.query("DELETE FROM drizzle.__drizzle_migrations WHERE id=$1",[last.id]);
      try{await assert.rejects(initializeFreshHostedC0(config,"create"));}finally{await env.admin.query("INSERT INTO drizzle.__drizzle_migrations(id,hash,created_at) VALUES($1,$2,$3)",[last.id,last.hash,last.created_at]);}
      await env.admin.query("UPDATE drizzle.__drizzle_migrations SET hash='invalid' WHERE id=$1",[last.id]);
      try{await assert.rejects(initializeFreshHostedC0(config,"create"));}finally{await env.admin.query("UPDATE drizzle.__drizzle_migrations SET hash=$2 WHERE id=$1",[last.id,last.hash]);}
      await env.admin.query("UPDATE drizzle.__drizzle_migrations SET id=-id");
      try{await assert.rejects(initializeFreshHostedC0(config,"create"));}finally{await env.admin.query("UPDATE drizzle.__drizzle_migrations SET id=-id");}
      if(major===17){const comment=(await env.admin.query("SELECT obj_description('drizzle.__drizzle_migrations'::regclass,'pg_class') comment")).rows[0].comment;
        await env.admin.query("COMMENT ON TABLE drizzle.__drizzle_migrations IS NULL");try{await assert.rejects(initializeFreshHostedC0(config,"create"));}finally{await env.admin.query("COMMENT ON TABLE drizzle.__drizzle_migrations IS '"+String(comment).replaceAll("'","''")+"'");}}
      // MVCC versions changed during deliberate drift controls; logical state did not.
      for(const row of await capture())assert.deepEqual(row.rows.map(r=>r.row),original.find(r=>r.table===row.table)!.rows.map(r=>r.row));
    });
    await check("foreign and partial customer graphs refuse; forced late failures roll back all content",async()=>{
      for(const id of [randomUUID(),manifest.organizationId]){
        await env.admin.query("INSERT INTO organizations(id,name) VALUES($1,'Synthetic partial/foreign')",[id]);
        try{await assert.rejects(initializeFreshHostedC0(config,"create"));}finally{await env.admin.query("DELETE FROM organizations WHERE id=$1",[id]);}
      }
      const before=await capture();for(const failAfter of [1,35,36,37]){await assert.rejects(initializeFreshHostedC0(config,"create",{failAfter}),/Forced/);assert.deepEqual(await capture(),before);}
    });
    await check("concurrent first run creates exact reviewed C0; exact rerun and independent verify write nothing",async()=>{
      const results=await Promise.all([initializeFreshHostedC0(config,"create"),initializeFreshHostedC0(config,"create")]);
      assert.equal(results.filter(r=>r.inserted>0).length,1);assert.equal(results.filter(r=>r.inserted===0).length,1);
      const c=await migration.connect();let state;try{await c.query("BEGIN READ ONLY; SET LOCAL TIME ZONE 'UTC'");state=await readCustomerState(c);}finally{await c.query("ROLLBACK");c.release();}
      for(const [table,count]of Object.entries({organizations:1,web_presences:1,managed_sites:1,design_systems:1,pages:4,sections:19,actions:3,navigations:1,navigation_items:3,business_knowledge:1,business_knowledge_revisions:1,offerings:1,offering_revisions:1}))assert.equal(state[table].length,count,table);
      const before=await capture();for(const operation of ["create","verify"] as const){const result=await initializeFreshHostedC0(config,operation);assert.equal(result.inserted,0);assert.equal(result.updated,0);assert.deepEqual(await capture(),before);}
      for(const action of ["create","verify"]){const result=cli("scripts/initialize-fresh-hosted-miopages-c0.ts",{MIOPAGES_DATABASE_OPERATION:"fresh-hosted-c0",MIOPAGES_C0_ACTION:action});assert.equal(result.inserted,0);assert.equal(result.updated,0);assert.deepEqual(await capture(),before);}
      assert.equal((await env.admin.query("SELECT value FROM provider_marker")).rows[0].value,"provider infrastructure, not app data");
      assert.ok(stateFingerprint(state));
    });
    await check("custom content, forged context receipt and unrelated operational data refuse rather than repair",async()=>{
      const page=manifest.rows.pages[0];await env.admin.query("UPDATE pages SET title='Customized' WHERE id=$1",[page.id]);
      try{await assert.rejects(initializeFreshHostedC0(config,"create"));}finally{await env.admin.query("UPDATE pages SET title=$2 WHERE id=$1",[page.id,page.title]);}
      const metadata=(await env.admin.query("SELECT metadata FROM organizations WHERE id=$1",[manifest.organizationId])).rows[0].metadata;
      await env.admin.query("UPDATE organizations SET metadata=jsonb_set(metadata,'{initialization,lineageDigest}','\"forged\"') WHERE id=$1",[manifest.organizationId]);
      try{await assert.rejects(initializeFreshHostedC0(config,"verify"));}finally{await env.admin.query("UPDATE organizations SET metadata=$2 WHERE id=$1",[manifest.organizationId,metadata]);}
      await env.admin.query("UPDATE drizzle.__drizzle_migrations SET id=id+1000");
      try{await assert.rejects(initializeFreshHostedC0(config,"verify"),/receipt mismatch/);}finally{await env.admin.query("UPDATE drizzle.__drizzle_migrations SET id=id-1000");}
      await env.admin.query("INSERT INTO subject_types(name,key) VALUES('Unexpected synthetic','unexpected-synthetic')");
      try{await assert.rejects(initializeFreshHostedC0(config,"create"));}finally{await env.admin.query("DELETE FROM subject_types WHERE key='unexpected-synthetic'");}
    });
    await check("separate hostname bind/verify is exact, active-owner-only, idempotent and fail-closed for unknown hosts",async()=>{
      const bound=await Promise.all([manageHostname(config,"bind",binding),manageHostname(config,"bind",binding)]);
      assert.equal(bound.filter(r=>r.inserted===1).length,1);assert.equal(bound.filter(r=>r.inserted===0).length,1);
      const before=await capture();assert.equal((await manageHostname(config,"bind",binding)).inserted,0);assert.equal((await manageHostname(config,"verify",binding)).inserted,0);assert.deepEqual(await capture(),before);
      for(const action of ["bind","verify"]){const result=cli("scripts/manage-hostname-binding.ts",{MIOPAGES_DATABASE_OPERATION:"managed-hostname",MIOPAGES_HOSTNAME_ACTION:action,MIOPAGES_HOSTNAME:binding.hostname,MIOPAGES_WEB_PRESENCE_ID:binding.webPresenceId,MIOPAGES_MANAGED_SITE_ID:binding.managedSiteId});assert.equal(result.inserted,0);assert.deepEqual(await capture(),before);}
      const mode={NODE_ENV:"production",MIOPAGES_ROUTING_MODE:"shared-hostnames"};
      assert.equal((await resolveTenant(runtime,new Headers({host:binding.hostname}),mode)).managedSiteId,manifest.managedSiteId);
      await assert.rejects(resolveTenant(runtime,new Headers({host:"unknown.miopages.test"}),mode),UnavailableHostname);
      await assert.rejects(manageHostname(config,"bind",{...binding,managedSiteId:randomUUID()}));
      await env.admin.query("UPDATE managed_sites SET status='inactive' WHERE id=$1",[manifest.managedSiteId]);
      try{await assert.rejects(manageHostname(config,"bind",binding));}finally{await env.admin.query("UPDATE managed_sites SET status='active' WHERE id=$1",[manifest.managedSiteId]);}
      await env.admin.query("UPDATE managed_site_hostnames SET status='inactive' WHERE hostname=$1",[binding.hostname]);
      try{await assert.rejects(manageHostname(config,"bind",binding));await assert.rejects(manageHostname(config,"verify",binding));}finally{await env.admin.query("UPDATE managed_site_hostnames SET status='active' WHERE hostname=$1",[binding.hostname]);}
      const org=randomUUID(),presence=randomUUID(),site=randomUUID();
      await env.admin.query("INSERT INTO organizations(id,name) VALUES($1,'Foreign target')",[org]);await env.admin.query("INSERT INTO web_presences(id,organization_id,name) VALUES($1,$2,'Foreign target')",[presence,org]);await env.admin.query("INSERT INTO managed_sites(id,web_presence_id,name) VALUES($1,$2,'Foreign target')",[site,presence]);
      try{await assert.rejects(manageHostname(config,"bind",{...binding,webPresenceId:presence,managedSiteId:site}));await assert.rejects(manageHostname(config,"bind",{...binding,hostname:"wrong-owner.example",managedSiteId:site}));}
      finally{await env.admin.query("DELETE FROM managed_sites WHERE id=$1",[site]);await env.admin.query("DELETE FROM web_presences WHERE id=$1",[presence]);await env.admin.query("DELETE FROM organizations WHERE id=$1",[org]);}
      await assert.rejects(initializeFreshHostedC0(config,"create"),/operational/);
    });
  }finally{await runtime.end();await migration.end();await env.admin.end();await cluster.stop();}
});
