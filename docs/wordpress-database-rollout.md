# Approved database-only WordPress rehearsal setup

Use PowerShell 2's existing SSH session on 20i CLOUD and the separate rehearsal checkout. The approval covers two restricted WordPress roles, adapter migrations 0016/0017 and their reviewed grants. The fixture is already verified as Organization b3b46645-0364-4329-83c7-86a6ea9e56c4, Web Presence 819d007a-595d-4374-a2f0-96b900d46559 and Managed Site 1d92a248-416f-4e22-baaf-d2f1fca70352.

## Protected configuration

Use the established Session Pooler host and port 5432 with verify-full, the expected database and existing CA. Keep DATABASE_URL and the public runtime environment intact.

Load the following through the operator's protected secret procedure. Do not echo values or put credentials in command arguments.

- Existing MIOPAGES_WP_EXPECTED_DATABASE, MIOPAGES_WP_MIGRATION_URL and MIOPAGES_WP_DATABASE_CA.
- MIOPAGES_WP_BACKUP_URL for the existing miopages_backup login, using role.project-ref format.
- MIOPAGES_WP_DATABASE_CA_FILE with the absolute path of the existing Supabase CA file. NODE_EXTRA_CA_CERTS and PGSSLROOTCERT below make the same trust chain available to the existing Node and libpq recovery tools.
- PG_BIN_DIR pointing to PostgreSQL 17 client binaries. The existing recovery code verifies the pg_dump major against the source. If matching binaries are unavailable, stop at recovery preparation.
- MIOPAGES_WP_OBJECTS_ROOT with the existing application's actual managed-asset root, and MIOPAGES_WP_RECOVERY_ROOT with a new empty private directory outside the checkouts, webroot and asset root.
- For step 3 only, MIOPAGES_WP_PROVIDER_OWNER and MIOPAGES_WP_PROVIDER_URL for the authorized provider-owner LOGIN with CREATEROLE, database CONNECT grant authority and public-schema USAGE grant authority. The existing migration role does not create LOGIN roles.
- Distinct protected random ASCII passwords, 32–256 characters, in MIOPAGES_WP_OPERATOR_PASSWORD and MIOPAGES_WP_PULL_PASSWORD. Preserve them in the approved secret store for the later role URLs.

## 1. Establish the recovery point

From the rehearsal checkout at the reviewed commit, use the existing managed backup functions. The source connection is read-only. This command writes a new private recovery bundle, including canonical data, activation records, hostname bindings, the fixture, schema, sequence, function and ACL evidence, and managed asset bytes.

```bash
NODE_EXTRA_CA_CERTS="${MIOPAGES_WP_DATABASE_CA_FILE:?Trusted CA file required}" \
PGSSLROOTCERT="$MIOPAGES_WP_DATABASE_CA_FILE" \
node --import tsx -e '
const assert = require("node:assert/strict");
const path = require("node:path");
const { managedBackup } = require("./scripts/backup/managed.ts");
const { protectedPool, protectedConnection } = require("./lib/platform/wordpress-delivery/protected-connection.ts");
const { normalizeInventoryUrl } = require("./scripts/db/wordpress-shared-inventory.ts");
(async () => {
  for (const name of ["MIOPAGES_WP_EXPECTED_DATABASE","MIOPAGES_WP_BACKUP_URL","MIOPAGES_WP_RECOVERY_ROOT","MIOPAGES_WP_OBJECTS_ROOT","PG_BIN_DIR"]) assert.ok(process.env[name]);
  const databaseUrl = normalizeInventoryUrl(process.env.MIOPAGES_WP_BACKUP_URL, process.env.MIOPAGES_WP_EXPECTED_DATABASE);
  const pool = protectedPool(databaseUrl, "miopages_backup", process.env.MIOPAGES_WP_DATABASE_CA);
  try {
    const c = await pool.connect();
    try { await protectedConnection(c, "miopages_backup", process.env.MIOPAGES_WP_EXPECTED_DATABASE); }
    finally { c.release(); }
  } finally { await pool.end(); }
  const bundle = await managedBackup({
    mode:"managed-postgres", databaseUrl, root:process.env.MIOPAGES_WP_RECOVERY_ROOT,
    objectsRoot:path.resolve(process.env.MIOPAGES_WP_OBJECTS_ROOT), pgBin:process.env.PG_BIN_DIR,
    repository:process.cwd(),
    roles:{runtime:"miopages_runtime",migration:"miopages_migration",backup:"miopages_backup"}
  });
  console.log(JSON.stringify({recoveryPointCreated:true,bundleVerified:true,canonicalMigrations:bundle.state.migrations.length}));
})().catch(() => { console.error("Recovery point failed. Database setup must wait."); process.exitCode=1; });
'
```

