
import assert from "node:assert/strict";
import test from "node:test";
import{randomUUID}from"node:crypto";
import{mkdtemp,mkdir,rm}from"node:fs/promises";
import{tmpdir}from"node:os";
import{join}from"node:path";
import sharp from"sharp";
import{createIntakeFixture}from"../../scripts/intake/disposable";
import{enableDisposableSuppliedMedia}from"../../scripts/acquisition/supplied-disposable";
import{SuppliedMediaIntake,type SuppliedMediaAuthority}from"../../lib/platform/acquisition/supplied-media";
import{fingerprint}from"../../lib/platform/canonical/model";

test("only an explicit disposable composition can intake media for its exact private CTA, with ordinary Intro and stale/foreign guards intact",async()=>{
 const url=process.env.ASSET_TEST_DATABASE_URL;assert.ok(url);const parsed=new URL(url);
 assert.equal(parsed.hostname,"127.0.0.1");assert.notEqual(parsed.port,"5432");
 assert.match(parsed.pathname,/^\/migration_rehearsal_[a-f0-9]{32}$/);
 Object.assign(process.env,{NODE_ENV:"development",MIOPAGES_SITE_RELEASES:"disposable-operator",MIOPAGES_SITE_PROPOSALS:"local-operator"});
 const f=await createIntakeFixture(url),root=await mkdtemp(join(tmpdir(),"mio-private-cta-"));
 try{
  await enableDisposableSuppliedMedia(f.pool);const q=join(root,"staging"),m=join(root,"managed");await mkdir(q);await mkdir(m);
  const graph=(await f.pool.query("SELECT w.id AS wp,m.id AS site FROM web_presences w JOIN managed_sites m ON m.web_presence_id=w.id ORDER BY w.id LIMIT 1")).rows[0];assert.ok(graph);
  const target={webPresenceId:graph.wp,managedSiteId:graph.site,pageId:randomUUID(),sectionId:randomUUID()};
  await f.pool.query("INSERT INTO pages(id,managed_site_id,slug,name,title) VALUES($1,$2,'/private-image-test','Private','Private')",[target.pageId,target.managedSiteId]);
  await f.pool.query("INSERT INTO sections(id,page_id,type,name,content) VALUES($1,$2,'cta','Private CTA',$3)",[target.sectionId,target.pageId,{heading:"Choose a next step",text:"Fixture only"}]);
  const token={},authority:SuppliedMediaAuthority={async authorize(c,_op,t){assert.equal(c,token);assert.deepEqual(t,target);return{operatorId:"private-fixture-review",authorityReference:"Exact disposable private fixture only"}}};
  const context=async(db:Parameters<NonNullable<ConstructorParameters<typeof SuppliedMediaIntake>[5]>>[0])=>{
   const page=(await db.query("SELECT * FROM pages WHERE id=$1 AND managed_site_id=$2",[target.pageId,target.managedSiteId])).rows[0];
   const section=(await db.query("SELECT * FROM sections WHERE id=$1 AND page_id=$2",[target.sectionId,target.pageId])).rows[0];
   return{page,section,digest:fingerprint({page,section})};
  };
  const bytes=await sharp({create:{width:90,height:60,channels:3,background:"#332f7e"}}).png().toBuffer();
  const source={kind:"upload" as const,reference:"Synthetic private CTA raster",suppliedBy:"Synthetic fixture",
   claim:"specific-permission" as const,evidenceReference:"Disposable technical permission",existingAssetId:null};
  const submission={submissionId:randomUUID(),source,bytes};
  await assert.rejects(new SuppliedMediaIntake(f.pool,authority,q,m).receive(token,target,submission),/(Owned existing Intro|Exact bound inactive customer foundation required)/);
  await assert.rejects(new SuppliedMediaIntake(f.pool,authority,q,m,undefined,context).receive(token,target,submission),/Owned current private Intro/);
  assert.throws(()=>new SuppliedMediaIntake(f.pool,authority,q,m,undefined,undefined,["intro","cta"]),/Explicit disposable/);
  assert.throws(()=>new SuppliedMediaIntake(f.pool,authority,q,m,undefined,context,["hero" as "cta"]),/Explicit disposable/);
  const intake=new SuppliedMediaIntake(f.pool,authority,q,m,undefined,context,["intro","cta"]);
  await assert.rejects(intake.receive({},target,submission));
  await assert.rejects(intake.receive(token,{...target,webPresenceId:randomUUID()},submission));
  const staged=await intake.receive(token,target,submission);
  assert.equal((await intake.inspect(token,target,staged.id)).candidate.state,"proposed");
  const decision={decision:"approve" as const,candidateId:staged.id,subjectDigest:staged.subject_digest,
   rights:{basis:"customer-attestation" as const,reference:source.evidenceReference},altText:"A synthetic purple raster",reason:"Private fixture permission and placement only"};
  await f.pool.query("UPDATE sections SET content=$2,version=version+1 WHERE id=$1",[target.sectionId,{heading:"Changed private CTA",text:"Fixture only"}]);
  await assert.rejects(intake.decide(token,target,decision),/Stale supplied-media placement/);
  const current=await intake.receive(token,target,{...submission,submissionId:randomUUID()});
  const approved=await intake.decide(token,target,{...decision,candidateId:current.id,subjectDigest:current.subject_digest});
  assert.ok(approved.assetId);
  assert.equal((await f.pool.query("SELECT count(*)::int n FROM assets")).rows[0].n,1);
  assert.equal((await f.pool.query("SELECT count(*)::int n FROM asset_usages")).rows[0].n,0,"Approval does not silently publish or attach");
  await f.verify();
 }finally{await f.stop();await rm(root,{recursive:true,force:true})}
});
