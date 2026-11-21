import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile,open,rename,unlink,realpath} from "node:fs/promises";
import {join} from "node:path";
import {Pool} from "pg";
import {fingerprint} from "../../lib/platform/canonical/model";
import original from "../../docs/c0-source-aware-run-proposal.json";
import {compileWholeSiteContinuation,type WholeSiteContinuation} from "../../lib/platform/intake/presence-whole-site-continuation";
import {privateWorkflowBytes,privateWorkflowFile,verifyDirectory} from "../../lib/platform/intake/protected-presence-workflow";
import {summarizePresenceWorkflowUsage} from "../../lib/platform/intake/intelligent-responses";
import type {PresenceWorkflowGrant} from "../../lib/platform/intake/presence-workflow-provider";
import type {WorkflowContext} from "../../lib/platform/intake/presence-workflow";
const sha=(b:Buffer)=>createHash("sha256").update(b).digest("hex");
let stage="arguments";
async function save(file:string,bytes:Buffer){const f=await open(file,"wx",0o600);try{await f.writeFile(bytes);await f.sync()}finally{await f.close()}}
/** Same existing case; only explicit resource/sequence fields. No provider, DB mutation, token or expiry change. */
export async function wholeSiteContinuation(mode:string,authorization:string,round?:string){
 assert.ok(process.platform==="linux"&&process.env.NODE_ENV!=="production"&&["PREFLIGHT","APPLY"].includes(mode)&&/^[a-f0-9]{64}$/.test(authorization));
 assert.ok(round===undefined||round==="customer-facing");
 const home=await realpath(process.env.HOME??""),parent=join(home,"miopages-private-acceptance");
 const runtime=join(parent,"p0-source-aware-c0-runtime"),code=join(runtime,round?"customer-facing-"+authorization.slice(0,8):"correction-10");
 const root=join(parent,"presence-evaluation",original.destination.intakeId);
 for(const dir of [parent,runtime,code,root,join(root,"usage")])await verifyDirectory(dir);
 const manifest=await privateWorkflowBytes(join(code,round?"docs/c0-customer-facing-round.json":"docs/c0-whole-site-continuation.json"),code);
 assert.equal(sha(manifest),authorization);
 const plan=JSON.parse(manifest.toString()) as WholeSiteContinuation;
 assert.equal(plan.caseId,original.destination.intakeId);assert.deepEqual(plan.scope,original.destination.scope);
 const password=(await readFile(join(parent,"p0-22-c0-runtime/db/password"),"utf8")).trim();assert.match(password,/^[a-f0-9]{64}$/);
 const url=new URL("postgresql://postgres@127.0.0.1:36339/migration_rehearsal_"+plan.caseId.replaceAll("-",""));url.password=password;
 const db=new Pool({connectionString:url.href,connectionTimeoutMillis:5000}),locks:{path:string;handle:Awaited<ReturnType<typeof open>>}[]=[];
 let complete=false;
 try{
  stage="exclusive-idle-case-and-ledger";
  for(const path of [join(root,"source-evidence-repair.lock"),join(root,"usage/onboarding-usage.json.lock")]){
   const handle=await open(path,"wx",0o600);locks.push({path,handle});await handle.writeFile(authorization);await handle.sync();
  }
  const c=await db.connect();
  try{
   await c.query("BEGIN");
   // The worker inserts through this exact table. Freeze appends while verifying/rebinding private custody.
   await c.query("SET LOCAL lock_timeout='3s'");
   await c.query("LOCK TABLE public.presence_workflow_events IN SHARE MODE");
   const identity=(await c.query("SELECT current_database() d,host(inet_server_addr()) h")).rows[0];
   assert.equal(identity.d,url.pathname.slice(1));assert.equal(identity.h,"127.0.0.1");
   const event=(await c.query("SELECT version,payload,digest FROM public.presence_workflow_events WHERE intake_id=$1 ORDER BY version DESC LIMIT 1",[plan.caseId])).rows[0];
   assert.equal(event.version,plan.baseVersion);assert.equal(event.digest,plan.stateDigest);assert.equal(fingerprint(event.payload),event.digest);
   stage="exact-custody-and-existing-accounting";
   const stored=await privateWorkflowFile<{context:WorkflowContext}>(join(root,"context.json"),root,48_000_000);
   const before=await privateWorkflowBytes(join(root,"grant.json"),root);
   const grant=JSON.parse(before.toString()) as PresenceWorkflowGrant;
   const bindingBytes=await privateWorkflowBytes(join(root,"activation.json"),root),binding=JSON.parse(bindingBytes.toString());
   assert.equal(binding.grant,fingerprint(grant));
   const ledger=await privateWorkflowBytes(join(root,"usage/onboarding-usage.json"),root,48_000_000);
   const usage=await summarizePresenceWorkflowUsage(join(root,"usage"),grant.ledger,fingerprint(stored.context.scope));
   assert.equal(usage.total.uncertain,0);assert.equal(usage.total.heldMicros,plan.usage.heldMicros);assert.equal(usage.total.requests,plan.usage.requests);
   const next=compileWholeSiteContinuation(grant,stored.context,event.payload,ledger,plan);
   const nextBytes=Buffer.from(JSON.stringify(next)+"\n"),nextBinding=Buffer.from(JSON.stringify({...binding,grant:fingerprint(next)})+"\n");
   if(mode==="PREFLIGHT"){await c.query("ROLLBACK");complete=true;return{status:"PASS",operation:"whole-site-continuation-preflight",authorization,version:event.version,
    beforeGrant:fingerprint(grant),nextGrant:fingerprint(next),ledgerUnchanged:true,providerCalls:0}}
   stage="retain-before-and-after-resource-binding";
   for(const [name,oldBytes,newBytes]of [["grant.json",before,nextBytes],["activation.json",bindingBytes,nextBinding]] as const){
    await save(join(root,name+".before-whole-site-"+authorization.slice(0,8)),oldBytes);
    await save(join(root,name+".whole-site-"+authorization.slice(0,8)+".next"),newBytes);
   }
   assert.equal(sha(await privateWorkflowBytes(join(root,"usage/onboarding-usage.json"),root,48_000_000)),plan.ledgerSha256);
   assert.deepEqual(await privateWorkflowBytes(join(root,"grant.json"),root),before);
   assert.deepEqual(await privateWorkflowBytes(join(root,"activation.json"),root),bindingBytes);
   stage="explicit-resource-only-rebinding";
   for(const name of ["grant.json","activation.json"])await rename(join(root,name+".whole-site-"+authorization.slice(0,8)+".next"),join(root,name));
   assert.deepEqual(await privateWorkflowBytes(join(root,"grant.json"),root),nextBytes);
   assert.deepEqual(await privateWorkflowBytes(join(root,"activation.json"),root),nextBinding);
   assert.equal(sha(await privateWorkflowBytes(join(root,"usage/onboarding-usage.json"),root,48_000_000)),plan.ledgerSha256);
   assert.equal((await c.query("SELECT max(version) v FROM public.presence_workflow_events WHERE intake_id=$1",[plan.caseId])).rows[0].v,plan.baseVersion);
   await c.query("COMMIT");
   await save(join(root,"whole-site-continuation-"+authorization.slice(0,8)+".receipt.json"),Buffer.from(JSON.stringify({
    authorization,at:new Date().toISOString(),version:plan.baseVersion,beforeGrant:fingerprint(grant),nextGrant:fingerprint(next),
    ledgerSha256:plan.ledgerSha256,caseUnchanged:true,providerCalls:0,expiresAt:plan.expiresAt})+"\n"));
   complete=true;
   return{status:"PASS",operation:"whole-site-continuation",authorization,version:plan.baseVersion,grant:fingerprint(next),ledgerUnchanged:true,providerCalls:0};
  }catch(error){await c.query("ROLLBACK");throw error}finally{c.release()}
 }finally{
  // On uncertainty retain locks and the complete before/after custody; never silently retry.
  for(const lock of locks){await lock.handle.close();if(complete)await unlink(lock.path)}
  await db.end();
 }
}
if(process.argv[1]&&/source-aware-continuation\.(ts|cjs)$/.test(process.argv[1])){
 const[mode,authorization,round,...extra]=process.argv.slice(2);
 (extra.length?Promise.reject(Error("Exact operation required")):wholeSiteContinuation(mode,authorization,round)).then(result=>console.log(JSON.stringify(result))).catch(()=>{
  console.error(JSON.stringify({status:"BLOCKED",operation:"whole-site-continuation",stage,requirement:"Preserve locks, original grant, ledger and before/after files. Inspect before retry; no provider dispatch."}));process.exitCode=1;
 });
}
