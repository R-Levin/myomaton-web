import assert from "node:assert/strict";
import { Pool, type PoolClient } from "pg";
import { managedSnapshot, type Roles } from "../backup/managed";
import { bootstrapFiles, bootstrapStatus } from "./bootstrap";

export type ManagedOperatorConfig = { databaseUrl: string; databaseName: string; roles: Roles };
export function validateManagedOperator(input: ManagedOperatorConfig) {
  const url=new URL(input.databaseUrl);
  assert.ok(["postgres:","postgresql:"].includes(url.protocol));
  assert.ok(input.databaseName); assert.equal(decodeURIComponent(url.pathname.slice(1)),input.databaseName);
  assert.deepEqual(Object.keys(input.roles).sort(),["backup","migration","runtime"]);
  assert.equal(new Set(Object.values(input.roles)).size,3);
  for(const name of Object.values(input.roles))assert.ok(/^[a-z][a-z0-9_]{0,62}$/.test(name)&&!name.startsWith("pg_")&&!["postgres","public"].includes(name));
}
export function managedOperatorEnvironment(intent: string, env:Record<string,string|undefined>=process.env): ManagedOperatorConfig {
  assert.equal(env.MIOPAGES_DATABASE_OPERATION,intent,"Explicit protected operation intent required");
  const required=(key:string)=>{const value=env[key];assert.ok(value,"Missing protected operator configuration");return value;};
  const config={databaseUrl:required("DATABASE_URL"),databaseName:required("MIOPAGES_DATABASE_NAME"),roles:{runtime:required("MIOPAGES_RUNTIME_ROLE"),migration:required("MIOPAGES_MIGRATION_ROLE"),backup:required("MIOPAGES_BACKUP_ROLE")}};
  validateManagedOperator(config); return config;
}
export async function verifyManagedOperator(c: PoolClient, input: ManagedOperatorConfig) {
  const identity=(await c.query("SELECT current_database() name,current_user actor,session_user session")).rows[0];
  assert.equal(identity.name,input.databaseName);
  assert.equal(identity.actor,input.roles.migration,"Dedicated migration/operator login required");
  assert.equal(identity.session,input.roles.migration,"Direct migration/operator login required");
  const files=bootstrapFiles();assert.equal(files.length,16,"Review fresh-hosted contract for new migration lineage");
  const status=await bootstrapStatus(c,files);assert.equal(status.applied,16);assert.equal(status.pending,0);
  await managedSnapshot(c,input.databaseUrl,input.roles);
  return {identities:files.map(m=>({hash:m.hash,when:m.folderMillis})),compatibilityReceipt:status.receipt};
}
export async function managedOperatorTransaction<T>(input: ManagedOperatorConfig, readOnly: boolean, work: (c:PoolClient,stage:(value:string)=>void)=>Promise<T>) {
  validateManagedOperator(input);
  const pool=new Pool({connectionString:input.databaseUrl,connectionTimeoutMillis:10000});let c:PoolClient|undefined,stage="connection";
  try {
    c=await pool.connect();stage="identity";
    await c.query(readOnly?"BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY":"BEGIN");
    await c.query("SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='120s'; SET LOCAL search_path=public; SET LOCAL TIME ZONE 'UTC'");
    const result=await work(c,value=>{stage=value;});stage="commit";await c.query("COMMIT");return result;
  }catch(error){if(error&&typeof error==="object")Object.assign(error,{managedOperatorStage:stage});try{await c?.query("ROLLBACK");}catch{/* Never claim commit success after disconnect. */}throw error;}
  finally{c?.release();await pool.end();}
}
export function managedOperatorDiagnostic(error: unknown) {
  const e=error&&typeof error==="object"?error as Record<string,unknown>:{};
  const stages=["connection","identity","lock","preflight","initialization","verification","hostname","commit"];
  const stage=typeof e.managedOperatorStage==="string"&&stages.includes(e.managedOperatorStage)?e.managedOperatorStage:"configuration";
  return {error:"Managed operator action refused; no successful commit claimed",stage,sqlState:typeof e.code==="string"&&/^[0-9A-Z]{5}$/.test(e.code)?e.code:undefined};
}
