import { parseArgs } from "node:util";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { bootstrapMyomaton } from "./customer-bootstrap/myomaton";

async function main() {
  const { values } = parseArgs({ options: { "web-presence-id": { type: "string" } }, strict: true, allowPositionals: false });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await bootstrapMyomaton(drizzle({ client: pool }), values["web-presence-id"]);
    console.log(`${result.created ? "Initialized baseline" : "Existing canonical Web Presence; nothing changed or repaired"}: ${result.webPresenceId}`);
  } finally { await pool.end(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Myomaton bootstrap failed."); process.exitCode = 1; });
