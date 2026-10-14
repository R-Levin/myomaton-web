import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { assertBackupRoot, checkedRelative, contained, isDisposableSchema, pointId, retentionPlan, rootKind } from "../scripts/backup/policy";
import { connectionEnv, safeFile, hashFile, verify, native, type Config, type Manifest } from "../scripts/backup/core";
import { normalizedCheck, assertRecoveryEquivalent, type RecoveryCatalog } from "../scripts/backup/catalog";

test("backup roots reject live/project/tool overlap, volume roots and relative paths",()=>{
  const base=path.resolve(os.tmpdir(),"backup-policy");
  const live=path.join(base,"live"), sibling=path.join(base,"backup");
  assert.equal(assertBackupRoot(sibling,[live]),sibling);
  for(const root of [live,path.join(live,"child"),base,path.parse(base).root,"relative-backup"])assert.throws(()=>assertBackupRoot(root,[live]));
  assert.equal(contained(live,sibling),false);assert.equal(contained(live,path.join(live,"x")),true);
});

test("CHECK normalization only flattens associative AND and preserves meaningful atoms/grouping",()=>{
  assert.deepEqual(normalizedCheck('CHECK (((a > 0) AND (b > 0)) AND (c > 0))'),normalizedCheck('CHECK ((a > 0) AND (b > 0) AND (c > 0))'));
  for(const changed of ['CHECK ((a >= 0) AND (b > 0) AND (c > 0))','CHECK ((a > 0) OR ((b > 0) AND (c > 0)))','CHECK ((a > 0) AND (c > 0) AND (b > 0))'])assert.notDeepEqual(normalizedCheck('CHECK (((a > 0) AND (b > 0)) AND (c > 0))'),normalizedCheck(changed));
  assert.notDeepEqual(normalizedCheck('CHECK (((a + b) * c) > 0)'),normalizedCheck('CHECK ((a + (b * c)) > 0)'));
  assert.notDeepEqual(normalizedCheck("CHECK (label = 'A AND B')"),normalizedCheck("CHECK (label = 'A OR B')"));
  for(const unsupported of ['CHECK (a BETWEEN 1 AND 2)','CHECK (a = E\'a\\b\')','CHECK (a = $$b$$)','CHECK (CASE WHEN a THEN b ELSE c END)'])assert.equal(normalizedCheck(unsupported),unsupported);
});

test("semantic contract refuses security, environment, function, extension and schema drift",()=>{
  const source:RecoveryCatalog={version:2,semantic:{columns:[{name:'required',type:'text',nullable:false,default:"'ok'"}],constraints:[{definition:'required'}],indexes:[{definition:'unique'}],sequences:[{increment:1}],functions:[{definition:'body'}],extensions:[{name:'plpgsql'}]},security:{relations:[{owner:'app',acl:null}]},environment:[{locale:'source'}],roles:[{name:'app',superuser:false}]};
  assertRecoveryEquivalent(source,structuredClone(source));
  const mutations=[
    (r:RecoveryCatalog)=>{r.semantic.columns=[];},
    (r:RecoveryCatalog)=>{r.semantic.columns[0].type='integer';},
    (r:RecoveryCatalog)=>{r.semantic.columns[0].nullable=true;},
    (r:RecoveryCatalog)=>{r.semantic.columns[0].default="'changed'";},
    (r:RecoveryCatalog)=>{r.semantic.constraints=[];},(r:RecoveryCatalog)=>{r.semantic.indexes=[];},
    (r:RecoveryCatalog)=>{r.semantic.sequences[0].increment=2;},(r:RecoveryCatalog)=>{r.semantic.functions=[];},
    (r:RecoveryCatalog)=>{r.semantic.extensions=[];},(r:RecoveryCatalog)=>{r.security.relations[0].owner='other';},
    (r:RecoveryCatalog)=>{r.security.relations[0].acl='public write';},(r:RecoveryCatalog)=>{r.roles[0].superuser=true;},
    (r:RecoveryCatalog)=>{r.environment[0].locale='C';}
  ];
  for(const mutate of mutations){const changed=structuredClone(source);mutate(changed);assert.throws(()=>assertRecoveryEquivalent(source,changed));}
});

