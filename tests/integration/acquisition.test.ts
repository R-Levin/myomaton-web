import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import sharp from "sharp";
import { JSDOM } from "jsdom";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { createPilot,disposablePool,assertRealPreserved } from "../../scripts/acquisition/disposable";
import { AcquisitionService,candidateSubject,type Candidate } from "../../lib/platform/acquisition/service";
import { loadNeed } from "../../lib/platform/acquisition/context";
import { AcquisitionFailure,ITERATION_TWO_TEMPLATE,type ImageProvider } from "../../lib/platform/acquisition/contracts";
import { acquiredHeroAssets,approvedCandidate } from "../../lib/platform/acquisition/eligibility";
import { ingestDisposable } from "../../lib/platform/acquisition/application";
import { deliverPublicAsset } from "../../lib/platform/assets/delivery";
import { readManagedObject } from "../../lib/platform/assets/local-storage";
import { fingerprint } from "../../lib/platform/canonical/model";
import { startProductionFixture } from "./production-server";
import { schemaSignature } from "./schema-fidelity";
import { escalatePilot } from "../../scripts/acquisition/escalation";

const url=process.env.ASSET_TEST_DATABASE_URL;
const bytesPromise=sharp({create:{width:1536,height:1024,channels:3,background:"#6843cf"}}).png().toBuffer();
function synthetic(execute?:ImageProvider["generateImage"]):ImageProvider {
  return {id:"synthetic-test",model:"fixture/1",assertConfigured(){},generateImage:execute??(async()=>({provider:"synthetic-test",model:"fixture/1",requestId:"fixture-request",bytes:await bytesPromise,width:1536,height:1024,mimeType:"image/png",usage:{},actualMicros:10,policy:"passed",generatedAt:new Date().toISOString()}))};
}
async function fixture(){
  const receipt=await createPilot(url!,1000,300),pool=disposablePool(url!,receipt.schema),service=new AcquisitionService(pool,receipt.quarantineRoot);
  const context=await loadNeed(pool,receipt.webPresenceId,receipt.sectionId);
  return {receipt,pool,service,context,owner:receipt.webPresenceId,async stop(){try{await assertRealPreserved(url!,receipt);}finally{await pool.end();const admin=new Pool({connectionString:url});try{await admin.query(`DROP SCHEMA "${receipt.schema}" CASCADE`);}finally{await admin.end();}}}};
}
test("operational migration fresh/upgrade fidelity and tenant/lifecycle/audit guards",{skip:!url},async()=>{
  const f=await fixture();const admin=new Pool({connectionString:url});const schema=`canonical_test_${randomUUID().replaceAll("-","")}_acquisition`;
  try{
    const c=await admin.connect();try{await c.query("BEGIN");await c.query(`CREATE SCHEMA "${schema}"`);await c.query(`SET LOCAL search_path="${schema}"`);
      const migrations=readMigrationFiles({migrationsFolder:"lib/platform/db/migrations"});for(const m of migrations.slice(0,-1))for(const sql of m.sql)await c.query(sql.replaceAll('"public".',`"${schema}".`));await c.query("COMMIT");
      await c.query("BEGIN");await c.query(`SET LOCAL search_path="${schema}"`);for(const sql of migrations.at(-1)!.sql)await c.query(sql.replaceAll('"public".',`"${schema}".`));await c.query("COMMIT");
      await c.query("SET search_path=pg_catalog");assert.deepEqual(await schemaSignature(c,schema,["external_work","media_candidates","external_work_events"]),await schemaSignature(c,f.receipt.schema,["external_work","media_candidates","external_work_events"]));
      const guards=await c.query("SELECT count(*)::integer AS count FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname IN ('external_work','media_candidates','external_work_events') AND NOT t.tgisinternal",[schema]);assert.equal(guards.rows[0].count,3);
    }finally{c.release();}
    const w=await f.service.create(f.context,synthetic(),1000);
    await assert.rejects(f.pool.query("UPDATE external_work SET status='completed',version=version+1 WHERE id=$1",[w.id]),/transition/);
    await assert.rejects(f.pool.query("UPDATE external_work SET status='failed' WHERE id=$1",[w.id]),/revision/);
    await assert.rejects(f.pool.query("UPDATE external_work SET context='{}',status='failed',version=version+1 WHERE id=$1",[w.id]),/revision/);
    await assert.rejects(f.pool.query("DELETE FROM external_work_events WHERE work_id=$1",[w.id]),/Append-only/);
    await assert.rejects(f.pool.query("INSERT INTO external_work_events(web_presence_id,work_id,kind,payload) VALUES($1,$2,'failure','{}')",[randomUUID(),w.id]),/foreign key/);
    await assert.rejects(f.service.inspect(randomUUID(),w.id),/owned/);
    await f.service.cancel(f.owner,w.id);assert.equal((await f.service.inspect(f.owner,w.id)).work.status,"cancelled");
  }finally{await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await admin.end();await f.stop();}
});

