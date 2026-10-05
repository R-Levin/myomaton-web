import { parseArgs } from "node:util";
import { Pool } from "pg";
import { updateVisualDirectionV2 } from "./customer-updates/myomaton-visual-direction-v2";

async function main() {
  parseArgs({ options: {}, strict: true, allowPositionals: false });
  if (!process.env.DATABASE_URL) throw Error("DATABASE_URL is not configured.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await updateVisualDirectionV2(pool);
    console.log(`${result.changed ? "Applied accepted Myomaton reference v2" : "Exact accepted Myomaton v2; no changes"}: inserted ${result.inserted}; updated ${result.updated}; deleted ${result.deleted}.`);
    console.log("Stored customer choices only; runtime service policy still controls effective motion.");
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Visual Direction v2 transition failed."); process.exitCode = 1; });
