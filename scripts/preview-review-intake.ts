import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { setTimeout } from "node:timers/promises";
import { createIntakeFixture, intakeDatabaseUrl, intakeSchema } from "./intake/disposable";
import { mioPagesIntakeOwner } from "../lib/platform/intake/availability";
import { intakeStorageSchema } from "../lib/platform/intake/storage";
import { Pool } from "pg";

async function main() {
const args = parseArgs({ options: { resume: { type: "boolean", default: false }, "shared-development": { type: "boolean", default: false }, "output-directory": { type: "string" } }, strict: true });
if (!process.env.DATABASE_URL) throw Error("Local database configuration required");
const shared = args.values["shared-development"];
if (shared && (args.values.resume || process.env.NODE_ENV === "production")) throw Error("Shared development cannot resume/replace the disposable preview or run in production");
const directory = args.values["output-directory"] ?? "runtime-content/miopages-review-intake";
if (!path.resolve(directory).startsWith(path.resolve("runtime-content") + path.sep)) throw Error("Preview output must stay under runtime-content");
await mkdir(directory, { recursive: true });
let schema: string;
if (shared) schema = "public";
else if (args.values.resume) schema = intakeSchema(JSON.parse(await readFile(`${directory}/preview.json`, "utf8")).schema);
else { const fixture = await createIntakeFixture(process.env.DATABASE_URL); schema = fixture.schema; await fixture.verify(); await fixture.close(); }
// Persist this named disposable prospect schema across server stops/restarts.
// No automatic migration, test seed, cleanup or canonical customer write on requests.
const reservation = createServer(); reservation.listen(0, "127.0.0.1"); await once(reservation, "listening");
const port = (reservation.address() as { port: number }).port;
await new Promise<void>(resolve => reservation.close(() => resolve()));
const canonical = new URL(process.env.DATABASE_URL); canonical.searchParams.set("options", "-c search_path=public -c default_transaction_read_only=on");
const writer = shared ? new URL(process.env.DATABASE_URL) : new URL(intakeDatabaseUrl(process.env.DATABASE_URL, schema));
const mode = shared ? "shared-development" : "local-development";
if (shared) {
  writer.searchParams.set("options", "-c search_path=public -c timezone=UTC");
  intakeStorageSchema(writer.toString(), { ...process.env, NODE_ENV: "development", MIOPAGES_REVIEW_INTAKE: mode, INTAKE_DATABASE_URL: writer.toString() }, mioPagesIntakeOwner);
  const check = new Pool({ connectionString: canonical.toString() });
  try {
    if ((await check.query("SELECT count(*)::int n FROM drizzle.__drizzle_migrations")).rows[0].n !== 11) throw Error("Ordered migrations must already be applied; this runner never migrates");
    await check.query("SELECT id FROM public.prospect_intakes LIMIT 0");
    await check.query("SELECT id FROM public.prospect_intake_submissions LIMIT 0");
  } finally { await check.end(); }
}
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
  windowsHide: true, stdio: "inherit", env: { ...process.env, DATABASE_URL: canonical.toString(), INTAKE_DATABASE_URL: writer.toString(),
    MIOPAGES_REVIEW_INTAKE: mode, WEB_PRESENCE_ID: mioPagesIntakeOwner.webPresenceId, MANAGED_SITE_ID: mioPagesIntakeOwner.managedSiteId, PRESENTATION_PREVIEW_SCHEMA: "" },
});
const base = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw Error("Development server exited");
    try { if ((await fetch(`${base}/api/intake`, { headers: { "X-Intake-Request": "1" }, signal: AbortSignal.timeout(3000) })).ok) { ready = true; break; } } catch { /* Startup only. */ }
    await setTimeout(200);
  }
  if (!ready) throw Error("Development intake unavailable");
  const receipt = { schema, base, reviewUrl: `${base}/review`, interviewUrl: `${base}/review/intake`, processId: child.pid, canonicalReadOnly: true, publicMigrationsApplied: shared, persistentDisposableSchema: !shared, mode };
  await writeFile(`${directory}/${shared ? "shared-development" : "preview"}.json`, JSON.stringify(receipt, null, 2) + "\n"); console.log(JSON.stringify(receipt, null, 2));
  await new Promise<void>(resolve => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); child.once("exit", resolve); });
} finally { if (child.exitCode === null) { const exited = once(child, "exit"); child.kill(); await exited; } }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Intake preview unavailable"); process.exitCode = 1; });
