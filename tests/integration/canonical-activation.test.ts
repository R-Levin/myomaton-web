import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdir,writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { activationFixture } from "../../scripts/activation/disposable";
import { intakeDatabaseUrl } from "../../scripts/intake/disposable";
import { intakeAnswersV2 } from "../helpers/intake";
import { ActivationService,inspectionText,type CaseInspection } from "../../lib/platform/activation/service";
import { localApprovedReviews } from "../../lib/platform/activation/review-source";
import { type CanonicalRequest } from "../../lib/platform/activation/canonical";
import { customerTables,readCustomerState,stateFingerprint } from "../../lib/platform/customer-initialization";
import { fingerprint } from "../../lib/platform/canonical/model";
import { schemaSignature } from "./schema-fidelity";

test("canonical activation: new-only atomic foundation, immutable source/binding and incomplete onboarding",async t=>{
  const url=process.env.ASSET_TEST_DATABASE_URL;assert.ok(url,"Disposable PostgreSQL URL required");
  const old={NODE_ENV:process.env.NODE_ENV,MIOPAGES_REVIEW_SYNTHESIS:process.env.MIOPAGES_REVIEW_SYNTHESIS};Object.assign(process.env,{NODE_ENV:"development",MIOPAGES_REVIEW_SYNTHESIS:"local-operator"});
  const f=await activationFixture(url),svc=f.service();
  const canonical=async()=>{const c=await f.pool.connect();try{return await readCustomerState(c)}finally{c.release()}};
  const identity=(suffix:string)=>({organizationName:"Confirmed Organization "+suffix,webPresenceName:"Confirmed Presence "+suffix,managedSiteName:"Confirmed Site "+suffix,confirmation:{reference:"Separate operator identity attestation "+suffix,confirmedAt:new Date().toISOString()}});
  const external={source:"agreement-order",reference:"synthetic-paid-order",confirmedAt:new Date().toISOString(),launchScope:"One focused Launch",ongoingScope:"Continuing care"};
  const prepare=async(intent:"FREE_REVIEW"|"DIRECT_START",withReview=false)=>{
    const a=await f.submit(intent,intakeAnswersV2()),review=withReview?await f.review(a.submission):undefined;
    const created=await svc.create(a.context,{requestId:randomUUID(),scope:a.scope,submissionId:a.submission.id,submissionDigest:a.submission.digest,...(review?{review:review.request}:{})});
    const context=f.grant(a.scope,["initialize-customer","inspect"]);
    return {...a,review,created,sourceContext:a.context,context};
  };
  const request=async(a:Awaited<ReturnType<typeof prepare>>,suffix:string):Promise<CanonicalRequest>=>{const plan=await svc.canonicalReadiness(a.context,a.created.id,a.scope);return {requestId:randomUUID(),expectedVersion:plan.caseVersion,expectedCustomerFingerprint:plan.customerStateFingerprint,identity:identity(suffix)}};
  try{
    const baseline=await canonical(),a=await prepare("FREE_REVIEW",true),rawReview=await a.review!.store.read();
    await t.test("pending commercial state is not authority; previous operator grants/actor strings and foreign scopes refuse",async()=>{
      const input={requestId:randomUUID(),expectedVersion:1,expectedCustomerFingerprint:stateFingerprint(await canonical()),identity:identity("A")};
      await assert.rejects(svc.initializeCanonicalCustomer(a.context,a.created.id,a.scope,input),/Commercial/);
      for(const ctx of [a.created.createdBy,undefined,a.sourceContext,f.grant(a.scope,["inspect","confirm-commercial"])] )await assert.rejects(svc.initializeCanonicalCustomer(ctx,a.created.id,a.scope,input),/authority/);
      const foreign={...a.scope,pendingCustomerId:randomUUID()};await assert.rejects(svc.initializeCanonicalCustomer(f.grant(foreign,["initialize-customer"]),a.created.id,foreign,input),/scope/);
      assert.equal(stateFingerprint(await canonical()),stateFingerprint(baseline));
    });
    await svc.update(a.sourceContext,a.created.id,a.scope,1,randomUUID(),"confirm-commercial",external);
    const input=await request(a,"A"),sourceRows=(await f.pool.query("SELECT to_jsonb(s) row FROM prospect_intake_submissions s ORDER BY id")).rows;
    await t.test("identity confirmation, stale case, canonical baseline and target-ID injection fail closed",async()=>{
      for(const identity of [{...input.identity,organizationName:""},{...input.identity,confirmation:{...input.identity.confirmation,reference:""}},{...input.identity,organizationId:baseline.organizations[0].id}])await assert.rejects(svc.initializeCanonicalCustomer(a.context,a.created.id,a.scope,{...input,identity}));
      await assert.rejects(svc.initializeCanonicalCustomer(a.context,a.created.id,a.scope,{...input,expectedVersion:1}),/Stale/);
      await assert.rejects(svc.initializeCanonicalCustomer(a.context,a.created.id,a.scope,{...input,expectedCustomerFingerprint:"0".repeat(64)}),/baseline changed/);
      const denied=f.grant(a.scope,["inspect","confirm-commercial"]);await assert.rejects(svc.initializeCanonicalCustomer(denied,a.created.id,a.scope,input),/authority/);
    });
    await t.test("transition revalidates exact approved Review and immutable source instead of trusting an old case flag",async()=>{
      const unapproved=new ActivationService(f.pool,f.authority,{async read(id,owner){const state=await localApprovedReviews.read(id,owner);return {...state,decisions:state.decisions.filter(e=>e.action!=="approve")}}});
      await assert.rejects(unapproved.initializeCanonicalCustomer(a.context,a.created.id,a.scope,input),/approved Review/);
      const corruptPool={connect:async()=>{const c=await f.pool.connect();return {release:()=>c.release(),query:async(sql:string,values?:unknown[])=>{const r=await c.query(sql,values);return sql.startsWith("SELECT s.*")?{...r,rows:r.rows.map(s=>({...s,intake_id:randomUUID()}))}:r}}}} as unknown as Pool;
      await assert.rejects(new ActivationService(corruptPool,f.authority,localApprovedReviews).initializeCanonicalCustomer(a.context,a.created.id,a.scope,input),/immutable source/);
      assert.equal(stateFingerprint(await canonical()),stateFingerprint(baseline));assert.equal((await svc.inspect(a.context,a.created.id,a.scope)).canonicalBinding,null);
    });
    let activated:CaseInspection;
    await t.test("Free Review transition creates exactly three inactive identity records; concurrent exact retries converge",async()=>{
      const results=await Promise.all([svc.initializeCanonicalCustomer(a.context,a.created.id,a.scope,input),svc.initializeCanonicalCustomer(a.context,a.created.id,a.scope,input)]);assert.deepEqual(results[0],results[1]);activated=results[0];
      assert.ok(activated.canonicalBinding);assert.equal(activated.version,3);assert.equal(activated.state.status,"AUTHORIZED_FOR_ONBOARDING");assert.deepEqual(activated.state.assessment,a.created.state.assessment);
      const b=activated.canonicalBinding,now=await canonical();
      for(const [table,id,name,parent]of [["organizations",b.organizationId,input.identity.organizationName,null],["web_presences",b.webPresenceId,input.identity.webPresenceName,b.organizationId],["managed_sites",b.managedSiteId,input.identity.managedSiteName,b.webPresenceId]] as const){const row=now[table].find(r=>r.id===id)!;assert.ok(row);assert.equal(row.name,name);assert.equal(row.status,"inactive");if(table==="web_presences"){assert.equal(row.organization_id,parent);assert.equal(row.primary_domain,null)}if(table==="managed_sites")assert.equal(row.web_presence_id,parent)}
      for(const table of customerTables){const ids=[b.organizationId,b.webPresenceId,b.managedSiteId];assert.equal(stateFingerprint({rows:now[table].filter(r=>!ids.includes(String(r.id)))}),stateFingerprint({rows:baseline[table]}),table)}
      assert.deepEqual((await f.pool.query("SELECT to_jsonb(s) row FROM prospect_intake_submissions s ORDER BY id")).rows,sourceRows);assert.equal(fingerprint(await a.review!.store.read()),fingerprint(rawReview));
      const reconnected=new Pool({connectionString:intakeDatabaseUrl(url,f.schema)});try{assert.deepEqual(await new ActivationService(reconnected,f.authority,localApprovedReviews).initializeCanonicalCustomer(a.context,a.created.id,a.scope,input),activated)}finally{await reconnected.end()}
    });
    await t.test("successful binding cannot be retargeted or replayed with changed identity or request",async()=>{
      await assert.rejects(svc.initializeCanonicalCustomer(a.context,a.created.id,a.scope,{...input,identity:identity("Other")}),/idempotency conflict/);
      await assert.rejects(svc.initializeCanonicalCustomer(a.context,a.created.id,a.scope,{...input,requestId:randomUUID()}),/already bound/);
      await assert.rejects(f.pool.query("UPDATE activation_customer_bindings SET organization_id=$2 WHERE case_id=$1",[a.created.id,baseline.organizations[0].id]),/immutable/);
      await assert.rejects(f.pool.query("DELETE FROM activation_customer_bindings WHERE case_id=$1",[a.created.id]),/immutable/);
      assert.equal((await f.pool.query("SELECT count(*)::int n FROM activation_case_events WHERE case_id=$1 AND operation='initialize-customer'",[a.created.id])).rows[0].n,1);
    });
    const b=await prepare("DIRECT_START");await svc.update(f.grant(b.scope,["confirm-commercial"]),b.created.id,b.scope,1,randomUUID(),"confirm-commercial",external);
    await t.test("Direct Start needs no Review; different-key concurrent operators create only one graph",async()=>{
      const first=await request(b,"B"),otherOperator=f.grant(b.scope,["initialize-customer","inspect"],"synthetic-second-operator"),results=await Promise.allSettled([svc.initializeCanonicalCustomer(b.context,b.created.id,b.scope,first),svc.initializeCanonicalCustomer(otherOperator,b.created.id,b.scope,{...first,requestId:randomUUID()})]);assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.ok(results.some(r=>r.status==="rejected"&&/already bound/.test(r.reason.message)));
      const current=await svc.inspect(b.context,b.created.id,b.scope);assert.equal(current.review,null);assert.ok(current.canonicalBinding);assert.equal(current.version,3);
    });
    const failure=await prepare("DIRECT_START");await svc.update(f.grant(failure.scope,["confirm-commercial"]),failure.created.id,failure.scope,1,randomUUID(),"confirm-commercial",external);const retry=await request(failure,"Rollback"),beforeFailure=await canonical();
    await t.test("initializer and later binding failures both roll back graph, event and binding; the same request retries safely",async()=>{
      await f.pool.query("CREATE FUNCTION synthetic_activation_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Forced synthetic activation failure'; END $$");
      try{
        for(const table of ["managed_sites","activation_customer_bindings"]){await f.pool.query(`CREATE TRIGGER synthetic_activation_failure BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION synthetic_activation_failure()`);try{await assert.rejects(svc.initializeCanonicalCustomer(failure.context,failure.created.id,failure.scope,retry),/Forced synthetic/);assert.equal(stateFingerprint(await canonical()),stateFingerprint(beforeFailure));const current=await svc.inspect(failure.context,failure.created.id,failure.scope);assert.equal(current.version,2);assert.equal(current.canonicalBinding,null)}finally{await f.pool.query(`DROP TRIGGER synthetic_activation_failure ON ${table}`)}}
      }finally{await f.pool.query("DROP FUNCTION synthetic_activation_failure()")}
      assert.ok((await svc.initializeCanonicalCustomer(failure.context,failure.created.id,failure.scope,retry)).canonicalBinding);
    });
    const orphan=await prepare("DIRECT_START");await svc.update(f.grant(orphan.scope,["confirm-commercial"]),orphan.created.id,orphan.scope,1,randomUUID(),"confirm-commercial",external);
    await t.test("database refuses an unpaired activation event and a binding to another customer's graph",async()=>{
      const current=await svc.inspect(orphan.context,orphan.created.id,orphan.scope),client=await f.pool.connect();
      const append=async()=>{const body={version:3,requestId:randomUUID(),requestDigest:"0".repeat(64),operation:"initialize-customer",actor:"synthetic-activation-operator",authorityReference:"disposable-proof-capability",at:new Date().toISOString(),previous:current.history.at(-1)!.digest,snapshot:current.state};await client.query("INSERT INTO activation_case_events(case_id,version,request_id,request_digest,operation,actor,authority_reference,at,previous,snapshot,digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",[current.id,body.version,body.requestId,body.requestDigest,body.operation,body.actor,body.authorityReference,body.at,body.previous,body.snapshot,fingerprint({caseId:current.id,...body})])};
      try{await client.query("BEGIN");await append();await assert.rejects(client.query("COMMIT"),/atomic binding/);await client.query("ROLLBACK");
        await client.query("BEGIN");await append();const original=activated!.canonicalBinding!;await assert.rejects(client.query("INSERT INTO activation_customer_bindings(case_id,organization_id,web_presence_id,managed_site_id,event_version,identity,identity_digest) VALUES($1,$2,$3,$4,3,$5,$6)",[current.id,original.organizationId,original.webPresenceId,original.managedSiteId,original.identity,original.identityDigest]),/mismatch|unique/);await client.query("ROLLBACK");
      }finally{await client.query("ROLLBACK");client.release()}
      assert.equal((await svc.inspect(orphan.context,orphan.created.id,orphan.scope)).version,2);
    });
    // Pin this historical proof to 0000–0012; proposal migration 0013 has its own rehearsal.
    await t.test("0012 ordered upgrade/fresh fidelity preserves populated canonical tables and old migration objects",async()=>{
      const schema=f.schema.replace("_intake","_binding"),q=`"${schema}"`,c=await f.pool.connect();try{await c.query("BEGIN");await c.query(`CREATE SCHEMA ${q}`);await c.query(`SET LOCAL search_path=${q}`);const migrations=readMigrationFiles({migrationsFolder:"lib/platform/db/migrations"}).slice(0,13);assert.equal(migrations.length,13);for(const m of migrations.slice(0,12))for(const sql of m.sql)await c.query(sql.replaceAll('"public".',`${q}.`));
        const order=["organizations","subject_types","web_presences","managed_sites",...customerTables.filter(t=>!["organizations","subject_types","web_presences","managed_sites"].includes(t))];for(const table of order)for(const row of f.before[table])await c.query(`INSERT INTO ${table} SELECT * FROM jsonb_populate_record(NULL::${table},$1::jsonb)`,[JSON.stringify(row)]);
        const original:Record<string,unknown>={};for(const table of customerTables)original[table]=(await c.query(`SELECT to_jsonb(t) row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
        for(const sql of migrations[12].sql)await c.query(sql.replaceAll('"public".',`${q}.`));for(const table of customerTables)assert.deepEqual((await c.query(`SELECT to_jsonb(t) row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows,original[table]);
        await c.query("SET LOCAL search_path=pg_catalog");assert.deepEqual(await schemaSignature(c,schema,["activation_customer_bindings","activation_case_events"]),await schemaSignature(c,f.schema,["activation_customer_bindings","activation_case_events"]));await c.query("ROLLBACK");
      }finally{await c.query("ROLLBACK");c.release()}
    });
    const example=await svc.inspect(a.context,a.created.id,a.scope);await mkdir("runtime-content/canonical-activation-proof",{recursive:true});await writeFile("runtime-content/canonical-activation-proof/synthetic-case.txt","SYNTHETIC DISPOSABLE PROOF; fixture removed after durable reread.\n"+inspectionText(example));
    await f.verify();
  }finally{await f.stop();Object.assign(process.env,old)}
});
