import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrateWithBootstrapCompatibility } from "../../scripts/db/bootstrap";
import ownership from "../../scripts/backup/application-ownership.json";
import { provisionManagedRoles, createManagedLoginRoles } from "../../scripts/db/managed-roles";
import { establishApplicationDefaults, normalizeObjectGrants, type Roles } from "../../scripts/backup/managed-permissions";
import { mioPagesIntakeOwner } from "../../lib/platform/intake/availability";
import { managedKey, provisionManagedObject } from "../../lib/platform/assets/local-storage";
import sharp from "sharp";

const q = (s: string) => '"' + s.replaceAll('"', '""') + '"';
export async function roleGrants(admin: Pool, roles: Roles, schema: string) {
  assert.match(schema, /^canonical_test_[a-f0-9]{32}(?:_\w+)?$/);
  const c = await admin.connect();
  try {
    await c.query("BEGIN");
    await c.query(`GRANT USAGE,CREATE ON SCHEMA ${q(schema)} TO ${q(roles.migration)}; GRANT USAGE ON SCHEMA ${q(schema)} TO ${q(roles.runtime)},${q(roles.backup)}`);
    for (const table of ownership.tables.filter(t => t.startsWith("public."))) await c.query(`ALTER TABLE ${q(schema)}.${q(table.slice(7))} OWNER TO ${q(roles.migration)}`);
    for (const fn of ownership.functions) await c.query(`ALTER FUNCTION ${q(schema)}.${q(fn.slice(7))}() OWNER TO ${q(roles.migration)}`);
    await c.query(`SET LOCAL ROLE ${q(roles.migration)}`);
    for (const table of ownership.tables.filter(t => t.startsWith("public."))) await normalizeObjectGrants(c, roles, "TABLE", `${schema}.${table.slice(7)}`);
    for (const fn of ownership.functions) await normalizeObjectGrants(c, roles, "FUNCTION", `${schema}.${fn.slice(7)}`);
    await c.query("COMMIT");
  } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
}
export async function managedEnvironment(url: string, migrateNow: boolean) {
  const u = new URL(url); assert.equal(u.hostname, "127.0.0.1"); assert.notEqual(u.port, "5432"); assert.match(u.pathname, /^\/migration_rehearsal_[a-f0-9]{32}$/);
  const admin = new Pool({ connectionString: url }), roles = { runtime: "proof_runtime", migration: "proof_migration", backup: "proof_backup" }, urls = {} as Record<keyof Roles, string>;
  const passwords = { runtime: randomBytes(32).toString("hex"), migration: randomBytes(32).toString("hex"), backup: randomBytes(32).toString("hex") };
  try {
    await admin.query("CREATE TABLE public.provider_marker(value text); INSERT INTO public.provider_marker VALUES('provider infrastructure, not app data')");
    if (migrateNow) {
      await migrateWithBootstrapCompatibility(admin);
      await provisionManagedRoles({ operation: "create", databaseUrl: url, databaseName: decodeURIComponent(u.pathname.slice(1)), sourceOwner: "postgres", roles, passwords });
    } else {
      // Empty restore targets have no complete application inventory yet. Their
      // disposable setup reuses the production role/default policy, not a writer.
      await createManagedLoginRoles(admin, roles, passwords);
      await admin.query(`GRANT CREATE ON DATABASE ${q(decodeURIComponent(u.pathname.slice(1)))} TO ${q(roles.migration)}; CREATE SCHEMA drizzle AUTHORIZATION ${q(roles.migration)}; GRANT USAGE,CREATE ON SCHEMA public TO ${q(roles.migration)}; GRANT USAGE ON SCHEMA public,drizzle TO ${q(roles.runtime)},${q(roles.backup)}`);
      await establishApplicationDefaults(admin, roles);
    }
    for (const kind of ["runtime", "migration", "backup"] as const) { const next = new URL(url); next.username = roles[kind]; next.password = passwords[kind]; urls[kind] = next.toString(); }
    return { admin, roles, urls };
  } catch (error) { await admin.end(); throw error; }
}
export async function seedManagedTenants(pool: Pool, root: string) {
  const tenants = [];
  for (const [i, label] of ["MioPages C0 Synthetic", "Cedar C1 Synthetic"].entries()) {
    const org = randomUUID(), presence = i ? randomUUID() : mioPagesIntakeOwner.webPresenceId, site = i ? randomUUID() : mioPagesIntakeOwner.managedSiteId, page = randomUUID();
    await pool.query("INSERT INTO organizations(id,name) VALUES($1,$2)", [org, label]); await pool.query("INSERT INTO web_presences(id,organization_id,name) VALUES($1,$2,$3)", [presence, org, label]); await pool.query("INSERT INTO managed_sites(id,web_presence_id,name) VALUES($1,$2,$3)", [site, presence, label]); await pool.query("INSERT INTO pages(id,managed_site_id,name,title,slug) VALUES($1,$2,'Home',$3,'/')", [page, site, label + " Home"]);
    const action = (await pool.query("INSERT INTO actions(web_presence_id,name,type,label,destination) VALUES($1,'Primary','page',$2,$3) RETURNING id", [presence, label + " CTA", page])).rows[0].id;
    const section = (await pool.query("INSERT INTO sections(page_id,type,content) VALUES($1,'intro',$2) RETURNING id", [page, { heading: label, text: label + " body", actionId: action }])).rows[0].id;
    const nav = (await pool.query("INSERT INTO navigations(web_presence_id,name) VALUES($1,'Primary Navigation') RETURNING id", [presence])).rows[0].id; await pool.query("INSERT INTO navigation_items(navigation_id,name,label,target_type,target_reference) VALUES($1,'Home',$2,'page',$3)", [nav, label + " Navigation", page]);
    const bytes = await sharp({ create: { width: 4, height: 4, channels: 3, background: i ? "#448844" : "#6644cc" } }).png().toBuffer(), key = managedKey(bytes); await provisionManagedObject(root, presence, key, bytes);
    const asset = (await pool.query("INSERT INTO assets(web_presence_id,name,mime_type,width,height,alt_text,source_type,source_reference) VALUES($1,$2,'image/png',4,4,$2,'managed',$3) RETURNING id", [presence, label, key])).rows[0].id; await pool.query("INSERT INTO asset_usages(web_presence_id,asset_id,entity_type,entity_id,role) VALUES($1,$2,'section',$3,'image')", [presence, asset, section]);
    const definition = (await pool.query("INSERT INTO contact_definitions(web_presence_id,name,configuration) VALUES($1,'Inquiry',$2) RETURNING id", [presence, { fields: [{ key: "email", label: "Email", required: true }] }])).rows[0].id; const contact = (await pool.query("INSERT INTO sections(page_id,type,content) VALUES($1,'contact',$2) RETURNING id", [page, { contact_definition_id: definition }])).rows[0].id;
    const hostname = `c${i}.localhost`; await pool.query("INSERT INTO managed_site_hostnames(hostname,web_presence_id,managed_site_id) VALUES($1,$2,$3)", [hostname, presence, site]);
    tenants.push({ label, presence, site, page, hostname, asset, section, definition, contact });
  }
  return tenants;
}