test("operator escalation scopes one third attempt without changing default limits",{skip:!url},async()=>{
  for(const fail of [false,true]){
    const f=await fixture();try{
      const p=synthetic();let parentId="";
      for(const iteration of [1,2]){
        const w=await f.service.create(f.context,p,1000000,iteration),c=await f.service.dispatch(f.owner,w.id,p,500000) as Candidate;
        await f.service.decide(f.owner,w.id,{candidateId:c.id,digest:c.subject_digest,revision:1,decision:"reject",actor:"fixture operator",reason:"Synthetic brief review"});parentId=w.id;
      }
      await assert.rejects(f.service.create(f.context,p,1500000,3));
      await assert.rejects(escalatePilot(f.service,randomUUID(),parentId,p,"fixture operator","Bounded test"));
      const w=await escalatePilot(f.service,f.owner,parentId,p,"fixture operator","Two rejected candidates refined the brief; one bounded final attempt");
      assert.equal((await escalatePilot(f.service,f.owner,parentId,p,"fixture operator","Same authorization")).id,w.id);
      await assert.rejects(f.pool.query("INSERT INTO external_work(web_presence_id,capability,identity,context_digest,context,provider,model,template_version,iteration,budget_micros) SELECT web_presence_id,capability,$2,context_digest,context,provider,model,template_version,3,budget_micros FROM external_work WHERE id=$1",[w.id,"d".repeat(64)]),/external_work_bounds/);
      let calls=0;const third=synthetic(async(r,c)=>{calls++;assert.equal(r.templateVersion,"miopages-service-illustration/3");if(fail)throw new AcquisitionFailure("rate-limit");return synthetic().generateImage(r,c);});
      const result=await f.service.dispatch(f.owner,w.id,third,500000);
      assert.equal(calls,1);await assert.rejects(f.service.retry(f.owner,w.id),/no retries/);await assert.rejects(f.service.dispatch(f.owner,w.id,third,500000));await assert.rejects(f.service.create(f.context,p,1500000,4));assert.equal(calls,1);
      const state=await f.service.inspect(f.owner,w.id);assert.equal(state.work.attempts,1);assert.equal(state.work.retries,0);
      assert.equal((await f.pool.query("SELECT sum(reserved_micros)::integer AS total FROM external_work")).rows[0].total,1500000);
      assert.equal(state.events.filter(e=>e.payload.subjectType==="acquisition-escalation").length,1);
      if(fail){assert.equal(result,null);assert.equal(state.work.status,"failed");}else{
        const c=result as Candidate;assert.equal(c.state,"proposed");assert.ok(c.provenance.escalation);assert.equal(await approvedCandidate(f.pool,state.work,c),null);
        await f.service.decide(f.owner,w.id,{candidateId:c.id,digest:c.subject_digest,revision:1,decision:"approve",actor:"fixture operator",reason:"Synthetic test only"});
        const reviewed=await f.service.inspect(f.owner,w.id);assert.ok(await approvedCandidate(f.pool,reviewed.work,reviewed.candidates[0]));
      }
    }finally{await f.stop();}
  }
});
test("dispatch reserves atomically, deduplicates and creates private exact candidate",{skip:!url},async()=>{
  const f=await fixture();try{
    let calls=0;const provider=synthetic(async(r,c)=>{calls++;return synthetic().generateImage(r,c);});
    const [a,b]=await Promise.all([f.service.create(f.context,provider,1000),f.service.create(f.context,provider,1000)]);assert.equal(a.id,b.id);
    const dispatches=await Promise.allSettled([f.service.dispatch(f.owner,a.id,provider,300),f.service.dispatch(f.owner,a.id,provider,300)]);assert.equal(dispatches.filter(d=>d.status==="fulfilled").length,1);assert.equal(calls,1);
    const state=await f.service.inspect(f.owner,a.id),c=state.candidates[0];assert.equal(c.state,"proposed");assert.equal(state.work.status,"awaiting-review");assert.equal(state.work.reserved_micros,300);
    assert.equal(candidateSubject(c),c.subject_digest);assert.equal(fingerprint(c.provenance),c.provenance_digest);
    const bytes=await readManagedObject(f.receipt.quarantineRoot,f.owner,c.quarantine_key);assert.ok(bytes.length);
    assert.equal((await acquiredHeroAssets(f.pool,f.owner,f.receipt.managedSiteId,f.receipt.root)).size,0);
    assert.equal((await deliverPublicAsset(c.id,async()=>null,f.receipt.root)).status,404);
    assert.equal((await f.pool.query("SELECT * FROM assets WHERE metadata ? 'acquisition'")).rowCount,0);
    await assert.rejects(f.pool.query("UPDATE media_candidates SET bytes_digest=$2,version=version+1 WHERE id=$1",[c.id,"b".repeat(64)]),/Immutable/);
    await assert.rejects(f.service.decide(f.owner,a.id,{candidateId:c.id,digest:"a".repeat(64),revision:1,decision:"approve",actor:"test operator",reason:"synthetic mechanics"}),/subject/);
  }finally{await f.stop();}
});
test("budget, missing credentials, stale context and retry refusal dispatch no candidate",{skip:!url},async()=>{
  for(const mode of ["budget","credentials","stale","inactive-design"]){const f=await fixture();try{
    let calls=0;const p=synthetic(async(r,c)=>{calls++;return synthetic().generateImage(r,c);});
    const w=await f.service.create(f.context,p,1000);
    if(mode==="credentials")p.assertConfigured=()=>{throw new AcquisitionFailure("credentials-absent");};
    if(mode==="stale")await f.pool.query("UPDATE sections SET version=version+1 WHERE id=$1",[f.context.sectionId]);
    if(mode==="inactive-design")await f.pool.query("UPDATE design_systems SET status='inactive' WHERE web_presence_id=$1",[f.owner]);
    assert.equal(await f.service.dispatch(f.owner,w.id,p,mode==="budget"?1001:300),null);assert.equal(calls,0);
    const state=await f.service.inspect(f.owner,w.id);assert.equal(state.work.status,"failed");assert.equal(state.candidates.length,0);assert.equal(state.work.reserved_micros,0);await assert.rejects(f.service.retry(f.owner,w.id));
  }finally{await f.stop();}}
});
test("bounded transient retries retain reservations; ambiguous timeout cannot retry",{skip:!url},async()=>{
  const f=await fixture();try{
    const p=synthetic(async()=>{throw new AcquisitionFailure("rate-limit","fixture-429");});const w=await f.service.create(f.context,p,1000);
    for(let i=0;i<3;i++){await f.service.dispatch(f.owner,w.id,p,300);if(i<2)await f.service.retry(f.owner,w.id);}
    const state=await f.service.inspect(f.owner,w.id);assert.equal(state.work.attempts,3);assert.equal(state.work.retries,2);assert.equal(state.work.reserved_micros,900);await assert.rejects(f.service.retry(f.owner,w.id));
    assert.equal(state.candidates.length,0);
  }finally{await f.stop();}
  const g=await fixture();try{const p=synthetic(async()=>{throw new AcquisitionFailure("timeout-uncertain");});const w=await g.service.create(g.context,p,1000);await g.service.dispatch(g.owner,w.id,p,300);await assert.rejects(g.service.retry(g.owner,w.id));assert.equal((await g.service.inspect(g.owner,w.id)).work.reserved_micros,300);}finally{await g.stop();}
});
test("late cancelled dispatch and invalid bytes fail closed with audit",{skip:!url},async()=>{
  const f=await fixture();try{
    let release!:()=>void;let started!:()=>void;const gate=new Promise<void>(r=>release=r),start=new Promise<void>(r=>started=r);
    const p=synthetic(async(r,c)=>{started();await gate;return synthetic().generateImage(r,c);});const w=await f.service.create(f.context,p,1000);
    const pending=f.service.dispatch(f.owner,w.id,p,300);await start;await f.service.cancel(f.owner,w.id);release();assert.equal(await pending,null);
    const state=await f.service.inspect(f.owner,w.id);assert.equal(state.work.status,"cancelled");assert.equal(state.candidates.length,0);assert.ok(state.events.some(e=>e.kind==="failure"));
  }finally{await f.stop();}
  const g=await fixture();try{const p=synthetic(async(r,c)=>({...await synthetic().generateImage(r,c),bytes:Buffer.from("invalid")}));const w=await g.service.create(g.context,p,1000);await g.service.dispatch(g.owner,w.id,p,300);assert.equal((await g.service.inspect(g.owner,w.id)).work.result.code,"validation");}finally{await g.stop();}
});
test("exact human decisions, disposable ingestion, presentation/delivery and revocation",{skip:!url},async()=>{
  const f=await fixture();let server:Awaited<ReturnType<typeof startProductionFixture>>|undefined;
  try{
    const p=synthetic(),w=await f.service.create(f.context,p,1000),c=await f.service.dispatch(f.owner,w.id,p,300) as Candidate;
    await assert.rejects(ingestDisposable(f.service,f.owner,w.id,c.id,f.receipt.root,"Conceptual planes"),/approved/i);
    await assert.rejects(f.service.decide(f.owner,w.id,{candidateId:c.id,digest:c.subject_digest,revision:2,decision:"approve",actor:"fixture operator",reason:"Synthetic test only"}),/subject/);
    await f.service.decide(f.owner,w.id,{candidateId:c.id,digest:c.subject_digest,revision:1,decision:"approve",actor:"fixture operator",reason:"Synthetic fixture mechanics only; not generated visual approval"});
    await assert.rejects(ingestDisposable(f.service,randomUUID(),w.id,c.id,f.receipt.root,"Conceptual planes"),/approved/i);
    const assetId=await ingestDisposable(f.service,f.owner,w.id,c.id,f.receipt.root,"Conceptual planes show understanding becoming a presence supported by continuing care.");
    const approvedState=await f.service.inspect(f.owner,w.id),approved=approvedState.candidates[0];
    assert.equal(await approvedCandidate(f.pool,approvedState.work,{...approved,expires_at:new Date(0)}),null);
    assert.equal(await approvedCandidate(f.pool,approvedState.work,{...approved,provenance:{}}),null);
    assert.equal(await approvedCandidate(f.pool,approvedState.work,{...approved,revision:2}),null);
    assert.equal(await approvedCandidate(f.pool,approvedState.work,{...approved,policy_version:"unsupported/2"}),null);
    const unrelatedGeneration={...approved,provenance:{...approved.provenance,attemptId:randomUUID()}};
    unrelatedGeneration.provenance_digest=fingerprint(unrelatedGeneration.provenance);
    unrelatedGeneration.subject_digest=candidateSubject(unrelatedGeneration);
    assert.equal(await approvedCandidate(f.pool,approvedState.work,unrelatedGeneration),null);
    await assert.rejects(ingestDisposable(f.service,f.owner,w.id,c.id,f.receipt.quarantineRoot,"Conceptual planes"),/separate/);
    const intro=(await f.pool.query("SELECT id FROM sections WHERE type='intro' LIMIT 1")).rows[0].id;
    await f.pool.query("INSERT INTO asset_usages(web_presence_id,asset_id,entity_type,entity_id,role) VALUES($1,$2,'section',$3,'image')",[f.owner,assetId,intro]);
    const eligible=await acquiredHeroAssets(f.pool,f.owner,f.receipt.managedSiteId,f.receipt.root);assert.equal(eligible.size,1);assert.equal(eligible.get(f.context.sectionId)!.asset.id,assetId);
    const direct=await deliverPublicAsset(assetId,async id=>[...eligible.values()].find(e=>e.asset.id===id)?.asset??null,f.receipt.root);
    assert.equal(direct.status,200);assert.ok(Buffer.from(await direct.arrayBuffer()).equals(await readManagedObject(f.receipt.quarantineRoot,f.owner,c.quarantine_key)));
    server=await startProductionFixture(url!,f.receipt.schema,f.receipt.root,f.receipt);
    const html=await (await fetch(server.base)).text();assert.ok(html.includes('data-acquired-role="service-illustration"'));assert.ok(html.includes(assetId));assert.ok(!html.includes("data-fpo-role"));
    assert.equal(new JSDOM(html).window.document.querySelector(`section[data-type='intro'] img[src='/media/assets/${assetId}']`),null);
    assert.equal((await fetch(`${server.base}/media/assets/${assetId}`)).status,200);
    await f.pool.query("UPDATE assets SET metadata='{}' WHERE id=$1",[assetId]);assert.equal((await acquiredHeroAssets(f.pool,f.owner,f.receipt.managedSiteId,f.receipt.root)).size,0);assert.equal((await fetch(`${server.base}/media/assets/${assetId}`)).status,404);
    const lineage={acquisition:{candidateId:c.id,provenanceDigest:c.provenance_digest,subjectDigest:c.subject_digest,revision:1,artificial:true,sourceKind:c.source_kind,provider:c.provider,model:c.model}};
    await f.pool.query("UPDATE assets SET metadata=$2 WHERE id=$1",[assetId,JSON.stringify(lineage)]);
    await f.service.decide(f.owner,w.id,{candidateId:c.id,digest:c.subject_digest,revision:1,decision:"revoke",actor:"fixture operator",reason:"Synthetic revocation test"});
    assert.equal((await acquiredHeroAssets(f.pool,f.owner,f.receipt.managedSiteId,f.receipt.root)).size,0);
    assert.equal((await fetch(`${server.base}/media/assets/${assetId}`)).status,404);const fallback=await(await fetch(server.base)).text();assert.ok(!fallback.includes('data-acquired-role="service-illustration"'));assert.ok(!fallback.includes(assetId));
    assert.ok((await readManagedObject(f.receipt.root,f.owner,c.quarantine_key)).length);assert.ok((await f.service.inspect(f.owner,w.id)).events.some(e=>e.kind==="decision"&&e.payload.decision==="revoke"));
  }finally{await server?.stop();await f.stop();}
});
test("state flag without attributable approval cannot be ingested",{skip:!url},async()=>{
  const f=await fixture();try{
    const p=synthetic(),w=await f.service.create(f.context,p,1000),c=await f.service.dispatch(f.owner,w.id,p,300) as Candidate;
    await f.pool.query("UPDATE media_candidates SET state='approved',version=version+1 WHERE id=$1",[c.id]);
    const state=await f.service.inspect(f.owner,w.id);assert.equal(await approvedCandidate(f.pool,state.work,state.candidates[0]),null);
    await assert.rejects(ingestDisposable(f.service,f.owner,w.id,c.id,f.receipt.root,"Synthetic planes"),/approval/);
    assert.equal((await f.pool.query("SELECT id FROM assets WHERE metadata ? 'acquisition'")).rowCount,0);
  }finally{await f.stop();}
});
test("rejection requires fresh approval for next iteration and aggregate budget applies",{skip:!url},async()=>{
  const f=await fixture();try{
    const p=synthetic(),w=await f.service.create(f.context,p,1000),c=await f.service.dispatch(f.owner,w.id,p,600) as Candidate;
    await f.service.decide(f.owner,w.id,{candidateId:c.id,digest:c.subject_digest,revision:1,decision:"reject",actor:"fixture operator",reason:"Synthetic rejection"});
    assert.equal((await f.service.inspect(f.owner,w.id)).work.status,"completed");
    const next=await f.service.create(f.context,p,1000,2);assert.notEqual(next.id,w.id);assert.equal(await f.service.dispatch(f.owner,next.id,p,600),null);
    assert.equal((await f.service.inspect(f.owner,next.id)).work.result.code,"budget");await assert.rejects(f.service.create(f.context,p,1000,3));
  }finally{await f.stop();}
});
test("refusal cannot be retried through another iteration; expired lease rejects late result",{skip:!url},async()=>{
  const f=await fixture();try{
    const p=synthetic(async()=>{throw new AcquisitionFailure("refusal");});const w=await f.service.create(f.context,p,1000);await f.service.dispatch(f.owner,w.id,p,300);
    await assert.rejects(f.service.retry(f.owner,w.id));await assert.rejects(f.service.create(f.context,p,1000,2));
  }finally{await f.stop();}
  const g=await fixture();const originalNow=Date.now;let release!:()=>void;
  try{
    let started!:()=>void;const gate=new Promise<void>(r=>release=r),start=new Promise<void>(r=>started=r);
    const p=synthetic(async(r,c)=>{started();await gate;return synthetic().generateImage(r,c);});const w=await g.service.create(g.context,p,1000);
    const pending=g.service.dispatch(g.owner,w.id,p,300);await start;
    Date.now=()=>originalNow()+360000;try{await g.service.expireLease(g.owner,w.id);}finally{Date.now=originalNow;}
    release();assert.equal(await pending,null);const state=await g.service.inspect(g.owner,w.id);assert.equal(state.work.result.code,"timeout-uncertain");assert.equal(state.candidates.length,0);assert.equal(state.work.reserved_micros,300);
    await assert.rejects(g.service.retry(g.owner,w.id));
  }finally{Date.now=originalNow;release?.();await g.stop();}
});

 test("versioned second brief preserves rejected parent and requires independent review",{skip:!url},async()=>{
  const f=await fixture();try{
    const requests:string[]=[];const p=synthetic(async(r,c)=>{requests.push(r.templateVersion);return synthetic().generateImage(r,c);});
    const w=await f.service.create(f.context,p,1000),c=await f.service.dispatch(f.owner,w.id,p,500) as Candidate;
    await f.service.decide(f.owner,w.id,{candidateId:c.id,digest:c.subject_digest,revision:1,decision:"reject",actor:"fixture operator",reason:"Too abstract"});
    const next=await f.service.create(f.context,p,1000,2,ITERATION_TWO_TEMPLATE);
    assert.equal((await f.service.create(f.context,p,1000,2,ITERATION_TWO_TEMPLATE)).id,next.id);
    const second=await f.service.dispatch(f.owner,next.id,p,500) as Candidate;
    assert.deepEqual(requests,["miopages-service-illustration/1",ITERATION_TWO_TEMPLATE]);
    const parent=second.provenance.parentCandidate as Record<string,unknown>;
    assert.equal(parent.candidateId,c.id);assert.equal(parent.subjectDigest,c.subject_digest);assert.equal(parent.state,"rejected");assert.ok(parent.reviewEventId);
    assert.equal(second.state,"proposed");assert.equal(await approvedCandidate(f.pool,(await f.service.inspect(f.owner,next.id)).work,second),null);
    assert.ok((await readManagedObject(f.receipt.quarantineRoot,f.owner,c.quarantine_key)).length);
    assert.equal((await f.service.inspect(f.owner,w.id)).candidates[0].provenance_digest,c.provenance_digest);
    await assert.rejects(f.service.dispatch(f.owner,next.id,p,500));assert.equal(requests.length,2);
    assert.equal((await f.pool.query("SELECT * FROM assets WHERE metadata ? 'acquisition'")).rowCount,0);
    await f.service.decide(f.owner,next.id,{candidateId:second.id,digest:second.subject_digest,revision:1,decision:"approve",actor:"fixture operator",reason:"Synthetic versioned approval mechanics only"});
    const reviewed=await f.service.inspect(f.owner,next.id);
    assert.ok(await approvedCandidate(f.pool,reviewed.work,reviewed.candidates[0]));
    const forged={...reviewed.candidates[0],provenance:{...second.provenance,parentCandidate:null}};
    forged.provenance_digest=fingerprint(forged.provenance);forged.subject_digest=candidateSubject(forged);
    assert.equal(await approvedCandidate(f.pool,reviewed.work,forged),null);
  }finally{await f.stop();}
});
