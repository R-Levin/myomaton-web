import { randomUUID } from "node:crypto";
import { fingerprint,text } from "../../lib/platform/canonical/model";
import { requireAssetUuid } from "../../lib/platform/assets/model";
import { assertContext } from "../../lib/platform/acquisition/context";
import { ITERATION_THREE_TEMPLATE,requestForTemplate,workIdentity,type ImageProvider } from "../../lib/platform/acquisition/contracts";
import { AcquisitionService,appendEvent,candidateSubject,transaction,type Candidate,type Work } from "../../lib/platform/acquisition/service";

// Operator-only disposable pilot exception; no shared migration/default changes.
export async function escalatePilot(service:AcquisitionService,owner:string,parentWorkId:string,provider:ImageProvider,actorInput:string,reasonInput:string) {
  const actor=text(actorInput,120),reason=text(reasonInput,1500);
  requireAssetUuid(owner);requireAssetUuid(parentWorkId);
  return transaction(service.pool,async db=>{
    const schema=(await db.query("SELECT current_schema() AS name")).rows[0].name as string;
    if(!/^canonical_test_[a-f0-9]{32}_acquisition$/.test(schema))throw Error("Disposable pilot escalation only");
    const parent=(await db.query("SELECT * FROM external_work WHERE web_presence_id=$1 AND id=$2 FOR UPDATE",[owner,parentWorkId])).rows[0] as Work|undefined;
    if(!parent||parent.iteration!==2||parent.status!=="completed"||parent.budget_micros!==1000000||parent.provider!==provider.id||parent.model!==provider.model)throw Error("Exact exhausted parent required");
    await assertContext(db,parent.context,parent.context_digest);
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`${owner}:${parent.context_digest}`]);
    const previous=(await db.query("SELECT w.*,c.state AS candidate_state FROM external_work w JOIN media_candidates c ON c.work_id=w.id WHERE w.web_presence_id=$1 AND w.context_digest=$2 ORDER BY iteration",[owner,parent.context_digest])).rows;
    const existing=(await db.query("SELECT w.* FROM external_work w JOIN external_work_events e ON e.work_id=w.id AND e.web_presence_id=w.web_presence_id WHERE w.web_presence_id=$1 AND w.context_digest=$2 AND w.iteration=3 AND e.kind='decision' AND e.payload->>'subjectType'='acquisition-escalation' AND e.payload->'scope'->>'parentWorkId'=$3",[owner,parent.context_digest,parentWorkId])).rows;
    if(existing.length===1)return existing[0] as Work;
    const totals=(await db.query("SELECT count(*)::integer AS jobs,sum(reserved_micros)::integer AS reserved,sum(attempts)::integer AS attempts FROM external_work WHERE web_presence_id=$1 AND context_digest=$2",[owner,parent.context_digest])).rows[0];
    if(totals.jobs!==2||totals.reserved!==1000000||totals.attempts!==2||previous.length!==2||previous[0].iteration!==1||previous[1].id!==parent.id||previous.some(w=>w.candidate_state!=="rejected"))throw Error("Two rejected, exhausted iterations required");
    const c=(await db.query("SELECT * FROM media_candidates WHERE web_presence_id=$1 AND work_id=$2",[owner,parentWorkId])).rows[0] as Candidate;
    if(candidateSubject(c)!==c.subject_digest||fingerprint(c.provenance)!==c.provenance_digest)throw Error("Parent integrity");
    const review=(await db.query("SELECT id,payload FROM external_work_events WHERE web_presence_id=$1 AND work_id=$2 AND candidate_id=$3 AND kind='decision' ORDER BY created_at DESC,id DESC LIMIT 1",[owner,parentWorkId,c.id])).rows[0];
    if(review?.payload.decision!=="reject"||review.payload.subjectDigest!==c.subject_digest||review.payload.revision!==c.revision)throw Error("Exact rejected review required");
    const id=randomUUID(),eventId=randomUUID();
    const parentCandidate={workId:parent.id,candidateId:c.id,revision:c.revision,bytesDigest:c.bytes_digest,subjectDigest:c.subject_digest,provenanceDigest:c.provenance_digest,state:c.state,reviewEventId:review.id,review:review.payload};
    const escalation={actor,role:"operator",authority:"local-operator",subjectType:"acquisition-escalation",decision:"authorize-one-additional-attempt",at:new Date().toISOString(),reason,
      scope:{webPresenceId:owner,sectionId:parent.context.sectionId,contextDigest:parent.context_digest,parentWorkId,newWorkId:id},previous:{maxPaidIterations:2,budgetMicros:1000000,reservedMicros:1000000,capReached:true},
      limits:{maxPaidIterations:3,additionalAttempts:1,additionalReservedMicros:500000,budgetMicros:1500000,maxRetries:0},lineage:previous.map(w=>({workId:w.id,iteration:w.iteration})),parentCandidate};
    // Retain the original CHECK verbatim as one arm. Only this new immutable
    // work UUID/owner/context gets the tightly bounded third-iteration arm.
    const bounds=(await db.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='external_work'::regclass AND conname='external_work_bounds'")).rows[0].definition as string;
    const expression=bounds.slice(bounds.indexOf("(")+1,-1);
    await db.query(`ALTER TABLE "${schema}".external_work DROP CONSTRAINT external_work_bounds`);
    await db.query(`ALTER TABLE "${schema}".external_work ADD CONSTRAINT external_work_bounds CHECK ((${expression}) OR (id='${id}'::uuid AND web_presence_id='${owner}'::uuid AND context_digest='${parent.context_digest}' AND iteration=3 AND version>0 AND attempts BETWEEN 0 AND 1 AND retries=0 AND budget_micros=1500000 AND reserved_micros IN (0,500000) AND (actual_micros IS NULL OR actual_micros BETWEEN 0 AND 500000)))`);
    const work=(await db.query("INSERT INTO external_work(id,web_presence_id,capability,identity,context_digest,context,provider,model,template_version,iteration,budget_micros) VALUES($1,$2,'image-generation',$3,$4,$5,$6,$7,$8,3,1500000) RETURNING *",[id,owner,workIdentity(parent.context,{id:provider.id,model:provider.model},3,ITERATION_THREE_TEMPLATE),parent.context_digest,JSON.stringify(parent.context),provider.id,provider.model,ITERATION_THREE_TEMPLATE])).rows[0] as Work;
    await db.query("INSERT INTO external_work_events(id,web_presence_id,work_id,kind,payload) VALUES($1,$2,$3,'decision',$4)",[eventId,owner,id,JSON.stringify(escalation)]);
    await appendEvent(db,work,"queued",{contextDigest:parent.context_digest,iteration:3,strategy:parent.context.strategy,templateVersion:ITERATION_THREE_TEMPLATE,promptDigest:fingerprint(requestForTemplate(ITERATION_THREE_TEMPLATE)),parentCandidate,escalation:{eventId,digest:fingerprint(escalation)}});
    return work;
  });
}
