import assert from "node:assert/strict";
import test from "node:test";
import { hostedCoreRequest } from "../lib/platform/intake/hosted-core";
import { responsesHttps } from "../lib/platform/intake/responses-https";

test("protected Core refuses anonymous and cross-origin requests before accessing protected services", async () => {
  const previous = { enabled: process.env.MIOPAGES_PROTECTED_CORE, origin: process.env.MIOPAGES_PROTECTED_CORE_ORIGIN };
  const origin = "https://wp-acceptance.miopages.com";
  const headers = { host: new URL(origin).host, "x-forwarded-proto": "https", "x-intake-request": "1" };
  const get = (path = "/api/protected-core", overrides = {}) =>
    hostedCoreRequest(new Request(origin + path, { headers: { ...headers, ...overrides } }));
  try {
    delete process.env.MIOPAGES_PROTECTED_CORE;
    assert.equal((await get()).status, 404);
    process.env.MIOPAGES_PROTECTED_CORE = "enabled";
    process.env.MIOPAGES_PROTECTED_CORE_ORIGIN = origin;
    const response = await get();
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await get("/api/protected-core?draft=foreign")).status, 404);
    assert.equal((await get(undefined, { host: "runtime.miopages.com" })).status, 404);
    assert.equal((await get(undefined, { "x-forwarded-proto": "http" })).status, 404);
    assert.equal((await hostedCoreRequest(new Request(origin + "/api/protected-core", {
      method: "POST", headers: { ...headers, origin: "https://foreign.example" },
    }))).status, 403);
    const logout = await hostedCoreRequest(new Request(origin + "/api/protected-core", {
      method: "POST", headers: { ...headers, origin, "x-core-operation": "logout" },
    }));
    assert.match(logout.headers.get("set-cookie")!, /Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=0/);
  } finally {
    for (const [key, value] of Object.entries({ MIOPAGES_PROTECTED_CORE: previous.enabled, MIOPAGES_PROTECTED_CORE_ORIGIN: previous.origin })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("the live transport refuses expired authority before making a network request", async () => {
  const transport = responsesHttps("sk-" + "a".repeat(32), Date.now() - 1);
  await assert.rejects(transport.send("/v1/responses", {}), /dispatch refused/);
});
