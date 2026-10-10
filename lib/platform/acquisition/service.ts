import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Pool, PoolClient } from "pg";
import { fingerprint, text } from "../canonical/model";
import { requireAssetUuid } from "../assets/model";
import { managedKey, provisionManagedObject, readManagedObject } from "../assets/local-storage";
import { prepareManagedBytes } from "../assets/ingestion";
import { assertContext } from "./context";
import { AcquisitionFailure, requestForTemplate, micros, POLICY_VERSION, TEMPLATE_VERSION, ITERATION_THREE_TEMPLATE, workIdentity, type Decision, type ImageProvider, type NeedContext } from "./contracts";

export type Work = {id:string;web_presence_id:string;context:NeedContext;context_digest:string;provider:string;model:string;template_version:string;iteration:number;status:string;version:number;attempts:number;retries:number;lease_token:string|null;lease_until:Date|null;budget_micros:number;reserved_micros:number;actual_micros:number|null;result:{code?:string}};
export type Candidate = {id:string;work_id:string;web_presence_id:string;revision:number;version:number;state:string;source_kind:string;provider:string;model:string;quarantine_key:string;bytes_digest:string;subject_digest:string;provenance_digest:string;provenance:Record<string,unknown>;width:number;height:number;mime_type:string;policy_version:string;expires_at:Date};

