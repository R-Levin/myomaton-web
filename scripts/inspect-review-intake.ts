import { parseArgs } from "node:util";
import { Pool } from "pg";
import { intakeDatabaseUrl } from "./intake/disposable";
import { IntakeService } from "../lib/platform/intake/service";
import { mioPagesIntakeOwner } from "../lib/platform/intake/availability";

// Trusted local operator shell + database access; no public operator endpoint.
async function main() {
const args = parseArgs({ options: { schema: { type: "string" }, id: { type: "string" } }, strict: true });
if (!args.values.schema || !process.env.DATABASE_URL) throw Error("Explicit disposable intake schema and local database configuration required");
const url = new URL(intakeDatabaseUrl(process.env.DATABASE_URL, args.values.schema));
url.searchParams.set("options", url.searchParams.get("options") + " -c default_transaction_read_only=on");
const pool = new Pool({ connectionString: url.toString() });
try {
  const rows = await new IntakeService(pool, mioPagesIntakeOwner).queue(args.values.id);
  console.log(JSON.stringify(rows, null, 2));
} finally { await pool.end(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Operator inspection unavailable"); process.exitCode = 1; });
