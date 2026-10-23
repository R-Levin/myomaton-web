import assert from "node:assert/strict";
import test from "node:test";
import { normalizeHostname, routingMode, resolveTenant, UnavailableHostname } from "../lib/platform/managed-sites/hostname";

test("hostname authority normalization is deterministic and bounded", () => {
  for (const input of ["C0.Example.TEST", "c0.example.test.", "c0.example.test:55807", "C0.EXAMPLE.TEST.:443"]) assert.equal(normalizeHostname(input), "c0.example.test");
  for (const input of [null, "", "localhost", "127.0.0.1", "[::1]", "999.999", "a..test", "-a.test", "a-.test", "a.test..", "a.test:0", "a.test:65536", "a.test:abc", " a.test", "a.test,b.test", "a.test/b", "a.test@b.test", "a_test.test", "é.test", "xn--caf-dma.test", "a.xn--test", "a".repeat(64) + ".test"]) assert.throws(() => normalizeHostname(input), UnavailableHostname);
});
test("production modes refuse ambiguous environment fallback", () => {
  assert.equal(routingMode({ NODE_ENV: "production", MIOPAGES_ROUTING_MODE: "shared-hostnames" }), "shared-hostnames");
  for (const env of [{ NODE_ENV: "production" }, { NODE_ENV: "production", MIOPAGES_ROUTING_MODE: "local-single-site" }, { NODE_ENV: "production", MIOPAGES_ROUTING_MODE: "shared-hostnames", WEB_PRESENCE_ID: "tenant" }]) assert.throws(() => routingMode(env));
  assert.equal(routingMode({ NODE_ENV: "development" }), "local-single-site");
});
test("hostname resolution ignores forwarding headers and refuses ambiguity", async () => {
  const env = { NODE_ENV: "production", MIOPAGES_ROUTING_MODE: "shared-hostnames" };
  let rows = [{ organization_id: "org", web_presence_id: "c0", managed_site_id: "site0", binding_id: "binding", managed_site_name: "C0" }];
  const pool = { query: async (sql: string, params: unknown[]) => { assert.match(sql, /m.web_presence_id=w.id/); assert.deepEqual(params, ["c0.test"]); return { rows }; } } as unknown as Parameters<typeof resolveTenant>[0];
  const context = await resolveTenant(pool, new Headers({ host: "C0.TEST:443", "x-forwarded-host": "c1.test", forwarded: "host=c1.test" }), env);
  assert.equal(context.webPresenceId, "c0"); assert.equal(context.hostname, "c0.test"); assert.ok(Object.isFrozen(context));
  rows = [...rows, ...rows]; await assert.rejects(resolveTenant(pool, new Headers({ host: "c0.test" }), env), UnavailableHostname);
  rows = []; await assert.rejects(resolveTenant(pool, new Headers({ host: "c0.test" }), env), UnavailableHostname);
  await assert.rejects(resolveTenant(pool, new Headers({ "x-forwarded-host": "c0.test" }), env), UnavailableHostname);
});
test("single-site compatibility is nonproduction and still verifies its exact active owner", async () => {
  const webPresenceId = "00000000-0000-4000-8000-000000000001", managedSiteId = "00000000-0000-4000-8000-000000000002";
  const env = { NODE_ENV: "development", MIOPAGES_ROUTING_MODE: "local-single-site", WEB_PRESENCE_ID: webPresenceId, MANAGED_SITE_ID: managedSiteId };
  const pool = { query: async (sql: string, parameters: unknown[]) => { assert.deepEqual(parameters, [managedSiteId, webPresenceId]); assert.match(sql, /o.status='active'/); return { rows: [{ organization_id: "org", domain: "local.test", managed_site_name: "Local" }] }; } } as unknown as Parameters<typeof resolveTenant>[0];
  const tenant = await resolveTenant(pool, new Headers({ host: "unrelated.test" }), env);
  assert.equal(tenant.webPresenceId, webPresenceId); assert.equal(tenant.hostname, null); assert.ok(Object.isFrozen(tenant));
  await assert.rejects(resolveTenant(pool, new Headers(), { ...env, NODE_ENV: "production" }));
});
