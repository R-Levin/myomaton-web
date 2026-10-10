import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import reviewed from "../../scripts/customer-updates/miopages-focus-reviewed.json";
import { readBasis } from "../../lib/platform/operator-qc/context";
import { assertFresh,createPacket } from "../../lib/platform/operator-qc/model";
const url=process.env.ASSET_TEST_DATABASE_URL;
test("actual MioPages QC reads preserve canonical state, acquire nothing and reject foreign scope",{skip:!url},async()=>{
  const pool=new Pool({connectionString:url,options:"-c default_transaction_read_only=on -c timezone=UTC"});try{
    const before=await readBasis(pool,{target:reviewed.target,buildId:"fixture"});assert.equal(before.needs.length,5);assert.ok(before.truth.every(t=>t.projected));
    const packet=createPacket(before);assertFresh(packet,await readBasis(pool,{target:reviewed.target,buildId:"fixture"}));
    await assert.rejects(readBasis(pool,{target:{...reviewed.target,organizationId:"00000000-0000-4000-8000-000000000001"},buildId:"fixture"}));
    const db=await pool.connect();try{await assert.rejects(db.query("UPDATE public.managed_sites SET name=name WHERE id=$1",[reviewed.target.managedSiteId]),/read-only/);}finally{db.release();}
    try{const receipt=JSON.parse(await readFile("runtime-content/acquisition/canonical_test_d4f17dcfacb644aca5624f38c1a40744_acquisition.json","utf8"));const b=await readBasis(pool,{target:reviewed.target,buildId:"fixture",acquisitionSchema:receipt.schema});const hero=b.needs.find(n=>n.heroDecision)!;assert.equal(hero.history.length,3);assert.equal(hero.history.reduce((n,w)=>n+Number(w.attempts),0),3);assert.equal((hero.history[2].candidates as {state:string}[])[0].state,"proposed");assertFresh(createPacket(b),await readBasis(pool,{target:reviewed.target,buildId:"fixture",acquisitionSchema:receipt.schema}));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}
    const after=await readBasis(pool,{target:reviewed.target,buildId:"fixture"});assert.equal(after.canonicalFingerprint,before.canonicalFingerprint);assert.equal(after.siteFingerprint,before.siteFingerprint);
  }finally{await pool.end();}
});
