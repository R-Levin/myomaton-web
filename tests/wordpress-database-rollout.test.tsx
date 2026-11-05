import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { checkedReceipt, childEnvironment, databaseSequence, rolloutStages, sessionUrl, type RolloutStage } from "../scripts/wordpress-database-rollout";

const receipts: Record<RolloutStage, Record<string, unknown>> = {
  backup: { recoveryPointCreated: true, bundleVerified: true, canonicalMigrations: 16 },
  "recovery-verify": { recoveryVerified: true, canonicalMigrations: 16 },
  "roles-create": { created: 2, verified: true, recoveryVerified: true, roles: ["miopages_wp_operator", "miopages_wp_pull"].map(role => ({ role, restricted: true })) },
  "roles-verify": { readOnly: true, verified: true, roles: ["miopages_wp_operator", "miopages_wp_pull"].map(role => ({ role, restricted: true })) },
  migrate: { verified: true, privateStageMigrations: 2 },
  "grants-verify": { verified: true, readOnly: true, privateStageMigrations: 2, checksumsVerified: true, grantsVerified: true },
  "operator-probe": { role: "miopages_wp_operator", verifiedTls: true, sessionVerified: true },
  "pull-probe": { role: "miopages_wp_pull", verifiedTls: true, sessionVerified: true },
};

test("rollout cannot reach role creation before independent recovery succeeds", async () => {
  const attempted: RolloutStage[] = [], recorded: RolloutStage[] = [];
  await assert.rejects(databaseSequence(async stage => {
    attempted.push(stage);
    return stage === "recovery-verify" ? { ...receipts[stage], recoveryVerified: false } : receipts[stage];
  }, async stage => { recorded.push(stage); }));
  assert.deepEqual(attempted, ["backup", "recovery-verify"]);
  assert.deepEqual(recorded, ["backup"]);
});

test("every uncertain operation or evidence write stops without retry or later operations", async () => {
  for (const stop of rolloutStages) {
    for (const failEvidence of [false, true]) {
      const attempted: RolloutStage[] = [];
      await assert.rejects(databaseSequence(async stage => {
        attempted.push(stage);
        if (!failEvidence && stage === stop) throw Error("Uncertain commit");
        return receipts[stage];
      }, async stage => { if (failEvidence && stage === stop) throw Error("Cannot persist evidence"); }));
      assert.deepEqual(attempted, rolloutStages.slice(0, rolloutStages.indexOf(stop) + 1));
    }
  }
});

test("consolidated sequence accepts exact receipts and strips arbitrary child data", async () => {
  const evidence: unknown[] = [];
  await databaseSequence(async stage => ({ ...receipts[stage], secret: "must-never-be-recorded" }), async (stage, receipt) => { evidence.push({ stage, receipt }); });
  assert.equal(evidence.length, 8);
  assert.equal(JSON.stringify(evidence).includes("must-never-be-recorded"), false);
  assert.throws(() => checkedReceipt("backup", { ...receipts.backup, canonicalMigrations: 15 }));
  assert.throws(() => checkedReceipt("roles-create", { ...receipts["roles-create"], recoveryVerified: false }));
  assert.throws(() => checkedReceipt("grants-verify", { ...receipts["grants-verify"], checksumsVerified: false }));
  assert.throws(() => checkedReceipt("pull-probe", receipts["operator-probe"]));
});

test("role-specific child environments exclude runtime, provider and inherited libpq credentials", () => {
  const inherited = { PATH: "/usr/bin", HOME: "/home/test", DATABASE_URL: "runtime-secret", PGPASSWORD: "owner-secret", PGOPTIONS: "unsafe", NODE_OPTIONS: "unsafe", MIOPAGES_WP_PROVIDER_URL: "owner-url", MIOPAGES_WP_MIGRATION_URL: "migration-url", WP_DB_BACKUP_PASSWORD: "backup-password" };
  const common = { MIOPAGES_WP_EXPECTED_DATABASE: "postgres", PGSSLROOTCERT: "/trusted/ca.crt" };
  assert.deepEqual(childEnvironment(inherited, common, { MIOPAGES_WP_PULL_URL: "pull-url" }), {
    NODE_ENV: "production", PATH: "/usr/bin", HOME: "/home/test", ...common, MIOPAGES_WP_PULL_URL: "pull-url",
  });
});

test("pooler URL construction encodes passwords without trimming and fixes session mode and TLS", () => {
  const password = " :@/#?%\\'\"$` trailing ";
  const url = new URL(sessionUrl("aws-0-us-east-1.pooler.supabase.com", "projectref", "postgres", "miopages_backup", password));
  assert.equal(decodeURIComponent(url.password), password);
  assert.equal(url.username, "miopages_backup.projectref");
  assert.equal(url.port, "5432");
  assert.equal(url.search, "?sslmode=verify-full");
  assert.throws(() => sessionUrl("other.example", "ref", "postgres", "miopages_backup", "password"));
  assert.throws(() => sessionUrl("aws-0-us-east-1.pooler.supabase.com:6543", "ref", "postgres", "miopages_backup", "password"));
  assert.throws(() => sessionUrl("aws-0-us-east-1.pooler.supabase.com", "ref", "postgres", "miopages_backup", ""));
});

test("launcher prerequisite refusal does not print inherited secrets or stack traces", async () => {
  try {
    await promisify(execFile)(process.execPath, ["--import", "tsx", "scripts/wordpress-database-rollout.ts"], {
      env: { ...process.env, WP_DB_STORAGE_APPROVAL: "not-approved", WP_DB_PROVIDER_PASSWORD: "secret-provider-password" },
    });
    assert.fail("Expected prerequisite refusal");
  } catch (error) {
    const e = error as { stderr: string; code: number };
    assert.equal(e.code, 1);
    const report = JSON.parse(e.stderr.trim());
    assert.equal(report.status, "BLOCKED");
    assert.equal(report.failedStage, "configuration");
    assert.equal(e.stderr.includes("secret-provider-password"), false);
    assert.equal(e.stderr.includes(" at "), false);
  }
});
