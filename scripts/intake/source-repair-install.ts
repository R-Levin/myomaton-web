import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile,open,rename,realpath,lstat} from "node:fs/promises";
import {join} from "node:path";
import {Pool} from "pg";
import plan from "../../docs/c0-source-recovery-amendment.json";
import {fingerprint} from "../../lib/platform/canonical/model";
import {compileSourceRepair,sourceRepairIndex,verifySourceRepairBytes,type SourceRepairPlan} from "../../lib/platform/intake/presence-source-repair";
import {privateWorkflowBytes,privateWorkflowFile,verifyDirectory} from "../../lib/platform/intake/protected-presence-workflow";
import type {PresenceWorkflowGrant} from "../../lib/platform/intake/presence-workflow-provider";
const sha=(b:Buffer)=>createHash("sha256").update(b).digest("hex");
export const sourceRepairManifestSha256="76bb9ca171c604f30007bf0ee3ce0706b1a6c4b8d5dd18995647b2e248083b53";
let stage="arguments";
async function save(path:string,bytes:Buffer){
 let file;try{file=await open(path,"wx",0o600)}catch(error){
  if((error as NodeJS.ErrnoException).code!=="EEXIST")throw error;
  const m=await lstat(path);assert.ok(m.isFile()&&!m.isSymbolicLink()&&m.uid===process.getuid?.()&&(m.mode&0o777)===0o600&&await realpath(path)===path);
  assert.deepEqual(await readFile(path),bytes);return;
 }
 try{await file.writeFile(bytes);await file.sync()}finally{await file.close()}
}
/** Fixed same-case source-only operation. No provider key, privilege change,
 * migration, ledger rewrite, token renewal, old-source overwrite or publication. */
