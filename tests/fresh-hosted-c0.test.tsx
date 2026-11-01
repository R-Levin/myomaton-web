import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { managedOperatorDiagnostic, managedOperatorEnvironment, validateManagedOperator } from "../scripts/db/managed-operator";
import { validateHostnameBinding } from "../scripts/db/managed-hostname";
import { manifest,baseline } from "../scripts/customer-initializers/miopages-c0";

test("fresh hosted operators require explicit protected identity and distinct managed roles",()=>{
  const config={databaseUrl:"postgresql://localhost/synthetic",databaseName:"synthetic",roles:{runtime:"site_runtime",migration:"site_migration",backup:"site_backup"}};
  validateManagedOperator(config);
  for(const invalid of [{...config,databaseName:"other"},{...config,roles:{...config.roles,runtime:"postgres"}},{...config,roles:{...config.roles,backup:config.roles.runtime}}])assert.throws(()=>validateManagedOperator(invalid));
  assert.throws(()=>managedOperatorEnvironment("fresh-hosted-c0",{}));
  assert.equal(baseline.migrations.length,9);assert.equal(manifest.rows.pages.length,4);assert.equal(manifest.rows.sections.length,19);
});
test("hostname operator requires exact normalized hostname and UUID ownership",()=>{
  validateHostnameBinding({hostname:"runtime.miopages.com",webPresenceId:manifest.webPresenceId,managedSiteId:manifest.managedSiteId});
  for(const hostname of ["Runtime.miopages.com","runtime.miopages.com.","runtime.miopages.com:443","127.0.0.1","bad_host.test"])
    assert.throws(()=>validateHostnameBinding({hostname,webPresenceId:manifest.webPresenceId,managedSiteId:manifest.managedSiteId}));
  assert.throws(()=>validateHostnameBinding({hostname:"synthetic.example",webPresenceId:"invalid",managedSiteId:manifest.managedSiteId}));
  assert.throws(()=>validateHostnameBinding({hostname:"synthetic.example",webPresenceId:manifest.webPresenceId.toUpperCase(),managedSiteId:manifest.managedSiteId}));
});
test("new protected entry points refuse before connection and never disclose arbitrary diagnostics",()=>{
  for(const file of ["scripts/initialize-fresh-hosted-miopages-c0.ts","scripts/manage-hostname-binding.ts"]){
    assert.doesNotMatch(readFileSync(file,"utf8"),/dotenv|env-file|process\.argv/);
    const env={...process.env};delete env.MIOPAGES_DATABASE_OPERATION;
    const result=spawnSync(process.execPath,["--import","tsx",file],{env,encoding:"utf8",windowsHide:true});
    assert.equal(result.status,1);assert.equal(JSON.parse(result.stderr).stage,"configuration");assert.equal(result.stdout,"");
  }
  const privateText="private database SQL connection and credentials";
  const diagnostic=managedOperatorDiagnostic(Object.assign(new Error(privateText),{managedOperatorStage:"preflight",code:"42501",detail:privateText}));
  assert.equal(diagnostic.stage,"preflight");assert.equal(diagnostic.sqlState,"42501");assert.ok(!JSON.stringify(diagnostic).includes(privateText));
  assert.equal(managedOperatorDiagnostic({managedOperatorStage:privateText,code:privateText}).stage,"configuration");
});
