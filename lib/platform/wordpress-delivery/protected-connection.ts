import { randomBytes } from "node:crypto";
import { checkServerIdentity } from "node:tls";
import { Pool, type PoolClient } from "pg";

export const operatorRole = "miopages_wp_operator";
export const pullRole = "miopages_wp_pull";
export const migrationRole = "miopages_migration";
export const adapterSchema = "miopages_wp";

export function protectedPool(connectionString: string, role: string, ca?: string) {
  const url = new URL(connectionString);
  const login = decodeURIComponent(url.username);
  const sessionPooler = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname);
  const permittedLogin = sessionPooler
    ? url.port === "5432" && login.startsWith(role + ".") && /^[a-z0-9]{1,63}$/.test(login.slice(role.length + 1))
    : login === role;
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.password
    || !permittedLogin || url.port === "6543" || !/^\/[A-Za-z0-9_-]+$/.test(url.pathname)
    || url.search !== "?sslmode=verify-full" || url.hash) throw Error("Protected PostgreSQL verify-full URL required");
  url.search = "";
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  return new Pool({ connectionString: url.toString(),
    ssl: { rejectUnauthorized: true, checkServerIdentity: (_name, cert) => checkServerIdentity(hostname, cert),
      ...(ca ? { ca } : {}) },
    max: 4, connectionTimeoutMillis: 5000 });
}

export async function protectedConnection(db: PoolClient, role: string, expectedDatabase?: string, onIdentityVerified?: () => void) {
  const row = (await db.query(`SELECT session_user::text AS login, current_user::text AS actor, current_database() AS database,
    (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls,
    r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication AS privileged,
    EXISTS (SELECT 1 FROM pg_auth_members WHERE member=r.oid) AS inherits_other_role
    FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
  const refusal = !row?.tls ? "WP_BACKEND_TLS_UNVERIFIED" :
    row.login !== role || row.actor !== role ? "WP_ROLE_MISMATCH" :
    row.privileged || row.inherits_other_role ? "WP_ROLE_PRIVILEGES" :
    expectedDatabase !== undefined && row.database !== expectedDatabase ? "WP_DATABASE_MISMATCH" : null;
  if (refusal) throw Object.assign(new Error("Protected PostgreSQL role, database or TLS refused"), { code: refusal });
  onIdentityVerified?.();
  // Configure the verified session with SQL rather than pooler startup options.
  await db.query("SELECT set_config('search_path',$1,false), set_config('TimeZone','UTC',false)", [adapterSchema + ",public"]);
}

// Use a dedicated checked-out client outside any transaction. The lock must
// survive BEGIN/ROLLBACK on the same backend and be explicitly releasable.
export async function verifyProtectedSession(db: PoolClient, role: string, expectedDatabase: string, onIdentityVerified?: () => void) {
  await protectedConnection(db, role, expectedDatabase, onIdentityVerified);
  const lock = randomBytes(8).readBigInt64BE().toString();
  const acquired = (await db.query("SELECT pg_backend_pid() AS pid, pg_try_advisory_lock($1::bigint) AS locked", [lock])).rows[0];
  if (!acquired?.locked) throw Error("Protected PostgreSQL session lock refused");
  try {
    await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    try {
      const state = (await db.query(`SELECT pg_backend_pid() AS pid,
        current_setting('transaction_read_only') AS read_only,
        current_setting('search_path') AS search_path, current_setting('TimeZone') AS timezone`)).rows[0];
      if (state?.pid !== acquired.pid || state.read_only !== "on"
        || state.search_path !== adapterSchema + ",public" || state.timezone !== "UTC") {
        throw Error("Protected PostgreSQL session state did not persist");
      }
    } finally { await db.query("ROLLBACK"); }
  } finally {
    const released = (await db.query("SELECT pg_backend_pid() AS pid, pg_advisory_unlock($1::bigint) AS unlocked", [lock])).rows[0];
    if (released?.pid !== acquired.pid || !released.unlocked) throw Error("Protected PostgreSQL session lock did not persist");
  }
}

export function credentialFromEnvironment(id: string) {
  const value = process.env["MIOPAGES_WP_CREDENTIAL_" + id.replaceAll("-", "_")];
  return Promise.resolve(value?.length === 64 && /^[a-f0-9]+$/.test(value) ? Buffer.from(value, "hex") : null);
}
