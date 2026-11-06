import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { migrationRole, operatorRole, protectedPool, verifyProtectedSession } from "../lib/platform/wordpress-delivery/protected-connection";
import { sessionUrl } from "./wordpress-database-rollout";
import { wordpressRehearsalFixture } from "./customer-initializers/wordpress-rehearsal";
import { principalManifest, rehearsalPrincipals, rehearsalSite } from "./db/wordpress-rehearsal-principals";
import { privateStageDiagnostic } from "./db/wordpress-private-stage";

async function main() {
  let stage = "configuration";
  try {
    assert.equal(process.platform, "linux");
    const home = process.env.HOME!;
    assert.equal(await realpath(process.cwd()), path.join(home, "miopages-wp-rehearsal"));
    const manifestFile = process.argv[2];
    assert.ok(manifestFile && path.isAbsolute(manifestFile));
    const directory = path.dirname(manifestFile);
    assert.equal(path.dirname(directory), home);
    assert.match(path.basename(directory), /^miopages-wp-principals-[0-9TZ]+$/);
    for (const [file, mode] of [[directory, 0o700], [manifestFile, 0o600],
      [path.join(home, "miopages-wp-db-20261105T181534Z/wordpress-role-credentials.json"), 0o600]] as const) {
      const s = await lstat(file);
      assert.ok(!s.isSymbolicLink() && s.uid === process.getuid!() && (s.mode & 0o777) === mode);
    }
    const expectedHash = process.argv[3];
    assert.match(expectedHash ?? "", /^[a-f0-9]{64}$/);
    const bytes = await readFile(manifestFile);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expectedHash, "Reviewed manifest checksum required");
    const manifest = principalManifest(JSON.parse(bytes.toString("utf8")));
    const saved = JSON.parse(await readFile(path.join(home, "miopages-wp-db-20261105T181534Z/wordpress-role-credentials.json"), "utf8"));
    // Reuse only established connection parameters, not another role's password.
    const existing = new URL(saved.operator.url);
    const login = decodeURIComponent(existing.username);
    assert.ok(login.startsWith(operatorRole + "."));
    assert.equal(existing.port, "5432");
    assert.equal(existing.search, "?sslmode=verify-full");
    assert.equal(existing.hash, "");
    const database = existing.pathname.slice(1);
    const password = process.env.WP_REHEARSAL_MIGRATION_PASSWORD;
    assert.ok(password, "Existing miopages_migration password required");
    const url = sessionUrl(existing.hostname, login.slice(operatorRole.length + 1), database, migrationRole, password);
    delete process.env.WP_REHEARSAL_MIGRATION_PASSWORD;
    const ca = await readFile(path.join(home, "supabase-ca.crt"), "utf8");
    const pool = protectedPool(url, migrationRole, ca);
    let created: Awaited<ReturnType<typeof rehearsalPrincipals>>;
    try {
      stage = "migration-credential";
      const db = await pool.connect();
      try {
        stage = "migration-credential";
        await verifyProtectedSession(db, migrationRole, database);
        stage = "fixture-verify";
        await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        try { assert.deepEqual((await wordpressRehearsalFixture(db, "verify")).site, rehearsalSite); }
        finally { await db.query("ROLLBACK"); }
        stage = "principal-enrollment";
        await db.query("BEGIN");
        try { created = await rehearsalPrincipals(db, manifest, rehearsalSite, "create"); await db.query("COMMIT"); }
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
          assert.deepEqual((await wordpressRehearsalFixture(db, "verify")).site, rehearsalSite);
          const verified = await rehearsalPrincipals(db, manifest, rehearsalSite, "verify");
          const evidence = { ...verified, created: created!.created, independentlyVerified: true,
            verifiedTls: true, expiresAfterHours: 24, credentialsAuthenticated: false,
            requirement: "Authenticate the two separately held test tokens with existing ProtectedOperator before preparing the candidate. No exact candidate approval recorded." };
          await writeFile(path.join(directory, "principals-evidence.json"), JSON.stringify(evidence, null, 2) + "\n", { mode: 0o600, flag: "wx" });
          console.log(JSON.stringify({ status: "PASS", evidence: path.join(directory, "principals-evidence.json"), principals: evidence.principals,
            next: evidence.requirement }));
        } finally { await db.query("ROLLBACK"); }
      } finally { db.release(); }
    } finally { await independent.end(); }
  } catch (error) {
    console.error(JSON.stringify({ ...privateStageDiagnostic("adapter_validation", error), operationStage: stage,
      requirement: "Stop and preserve the manifest. Enrollment may have committed; independently inspect before retry. Never reset or rotate credentials." }));
    process.exitCode = 1;
  }
}
main();
