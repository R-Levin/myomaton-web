import assert from "node:assert/strict";
import {mkdtemp,rm,readFile,readdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {searchApprovedPhotos} from "../scripts/pixabay-evaluation-search";
test("approved human searches run exactly twice, cache across restart and never persist the credential",async()=>{
 const directory=await mkdtemp(join(tmpdir(),"miopages-approved-stock-"));
 let calls=0;
 const key="offline_fixture_secret_never_real";
 const send=async()=>{calls++;return {status:200,contentType:"application/json",body:(async function*(){yield Buffer.from('{"hits":[]}')})()}};
 try{
  const result=await searchApprovedPhotos(directory,key,send);
  assert.equal(calls,2);assert.equal(result.downloads,0);assert.equal(result.searches.length,2);
  await searchApprovedPhotos(directory,key,send);assert.equal(calls,2);
  for(const name of await readdir(directory))assert.ok(!(await readFile(join(directory,name),"utf8")).includes(key));
 }finally{await rm(directory,{recursive:true,force:true})}
});
