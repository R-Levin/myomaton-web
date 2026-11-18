import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { privatePixabayDiscovery, readPixabayResponse, type PixabaySend } from "../lib/platform/acquisition/pixabay-https";

const target = { webPresenceId:"11111111-1111-4111-8111-111111111111",managedSiteId:"22222222-2222-4222-8222-222222222222",
  pageId:"33333333-3333-4333-8333-333333333333",sectionId:"44444444-4444-4444-8444-444444444444" };
const key = "offline_fixture_key_never_real";
const authority = { async authorize() { return { operatorId:"fixture",authorityReference:"local test" }; } };
test("protected Pixabay transport reuses its 24-hour cache and never silently repeats a failed dispatch", async () => {
  const directory = await mkdtemp(join(tmpdir(), "miopages-stock-transport-"));
  let calls = 0;
  const send: PixabaySend = async options => {
    calls++;
    assert.equal(options.rejectUnauthorized,true);
    assert.equal(options.hostname,"pixabay.com");
    assert.ok(options.path?.includes("key="));
    return { status:200,contentType:"application/json",body:(async function* () { yield Buffer.from('{"hits":[]}'); })() };
  };
  try {
    const config = { directory,key,authority,queries:["fixture stock"],recheck:async()=>{},send };
    await privatePixabayDiscovery(config).search({},target,"fixture stock");
    await privatePixabayDiscovery(config).search({},target,"fixture stock");
    assert.equal(calls,1);
    await assert.rejects(privatePixabayDiscovery(config).search({},target,"unapproved query"), /outside/);
    for (const path of await readdir(directory)) assert.ok(!(await readFile(join(directory,path),"utf8")).includes(key));
    const failing = { ...config,queries:["failed query"],send:async()=>{ calls++;throw Error("request contains " + key); } };
    await assert.rejects(privatePixabayDiscovery(failing).search({},target,"failed query"),error=>{
      assert.ok(error instanceof Error && !error.message.includes(key)); return true;
    });
    await assert.rejects(privatePixabayDiscovery(failing).search({},target,"failed query"), /EEXIST/);
    assert.equal(calls,2);
    await assert.rejects(readPixabayResponse(key,new URLSearchParams({q:"fixture"}),async()=>({
      status:200,contentType:"application/json",body:(async function*(){yield Buffer.from(JSON.stringify({hits:[],reflected:key}));})()
    })),/credential_reflected/);
  } finally { await rm(directory,{recursive:true,force:true}); }
});
