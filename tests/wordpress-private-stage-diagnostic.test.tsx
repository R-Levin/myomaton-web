import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { normalizeInventoryUrl } from "../scripts/db/wordpress-shared-inventory";
import { privateStageDiagnostic } from "../scripts/db/wordpress-private-stage";

test("preflight reports a stage and safe code without rendering driver or assertion data", () => {
  const privateData = "postgresql://role:password@host/db token CA_CONTENT";
  for (const [stage, code] of [
    ["connection_tls", "28P01"], ["role_database_identity", "WP_DATABASE_MISMATCH"],
    ["session_behavior", "WP_SESSION_CHECK_FAILED"], ["canonical_migration_baseline", "ERR_ASSERTION"],
    ["adapter_validation", "42501"],
  ] as const) {
    const result = privateStageDiagnostic(stage, { code, message: privateData, detail: privateData,
      stack: privateData, actual: privateData, cause: { message: privateData } });
    assert.equal(result.stage, stage);
    assert.equal(result.code, code);
    assert.ok(result.detail.length > 0);
    assert.doesNotMatch(JSON.stringify(result), /password|CA_CONTENT|token/);
  }
  assert.equal(privateStageDiagnostic("connection_tls", { code: privateData }).code, "WP_CONNECTION_FAILED");
});

test("preflight CLI exits nonzero and redacts an invalid connection URL", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/db/wordpress-private-stage.ts"], {
    encoding: "utf8",
    env: { ...process.env, MIOPAGES_WP_SCHEMA_ACTION: "preflight-private-stage",
      MIOPAGES_WP_EXPECTED_DATABASE: "postgres",
      MIOPAGES_WP_MIGRATION_URL: "postgresql://role:sentinel-password@invalid host/postgres" },
  });
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout, "");
  assert.doesNotMatch(result.stderr, /sentinel-password|invalid host|postgresql:\/\//);
  assert.equal(JSON.parse(result.stderr).stage, "connection_configuration");
});

test("inventory URL normalizes only the known trailing database-path backslash", () => {
  const prefix = "postgresql://role.project:fixture%5C@pool.example.test";
  const query = "?sslmode=verify-full";
  for (const suffix of ["\\", "%5C", "%5c%5C"]) {
    assert.equal(normalizeInventoryUrl(prefix + "/postgres" + suffix + query, "postgres"), prefix + "/postgres" + query);
  }
  assert.equal(normalizeInventoryUrl(prefix + "/other%5C" + query, "postgres"), prefix + "/other%5C" + query);
});
