import { Pool } from "pg";
import { initializeMioPages } from "./customer-initializers/miopages-c0";
async function main() {
  if (!process.env.DATABASE_URL) throw Error("DATABASE_URL required");
  const pool=new Pool({connectionString:process.env.DATABASE_URL});
  try { console.log(JSON.stringify(await initializeMioPages(pool))); } finally { await pool.end(); }
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Initializer failed");process.exitCode=1;});
