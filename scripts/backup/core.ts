import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:net";
import { once } from "node:events";
import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, writeFile, lstat, realpath, rename, rm, unlink } from "node:fs/promises";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import { readCustomerState, stateFingerprint } from "../../lib/platform/customer-initialization";
import { fingerprint } from "../../lib/platform/canonical/model";
import { assetRoot, readManagedObject, provisionManagedObject } from "../../lib/platform/assets/local-storage";
import { requireAssetUuid } from "../../lib/platform/assets/model";
import { assertBackupRoot, checkedRelative, contained, isDisposableSchema, pointId, pointPattern, rootKind, retentionPlan } from "./policy";
import { recoveryCatalog, assertRecoveryEquivalent, assertSequenceValues, type RecoveryCatalog } from "./catalog";

const exec = promisify(execFile);
const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";
const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"';
export type ObjectEntry = { assetId: string; owner: string; key: string; file: string; size: number; sha256: string };
type State = { canonicalFingerprint: string; tables: { schema: string; table: string; count: number; hash: string }[]; catalogHash: string; recovery?:RecoveryCatalog; sequences: unknown[]; migrations: unknown[]; customers: unknown[]; managed: ObjectEntry[]; nonManagedAssets: number };
export type Manifest = { kind: "myomaton-backup/1"; id: string; createdAt: string; application: { head: string }; source: { database: string; serverVersion: string; includedSchemas: string[]; excludedDisposableSchemas: string[] }; dump: { format: "custom"; clientVersion: string; file: "database.dump"; size: number; sha256: string }; state: State };
export type Config = { root: string; databaseUrl: string; objectsRoot: string; pgBin: string; repository: string };

