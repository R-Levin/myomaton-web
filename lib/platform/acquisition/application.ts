import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { provisionManagedObject, readManagedObject } from "../assets/local-storage";
import { text } from "../canonical/model";
import { approvedCandidate } from "./eligibility";
import { appendEvent, transaction, AcquisitionService, type Candidate, type Work } from "./service";

export async function ingestDisposable(service:AcquisitionService,owner:string,workId:string,candidateId:string,root:string,alt:string) {
  const safeAlt=text(alt,500);
  service.assertSeparateManagedRoot(root);
  try{return await transaction(service.pool,async db=>{
    const schema=await db.query("SELECT current_schema() AS schema");
    if(!/^canonical_test_[a-f0-9]{32}_acquisition$/.test(schema.rows[0].schema))throw Error("Only disposable application is authorized");
    const works=await db.query("SELECT * FROM external_work WHERE web_presence_id=$1 AND id=$2 FOR UPDATE",[owner,workId]);
    const candidates=await db.query("SELECT * FROM media_candidates WHERE web_presence_id=$1 AND work_id=$2 AND id=$3 FOR UPDATE",[owner,workId,candidateId]);
    const w=works.rows[0] as Work,c=candidates.rows[0] as Candidate;
    if(!w||!c||c.state!=="approved")throw Error("Approved owned candidate required");
    // Lock the complete canonical context before revalidating it and writing.
    await db.query("SELECT id FROM sections WHERE id=$1 FOR UPDATE",[w.context.sectionId]);
    await db.query("SELECT id FROM pages WHERE id=$1 FOR SHARE",[w.context.pageId]);
    await db.query("SELECT id FROM managed_sites WHERE id=$1 FOR SHARE",[w.context.managedSiteId]);
    await db.query("SELECT id FROM design_systems WHERE web_presence_id=$1 FOR SHARE",[owner]);
    if(!await approvedCandidate(db,w,c))throw Error("Current exact approval required");
    const occupied=await db.query("SELECT id FROM asset_usages WHERE entity_type='section' AND entity_id=$1 AND role='service-illustration'",[w.context.sectionId]);
    if(occupied.rows.length)throw Error("Hero slot is already occupied");
    const bytes=await readManagedObject(service.quarantineRoot,owner,c.quarantine_key);
    await provisionManagedObject(root,owner,c.quarantine_key,bytes);
    const assetId=randomUUID();
    const lineage={candidateId:c.id,provenanceDigest:c.provenance_digest,subjectDigest:c.subject_digest,revision:c.revision,artificial:true,sourceKind:c.source_kind,provider:c.provider,model:c.model,preparedDigest:c.bytes_digest,transformations:c.provenance.transformations};
    await db.query(`INSERT INTO assets(id,web_presence_id,name,type,mime_type,width,height,alt_text,source_type,source_reference,metadata)
      VALUES($1,$2,'Conceptual service illustration','image',$3,$4,$5,$6,'managed',$7,$8)`,[assetId,owner,c.mime_type,c.width,c.height,safeAlt,c.quarantine_key,JSON.stringify({acquisition:lineage})]);
    await db.query("INSERT INTO asset_usages(web_presence_id,asset_id,entity_type,entity_id,role,configuration) VALUES($1,$2,'section',$3,'service-illustration',$4)",[owner,assetId,w.context.sectionId,JSON.stringify({image:{altText:safeAlt,decorative:false}})]);
    await db.query("UPDATE media_candidates SET state='ingested',version=version+1,updated_at=now() WHERE id=$1",[c.id]);
    await db.query("UPDATE external_work SET status='completed',version=version+1,updated_at=now() WHERE id=$1",[w.id]);
    await appendEvent(db,w,"ingestion",{assetId,preparedDigest:c.bytes_digest,subjectDigest:c.subject_digest,revision:c.revision,disposable:true},c.id);return assetId;
  });}catch(e){
    await transaction(service.pool,async db=>{const w=await db.query("SELECT id,web_presence_id FROM external_work WHERE web_presence_id=$1 AND id=$2",[owner,workId]);if(w.rows.length)await appendEvent(db,w.rows[0],"failure",{code:"ingestion-refused"});});throw e;
  }
}
export async function cleanupCandidates(service:AcquisitionService,owner:string) {
  return transaction(service.pool,async db=>{
    const r=await db.query("SELECT * FROM media_candidates WHERE web_presence_id=$1 AND state IN ('rejected','expired') AND updated_at<now()-interval '30 days' FOR UPDATE",[owner]);
    const removed:string[]=[];
    for(const c of r.rows as Candidate[]){
      const retained=await db.query("SELECT id FROM media_candidates WHERE web_presence_id=$1 AND quarantine_key=$2 AND NOT(state IN ('rejected','expired') AND updated_at<now()-interval '30 days')",[owner,c.quarantine_key]);
      if(retained.rows.length)continue;
      try{await readManagedObject(service.quarantineRoot,owner,c.quarantine_key);}catch{continue;}
      // Only a validated, bounded immutable object path can be removed.
      await rm(path.join(service.quarantineRoot,owner,c.quarantine_key));
      await appendEvent(db,{id:c.work_id,web_presence_id:owner},"cleanup",{preparedDigest:c.bytes_digest},c.id);removed.push(c.id);
    }return removed;
  });
}
