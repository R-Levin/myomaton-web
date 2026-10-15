import { parseArgs } from "node:util";
import { Pool } from "pg";
import { intakeDatabaseUrl } from "./intake/disposable";
import { IntakeService } from "../lib/platform/intake/service";
import { mioPagesIntakeOwner } from "../lib/platform/intake/availability";
import { intakeStorageSchema } from "../lib/platform/intake/storage";

// Trusted local operator shell + database access; no public operator endpoint.
async function main() {
const args = parseArgs({ options: { schema: { type: "string" }, id: { type: "string" }, "shared-development": { type: "boolean", default: false } }, strict: true });
if (!process.env.DATABASE_URL || (args.values["shared-development"] ? !!args.values.schema : !args.values.schema)) throw Error("Select exactly one disposable schema or explicit shared-development mode");
const url = new URL(args.values["shared-development"] ? process.env.DATABASE_URL : intakeDatabaseUrl(process.env.DATABASE_URL, args.values.schema!));
if (args.values["shared-development"]) {
  url.searchParams.set("options", "-c search_path=public -c timezone=UTC");
  intakeStorageSchema(url.toString(), { ...process.env, MIOPAGES_REVIEW_INTAKE: "shared-development", INTAKE_DATABASE_URL: url.toString() }, mioPagesIntakeOwner);
}
url.searchParams.set("options", url.searchParams.get("options") + " -c default_transaction_read_only=on");
const pool = new Pool({ connectionString: url.toString() });
try {
  const rows = await new IntakeService(pool, mioPagesIntakeOwner).queue(args.values.id);
  console.log(JSON.stringify(rows, null, 2));
} finally { await pool.end(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Operator inspection unavailable"); process.exitCode = 1; });
