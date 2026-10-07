import assert from "node:assert/strict";
import type { Pool, PoolClient } from "pg";
import { fingerprint, normalizeKnowledge, normalizeOffering, object, text, uuid } from "./canonical/model";
import { writeCanonical } from "./canonical/writes";
import { normalizeBinding } from "./canonical/projections";
import { normalizeSection } from "./managed-sites/sections";
import { canonicalPagePath } from "./managed-sites/paths";

export const customerTables = ["organizations", "web_presences", "managed_sites", "design_systems", "pages", "sections", "actions", "navigations", "navigation_items", "subjects", "subject_types", "assets", "asset_usages", "contact_definitions", "contact_submissions", "business_knowledge", "business_knowledge_revisions", "offerings", "offering_revisions"] as const;
const graphTables = customerTables.slice(0, 9);
type Row = Record<string, unknown>;
export type CustomerState = Record<string, Row[]>;
export type CustomerManifest = {
  organizationId: string; webPresenceId: string; managedSiteId: string;
  rows: Record<string, Row[]>;
  knowledge: { id: string; payload: unknown };
  offering: { id: string; key: string; type: "service" | "product"; name: string; status: "active" | "inactive"; payload: unknown };
  responsibleIdentity: string; changeReason: string;
};

export async function readCustomerState(c: Pick<PoolClient, "query">): Promise<CustomerState> {
  const state: CustomerState = {};
  for (const table of customerTables) state[table] = (await c.query(`SELECT to_jsonb(t) row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows.map(r => r.row);
  state.migrations = (await c.query("SELECT to_jsonb(t) row FROM drizzle.__drizzle_migrations t ORDER BY id")).rows.map(r => r.row);
  return state;
}
function sorted(rows: Row[]) { return [...rows].sort((a,b)=>fingerprint(a).localeCompare(fingerprint(b))); }
export function stateFingerprint(state: CustomerState): string {
  return fingerprint(Object.fromEntries(Object.entries(state).map(([k,rows])=>[k,sorted(rows)])));
}
function validate(manifest: CustomerManifest) {
  object(manifest,["organizationId","webPresenceId","managedSiteId","rows","knowledge","offering","responsibleIdentity","changeReason"]);
  const org=uuid(manifest.organizationId), wp=uuid(manifest.webPresenceId), site=uuid(manifest.managedSiteId);
  text(manifest.responsibleIdentity);text(manifest.changeReason,1000);
  object(manifest.rows,graphTables);
  object(manifest.knowledge,["id","payload"]);object(manifest.offering,["id","key","type","name","status","payload"]);
  uuid(manifest.knowledge.id);uuid(manifest.offering.id);
  normalizeKnowledge(manifest.knowledge.payload);normalizeOffering(manifest.offering.payload);
  const ids=new Set<string>([manifest.knowledge.id,manifest.offering.id]);
  for(const table of graphTables) {
    const rows=manifest.rows[table];assert.ok(Array.isArray(rows));
    for(const row of rows) { uuid(row.id);assert.ok(!ids.has(String(row.id)),"Duplicate manifest identity");ids.add(String(row.id));
      assert.equal(row.version,1);assert.equal(row.status,"active");text(row.name);object(row.metadata,["provisional","copyStatus","visualDirectionStatus"]);
    }
  }
  const one=(table:string,id:string)=>{assert.equal(manifest.rows[table].length,1);assert.equal(manifest.rows[table][0].id,id);};
  one("organizations",org);one("web_presences",wp);one("managed_sites",site);
  assert.equal(manifest.rows.web_presences[0].organization_id,org);assert.equal(manifest.rows.managed_sites[0].web_presence_id,wp);
  for(const table of ["design_systems","actions","navigations"])for(const row of manifest.rows[table])assert.equal(row.web_presence_id,wp);
  const pages=new Set(manifest.rows.pages.map(r=>String(r.id))), actions=new Set(manifest.rows.actions.map(r=>String(r.id))), navs=new Set(manifest.rows.navigations.map(r=>String(r.id)));
  for(const page of manifest.rows.pages){assert.equal(page.managed_site_id,site);assert.equal(canonicalPagePath(page.slug),page.slug);}
  for(const action of manifest.rows.actions){assert.equal(action.type,"page");assert.ok(pages.has(String(action.destination)));text(action.label);}
  for(const section of manifest.rows.sections){assert.ok(pages.has(String(section.page_id)));
    const content=section.content as Row;assert.ok(normalizeSection({...section,content:content.source && section.type==="collection"?{itemSource:"inline",items:[]}:content}));if(content.actionId)assert.ok(actions.has(String(content.actionId)));
    if(content.source){const binding=normalizeBinding(content.source);assert.equal(binding.role==="knowledge"?binding.knowledgeId:binding.offeringId,binding.role==="knowledge"?manifest.knowledge.id:manifest.offering.id);}
  }
  for(const item of manifest.rows.navigation_items){assert.ok(navs.has(String(item.navigation_id)));assert.equal(item.parent_id,null);assert.equal(item.target_type,"page");assert.ok(pages.has(String(item.target_reference)));text(item.label);}
  for(const id of normalizeOffering(manifest.offering.payload).actionIds)assert.ok(actions.has(id));
}
function selected(state: CustomerState, manifest: CustomerManifest): CustomerState {
  const result:CustomerState={};
  for(const table of customerTables) {
    const ids=new Set((manifest.rows[table]??[]).map(r=>r.id));
    result[table]=state[table].filter(r=>table==="business_knowledge"?r.id===manifest.knowledge.id:table==="offerings"?r.id===manifest.offering.id:table==="business_knowledge_revisions"?r.knowledge_id===manifest.knowledge.id:table==="offering_revisions"?r.offering_id===manifest.offering.id:ids.has(r.id));
  }
  return result;
}
function preservation(state:CustomerState, manifest:CustomerManifest, baseline:CustomerState) {
  const graph=selected(state,manifest),rest:CustomerState={migrations:state.migrations};
  for(const table of customerTables)rest[table]=state[table].filter(r=>!graph[table].includes(r));
  assert.equal(stateFingerprint(rest),stateFingerprint(baseline),"Existing customer/migration baseline drift; no repair mode");
}
function withoutReceipt(graph:CustomerState,orgId:string) {
  return {...graph,organizations:graph.organizations.map(r=>r.id!==orgId?r:{...r,metadata:Object.fromEntries(Object.entries(r.metadata as Row).filter(([key])=>key!=="initialization"))})};
}
function postcondition(graph:CustomerState, m:CustomerManifest) {
  for(const table of graphTables) {
    assert.equal(graph[table].length,m.rows[table].length,"Partial customer graph");
    for(const intended of m.rows[table]){const actual=graph[table].find(r=>r.id===intended.id);assert.ok(actual);for(const [key,value]of Object.entries(intended))assert.deepEqual(key==="metadata"?(withoutReceipt({organizations:[actual]},m.organizationId).organizations[0]?.metadata):actual[key],value,`Unexpected ${table}.${key}`);}
  }
  for(const [table,history,source,parent]of [["business_knowledge","business_knowledge_revisions",m.knowledge,"knowledge_id"],["offerings","offering_revisions",m.offering,"offering_id"]] as const){
    assert.equal(graph[table].length,1);assert.equal(graph[history].length,1);const row=graph[table][0],revision=graph[history][0];
    assert.equal(row.id,source.id);assert.equal(row.web_presence_id,m.webPresenceId);assert.equal(row.version,1);assert.equal(row.contract_version,1);
    assert.deepEqual(row.payload,table==="offerings"?normalizeOffering(source.payload):normalizeKnowledge(source.payload));
    if(table==="offerings")for(const key of ["key","type","name","status"] as const)assert.equal(row[key],m.offering[key]);
    assert.equal(revision[parent],source.id);assert.equal(revision.web_presence_id,m.webPresenceId);assert.equal(revision.revision_version,1);
    const snapshot={...row,created_at:new Date(String(row.created_at)).toISOString(),updated_at:new Date(String(row.updated_at)).toISOString()};
    assert.deepEqual(revision.snapshot,table==="offerings"?{...snapshot,relatedAssetUsages:[]}:snapshot);assert.equal(revision.responsible_identity,m.responsibleIdentity);assert.equal(revision.change_reason,m.changeReason);
  }
}

// Operator-only one-time establishment, not a seed/sync or public management API.
export async function initializeCustomer(pool:Pick<Pool,"connect">, manifest:CustomerManifest, baseline:CustomerState, options:{failAfter?:number}={}) {
  validate(manifest);const c=await pool.connect();let writes=0;
  const changed=()=>{writes++;if(options.failAfter===writes)throw Error("Forced initializer rollback");};
  try {
    await c.query("BEGIN");await c.query("SET LOCAL lock_timeout='5s'");await c.query("SET LOCAL statement_timeout='30s'");await c.query("SET LOCAL TIME ZONE 'UTC'");
    await c.query(`LOCK TABLE ${customerTables.join(",")} IN SHARE ROW EXCLUSIVE MODE`);await c.query("LOCK TABLE drizzle.__drizzle_migrations IN SHARE MODE");
    const before=await readCustomerState(c);preservation(before,manifest,baseline);const graph=selected(before,manifest);
    if(Object.values(graph).some(rows=>rows.length)){
      postcondition(graph,manifest);
      const receipt=(graph.organizations[0].metadata as Row).initialization as Row|undefined;
      assert.ok(receipt);assert.equal(receipt.manifestDigest,fingerprint(manifest));assert.equal(receipt.stateDigest,stateFingerprint(withoutReceipt(graph,manifest.organizationId)),"Customized customer state; no repair mode");
      await c.query("COMMIT");return {inserted:0,updated:0,deleted:0};
    }
    assert.equal(stateFingerprint(before),stateFingerprint(baseline));
    // Columns must exist on the allowed table; values are parameterized. The
    // manifest owns explicit defaults. No SQL/identifiers are customer content.
    for(const table of graphTables)for(const row of manifest.rows[table]){
      const columns=Object.keys(row);const allowed=(await c.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1",[table])).rows.map(r=>r.column_name);
      assert.ok(columns.every(k=>allowed.includes(k)));
      await c.query(`INSERT INTO ${table} (${columns.map(k=>`"${k}"`).join(",")}) VALUES (${columns.map((_,i)=>`$${i+1}`).join(",")})`,Object.values(row));changed();
    }
    // Reuse canonical writers within the outer transaction. Their transaction
    // boundaries become savepoints; a failure still rolls back the entire graph.
    const transactional={connect:async()=>({release(){},query:async(sql:string,values?:unknown[])=>c.query(sql==="BEGIN"?"SAVEPOINT canonical_write":sql==="COMMIT"?"RELEASE SAVEPOINT canonical_write":sql==="ROLLBACK"?"ROLLBACK TO SAVEPOINT canonical_write":sql,values)})} as unknown as Pool;
    for(const domain of ["knowledge","offering"] as const){const source=manifest[domain];await writeCanonical(transactional,{domain,id:source.id,webPresenceId:manifest.webPresenceId,expectedVersion:null,expectedFingerprint:null,payload:source.payload,...(domain==="offering"?{offering:{key:manifest.offering.key,type:manifest.offering.type,name:manifest.offering.name,status:manifest.offering.status}}:{}),responsibleIdentity:manifest.responsibleIdentity,changeReason:manifest.changeReason});changed();}
    const after=await readCustomerState(c);preservation(after,manifest,baseline);const resulting=selected(after,manifest);postcondition(resulting,manifest);
    const receipt={manifestDigest:fingerprint(manifest),stateDigest:stateFingerprint(withoutReceipt(resulting,manifest.organizationId))};
    await c.query("UPDATE organizations SET metadata=metadata || $2::jsonb WHERE id=$1",[manifest.organizationId,JSON.stringify({initialization:receipt})]);changed();
    const final=await readCustomerState(c);preservation(final,manifest,baseline);postcondition(selected(final,manifest),manifest);
    await c.query("COMMIT");return {inserted:Object.values(selected(final,manifest)).reduce((n,rows)=>n+rows.length,0),updated:1,deleted:0};
  }catch(error){await c.query("ROLLBACK");throw error;}finally{c.release();}
}
