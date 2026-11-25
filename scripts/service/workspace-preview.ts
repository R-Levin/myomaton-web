import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { disposableCluster } from "../backup/disposable-cluster";
import { migrateWithBootstrapCompatibility } from "../db/bootstrap";
import { addClientPerson } from "../../lib/platform/accounts/people";
import { importOnboarding, onboardingFromManifest } from "../../lib/platform/knowledge/import";
import { previewWordPress } from "./preview-wordpress";

/**
 * Local preview of the Specialist workspace and Client Portal (rebuild plan, milestone 2). A
 * throwaway database holds C0 as an Account, with its onboarding imported and one Client person.
 * Its own throwaway WordPress receives the drafts. Nothing here touches a hosted system or any
 * existing local site. Stop it to throw the database and the WordPress copy away.
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
  const managedSiteId = randomUUID();
  await pool.query("INSERT INTO managed_sites(id,web_presence_id,name) VALUES($1,$2,'MioPages (C0)')", [managedSiteId, webPresenceId]);
  const manifest = JSON.parse(await readFile("scripts/customer-initializers/miopages-c0-manifest.json", "utf8"));
  await importOnboarding(pool, webPresenceId, onboardingFromManifest(manifest), "principal", "C0 onboarding, done before Core");
  await addClientPerson(pool, webPresenceId, { name: "Principal (speaking as the Client)", email: "principal@c0.preview" },
    { operatorId: "specialist", authorityReference: "Local preview" }, "For C0 the Principal speaks as the Client");
  await pool.end();
  const root = await mkdtemp(join(tmpdir(), "miopages-workspace-preview-"));
  // The delivery plugin needs WordPress on MySQL/MariaDB, as hosted: MIOPAGES_PREVIEW_MYSQL is a
  // local MariaDB's bin folder (default: ~/tools/mariadb-11.4.14-winx64/bin). Without it the preview runs without WordPress and the workspace says so.
  const mysqlBin = process.env.MIOPAGES_PREVIEW_MYSQL ?? join(homedir(), "tools", "mariadb-11.4.14-winx64", "bin");
  const wordpress = existsSync(join(mysqlBin, "mariadbd.exe")) ? await previewWordPress({ root, port: Number(process.env.WORDPRESS_PORT ?? 4481), databasePort: Number(process.env.WORDPRESS_DATABASE_PORT ?? 4482),
    mysqlBin, organizationId: organization,
    account: { webPresenceId, managedSiteId }, siteName: "MioPages (C0)",
    source: process.env.WORDPRESS_SOURCE ?? "../p022-wp-validation/wordpress" }) : null;
  console.log(`Workspace preview: http://127.0.0.1:${port}/workspace`);
  console.log(wordpress ? `Its WordPress: ${wordpress.origin}/wp-admin (login in ${wordpress.login})` : "No WordPress: set MIOPAGES_PREVIEW_MYSQL to a local MariaDB to add one.");
  const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-H", "127.0.0.1", "-p", String(port)], { stdio: "inherit",
    env: { ...process.env, MIOPAGES_WORKSPACE: "local-preview", SERVICE_DATABASE_URL: cluster.url, DATABASE_URL: cluster.url, NEXT_TELEMETRY_DISABLED: "1",
    ...(wordpress && { MIOPAGES_PREVIEW_WORDPRESS: wordpress.config }) } });
  const stop = async () => { next.kill(); wordpress?.stop(); await cluster.stop().catch(() => undefined);
    await rm(root, { recursive: true, force: true }).catch(() => undefined); process.exit(0); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop); next.on("exit", stop);
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Preview failed"); process.exitCode = 1; });
