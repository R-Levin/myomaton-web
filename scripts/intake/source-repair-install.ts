import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile,open,rename,realpath,lstat,mkdir,unlink} from "node:fs/promises";
import {join} from "node:path";
import {Pool} from "pg";
import plan from "../../docs/c0-source-recovery-amendment.json";
import {fingerprint} from "../../lib/platform/canonical/model";
import {compileSourceRepair,compileSourceEvidenceRepair,sourceRepairIndex,verifySourceRepairBytes,type SourceRepairPlan,type SourceEvidenceRepairPlan} from "../../lib/platform/intake/presence-source-repair";
import {PresenceWorkflow,type WorkflowContext} from "../../lib/platform/intake/presence-workflow";
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
 const operation=process.argv[2],authorization=process.argv[3];
 const action=operation==="INSPECT-SOURCE-EVIDENCE"&&process.argv.length===3?inspectSourceEvidenceRepair():
  operation==="APPLY-OWNER-DIRECTED-SOURCE-REPAIR"&&process.argv.length===3?installSourceRepair():
  ["PREPARE-SOURCE-EVIDENCE","APPLY-SOURCE-EVIDENCE"].includes(operation)&&process.argv.length===4?
   installSourceEvidenceRepair(authorization,operation==="APPLY-SOURCE-EVIDENCE"):Promise.reject(Error("Fixed operation required"));
 action.then(result=>console.log(JSON.stringify(result))).catch(()=>{console.log(JSON.stringify({status:"BLOCKED",operation:["INSPECT-SOURCE-EVIDENCE","APPLY-OWNER-DIRECTED-SOURCE-REPAIR","PREPARE-SOURCE-EVIDENCE","APPLY-SOURCE-EVIDENCE"].includes(operation)?operation:"unrecognized",stage,
  requirement:"Preserve sources, prepared bundle, lock, grant/context/binding and ledger; independently inspect before retry. No provider request was made."}));process.exitCode=1});
}

/** Existing source-repair entrypoint, explicit v2 manifest and prepare/apply.
 * Reads no provider credential. No paid operation can be reached here. */
