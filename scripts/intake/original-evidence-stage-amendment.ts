import assert from "node:assert/strict";
import {readFile,writeFile,rename} from "node:fs/promises";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {Pool} from "pg";
import amendment from "../../docs/c0-original-evidence-stage-amendment.json";
import {fingerprint} from "../../lib/platform/canonical/model";
import {privateWorkflowBytes,privateWorkflowFile,verifyDirectory} from "../../lib/platform/intake/protected-presence-workflow";
import type {PresenceWorkflowGrant} from "../../lib/platform/intake/presence-workflow-provider";
import {openCommercialActivation} from "./commercial-evaluation-activation";
import {originalEvidenceApproval,originalEvidenceStageAmendmentSha,originalEvidenceStageGrant,originalEvidenceRuntimeFingerprint} from "./original-evidence-activation";
const sha=(b:Buffer)=>createHash("sha256").update(b).digest("hex");
/** Fixed operation; no DB writes, provider dispatch, token or authority reset. */
export async function applyOriginalEvidenceStages(home:string,url:string){
 const parent=join(home,"miopages-private-acceptance"),runtime=join(parent,"p0-original-evidence-c0-runtime");
 const root=join(parent,"presence-evaluation",amendment.caseId);
 await verifyDirectory(runtime);await verifyDirectory(root);
 assert.equal(sha(await readFile("docs/c0-original-evidence-stage-amendment.json")),originalEvidenceStageAmendmentSha);
 const activation=await privateWorkflowFile<Record<string,unknown>>(join(runtime,"activation.json"),runtime);
 assert.equal(activation.proposal,originalEvidenceApproval);assert.equal(activation.stageAmendment,undefined);
 const current=await privateWorkflowFile<PresenceWorkflowGrant>(join(root,"grant.json"),root);
 const binding=await privateWorkflowFile<{activation:string;grant:string}>(join(root,"activation.json"),root);
 const context=(await privateWorkflowFile<{context:never}>(join(root,"context.json"),root)).context;
 const ledger=await privateWorkflowBytes(join(root,"usage/onboarding-usage.json"),root);
 assert.equal(sha(ledger),amendment.baselineLedger);assert.equal(current.expiresAt,Date.parse(amendment.expiresAt));assert.ok(Date.now()<current.expiresAt);
 const compiled=await openCommercialActivation(parent,false,false,true),prepared=await compiled.compile(context);
 assert.equal(compiled.fingerprint,binding.activation);assert.equal(fingerprint(current),binding.grant);
 assert.equal(fingerprint(prepared.context),fingerprint(context));assert.equal(fingerprint(prepared.grant),fingerprint(current));
 const db=new Pool({connectionString:url});
 try{
  const c=await db.connect();try{await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
   const state=(await c.query("SELECT payload FROM public.presence_workflow_events ORDER BY version DESC LIMIT 1")).rows[0].payload;
   assert.equal(state.version,amendment.baselineVersion);assert.equal(state.work,null);assert.equal(state.failure,null);
   assert.equal(state.contextDigest,current.contextDigest);
  }finally{await c.query("ROLLBACK");c.release()}
 }finally{await db.end()}
 const next=originalEvidenceStageGrant(current),rows=JSON.parse(ledger.toString()).attempts.slice(54);
 for(const [stage,cap]of Object.entries(amendment.newStageCapsMicros)){
  const used=rows.filter((r:{workflowStage:string})=>r.workflowStage===stage).reduce((sum:number,r:{estimatedMicros?:number;reservedMicros:number;webSearchCalls?:number})=>sum+(r.webSearchCalls||r.estimatedMicros===undefined?r.reservedMicros:r.estimatedMicros),0);
  assert.ok(used<=cap,"Retained stage usage exceeds amended cap");
 }
 const nextActivation={...activation,stageAmendment:{sha256:originalEvidenceStageAmendmentSha,approvalRecord:amendment.approvalRecord}};
 const nextBinding={activation:originalEvidenceRuntimeFingerprint(nextActivation,next.expiresAt,current.originalMaterials!.records,current.marketingAuthority!.qualityReviewerId,prepared.brand.digest),grant:fingerprint(next)};
 const files=[
  {path:join(runtime,"activation.json"),before:await privateWorkflowBytes(join(runtime,"activation.json"),runtime),after:nextActivation},
  {path:join(root,"grant.json"),before:await privateWorkflowBytes(join(root,"grant.json"),root),after:next},
  {path:join(root,"activation.json"),before:await privateWorkflowBytes(join(root,"activation.json"),root),after:nextBinding},
 ];
 for(const file of files){await writeFile(file.path+".before-stage-amendment",file.before,{flag:"wx",mode:0o600});await writeFile(file.path+".stage-next",JSON.stringify(file.after)+"\n",{flag:"wx",mode:0o600})}
 assert.equal(sha(await privateWorkflowBytes(join(root,"usage/onboarding-usage.json"),root)),amendment.baselineLedger);
 for(const file of files)await rename(file.path+".stage-next",file.path);
 for(const file of files)assert.equal(fingerprint(JSON.parse(await readFile(file.path,"utf8"))),fingerprint(file.after));
 await writeFile(join(root,"stage-amendment-receipt.json"),JSON.stringify({approvalRecord:amendment.approvalRecord,amendment:originalEvidenceStageAmendmentSha,
  at:new Date().toISOString(),version:64,ledgerUnchanged:true,previousGrant:fingerprint(current),grant:fingerprint(next),changedStageCaps:amendment.newStageCapsMicros}),{flag:"wx",mode:0o600});
 return {version:64,amendment:originalEvidenceStageAmendmentSha,changedStageCaps:amendment.newStageCapsMicros,ledgerUnchanged:true,providerCalls:0,expiresAt:new Date(next.expiresAt).toISOString()};
}
