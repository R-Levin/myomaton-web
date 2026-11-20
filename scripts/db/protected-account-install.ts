import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFile,lstat,realpath,writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PoolClient } from "pg";
import { fingerprint } from "../../lib/platform/canonical/model";
import { protectedPool,protectedConnection } from "../../lib/platform/wordpress-delivery/protected-connection";

const approved="d0aa1d64b2ca934a115b83448b9d75124966461057220835628fd77a2c852460";
const home="/home/virtual/vps-bef564/5/53b4381d42",migration="miopages_migration";
const permissions=["confirm-business-information","inspect-inquiry-outcomes","record-inquiry-outcome"];
const sha=(v:string|Buffer)=>createHash("sha256").update(v).digest("hex");
type Expected={ownerId:string;scope:{webPresenceId:string;managedSiteId:string;knowledgeId:string;knowledgeVersionBeforeActivation:number;
 knowledgeFingerprintBeforeActivation:string;activationCaseId:string;organizationId:string};constraintFingerprint:string;
 customer:{kind:string;subjectId:string;authorityReference:string}};

export async function accountInstallSnapshot(db:PoolClient,expected:Expected) {
 const s=expected.scope;
 const scope=(await db.query(`SELECT b.case_id,b.organization_id,w.id AS web_presence_id,m.id AS managed_site_id,
  o.status AS organization_status,w.status AS web_presence_status,m.status AS site_status
  FROM public.activation_customer_bindings b JOIN public.organizations o ON o.id=b.organization_id
  JOIN public.web_presences w ON w.id=b.web_presence_id JOIN public.managed_sites m ON m.id=b.managed_site_id
  WHERE w.id=$1 AND m.id=$2`,[s.webPresenceId,s.managedSiteId])).rows;
 assert.deepEqual(scope,[{case_id:s.activationCaseId,organization_id:s.organizationId,web_presence_id:s.webPresenceId,
  managed_site_id:s.managedSiteId,organization_status:"inactive",web_presence_status:"inactive",site_status:"inactive"}]);
 const knowledge=(await db.query("SELECT * FROM public.business_knowledge WHERE web_presence_id=$1 AND id=$2",[s.webPresenceId,s.knowledgeId])).rows;
 assert.equal(knowledge.length,1);assert.equal(knowledge[0].version,s.knowledgeVersionBeforeActivation);
 assert.equal(fingerprint(knowledge[0]),s.knowledgeFingerprintBeforeActivation);
 const credential=(await db.query("SELECT id,token_sha256,expires_at,revoked_at FROM miopages_wp.wordpress_operator_credentials WHERE id=$1 AND revoked_at IS NULL AND expires_at>clock_timestamp()",[expected.ownerId])).rows;
 assert.equal(credential.length,1);
 const grants=(await db.query("SELECT * FROM miopages_wp.wordpress_operator_grants WHERE operator_id=$1 AND web_presence_id=$2 AND managed_site_id=$3 ORDER BY id",[expected.ownerId,s.webPresenceId,s.managedSiteId])).rows;
 const rawAccess=(await db.query(`SELECT c.relname,has_table_privilege('miopages_core_development',c.oid,'SELECT') AS read,
  has_table_privilege('miopages_core_development',c.oid,'UPDATE') AS update,has_table_privilege('miopages_core_development',c.oid,'INSERT') AS insert
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN
  ('business_knowledge','business_knowledge_revisions','activation_customer_bindings','contact_submissions') ORDER BY c.relname`)).rows;
 assert.equal(rawAccess.length,4);assert.ok(rawAccess.every(x=>!x.read&&!x.update&&!x.insert));
 const guard=(await db.query(`SELECT p.oid::text,pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proconfig,p.proacl::text,p.prosrc,
  t.tgenabled,pg_get_triggerdef(t.oid) AS trigger FROM pg_proc p JOIN pg_trigger t ON t.tgfoid=p.oid AND NOT t.tgisinternal
  WHERE p.oid='public.prospect_intake_guard()'::regprocedure AND t.tgrelid='public.prospect_intakes'::regclass`)).rows;
 assert.equal(guard.length,1);assert.equal(guard[0].tgenabled,"O");
 const grantConstraints=(await db.query("SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='miopages_wp.wordpress_operator_grants'::regclass AND contype='c' ORDER BY conname")).rows;
 return {scopeFingerprint:fingerprint(scope),knowledgeFingerprint:fingerprint(knowledge[0]),credentialFingerprint:fingerprint(credential),
  originalGrants:grants,rawAccess,guardFingerprint:fingerprint(guard),grantConstraints};
}

