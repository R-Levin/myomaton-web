import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { seedPlatform } from "./seed-data/platform";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await seedPlatform(drizzle({ client: pool }));
    console.log("Platform reference seed complete. No customer state was created or updated.");
  } finally { await pool.end(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Platform seed failed."); process.exitCode = 1; });
