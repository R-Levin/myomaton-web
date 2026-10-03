import { parseArgs } from "node:util";
import { Pool } from "pg";
import { updateSecondaryPagesV1 } from "./customer-updates/myomaton-secondary-pages-v1";

async function main() {
  parseArgs({ options: {}, strict: true, allowPositionals: false });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await updateSecondaryPagesV1(pool);
    console.log(`${result.changed ? "Applied secondary Pages v1" : "Exact secondary Pages v1; no changes"}: inserted ${result.inserted}; updated ${result.updated}; deleted ${result.deleted}.`);
    console.log("Learn about Myomaton Action retained; no Action lifecycle deletion performed.");
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Secondary Pages update failed."); process.exitCode = 1; });
