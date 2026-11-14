import assert from "node:assert/strict";
import { lstat, readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { protectedOwnerId, protectedOwnerScope, protectedOwnerToken, protectedOwnerVerifier } from "../../lib/platform/intake/protected-owner";
import { protectedConnection, protectedPool } from "../../lib/platform/wordpress-delivery/protected-connection";

const home = "/home/virtual/vps-bef564/5/53b4381d42";
const role = "miopages_migration";
const origin = "https://wp-acceptance.miopages.com";
const previousExpiry = "2026-11-14T17:15:51.194Z";
let stage = "credential-input";
let writeState = "unchanged";

async function checkDraft(password: string) {
  const headers = { Origin: origin, "X-Intake-Request": "1", "Content-Type": "application/json" };
  const endpoint = origin + "/api/protected-core";
  const login = await fetch(endpoint, { method: "POST", headers, redirect: "error", signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({ operation: "sign-in", username: "owner", password }) });
  assert.equal(login.status, 200);
  const issued = login.headers.get("set-cookie");
  assert.ok(issued && issued.startsWith("__Host-miopages_core=") && issued.includes("HttpOnly") && issued.includes("Secure") && issued.includes("SameSite=Strict") && issued.includes("Max-Age=28800"));
  const cookie = issued.split(";")[0];
  try {
    const response = await fetch(endpoint, { headers: { ...headers, Cookie: cookie }, redirect: "error", signal: AbortSignal.timeout(15_000) });
    assert.equal(response.status, 200);
    const view = await response.json();
    assert.ok(view.prepared?.scenario === "c0" && view.sitePlanning?.proposal && view.sitePlanningReview?.current);
    assert.ok(Number.isSafeInteger(view.version) && view.version >= 28);
  } finally {
    const logout = await fetch(endpoint, { method: "POST", headers: { ...headers, Cookie: cookie, "X-Core-Operation": "logout" },
      redirect: "error", signal: AbortSignal.timeout(15_000) });
    assert.equal(logout.status, 200);
  }
}

async function main() {
  assert.equal(await realpath(process.env.HOME ?? ""), home);
  assert.deepEqual(process.argv.slice(2), ["SET-PROTECTED-OWNER-PASSWORD"]);
  const [migrationPassword, password, extra] = (await readFile("/dev/stdin", "utf8")).split("\n");
  assert.ok(migrationPassword && password && extra === "");
  const token = await protectedOwnerToken(password);
  const verifier = protectedOwnerVerifier(token);
  const file = join(home, "miopages-wp-db-20261105T181534Z/wordpress-role-credentials.json");
  const info = await lstat(file);
  assert.ok(info.isFile() && info.uid === process.getuid?.() && (info.mode & 0o777) === 0o600 && await realpath(file) === file);
  const saved = JSON.parse(await readFile(file, "utf8"));
  const url = new URL(saved.operator.url);
  const login = /^miopages_wp_operator\.([a-z0-9]+)$/u.exec(url.username);
  assert.ok(login && url.hostname === "aws-0-us-east-1.pooler.supabase.com" && url.port === "5432" &&
    url.pathname === "/postgres" && url.search === "?sslmode=verify-full");
  url.username = role + "." + login[1];
  url.password = encodeURIComponent(migrationPassword);
  const ca = await readFile(join(home, "supabase-ca.crt"), "utf8");
  assert.match(ca, /BEGIN CERTIFICATE/);
  const pool = protectedPool(url.href, role, ca);
  stage = "verify-existing-principal";
  try {
    const db = await pool.connect();
    try {
      await protectedConnection(db, role, "postgres");
      await db.query("BEGIN");
      await db.query("SET LOCAL statement_timeout = '10s'");
      await db.query("SET LOCAL lock_timeout = '2s'");
      const rows = (await db.query(`SELECT expires_at, expires_at <= clock_timestamp() AS expired,
        expires_at='infinity'::timestamptz AS persistent, revoked_at,
        token_sha256=$2 AS same_verifier FROM miopages_wp.wordpress_operator_credentials WHERE id=$1 FOR UPDATE`,
      [protectedOwnerId, verifier])).rows;
      assert.equal(rows.length, 1);
      const current = rows[0];
      assert.equal(current.revoked_at, null);
      assert.ok(current.persistent || (current.expired && current.expires_at.toISOString() === previousExpiry));
      const grants = (await db.query(`SELECT permission, web_presence_id AS "webPresenceId", managed_site_id AS "managedSiteId", customer
        FROM miopages_wp.wordpress_operator_grants WHERE operator_id=$1 AND revoked_at IS NULL ORDER BY permission FOR SHARE`, [protectedOwnerId])).rows;
      assert.deepEqual(grants, ["inspect-site-proposal", "prepare-site-proposal"].map(permission => ({
        permission, ...protectedOwnerScope, customer: null,
      })));
      if (!current.same_verifier || !current.persistent) {
        stage = "replace-single-verifier";
        assert.equal((await db.query(`UPDATE miopages_wp.wordpress_operator_credentials
          SET token_sha256=$2, expires_at='infinity'::timestamptz WHERE id=$1 AND revoked_at IS NULL`,
        [protectedOwnerId, verifier])).rowCount, 1);
      }
      writeState = "commit-pending";
      await db.query("COMMIT");
      writeState = current.same_verifier && current.persistent ? "already-configured" : "committed";
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally { db.release(); }
  } finally { await pool.end(); }
  stage = "https-readback";
  await checkDraft(password);
  console.log(JSON.stringify({ status: "PASS", operation: "owner-sign-in-and-proposal" }));
}

main().catch((error: { code?: string }) => {
  console.error(JSON.stringify({ status: "BLOCKED", stage, writeState,
    code: error.code && /^[0-9A-Z_]{3,50}$/u.test(error.code) ? error.code : "VERIFICATION" }));
  process.exitCode = 1;
});
