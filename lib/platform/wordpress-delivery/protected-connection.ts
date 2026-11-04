import { Pool, type PoolClient } from "pg";

export const operatorRole = "miopages_wp_operator";
export const pullRole = "miopages_wp_pull";
export const migrationRole = "miopages_migration";
export const adapterSchema = "miopages_wp";

export function protectedPool(connectionString: string, role: string, ca?: string) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.password
    || decodeURIComponent(url.username) !== role || !/^\/[A-Za-z0-9_-]+$/.test(url.pathname)
    || url.search !== "?sslmode=verify-full" || url.hash) throw Error("Protected PostgreSQL verify-full URL required");
  url.search = "";
  return new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    options: "-c search_path=" + adapterSchema + ",public -c timezone=UTC", max: 4, connectionTimeoutMillis: 5000 });
}

export async function protectedConnection(db: PoolClient, role: string) {
  const row = (await db.query(`SELECT session_user::text AS login, current_user::text AS actor,
    (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls,
    r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication AS privileged,
    EXISTS (SELECT 1 FROM pg_auth_members WHERE member=r.oid) AS inherits_other_role
    FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
  if (row?.login !== role || row.actor !== role || !row.tls || row.privileged || row.inherits_other_role) {
    throw Error("Protected PostgreSQL role or TLS refused");
  }
}

export function credentialFromEnvironment(id: string) {
  const value = process.env["MIOPAGES_WP_CREDENTIAL_" + id.replaceAll("-", "_")];
  return Promise.resolve(value?.length === 64 && /^[a-f0-9]+$/.test(value) ? Buffer.from(value, "hex") : null);
}
