import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { disposableCluster } from "../backup/disposable-cluster";
import { migrateWithBootstrapCompatibility } from "../db/bootstrap";
import { addClientPerson } from "../../lib/platform/accounts/people";
import { importOnboarding, onboardingFromManifest } from "../../lib/platform/knowledge/import";

/**
 * Local preview of the Specialist workspace and Client Portal (rebuild plan, milestone 2). A
 * throwaway database holds C0 as an Account, with its onboarding imported and one Client person.
 * Nothing here touches a hosted system. Stop it to throw the database away.
 */
async function main() {
  const port = Number(process.env.PORT ?? 4480);
  const cluster = await disposableCluster(process.env.PG_BIN_DIR ?? "C:/Program Files/PostgreSQL/18/bin");
  const pool = new Pool({ connectionString: cluster.url });
  await migrateWithBootstrapCompatibility(pool);
  for (const file of ["lib/platform/service/records.sql", "lib/platform/accounts/people.sql"]) await pool.query(await readFile(file, "utf8"));
  const organization = randomUUID(), webPresenceId = randomUUID();
  await pool.query("INSERT INTO organizations(id,name) VALUES($1,'MioPages (C0)')", [organization]);
  await pool.query("INSERT INTO web_presences(id,organization_id,name) VALUES($1,$2,'MioPages (C0)')", [webPresenceId, organization]);
  await pool.query("INSERT INTO managed_sites(id,web_presence_id,name) VALUES($1,$2,'MioPages (C0)')", [randomUUID(), webPresenceId]);
  const manifest = JSON.parse(await readFile("scripts/customer-initializers/miopages-c0-manifest.json", "utf8"));
  await importOnboarding(pool, webPresenceId, onboardingFromManifest(manifest), "principal", "C0 onboarding, done before Core");
  await addClientPerson(pool, webPresenceId, { name: "Principal (speaking as the Client)", email: "principal@c0.preview" },
    { operatorId: "specialist", authorityReference: "Local preview" }, "For C0 the Principal speaks as the Client");
  await pool.end();
  console.log(`Workspace preview: http://localhost:${port}/workspace`);
  const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(port)], { stdio: "inherit",
    env: { ...process.env, MIOPAGES_WORKSPACE: "local-preview", SERVICE_DATABASE_URL: cluster.url, DATABASE_URL: cluster.url, NEXT_TELEMETRY_DISABLED: "1" } });
  const stop = async () => { next.kill(); await cluster.stop().catch(() => undefined); process.exit(0); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop); next.on("exit", stop);
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Preview failed"); process.exitCode = 1; });
