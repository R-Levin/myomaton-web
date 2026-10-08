import type { Pool } from "pg";
import { uuid, fingerprint } from "../canonical/model";
import { normalizeBinding, projectCanonicalSections } from "../canonical/projections";
import { record } from "../presentation/content";
import { type Scope, type SectionContext } from "./authority";
// Trusted local operator boundary only. No HTTP endpoint, auth claim or publish writer.
export async function loadSectionContext(pool:Pool,scope:Scope,sectionId:string):Promise<SectionContext>{
 const c=await pool.connect();
 try {
  await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const row=(await c.query(`SELECT s.*,p.managed_site_id,m.web_presence_id FROM sections s JOIN pages p ON p.id=s.page_id JOIN managed_sites m ON m.id=p.managed_site_id JOIN web_presences w ON w.id=m.web_presence_id WHERE s.id=$1 AND p.managed_site_id=$2 AND m.web_presence_id=$3 AND s.status='active' AND p.status='active' AND m.status='active' AND w.status='active'`,[uuid(sectionId),uuid(scope.managedSiteId),uuid(scope.webPresenceId)])).rows;
  if(row.length!==1)throw Error("Unavailable/foreign Section");const s=row[0],sources:SectionContext["canonicalSources"]=[];
  const binding=record(s.content).source;
  if(binding){const b=normalizeBinding(binding),table=b.role==="knowledge"?"business_knowledge":"offerings",id=b.role==="knowledge"?b.knowledgeId:b.offeringId;const source=(await c.query(`SELECT * FROM ${table} WHERE id=$1 AND web_presence_id=$2`,[id,scope.webPresenceId])).rows[0];if(!source)throw Error("Unavailable canonical source");sources.push({id,version:source.version,fingerprint:fingerprint(source),payload:source.payload});}
  const refs=record(record(s.metadata).canonicalContext);
  for(const [table,id]of [["business_knowledge",refs.knowledgeId],["offerings",refs.offeringId]])if(id&&!sources.some(x=>x.id===id)){const source=(await c.query(`SELECT * FROM ${table} WHERE id=$1 AND web_presence_id=$2`,[uuid(id),scope.webPresenceId])).rows[0];if(!source)throw Error("Foreign canonical context");sources.push({id:String(id),version:source.version,fingerprint:fingerprint(source),payload:source.payload});}
  const proxy={query:(sql:string,values:unknown[])=>c.query(sql,values)} as unknown as Pool;
  const projected=await projectCanonicalSections(proxy,scope.webPresenceId,[s]);if(projected.length!==1)throw Error("Ineligible canonical projection");
  return {scope:{...scope},pageId:s.page_id,sectionId:s.id,version:s.version,type:s.type,variant:s.variant,content:s.content,configuration:s.configuration,metadata:s.metadata,projectedContent:projected[0].content,canonicalSources:sources};
 }finally{await c.query("ROLLBACK");c.release();}
}