export function candidateSubject(c:Pick<Candidate,"id"|"web_presence_id"|"revision"|"bytes_digest"|"provenance_digest"|"width"|"height"|"mime_type"|"policy_version">) {
  return fingerprint({id:c.id,owner:c.web_presence_id,revision:c.revision,bytes:c.bytes_digest,provenance:c.provenance_digest,width:c.width,height:c.height,mime:c.mime_type,policy:c.policy_version});
}
export async function transaction<T>(pool:Pool, fn:(db:PoolClient)=>Promise<T>) {
  const db=await pool.connect();try{await db.query("BEGIN");const value=await fn(db);await db.query("COMMIT");return value;}catch(e){await db.query("ROLLBACK");throw e;}finally{db.release();}
}
export async function appendEvent(db:PoolClient,w:Pick<Work,"id"|"web_presence_id">,kind:string,payload:unknown,candidateId:string|null=null) {
  await db.query("INSERT INTO external_work_events(web_presence_id,work_id,candidate_id,kind,payload) VALUES($1,$2,$3,$4,$5)",[w.web_presence_id,w.id,candidateId,kind,JSON.stringify(payload)]);
}
export async function escalationEvidence(db:Pick<Pool|PoolClient,"query">,w:Work) {
  const rows=await db.query("SELECT id,payload FROM external_work_events WHERE web_presence_id=$1 AND work_id=$2 AND candidate_id IS NULL AND kind='decision' AND payload->>'subjectType'='acquisition-escalation'",[w.web_presence_id,w.id]);
  if(rows.rows.length!==1)return null;
  const event=rows.rows[0],p=event.payload;
  if(w.iteration!==3||w.template_version!==ITERATION_THREE_TEMPLATE||w.budget_micros!==1500000||w.attempts>1||w.retries!==0
    ||p.authority!=="local-operator"||p.role!=="operator"||!p.actor?.trim()||!p.reason?.trim()||!Number.isFinite(Date.parse(p.at))||p.decision!=="authorize-one-additional-attempt"
    ||p.scope?.webPresenceId!==w.web_presence_id||p.scope.newWorkId!==w.id||p.scope.contextDigest!==w.context_digest||p.scope.sectionId!==w.context.sectionId
    ||p.previous?.maxPaidIterations!==2||p.previous.budgetMicros!==1000000||p.previous.reservedMicros!==1000000||p.previous.capReached!==true
    ||p.limits?.maxPaidIterations!==3||p.limits.additionalAttempts!==1||p.limits.additionalReservedMicros!==500000||p.limits.budgetMicros!==1500000||p.limits.maxRetries!==0)return null;
  return {eventId:event.id as string,digest:fingerprint(p)};
}
async function ownedWork(db:PoolClient,owner:string,id:string):Promise<Work> {
  const r=await db.query("SELECT * FROM external_work WHERE web_presence_id=$1 AND id=$2 FOR UPDATE",[requireAssetUuid(owner),requireAssetUuid(id)]);
  if(r.rows.length!==1)throw Error("Unknown owned work");return r.rows[0];
}
export class AcquisitionService {
  constructor(readonly pool:Pool,readonly quarantineRoot:string) {}
  async list(owner:string) {
    const rows=await this.pool.query("SELECT id,capability,status,version,iteration,attempts,retries,reserved_micros,actual_micros,created_at FROM external_work WHERE web_presence_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100",[requireAssetUuid(owner)]);
    return rows.rows;
  }
  async create(context:NeedContext,provider:ImageProvider,budgetMicros:number,iteration=1,templateVersion=TEMPLATE_VERSION) {
    requestForTemplate(templateVersion);micros(budgetMicros);if(![1,2].includes(iteration))throw new AcquisitionFailure("budget");
    return transaction(this.pool,async db=>{
      await assertContext(db,context,fingerprint(context));
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`${context.webPresenceId}:${fingerprint(context)}`]);
      const previous=await db.query("SELECT w.*,c.state AS candidate_state FROM external_work w LEFT JOIN media_candidates c ON c.work_id=w.id WHERE w.web_presence_id=$1 AND w.context_digest=$2 ORDER BY iteration",[context.webPresenceId,fingerprint(context)]);
      const identity=workIdentity(context,{id:provider.id,model:provider.model},iteration,templateVersion);
      const duplicate=previous.rows.find(w=>w.identity===identity);if(duplicate)return duplicate as Work;
      if(previous.rows.length && (previous.rows.length!==1||iteration!==2||previous.rows[0].iteration!==1||previous.rows[0].budget_micros!==budgetMicros||!(["rejected","expired","revoked"].includes(previous.rows[0].candidate_state)||previous.rows[0].status==="failed"&&["invalid-response","validation"].includes(previous.rows[0].result.code))))throw Error("Explicit iteration requires rejected/terminal previous work");
      if(!previous.rows.length&&iteration!==1)throw Error("First iteration required");
      const r=await db.query(`INSERT INTO external_work(web_presence_id,capability,identity,context_digest,context,provider,model,template_version,iteration,budget_micros)
        VALUES($1,'image-generation',$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[context.webPresenceId,identity,fingerprint(context),JSON.stringify(context),provider.id,provider.model,templateVersion,iteration,budgetMicros]);
      const w=r.rows[0] as Work;
      const parent=previous.rows[0];let parentCandidate:unknown=null;
      if(parent?.candidate_state){
        const rows=await db.query("SELECT * FROM media_candidates WHERE web_presence_id=$1 AND work_id=$2",[context.webPresenceId,parent.id]);
        const c=rows.rows[0] as Candidate;
        const decisions=await db.query("SELECT id,payload FROM external_work_events WHERE web_presence_id=$1 AND work_id=$2 AND candidate_id=$3 AND kind='decision' ORDER BY created_at DESC,id DESC LIMIT 1",[context.webPresenceId,parent.id,c.id]);
        parentCandidate={workId:parent.id,candidateId:c.id,revision:c.revision,bytesDigest:c.bytes_digest,subjectDigest:c.subject_digest,provenanceDigest:c.provenance_digest,state:c.state,reviewEventId:decisions.rows[0]?.id??null,review:decisions.rows[0]?.payload??null};
      }
      await appendEvent(db,w,"queued",{contextDigest:w.context_digest,iteration,strategy:context.strategy,templateVersion,promptDigest:fingerprint(requestForTemplate(templateVersion)),parentCandidate});return w;
    });
  }
  async inspect(owner:string,id:string) {
    const work=await this.pool.query("SELECT * FROM external_work WHERE web_presence_id=$1 AND id=$2",[requireAssetUuid(owner),requireAssetUuid(id)]);
    if(work.rows.length!==1)throw Error("Unknown owned work");
    const candidates=await this.pool.query("SELECT * FROM media_candidates WHERE web_presence_id=$1 AND work_id=$2",[owner,id]);
    const events=await this.pool.query("SELECT * FROM external_work_events WHERE web_presence_id=$1 AND work_id=$2 ORDER BY created_at,id",[owner,id]);
    return {work:work.rows[0] as Work,candidates:candidates.rows as Candidate[],events:events.rows};
  }
  async dispatch(owner:string,id:string,provider:ImageProvider,reserveMicros:number) {
    micros(reserveMicros);
    const lease=await transaction(this.pool,async db=>{
      const w=await ownedWork(db,owner,id);
      if(w.status!=="queued")throw Error("Work already dispatched or terminal");
      let code:string|undefined;
      try{requestForTemplate(w.template_version);provider.assertConfigured();await assertContext(db,w.context,w.context_digest);}catch(e){code=e instanceof AcquisitionFailure?e.code:"stale";}
      if(provider.id!==w.provider||provider.model!==w.model)code="invalid-request";
      if(w.iteration>2&&(w.attempts!==0||reserveMicros!==500000||!await escalationEvidence(db,w)))code="budget";
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`${owner}:${w.context_digest}`]);
      const spend=await db.query("SELECT coalesce(sum(reserved_micros),0)::integer AS total,coalesce(sum(retries),0)::integer AS retries FROM external_work WHERE web_presence_id=$1 AND context_digest=$2",[owner,w.context_digest]);
      if(spend.rows[0].total+reserveMicros>w.budget_micros||w.attempts>=3)code="budget";
      if(code){await db.query("UPDATE external_work SET status='failed',version=version+1,updated_at=now(),result=$3 WHERE web_presence_id=$1 AND id=$2",[owner,id,JSON.stringify({code})]);await appendEvent(db,w,code==="stale"?"stale":"failure",{code});return null;}
      const token=randomUUID();
      await db.query("UPDATE external_work SET status='running',version=version+1,attempts=attempts+1,reserved_micros=reserved_micros+$3,lease_token=$4,lease_until=now()+interval '5 minutes',updated_at=now() WHERE web_presence_id=$1 AND id=$2",[owner,id,reserveMicros,token]);
      await appendEvent(db,w,"dispatch",{attemptId:token,iteration:w.iteration,reservedMicros:reserveMicros,estimatedMicros:reserveMicros});return {w,token};
    });
    if(!lease)return null;
    try {
      const result=await provider.generateImage(requestForTemplate(lease.w.template_version),{attemptId:lease.token});
      if(result.provider!==provider.id||result.model!==provider.model||result.policy!=="passed"||result.width!==1536||result.height!==1024||result.mimeType!=="image/png")throw new AcquisitionFailure("validation",result.requestId);
      if(result.actualMicros!==null&&(!Number.isSafeInteger(result.actualMicros)||result.actualMicros<0||result.actualMicros>reserveMicros))throw new AcquisitionFailure("budget",result.requestId);
      let prepared:Awaited<ReturnType<typeof prepareManagedBytes>>;
      try{prepared=await prepareManagedBytes(result.bytes);if(prepared.type!=="image"||prepared.width!==result.width||prepared.height!==result.height||prepared.mimeType!==result.mimeType)throw Error();}catch{throw new AcquisitionFailure("validation",result.requestId);}
      return await transaction(this.pool,async db=>{
        const w=await ownedWork(db,owner,id);
        if(w.status!=="running"||w.lease_token!==lease.token)throw new AcquisitionFailure("lease-expired",result.requestId);
        if(!w.lease_until||w.lease_until.getTime()<=Date.now())throw new AcquisitionFailure("lease-expired",result.requestId);
        await assertContext(db,w.context,w.context_digest);
        await provisionManagedObject(this.quarantineRoot,owner,prepared.sourceReference,prepared.bytes);
        const queued=await db.query("SELECT payload FROM external_work_events WHERE web_presence_id=$1 AND work_id=$2 AND kind='queued'",[owner,id]);
        const parentCandidate=queued.rows[0]?.payload.parentCandidate;
        const escalation=queued.rows[0]?.payload.escalation;
        if(w.iteration>2&&fingerprint(escalation??null)!==fingerprint(await escalationEvidence(db,w)))throw new AcquisitionFailure("validation",result.requestId);
        const provenance={...(parentCandidate?{parentCandidate}:{}),...(escalation?{escalation}:{}),version:1,sourceKind:"generated-illustrated",artificial:true,provider:result.provider,model:result.model,requestId:result.requestId,attemptId:lease.token,
          templateVersion:w.template_version,promptDigest:fingerprint(requestForTemplate(w.template_version)),referenceAssets:[],contextDigest:w.context_digest,policy:"passed",policyVersion:POLICY_VERSION,
          sourceDigest:managedKey(result.bytes).slice(8),transformations:["managed-raster-prepare/1"],generatedAt:result.generatedAt,usage:result.usage,actualMicros:result.actualMicros};
        const candidate={id:randomUUID(),web_presence_id:owner,revision:1,bytes_digest:prepared.sourceReference.slice(8),provenance_digest:fingerprint(provenance),width:prepared.width!,height:prepared.height!,mime_type:prepared.mimeType,policy_version:POLICY_VERSION};
        const r=await db.query(`INSERT INTO media_candidates(id,web_presence_id,work_id,source_kind,provider,model,quarantine_key,bytes_digest,subject_digest,provenance_digest,provenance,width,height,mime_type,policy_version,expires_at)
          VALUES($1,$2,$3,'generated-illustrated',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now()+interval '90 days') RETURNING *`,[candidate.id,owner,id,result.provider,result.model,prepared.sourceReference,candidate.bytes_digest,candidateSubject(candidate),candidate.provenance_digest,JSON.stringify(provenance),candidate.width,candidate.height,candidate.mime_type,POLICY_VERSION]);
        await db.query("UPDATE external_work SET status='awaiting-review',version=version+1,actual_micros=$3,lease_token=NULL,lease_until=NULL,updated_at=now(),result=$4 WHERE web_presence_id=$1 AND id=$2",[owner,id,result.actualMicros,JSON.stringify({candidateId:candidate.id,requestId:result.requestId,usage:result.usage})]);
        await appendEvent(db,w,"result",{attemptId:lease.token,requestId:result.requestId,usage:result.usage,actualMicros:result.actualMicros,preparedDigest:candidate.bytes_digest},candidate.id);return r.rows[0] as Candidate;
      });
    } catch(e) {
      const error=e instanceof AcquisitionFailure?e:new AcquisitionFailure("validation");
      await transaction(this.pool,async db=>{
        const w=await ownedWork(db,owner,id);
        if(w.status==="running"&&w.lease_token===lease.token)await db.query("UPDATE external_work SET status='failed',version=version+1,lease_token=NULL,lease_until=NULL,updated_at=now(),result=$3 WHERE web_presence_id=$1 AND id=$2",[owner,id,JSON.stringify({code:error.code,requestId:error.requestId})]);
        await appendEvent(db,w,error.code==="stale"?"stale":"failure",{code:error.code,requestId:error.requestId,attemptId:lease.token});
      });return null;
    }
  }
  async retry(owner:string,id:string) {
    return transaction(this.pool,async db=>{
      const w=await ownedWork(db,owner,id);await assertContext(db,w.context,w.context_digest);
      if(w.iteration>2)throw Error("Escalated attempt has no retries; new operator escalation required");
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`${owner}:${w.context_digest}`]);
      const total=await db.query("SELECT sum(retries)::integer AS retries FROM external_work WHERE web_presence_id=$1 AND context_digest=$2",[owner,w.context_digest]);
      if(w.status!=="failed"||!["rate-limit","transient"].includes(w.result.code??"")||total.rows[0].retries>=2)throw Error("Retry not allowed; uncertain requests require reconciliation");
      await db.query("UPDATE external_work SET status='queued',version=version+1,retries=retries+1,updated_at=now() WHERE web_presence_id=$1 AND id=$2",[owner,id]);
      await appendEvent(db,w,"retry",{retry:w.retries+1,previousCode:w.result.code});
    });
  }
  async cancel(owner:string,id:string) {
    return transaction(this.pool,async db=>{
      const w=await ownedWork(db,owner,id);if(!["queued","running","awaiting-review"].includes(w.status))throw Error("Cannot cancel terminal work");
      await db.query("UPDATE external_work SET status='cancelled',version=version+1,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE web_presence_id=$1 AND id=$2",[owner,id]);await appendEvent(db,w,"cancel",{from:w.status});
      const candidates=await db.query("SELECT * FROM media_candidates WHERE work_id=$1 AND state IN ('proposed','approved') FOR UPDATE",[id]);
      for(const c of candidates.rows)await db.query("UPDATE media_candidates SET state='revoked',version=version+1,updated_at=now() WHERE id=$1",[c.id]);
    });
  }
  async expireLease(owner:string,id:string) {
    return transaction(this.pool,async db=>{const w=await ownedWork(db,owner,id);if(w.status!=="running"||!w.lease_until||w.lease_until.getTime()>Date.now())throw Error("Lease has not expired");
      await db.query("UPDATE external_work SET status='failed',version=version+1,lease_token=NULL,lease_until=NULL,updated_at=now(),result=$3 WHERE web_presence_id=$1 AND id=$2",[owner,id,JSON.stringify({code:"timeout-uncertain"})]);await appendEvent(db,w,"lease-expired",{attemptId:w.lease_token});});
  }
  async expireCandidates(owner:string) {
    return transaction(this.pool,async db=>{
      const due=await db.query("SELECT work_id,id FROM media_candidates WHERE web_presence_id=$1 AND expires_at<=now() AND state IN ('proposed','approved','ingested') ORDER BY work_id,id",[requireAssetUuid(owner)]);
      for(const c of due.rows){const w=await ownedWork(db,owner,c.work_id);
        const changed=await db.query("UPDATE media_candidates SET state='expired',version=version+1,updated_at=now() WHERE id=$1 AND state IN ('proposed','approved','ingested') RETURNING id",[c.id]);
        if(changed.rowCount)await appendEvent(db,w,"failure",{code:"candidate-expired"},c.id);
      }return due.rows.map(c=>c.id);
    });
  }
  assertSeparateManagedRoot(root:string) {
    if(path.resolve(root).toLowerCase()===path.resolve(this.quarantineRoot).toLowerCase())throw Error("Managed and quarantine roots must be separate");
  }
  async decide(owner:string,workId:string,input:{candidateId:string;digest:string;revision:number;decision:Decision["decision"];actor:string;reason:string}) {
    const actor=text(input.actor,120),reason=text(input.reason,500);
    if(!["approve","reject","revoke"].includes(input.decision))throw Error("Invalid decision");
    return transaction(this.pool,async db=>{
      const w=await ownedWork(db,owner,workId);
      const r=await db.query("SELECT * FROM media_candidates WHERE web_presence_id=$1 AND work_id=$2 AND id=$3 FOR UPDATE",[owner,workId,requireAssetUuid(input.candidateId)]);
      const c=r.rows[0] as Candidate|undefined;
      if(!c||c.subject_digest!==input.digest||c.revision!==input.revision||candidateSubject(c)!==c.subject_digest)throw Error("Decision subject mismatch");
      if(input.decision!=="revoke") {
        if(w.status!=="awaiting-review"||c.state!=="proposed"||c.expires_at.getTime()<=Date.now())throw Error("Candidate not reviewable");
        await assertContext(db,w.context,w.context_digest);
        if(fingerprint(c.provenance)!==c.provenance_digest)throw Error("Invalid provenance");
        await readManagedObject(this.quarantineRoot,owner,c.quarantine_key);
      }else if(!["proposed","approved","ingested"].includes(c.state))throw Error("Candidate not revocable");
      const decision:Decision={actor,role:"operator",authority:"local-operator",decision:input.decision,subjectType:"media-candidate",candidateId:c.id,subjectDigest:c.subject_digest,revision:c.revision,
        scope:{webPresenceId:owner,sectionId:w.context.sectionId,role:"service-illustration"},at:new Date().toISOString(),reason};
      await appendEvent(db,w,"decision",decision,c.id);
      await db.query("UPDATE media_candidates SET state=$2,version=version+1,updated_at=now() WHERE id=$1",[c.id,input.decision==="approve"?"approved":input.decision==="reject"?"rejected":"revoked"]);
      if(input.decision!=="approve"&&w.status==="awaiting-review"){
        await db.query("UPDATE external_work SET status='completed',version=version+1,result=result||$2::jsonb,updated_at=now() WHERE id=$1",[w.id,JSON.stringify({decision:input.decision})]);
        await appendEvent(db,w,"result",{from:"awaiting-review",to:"completed",decision:input.decision},c.id);
      }
      return decision;
    });
  }
}
