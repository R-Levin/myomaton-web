import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool } from "pg";
import { readMigrationFiles } from "drizzle-orm/migrator";
import sharp from "sharp";
import { managedKey, provisionManagedObject } from "../../lib/platform/assets/local-storage";

// Own random schema on an explicitly private cluster. No shared source cloning.
export async function hostnameFixture(databaseUrl: string) {
  const url = new URL(databaseUrl);
  assert.equal(url.hostname, "127.0.0.1"); assert.notEqual(url.port || "5432", "5432");
  assert.match(url.pathname, /^\/migration_rehearsal_[a-f0-9]{32}$/);
  const schema = `canonical_test_${randomUUID().replaceAll("-", "")}_hostname`;
  const admin = new Pool({ connectionString: databaseUrl });
  const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}`, max: 2 });
  const root = await mkdtemp(path.join(tmpdir(), "hostname-media-"));
  const tenants = [];
  try {
    const c = await admin.connect();
    try {
      await c.query("BEGIN"); await c.query(`CREATE SCHEMA "${schema}"`); await c.query(`SET LOCAL search_path="${schema}"`);
      for (const migration of readMigrationFiles({ migrationsFolder: "lib/platform/db/migrations" })) for (const sql of migration.sql) await c.query(sql.replaceAll('"public".', `"${schema}".`));
      await c.query("COMMIT");
    } catch (error) { await c.query("ROLLBACK"); throw error; } finally { c.release(); }
    for (const [index, label] of ["C0 MioPages Synthetic", "C1 Cedar Synthetic"].entries()) {
      const organization = (await pool.query("INSERT INTO organizations(name) VALUES($1) RETURNING id", [label])).rows[0].id;
      const presence = (await pool.query("INSERT INTO web_presences(organization_id,name,primary_domain) VALUES($1,$2,'untrusted-copy.example') RETURNING id", [organization, label])).rows[0].id;
      const site = (await pool.query("INSERT INTO managed_sites(web_presence_id,name) VALUES($1,$2) RETURNING id", [presence, label])).rows[0].id;
      const page = (await pool.query("INSERT INTO pages(managed_site_id,name,title,slug) VALUES($1,'Home',$2,'/') RETURNING id", [site, label + " Home"])).rows[0].id;
      const action = (await pool.query("INSERT INTO actions(web_presence_id,name,type,label,destination) VALUES($1,'Primary','page',$2,$3) RETURNING id", [presence, label + " CTA", page])).rows[0].id;
      const section = (await pool.query("INSERT INTO sections(page_id,type,content) VALUES($1,'intro',$2) RETURNING id", [page, { heading: label + " heading", text: label + " body", actionId: action }])).rows[0].id;
      const navigation = (await pool.query("INSERT INTO navigations(web_presence_id,name) VALUES($1,'Primary Navigation') RETURNING id", [presence])).rows[0].id;
      await pool.query("INSERT INTO navigation_items(navigation_id,name,label,target_type,target_reference) VALUES($1,'Home',$2,'page',$3)", [navigation, label + " Navigation", page]);
      const bytes = await sharp({ create: { width: 4, height: 4, channels: 3, background: index ? "#008844" : "#6633cc" } }).png().toBuffer();
      const key = managedKey(bytes);
      await provisionManagedObject(root, presence, key, bytes);
      const asset = (await pool.query("INSERT INTO assets(web_presence_id,name,mime_type,width,height,alt_text,source_type,source_reference) VALUES($1,$2,'image/png',4,4,$2,'managed',$3) RETURNING id", [presence, label + " image", key])).rows[0].id;
      await pool.query("INSERT INTO asset_usages(web_presence_id,asset_id,entity_type,entity_id,role) VALUES($1,$2,'section',$3,'image')", [presence, asset, section]);
      const definition = (await pool.query("INSERT INTO contact_definitions(web_presence_id,name,configuration) VALUES($1,'Inquiry',$2) RETURNING id", [presence, { fields: [{ key: "email", label: "Email", required: true }] }])).rows[0].id;
      const contact = (await pool.query("INSERT INTO sections(page_id,type,content) VALUES($1,'contact',$2) RETURNING id", [page, { contact_definition_id: definition }])).rows[0].id;
      const hostname = `c${index}.localhost`;
      const binding = (await pool.query("INSERT INTO managed_site_hostnames(hostname,web_presence_id,managed_site_id) VALUES($1,$2,$3) RETURNING id", [hostname, presence, site])).rows[0].id;
      tenants.push({ label, hostname, organization, presence, site, page, action, section, asset, definition, contact, binding });
    }
    const stop = async () => {
      await pool.end(); await admin.query(`DROP SCHEMA "${schema}" CASCADE`); await admin.end();
      assert.equal(path.dirname(root), path.resolve(tmpdir())); assert.match(path.basename(root), /^hostname-media-/); await rm(root, { recursive: true });
    };
    return { schema, pool, root, tenants, stop };
  } catch (error) {
    await pool.end(); await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.end();
    assert.equal(path.dirname(root), path.resolve(tmpdir())); await rm(root, { recursive: true }); throw error;
  }
}
