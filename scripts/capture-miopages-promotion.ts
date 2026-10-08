import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { Pool } from "pg";
import { snapshotPublic, assertCommittedCustomer } from "./customer-previews/disposable";
import { manifest } from "./customer-initializers/miopages-c0";
import { stateFingerprint } from "../lib/platform/customer-initialization";
import { focusMioPagesPreview } from "./customer-previews/miopages-focus";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: "-c default_transaction_read_only=on" });
  try {
    const before = await snapshotPublic(pool); assertCommittedCustomer(before, manifest);
    const preview = JSON.parse(await readFile("runtime-content/miopages-focus-preview.json", "utf8"));
    assert.equal(stateFingerprint(before), preview.preservation.before);
    const client = await pool.connect();
    const accepted: Record<string, unknown[]> = {};
    try {
      await client.query("BEGIN READ ONLY"); await client.query(`SET LOCAL search_path="${String(preview.schema).match(/^canonical_test_[a-f0-9]{32}_preview$/)?.[0] ?? (()=>{throw Error("Invalid preview schema");})()}"`);
      for (const table of ["managed_sites", "design_systems", "pages", "sections", "actions"]) accepted[table] = (await client.query(`SELECT to_jsonb(t) row FROM ${table} t ORDER BY id`)).rows.map(r=>r.row);
    } finally { await client.query("ROLLBACK"); client.release(); }
    await mkdir("runtime-content/miopages-promotion", { recursive: true });
    await writeFile("runtime-content/miopages-promotion/before.json", JSON.stringify(before,null,2)+"\n");
    await writeFile("runtime-content/miopages-promotion/accepted-preview.json", JSON.stringify({ state: accepted, plan: focusMioPagesPreview },null,2)+"\n");
    console.log(JSON.stringify({ complete: stateFingerprint(before), counts: Object.fromEntries(Object.entries(before).map(([t,rows])=>[t,rows.length])), preview: preview.url, frozen: true },null,2));
  } finally { await pool.end(); }
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1;});
