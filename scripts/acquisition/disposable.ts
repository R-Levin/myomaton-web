import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Pool } from "pg";
import { readMigrationFiles } from "drizzle-orm/migrator";
import reviewed from "../customer-updates/miopages-focus-reviewed.json";
import { stateFingerprint } from "../../lib/platform/customer-initialization";
import { customerGraph } from "../../lib/platform/customer-state";
import { snapshotPublic } from "../customer-previews/disposable";
import { assetRoot, readManagedObject, provisionManagedObject } from "../../lib/platform/assets/local-storage";

export type PilotReceipt = {version:1;schema:string;root:string;quarantineRoot:string;webPresenceId:string;managedSiteId:string;sectionId:string;workId?:string;beforeFingerprint:string;budgetMicros:number;reserveMicros:number};
export function disposablePool(url:string,schema:string) {
  if(!/^canonical_test_[a-f0-9]{32}_acquisition$/.test(schema))throw Error("Acquisition disposable schema required");
  const parsed=new URL(url);parsed.searchParams.set("options",`-c search_path=${schema}`);return new Pool({connectionString:parsed.toString()});
}
export async function createPilot(databaseUrl:string,budgetMicros:number,reserveMicros:number) {
  const source=new Pool({connectionString:databaseUrl,options:"-c default_transaction_read_only=on"});
  const admin=new Pool({connectionString:databaseUrl});
  const schema=`canonical_test_${randomUUID().replaceAll("-","")}_acquisition`,quoted=`"${schema}"`;
  const root=await mkdtemp(path.join(os.tmpdir(),"acquisition-managed-"));
  const quarantineRoot=await mkdtemp(path.join(os.tmpdir(),"acquisition-quarantine-"));
  try{
    const before=await snapshotPublic(source),owned=customerGraph(before,reviewed.target);
    if(stateFingerprint(owned)!==stateFingerprint(reviewed.after))throw Error("Accepted canonical MioPages baseline differs");
    const c=await admin.connect();try{
      await c.query("BEGIN");await c.query(`CREATE SCHEMA ${quoted}`);await c.query(`SET LOCAL search_path=${quoted}`);
      for(const migration of readMigrationFiles({migrationsFolder:"lib/platform/db/migrations"}))for(const sql of migration.sql)await c.query(sql.replaceAll('"public".',`${quoted}.`));
      const order=["organizations","subject_types","web_presences","managed_sites","pages","sections","actions","navigations","navigation_items","assets","asset_usages","design_systems","subjects","contact_definitions","contact_submissions","business_knowledge","offerings","business_knowledge_revisions","offering_revisions"];
      for(const table of order)for(const row of owned[table])await c.query(`INSERT INTO ${table} SELECT * FROM jsonb_populate_record(NULL::${table},$1::jsonb)`,[JSON.stringify(row)]);
      for(const a of owned.assets){if(a.source_type!=="managed")throw Error("Only managed baseline assets accepted");const bytes=await readManagedObject(assetRoot(),String(a.web_presence_id),String(a.source_reference));await provisionManagedObject(root,String(a.web_presence_id),String(a.source_reference),bytes);}
      await c.query("COMMIT");
    }catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
    const page=owned.pages.find(p=>p.slug==="/");const heroes=owned.sections.filter(s=>s.page_id===page?.id&&s.type==="hero");if(heroes.length!==1)throw Error("Exact single Home Hero required");
    if(stateFingerprint(await snapshotPublic(source))!==stateFingerprint(before))throw Error("Real state changed");
    return {version:1,schema,root,quarantineRoot,...reviewed.target,sectionId:String(heroes[0].id),beforeFingerprint:stateFingerprint(before),budgetMicros,reserveMicros} as PilotReceipt;
  }finally{await source.end();await admin.end();}
}
export async function assertRealPreserved(databaseUrl:string,receipt:PilotReceipt) {
  const source=new Pool({connectionString:databaseUrl,options:"-c default_transaction_read_only=on"});
  try{const fingerprint=stateFingerprint(await snapshotPublic(source));if(fingerprint!==receipt.beforeFingerprint)throw Error("Real customer state changed");return fingerprint;}finally{await source.end();}
}
