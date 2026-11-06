import { createHash } from "node:crypto";
import { lstat, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { verifyExactRehearsalCandidate as candidate } from "./db/wordpress-rehearsal-candidate";
import { migrationRole, operatorRole, protectedPool, verifyProtectedSession } from "../lib/platform/wordpress-delivery/protected-connection";
import { sessionUrl } from "./wordpress-database-rollout";
import { principalManifest, rehearsalPrincipals, rehearsalSite, replaceRehearsalTokenVerifiers } from "./db/wordpress-rehearsal-principals";
import { privateStageDiagnostic } from "./db/wordpress-private-stage";
import { configurationCheck, rehearsalConfigurationDiagnostic, rehearsalHome, rehearsalManifestPath, type RehearsalConfigurationCheck } from "./db/wordpress-rehearsal-paths";

async function main() {
  let stage = "configuration";
  let check: RehearsalConfigurationCheck = "platform";
  let manifest: "original" | "prepared" | undefined;
  try {
    configurationCheck(process.platform === "linux", check);
    const home = rehearsalHome(process.env.HOME);
    check = "repository_location";
    configurationCheck(await realpath(process.cwd()) === path.join(home, "miopages-wp-rehearsal"), check);
    const [oldArgument, oldHash, nextArgument, nextHash, approval] = process.argv.slice(2);
    configurationCheck(approval === "REKEY-EXISTING-TEST-TOKENS", "continuation_flag");
    const oldFile = rehearsalManifestPath(home, oldArgument, true), nextFile = rehearsalManifestPath(home, nextArgument);
    configurationCheck(oldHash === "6c7cb17cfd45b4fb48c63e17e1327455ed09981e0f1d03cde45b13b753644384", "original_manifest_checksum");
    const load = async (file: string, hash: string) => {
      for (const [p, mode] of [[file, 0o600], [path.dirname(file), 0o700]] as const) {
        check = mode === 0o600 ? "manifest_file_protection" : "manifest_directory_protection";
        const s = await lstat(p);
        configurationCheck(!s.isSymbolicLink() && (mode === 0o600 ? s.isFile() : s.isDirectory()) && s.uid === process.getuid!() && (s.mode & 0o777) === mode, check);
      }
      configurationCheck(/^[a-f0-9]{64}$/.test(hash ?? ""), "manifest_checksum_format");
      check = "manifest_checksum";
      const b = await readFile(file); configurationCheck(createHash("sha256").update(b).digest("hex") === hash, check);
      check = "manifest_structure";
      return principalManifest(JSON.parse(b.toString("utf8")));
    };
    manifest = "original"; const previous = await load(oldFile, oldHash);
    manifest = "prepared"; const next = await load(nextFile, nextHash); manifest = undefined;
    configurationCheck(oldFile !== nextFile, "distinct_manifests");
    const roleFile = path.join(home, "miopages-wp-db-20261105T181534Z/wordpress-role-credentials.json");
    check = "role_file_protection";
    const stat = await lstat(roleFile); configurationCheck(stat.isFile() && !stat.isSymbolicLink() && stat.uid === process.getuid!() && (stat.mode & 0o777) === 0o600, check);
    check = "role_file_format";
    const saved = JSON.parse(await readFile(roleFile, "utf8"));
    const existing = new URL(saved.operator.url), login = decodeURIComponent(existing.username);
    configurationCheck(login.startsWith(operatorRole + "."), "role_login");
    configurationCheck(existing.port === "5432", "session_pooler_port");
    configurationCheck(existing.search === "?sslmode=verify-full", "verify_full_query");
    configurationCheck(existing.hash === "", "url_fragment");
    const database = existing.pathname.slice(1), password = process.env.WP_REHEARSAL_MIGRATION_PASSWORD;
    configurationCheck(password, "migration_password_presence");
    check = "connection_parameters";
    const url = sessionUrl(existing.hostname, login.slice(operatorRole.length + 1), database, migrationRole, password);
    delete process.env.WP_REHEARSAL_MIGRATION_PASSWORD;
    check = "ca_readability";
    const ca = await readFile(path.join(home, "supabase-ca.crt"), "utf8");
    check = "connection_parameters";
    const pool = protectedPool(url, migrationRole, ca);
    let replacement;
    try {
      stage = "migration-credential";
      const db = await pool.connect();
      try {
        await verifyProtectedSession(db, migrationRole, database);
        stage = "exact-candidate-and-existing-principals";
        await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        try { await candidate(db); await rehearsalPrincipals(db, previous, rehearsalSite, "verify"); }
        finally { await db.query("ROLLBACK"); }
        stage = "explicit-test-token-verifier-replacement";
        await db.query("BEGIN");
        try { await candidate(db); replacement = await replaceRehearsalTokenVerifiers(db, previous, next, rehearsalSite); await db.query("COMMIT"); }
        catch (error) { await db.query("ROLLBACK"); throw error; }
      } finally { db.release(); }
    } finally { await pool.end(); }
    stage = "independent-verification";
    const independent = protectedPool(url, migrationRole, ca);
    try {
      const db = await independent.connect();
      try {
        await verifyProtectedSession(db, migrationRole, database);
        await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        try {
          await candidate(db); const verified = await rehearsalPrincipals(db, next, rehearsalSite, "verify");
          const evidence = { ...verified, ...replacement, independentlyVerified: true, verifiedTls: true,
            credentialsAuthenticated: false, approvalRecorded: false, released: false, databaseRolePasswordsChanged: false };
          const file = path.join(path.dirname(nextFile), "continuation-evidence.json");
          await writeFile(file, JSON.stringify(evidence, null, 2) + "\n", { mode: 0o600, flag: "wx" });
          console.log(JSON.stringify({ status: "PASS", evidence: file, next: "Authenticate both replacement tokens before recording the exact owner approval." }));
        } finally { await db.query("ROLLBACK"); }
      } finally { db.release(); }
    } finally { await independent.end(); }
  } catch (error) {
    console.error(JSON.stringify({ ...(stage === "configuration" ? rehearsalConfigurationDiagnostic(error, check) : privateStageDiagnostic("adapter_validation", error)), operationStage: stage,
      ...(stage === "configuration" && manifest ? { manifest } : {}),
      requirement: "Stop and preserve both manifests. Independently inspect an uncertain commit; no automatic retry, reset, expiry extension or replacement provisioning." }));
    process.exitCode = 1;
  }
}
main();