Require recoveryPointCreated=true, bundleVerified=true and canonicalMigrations=16. The recovery bundle is a portable application recovery point. It does not recreate provider infrastructure or role passwords. Retain the existing provider recovery process and protected credentials. A verified archive is not a new hosted restore rehearsal.

## 2. Independently verify the bundle

Use a fresh Node invocation. This only reads the recovery files.

```bash
node --import tsx -e '
const { verifyManagedBundle } = require("./scripts/backup/managed.ts");
verifyManagedBundle(process.env.MIOPAGES_WP_RECOVERY_ROOT)
  .then(bundle => console.log(JSON.stringify({recoveryVerified:true,canonicalMigrations:bundle.state.migrations.length})))
  .catch(() => { console.error("Recovery verification failed. Stop database setup."); process.exitCode=1; });
'
```

Require recoveryVerified=true and canonicalMigrations=16. Before role creation the narrow provisioner independently verifies this bundle again and compares its recorded application state with the current database. Preserve the bundle before continuing.

## 3. Create only the two missing LOGIN roles

```bash
MIOPAGES_WP_ROLE_ACTION=create \
  node --import tsx scripts/provision-wordpress-roles.ts
```

Require created=2, verified=true, recoveryVerified=true and restricted=true for both roles. The command refuses existing or partial role sets, never resets passwords, sends SCRAM verifiers rather than plaintext SQL passwords, and removes automatic creator membership edges. It grants only database CONNECT and public-schema USAGE at this step. It checks that the existing runtime, migration and backup role attributes and memberships did not change. Do not rerun scripts/provision-managed-postgres-roles.ts.

## 4. Independently verify restrictions using the migration login

```bash
MIOPAGES_WP_ROLE_ACTION=verify \
  node --import tsx scripts/provision-wordpress-roles.ts
```

Require verified=true, readOnly=true and both roles restricted. Each role must have LOGIN, NOINHERIT, no administration flags or memberships, and no database or application-schema CREATE privileges. Preserve the generated role credentials through the protected secret store, then clear provider and password provisioning variables:

```bash
unset MIOPAGES_WP_PROVIDER_URL MIOPAGES_WP_OPERATOR_PASSWORD MIOPAGES_WP_PULL_PASSWORD
```

An uncertain create result requires this verify operation before considering another write.

## 5. Apply 0016/0017 using the existing migration procedure

```bash
MIOPAGES_WP_SCHEMA_ACTION=apply-private-stage \
  node --import tsx scripts/db/wordpress-private-stage.ts
```

Require privateStageMigrations=2 and verified=true. This uses the verified migration-role session and its transaction-level migration lock. Both migrations and normalized checksums are recorded together. The original 16-entry canonical migration journal is preserved.

## 6. Verify checksums, ownership and exact grants without writes

```bash
MIOPAGES_WP_SCHEMA_ACTION=verify-private-stage \
  node --import tsx scripts/db/wordpress-private-stage.ts
```

Require readOnly=true, privateStageMigrations=2, checksumsVerified=true and grantsVerified=true. This checks migration hashes, migration-role ownership, exact WordPress table/column grants, invoker-function permission, backup read access and absence of runtime adapter access.

## 7. Verify each restricted role session

Supply the corresponding new role URL through its protected environment. Run each probe with the established expected database and CA, keeping provider and migration secrets out of that environment.

```bash
MIOPAGES_WP_SCHEMA_ACTION=probe-operator-session \
  node --import tsx scripts/db/wordpress-private-stage.ts
```

```bash
MIOPAGES_WP_SCHEMA_ACTION=probe-pull-session \
  node --import tsx scripts/db/wordpress-private-stage.ts
```

Require verifiedTls=true and sessionVerified=true for the matching role in each result. Record the recovery, role, checksum/grant and session receipts. Database-only setup ends here. The Core listener and WordPress upgrade remain outside this authorization. Continue to the already planned private HTTPS rehearsal only when those changes are approved.
