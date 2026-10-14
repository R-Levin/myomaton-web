import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { setTimeout } from "node:timers/promises";
import { createIntakeFixture, intakeDatabaseUrl, intakeSchema } from "./intake/disposable";
import { mioPagesIntakeOwner } from "../lib/platform/intake/availability";

async function main() {
const args = parseArgs({ options: { resume: { type: "boolean", default: false } }, strict: true });
if (!process.env.DATABASE_URL) throw Error("Local database configuration required");
const directory = "runtime-content/miopages-review-intake";
await mkdir(directory, { recursive: true });
let schema: string;
if (args.values.resume) schema = intakeSchema(JSON.parse(await readFile(`${directory}/preview.json`, "utf8")).schema);
else { const fixture = await createIntakeFixture(process.env.DATABASE_URL); schema = fixture.schema; await fixture.verify(); await fixture.close(); }
// Persist this named disposable prospect schema across server stops/restarts.
// No automatic migration, test seed, cleanup or canonical customer write on requests.
const reservation = createServer(); reservation.listen(0, "127.0.0.1"); await once(reservation, "listening");
const port = (reservation.address() as { port: number }).port;
await new Promise<void>(resolve => reservation.close(() => resolve()));
const canonical = new URL(process.env.DATABASE_URL); canonical.searchParams.set("options", "-c search_path=public -c default_transaction_read_only=on");
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
  windowsHide: true, stdio: "inherit", env: { ...process.env, DATABASE_URL: canonical.toString(), INTAKE_DATABASE_URL: intakeDatabaseUrl(process.env.DATABASE_URL, schema),
    MIOPAGES_REVIEW_INTAKE: "local-development", WEB_PRESENCE_ID: mioPagesIntakeOwner.webPresenceId, MANAGED_SITE_ID: mioPagesIntakeOwner.managedSiteId, PRESENTATION_PREVIEW_SCHEMA: "" },
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
  const receipt = { schema, base, reviewUrl: `${base}/review`, interviewUrl: `${base}/review/intake`, processId: child.pid, canonicalReadOnly: true, publicMigrationsApplied: false, persistentDisposableSchema: true };
  await writeFile(`${directory}/preview.json`, JSON.stringify(receipt, null, 2) + "\n"); console.log(JSON.stringify(receipt, null, 2));
  await new Promise<void>(resolve => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); child.once("exit", resolve); });
} finally { if (child.exitCode === null) { const exited = once(child, "exit"); child.kill(); await exited; } }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Intake preview unavailable"); process.exitCode = 1; });
