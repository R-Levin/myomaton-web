import type { Pool, PoolClient } from "pg";
import type { Asset } from "../assets/model";
import { presentImage, type SectionImage } from "../assets/source";
import { readManagedObject } from "../assets/local-storage";
import { fingerprint } from "../canonical/model";
import { assertContext } from "./context";
import { POLICY_VERSION, requestForTemplate, type Decision } from "./contracts";
import { candidateSubject, escalationEvidence, type Candidate, type Work } from "./service";

export async function approvedCandidate(db:Pick<Pool|PoolClient,"query">,w:Work,c:Candidate) {
  let request;try{request=requestForTemplate(w.template_version);}catch{return null;}
  if(!["approved","ingested"].includes(c.state)||!["awaiting-review","completed"].includes(w.status)||c.expires_at.getTime()<=Date.now()
    ||c.web_presence_id!==w.web_presence_id||c.work_id!==w.id||c.policy_version!==POLICY_VERSION
    ||candidateSubject(c)!==c.subject_digest||fingerprint(c.provenance)!==c.provenance_digest||c.quarantine_key!==`objects/${c.bytes_digest}`
    ||c.provider!==w.provider||c.model!==w.model||c.source_kind!=="generated-illustrated")return null;
  const p=c.provenance;
  if(p.version!==1||p.sourceKind!=="generated-illustrated"||p.artificial!==true||p.policy!=="passed"||p.policyVersion!==POLICY_VERSION||p.contextDigest!==w.context_digest
    ||p.provider!==c.provider||p.model!==c.model||p.templateVersion!==w.template_version||typeof p.attemptId!=="string"||! /^[a-f0-9-]{36}$/.test(p.attemptId)
    ||typeof p.sourceDigest!=="string"||! /^[a-f0-9]{64}$/.test(p.sourceDigest)||p.promptDigest!==fingerprint(request)
    ||typeof p.generatedAt!=="string"||!Number.isFinite(Date.parse(p.generatedAt))
    ||!Array.isArray(p.referenceAssets)||p.referenceAssets.length!==0||!Array.isArray(p.transformations)||p.transformations[0]!=="managed-raster-prepare/1")return null;
  try{await assertContext(db,w.context,w.context_digest);}catch{return null;}
  if(w.iteration>=2){
    const queued=await db.query("SELECT payload FROM external_work_events WHERE web_presence_id=$1 AND work_id=$2 AND kind='queued'",[w.web_presence_id,w.id]);
    if(queued.rows.length!==1||queued.rows[0].payload.templateVersion!==w.template_version||queued.rows[0].payload.promptDigest!==p.promptDigest
      ||fingerprint(queued.rows[0].payload.parentCandidate??null)!==fingerprint(p.parentCandidate??null))return null;
    if(w.iteration>2){
      const evidence=await escalationEvidence(db,w);
      if(!evidence||fingerprint(evidence)!==fingerprint(p.escalation??null)||fingerprint(evidence)!==fingerprint(queued.rows[0].payload.escalation??null))return null;
    }
  }
  // An attributable decision cannot replace the immutable generation result.
  const generation=await db.query("SELECT payload FROM external_work_events WHERE web_presence_id=$1 AND work_id=$2 AND candidate_id=$3 AND kind='result' AND payload->>'attemptId'=$4 AND payload->>'preparedDigest'=$5",[w.web_presence_id,w.id,c.id,p.attemptId,c.bytes_digest]);
  if(generation.rows.length!==1 || generation.rows[0].payload.requestId!==p.requestId)return null;
  const events=await db.query("SELECT payload FROM external_work_events WHERE web_presence_id=$1 AND work_id=$2 AND candidate_id=$3 AND kind='decision' ORDER BY created_at DESC,id DESC LIMIT 1",[w.web_presence_id,w.id,c.id]);
  const decision=events.rows[0]?.payload as Decision|undefined;
  if(!decision||decision.decision!=="approve"||decision.role!=="operator"||decision.authority!=="local-operator"||decision.subjectType!=="media-candidate"
    ||!decision.actor?.trim()||!decision.reason?.trim()||!Number.isFinite(Date.parse(decision.at))||decision.candidateId!==c.id||decision.subjectDigest!==c.subject_digest||decision.revision!==c.revision
    ||decision.scope?.webPresenceId!==w.web_presence_id||decision.scope.sectionId!==w.context.sectionId||decision.scope.role!=="service-illustration")return null;
  return decision;
}
function canonicalAsset(row:Record<string,unknown>):Asset {
  return {id:row.id as string,webPresenceId:row.web_presence_id as string,name:row.name as string,type:row.type as string,mimeType:row.mime_type as string,
    width:row.width as number,height:row.height as number,altText:row.alt_text as string,status:row.status as string,sourceType:row.source_type as string,sourceReference:row.source_reference as string,
    configuration:row.configuration,metadata:row.metadata,version:row.version as number,createdAt:row.created_at as Date,updatedAt:row.updated_at as Date};
}
export async function acquiredHeroAssets(db:Pick<Pool|PoolClient,"query">,owner:string,siteId:string,root:string):Promise<Map<string,{asset:Asset;image:SectionImage}>> {
  const result=new Map<string,{asset:Asset;image:SectionImage}>();
  // Empty legacy slots need no operational tables, including before deployment
  // of 0009. Count every owner in a slot: foreign/ambiguous associations fail shut.
  const usages=await db.query(`SELECT u.*,a.id AS owned_asset_id,row_to_json(a) AS asset_row,s.id AS section_id
    FROM asset_usages u JOIN sections s ON s.id=u.entity_id JOIN pages p ON p.id=s.page_id
    JOIN managed_sites m ON m.id=p.managed_site_id JOIN web_presences w ON w.id=m.web_presence_id
    LEFT JOIN assets a ON a.id=u.asset_id AND a.web_presence_id=u.web_presence_id
    WHERE u.entity_type='section' AND u.role='service-illustration' AND m.id=$1 AND w.id=$2
    AND s.type='hero' AND p.slug='/' AND s.status='active' AND p.status='active' AND m.status='active' AND w.status='active'`,[siteId,owner]);
  const grouped=new Map<string,typeof usages.rows>();for(const u of usages.rows)grouped.set(u.section_id,[...(grouped.get(u.section_id)??[]),u]);
  for(const [sectionId,rows] of grouped){
    if(rows.length!==1)continue;const u=rows[0];if(u.web_presence_id!==owner||!u.owned_asset_id)continue;
    const a=canonicalAsset(u.asset_row);const image=presentImage(a,u.configuration);if(!image||!image.alt.trim())continue;
    const lineage=(a.metadata as {acquisition?:Record<string,unknown>})?.acquisition;if(!lineage||typeof lineage.candidateId!=="string")continue;
    try {
      const candidate=await db.query("SELECT c.*,row_to_json(w) AS work_row FROM media_candidates c JOIN external_work w ON w.id=c.work_id AND w.web_presence_id=c.web_presence_id WHERE c.id=$1 AND c.web_presence_id=$2",[lineage.candidateId,owner]);
      if(candidate.rows.length!==1)continue;const c=candidate.rows[0] as Candidate;const raw=candidate.rows[0].work_row;
      const w={...raw,lease_until:raw.lease_until?new Date(raw.lease_until):null} as Work;
      if(c.state!=="ingested"||w.context.sectionId!==sectionId||w.context.managedSiteId!==siteId||!await approvedCandidate(db,w,c))continue;
      if(lineage.provenanceDigest!==c.provenance_digest||lineage.subjectDigest!==c.subject_digest||lineage.revision!==c.revision||lineage.artificial!==true||lineage.sourceKind!==c.source_kind
        ||lineage.provider!==c.provider||lineage.model!==c.model||a.sourceReference!==`objects/${c.bytes_digest}`||a.width!==c.width||a.height!==c.height||a.mimeType!==c.mime_type)continue;
      await readManagedObject(root,owner,a.sourceReference);
      result.set(sectionId,{asset:a,image});
    }catch(e){if((e as {code?:string}).code==="42P01")continue;
      // Malformed UUID lineage, missing/tampered objects and incomplete evidence
      // are eligibility refusals; none become a public source locator.
      continue;
    }
  }return result;
}
