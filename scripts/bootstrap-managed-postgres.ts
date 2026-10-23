import assert from "node:assert/strict";
import { Pool } from "pg";
import { migrateWithBootstrapCompatibility } from "./db/bootstrap";

async function main() {
  assert.equal(process.env.MIOPAGES_DATABASE_OPERATION, "managed-bootstrap", "Explicit managed-bootstrap operation required");
  assert.ok(process.env.DATABASE_URL, "Supply protected migration-role configuration explicitly");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try { console.log(JSON.stringify(await migrateWithBootstrapCompatibility(pool))); }
  finally { await pool.end(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Bootstrap failed"); process.exitCode = 1; });
