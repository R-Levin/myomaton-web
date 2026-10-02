import { parseArgs } from "node:util";
import { Pool } from "pg";
import { presenceId, updateMyomatonHomeV1 } from "./customer-updates/myomaton-home-v1";

async function main() {
  parseArgs({ options: {}, strict: true, allowPositionals: false });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await updateMyomatonHomeV1(pool);
    console.log(`${result.changed ? "Applied Home v1" : "Exact Home v1; no changes"}: ${presenceId}. Inserted ${result.inserted}; updated ${result.updated}.`);
    console.log(result.youtube);
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Home v1 update failed."); process.exitCode = 1; });
