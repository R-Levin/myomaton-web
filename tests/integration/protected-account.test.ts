import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Pool } from "pg";
import { disposableCluster } from "../../scripts/backup/disposable-cluster";
import { migrateWithBootstrapCompatibility } from "../../scripts/db/bootstrap";
import { IntakeService,newResumeToken,resumeHash } from "../../lib/platform/intake/service";
import { ActivationService } from "../../lib/platform/activation/service";
import { intakeAnswersV2 } from "../helpers/intake";
import { fingerprint } from "../../lib/platform/canonical/model";
import { inspectCanonical,writeApprovedInactiveKnowledge,type OnboardingOwner } from "../../lib/platform/canonical/writes";
import { confirmKnowledge,knowledgeTargets } from "../../lib/platform/canonical/confirmed-information";
import { protectedAccountBoundary,protectedAccountFoundation,protectedAccountConfirmation } from "../../lib/platform/intake/protected-account";
import { protectedOwnerId,protectedOwnerToken,protectedOwnerVerifier } from "../../lib/platform/intake/protected-owner";
import { ProtectedOperator } from "../../lib/platform/wordpress-delivery/operator";
import { protectedAccountSql } from "../../scripts/db/protected-account-policy";
import { InquiryOutcomes } from "../../lib/platform/contact/outcomes";
import { acceptContactSubmission } from "../../lib/platform/contact/submissions";
import { protectedInquiry } from "../../lib/platform/contact/protected-inquiry";
import { protectedDevelopmentDraft } from "../../lib/platform/wordpress-delivery/cycle-measurement";