/** Caller owns the guarded transaction and durable recovery receipt. */
export async function installAccountPolicy(db:PoolClient,sql:string,expected:Expected,grantIds=permissions.map(()=>randomUUID())) {
 assert.equal(grantIds.length,3);assert.equal(new Set(grantIds).size,3);
 const before=await accountInstallSnapshot(db,expected);
 assert.equal((await db.query("SELECT to_regnamespace('miopages_core_account') AS existing")).rows[0].existing,null);
 assert.ok(!before.originalGrants.some(g=>permissions.includes(g.permission)));
 assert.deepEqual(before.grantConstraints.map(c=>c.conname),["wordpress_operator_grants_check","wordpress_operator_grants_permission_check"]);
 assert.equal(before.grantConstraints[0].definition,"CHECK (((permission = 'approve-site-proposal'::text) = (customer IS NOT NULL)))");
 if(!sql.includes("DROP CONSTRAINT wordpress_operator_grants_check"))throw Object.assign(
  Error("Customer mandate compatibility amendment requires its exact SQL authorization"),{code:"CUSTOMER_MANDATE_COMPATIBILITY_REQUIRED"});
 const constraint=(await db.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='miopages_wp.wordpress_operator_grants'::regclass AND conname='wordpress_operator_grants_permission_check'")).rows;
 assert.equal(constraint.length,1);assert.equal(fingerprint(constraint[0].definition),expected.constraintFingerprint);
 const oldView=(await db.query("SELECT pg_get_viewdef('miopages_wp.core_development_grants'::regclass,true) AS definition")).rows[0].definition;
 await db.query(sql);
 for(let i=0;i<permissions.length;i++)await db.query(`INSERT INTO miopages_wp.wordpress_operator_grants
  (id,operator_id,web_presence_id,managed_site_id,permission,customer) VALUES($1,$2,$3,$4,$5,$6)`,
 [grantIds[i],expected.ownerId,expected.scope.webPresenceId,expected.scope.managedSiteId,permissions[i],
  permissions[i]==="inspect-inquiry-outcomes"?null:expected.customer]);
 const after=await accountInstallSnapshot(db,expected);
 for(const key of ["scopeFingerprint","knowledgeFingerprint","credentialFingerprint","guardFingerprint"] as const) assert.equal(after[key],before[key]);
 assert.deepEqual(after.rawAccess,before.rawAccess);
 assert.deepEqual(after.originalGrants.filter(g=>!grantIds.includes(g.id)),before.originalGrants);
 const added=after.originalGrants.filter(g=>grantIds.includes(g.id));assert.equal(added.length,3);
 assert.deepEqual(added.map(g=>g.permission).sort(),[...permissions].sort());
 for(const grant of added)assert.deepEqual(grant.customer,grant.permission==="inspect-inquiry-outcomes"?null:expected.customer);
 const meta=(await db.query(`SELECT pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relforcerowsecurity
  FROM pg_class c WHERE c.oid='miopages_core_account.contact_outcome_events'::regclass`)).rows[0];
 assert.ok(meta?.relrowsecurity&&meta.relforcerowsecurity);
 assert.equal((await db.query("SELECT has_schema_privilege('miopages_core_development','miopages_core_account','CREATE') AS allowed")).rows[0].allowed,false);
 return {grantIds,permissions,before,after:{scopeFingerprint:after.scopeFingerprint,knowledgeFingerprint:after.knowledgeFingerprint,
  credentialFingerprint:after.credentialFingerprint,guardFingerprint:after.guardFingerprint},oldGrantView:oldView,
  schemaOwner:meta.owner};
}

async function privateBytes(file:string) {
 const info=await lstat(file);assert.ok(info.isFile()&&info.uid===process.getuid?.()&&(info.mode&0o777)===0o600&&await realpath(file)===file);
 return readFile(file);
}
let stage="configuration",commitStarted=false;
async function main() {
 assert.equal(process.argv.length,3);assert.equal(process.argv[2],"APPLY-PROTECTED-ACCOUNT-CYCLE");
 assert.equal(await realpath(process.env.HOME??""),home);
 const root=join(home,"miopages-account-cycle-d0aa1d64"),meta=await lstat(root);
 assert.ok(meta.isDirectory()&&meta.uid===process.getuid?.()&&(meta.mode&0o777)===0o700&&await realpath(root)===root);
 const bytes=await privateBytes(join(root,"manifest.json"));assert.equal(sha(bytes),approved);
 const plan=JSON.parse(bytes.toString("utf8"));
 const forward=await privateBytes(join(root,"forward.sql")),rollback=await privateBytes(join(root,"rollback.sql"));
 assert.equal(sha(forward),plan.database.forwardSha256);assert.equal(sha(rollback),plan.database.rollbackSha256);
 const saved=JSON.parse((await privateBytes(join(home,"miopages-wp-db-20261105T181534Z/wordpress-role-credentials.json"))).toString("utf8"));
 const url=new URL(saved.operator.url);assert.match(decodeURIComponent(url.username),/^miopages_wp_operator\.[a-z0-9]+$/);
 assert.equal(url.hostname,"aws-0-us-east-1.pooler.supabase.com");assert.equal(url.port,"5432");assert.equal(url.pathname,"/postgres");
 assert.equal(url.search,"?sslmode=verify-full");
 const password=(await readFile("/dev/stdin","utf8")).replace(/\n$/u,"");assert.ok(password);
 url.username=decodeURIComponent(url.username).replace(/^miopages_wp_operator\./u,migration+".");url.password=encodeURIComponent(password);
 const ca=await readFile(join(home,"supabase-ca.crt"),"utf8");
 const custody=JSON.parse((await privateBytes(join(home,"miopages-protected-core-custody.json"))).toString("utf8"));
 const corePool=protectedPool(custody.databaseUrl,"miopages_core_development",ca);
 const observeWorkflow=async()=>{
  const c=await corePool.connect();
  try{
   await protectedConnection(c,"miopages_core_development","postgres");await c.query("BEGIN READ ONLY");
   const state=(await c.query("SELECT count(*)::int AS events,max(version)::int AS version FROM miopages_core_workflow.presence_workflow_events WHERE intake_id=$1",[plan.scope.intakeId])).rows[0];
   await c.query("ROLLBACK");assert.equal(state.version,plan.scope.historicalWorkflowRevision);return state;
  }finally{c.release();}
 };
 const pool=protectedPool(url.href,migration,ca),db=await pool.connect();
 try {
  stage="owner-session";await protectedConnection(db,migration,"postgres");
  await db.query("BEGIN");await db.query("SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='20s'");
  assert.equal((await db.query("SELECT pg_try_advisory_xact_lock(hashtext('miopages-protected-account-cycle')) AS locked")).rows[0].locked,true);
  await db.query("LOCK TABLE public.prospect_intakes,public.business_knowledge,miopages_wp.wordpress_operator_grants IN SHARE ROW EXCLUSIVE MODE NOWAIT");
  const draft=(await db.query("SELECT id,version FROM public.prospect_intakes WHERE id=$1 AND web_presence_id=$2 AND managed_site_id=$3 AND state='draft'",[plan.scope.intakeId,plan.scope.webPresenceId,plan.scope.managedSiteId])).rows;
  assert.deepEqual(draft,[{id:plan.scope.intakeId,version:plan.scope.intakeVersion}]);
  // FORCE RLS intentionally does not let the migration owner read the workflow.
  // Observe through its existing independently authenticated restricted role.
  const workflow=await observeWorkflow();
  const expected:Expected={ownerId:plan.identity.reuseOwnerId,scope:plan.scope,customer:plan.identity.customerMandate,
   constraintFingerprint:plan.database.permissionConstraintFingerprintBeforeActivation};
  const before=await accountInstallSnapshot(db,expected),grantIds=permissions.map(()=>randomUUID());
  // Exclusive create prevents automatic retry after uncertain commit/custody.
  await writeFile(join(root,"before-install.json"),JSON.stringify({manifestSha256:approved,grantIds,before})+"\n",{mode:0o600,flag:"wx",flush:true});
  stage="install-and-enroll";const result=await installAccountPolicy(db,forward.toString("utf8"),expected,grantIds);
  assert.equal(result.schemaOwner,migration);
  await writeFile(join(root,"prepared-recovery.json"),JSON.stringify({manifestSha256:approved,...result})+"\n",{mode:0o600,flag:"wx",flush:true});
  stage="commit";commitStarted=true;await db.query("COMMIT");
  stage="durable-readback";const durable=await accountInstallSnapshot(db,expected);
  assert.deepEqual(durable.originalGrants.map(g=>g.id).sort(),[...before.originalGrants.map(g=>g.id),...grantIds].sort());
  assert.equal(durable.credentialFingerprint,before.credentialFingerprint);assert.equal(durable.knowledgeFingerprint,before.knowledgeFingerprint);
  assert.deepEqual(await observeWorkflow(),workflow);
  const receipt={status:"PASS",operation:"protected-account-cycle",manifestSha256:approved,grants:3,identityUnchanged:true,
   canonicalUnchanged:true,draftVersion:plan.scope.intakeVersion,workflowRevision:workflow.version,publicTablePrivileges:false,recoveryRetained:true};
  await writeFile(join(root,"installation-evidence.json"),JSON.stringify(receipt)+"\n",{mode:0o600,flag:"wx",flush:true});
  console.log(JSON.stringify(receipt));
 }catch(error){if(!commitStarted)await db.query("ROLLBACK");throw error;}
 finally{db.release();await pool.end();await corePool.end();}
}
if(process.argv[1]?.endsWith("protected-account-install.ts")||process.argv[1]?.endsWith("/install.cjs"))void main().catch((error:{code?:string})=>{
 console.error(JSON.stringify({status:"BLOCKED",operation:"protected-account-cycle",stage,code:error.code??"VALIDATION",commitStarted,
  requirement:commitStarted?"Preserve recovery; independently inspect uncertain commit. Do not retry.":"Transaction refused; preserve evidence. Do not retry automatically."}));process.exitCode=1;
});
