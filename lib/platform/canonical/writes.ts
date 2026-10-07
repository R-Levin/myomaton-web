import type { Pool } from "pg";
import { isDeepStrictEqual } from "node:util";
import { choice, fingerprint, key, normalizeKnowledge, normalizeOffering, object, text, uuid } from "./model";

export type CanonicalDomain = "knowledge" | "offering";
export type WriteInput = { domain: CanonicalDomain; id: string; webPresenceId: string; expectedVersion: number | null; expectedFingerprint: string | null;
  payload: unknown; offering?: { key: string; type: "service" | "product"; name: string; status: "active" | "inactive" }; image?: {assetId:string;altText:string;decorative?:boolean}; responsibleIdentity: string; changeReason: string };
async function snapshotCanonical(client: Pick<Pool,"query">, domain: CanonicalDomain, row: Record<string,unknown>) {
  if (domain==="knowledge") return row;
  const relatedAssetUsages=(await client.query("SELECT * FROM asset_usages WHERE entity_type='offering' AND entity_id=$1 ORDER BY id",[row.id])).rows;
  return {...row,relatedAssetUsages};
}
// Local operator/service boundary only. No HTTP endpoint or claim of authentication.
export async function inspectCanonical(pool: Pool, domain: CanonicalDomain, webPresenceId: string, id: string) {
  choice(domain,["knowledge","offering"]); const table = domain === "knowledge" ? "business_knowledge" : "offerings";
  const row = (await pool.query(`SELECT * FROM ${table} WHERE web_presence_id=$1 AND id=$2`,[uuid(webPresenceId),uuid(id)])).rows[0];
  return row ? { row, fingerprint: fingerprint(await snapshotCanonical(pool,domain,row)) } : null;
}
export async function writeCanonical(pool: Pool, input: WriteInput, options: { failAfterCurrent?: boolean } = {}) {
  object(input,["domain","id","webPresenceId","expectedVersion","expectedFingerprint","payload","offering","image","responsibleIdentity","changeReason"]);
  if(input.offering)object(input.offering,["key","type","name","status"]);
  if(input.image){object(input.image,["assetId","altText","decorative"]);if(input.image.decorative!==undefined && typeof input.image.decorative!=="boolean")throw Error("Invalid decorative intent");}
  const domain = choice(input.domain,["knowledge","offering"]), owner = uuid(input.webPresenceId), id = uuid(input.id);
  const actor = text(input.responsibleIdentity), reason = text(input.changeReason,1000);
  const payload = domain === "knowledge" ? normalizeKnowledge(input.payload) : normalizeOffering(input.payload);
  if (payload.approval.by !== actor) throw Error("Attestation differs from approval");
  const extra = domain === "offering" ? { key: key(input.offering?.key), type: choice(input.offering?.type,["service","product"]), name: text(input.offering?.name), status: choice(input.offering?.status,["active","inactive"]) } : {};
  const image=input.image ? {assetId:uuid(input.image.assetId),configuration:{image:{altText:text(input.image.altText,1000),decorative:input.image.decorative===true}}} : null;
  if (domain==="knowledge" && image) throw Error("Unexpected Offering image");
  if (domain === "knowledge" && input.offering !== undefined) throw Error("Unexpected Offering fields");
  const table = domain === "knowledge" ? "business_knowledge" : "offerings", history = domain === "knowledge" ? "business_knowledge_revisions" : "offering_revisions", parent = domain === "knowledge" ? "knowledge_id" : "offering_id";
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    // Owner lock serializes initialization, updates and same-owner attachments.
    if ((await c.query("SELECT id FROM web_presences WHERE id=$1 AND status='active' FOR UPDATE",[owner])).rowCount !== 1) throw Error("Active owner required");
    const current = (await c.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`,[id])).rows[0];
    if (current && current.web_presence_id !== owner) throw Error("Foreign canonical record");
    const currentSnapshot=current ? await snapshotCanonical(c,domain,current) : null;
    if (current?.contract_version !== undefined && current.contract_version !== 1) throw Error("Unsupported contract version");
    if (current) {
      const revision=(await c.query(`SELECT snapshot FROM ${history} WHERE ${parent}=$1 AND revision_version=$2`,[id,current.version])).rows[0];
      if (!revision || fingerprint(revision.snapshot)!==fingerprint(currentSnapshot)) throw Error("Canonical/revision state is partial or customized");
    }
    if (domain === "offering") {
      const ids = normalizeOffering(payload).actionIds;
      if (ids.length && (await c.query("SELECT id FROM actions WHERE web_presence_id=$1 AND id=ANY($2::uuid[]) AND status='active' FOR SHARE",[owner,ids])).rowCount !== new Set(ids).size) throw Error("Foreign/unavailable Action");
    }
    const usages=domain==="offering" ? (await c.query("SELECT * FROM asset_usages WHERE entity_type='offering' AND entity_id=$1 AND role='image' FOR UPDATE",[id])).rows : [];
    if (usages.some(u=>u.web_presence_id!==owner) || usages.length>1) throw Error("Foreign/ambiguous Offering image");
    if (image && (await c.query("SELECT id FROM assets WHERE id=$1 AND web_presence_id=$2 AND status='active' AND type='image' FOR SHARE",[image.assetId,owner])).rowCount!==1) throw Error("Foreign/unavailable Asset");
    const imageSame=!image || usages.length===1 && usages[0].asset_id===image.assetId && isDeepStrictEqual(usages[0].configuration,image.configuration);
    if (image && usages.length && !imageSame) throw Error("Occupied Offering image role");
    const same = current && imageSame && isDeepStrictEqual(current.payload,payload) && Object.entries(extra).every(([k,v]) => current[k]===v);
    if (same) {
      // Exact retries may carry the predecessor version, but not an arbitrary guard.
      const guardCurrent = input.expectedVersion === current.version && input.expectedFingerprint === fingerprint(currentSnapshot);
      const previous = input.expectedVersion === current.version-1 ? (await c.query(`SELECT snapshot FROM ${history} WHERE ${parent}=$1 AND revision_version=$2`,[id,input.expectedVersion])).rows[0]?.snapshot : null;
      const guardPrevious = previous && input.expectedFingerprint === fingerprint(previous);
      const guardCreation = current.version===1 && input.expectedVersion===null && input.expectedFingerprint===null;
      if (!guardCurrent && !guardPrevious && !guardCreation) throw Error("Optimistic conflict");
      await c.query("COMMIT"); return { inserted: 0, updated: 0, revisions: 0, version: current.version };
    }
    if (current ? input.expectedVersion !== current.version || input.expectedFingerprint !== fingerprint(currentSnapshot) : input.expectedVersion !== null || input.expectedFingerprint !== null) throw Error("Optimistic conflict");
    if (current && payload.approval.at === current.payload.approval.at) throw Error("Changed version requires fresh approval");
    if (current && domain === "offering") {
      const before=normalizeOffering(current.payload);
      for (const component of normalizeOffering(payload).components) {
        const previous=before.components.find(c=>c.key===component.key)?.pricing;
        if (previous && component.pricing && !isDeepStrictEqual(previous,component.pricing) && previous.approval.at===component.pricing.approval.at) throw Error("Changed pricing requires fresh price approval");
      }
    }
    // Bounded history, no implicit pruning of approved snapshots. A later reviewed
    // retention operation must release capacity; normal writers cannot erase it.
    if ((await c.query(`SELECT count(*)::int count FROM ${history} WHERE ${parent}=$1`,[id])).rows[0].count >= 100) throw Error("Revision capacity reached; reviewed retention required");
    let result;
    if (!current) result = await c.query(domain === "knowledge"
      ? "INSERT INTO business_knowledge(id,web_presence_id,payload) VALUES($1,$2,$3) RETURNING *"
      : "INSERT INTO offerings(id,web_presence_id,payload,key,type,name,status) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      domain === "knowledge" ? [id,owner,JSON.stringify(payload)] : [id,owner,JSON.stringify(payload),extra.key,extra.type,extra.name,extra.status]);
    else result = await c.query(domain === "knowledge"
      ? "UPDATE business_knowledge SET payload=$2,version=version+1,updated_at=now() WHERE id=$1 RETURNING *"
      : "UPDATE offerings SET payload=$2,key=$3,type=$4,name=$5,status=$6,version=version+1,updated_at=now() WHERE id=$1 RETURNING *",
      domain === "knowledge" ? [id,JSON.stringify(payload)] : [id,JSON.stringify(payload),extra.key,extra.type,extra.name,extra.status]);
    if (options.failAfterCurrent) throw Error("Forced rollback");
    const row = result.rows[0];
    if (image && !imageSame) await c.query("INSERT INTO asset_usages(web_presence_id,asset_id,entity_type,entity_id,role,configuration) VALUES($1,$2,'offering',$3,'image',$4)",[owner,image.assetId,id,JSON.stringify(image.configuration)]);
    await c.query(`INSERT INTO ${history}(web_presence_id,${parent},revision_version,snapshot,change_reason,responsible_identity) VALUES($1,$2,$3,$4,$5,$6)`,[owner,id,row.version,JSON.stringify(await snapshotCanonical(c,domain,row)),reason,actor]);
    await c.query("COMMIT"); return { inserted: current ? 0 : 1, updated: current ? 1 : 0, revisions: 1, version: row.version };
  } catch(e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
}
