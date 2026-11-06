import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
const require = createRequire(import.meta.url);
const { configuration, childEnvironment, procStat, resourceGate, ownedMembers } = require("../scripts/wordpress-private-listener.cjs");

function config() {
  return { pullUrl: "postgresql://miopages_wp_pull.syntheticref:synthetic-password@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=verify-full",
    ca: "-----BEGIN CERTIFICATE-----\nsynthetic-test-only\n-----END CERTIFICATE-----", installationId: "9a511424-79af-4d02-801e-8d191d4b0d2f",
    credentialId: "421ef5e7-06da-4485-830c-91b1611c7225", secretHex: "a".repeat(64), coreOrigin: "https://wp-acceptance.miopages.com" };
}

test("private child receives only pull-scoped configuration with fixed origin and no privileged environment", () => {
  const c = config(); assert.equal(configuration(c), c); const env = childEnvironment(c);
  assert.equal(env.MIOPAGES_WP_PULL_URL, c.pullUrl); assert.equal(env.MIOPAGES_WP_DATABASE_CA, c.ca);
  assert.equal(env.MIOPAGES_WP_CORE_ORIGIN, c.coreOrigin); assert.equal(env.MIOPAGES_WP_PRIVATE_STAGE, "enabled");
  assert.equal(env.MIOPAGES_WP_CREDENTIAL_421ef5e7_06da_4485_830c_91b1611c7225, c.secretHex);
  for (const key of ["DATABASE_URL", "MIOPAGES_WP_OPERATOR_URL", "MIOPAGES_WP_MIGRATION_URL", "MIOPAGES_WP_SIGNING_KEY", "NODE_OPTIONS", "PGOPTIONS"])
    assert.ok(!(key in env));
});

test("configuration refuses extra authority, transaction pooling, weak TLS and changed installation scope", () => {
  const c = config();
  for (const delta of [{ DATABASE_URL: "never-allow" }, { signingKey: "never-allow" }, { secretHex: "x".repeat(64) },
    { credentialId: "29796cfe-a70b-4ca0-a05b-d5febdedc221" }, { coreOrigin: "http://wp-acceptance.miopages.com" },
    { pullUrl: c.pullUrl.replace(":5432/", ":6543/") }, { pullUrl: c.pullUrl.replace("verify-full", "require") },
    { pullUrl: c.pullUrl.replace("miopages_wp_pull", "miopages_wp_operator") }]) assert.throws(() => configuration({ ...c, ...delta }));
});

test("resource gates fail closed at the accepted private-process limits", () => {
  assert.equal(resourceGate(384 * 1024 ** 2, 512 * 1024 ** 2), true);
  assert.equal(resourceGate(384 * 1024 ** 2 + 1, 512 * 1024 ** 2), false);
  assert.equal(resourceGate(100, 512 * 1024 ** 2 - 1), false);
  for (const values of [[NaN, 1], [1, Infinity], [-1, 1]]) assert.throws(() => resourceGate(...values));
});

test("proc identity tolerates parentheses in names and process signals require known non-reused private identities", () => {
  const fields = ["S", "5", "123", "123", ...Array(15).fill("0"), "99887"];
  const parsed = procStat("123 (next (private)) " + fields.join(" "));
  assert.deepEqual(parsed, { group: 123, session: 123, started: "99887" });
  const member = { pid: 123, group: 123, session: 123, uid: 3326411, started: "99887" }, known = new Map([[123, "99887"]]);
  assert.equal(ownedMembers([member], 123, 3326411, known), true);
  assert.equal(ownedMembers([{ ...member, started: "99999" }], 123, 3326411, known), false);
  assert.equal(ownedMembers([{ ...member, uid: 1 }], 123, 3326411, known), false);
  assert.equal(ownedMembers([{ ...member, group: 8080 }], 123, 3326411, known), false);
  assert.equal(ownedMembers([{ ...member, session: 8080 }], 123, 3326411, known), false);
  assert.equal(ownedMembers([], 123, 3326411, known), false);
});
