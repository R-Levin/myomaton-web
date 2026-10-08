import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import type { Pool } from "pg";
import frozen from "./miopages-focus-reviewed.json";
import { customerTables, readCustomerState, stateFingerprint, type CustomerState } from "../../lib/platform/customer-initialization";
import { customerGraph, otherCustomerState } from "../../lib/platform/customer-state";
import { fingerprint } from "../../lib/platform/canonical/model";
import { prepareManagedAsset } from "../../lib/platform/assets/ingestion";
import { provisionManagedObject, assetRoot } from "../../lib/platform/assets/local-storage";
export const review=frozen;
type Row=Record<string,unknown>;
const before=review.before as CustomerState,after=review.after as CustomerState;
const fields:Record<string,string[]>={managed_sites:["configuration","metadata","version","updated_at"],design_systems:["name","configuration","metadata","version","updated_at"],pages:["configuration","metadata","version","updated_at"],sections:["type","variant","name","sort_order","content","configuration","metadata","status","version","updated_at"],actions:["label","version","updated_at"]};
export function promotionChanges() {
 assert.equal(review.target.webPresenceId,"926cb772-7507-4542-8acd-e7e57ce71324");assert.equal(review.target.managedSiteId,"312b8081-4582-47fa-bedb-a551fd6e2b36");
 const updates:{table:string;before:Row;after:Row;fields:string[]}[]=[],inserts:{table:string;row:Row}[]=[];
 for(const table of customerTables) {
  for(const old of before[table]) {
   const next=after[table].filter(r=>r.id===old.id);assert.equal(next.length,1,"No deletion or identity replacement");
   const changed=Object.keys(next[0]).filter(k=>!isDeepStrictEqual(old[k],next[0][k]));
   assert.deepEqual(Object.keys(old).sort(),Object.keys(next[0]).sort());
   if(changed.length){assert.ok(changed.every(k=>fields[table]?.includes(k)),"Unapproved column change");assert.equal(next[0].version,Number(old.version)+1);updates.push({table,before:old,after:next[0],fields:changed});}
  }
  for(const row of after[table].filter(r=>!before[table].some(b=>b.id===r.id))) {
   assert.ok(["sections","assets","asset_usages"].includes(table));
   if(table==="sections")assert.ok(after.pages.some(p=>p.id===row.page_id));
   else assert.equal(row.web_presence_id,review.target.webPresenceId);
   if(table==="assets")assert.equal(row.type,"image");
   if(table==="asset_usages"){assert.ok(["logo","logo-light"].includes(String(row.role)));assert.equal(row.entity_type,"web_presence");assert.equal(row.entity_id,review.target.webPresenceId);assert.ok(after.assets.some(a=>a.id===row.asset_id));}
   inserts.push({table,row});
  }
 }
 assert.equal(after.sections.length,23);assert.equal(after.assets.length,2);assert.equal(after.asset_usages.length,2);
 assert.ok(after.sections.every(s=>!Object.hasOwn(s.configuration as object,"previewMedia")));
 return {updates,inserts};
}
export function planPromotion(state:CustomerState) {
 assert.equal(stateFingerprint(otherCustomerState(state,review.target)),review.otherFingerprint,"Other-customer/migration drift; no repair mode");
 assert.equal(fingerprint(state.migrations),review.migrationFingerprint);
 const graph=customerGraph(state,review.target),digest=stateFingerprint(graph);
 if(digest===stateFingerprint(after)){assert.equal(stateFingerprint(state),review.completeAfter);return {changed:false,updates:[],inserts:[]};}
 assert.equal(digest,stateFingerprint(before),"MioPages baseline conflict; no repair mode");
 assert.equal(stateFingerprint(state),review.completeBefore);
 return {changed:true,...promotionChanges()};
}
export async function promoteMioPages(pool:Pick<Pool,"connect">,options:{failAfter?:number;root?:string}={}) {
 const c=await pool.connect();let writes=0;
 const step=()=>{if(++writes===options.failAfter)throw Error("Forced promotion rollback");};
 try {
  await c.query("BEGIN");await c.query("SET LOCAL search_path=public");await c.query("SET LOCAL TIME ZONE 'UTC'");await c.query("SET LOCAL lock_timeout='5s'");await c.query("SET LOCAL statement_timeout='30s'");
  await c.query(`LOCK TABLE ${customerTables.map(t=>`public.${t}`).join(",")} IN SHARE ROW EXCLUSIVE MODE`);await c.query("LOCK TABLE drizzle.__drizzle_migrations IN SHARE MODE");
  const current=await readCustomerState(c),plan=planPromotion(current);
  if(plan.changed) {
   // Immutable bytes may outlive a rolled-back transaction; no Asset row survives failure.
   for(const asset of after.assets){const image=await prepareManagedAsset(String((asset.metadata as Row).source));assert.equal(image.sourceReference,asset.source_reference);await provisionManagedObject(options.root??assetRoot(),review.target.webPresenceId,image.sourceReference,image.bytes);}
   for(const change of plan.updates){
    const columns=change.fields.map(k=>`"${k}"`).join(","),values=change.fields.map(k=>`patched."${k}"`).join(",");
    const r=await c.query(`UPDATE public.${change.table} target SET (${columns})=(SELECT ${values} FROM jsonb_populate_record(NULL::public.${change.table},$1::jsonb) patched) WHERE target.id=$2 AND to_jsonb(target)=$3::jsonb`,[JSON.stringify(change.after),change.before.id,JSON.stringify(change.before)]);assert.equal(r.rowCount,1);step();
   }
   for(const {table,row}of plan.inserts){await c.query(`INSERT INTO public.${table} SELECT * FROM jsonb_populate_record(NULL::public.${table},$1::jsonb)`,[JSON.stringify(row)]);step();}
  }
  const resulting=await readCustomerState(c);
  if(stateFingerprint(resulting)!==review.completeAfter){
   const graph=customerGraph(resulting,review.target);
   const differences=customerTables.flatMap(table=>after[table].flatMap(expected=>{const actual=graph[table].find(r=>r.id===expected.id);return Object.keys(expected).filter(key=>!isDeepStrictEqual(expected[key],actual?.[key])).map(key=>`${table}:${expected.id}:${key}${key.endsWith("_at")?` (${expected[key]} / ${actual?.[key]})`:""}`);}));
   throw Error(`Complete postcondition failed: ${differences.join(", ")}`);
  }
  assert.equal(planPromotion(resulting).changed,false);
  await c.query("COMMIT");return {changed:plan.changed,updated:plan.updates.length,inserted:plan.inserts.length,deleted:0,before:stateFingerprint(current),after:stateFingerprint(resulting),other:review.otherFingerprint,migrations:review.migrationFingerprint};
 }catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
}
