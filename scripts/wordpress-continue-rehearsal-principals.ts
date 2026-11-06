import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { verifyExactRehearsalCandidate as candidate } from "./db/wordpress-rehearsal-candidate";
import { migrationRole, operatorRole, protectedPool, verifyProtectedSession } from "../lib/platform/wordpress-delivery/protected-connection";
import { sessionUrl } from "./wordpress-database-rollout";
import { principalManifest, rehearsalPrincipals, rehearsalSite, replaceRehearsalTokenVerifiers } from "./db/wordpress-rehearsal-principals";
import { privateStageDiagnostic } from "./db/wordpress-private-stage";

async function main() {
  let stage = "configuration";
  try {
    assert.equal(process.platform, "linux");
    const home = process.env.HOME!;
    assert.equal(await realpath(process.cwd()), path.join(home, "miopages-wp-rehearsal"));
    const [oldFile, oldHash, nextFile, nextHash, approval] = process.argv.slice(2);
    assert.equal(approval, "REKEY-EXISTING-TEST-TOKENS");
    assert.equal(oldFile, path.join(home, "miopages-wp-principals-20261106T144226Z/manifest.json"));
    assert.equal(oldHash, "6c7cb17cfd45b4fb48c63e17e1327455ed09981e0f1d03cde45b13b753644384");
    const load = async (file: string, hash: string) => {
      assert.equal(path.dirname(path.dirname(file)), home);
      assert.match(path.basename(path.dirname(file)), /^miopages-wp-principals-[0-9TZ]+$/);
      for (const [p, mode] of [[file, 0o600], [path.dirname(file), 0o700]] as const) {
        const s = await lstat(p); assert.ok(!s.isSymbolicLink() && s.uid === process.getuid!() && (s.mode & 0o777) === mode);
      }
      assert.match(hash, /^[a-f0-9]{64}$/);
      const b = await readFile(file); assert.equal(createHash("sha256").update(b).digest("hex"), hash);
      return principalManifest(JSON.parse(b.toString("utf8")));
    };
    const previous = await load(oldFile, oldHash), next = await load(nextFile, nextHash);
    assert.notEqual(oldFile, nextFile);
    const roleFile = path.join(home, "miopages-wp-db-20261105T181534Z/wordpress-role-credentials.json");
    const stat = await lstat(roleFile); assert.ok(!stat.isSymbolicLink() && stat.uid === process.getuid!() && (stat.mode & 0o777) === 0o600);
    const saved = JSON.parse(await readFile(roleFile, "utf8"));
    const existing = new URL(saved.operator.url), login = decodeURIComponent(existing.username);
    assert.ok(login.startsWith(operatorRole + "."));
    assert.equal(existing.port, "5432"); assert.equal(existing.search, "?sslmode=verify-full"); assert.equal(existing.hash, "");
    const database = existing.pathname.slice(1), password = process.env.WP_REHEARSAL_MIGRATION_PASSWORD;
    assert.ok(password);
    const url = sessionUrl(existing.hostname, login.slice(operatorRole.length + 1), database, migrationRole, password);
    delete process.env.WP_REHEARSAL_MIGRATION_PASSWORD;
    const ca = await readFile(path.join(home, "supabase-ca.crt"), "utf8");
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
    console.error(JSON.stringify({ ...privateStageDiagnostic("adapter_validation", error), operationStage: stage,
      requirement: "Stop and preserve both manifests. Independently inspect an uncertain commit; no automatic retry, reset, expiry extension or replacement provisioning." }));
    process.exitCode = 1;
  }
}
main();
