import assert from "node:assert/strict";
import { provisionManagedRoles, roleProvisioningDiagnostic, type RoleProvisioning } from "./db/managed-roles";

// No .env loading, passwords/URLs in arguments, or SQL/credential diagnostics.
async function main() {
  assert.equal(process.env.MIOPAGES_DATABASE_OPERATION, "managed-role-provision");
  const required = (key: string) => { const value = process.env[key]; assert.ok(value, "Missing explicit protected provisioning configuration"); return value; };
  const operation = required("MIOPAGES_ROLE_ACTION"); assert.ok(operation === "create" || operation === "verify");
  const base = { databaseUrl: required("DATABASE_URL"), databaseName: required("MIOPAGES_DATABASE_NAME"), sourceOwner: required("MIOPAGES_PROVIDER_OWNER"), roles: { runtime: required("MIOPAGES_RUNTIME_ROLE"), migration: required("MIOPAGES_MIGRATION_ROLE"), backup: required("MIOPAGES_BACKUP_ROLE") } };
  const config: RoleProvisioning = operation === "create" ? { ...base, operation, passwords: { runtime: required("MIOPAGES_RUNTIME_PASSWORD"), migration: required("MIOPAGES_MIGRATION_PASSWORD"), backup: required("MIOPAGES_BACKUP_PASSWORD") } } : { ...base, operation };
  console.log(JSON.stringify(await provisionManagedRoles(config)));
}
main().catch(error => {
  console.error(JSON.stringify(roleProvisioningDiagnostic(error)));
  process.exitCode = 1;
});
