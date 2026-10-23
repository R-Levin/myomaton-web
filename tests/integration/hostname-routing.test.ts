import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { hostnameFixture } from "../../scripts/hostname-routing/fixture";
import { resolveTenant, UnavailableHostname } from "../../lib/platform/managed-sites/hostname";
import { acceptContactSubmission } from "../../lib/platform/contact/submissions";
import { startProductionFixture } from "./production-server";
import { hostRequest } from "../helpers/host-request";

test("two synthetic tenants share one production process with hostname-bound isolation", async () => {
  assert.ok(process.env.ASSET_TEST_DATABASE_URL);
  const f = await hostnameFixture(process.env.ASSET_TEST_DATABASE_URL);
  const [c0, c1] = f.tenants;
  const env = { NODE_ENV: "production", MIOPAGES_ROUTING_MODE: "shared-hostnames" };
  const resolve = (host: string) => resolveTenant(f.pool, new Headers({ host }), env);
  let server: Awaited<ReturnType<typeof startProductionFixture>> | undefined;
  try {
    await assert.rejects(f.pool.query("INSERT INTO managed_site_hostnames(hostname,web_presence_id,managed_site_id) VALUES($1,$2,$3)", [c0.hostname, c0.presence, c0.site]), /unique/);
    await assert.rejects(f.pool.query("INSERT INTO managed_site_hostnames(hostname,web_presence_id,managed_site_id) VALUES('wrong.localhost',$1,$2)", [c0.presence, c1.site]), /foreign key/);
    for (const hostname of ["UPPER.test", "double..test", "127.0.0.1", "xn--example.test", "a.test.", "-a.test"]) await assert.rejects(f.pool.query("INSERT INTO managed_site_hostnames(hostname,web_presence_id,managed_site_id) VALUES($1,$2,$3)", [hostname, c0.presence, c0.site]), /check constraint/);
    for (const table of ["managed_site_hostnames", "managed_sites", "web_presences", "organizations"]) {
      const id = table === "managed_site_hostnames" ? c0.binding : table === "managed_sites" ? c0.site : table === "web_presences" ? c0.presence : c0.organization;
      await f.pool.query(`UPDATE ${table} SET status='inactive' WHERE id=$1`, [id]);
      await assert.rejects(resolve(c0.hostname), UnavailableHostname);
      await f.pool.query(`UPDATE ${table} SET status='active' WHERE id=$1`, [id]);
    }
    const contexts = await Promise.all(Array.from({ length: 30 }, (_, i) => resolve(f.tenants[i % 2].hostname)));
    contexts.forEach((context, i) => assert.equal(context.webPresenceId, f.tenants[i % 2].presence));
    // Actual Contact acceptance uses only resolved UUIDs; browser-supplied foreign
    // section/definition/destination IDs cannot change the owning tenant.
    for (const [tenant, foreign] of [[c0, c1], [c1, c0]]) {
      const context = await resolve(tenant.hostname);
      const input = { sectionId: tenant.contact, definitionId: tenant.definition, version: 1, fields: { email: "synthetic@example.test" }, idempotencyKey: randomUUID() };
      const options = { abuse: { allow: async () => true } };
      const accepted = await acceptContactSubmission(f.pool, context, input, options);
      assert.equal(accepted.accepted, true);
      assert.equal((await f.pool.query("SELECT web_presence_id FROM contact_submissions WHERE idempotency_key=$1", [input.idempotencyKey])).rows[0].web_presence_id, tenant.presence);
      for (const override of [{ sectionId: foreign.contact }, { definitionId: foreign.definition }, { webPresenceId: foreign.presence }, { managedSiteId: foreign.site }]) await assert.rejects(acceptContactSubmission(f.pool, context, { ...input, idempotencyKey: randomUUID(), ...override }, options));
    }
    assert.equal((await f.pool.query("SELECT count(*)::int n FROM contact_submissions")).rows[0].n, 2);
    server = await startProductionFixture(process.env.ASSET_TEST_DATABASE_URL, f.schema, f.root, { webPresenceId: c0.presence, managedSiteId: c0.site }, false, true);
    const get = (host: string, pathname = "/", extra: Record<string, string> = {}) => hostRequest(server!.base, pathname, host, extra);
    for (const [tenant, foreign] of [[c0, c1], [c1, c0], [c0, c1], [c1, c0]]) {
      const response = await get(tenant.hostname); assert.equal(response.status, 200); const body = await response.text();
      for (const marker of [tenant.label + " Home", tenant.label + " body", tenant.label + " Navigation", tenant.label + " CTA", `https://${tenant.hostname}/`, tenant.asset]) assert.ok(body.includes(marker), marker);
      assert.ok(!body.includes(foreign.label)); assert.ok(!body.includes(foreign.asset)); assert.ok(!body.includes("untrusted-copy.example"));
      assert.ok(body.includes('rel="canonical"')); assert.ok(body.includes('property="og:url"'));
      const media = await get(tenant.hostname, `/media/assets/${tenant.asset}`); assert.equal(media.status, 200); assert.equal(media.headers.get("cache-control"), "no-store");
      assert.equal((await get(tenant.hostname, `/media/assets/${foreign.asset}`)).status, 404);
      assert.equal((await get(tenant.hostname, `/${foreign.page}`)).status, 404);
      const poisoned = await (await get(tenant.hostname, "/", { "x-forwarded-host": foreign.hostname, forwarded: `host=${foreign.hostname}` })).text();
      assert.ok(poisoned.includes(tenant.label)); assert.ok(!poisoned.includes(foreign.label));
      assert.equal((await get(tenant.hostname, "/review/intake")).status, 404);
      assert.equal((await get(tenant.hostname, "/api/intake")).status, 503);
      assert.equal((await hostRequest(server.base, "/api/contact", tenant.hostname, {}, "POST")).status, 503);
    }
    const concurrent = await Promise.all(Array.from({ length: 16 }, (_, i) => get(f.tenants[i % 2].hostname).then(r => r.text())));
    concurrent.forEach((body, i) => { assert.ok(body.includes(f.tenants[i % 2].label)); assert.ok(!body.includes(f.tenants[(i + 1) % 2].label)); });
    for (const host of ["unknown.localhost", "bad_host.test", "127.0.0.1", "a.test,b.test"]) {
      for (const pathname of ["/", `/media/assets/${c0.asset}`, "/api/intake"]) assert.equal((await get(host, pathname)).status, 404);
    }
    for (const host of ["C0.LOCALHOST", "c0.localhost.", "c0.localhost:55807"]) assert.ok((await (await get(host)).text()).includes(c0.label));
    assert.ok([400, 404].includes((await hostRequest(server.base, "/", null)).status));
    await f.pool.query("UPDATE managed_site_hostnames SET status='inactive' WHERE id=$1", [c0.binding]);
    assert.equal((await get(c0.hostname)).status, 404);
    console.log(JSON.stringify({ sameProcess: server.processId, tenants: 2, concurrent: true, metadata: true, assets: true, contact: true, sharedTouched: false }));
  } finally { if (server) await server.stop(); await f.stop(); }
});
