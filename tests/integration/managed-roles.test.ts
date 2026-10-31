import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { disposableCluster } from "../../scripts/backup/disposable-cluster";
import { migrateWithBootstrapCompatibility } from "../../scripts/db/bootstrap";
import { provisionManagedRoles, roleProvisioningDiagnostic, type RoleProvisioning } from "../../scripts/db/managed-roles";
import { managedSnapshot } from "../../scripts/backup/managed";
import { recoveryCatalog } from "../../scripts/backup/catalog";
import { quote as q } from "../../scripts/backup/managed-permissions";
import ownership from "../../scripts/backup/application-ownership.json";

for (const major of [17, 18]) test(`PG${major} inventory-only provider ACL conversion, defaults and transaction refusal`, { skip: !process.env[`PG${major}_BIN_DIR`], timeout: 240000 }, async t => {
  const cluster = await disposableCluster(process.env[`PG${major}_BIN_DIR`]!);
  const url = new URL(cluster.url);
  const root = new Pool({ connectionString: cluster.url, options: "-c timezone=UTC" });
  const ownerPassword = randomBytes(32).toString("hex");
  const roles = { runtime: "miopages_runtime", migration: "miopages_migration", backup: "miopages_backup" };
  const passwords = { runtime: randomBytes(32).toString("hex"), migration: randomBytes(32).toString("hex"), backup: randomBytes(32).toString("hex") };
  let provider: Pool | undefined, backup: Pool | undefined, migration: Pool | undefined;
  const check = async (name: string, run: () => Promise<void>) => { let failure: unknown; await t.test(name, async () => { try { await run(); } catch (e) { failure = e; throw e; } }); if (failure) throw failure; };
  try {
    if (major === 17) {
      const db = "migration_rehearsal_" + randomUUID().replaceAll("-", "");
      await root.query(`CREATE DATABASE ${q(db)} TEMPLATE template0 LOCALE_PROVIDER icu ICU_LOCALE 'en-US' LC_COLLATE 'C' LC_CTYPE 'C'`); url.pathname = "/" + db;
    }
    await root.query(`CREATE ROLE provider_owner LOGIN CREATEROLE CREATEDB NOSUPERUSER NOREPLICATION NOBYPASSRLS PASSWORD '${ownerPassword}'; ALTER DATABASE ${q(url.pathname.slice(1))} OWNER TO provider_owner`);
    const superuser = new Pool({ connectionString: url.toString(), options: "-c timezone=UTC" });
    try { await superuser.query("ALTER SCHEMA public OWNER TO pg_database_owner"); } finally { await superuser.end(); }
    const providerUrl = new URL(url); providerUrl.username = "provider_owner"; providerUrl.password = ownerPassword;
    provider = new Pool({ connectionString: providerUrl.toString(), options: "-c timezone=UTC" });
    for (const role of ["anon", "authenticated", "service_role", "unknown_grantee", 'quoted "reader', "column_only", "downstream"]) await root.query(`CREATE ROLE ${q(role)} NOLOGIN`);
    const external = ["anon", "authenticated", "service_role", "postgres", "unknown_grantee", 'quoted "reader'].map(q).join(",");
    await provider.query(`CREATE SCHEMA storage; CREATE TABLE storage.provider_private(value text); CREATE FUNCTION storage.provider_private_probe() RETURNS int LANGUAGE sql AS 'SELECT 1';
      ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO ${external}; ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO ${external};
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${external},provider_owner;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${external},provider_owner;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO ${external},provider_owner;
      ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON TABLES TO ${external},provider_owner;
      ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT EXECUTE ON FUNCTIONS TO ${external},provider_owner`);
    await root.query(`CREATE ROLE dashboard_user NOLOGIN; CREATE ROLE provider_etl NOLOGIN; CREATE ROLE provider_storage NOLOGIN; GRANT CONNECT,CREATE,TEMPORARY ON DATABASE ${q(url.pathname.slice(1))} TO dashboard_user; GRANT CREATE ON DATABASE ${q(url.pathname.slice(1))} TO provider_etl,provider_storage`);
    await migrateWithBootstrapCompatibility(provider);
    await provider.query(`CREATE TABLE public.provider_marker(id serial PRIMARY KEY,value text); INSERT INTO public.provider_marker(value) VALUES('unchanged provider data'); CREATE FUNCTION public.provider_probe() RETURNS int LANGUAGE sql AS 'SELECT 1'; GRANT ALL ON SEQUENCE public.provider_marker_id_seq TO anon; GRANT SELECT(value) ON public.provider_marker TO column_only; GRANT SELECT(name),UPDATE(name) ON public.pages TO column_only WITH GRANT OPTION; GRANT ALL ON SEQUENCE drizzle.__drizzle_migrations_id_seq TO anon`);
    const delegationPool = new Pool({ connectionString: url.toString() }); const delegated = await delegationPool.connect(); try { await delegated.query("BEGIN; SET LOCAL ROLE column_only; GRANT SELECT(name) ON public.pages TO downstream; COMMIT"); } finally { delegated.release(); await delegationPool.end(); }
    await provider.query("INSERT INTO organizations(name) VALUES('Preserved synthetic organization')");
    const config: RoleProvisioning = { operation: "create", databaseUrl: providerUrl.toString(), databaseName: url.pathname.slice(1), sourceOwner: "provider_owner", roles, passwords };
    const dbRoot = new Pool({ connectionString: url.toString(), options: "-c timezone=UTC" });
    const capture = async () => { const c = await dbRoot.connect(); try { await c.query("BEGIN READ ONLY"); const result = await recoveryCatalog(c, ownership.schemas); await c.query("ROLLBACK"); return result; } finally { c.release(); } };
    const unrelated = async () => ({
      relations: (await dbRoot.query("SELECT n.nspname,c.relname,c.relowner,c.relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname IN ('provider_marker','provider_marker_id_seq') ORDER BY c.relname")).rows,
      columns: (await dbRoot.query("SELECT attname,attacl::text FROM pg_attribute WHERE attrelid='public.provider_marker'::regclass ORDER BY attnum")).rows,
      fn: (await dbRoot.query("SELECT proowner,proacl::text,pg_get_functiondef(oid) definition FROM pg_proc WHERE oid='public.provider_probe()'::regprocedure")).rows,
      defaults: (await dbRoot.query("SELECT defaclnamespace,defaclobjtype,defaclacl::text FROM pg_default_acl WHERE defaclrole='provider_owner'::regrole ORDER BY 1,2")).rows,
      storage: (await dbRoot.query("SELECT c.relname,c.relowner,c.relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='storage' ORDER BY c.relname")).rows,
      storageFunctions: (await dbRoot.query("SELECT p.proname,p.proowner,p.proacl::text,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='storage' ORDER BY p.proname")).rows,
      shared: (await dbRoot.query(`SELECT 'database' object,pg_get_userbyid(d.datdba) owner,a.* FROM pg_database d CROSS JOIN LATERAL aclexplode(d.datacl) a WHERE d.datname=current_database() AND NOT a.grantee=ANY(SELECT oid FROM pg_roles WHERE rolname=ANY($1)) UNION ALL SELECT 'public',pg_get_userbyid(n.nspowner),a.* FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a WHERE n.nspname='public' AND NOT a.grantee=ANY(SELECT oid FROM pg_roles WHERE rolname=ANY($1)) ORDER BY 1,2,3,4,5,6`, [Object.values(roles)])).rows,
      data: (await dbRoot.query("SELECT * FROM public.provider_marker ORDER BY id")).rows,
    });
    try {
      await check("partial roles and mixed ownership refuse without repair", async () => {
        await dbRoot.query(`CREATE ROLE ${q(roles.backup)} NOLOGIN`); const before = await capture();
        await assert.rejects(provisionManagedRoles(config), /all three role names absent/); assert.deepEqual(await capture(), before);
        await dbRoot.query(`DROP ROLE ${q(roles.backup)}; ALTER TABLE public.pages OWNER TO postgres`); const mixed = await capture();
        await assert.rejects(provisionManagedRoles(config), /initial object ownership/); assert.deepEqual(await capture(), mixed);
        await dbRoot.query("ALTER TABLE public.pages OWNER TO provider_owner");
      });
      await check("unrelated owned-schema/dependent-sequence objects and overloaded signatures refuse", async () => {
        await provider!.query("CREATE TABLE drizzle.provider_extra(id int)"); const before = await capture();
        await assert.rejects(provisionManagedRoles(config), /Unrelated objects/); assert.deepEqual(await capture(), before); await provider!.query("DROP TABLE drizzle.provider_extra");
        await provider!.query("ALTER TABLE public.pages ADD COLUMN provider_serial bigserial"); const dependent = await capture();
        await assert.rejects(provisionManagedRoles(config), /Unreviewed dependent sequence/); assert.deepEqual(await capture(), dependent); await provider!.query("ALTER TABLE public.pages DROP COLUMN provider_serial");
        await provider!.query("CREATE FUNCTION public.acquisition_candidate_guard(int) RETURNS int LANGUAGE sql AS 'SELECT $1'"); const overloaded = await capture();
        await assert.rejects(provisionManagedRoles(config), /overloaded application function/); assert.deepEqual(await capture(), overloaded); await provider!.query("DROP FUNCTION public.acquisition_candidate_guard(int)");
      });
      await check("late verifier refusal rolls back roles, owners, grants and defaults", async () => {
        await dbRoot.query("REVOKE EXECUTE ON FUNCTION pg_catalog.pg_advisory_lock(bigint) FROM PUBLIC"); const before = await capture();
        try { await assert.rejects(provisionManagedRoles(config), error => {
          assert.match(String(error), /Required provider execution capability/);
          assert.equal(roleProvisioningDiagnostic(error).stage, "verification");
          assert.equal(roleProvisioningDiagnostic(error).reason, "role-contract");
          return true;
        }); assert.deepEqual(await capture(), before); assert.equal((await dbRoot.query("SELECT count(*)::int n FROM pg_roles WHERE rolname=ANY($1)", [Object.values(roles)])).rows[0].n, 0); }
        finally { await dbRoot.query("GRANT EXECUTE ON FUNCTION pg_catalog.pg_advisory_lock(bigint) TO PUBLIC"); }
      });
      const providerBefore = await unrelated();
      await check("non-superuser provider administrator converts exact inventory and removes arbitrary ACL chains", async () => {
        const attempts = await Promise.allSettled([provisionManagedRoles(config), provisionManagedRoles(config)]);
        assert.equal(attempts.filter(r => r.status === "fulfilled").length, 1);
        assert.equal(attempts.filter(r => r.status === "rejected").length, 1);
        const success = attempts.find(r => r.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof provisionManagedRoles>>>;
        assert.equal(success.value.verified, true); assert.equal(success.value.migrations, 16);
        assert.deepEqual(await unrelated(), providerBefore);
        assert.equal((await dbRoot.query("SELECT pg_get_userbyid(nspowner) owner FROM pg_namespace WHERE nspname='public'")).rows[0].owner, "pg_database_owner");
        assert.equal((await dbRoot.query("SELECT count(*)::int n FROM organizations WHERE name='Preserved synthetic organization'")).rows[0].n, 1);
        for (const kind of ["runtime", "migration", "backup"] as const) {
          const next = new URL(url); next.username = roles[kind]; next.password = passwords[kind];
          const pool = new Pool({ connectionString: next.toString() }); try { assert.equal((await pool.query("SELECT current_user name")).rows[0].name, roles[kind]); } finally { await pool.end(); }
        }
        const backupUrl = new URL(url); backupUrl.username = roles.backup; backupUrl.password = passwords.backup;
        const migrationUrl = new URL(url); migrationUrl.username = roles.migration; migrationUrl.password = passwords.migration;
        backup = new Pool({ connectionString: backupUrl.toString() }); migration = new Pool({ connectionString: migrationUrl.toString() });
        const before = await capture(); await assert.rejects(provisionManagedRoles(config), /all three role names absent/); assert.deepEqual(await capture(), before);
        const verify = { ...config, operation: "verify" as const, databaseUrl: backupUrl.toString(), passwords: undefined };
        assert.equal((await provisionManagedRoles(verify)).verified, true); assert.deepEqual(await capture(), before);
      });
      await check("read-only verification refuses committed drift without repairing it", async () => {
        await migration!.query("GRANT EXECUTE ON FUNCTION public.site_content_guard() TO PUBLIC");
        const before = await capture(), backupUrl = new URL(url); backupUrl.username = roles.backup; backupUrl.password = passwords.backup;
        try { await assert.rejects(provisionManagedRoles({ ...config, operation: "verify", databaseUrl: backupUrl.toString(), passwords: undefined }), error => {
          assert.equal(roleProvisioningDiagnostic(error).stage, "verification");
          assert.equal(roleProvisioningDiagnostic(error).reason, "role-contract");
          return true;
        }); assert.deepEqual(await capture(), before); }
        finally { await migration!.query("REVOKE EXECUTE ON FUNCTION public.site_content_guard() FROM PUBLIC"); }
      });
      await check("future objects have owner-only defaults; provider defaults remain unchanged", async () => {
        await migration!.query("CREATE TABLE public.future_policy_probe(id int); CREATE SEQUENCE public.future_policy_sequence; CREATE FUNCTION public.future_policy_function() RETURNS int LANGUAGE sql AS 'SELECT 1'");
        for (const role of [roles.runtime, roles.backup, "anon", "authenticated", "service_role", "unknown_grantee"]) {
          const row = (await dbRoot.query("SELECT has_table_privilege($1,'public.future_policy_probe','SELECT') t,has_sequence_privilege($1,'public.future_policy_sequence','USAGE') s,has_function_privilege($1,'public.future_policy_function()','EXECUTE') f", [role])).rows[0]; assert.deepEqual(row, { t: false, s: false, f: false });
        }
        await migration!.query("DROP FUNCTION public.future_policy_function(); DROP SEQUENCE public.future_policy_sequence; DROP TABLE public.future_policy_probe");
        assert.deepEqual(await unrelated(), providerBefore);
      });
      await check("PUBLIC/provider/column/delegated/MAINTAIN/default drift remains refused", async () => {
        const c = await dbRoot.connect(); try {
          for (const sql of [
            "GRANT EXECUTE ON FUNCTION public.site_content_guard() TO PUBLIC",
            "GRANT SELECT ON pages TO unknown_grantee",
            "GRANT SELECT(name) ON pages TO column_only",
            `GRANT SELECT ON pages TO ${q(roles.backup)} WITH GRANT OPTION`,
            `GRANT MAINTAIN ON pages TO ${q(roles.runtime)}`,
            `GRANT USAGE ON SEQUENCE drizzle.__drizzle_migrations_id_seq TO ${q(roles.runtime)}`,
            `ALTER DEFAULT PRIVILEGES FOR ROLE ${q(roles.migration)} IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon`,
            `ALTER DEFAULT PRIVILEGES FOR ROLE ${q(roles.migration)} GRANT EXECUTE ON FUNCTIONS TO PUBLIC`,
          ]) { await c.query("BEGIN"); try { await c.query(sql); let reason: string | undefined; await assert.rejects(managedSnapshot(c, config.databaseUrl, roles, next => { reason = next; }));
            assert.equal(reason, sql.startsWith("ALTER DEFAULT") ? "application-defaults" : sql.includes("unknown_grantee") || sql.includes("column_only") || sql.includes("GRANT OPTION") ? "application-acl" : "role-contract"); } finally { await c.query("ROLLBACK"); } }
        } finally { c.release(); }
        const c2 = await backup!.connect(); try { await c2.query("BEGIN READ ONLY"); const state = await managedSnapshot(c2, config.databaseUrl, roles); assert.equal(state.provider.locale.datlocprovider, major === 17 ? "i" : "c"); assert.equal(state.migrations.length, 16); } finally { await c2.query("ROLLBACK"); c2.release(); }
      });
      await mkdir("runtime-content/managed-postgres-proof/role-provisioning", { recursive: true });
      await writeFile(`runtime-content/managed-postgres-proof/role-provisioning/pg${major}.json`, JSON.stringify({ verified: true, major, providerPatternNormalized: true, arbitraryAndColumnGranteesRemoved: true, unrelatedProviderStateUnchanged: true, nonSuperuserAdministrator: true, rollbackVerified: true, readOnlyVerify: true, defaultsVerified: true, sharedOrHostedAccess: false }, null, 2));
    } finally { await dbRoot.end(); }
  } finally { await backup?.end(); await migration?.end(); await provider?.end(); await root.end(); await cluster.stop(); }
});
