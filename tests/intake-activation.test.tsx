import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { intakeEnabled, mioPagesIntakeOwner } from "../lib/platform/intake/availability";
import { intakeStorageSchema } from "../lib/platform/intake/storage";

const source="postgresql://test:unused@localhost:5432/myomaton_dev";
const connection=new URL(source);connection.searchParams.set("options","-c search_path=public -c timezone=UTC");
const writer=connection.toString();
const env={NODE_ENV:"development" as const,MIOPAGES_REVIEW_INTAKE:"shared-development",DATABASE_URL:source,INTAKE_DATABASE_URL:writer};

test("actual API handler refuses production/foreign writers before pool construction and ignores request tenant hints",()=>{
  const script=`
    const pg=require('pg');let pools=0,queries=0;
    pg.Pool=class {constructor(){pools++;}query(){queries++;throw Error('Database access forbidden in activation proof');}};
    const {GET}=require('./app/api/intake/route.ts');
    (async()=>{const response=await GET(new Request('http://127.0.0.1/api/intake',{headers:{Host:process.env.PROBE_HOST||'127.0.0.1','X-Intake-Request':'1','X-Web-Presence-Id':'foreign','X-Managed-Site-Id':'foreign'}}));
    console.log(JSON.stringify({status:response.status,body:await response.json(),pools,queries}));})().catch(()=>{process.exitCode=1;});`;
  const cases: { patch: Partial<NodeJS.ProcessEnv>; status: number; pools: number }[]=[
    {patch:{NODE_ENV:"production"},status:503,pools:0},
    {patch:{NODE_ENV:"production",MIOPAGES_REVIEW_INTAKE:"local-development"},status:503,pools:0},
    {patch:{WEB_PRESENCE_ID:"00000000-0000-4000-8000-000000000001"},status:503,pools:0},
    {patch:{MANAGED_SITE_ID:"00000000-0000-4000-8000-000000000002"},status:503,pools:0},
    {patch:{MIOPAGES_REVIEW_INTAKE:""},status:503,pools:0},
    {patch:{MIOPAGES_REVIEW_INTAKE:"local-development"},status:503,pools:0},
    {patch:{PROBE_HOST:"foreign.example"},status:503,pools:1},
    {patch:{},status:200,pools:1},
  ];
  for(const c of cases){
    const child=spawnSync(process.execPath,["--require",require.resolve("tsx/cjs"),"-e",script],{encoding:"utf8",windowsHide:true,timeout:15000,
      env:{...process.env,...env,WEB_PRESENCE_ID:mioPagesIntakeOwner.webPresenceId,MANAGED_SITE_ID:mioPagesIntakeOwner.managedSiteId,PROBE_HOST:"",...c.patch}});
    assert.equal(child.status,0,"Isolated API proof failed");const result=JSON.parse(child.stdout.trim());
    assert.equal(result.status,c.status);assert.equal(result.pools,c.pools);assert.equal(result.queries,0);
    if(c.status===200)assert.deepEqual(result.body,{state:"not_started"});
  }
});

test("shared-development intake explicitly selects only the local development database and exact service owner/site",()=>{
  assert.equal(intakeEnabled(mioPagesIntakeOwner,env),true);
  assert.equal(intakeStorageSchema(writer,env,mioPagesIntakeOwner),"public");
  for(const selection of [{...mioPagesIntakeOwner,webPresenceId:"foreign"},{...mioPagesIntakeOwner,managedSiteId:"foreign"}]){
    assert.equal(intakeEnabled(selection,env),false);assert.throws(()=>intakeStorageSchema(writer,env,selection));
  }
});

test("production, missing/incorrect modes and missing configuration refuse the shared writer",()=>{
  for(const patch of [{NODE_ENV:"production"},{NODE_ENV:"test"},{MIOPAGES_REVIEW_INTAKE:undefined},{MIOPAGES_REVIEW_INTAKE:"local-development"},{MIOPAGES_REVIEW_INTAKE:"shared"},{DATABASE_URL:undefined},{INTAKE_DATABASE_URL:undefined}]){
    assert.throws(()=>intakeStorageSchema(writer,{...env,...patch},mioPagesIntakeOwner));
  }
  assert.equal(intakeEnabled(mioPagesIntakeOwner,{...env,NODE_ENV:"production"}),false);
});

test("shared mode refuses remote, other-database, other-port, mixed-schema and different-source connections",()=>{
  for(const mutate of [(u:URL)=>{u.hostname="example.test";},(u:URL)=>{u.pathname="/myomaton_prod";},(u:URL)=>{u.port="5433";},(u:URL)=>{u.searchParams.set("options","-c search_path=public,other -c timezone=UTC");},(u:URL)=>{u.searchParams.set("options","-c search_path=public -c timezone=UTC -c default_transaction_read_only=off");}]){
    const other=new URL(writer);mutate(other);assert.throws(()=>intakeStorageSchema(other.toString(),{...env,INTAKE_DATABASE_URL:other.toString()},mioPagesIntakeOwner));
  }
  assert.throws(()=>intakeStorageSchema(writer,{...env,DATABASE_URL:"postgresql://localhost/another_database"},mioPagesIntakeOwner));
});

test("accepted disposable mode remains unchanged and cannot masquerade as shared-development storage",()=>{
  const schema="canonical_test_"+"a".repeat(32)+"_intake",url=new URL(source);
  url.searchParams.set("options",`-c search_path=${schema} -c timezone=UTC`);
  assert.equal(intakeStorageSchema(url.toString(),{MIOPAGES_REVIEW_INTAKE:"local-development"}),schema);
  assert.throws(()=>intakeStorageSchema(url.toString(),{...env,INTAKE_DATABASE_URL:url.toString()},mioPagesIntakeOwner));
});


test("shared and preserved disposable browser sessions remain independent", async () => {
  const { intakeHttp, intakeCookie, sessionToken } = await import("../lib/platform/intake/http");
  const { developmentGuard } = await import("../lib/platform/contact/boundaries");
  const oldToken = "a".repeat(64), sharedToken = "b".repeat(64);
  const request = new Request("http://localhost/api/intake", { headers: { "X-Intake-Request": "1", Cookie: `${intakeCookie}=${oldToken}; miopages_intake_shared_development=${sharedToken}` } });
  const seen: string[] = [];
  const service = { selection: mioPagesIntakeOwner, resume: async (token: string) => { seen.push(token); return { state: "draft" }; } } as unknown as import("../lib/platform/intake/service").IntakeService;
  assert.equal((await intakeHttp(request, service, developmentGuard(100), true, true)).status, 200);
  assert.equal((await intakeHttp(request, service, developmentGuard(100), true)).status, 200);
  assert.deepEqual(seen, [sharedToken, oldToken]);
  const disposableOnly = new Request(request.url, { headers: { "X-Intake-Request": "1", Cookie: `${intakeCookie}=${oldToken}` } });
  assert.deepEqual(await (await intakeHttp(disposableOnly, service, developmentGuard(100), true, true)).json(), { state: "not_started" });
  assert.equal(sessionToken(disposableOnly), oldToken);
});