export async function installSourceRepair(){
 assert.ok(process.platform==="linux"&&process.env.NODE_ENV!=="production");
 const home=await realpath(process.env.HOME??""),parent=join(home,"miopages-private-acceptance"),runtime=join(parent,"p0-source-aware-c0-runtime");
 const root=join(parent,"presence-evaluation",plan.scope.intakeId),inbound=join(runtime,"source-recovery-inputs");
 for(const dir of [parent,runtime,root,join(root,"originals"),inbound])await verifyDirectory(dir);
 stage="manifest-and-existing-authority";
 assert.equal(sha(await readFile("docs/c0-source-recovery-amendment.json")),sourceRepairManifestSha256);
 const grantBytes=await privateWorkflowBytes(join(root,"grant.json"),root),grant=JSON.parse(grantBytes.toString()) as PresenceWorkflowGrant;
 const bindingBytes=await privateWorkflowBytes(join(root,"activation.json"),root),binding=JSON.parse(bindingBytes.toString()) as {activation:string;grant:string};
 assert.equal(sha(grantBytes),plan.previousGrantSha256);assert.equal(binding.grant,fingerprint(grant));
 assert.equal(grant.expiresAt,Date.parse(plan.expiresAt));assert.ok(Date.now()<grant.expiresAt);
 const scope=(await privateWorkflowFile<{context:{intakeId:string;scope:object}}>(join(root,"context.json"),root)).context;
 assert.equal(scope.intakeId,plan.scope.intakeId);
 assert.deepEqual(scope.scope,{webPresenceId:plan.scope.webPresenceId,managedSiteId:plan.scope.managedSiteId});
 const ledger=await privateWorkflowBytes(join(root,"usage/onboarding-usage.json"),root);
 assert.equal(sha(ledger),plan.ledgerSha256);
 const attempts=JSON.parse(ledger.toString()).attempts.slice(grant.ledger.baselineAttempts);
 assert.ok(attempts.every((r:{status:string})=>r.status==="completed"),"No uncertain/pending dispatch may be amended");
 const next=compileSourceRepair(grant,plan as unknown as SourceRepairPlan,sourceRepairManifestSha256);
 stage="exact-current-case-readback";
 const password=(await readFile(join(parent,"p0-22-c0-runtime/db/password"),"utf8")).trim();
 assert.match(password,/^[a-f0-9]{64}$/);
 const url=new URL("postgresql://postgres@127.0.0.1:36339/migration_rehearsal_"+plan.scope.intakeId.replaceAll("-",""));url.password=password;
 const db=new Pool({connectionString:url.href,options:"-c default_transaction_read_only=on",connectionTimeoutMillis:5000});
 try{
  const {rows:[identity]}=await db.query("SELECT current_database() AS name,host(inet_server_addr()) AS host");
  assert.equal(identity.name,url.pathname.slice(1));assert.equal(identity.host,"127.0.0.1");
  const {rows:[event]}=await db.query("SELECT version,digest,payload FROM presence_workflow_events WHERE intake_id=$1 ORDER BY version DESC LIMIT 1",[plan.scope.intakeId]);
  assert.equal(event.version,plan.baseVersion);assert.equal(event.digest,plan.previousStateDigest);assert.equal(fingerprint(event.payload),event.digest);
  assert.equal(event.payload.work,null);assert.equal(event.payload.failure,null);assert.equal(event.payload.operatorReview,null);
 }finally{await db.end()}
 stage="complete-source-custody";
 for(const source of next.originalMaterials!.records.filter(s=>plan.additionalMaterials.some(a=>a.id===s.id))){
  const input=await privateWorkflowBytes(join(inbound,source.sha256+".source"),inbound);
  verifySourceRepairBytes(source,input);
  await save(join(root,"originals",source.sha256+".source"),input);
 }
 const oldIndexBytes=await privateWorkflowBytes(join(root,"originals/index.json"),root);
 const newIndexBytes=Buffer.from(JSON.stringify(sourceRepairIndex(next,JSON.parse(oldIndexBytes.toString())))+"\n");
 const nextBytes=Buffer.from(JSON.stringify(next)+"\n"),nextBindingBytes=Buffer.from(JSON.stringify({...binding,grant:fingerprint(next)})+"\n");
 await save(join(root,"originals/index.before-source-repair.json"),oldIndexBytes);
 await save(join(root,"originals/index.source-repair-next"),newIndexBytes);
 await save(join(root,"grant.before-source-repair.json"),grantBytes);await save(join(root,"activation.before-source-repair.json"),bindingBytes);
 await save(join(root,"grant.source-repair-next"),nextBytes);await save(join(root,"activation.source-repair-next"),nextBindingBytes);
 assert.deepEqual(await privateWorkflowBytes(join(root,"grant.json"),root),grantBytes);
 assert.deepEqual(await privateWorkflowBytes(join(root,"activation.json"),root),bindingBytes);
 assert.equal(sha(await privateWorkflowBytes(join(root,"usage/onboarding-usage.json"),root)),plan.ledgerSha256);
 stage="source-only-binding";
 assert.deepEqual(await privateWorkflowBytes(join(root,"originals/index.json"),root),oldIndexBytes);
 await rename(join(root,"originals/index.source-repair-next"),join(root,"originals/index.json"));
 await rename(join(root,"grant.source-repair-next"),join(root,"grant.json"));
 await rename(join(root,"activation.source-repair-next"),join(root,"activation.json"));
 assert.deepEqual(await privateWorkflowBytes(join(root,"originals/index.json"),root),newIndexBytes);
 assert.deepEqual(await privateWorkflowBytes(join(root,"grant.json"),root),nextBytes);
 assert.deepEqual(await privateWorkflowBytes(join(root,"activation.json"),root),nextBindingBytes);
 assert.equal(sha(await privateWorkflowBytes(join(root,"usage/onboarding-usage.json"),root)),plan.ledgerSha256);
 await save(join(root,"source-repair-receipt.json"),Buffer.from(JSON.stringify({manifest:sourceRepairManifestSha256,baseVersion:plan.baseVersion,
  previousGrant:plan.previousGrantDigest,grant:fingerprint(next),materials:fingerprint(next.originalMaterials!.records),
  added:plan.additionalMaterials.map(s=>({id:s.id,sha256:s.sha256,bytes:s.bytes})),ledgerUnchanged:true,at:new Date().toISOString()})+"\n"));
 return{status:"PASS",operation:"install-source-only-repair",manifest:sourceRepairManifestSha256,baseVersion:plan.baseVersion,
  addedOriginals:plan.additionalMaterials.length,knowledgeAuthorityUnchanged:true,ledgerUnchanged:true,limitsUnchanged:true,providerCalls:0};
}
if(process.argv[1]?.endsWith("source-repair-install.cjs")||process.argv[1]?.endsWith("source-repair-install.ts")){
 if(process.argv[2]!=="APPLY-OWNER-DIRECTED-SOURCE-REPAIR"||process.argv.length!==3)throw Error("Fixed operation required");
 installSourceRepair().then(result=>console.log(JSON.stringify(result))).catch(()=>{console.log(JSON.stringify({status:"BLOCKED",operation:"install-source-only-repair",stage,
  requirement:"Preserve sources, backups, grant/binding and ledger; inspect readback before any retry. No provider request was made."}));process.exitCode=1});
}
