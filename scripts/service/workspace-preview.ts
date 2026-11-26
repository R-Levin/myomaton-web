import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { evidenceFrom, withEvidence, type EvidenceSpec } from "../../lib/platform/service/evidence";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { disposableCluster } from "../backup/disposable-cluster";
import { migrateWithBootstrapCompatibility } from "../db/bootstrap";
import { addClientPerson } from "../../lib/platform/accounts/people";
import { importOnboarding, onboardingFromManifest } from "../../lib/platform/knowledge/import";
import { previewWordPress } from "./preview-wordpress";
import type { ServiceRecord } from "../../lib/platform/service/cycle";
import { ServiceStore } from "../../lib/platform/service/store";
import { inspectCanonical, writeCanonical } from "../../lib/platform/canonical/writes";

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
  // An AI run the Principal approved (--ai-run <name> --cap <dollars>): its spending, answers, Knowledge and the
  // Account's service record are kept in runtime-content/ai-runs/<name> (outside Git), and restored when the preview
  // restarts. The Account keeps the same identity across restarts, since the run's spending is owned by it.
  const flag = (name: string) => { const at = process.argv.indexOf(name); return at > 0 ? process.argv[at + 1] : undefined; };
  const aiRun = flag("--ai-run"), cap = Number(flag("--cap"));
  if (aiRun && (!/^[a-z0-9-]{3,60}$/u.test(aiRun) || !(cap > 0 && cap <= 50))) throw Error("An AI run needs a plain name and a cap in dollars (at most 50)");
  const runDirectory = aiRun ? join(process.cwd(), "runtime-content", "ai-runs", aiRun) : null;
  const savedRecord = runDirectory && existsSync(join(runDirectory, "record.json")) ? JSON.parse(await readFile(join(runDirectory, "record.json"), "utf8")) as ServiceRecord : null;
  const organization = randomUUID(), webPresenceId = savedRecord?.account.webPresenceId ?? randomUUID();
  await pool.query("INSERT INTO organizations(id,name) VALUES($1,'MioPages (C0)')", [organization]);
  await pool.query("INSERT INTO web_presences(id,organization_id,name) VALUES($1,$2,'MioPages (C0)')", [webPresenceId, organization]);
  const managedSiteId = savedRecord?.account.managedSiteId ?? randomUUID();
  await pool.query("INSERT INTO managed_sites(id,web_presence_id,name) VALUES($1,$2,'MioPages (C0)')", [managedSiteId, webPresenceId]);
  const manifest = JSON.parse(await readFile("scripts/customer-initializers/miopages-c0-manifest.json", "utf8"));
  await importOnboarding(pool, webPresenceId, onboardingFromManifest(manifest), "principal", "C0 onboarding, done before Core");
  await addClientPerson(pool, webPresenceId, { name: "Principal (speaking as the Client)", email: "principal@c0.preview" },
    { operatorId: "specialist", authorityReference: "Local preview" }, "For C0 the Principal speaks as the Client");
  const account = { webPresenceId, managedSiteId }, store = new ServiceStore(pool);
  if (savedRecord) {
    await store.save(await store.read(account), { ...savedRecord, account });
    console.log("Restored the run's service record.");
  }
  // C0's Evidence: the sections of its own documents and the Principal's direction that Core reads with its Knowledge.
  const spec = JSON.parse(await readFile("scripts/customer-initializers/miopages-c0-evidence.json", "utf8")) as EvidenceSpec;
  const evidence = evidenceFrom(spec, file => readFileSync(file, "utf8"));
  const withC0Evidence = await store.read(account);
  await store.save(withC0Evidence, withEvidence(withC0Evidence, evidence));
  console.log(`C0's Evidence: ${evidence.length} sections from ${spec.documents.length} documents.`);
  // The run's Knowledge, as corrected during the run, replaces the freshly imported onboarding.
  if (runDirectory && existsSync(join(runDirectory, "knowledge.json"))) {
    const kept = JSON.parse(await readFile(join(runDirectory, "knowledge.json"), "utf8")) as { payload: { approval: { by: string } } };
    const { rows: [record] } = await pool.query<{ id: string }>("SELECT id FROM business_knowledge WHERE web_presence_id=$1", [webPresenceId]);
    const current = (await inspectCanonical(pool, "knowledge", webPresenceId, record!.id))!;
    await writeCanonical(pool, { domain: "knowledge", id: record!.id, webPresenceId, expectedVersion: current.row.version, expectedFingerprint: current.fingerprint,
      // Whoever last approved this Knowledge stays its attested author; the restore changes nothing in it.
      payload: kept.payload, responsibleIdentity: kept.payload.approval.by, changeReason: "The run's Knowledge, kept when the preview last stopped" });
    console.log("Restored the run's Knowledge.");
  }
  await pool.end();
  const root = await mkdtemp(join(tmpdir(), "miopages-workspace-preview-"));
  // The delivery plugin needs WordPress on MySQL/MariaDB, as hosted: MIOPAGES_PREVIEW_MYSQL is a
  // local MariaDB's bin folder (default: ~/tools/mariadb-11.4.14-winx64/bin). Without it the preview runs without WordPress and the workspace says so.
  const mysqlBin = process.env.MIOPAGES_PREVIEW_MYSQL ?? join(homedir(), "tools", "mariadb-11.4.14-winx64", "bin");
  const wordpress = existsSync(join(mysqlBin, "mariadbd.exe")) ? await previewWordPress({ root, port: Number(process.env.WORDPRESS_PORT ?? 4481), databasePort: Number(process.env.WORDPRESS_DATABASE_PORT ?? 4482),
    mysqlBin, organizationId: organization,
    account: { webPresenceId, managedSiteId }, siteName: "MioPages (C0)", ...(spec.logo && { logo: join(process.cwd(), spec.logo) }),
    source: process.env.WORDPRESS_SOURCE ?? "../p022-wp-validation/wordpress" }) : null;
  console.log(`Workspace preview: http://127.0.0.1:${port}/workspace`);
  console.log(wordpress ? `Its WordPress: ${wordpress.origin}/wp-admin (login in ${wordpress.login})` : "No WordPress: set MIOPAGES_PREVIEW_MYSQL to a local MariaDB to add one.");
  const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-H", "127.0.0.1", "-p", String(port)], { stdio: "inherit",
    env: { ...process.env, MIOPAGES_WORKSPACE: "local-preview", SERVICE_DATABASE_URL: cluster.url, DATABASE_URL: cluster.url, NEXT_TELEMETRY_DISABLED: "1",
    ...(wordpress && { MIOPAGES_PREVIEW_WORDPRESS: wordpress.config }),
    ...(aiRun && runDirectory && { MIOPAGES_PREVIEW_AI_RUN: aiRun, MIOPAGES_PREVIEW_AI_DIR: runDirectory, MIOPAGES_PREVIEW_AI_CAP: String(Math.round(cap * 1_000_000)) }) } });
  if (aiRun) console.log(`Approved AI run "${aiRun}", capped at $${cap}; kept in ${runDirectory}`);
  // Keep the run's service record before the throwaway database goes.
  const keep = async () => {
    if (!runDirectory) return;
    const db = new Pool({ connectionString: cluster.url });
    try {
      await mkdir(runDirectory, { recursive: true });
      await writeFile(join(runDirectory, "record.json"), JSON.stringify(await new ServiceStore(db).read(account), null, 1));
      const { rows: [knowledge] } = await db.query<{ payload: unknown }>("SELECT payload FROM business_knowledge WHERE web_presence_id=$1", [webPresenceId]);
      if (knowledge) await writeFile(join(runDirectory, "knowledge.json"), JSON.stringify({ payload: knowledge.payload }, null, 1));
    } finally { await db.end(); }
  };
  // Windows may end the preview without running `stop`, so the record is also kept every half minute.
  if (runDirectory) setInterval(() => void keep().catch(() => undefined), 30_000).unref();
  const stop = async () => { next.kill(); wordpress?.stop(); await keep().catch(error => console.error("Run record not kept:", error)); await cluster.stop().catch(() => undefined);
    await rm(root, { recursive: true, force: true }).catch(() => undefined); process.exit(0); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop); next.on("exit", stop);
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Preview failed"); process.exitCode = 1; });