// No URI/password is ever passed on a native command line or logged.
export function connectionEnv(databaseUrl: string, readOnly: boolean) {
  const u = new URL(databaseUrl); assert.ok(["postgres:", "postgresql:"].includes(u.protocol));
  const database = decodeURIComponent(u.pathname.slice(1)); assert.match(database, /^[a-zA-Z0-9_.-]{1,63}$/);
  const env = { ...process.env, PGHOST: u.hostname.replace(/^\[|\]$/g,""), PGPORT: u.port || "5432", PGDATABASE: database, PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password), PGCONNECT_TIMEOUT: "10", PGOPTIONS: `-c timezone=UTC -c default_transaction_read_only=${readOnly ? "on" : "off"}` };
  for (const [key,value] of u.searchParams) {
    if (key === "sslmode") Object.assign(env, { PGSSLMODE: value });
    else if (key !== "options") throw Error("Unsupported backup connection option; configure libpq TLS separately");
  }
  return env;
}
export async function native(bin: string, command: string, args: string[], env = process.env) {
  const executable=path.join(bin,command+(process.platform==="win32"?".exe":""));
  if(command==="pg_ctl") {
    // A background postmaster can inherit capture pipes on Windows. Wait for the
    // controller's exit, with no inherited pipes; PostgreSQL has its own private log.
    await new Promise<void>((resolve,reject)=>{
      const child=spawn(executable,args,{env,windowsHide:true,stdio:"ignore"});
      const timer=setTimeout(()=>{child.kill();reject(Error("pg_ctl timed out"));},300000);
      child.once("error",()=>{clearTimeout(timer);reject(Error("pg_ctl failed"));});
      child.once("exit",code=>{clearTimeout(timer);if(code===0)resolve();else reject(Error("pg_ctl failed"));});
    });return "";
  }
  try { return (await exec(executable, args, { env, windowsHide: true, timeout: 300000, maxBuffer: 16 * 1024 * 1024 })).stdout; }
  catch { throw Error(`${command} failed; no successful backup/restore claimed (native output suppressed to protect data)`); }
}
export async function safeFile(root: string, relative: string) {
  const resolved = path.join(root, checkedRelative(relative)); assert.ok(contained(root, resolved));
  let current = root;
  for (const segment of relative.split("/")) { current = path.join(current,segment); assert.ok(!(await lstat(current)).isSymbolicLink(), "Symlink/reparse backup artifact refused"); }
  assert.equal((await realpath(resolved)).toLowerCase(), path.resolve(resolved).toLowerCase());
  assert.ok((await lstat(resolved)).isFile()); return resolved;
}
async function safeDirectory(root:string,relative:string) {
  checkedRelative(relative);let current=root;
  for(const segment of relative.split("/")){
    current=path.join(current,segment);assert.ok(contained(root,current));
    await mkdir(current,{mode:0o700}).catch((e:NodeJS.ErrnoException)=>{if(e.code!=="EEXIST")throw e;});
    const stat=await lstat(current);assert.ok(stat.isDirectory()&&!stat.isSymbolicLink(),"Unsafe backup directory");
    assert.equal((await realpath(current)).toLowerCase(),path.resolve(current).toLowerCase());
  }
  return current;
}
export async function hashFile(file: string) {
  const hash = createHash("sha256"); for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest("hex");
}
async function protect(root: string) {
  if (process.platform !== "win32") { assert.equal((await lstat(root)).mode & 0o077, 0, "Backup root must be private"); return; }
  const sid = (await exec("whoami.exe", ["/user","/fo","csv","/nh"], { windowsHide:true })).stdout.match(/S-1-5-[0-9-]+/)?.[0]; assert.ok(sid);
  await exec("icacls.exe", [root,"/inheritance:r","/grant:r",`*${sid}:(OI)(CI)F`,"*S-1-5-18:(OI)(CI)F","*S-1-5-32-544:(OI)(CI)F"], {windowsHide:true});
  const output = await exec("pwsh.exe", ["-NoProfile","-NonInteractive","-Command","$ErrorActionPreference='Stop'; $a=Get-Acl -LiteralPath $env:BACKUP_ACL_ROOT; @{protected=$a.AreAccessRulesProtected;allow=@($a.Access | Where-Object AccessControlType -eq Allow | ForEach-Object {$_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value})} | ConvertTo-Json -Compress"], {env:{...process.env,BACKUP_ACL_ROOT:root},windowsHide:true});
  const acl = JSON.parse(output.stdout); assert.equal(acl.protected,true); assert.ok(acl.allow.every((v:string)=>[sid,"S-1-5-18","S-1-5-32-544"].includes(v)), "Unexpected backup access grant");
}
export async function openRoot(config: Config, initialize = false) {
  const root = assertBackupRoot(config.root,[config.repository,config.objectsRoot,path.dirname(config.pgBin)]);
  if (initialize) await mkdir(root,{recursive:true,mode:0o700});
  assert.ok(!(await lstat(root)).isSymbolicLink()); assert.equal((await realpath(root)).toLowerCase(),root.toLowerCase());
  const marker = path.join(root,"backup-root.json");
  try { assert.equal(JSON.parse(await readFile(marker,"utf8")).kind,rootKind); }
  catch (error) {
    if (!initialize || (await readdir(root)).length) throw error;
    await protect(root); await writeFile(marker,json({kind:rootKind}),{flag:"wx",mode:0o600});
  }
  await protect(root); return root;
}
async function state(client: PoolClient, schemas: string[]): Promise<State> {
  await client.query("SET LOCAL search_path=public"); await client.query("SET LOCAL TIME ZONE 'UTC'");
  const canonical = await readCustomerState(client);
  const tables = [];
  for (const row of (await client.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname=ANY($1) ORDER BY schemaname,tablename",[schemas])).rows) {
    const rows = (await client.query(`SELECT to_jsonb(t) row FROM ${quote(row.schemaname)}.${quote(row.tablename)} t ORDER BY to_jsonb(t)::text`)).rows.map(r=>r.row);
    tables.push({schema:row.schemaname,table:row.tablename,count:rows.length,hash:stateFingerprint({rows})});
  }
  const columns = (await client.query("SELECT table_schema,table_name,column_name,ordinal_position,data_type,udt_schema,udt_name,is_nullable,column_default,is_identity,identity_generation FROM information_schema.columns WHERE table_schema=ANY($1) ORDER BY table_schema,table_name,ordinal_position",[schemas])).rows;
  const constraints = (await client.query("SELECT n.nspname,c.relname,con.contype,con.convalidated,pg_get_constraintdef(con.oid) definition FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1) ORDER BY n.nspname,c.relname,con.conname",[schemas])).rows;
  const indexes = (await client.query("SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname=ANY($1) ORDER BY schemaname,tablename,indexname",[schemas])).rows;
  const triggers = (await client.query("SELECT n.nspname,c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1) AND NOT t.tgisinternal ORDER BY n.nspname,c.relname,t.tgname",[schemas])).rows;
  const functions = (await client.query("SELECT n.nspname,p.proname,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=ANY($1) AND p.prokind='f' ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)",[schemas])).rows;
  const sequences = [];
  for (const s of (await client.query("SELECT sequence_schema,sequence_name FROM information_schema.sequences WHERE sequence_schema=ANY($1) ORDER BY sequence_schema,sequence_name",[schemas])).rows) sequences.push({...s,...(await client.query(`SELECT last_value::text,is_called FROM ${quote(s.sequence_schema)}.${quote(s.sequence_name)}`)).rows[0]});
  const managed = canonical.assets.filter(a=>a.source_type==="managed").map(a=>({assetId:String(a.id),owner:String(a.web_presence_id),key:String(a.source_reference),file:`objects/${a.web_presence_id}/${a.source_reference}`,size:0,sha256:String(a.source_reference).slice(8)})).sort((a,b)=>a.assetId.localeCompare(b.assetId));
  return {canonicalFingerprint:stateFingerprint(canonical),tables,catalogHash:fingerprint({columns,constraints,indexes,triggers,functions}),recovery:await recoveryCatalog(client,schemas),sequences,migrations:canonical.migrations,customers:canonical.web_presences.map(r=>({id:r.id,name:r.name})),managed,nonManagedAssets:canonical.assets.length-managed.length};
}
async function snapshot(pool: Pool, schemas: string[]) {
  const client=await pool.connect(); try { await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"); return await state(client,schemas); }
  finally {await client.query("ROLLBACK");client.release();}
}
export async function verify(config: Config, id: string) {
  assert.match(id,pointPattern); const root=await openRoot(config), point=path.join(root,"points",id);
  const manifestPath=await safeFile(point,"manifest.json"); assert.ok((await lstat(manifestPath)).size<2*1024*1024);
  const manifest: Manifest=JSON.parse(await readFile(manifestPath,"utf8")); assert.equal(manifest.kind,"myomaton-backup/1");assert.equal(manifest.id,id); assert.equal(manifest.dump.format,"custom");assert.equal(manifest.dump.file,"database.dump");
  assert.match(manifest.state.canonicalFingerprint,/^[a-f0-9]{64}$/); assert.ok(manifest.state.managed.length<=100000);
  const complete=JSON.parse(await readFile(await safeFile(point,"COMPLETE"),"utf8"));
  const checksumsPath=await safeFile(point,"checksums.txt"); assert.equal(await hashFile(checksumsPath),complete.checksumsSha256);
  const expected=new Map<string,string>([["database.dump",manifest.dump.sha256],["manifest.json",await hashFile(manifestPath)]]);
  for(const o of manifest.state.managed){requireAssetUuid(o.owner);requireAssetUuid(o.assetId);assert.match(o.key,/^objects\/[a-f0-9]{64}$/);assert.equal(o.file,`objects/${o.owner}/${o.key}`);assert.equal(o.sha256,o.key.slice(8));expected.set(o.file,o.sha256);}
  const lines=(await readFile(checksumsPath,"utf8")).trim().split("\n");assert.equal(lines.length,expected.size);
  for(const line of lines){const match=/^([a-f0-9]{64})  (.+)$/.exec(line);assert.ok(match);assert.equal(expected.get(match[2]),match[1]);const file=await safeFile(point,match[2]);assert.equal(await hashFile(file),match[1],"Backup checksum differs");expected.delete(match[2]);}
  assert.equal(expected.size,0);assert.equal((await lstat(await safeFile(point,"database.dump"))).size,manifest.dump.size);
  for(const o of manifest.state.managed)assert.equal((await lstat(await safeFile(point,o.file))).size,o.size);
  await native(config.pgBin,"pg_restore",["--list",path.join(point,"database.dump")]);
  await native(config.pgBin,"pg_restore",["--exit-on-error",`--file=${process.platform==="win32"?"NUL":"/dev/null"}`,path.join(point,"database.dump")]);
  return {point,manifest};
}
export async function backup(config: Config) {
  const root=await openRoot(config,true), id=pointId(new Date(),randomBytes(4).toString("hex"));
  const points=await safeDirectory(root,"points");
  const partial=path.join(points,".partial_"+id);await mkdir(partial,{mode:0o700});
  const pool=new Pool({connectionString:config.databaseUrl,options:"-c default_transaction_read_only=on",connectionTimeoutMillis:10000});const client=await pool.connect();
  let moved=false;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const allSchemas=(await client.query("SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname<>'information_schema' ORDER BY nspname")).rows.map(r=>String(r.nspname));
    const included=allSchemas.filter(s=>!isDisposableSchema(s)), excluded=allSchemas.filter(isDisposableSchema);
    const before=await state(client,included);const snapshotId=(await client.query("SELECT pg_export_snapshot() snapshot")).rows[0].snapshot;
    const version=(await client.query("SHOW server_version")).rows[0].server_version;
    const dumpVersion=(await native(config.pgBin,"pg_dump",["--version"])).trim();assert.ok(dumpVersion.includes(` ${String(version).split('.')[0]}.`),"PostgreSQL client/server major versions differ");
    await native(config.pgBin,"pg_dump",["--no-password","--format=custom",`--file=${path.join(partial,"database.dump")}`,`--snapshot=${snapshotId}`,...excluded.map(s=>`--exclude-schema=${s}`)],connectionEnv(config.databaseUrl,true));
    for(const object of before.managed){const bytes=await readManagedObject(config.objectsRoot,object.owner,object.key);object.size=bytes.length;await provisionManagedObject(path.join(partial,"objects"),object.owner,object.key,bytes);}
    const manifest:Manifest={kind:"myomaton-backup/1",id,createdAt:new Date().toISOString(),application:{head:(await exec("git",["rev-parse","HEAD"],{cwd:config.repository,windowsHide:true})).stdout.trim()},source:{database:connectionEnv(config.databaseUrl,true).PGDATABASE,serverVersion:version,includedSchemas:included,excludedDisposableSchemas:excluded},dump:{format:"custom",clientVersion:dumpVersion,file:"database.dump",size:(await lstat(path.join(partial,"database.dump"))).size,sha256:await hashFile(path.join(partial,"database.dump"))},state:before};
    await writeFile(path.join(partial,"manifest.json"),json(manifest),{flag:"wx",mode:0o600});
    const checksumEntries=new Map<string,string>([["database.dump",manifest.dump.sha256],["manifest.json",await hashFile(path.join(partial,"manifest.json"))],...before.managed.map(o=>[o.file,o.sha256] as [string,string])]);
    await writeFile(path.join(partial,"checksums.txt"),[...checksumEntries].sort(([a],[b])=>a.localeCompare(b)).map(([file,hash])=>`${hash}  ${file}`).join("\n")+"\n",{flag:"wx",mode:0o600});
    await writeFile(path.join(partial,"COMPLETE"),json({checksumsSha256:await hashFile(path.join(partial,"checksums.txt"))}),{flag:"wx",mode:0o600});
    await client.query("ROLLBACK");const after=await snapshot(pool,included);assert.equal(after.canonicalFingerprint,before.canonicalFingerprint,"Source changed during backup; retry a new point");
    await rename(partial,path.join(points,id));moved=true;
    await verify(config,id);return {id,point:path.join(points,id),canonicalFingerprint:before.canonicalFingerprint,managedObjects:before.managed.length};
  } catch(error) {
    // A failed point must not retain a successful COMPLETE marker.
    const directory=moved?path.join(points,id):partial;await unlink(path.join(directory,"COMPLETE")).catch(()=>{});
    await writeFile(path.join(directory,"FAILED.json"),json({failedAt:new Date().toISOString(),successful:false}),{mode:0o600}).catch(()=>{});throw error;
  } finally {await client.query("ROLLBACK").catch(()=>{});client.release();await pool.end();}
}
export async function copyPoint(config: Config,id:string,destination:string) {
  const source=await verify(config,id), targetConfig={...config,root:destination};
  assertBackupRoot(destination,[config.repository,config.objectsRoot,config.root,path.dirname(config.pgBin)]);
  const root=await openRoot(targetConfig,true), points=await safeDirectory(root,"points");
  const target=path.join(points,id);try{await lstat(target);const existing=await verify(targetConfig,id);assert.deepEqual(existing.manifest,source.manifest);return {id,point:target,verified:true};}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}
  const partial=path.join(points,".partial_"+id+"_"+randomBytes(4).toString("hex"));await mkdir(partial,{mode:0o700});
  const artifacts=["database.dump","manifest.json","checksums.txt","COMPLETE",...new Set(source.manifest.state.managed.map(o=>o.file))];
  for(const artifact of artifacts){const file=await safeFile(source.point,artifact),dest=path.join(partial,checkedRelative(artifact));await mkdir(path.dirname(dest),{recursive:true,mode:0o700});await writeFile(dest,await readFile(file),{flag:"wx",mode:0o600});}
  await rename(partial,target);try{await verify(targetConfig,id);}catch(e){await unlink(path.join(target,"COMPLETE")).catch(()=>{});throw e;}
  return {id,point:target,verified:true};
}
export async function planRetention(config:Config) {
  const root=await openRoot(config),points=path.join(root,"points"), valid=[];const unmanaged:string[]=[];
  for(const id of await readdir(points)){if(!pointPattern.test(id)){unmanaged.push(id);continue;}try{const {manifest}=await verify(config,id);valid.push({id,createdAt:manifest.createdAt});}catch{unmanaged.push(id);}}
  return {...retentionPlan(valid,new Date()),unmanaged};
}
export async function restoreTest(config:Config,id:string,inspect?: (target:Pool,manifest:Manifest)=>Promise<void>):Promise<Record<string,unknown>&{id:string;receipt:string}> {
  const {manifest,point}=await verify(config,id),root=await openRoot(config),token=randomUUID().replaceAll("-","");
  // Legacy points did not record the stronger contract. Anchor a read-only current
  // baseline to every recorded data/catalog/sequence invariant; never rewrite them.
  const sourcePool=new Pool({connectionString:config.databaseUrl,options:"-c default_transaction_read_only=on"});
  let source:State;try{source=await snapshot(sourcePool,manifest.source.includedSchemas);}finally{await sourcePool.end();}
  assert.equal(source.canonicalFingerprint,manifest.state.canonicalFingerprint,"Source drift from backup");
  assert.deepEqual(source.tables,manifest.state.tables,"Source table drift from backup");
  assertSequenceValues(manifest.state.sequences,source.sequences);
  if(!manifest.state.recovery)assert.equal(source.catalogHash,manifest.state.catalogHash,"Legacy source catalog drift from backup");
  const expected=manifest.state.recovery||source.recovery;assert.ok(expected);
  assertRecoveryEquivalent(expected,source.recovery!);
  const locale=expected.environment[0];assert.equal(locale.datlocprovider,"c","Only proven libc recovery is supported");
  assert.equal(locale.encoding,"UTF8");assert.equal(locale.datlocale,null);
  // This bounded slice refuses unproven role/database settings instead of silently
  // dropping security state. Future recovery support must add explicit handling.
  assert.equal(expected.security.settings.length,0,"Role/database settings require explicit recovery support");
  assert.equal(expected.security.memberships.length,0,"Role memberships require explicit recovery support");
  assert.equal(expected.security.database[0].acl,null,"Explicit database ACL requires recovery support");
  for(const role of expected.roles){assert.equal(role.rolconfig,null,"Role settings require explicit recovery support");assert.equal(role.rolvaliduntil,null,"Role expiry requires explicit recovery support");}
  const workingParent=await safeDirectory(root,"restore-tests");
  const work=path.join(workingParent,token);await mkdir(work,{mode:0o700});await writeFile(path.join(work,"owner.json"),json({token}),{flag:"wx",mode:0o600});
  const data=path.join(work,"cluster"),password=randomBytes(32).toString("hex"),pwfile=path.join(work,"password.tmp");await writeFile(pwfile,password+"\n",{flag:"wx",mode:0o600});
  const reservation=createServer();reservation.listen(0,"127.0.0.1");await once(reservation,"listening");const port=(reservation.address() as {port:number}).port;await new Promise<void>(resolve=>reservation.close(()=>resolve()));
  assert.notEqual(String(port),connectionEnv(config.databaseUrl,true).PGPORT);
  const targetUrl=new URL(`postgresql://postgres:${password}@127.0.0.1:${port}/postgres`),database="backup_restore_"+token;
  let started=false,proof:Record<string,unknown>|undefined;
  const env=connectionEnv(targetUrl.toString(),false);
  try {
    await native(config.pgBin,"initdb",["--pgdata="+data,"--username=postgres","--encoding=UTF8","--lc-collate="+locale.datcollate,"--lc-ctype="+locale.datctype,"--auth=scram-sha-256","--pwfile="+pwfile]);await unlink(pwfile);
    await native(config.pgBin,"pg_ctl",["--pgdata="+data,"--log="+path.join(work,"server.log"),"--options="+`-h 127.0.0.1 -p ${port}`,"--wait","start"]);started=true;
    const admin=new Pool({connectionString:targetUrl.toString()});try{
      for(const role of expected.roles){
        const flags=[role.rolsuper?'SUPERUSER':'NOSUPERUSER',role.rolinherit?'INHERIT':'NOINHERIT',role.rolcreaterole?'CREATEROLE':'NOCREATEROLE',role.rolcreatedb?'CREATEDB':'NOCREATEDB',role.rolcanlogin?'LOGIN':'NOLOGIN',role.rolreplication?'REPLICATION':'NOREPLICATION',role.rolbypassrls?'BYPASSRLS':'NOBYPASSRLS'];
        assert.ok(Number.isInteger(role.rolconnlimit));
        if(role.rolname==='postgres')await admin.query(`ALTER ROLE postgres ${flags.join(' ')} CONNECTION LIMIT ${role.rolconnlimit}`);
        else await admin.query(`CREATE ROLE ${quote(String(role.rolname))} ${flags.join(' ')} CONNECTION LIMIT ${role.rolconnlimit}`);
      }
      await admin.query(`CREATE DATABASE ${quote(database)} OWNER ${quote(String(expected.security.database[0].owner))} TEMPLATE template0`);
    }finally{await admin.end();}
    targetUrl.pathname="/"+database;
    await native(config.pgBin,"pg_restore",["--no-password",`--dbname=${database}`,"--exit-on-error","--single-transaction",path.join(point,"database.dump")],connectionEnv(targetUrl.toString(),false));
    const restored=new Pool({connectionString:targetUrl.toString()});let actual:State;try{if(inspect)await inspect(restored,manifest);actual=await snapshot(restored,manifest.source.includedSchemas);}finally{await restored.end();}
    assert.equal(actual.canonicalFingerprint,manifest.state.canonicalFingerprint,"Restored canonical state differs; source is not modified");
    assert.deepEqual(actual.tables,manifest.state.tables,"Restored table records differ");
    assert.ok(actual.recovery);const equivalence=assertRecoveryEquivalent(expected,actual.recovery);
    assertSequenceValues(manifest.state.sequences,actual.sequences);
    assert.deepEqual(actual.managed,manifest.state.managed.map(entry=>({...entry,size:0})),"Restored managed references differ from object inventory");
    assert.equal(actual.nonManagedAssets,manifest.state.nonManagedAssets);
    const restoredObjects=path.join(work,"managed-objects");
    for(const object of manifest.state.managed){const bytes=await readFile(await safeFile(point,object.file));await provisionManagedObject(restoredObjects,object.owner,object.key,bytes);assert.equal(createHash("sha256").update(await readManagedObject(restoredObjects,object.owner,object.key)).digest("hex"),object.sha256);}
    proof={id,testedAt:new Date().toISOString(),sourceDatabase:manifest.source.database,targetDatabase:database,targetHost:"127.0.0.1",targetPort:port,temporaryCluster:true,canonicalFingerprint:actual.canonicalFingerprint,tableCount:actual.tables.length,semanticSchemaMatches:true,securityMatches:true,environmentMatches:true,...equivalence,legacyBaseline:!manifest.state.recovery,legacySourceCatalogHash:manifest.state.catalogHash,legacyRestoredCatalogHash:actual.catalogHash,sequencesMatch:true,migrations:actual.migrations,customers:actual.customers,managedObjects:manifest.state.managed,allManagedObjectsRestored:true,ownershipAndPrivileges:"Original owners/ACLs restored and role flags verified; passwords not recovered; isolated bootstrap credential only"};
  } finally {
    // Shutdown/remove only this invocation's generated cluster, never source/backup data.
    if(started)await native(config.pgBin,"pg_ctl",["--pgdata="+data,"--mode=fast","--wait","stop"],env);
    assert.ok(contained(workingParent,work));assert.equal((await realpath(work)).toLowerCase(),path.resolve(work).toLowerCase());assert.equal(JSON.parse(await readFile(path.join(work,"owner.json"),"utf8")).token,token);
    await rm(work,{recursive:true});
  }
  assert.ok(proof);Object.assign(proof,{temporaryTargetRemoved:true});const proofs=await safeDirectory(root,"proofs");const receipt=path.join(proofs,id+"_"+token+".json");await writeFile(receipt,json(proof),{flag:"wx",mode:0o600});return {id,receipt,...proof};
}
export function defaultConfig(root:string):Config {
  if(!process.env.DATABASE_URL)throw Error("DATABASE_URL must be provided through protected configuration");
  return {root,databaseUrl:process.env.DATABASE_URL,objectsRoot:assetRoot(),pgBin:process.env.PG_BIN_DIR||"C:\\Program Files\\PostgreSQL\\18\\bin",repository:process.cwd()};
}