export async function installSourceEvidenceRepair(authorization:string,apply=false){
 assert.ok(process.platform==="linux"&&process.env.NODE_ENV!=="production"&&/^[a-f0-9]{64}$/.test(authorization));
 const parent=join(await realpath(process.env.HOME??""),"miopages-private-acceptance");
 const root=join(parent,"presence-evaluation",plan.scope.intakeId);
 for(const dir of [parent,root,join(root,"originals")])await verifyDirectory(dir);
 stage="exact-reasoning-manifest";
 const manifest=await privateWorkflowBytes(join(root,"source-evidence-repair-plan.json"),root);
 assert.equal(sha(manifest),authorization);
 const repair=JSON.parse(manifest.toString()) as SourceEvidenceRepairPlan;
 const bundleDir=join(root,"source-evidence-repair-"+authorization);
 if(!apply){try{await mkdir(bundleDir,{mode:0o700})}catch(e){if((e as NodeJS.ErrnoException).code!=="EEXIST")throw e}}
 await verifyDirectory(bundleDir);
 type Bundle={authorization:string;before:Record<string,string>;after:Record<string,string>;reviewed:string|null;nextContext:string;nextGrant:string};
 let bundle:Bundle;
 if(!apply){
  const grantText=(await privateWorkflowBytes(join(root,"grant.json"),root)).toString(),grant=JSON.parse(grantText) as PresenceWorkflowGrant;
  const maximum=grant.originalMaterials?.requestBytes??256000;
  const contextText=(await privateWorkflowBytes(join(root,"context.json"),root,maximum)).toString();
  const stored=JSON.parse(contextText) as {context:WorkflowContext;token:string};
  assert.equal(stored.context.intakeId,plan.scope.intakeId);
  assert.deepEqual(stored.context.scope,{webPresenceId:plan.scope.webPresenceId,managedSiteId:plan.scope.managedSiteId});
  assert.match(stored.token,/^[a-f0-9]{64}$/);
  assert.ok(Date.now()<grant.expiresAt);
  const activationText=(await privateWorkflowBytes(join(root,"activation.json"),root)).toString();
  const activation=JSON.parse(activationText);assert.equal(activation.grant,fingerprint(grant));
  const material=await Promise.all(repair.reasoningMaterialIds.map(async id=>{
   const source=grant.originalMaterials!.records.find(s=>s.id===id);assert.ok(source);
   const bytes=await privateWorkflowBytes(join(root,"originals",source.sha256+".source"),root,maximum);
   return{source,bytes};
  }));
  const next=compileSourceEvidenceRepair(stored.context,grant,repair,material,authorization);
  const before:Record<string,string>={"context.json":contextText,"grant.json":grantText,"activation.json":activationText};
  const after:Record<string,string>={"context.json":JSON.stringify({...stored,context:next.context})+"\n",
   "grant.json":JSON.stringify(next.grant)+"\n","activation.json":JSON.stringify({...activation,grant:fingerprint(next.grant)})+"\n"};
  let reviewed:string|null=null;
  try{
   const selectionText=(await privateWorkflowBytes(join(root,"media/stock-selection.json"),root,maximum)).toString(),selection=JSON.parse(selectionText);
   assert.equal(selection.contextDigest,grant.contextDigest);
   assert.ok(stored.context.evidence.some(s=>s.id==="stock-discovery"&&s.kind==="public-research"));
   before["media/stock-selection.json"]=selectionText;
   after["media/stock-selection.json"]=JSON.stringify({...selection,contextDigest:next.grant.contextDigest})+"\n";
  }catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e}
  try{reviewed=(await privateWorkflowBytes(join(root,"media/reviewed-stock-context.json"),root,maximum)).toString();
   assert.equal(JSON.parse(reviewed).contextDigest,grant.contextDigest);
  }catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e}
  bundle={authorization,before,after,reviewed,nextContext:fingerprint(next.context),nextGrant:fingerprint(next.grant)};
  await save(join(bundleDir,"bundle.json"),Buffer.from(JSON.stringify(bundle)+"\n"));
 }else bundle=await privateWorkflowFile<Bundle>(join(bundleDir,"bundle.json"),root,48_000_000);
 assert.equal(bundle.authorization,authorization);
 const oldStored=JSON.parse(bundle.before["context.json"]) as {context:WorkflowContext;token:string};
 const oldGrant=JSON.parse(bundle.before["grant.json"]) as PresenceWorkflowGrant;
 const nextStored=JSON.parse(bundle.after["context.json"]) as {context:WorkflowContext;token:string};
 const nextGrant=JSON.parse(bundle.after["grant.json"]) as PresenceWorkflowGrant;
 assert.deepEqual(Object.keys(bundle.before).sort(),Object.keys(bundle.after).sort());
 assert.ok(Object.keys(bundle.before).every(name=>["context.json","grant.json","activation.json","media/stock-selection.json"].includes(name)));
 assert.equal(oldStored.token,nextStored.token);assert.equal(nextStored.context.intakeId,plan.scope.intakeId);
 assert.deepEqual(nextStored.context.scope,oldStored.context.scope);
 const material=await Promise.all(repair.reasoningMaterialIds.map(async id=>{
  const source=oldGrant.originalMaterials!.records.find(s=>s.id===id);assert.ok(source);
  return{source,bytes:await privateWorkflowBytes(join(root,"originals",source.sha256+".source"),root,oldGrant.originalMaterials!.requestBytes)};
 }));
 const verified=compileSourceEvidenceRepair(oldStored.context,oldGrant,repair,material,authorization);
 assert.equal(fingerprint(verified.context),bundle.nextContext);assert.equal(fingerprint(verified.grant),bundle.nextGrant);
 assert.deepEqual(verified.context,nextStored.context);assert.deepEqual(verified.grant,nextGrant);
 assert.equal(bundle.after["context.json"],JSON.stringify({...oldStored,context:verified.context})+"\n");
 const oldActivation=JSON.parse(bundle.before["activation.json"]),newActivation=JSON.parse(bundle.after["activation.json"]);
 assert.equal(oldActivation.grant,fingerprint(oldGrant));
 assert.deepEqual(newActivation,{...oldActivation,grant:fingerprint(nextGrant)});
 if(bundle.before["media/stock-selection.json"]){
  const selected=JSON.parse(bundle.before["media/stock-selection.json"]);
  assert.equal(selected.contextDigest,oldGrant.contextDigest);
  assert.deepEqual(JSON.parse(bundle.after["media/stock-selection.json"]),{...selected,contextDigest:nextGrant.contextDigest});
 }
 assert.equal(sha(await privateWorkflowBytes(join(root,"usage/onboarding-usage.json"),root,oldGrant.originalMaterials!.requestBytes)),repair.ledgerSha256);
 const password=(await readFile(join(parent,"p0-22-c0-runtime/db/password"),"utf8")).trim();assert.match(password,/^[a-f0-9]{64}$/);
 const url=new URL("postgresql://postgres@127.0.0.1:36339/migration_rehearsal_"+plan.scope.intakeId.replaceAll("-",""));url.password=password;
 const db=new Pool({connectionString:url.href,connectionTimeoutMillis:5000,...(!apply&&{options:"-c default_transaction_read_only=on"})});
 let locked=false;
 const lock=join(root,"source-evidence-repair.lock");
 try{
  stage="reasoning-repair-preflight";
  if(apply){const h=await open(lock,"wx",0o600);try{await h.writeFile(authorization);await h.sync()}finally{await h.close()}locked=true}
  const c=await db.connect();
  try{
   await c.query(apply?"BEGIN":"BEGIN READ ONLY");
   const {rows:[identity]}=await c.query("SELECT current_database() d,host(inet_server_addr()) h");
   assert.equal(identity.d,url.pathname.slice(1));assert.equal(identity.h,"127.0.0.1");
   const {rows:[event]}=await c.query("SELECT version,payload,digest FROM presence_workflow_events WHERE intake_id=$1 ORDER BY version DESC LIMIT 1",[plan.scope.intakeId]);
   assert.equal(event.version,repair.baseVersion);assert.equal(event.digest,repair.previousStateDigest);
   assert.equal(fingerprint(event.payload),event.digest);assert.ok(!event.payload.work&&!event.payload.failure&&!event.payload.operatorReview);
   for(const[name,text]of Object.entries(bundle.before))assert.equal((await privateWorkflowBytes(join(root,name),root,48_000_000)).toString(),text);
   if(!apply){await c.query("ROLLBACK");return{status:"PASS",operation:"prepare-source-evidence",manifest:authorization,baseVersion:event.version,
    citableAnalysisSources:verified.addedEvidence.length,claimsUnchanged:true,limitsUnchanged:true,providerCalls:0}}
   stage="append-only-reasoning-repair";
   const workflow=new PresenceWorkflow(c as unknown as Pool,{mode:"provider",marketingAuthority:nextGrant.marketingAuthority,
    sourceRepair:nextGrant.sourceRepair,maxEditorialRevisions:nextGrant.maxEditorialRevisions,maxCommercialReplans:nextGrant.maxCommercialReplans,
    run:async()=>{throw Error("Source repair cannot dispatch")},recover:async()=>{throw Error("Source repair cannot dispatch")}}, {},Date.now,"disposable");
   const view=await workflow.reassessFromRepairedSources(nextStored.context,repair.baseVersion,
    {id:"local-evaluation-operator",role:"operator",simulated:false,authority:"Exact source-evidence repair "+authorization},authorization);
   assert.equal(view?.next,"report");assert.equal(view.version,repair.baseVersion+1);
   stage="reasoning-custody-binding";
   for(const[name,text]of Object.entries(bundle.after)){
    const staged=join(bundleDir,name.replaceAll("/","-")+".next");await save(staged,Buffer.from(text));
    await rename(staged,join(root,name));
   }
   if(bundle.reviewed!==null){
    const current=join(root,"media/reviewed-stock-context.json");
    assert.equal((await privateWorkflowBytes(current,root,48_000_000)).toString(),bundle.reviewed);
    await rename(current,join(bundleDir,"previous-reviewed-stock-context.json"));
   }
   for(const[name,text]of Object.entries(bundle.after))assert.equal((await privateWorkflowBytes(join(root,name),root,48_000_000)).toString(),text);
   assert.equal(sha(await privateWorkflowBytes(join(root,"usage/onboarding-usage.json"),root,48_000_000)),repair.ledgerSha256);
   await c.query("COMMIT");
   stage="independent-reasoning-readback";
   const {rows:[readback]}=await db.query("SELECT version,payload FROM presence_workflow_events WHERE intake_id=$1 ORDER BY version DESC LIMIT 1",[plan.scope.intakeId]);
   assert.equal(readback.version,view.version);assert.equal(readback.payload.contextDigest,nextGrant.contextDigest);
   assert.equal(readback.payload.sourceRecovery.authorization,authorization);
   await save(join(bundleDir,"receipt.json"),Buffer.from(JSON.stringify({manifest:authorization,version:view.version,context:bundle.nextContext,grant:bundle.nextGrant,
    citableAnalysisSources:verified.addedEvidence.length,publicClaimAuthorityUnchanged:true,ledgerUnchanged:true,privatePlacementReviewCarried:false,providerCalls:0})+"\n"));
   await unlink(lock);locked=false;
   return{status:"PASS",operation:"apply-source-evidence",manifest:authorization,version:view.version,citableAnalysisSources:verified.addedEvidence.length,
    ledgerUnchanged:true,claimsUnchanged:true,limitsUnchanged:true,providerCalls:0};
  }catch(e){try{await c.query("ROLLBACK")}catch{}throw e}finally{c.release()}
 }finally{await db.end();if(locked)stage+=":retain-lock-and-bundle-for-independent-recovery"}
}

