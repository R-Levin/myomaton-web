import assert from "node:assert/strict";
import type { PoolClient } from "pg";
import ownership from "./application-ownership.json";

export type Roles = { runtime: string; migration: string; backup: string };
export type Sql = Pick<PoolClient, "query">;
export const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"';
export const qualified = (s: string) => s.split(".").map(quote).join(".");
export const tablePermissions = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"];
export function allowedPrivileges(kind: keyof Roles, type: "TABLE" | "SEQUENCE" | "FUNCTION", journal = false): string[] {
  if (type === "FUNCTION") return kind === "backup" ? [] : ["EXECUTE"];
  if (type === "SEQUENCE") return kind === "migration" ? ["SELECT", "USAGE", "UPDATE"] : kind === "backup" ? ["SELECT"] : [];
  return kind === "migration" ? tablePermissions : kind === "runtime" && !journal ? ["SELECT", "INSERT", "UPDATE", "DELETE"] : ["SELECT"];
}

// Shared by the inventory-only writer and guarded disposable-schema fixtures.
// Clear all non-owner ACL roots (and their grant chains) on this object only.
export async function normalizeObjectGrants(c: Sql, roles: Roles, type: "TABLE" | "SEQUENCE" | "FUNCTION", name: string, journal = false) {
  const fn = type === "FUNCTION", object = qualified(name) + (fn ? "()" : "");
  const rows = (await c.query(fn
    ? "SELECT a.grantee,pg_get_userbyid(a.grantee) name FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=to_regprocedure($1)"
    : "SELECT a.grantee,pg_get_userbyid(a.grantee) name FROM pg_class p CROSS JOIN LATERAL aclexplode(coalesce(p.relacl,acldefault(CASE WHEN p.relkind='S' THEN 's'::\"char\" ELSE 'r'::\"char\" END,p.relowner))) a WHERE p.oid=to_regclass($1)", [name + (fn ? "()" : "")])).rows;
  const grantees = new Map<number, string>([[0, "PUBLIC"]]);
  for (const r of rows) if (r.name !== roles.migration) grantees.set(r.grantee, r.grantee === 0 ? "PUBLIC" : quote(r.name));
  // Column-only privileges can exist without any relation ACL entry.
  if (type === "TABLE") {
    const columns = (await c.query("SELECT col.attname,a.grantee,pg_get_userbyid(a.grantee) name FROM pg_attribute col CROSS JOIN LATERAL aclexplode(col.attacl) a WHERE col.attrelid=to_regclass($1) AND col.attnum>0 AND NOT col.attisdropped", [name])).rows;
    for (const col of columns) await c.query(`REVOKE ALL (${quote(col.attname)}) ON TABLE ${object} FROM ${col.grantee === 0 ? "PUBLIC" : quote(col.name)} CASCADE`);
  }
  for (const grantee of grantees.values()) await c.query(`REVOKE ALL ON ${type} ${object} FROM ${grantee} CASCADE`);
  for (const kind of ["runtime", "backup"] as const) {
    const privileges = allowedPrivileges(kind, type, journal);
    if (privileges.length) await c.query(`GRANT ${privileges.join(",")} ON ${type} ${object} TO ${quote(roles[kind])}`);
  }
}
export async function applyApplicationGrants(c: Sql, roles: Roles) {
  for (const table of ownership.tables) await normalizeObjectGrants(c, roles, "TABLE", table, table === "drizzle.__drizzle_migrations");
  for (const sequence of ownership.sequences) await normalizeObjectGrants(c, roles, "SEQUENCE", sequence);
  for (const fn of ownership.functions) await normalizeObjectGrants(c, roles, "FUNCTION", fn);
}
export async function normalizeOwnedSchemaGrants(c: Sql, roles: Roles, schema: string) {
  assert.ok(ownership.schemas.includes(schema) && schema !== "public", "Never normalize shared public schema ACLs");
  const edges = (await c.query("SELECT a.grantee,pg_get_userbyid(a.grantee) name FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname=$1", [schema])).rows;
  const grantees = new Map<number, string>([[0, "PUBLIC"]]);
  for (const r of edges) if (r.name !== roles.migration) grantees.set(r.grantee, r.grantee === 0 ? "PUBLIC" : quote(r.name));
  for (const grantee of grantees.values()) await c.query(`REVOKE ALL ON SCHEMA ${quote(schema)} FROM ${grantee} CASCADE`);
  await c.query(`GRANT USAGE ON SCHEMA ${quote(schema)} TO ${quote(roles.runtime)},${quote(roles.backup)}`);
}
export async function establishApplicationDefaults(c: Sql, roles: Roles) {
  // Schema-local REVOKE cannot cancel PostgreSQL's global PUBLIC EXECUTE default.
  // This is scoped to the new dedicated migration role, never the provider owner.
  for (const type of ["TABLES", "SEQUENCES", "FUNCTIONS"]) await c.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${quote(roles.migration)} REVOKE ALL ON ${type} FROM PUBLIC`);
}
export async function assertApplicationDefaults(c: Sql, roles: Roles) {
  const rows = (await c.query(`SELECT pg_get_userbyid(d.defaclrole) owner,n.nspname schema,d.defaclnamespace=0 global,d.defaclobjtype type,pg_get_userbyid(a.grantee) grantee,pg_get_userbyid(a.grantor) grantor,a.privilege_type privilege,a.is_grantable
    FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace LEFT JOIN LATERAL aclexplode(d.defaclacl) a ON true
    WHERE d.defaclrole=ANY(SELECT oid FROM pg_roles WHERE rolname=ANY($1))`, [Object.values(roles)])).rows;
  assert.ok(rows.some(r => r.owner === roles.migration && r.global && r.type === "f" && r.grantee === roles.migration && r.privilege === "EXECUTE"), "Migration defaults must explicitly remove global PUBLIC EXECUTE");
  for (const r of rows) {
    assert.equal(r.owner, roles.migration, "Unexpected runtime/backup defaults");
    assert.ok(r.global || ownership.schemas.includes(r.schema), "Unreviewed default privilege schema");
    assert.ok(["r", "S", "f"].includes(r.type), "Unreviewed default privilege object type");
    if (r.grantee !== null) { assert.equal(r.grantee, roles.migration, "Unreviewed default privilege grantee"); assert.equal(r.grantor, roles.migration); assert.equal(r.is_grantable, false); }
  }
}
