import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { customerTables, readCustomerState, stateFingerprint } from "../../lib/platform/customer-initialization";
import { recoveryCatalog } from "../../scripts/backup/catalog";
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Explicit, freshly restored private cluster only: never a shared migration target.
test("standard Drizzle migrator upgrades an owned private copy from nine to eleven rows and reruns without writes", async () => {
  const connectionString=process.env.ORDERED_MIGRATION_TEST_DATABASE_URL;
  assert.ok(connectionString,"Explicit isolated rehearsal URL required");
  const url=new URL(connectionString);
  assert.equal(url.hostname,"127.0.0.1");assert.notEqual(url.port,"5432");
  assert.match(url.pathname,/^\/migration_rehearsal_[a-f0-9]{32}$/);
  const pool=new Pool({connectionString});
  // Pin this historical 0009→0010 rehearsal; later migrations have separate proofs.
  const folder=await mkdtemp(path.join(tmpdir(),"ordered-migration-prefix-"));
  const domains=["external_work","external_work_events","media_candidates","prospect_intakes","prospect_intake_submissions"];
  const snapshot=async()=>{
    const c=await pool.connect();
    try {
      await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await c.query("SET LOCAL search_path=public");await c.query("SET LOCAL TIME ZONE 'UTC'");
      const state=await readCustomerState(c),tables=[];
      for(const r of (await c.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','drizzle') ORDER BY schemaname,tablename")).rows){
        const rows=(await c.query(`SELECT to_jsonb(t) row FROM "${r.schemaname}"."${r.tablename}" t ORDER BY to_jsonb(t)::text`)).rows.map(r=>r.row);
        tables.push({...r,count:rows.length,hash:stateFingerprint({rows})});
      }
      const sequence=(await c.query("SELECT last_value::text,is_called FROM drizzle.__drizzle_migrations_id_seq")).rows;
      const catalog=await recoveryCatalog(c,["public","drizzle"]);
      return {state,tables,sequence,catalog,customers:stateFingerprint(Object.fromEntries(customerTables.map(t=>[t,state[t]])))};
    } finally {await c.query("ROLLBACK");c.release();}
  };
  try {
    const before=await snapshot();assert.equal(before.state.migrations.length,9);assert.ok(before.state.web_presences.length>0);
    for(const name of domains)assert.equal((await pool.query("SELECT to_regclass($1) p",["public."+name])).rows[0].p,null);
    const journal=JSON.parse(await readFile("lib/platform/db/migrations/meta/_journal.json","utf8"));
    journal.entries=journal.entries.slice(0,11);assert.equal(journal.entries.length,11);
    await mkdir(path.join(folder,"meta"));await writeFile(path.join(folder,"meta/_journal.json"),JSON.stringify(journal));
    for(const entry of journal.entries)await copyFile(path.join("lib/platform/db/migrations",entry.tag+".sql"),path.join(folder,entry.tag+".sql"));
    const migrations=readMigrationFiles({migrationsFolder:folder});assert.equal(migrations.length,11);
    const queries:string[]=[];
    const database=drizzle(pool,{logger:{logQuery(query){queries.push(query);}}});
    await migrate(database,{migrationsFolder:folder});
    const after=await snapshot();assert.equal(after.state.migrations.length,11);
    assert.deepEqual(after.state.migrations.slice(0,9),before.state.migrations);
    assert.deepEqual(after.state.migrations.map(r=>({hash:r.hash,at:Number(r.created_at)})),migrations.map(m=>({hash:m.hash,at:m.folderMillis})));
    assert.equal(after.customers,before.customers);
    for(const table of customerTables)assert.equal(stateFingerprint({rows:before.state[table]}),stateFingerprint({rows:after.state[table]}),table);
    for(const name of domains)assert.equal((await pool.query(`SELECT count(*)::int n FROM public."${name}"`)).rows[0].n,0);
    queries.length=0;
    await migrate(database,{migrationsFolder:folder});
    const rerun=await snapshot();
    assert.deepEqual(rerun.tables,after.tables);assert.deepEqual(rerun.sequence,after.sequence);
    assert.deepEqual(rerun.catalog,after.catalog);assert.deepEqual(rerun.state.migrations,after.state.migrations);
    assert.ok(queries.every(q=>!/^\s*(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE)\b/i.test(q)));
    assert.ok(queries.filter(q=>/^\s*CREATE\b/i.test(q)).every(q=>/CREATE\s+(SCHEMA|TABLE)\s+IF NOT EXISTS/i.test(q)));
    console.log(JSON.stringify({orderedMigratorProof:true,before:9,after:11,secondRunNoOp:true,customerOnlyFingerprint:after.customers,allFiveDomainTablesEmpty:true,migrationOrder:["0009_media_acquisition","0010_progressive_intake"]}));
  } finally {await pool.end();assert.equal(path.dirname(folder),path.resolve(tmpdir()));assert.match(path.basename(folder),/^ordered-migration-prefix-/);await rm(folder,{recursive:true,force:true});}
});
