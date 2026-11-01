import assert from "node:assert/strict";
import type { Pool } from "pg";
import reviewed from "./miopages-c0-manifest.json";
import ownership from "../backup/application-ownership.json";
import { qualified } from "../backup/managed-permissions";
import { fingerprint } from "../../lib/platform/canonical/model";
import { customerTables, initializeCustomer, readCustomerState, verifyCustomerInitialization, type CustomerManifest, type CustomerState } from "../../lib/platform/customer-initialization";
import { managedOperatorTransaction, verifyManagedOperator, type ManagedOperatorConfig } from "../db/managed-operator";

const manifest=reviewed as CustomerManifest;
export async function initializeFreshHostedC0(input: ManagedOperatorConfig, operation:"create"|"verify", options:{failAfter?:number}={}) {
  assert.ok(operation==="create"||operation==="verify");
  assert.ok(operation==="create"||options.failAfter===undefined);
  return managedOperatorTransaction(input,operation==="verify",async(c,stage)=>{
    if(operation==="create") {
      stage("lock");await c.query("SELECT pg_advisory_xact_lock(hashtextextended('miopages-fresh-hosted-c0',0))");
      await c.query("LOCK TABLE drizzle.__drizzle_migrations IN SHARE MODE");
      await c.query(`LOCK TABLE ${ownership.tables.filter(t=>t!=="drizzle.__drizzle_migrations").map(qualified).join(",")} IN SHARE ROW EXCLUSIVE MODE`);
    }
    stage("preflight");const lineage=await verifyManagedOperator(c,input);
    const customerSet=new Set<string>(customerTables);
    for(const table of ownership.tables.filter(t=>t!=="drizzle.__drizzle_migrations"&&!customerSet.has(t.slice(7)))) {
      assert.equal((await c.query(`SELECT count(*)::int n FROM ${qualified(table)}`)).rows[0].n,0,"Unexpected operational/application rows; no repair mode");
    }
    const before=await readCustomerState(c);
    const baseline:CustomerState=Object.fromEntries(customerTables.map(table=>[table,[]]));baseline.migrations=before.migrations;
    const context={kind:"miopages-fresh-hosted-c0/1",lineageDigest:fingerprint({lineage,ledger:before.migrations}),inventoryDigest:fingerprint(ownership)};
    const verify=async()=>{
      const current=await readCustomerState(c);verifyCustomerInitialization(current,manifest,baseline);
      const receipt=(current.organizations[0].metadata as Record<string,unknown>).initialization as Record<string,unknown>;
      assert.deepEqual(Object.keys(receipt).sort(),["inventoryDigest","kind","lineageDigest","manifestDigest","stateDigest"]);
      for(const [key,value]of Object.entries(context))assert.equal(receipt[key],value,"Fresh-hosted initializer receipt mismatch");
    };
    const ids={organizationId:manifest.organizationId,webPresenceId:manifest.webPresenceId,managedSiteId:manifest.managedSiteId};
    if(customerTables.some(table=>before[table].length)) {
      stage("verification");await verify();return {verified:true,...ids,inserted:0,updated:0,deleted:0};
    }
    assert.equal(operation,"create","No initialized C0 to verify");
    stage("initialization");
    // Existing canonical machinery runs inside this outer transaction. Its own
    // transaction boundaries become savepoints, never an early outer COMMIT.
    const transactional={connect:async()=>({release(){},query:(sql:string,values?:unknown[])=>c.query(sql==="BEGIN"?"SAVEPOINT fresh_c0":sql==="COMMIT"?"RELEASE SAVEPOINT fresh_c0":sql==="ROLLBACK"?"ROLLBACK TO SAVEPOINT fresh_c0":sql,values)})} as unknown as Pool;
    const counts=await initializeCustomer(transactional,manifest,baseline,options);
    await c.query("UPDATE organizations SET metadata=jsonb_set(metadata,'{initialization}',(metadata->'initialization') || $2::jsonb) WHERE id=$1",[manifest.organizationId,JSON.stringify(context)]);
    stage("verification");await verify();await verifyManagedOperator(c,input);
    return {verified:true,...ids,...counts,updated:counts.updated+1};
  });
}