test("incomplete manifests, altered checksums, archive corruption and unknown artifacts refuse success",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"backup-manifest-"));
  const id=pointId(new Date("2026-10-14T12:30:10.123Z"),"01234567"),point=path.join(root,"points",id);
  const config:Config={root,repository:path.resolve("."),objectsRoot:path.resolve("runtime-assets"),databaseUrl:"postgresql://localhost/synthetic",pgBin:path.join(os.tmpdir(),"missing-native-backup-tools","bin")};
  try{
    await writeFile(path.join(root,"backup-root.json"),JSON.stringify({kind:rootKind}));await mkdir(point,{recursive:true});
    await writeFile(path.join(point,"database.dump"),"synthetic archive, no customer data");
    const manifest:Manifest={kind:"myomaton-backup/1",id,createdAt:"2026-10-14T12:30:10.123Z",application:{head:"synthetic"},source:{database:"synthetic",serverVersion:"18.6",includedSchemas:["public","drizzle"],excludedDisposableSchemas:[]},dump:{format:"custom",clientVersion:"18.6",file:"database.dump",size:(await readFile(path.join(point,"database.dump"))).length,sha256:await hashFile(path.join(point,"database.dump"))},state:{canonicalFingerprint:"a".repeat(64),tables:[],catalogHash:"b".repeat(64),sequences:[],migrations:[],customers:[],managed:[],nonManagedAssets:0}};
    await writeFile(path.join(point,"manifest.json"),JSON.stringify(manifest));await assert.rejects(verify(config,id));
    const checksums=`${manifest.dump.sha256}  database.dump\n${await hashFile(path.join(point,"manifest.json"))}  manifest.json\n`;
    await writeFile(path.join(point,"checksums.txt"),checksums);await writeFile(path.join(point,"COMPLETE"),JSON.stringify({checksumsSha256:await hashFile(path.join(point,"checksums.txt"))}));
    await assert.rejects(verify(config,id),/pg_restore failed/); // Valid synthetic envelope cannot disguise an unreadable archive.
    await writeFile(path.join(point,"database.dump"),"corruption");await assert.rejects(verify(config,id),/checksum differs/);
    await writeFile(path.join(point,"checksums.txt"),checksums+`${"a".repeat(64)}  ../outside\n`);await writeFile(path.join(point,"COMPLETE"),JSON.stringify({checksumsSha256:await hashFile(path.join(point,"checksums.txt"))}));await assert.rejects(verify(config,id));
    await assert.rejects(verify(config,".partial_unknown"));
  }finally{assert.ok(root.startsWith(path.join(os.tmpdir(),"backup-manifest-")));await rm(root,{recursive:true});}
});
test("native tool failures produce a non-success error without command/credential output",async()=>{
  await assert.rejects(native(path.join(os.tmpdir(),"missing-backup-tool"),"pg_dump",["synthetic-secret-argument"]),e=>e instanceof Error&&/pg_dump failed/.test(e.message)&&!e.message.includes("synthetic-secret-argument"));
});
test("artifact paths, schema exclusion and point identities are strictly bounded",()=>{
  for(const relative of ["../outside","a/../../outside","/absolute","C:/outside","a\\outside","a/..hidden"])assert.throws(()=>checkedRelative(relative));
  assert.equal(checkedRelative("objects/owner/objects/hash"),"objects/owner/objects/hash");
  const id=pointId(new Date("2026-10-14T12:30:10.123Z"),"01234567");assert.equal(id,"20261014T123010123Z_01234567");
  assert.equal(isDisposableSchema("canonical_test_"+"a".repeat(32)+"_intake"),true);
  for(const schema of ["public","drizzle","prospect_intakes","canonical_test_business"])assert.equal(isDisposableSchema(schema),false);
});
test("native connection configuration keeps credentials out of command arguments and fixes read-only mode",()=>{
  const env=connectionEnv("postgresql://operator:example%21password@localhost:5432/myomaton_dev",true);
  assert.equal(env.PGPASSWORD,"example!password");assert.equal(env.PGDATABASE,"myomaton_dev");assert.match(env.PGOPTIONS,/read_only=on/);
  assert.throws(()=>connectionEnv("https://example.com/db",true));assert.throws(()=>connectionEnv("postgresql://localhost/db?unsafe=1",true));
});
test("retention retains recent daily/older weekly points and never proposes unknown paths or deletes",()=>{
  const now=new Date("2026-10-14T12:00:00Z");
  const points=Array.from({length:90},(_,age)=>{const at=new Date(now.getTime()-age*86400000);return {id:pointId(at,"01234567"),createdAt:at.toISOString()};});
  const result=retentionPlan(points,now);assert.equal(result.keep.length,22);assert.equal(result.eligibleForOperatorRemoval.length,68);assert.equal(result.deletesPerformed,0);
  assert.ok(result.keep.includes(points[0].id));assert.throws(()=>retentionPlan([{id:"../live",createdAt:now.toISOString()}],now));
  assert.throws(()=>retentionPlan([{id:points[0].id,createdAt:"2030-01-01T00:00:00Z"}],now));
});
test("safe artifact reads reject traversal and symlink/reparse escapes; hashes detect changed bytes",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"backup-files-"));
  try{
    await mkdir(path.join(root,"point"));await writeFile(path.join(root,"point","database.dump"),"original");
    const file=await safeFile(root,"point/database.dump"),first=await hashFile(file);
    await writeFile(file,"modified");assert.notEqual(await hashFile(file),first);assert.equal((await readFile(file)).toString(),"modified");
    await assert.rejects(safeFile(root,"../outside"));
    await symlink(path.join(root,"point"),path.join(root,"escaped"),"junction");await assert.rejects(safeFile(root,"escaped/database.dump"));
  }finally{assert.ok(root.startsWith(path.join(os.tmpdir(),"backup-files-")));await rm(root,{recursive:true});}
});