/** Exact no-write inspection uses the same compiler and canonical digest as apply.
 * Emits source IDs/hashes/counts only; protected context and tokens stay on host. */
export async function inspectSourceEvidenceRepair(){
 assert.ok(process.platform==="linux"&&process.env.NODE_ENV!=="production");
 const parent=join(await realpath(process.env.HOME??""),"miopages-private-acceptance"),root=join(parent,"presence-evaluation",plan.scope.intakeId);
 for(const dir of [parent,root,join(root,"originals")])await verifyDirectory(dir);
 stage="read-only-source-custody";
 const grantBytes=await privateWorkflowBytes(join(root,"grant.json"),root),grant=JSON.parse(grantBytes.toString()) as PresenceWorkflowGrant;
 assert.ok(grant.originalMaterials&&Date.now()<grant.expiresAt);
 const contextBytes=await privateWorkflowBytes(join(root,"context.json"),root,grant.originalMaterials.requestBytes);
 const stored=JSON.parse(contextBytes.toString()) as {context:WorkflowContext;token:string};
 assert.equal(stored.context.intakeId,plan.scope.intakeId);assert.equal(fingerprint(stored.context),grant.contextDigest);
 assert.deepEqual(stored.context.scope,{webPresenceId:plan.scope.webPresenceId,managedSiteId:plan.scope.managedSiteId});
 const ledgerBytes=await privateWorkflowBytes(join(root,"usage/onboarding-usage.json"),root,grant.originalMaterials.requestBytes);
 assert.ok(JSON.parse(ledgerBytes.toString()).attempts.slice(grant.ledger.baselineAttempts).every((r:{status:string})=>r.status==="completed"));
 const password=(await readFile(join(parent,"p0-22-c0-runtime/db/password"),"utf8")).trim();assert.match(password,/^[a-f0-9]{64}$/);
 const url=new URL("postgresql://postgres@127.0.0.1:36339/migration_rehearsal_"+plan.scope.intakeId.replaceAll("-",""));url.password=password;
 const db=new Pool({connectionString:url.href,options:"-c default_transaction_read_only=on",connectionTimeoutMillis:5000});
 try{
  stage="read-only-source-case";
  await db.query("BEGIN READ ONLY");
  const {rows:[identity]}=await db.query("SELECT current_database() d,host(inet_server_addr()) h");
  assert.equal(identity.d,url.pathname.slice(1));assert.equal(identity.h,"127.0.0.1");
  const {rows:[event]}=await db.query("SELECT version,payload,digest FROM presence_workflow_events WHERE intake_id=$1 ORDER BY version DESC LIMIT 1",[plan.scope.intakeId]);
  assert.equal(fingerprint(event.payload),event.digest);assert.equal(event.payload.contextDigest,grant.contextDigest);
  assert.ok(!event.payload.work&&!event.payload.failure&&!event.payload.operatorReview);
  const proposed={version:2 as const,contextDigest:grant.contextDigest,baseVersion:event.version,previousStateDigest:event.digest,
   previousGrantDigest:fingerprint(grant),previousMaterialsDigest:fingerprint(grant.originalMaterials.records),ledgerSha256:sha(ledgerBytes),
   expiresAt:new Date(grant.expiresAt).toISOString(),reasoningMaterialIds:plan.additionalMaterials.map(row=>row.id),
   status:"PROPOSED_NOT_APPLIED",scope:plan.scope,
   operation:"Bind only the five already-authorized originals as analytical evidence and reopen assessment. Preserve all history, public claims, financial/request/retry/expiry limits. No model dispatch, protected Core/WordPress change or publication."};
  const manifestSha256=sha(Buffer.from(JSON.stringify(proposed,null,2)+"\n"));
  const material=await Promise.all(proposed.reasoningMaterialIds.map(async id=>{
   const source=grant.originalMaterials!.records.find(row=>row.id===id);assert.ok(source);
   return{source,bytes:await privateWorkflowBytes(join(root,"originals",source.sha256+".source"),root,grant.originalMaterials!.requestBytes)};
  }));
  stage="read-only-source-compilation";
  const next=compileSourceEvidenceRepair(stored.context,grant,proposed,material,manifestSha256);
  const claims=(g:PresenceWorkflowGrant)=>g.marketingAuthority!.sources.filter(row=>row.use==="business-fact"||row.use==="staffed-offer");
  assert.equal(fingerprint(claims(next.grant)),fingerprint(claims(grant)));
  assert.deepEqual(await privateWorkflowBytes(join(root,"grant.json"),root),grantBytes);
  assert.deepEqual(await privateWorkflowBytes(join(root,"context.json"),root,grant.originalMaterials.requestBytes),contextBytes);
  assert.deepEqual(await privateWorkflowBytes(join(root,"usage/onboarding-usage.json"),root,grant.originalMaterials.requestBytes),ledgerBytes);
  await db.query("ROLLBACK");
  return{status:"PASS",operation:"inspect-source-evidence",manifest:proposed,manifestSha256,evidenceBefore:stored.context.evidence.length,
   evidenceAfter:next.context.evidence.length,nextContextDigest:next.grant.contextDigest,oldContextFileBytes:contextBytes.length,
   nextContextFileBytes:Buffer.byteLength(JSON.stringify({...stored,context:next.context})+"\n"),authorizedSourceEnvelope:grant.originalMaterials.requestBytes,
   publicClaimAuthorityUnchanged:true,ledgerUnchanged:true,caseWrites:0,providerCalls:0};
 }finally{await db.end()}
}