test("protected inactive C0 account: existing canonical writer, exact grants, no broad table rights, rollback and history",async () => {
 const cluster=await disposableCluster(process.env.PG_BIN_DIR??"C:/Program Files/PostgreSQL/18/bin");
 const admin=new Pool({connectionString:cluster.url});
 const scope={webPresenceId:protectedAccountFoundation.webPresenceId,managedSiteId:protectedAccountFoundation.managedSiteId};
 const owner:OnboardingOwner={...protectedAccountFoundation},recordId="52f23cfc-b690-447e-9475-0c3d8324d929",label="Synthetic policy fixture only";
 const url=new URL(cluster.url),password=randomUUID();url.username="miopages_core_development";url.password=password;
 const role=new Pool({connectionString:url.href,max:4,options:"-c search_path=miopages_core_account,miopages_core_guard,miopages_wp,public"});
 try {
  await migrateWithBootstrapCompatibility(admin);
  await admin.query("CREATE SCHEMA miopages_wp");
  await admin.query(`CREATE ROLE miopages_core_development LOGIN NOINHERIT PASSWORD '${password}'`);
  await admin.query(`CREATE TABLE miopages_wp.wordpress_operator_credentials(id uuid,token_sha256 text,expires_at timestamptz,revoked_at timestamptz);
   CREATE TABLE miopages_wp.wordpress_operator_grants(id uuid,operator_id uuid,web_presence_id uuid,managed_site_id uuid,permission text,
    customer jsonb,revoked_at timestamptz,CONSTRAINT wordpress_operator_grants_permission_check CHECK(permission IN ('inspect-site-proposal','prepare-site-proposal')))`);
  await admin.query("INSERT INTO organizations(id,name) VALUES($1,$2)",[owner.organizationId,label]);
  await admin.query("INSERT INTO web_presences(id,organization_id,name) VALUES($1,$2,$3)",[scope.webPresenceId,owner.organizationId,label]);
  await admin.query("INSERT INTO managed_sites(id,web_presence_id,name) VALUES($1,$2,$3)",[scope.managedSiteId,scope.webPresenceId,label]);
  const intake=new IntakeService(admin,scope),token=newResumeToken(),draft=await intake.create(token,"DIRECT_START");
  const saved=await intake.save(token,draft.version,intakeAnswersV2(),12);await intake.submit(token,saved.version);
  const source=(await admin.query("SELECT s.id,s.digest,i.id AS intake_id FROM prospect_intake_submissions s JOIN prospect_intakes i ON i.id=s.intake_id WHERE i.resume_hash=$1",[resumeHash(token)])).rows[0];
  const actor={operatorId:protectedOwnerId,authorityReference:label};
  const activation=new ActivationService(admin,{authorize:async()=>actor},{read:async()=>{throw Error("No Review fixture");}},async()=>{});
  const inputScope={...scope,pendingCustomerId:randomUUID()};
  const created=await activation.create({}, {scope:inputScope,requestId:randomUUID(),submissionId:source.id,submissionDigest:source.digest});
  owner.caseId=created.id;
  const at=new Date().toISOString();
  await activation.update({},created.id,inputScope,1,randomUUID(),"confirm-commercial",{source:"agreement-order",reference:label,confirmedAt:at,launchScope:label,ongoingScope:label});
  const confirmation={reference:label,confirmedAt:at,confirmedBy:actor.operatorId};
  const identity={organizationName:label,webPresenceName:label,managedSiteName:label,confirmation};
  const db=await admin.connect();
  try {
   await db.query("BEGIN");
   await db.query("UPDATE organizations SET status='inactive',metadata=$2 WHERE id=$1",[owner.organizationId,{initialization:{kind:"customer-foundation/1",sourceReference:"activation-case:"+created.id,confirmation}}]);
   await db.query("UPDATE web_presences SET status='inactive' WHERE id=$1",[scope.webPresenceId]);
   await db.query("UPDATE managed_sites SET status='inactive' WHERE id=$1",[scope.managedSiteId]);
   await db.query("INSERT INTO activation_case_events(case_id,version,request_id,request_digest,operation,actor,authority_reference,at,previous,digest,snapshot) SELECT case_id,3,$2,$3,'initialize-customer',actor,authority_reference,$4,digest,$5,snapshot FROM activation_case_events WHERE case_id=$1 AND version=2",[created.id,randomUUID(),fingerprint(["request",created.id]),at,fingerprint(["event",created.id])]);
   await db.query("INSERT INTO activation_customer_bindings(case_id,organization_id,web_presence_id,managed_site_id,event_version,identity,identity_digest) VALUES($1,$2,$3,$4,3,$5,$6)",[created.id,owner.organizationId,scope.webPresenceId,scope.managedSiteId,identity,fingerprint(identity)]);
   await db.query("COMMIT");
  } catch(e){await db.query("ROLLBACK");throw e;}finally{db.release();}
  const payload={entries:[{key:"purpose",kind:"goal",value:"Fixture original business purpose",evidence:{sourceKind:"customer",sourceReference:label,confirmation:"confirmed",visibility:"public",confirmedBy:protectedOwnerId,confirmedAt:at}}],identityEvidence:[],approval:{by:protectedOwnerId,at,scope:"public"}};
  await writeApprovedInactiveKnowledge(admin,{domain:"knowledge",id:recordId,webPresenceId:scope.webPresenceId,expectedVersion:null,expectedFingerprint:null,payload,responsibleIdentity:protectedOwnerId,changeReason:label},owner);
  await admin.query(await readFile("lib/platform/intake/protected-core-policy.sql","utf8"));
  // Only the fixture case UUID differs; actual migration/activation guards,
  // exact C0 scope, record restriction and policy statements are unchanged.
  const sql=await protectedAccountSql();
  const installer=await admin.connect();
  try { await installer.query("BEGIN");await installer.query(sql.forward.replaceAll(protectedAccountFoundation.caseId,owner.caseId));await installer.query("COMMIT"); }
  catch(e){await installer.query("ROLLBACK");throw e;}finally{installer.release();}
  const first=await inspectCanonical(admin,"knowledge",scope.webPresenceId,recordId);assert.ok(first);
  const mandate={kind:"business-representative" as const,subjectId:protectedOwnerId,authorityReference:label};
  const request={correctionId:randomUUID(),requestId:randomUUID(),target:{id:recordId,key:"purpose",version:1,fingerprint:first.fingerprint},value:"Fixture revised business purpose",confirmed:true as const,publicUse:true,reference:label};
  const proof={id:protectedOwnerId,authorityReference:label,customer:mandate};
  const c=await role.connect();
  try {
   await protectedAccountBoundary(c,owner);
   assert.equal((await knowledgeTargets(c,scope)).length,1);
   await assert.rejects(c.query("SELECT * FROM public.business_knowledge"),/permission denied/);
   await assert.rejects(c.query("UPDATE web_presences SET status='active'"),/not authorized/);
   await assert.rejects(c.query("DELETE FROM business_knowledge_revisions"),/permission denied/);
   await assert.rejects(confirmKnowledge(c,scope,request,proof,{},new Date().toISOString()),/authority/);
   await assert.rejects(confirmKnowledge(c,scope,request,proof,{},new Date().toISOString(),{...owner,caseId:randomUUID()}),/authority/);
   await assert.rejects(confirmKnowledge(c,scope,{...request,publicUse:false},proof,{},new Date().toISOString(),owner),/invalid/);
   // Actual canonical writer executes through the restricted views. Outer
   // transaction rolls back both current and immutable-history insertion.
   await c.query("BEGIN");
   const receipt=await confirmKnowledge(c,scope,request,proof,{intakeId:source.intake_id},new Date().toISOString(),owner);
   assert.equal(receipt.version,2);await c.query("ROLLBACK");
   assert.equal((await inspectCanonical(admin,"knowledge",scope.webPresenceId,recordId))!.fingerprint,first.fingerprint);
   await c.query("BEGIN");
   await confirmKnowledge(c,scope,request,proof,{intakeId:source.intake_id},new Date().toISOString(),owner);await c.query("COMMIT");
   assert.equal((await inspectCanonical(admin,"knowledge",scope.webPresenceId,recordId))!.row.version,2);
   assert.equal((await admin.query("SELECT count(*)::int n FROM business_knowledge_revisions WHERE knowledge_id=$1",[recordId])).rows[0].n,2);
   await assert.rejects(confirmKnowledge(c,scope,request,proof,{},new Date().toISOString(),owner),/stale/);
  }finally{c.release();}
  const verifier=protectedOwnerVerifier(await protectedOwnerToken("Synthetic only password for policy test"));
  await admin.query("INSERT INTO miopages_wp.wordpress_operator_credentials VALUES($1,$2,'infinity',NULL)",[protectedOwnerId,verifier]);
  for(const permission of ["inspect-site-proposal","prepare-site-proposal"]){await admin.query("INSERT INTO miopages_wp.wordpress_operator_grants VALUES($1,$2,$3,$4,$5,NULL,NULL)",[randomUUID(),protectedOwnerId,scope.webPresenceId,scope.managedSiteId,permission]);}
  const operators=new ProtectedOperator(role,async c=>{await protectedAccountBoundary(c,owner);},true),session=await operators.authenticateDevelopmentOwner(verifier,protectedOwnerId);
  const capability=protectedAccountConfirmation(role,operators,session,owner);
  const context={scope} as Parameters<typeof capability.authorize>[1],workflowActor={id:protectedOwnerId,role:"operator" as const,simulated:false};
  await assert.rejects(capability.authorize(workflowActor,context));
  const grant=randomUUID();await admin.query("INSERT INTO miopages_wp.wordpress_operator_grants VALUES($1,$2,$3,$4,'confirm-business-information',$5,NULL)",[grant,protectedOwnerId,scope.webPresenceId,scope.managedSiteId,mandate]);
  assert.deepEqual((await capability.authorize(workflowActor,context)).foundation,owner);
  await assert.rejects(protectedAccountConfirmation(role,operators,{}).authorize(workflowActor,context));
  await assert.rejects(capability.authorize({...workflowActor,simulated:true},context));
  await admin.query("UPDATE miopages_wp.wordpress_operator_grants SET revoked_at=now() WHERE id=$1",[grant]);
  await assert.rejects(capability.authorize(workflowActor,context));
  for(const permission of ["inspect-inquiry-outcomes","record-inquiry-outcome"]){await admin.query("INSERT INTO miopages_wp.wordpress_operator_grants VALUES($1,$2,$3,$4,$5,$6,NULL)",[randomUUID(),protectedOwnerId,scope.webPresenceId,scope.managedSiteId,permission,permission==='record-inquiry-outcome'?mandate:null]);}
  const page=(await admin.query("INSERT INTO pages(managed_site_id,slug,name,title) VALUES($1,'/contact','Fixture','Fixture') RETURNING id",[scope.managedSiteId])).rows[0].id;
  const definition=(await admin.query("INSERT INTO contact_definitions(web_presence_id,name,configuration) VALUES($1,'Fixture',$2) RETURNING id",[scope.webPresenceId,{fields:[{key:'message',label:'Message',required:true}]}])).rows[0].id;
  const section=(await admin.query("INSERT INTO sections(page_id,type,content) VALUES($1,'contact',$2) RETURNING id",[page,{contact_definition_id:definition}])).rows[0].id;
  const selection={...scope,domain:"development.invalid",managedSiteName:"Development fixture"};
  // The real ordinary Contact boundary correctly refuses this INACTIVE site.
  // Reuse the existing labeled, fixed rehearsal intake for outcome verification;
  // do not activate the account or claim genuine visitor/inquiry acceptance.
  await assert.rejects(acceptContactSubmission(admin,selection,{sectionId:section,definitionId:definition,version:1,fields:{message:'Private fixture text must not enter the outcome view'},idempotencyKey:randomUUID()}, {abuse:{allow:async()=>true}}),/unavailable/);
  await admin.query(await readFile("lib/platform/intake/protected-core-inquiry.sql","utf8"));
  await protectedInquiry(admin,scope,protectedDevelopmentDraft,true);
  const outcomes=new InquiryOutcomes(role,operators,'development');
  const current=await outcomes.inspect(session,scope);assert.equal(current.inquiries.length,1);
  assert.doesNotMatch(JSON.stringify(current),/Private fixture text/);
  const outcome={submissionId:current.inquiries[0].id,requestId:randomUUID(),expectedVersion:0,qualification:'qualified',outcome:'conversation',confirmedAt:new Date().toISOString(),reference:label,confirmed:true};
  const recorded=await outcomes.record(session,scope,outcome);assert.equal(recorded.inquiries[0].outcome,'conversation');
  assert.deepEqual(await outcomes.record(session,scope,outcome),recorded);
  await assert.rejects(outcomes.record({},scope,{...outcome,requestId:randomUUID()}));
  await assert.rejects(role.query("SELECT fields FROM contact_submissions"),/column.*does not exist/);
  await assert.rejects(role.query("UPDATE contact_submissions SET delivery_status='sent'"),/not authorized/);
  await assert.rejects(role.query("UPDATE contact_outcome_events SET environment='live'"),/permission denied/);
  await assert.rejects(role.query("INSERT INTO contact_outcome_events SELECT web_presence_id,managed_site_id,submission_id,'live',1,gen_random_uuid(),payload,digest FROM contact_outcome_events"),/row.level security/);
  const access=await role.query("SELECT has_table_privilege('public.business_knowledge','UPDATE') AS canonical,has_table_privilege('public.activation_customer_bindings','UPDATE') AS binding");
  assert.deepEqual(access.rows[0],{canonical:false,binding:false});
  await admin.query(sql.rollback);
  await assert.rejects(role.query("SELECT * FROM miopages_core_account.business_knowledge"),/permission denied/);
  assert.equal((await inspectCanonical(admin,"knowledge",scope.webPresenceId,recordId))!.row.version,2);
  assert.equal((await admin.query("SELECT count(*)::int n FROM business_knowledge_revisions WHERE knowledge_id=$1",[recordId])).rows[0].n,2);
 }finally{await role.end();await admin.end();await cluster.stop();}
});
