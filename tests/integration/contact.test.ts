import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { Client, Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { schemaSignature } from "./schema-fidelity";
import { tables } from "../../scripts/customer-updates/myomaton-secondary-pages-v1";
import { acceptContactSubmission } from "../../lib/platform/contact/submissions";
import { contactPresentations } from "../../lib/platform/contact/presentation";
import { startProductionFixture } from "./production-server";
import { assetRoot } from "../../lib/platform/assets/local-storage";
import { JSDOM } from "jsdom";

test("Contact upgrade/fresh replay preserves public state; isolated submission ownership, persistence and lifecycle", async t => {
  const url = process.env.ASSET_TEST_DATABASE_URL; assert.ok(url, "ASSET_TEST_DATABASE_URL required; writes use disposable schemas only");
  const client = new Client({ connectionString: url }); await client.connect();
  const prefix = `myomaton_contact_test_${randomUUID().replaceAll("-", "")}`;
  const upgrade = `${prefix}_upgrade`, fresh = `${prefix}_fresh`;
  const quote = (name: string) => { assert.match(name, /^myomaton_contact_test_[a-f0-9]{32}_(upgrade|fresh)$/); return `"${name}"`; };
  const migrations = readMigrationFiles({ migrationsFolder: "lib/platform/db/migrations" }); assert.equal(migrations.length, 8);
  const read = async (schema: string) => {
    assert.ok(schema === "public" || quote(schema));
    const rows: Record<string, unknown[]> = {};
    for (const table of tables) rows[table] = (await client.query(`SELECT to_jsonb(t) AS row FROM "${schema}"."${table}" t ORDER BY id`)).rows.map(r => r.row);
    return rows;
  };
  const replay = async (schema: string, from: number, to: number) => {
    await client.query("BEGIN");
    try {
      await client.query(`SET LOCAL search_path TO ${quote(schema)}`);
      for (const migration of migrations.slice(from, to)) for (const sql of migration.sql) await client.query(sql.replaceAll('"public".', `${quote(schema)}.`));
      await client.query("COMMIT");
    } catch (e) { await client.query("ROLLBACK"); throw e; }
  };
  let pool: Pool | undefined;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const journal = (await client.query("SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id")).rows;
    assert.ok(journal.length === 7 || journal.length === 8);
    assert.deepEqual(journal, migrations.slice(0,journal.length).map(m => ({ hash: m.hash, created_at: String(m.folderMillis) })));
    const before = await read("public"); await client.query("ROLLBACK");
    for (const schema of [upgrade, fresh]) await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await replay(upgrade, 0, 7);
    const copyOrder = ["subject_types", ...tables.filter(t => t !== "subject_types")];
    for (const table of copyOrder) for (const row of before[table]) {
      await client.query(`INSERT INTO ${quote(upgrade)}."${table}" SELECT * FROM jsonb_populate_record(NULL::${quote(upgrade)}."${table}",$1::jsonb)`, [JSON.stringify(row)]);
    }
    await replay(upgrade, 7, 8);
    assert.deepEqual(await read(upgrade), before, "upgrade preserves all canonical values, timestamps and relationships");
    await replay(fresh, 0, 8);
    await client.query("BEGIN"); await client.query("SET LOCAL search_path TO pg_catalog");
    const all = [...tables, "contact_definitions", "contact_submissions"];
    const signature = await schemaSignature(client, upgrade, all);
    assert.deepEqual(signature, await schemaSignature(client, fresh, all));
    if (journal.length === 8) assert.deepEqual(await schemaSignature(client, "public", all), signature, "Migrated public schema matches fresh eight-migration replay");
    assert.ok(signature.indexes.every(i => i.indisvalid && i.indisready));
    await client.query("ROLLBACK");
    pool = new Pool({ connectionString: url, options: `-c search_path=${fresh}`, max: 4 });
    const p = pool;
    const fixture = async () => {
      const org = (await p.query("INSERT INTO organizations(name) VALUES ('Fixture') RETURNING id")).rows[0].id;
      const wp = (await p.query("INSERT INTO web_presences(organization_id,name,primary_domain) VALUES ($1,'Fixture',$2) RETURNING id", [org, `${randomUUID()}.test`])).rows[0];
      const site = (await p.query("INSERT INTO managed_sites(web_presence_id,name) VALUES ($1,'Fixture') RETURNING id", [wp.id])).rows[0].id;
      const page = (await p.query("INSERT INTO pages(managed_site_id,slug,name,title) VALUES ($1,'/contact','Contact','Contact') RETURNING id", [site])).rows[0].id;
      const config = { fields: [{ key: "email", label: "Email", required: true }, { key: "message", label: "Message", required: true }] };
      const definition = (await p.query("INSERT INTO contact_definitions(web_presence_id,name,configuration,delivery_route_key) VALUES ($1,'General',$2,'general') RETURNING id", [wp.id, config])).rows[0].id;
      const section = (await p.query("INSERT INTO sections(page_id,type,content) VALUES ($1,'contact',$2) RETURNING id", [page, { contact_definition_id: definition }])).rows[0].id;
      const domain = (await p.query("SELECT primary_domain FROM web_presences WHERE id=$1", [wp.id])).rows[0].primary_domain;
      return { wp: wp.id, site, page, section, definition, config, selection: { domain, managedSiteName: "Fixture" } };
    };
    const first = await fixture(), foreign = await fixture();
    await p.query("UPDATE pages SET slug='/foreign' WHERE id=$1", [foreign.page]);
    const request = (overrides: object = {}) => ({ sectionId: first.section, definitionId: first.definition, version: 1, fields: { email: "visitor@example.test", message: "Hello" }, idempotencyKey: randomUUID(), ...overrides });
    const allow = { allow: async () => true };
    let deliveries = 0, events = 0;
    const options = { abuse: allow, provider: { deliverSubmission: async (v: { routeKey: string }) => { assert.equal(v.routeKey, "general"); deliveries++; } }, events: { accepted: async () => { events++; } } };
    const submit = (input: unknown, opts = options) => acceptContactSubmission(p, first.selection, input, opts);
    const count = async () => Number((await p.query("SELECT count(*) FROM contact_submissions")).rows[0].count);

    await t.test("multiple definitions, public projection excludes routing, reused canonical identity", async () => {
      await p.query("INSERT INTO contact_definitions(web_presence_id,name,configuration) VALUES ($1,'Quote',$2)", [first.wp, first.config]);
      const dto = await contactPresentations(drizzle(p), { id: first.wp, name: "Fixture", configuration: { business: { email: "hello@example.test" } } }, [{ id: first.section, type: "contact", content: { contact_definition_id: first.definition } }]);
      assert.equal(dto.get(first.section)?.identity.email?.href, "mailto:hello@example.test");
      assert.equal(dto.get(first.section)?.definition.id, first.definition);
      assert.ok(!JSON.stringify([...dto]).includes("route"));
      assert.equal((await contactPresentations(drizzle(p), { id: foreign.wp, name: "Foreign", configuration: {} }, [{ id: first.section, type: "contact", content: { contact_definition_id: first.definition } }])).size, 0);
      if (process.env.ASSET_TEST_PRODUCTION === "1") {
        await p.query("UPDATE web_presences SET primary_domain='myomaton.com',configuration=$1 WHERE id=$2", [{ business: { email: "hello@example.test" } }, first.wp]);
        await p.query("UPDATE managed_sites SET name='Myomaton' WHERE id=$1", [first.site]);
        const server = await startProductionFixture(url, fresh, assetRoot());
        try {
          const response = await fetch(`${server.base}/contact`); assert.equal(response.status, 200);
          const html = await response.text(), doc = new JSDOM(html).window.document;
          assert.ok(doc.querySelector('main form input[name="email"]'));
          assert.ok(doc.querySelector('main form textarea[name="message"]'));
          assert.ok(doc.querySelector('a[href="mailto:hello@example.test"]'));
          assert.ok(!html.includes("delivery_route_key"));
          assert.equal((await fetch(`${server.base}/api/contact`, { method: "POST" })).status, 503, "production activation remains gated");
        } finally {
          await server.stop();
          await p.query("UPDATE web_presences SET primary_domain=$1,configuration='{}' WHERE id=$2", [first.selection.domain, first.wp]);
          await p.query("UPDATE managed_sites SET name='Fixture' WHERE id=$1", [first.site]);
        }
      }
    });
    await t.test("acceptance, concurrent exact retry no-op, conflict refusal and immutable expiration", async () => {
      const input = request();
      const results = await Promise.all([submit(input), submit(input)]);
      assert.equal(results.filter(r => r.duplicate).length, 1); assert.equal(await count(), 1); assert.equal(deliveries, 1); assert.equal(events, 1);
      const before = (await p.query("SELECT to_jsonb(s) AS row FROM contact_submissions s")).rows;
      assert.equal(before[0].row.delivery_status, "delivered"); assert.equal(before[0].row.delivery_attempts, 1);
      assert.equal(Date.parse(before[0].row.expires_at) - Date.parse(before[0].row.created_at), 30 * 86400000);
      await p.query("UPDATE managed_sites SET configuration=$1 WHERE id=$2", [{ policy: { contactRetentionDays: 7 } }, first.site]);
      await acceptContactSubmission(p, first.selection, input, { ...options, servicePolicy: { contactRetentionDays: { value: 10, allowSiteOverride: true } } });
      assert.deepEqual((await p.query("SELECT to_jsonb(s) AS row FROM contact_submissions s")).rows, before);
      await assert.rejects(submit({ ...input, fields: { ...input.fields, message: "Different" } }), /idempotency_conflict/);
      const later = request(); await acceptContactSubmission(p, first.selection, later, { ...options, servicePolicy: { contactRetentionDays: { allowSiteOverride: true } } });
      const row = (await p.query("SELECT * FROM contact_submissions WHERE idempotency_key=$1", [later.idempotencyKey])).rows[0];
      assert.equal(row.expires_at.getTime() - row.created_at.getTime(), 7 * 86400000);
    });
    await t.test("invalid input, inactive or foreign ownership/definition refuses without writes", async () => {
      const before = await count();
      await p.query("UPDATE pages SET slug='/api/hidden' WHERE id=$1", [first.page]);
      await assert.rejects(submit(request()), /unavailable/);
      await p.query("UPDATE pages SET slug='/contact' WHERE id=$1", [first.page]);
      for (const changes of [{ version: 2 }, { definitionId: foreign.definition }, { sectionId: foreign.section }, { recipient: "evil@test.example" }, { website: "bot" }, { fields: { email: "bad", message: "Hello" } }, { fields: { email: "a@example.com\r\nBcc:x@example.com", message: "Hi" } }, { fields: { email: "a@example.com", upload: "no", message: "Hi" } }, { fields: { email: "a@example.com" } }, { fields: { email: "a@example.com", message: "x".repeat(5001) } }, { fields: { message: "x".repeat(20000) } }]) await assert.rejects(submit(request(changes)));
      for (const [table, id] of [["web_presences", first.wp], ["managed_sites", first.site], ["pages", first.page], ["sections", first.section], ["contact_definitions", first.definition]]) {
        await p.query(`UPDATE ${table} SET status='inactive' WHERE id=$1`, [id]);
        await assert.rejects(submit(request()), /unavailable/);
        await p.query(`UPDATE ${table} SET status='active' WHERE id=$1`, [id]);
      }
      for (const [table, column, id, other, original] of [["sections","page_id",first.section,foreign.page,first.page], ["pages","managed_site_id",first.page,foreign.site,first.site], ["managed_sites","web_presence_id",first.site,foreign.wp,first.wp]]) {
        await p.query(`UPDATE ${table} SET ${column}=$1 WHERE id=$2`, [other,id]); await assert.rejects(submit(request()), /unavailable/);
        await p.query(`UPDATE ${table} SET ${column}=$1 WHERE id=$2`, [original,id]);
      }
      await p.query("UPDATE contact_definitions SET configuration='{}' WHERE id=$1", [first.definition]);
      await assert.rejects(submit(request()));
      await p.query("UPDATE contact_definitions SET configuration=$1 WHERE id=$2", [first.config,first.definition]);
      await assert.rejects(acceptContactSubmission(p, foreign.selection, request(), options));
      await assert.rejects(acceptContactSubmission(p, first.selection, request(), { abuse: { allow: async () => false } }), /rate_limited/);
      assert.equal(await count(), before);
    });
    await t.test("provider failure retains data with sanitized state; disabled routing makes no attempt", async () => {
      const noProvider = request(); await acceptContactSubmission(p, first.selection, noProvider, { abuse: allow });
      const unavailable = (await p.query("SELECT * FROM contact_submissions WHERE idempotency_key=$1", [noProvider.idempotencyKey])).rows[0];
      assert.equal(unavailable.delivery_status, "failed"); assert.equal(unavailable.delivery_attempts, 0); assert.equal(unavailable.delivery_error_code, "provider_unavailable");
      const input = request();
      await acceptContactSubmission(p, first.selection, input, { abuse: allow, provider: { deliverSubmission: async () => { throw new Error("secret raw provider body"); } } });
      const failed = (await p.query("SELECT * FROM contact_submissions WHERE idempotency_key=$1", [input.idempotencyKey])).rows[0];
      assert.equal(failed.delivery_status, "failed"); assert.equal(failed.delivery_attempts, 1); assert.equal(failed.delivery_error_code, "delivery_failed"); assert.equal(failed.fields.message, "Hello");
      await p.query("CREATE FUNCTION uncertain_delivery() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.delivery_status='delivered' THEN RAISE EXCEPTION 'fixture state write failure'; END IF; RETURN NEW; END $$");
      await p.query("CREATE TRIGGER uncertain_delivery BEFORE UPDATE ON contact_submissions FOR EACH ROW EXECUTE FUNCTION uncertain_delivery()");
      try {
        const uncertain = request(); assert.equal((await submit(uncertain)).accepted, true);
        const row = (await p.query("SELECT * FROM contact_submissions WHERE idempotency_key=$1", [uncertain.idempotencyKey])).rows[0];
        assert.equal(row.delivery_status, "pending"); assert.equal(row.delivery_attempts, 1); assert.equal(row.delivery_error_code, null, "state-write failure must not falsely classify provider success as failure");
      } finally { await p.query("DROP TRIGGER uncertain_delivery ON contact_submissions"); await p.query("DROP FUNCTION uncertain_delivery()"); }
      await p.query("UPDATE contact_definitions SET delivery_route_key=NULL WHERE id=$1", [first.definition]);
      const disabled = request(); const calls = deliveries; await submit(disabled);
      const row = (await p.query("SELECT * FROM contact_submissions WHERE idempotency_key=$1", [disabled.idempotencyKey])).rows[0];
      assert.equal(row.delivery_status, "disabled"); assert.equal(row.delivery_route_key, null); assert.equal(row.delivery_attempts, 0); assert.equal(deliveries, calls);
    });
    await t.test("forced insert failure rolls back acceptance and never delivers", async () => {
      const before = await count(), calls = deliveries;
      await p.query("CREATE FUNCTION reject_contact() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$");
      await p.query("CREATE TRIGGER reject_contact BEFORE INSERT ON contact_submissions FOR EACH ROW EXECUTE FUNCTION reject_contact()");
      try { await assert.rejects(submit(request()), /fixture failure/); assert.equal(await count(), before); assert.equal(deliveries, calls); }
      finally { await p.query("DROP TRIGGER reject_contact ON contact_submissions"); await p.query("DROP FUNCTION reject_contact()"); }
    });
    await t.test("retained submissions restrict owner/definition deletion; presentation deletion nulls source only", async () => {
      for (const [table,id] of [["contact_definitions",first.definition],["managed_sites",first.site],["web_presences",first.wp]]) await assert.rejects(p.query(`DELETE FROM ${table} WHERE id=$1`, [id]));
      const before = await count(); await p.query("DELETE FROM sections WHERE id=$1", [first.section]); await p.query("DELETE FROM pages WHERE id=$1", [first.page]);
      assert.equal(await count(), before);
      assert.ok((await p.query("SELECT page_id,section_id FROM contact_submissions")).rows.every(r => r.page_id === null && r.section_id === null));
      await assert.rejects(p.query("DELETE FROM managed_sites WHERE id=$1", [first.site]));
      await assert.rejects(p.query("UPDATE contact_submissions SET web_presence_id=$1", [foreign.wp]));
      await assert.rejects(p.query("UPDATE contact_submissions SET delivery_attempts=-1"));
    });
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    assert.deepEqual(await read("public"), before);
    assert.deepEqual((await client.query("SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id")).rows, journal);
    await client.query("ROLLBACK");
  } finally {
    await pool?.end();
    for (const schema of [upgrade, fresh]) await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
    await client.end();
  }
});
