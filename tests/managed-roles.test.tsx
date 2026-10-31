import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { validateRoleProvisioning, type RoleProvisioning } from "../scripts/db/managed-roles";
import { allowedPrivileges } from "../scripts/backup/managed-permissions";
const base: RoleProvisioning = { operation: "create", databaseUrl: "postgresql://localhost/synthetic", databaseName: "synthetic", sourceOwner: "provider_owner", roles: { runtime: "site_runtime", migration: "site_migration", backup: "site_backup" }, passwords: { runtime: "r".repeat(32), migration: "m".repeat(32), backup: "b".repeat(32) } };
test("role provisioning requires explicit distinct identities and protected credentials before connection", () => {
  validateRoleProvisioning(base);
  validateRoleProvisioning({ ...base, operation: "verify", passwords: undefined });
  for (const input of [
    { ...base, operation: "repair" }, { ...base, databaseName: "other" },
    { ...base, roles: { ...base.roles, backup: base.roles.runtime } },
    ...["postgres", "provider_owner", "pg_runtime", "public", "r;DROP ROLE victim", "r".repeat(64)].map(runtime => ({ ...base, roles: { ...base.roles, runtime } })),
    { ...base, passwords: { ...base.passwords!, runtime: "short" } },
    { ...base, passwords: { ...base.passwords!, runtime: base.passwords!.backup } },
    { ...base, passwords: { ...base.passwords!, runtime: "é".repeat(32) } },
    { ...base, operation: "verify" },
  ]) assert.throws(() => validateRoleProvisioning(input as RoleProvisioning));
});
test("one shared policy retains journal, sequence, function and MAINTAIN boundaries", () => {
  assert.deepEqual(allowedPrivileges("runtime", "TABLE"), ["SELECT", "INSERT", "UPDATE", "DELETE"]);
  assert.deepEqual(allowedPrivileges("runtime", "TABLE", true), ["SELECT"]);
  assert.deepEqual(allowedPrivileges("backup", "TABLE"), ["SELECT"]);
  assert.deepEqual(allowedPrivileges("runtime", "SEQUENCE"), []);
  assert.deepEqual(allowedPrivileges("backup", "SEQUENCE"), ["SELECT"]);
  assert.deepEqual(allowedPrivileges("backup", "FUNCTION"), []);
  assert.deepEqual(allowedPrivileges("runtime", "FUNCTION"), ["EXECUTE"]);
  assert.ok(!allowedPrivileges("runtime", "TABLE").includes("MAINTAIN"));
});
test("operator entry uses an explicit gate and protected environment without loading local defaults", () => {
  const source = readFileSync("scripts/provision-managed-postgres-roles.ts", "utf8");
  assert.ok(source.includes('"managed-role-provision"')); assert.ok(source.includes('"MIOPAGES_ROLE_ACTION"'));
  assert.doesNotMatch(source, /dotenv|env-file|process\.argv/);
  assert.doesNotMatch(source, /console\.error\(error/);
});
