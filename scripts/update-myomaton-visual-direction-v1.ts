import { parseArgs } from "node:util";
import { Pool } from "pg";
import { updateVisualDirectionV1 } from "./customer-updates/myomaton-visual-direction-v1";

async function main() {
  parseArgs({ options: {}, strict: true, allowPositionals: false });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await updateVisualDirectionV1(pool);
    console.log(`${result.changed ? "Applied Visual Direction v1" : "Exact Visual Direction v1; no changes"}: inserted ${result.inserted}; updated ${result.updated}; deleted ${result.deleted}.`);
    console.log("Stored intent only. Effective motion and preferences remain constrained by runtime service policy.");
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Visual Direction update failed."); process.exitCode = 1; });
