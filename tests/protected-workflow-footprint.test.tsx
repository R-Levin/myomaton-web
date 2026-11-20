import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("protected account review does not initialize the research browser runtime",()=>{
  const env={...Object.fromEntries(["PATH","SystemRoot","WINDIR","TEMP","TMP","HOME","USERPROFILE"]
    .filter(key=>process.env[key]!==undefined).map(key=>[key,process.env[key]!])),NODE_ENV:"test" as const};
  const result=spawnSync(process.execPath,["--import","tsx","-e",`
    require('./lib/platform/intake/protected-presence-workflow.ts');
    console.log(JSON.stringify({browserLoaded:Object.keys(require.cache).some(name=>name.includes('playwright-core'))}));
  `],{cwd:process.cwd(),env,encoding:"utf8",timeout:20000});
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),{browserLoaded:false});
});
