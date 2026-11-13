import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hostedCoreRequest } from "../lib/platform/intake/hosted-core";
import { initializeResponsesUsageLedger, protectedResponsesProvider } from "../lib/platform/intake/intelligent-responses";
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
    const neutral = "https://core-dev.miopages.com";
    const aliasHost = new URL(neutral).host;
    assert.equal((await get(undefined, { host: aliasHost })).status, 404);
    process.env.MIOPAGES_PROTECTED_CORE_ORIGIN = neutral;
    assert.equal((await get(undefined, { host: aliasHost })).status, 401);
    assert.equal((await get()).status, 401);
    assert.equal((await get(undefined, { host: aliasHost + ":443" })).status, 404);
    assert.equal((await hostedCoreRequest(new Request(neutral + "/api/protected-core", {
      method: "POST", headers: { ...headers, host: aliasHost, origin },
    }))).status, 403);
    process.env.MIOPAGES_PROTECTED_CORE_ORIGIN = origin;
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

test("a changed protected projection between count and generation settles only the count", async () => {
  const directory = await mkdtemp(join(tmpdir(), "miopages-consent-"));
  try {
    const rates = { model: "gpt-5.4-mini-2026-03-17", verifiedOn: "2026-11-13", inputPerMillion: 750_000,
      cachedPerMillion: 75_000, cacheWritePerMillion: 0, outputPerMillion: 4_500_000, countMicros: 0 };
    await initializeResponsesUsageLedger(directory, rates);
    const dispatched: string[] = [];
    const provider = protectedResponsesProvider(directory, rates, { async send(path) {
      dispatched.push(path);
      return { body: { input_tokens: 42 } };
    } }, { capMicros: 500_000, maxRequests: 20, expiresAt: Date.now() + 60_000,
      async project() { return { projection: dispatched.length }; } });
    await assert.rejects(provider.propose({ entryPath: "DIRECT_START", history: [], evidence: [],
      gap: { id: "buyers", questionPurpose: "Find the buyer", sourceIds: [], known: [] },
    }, { ownerDigest: "a".repeat(64), workDigest: "b".repeat(64) }), /projection changed/);
    assert.deepEqual(dispatched, ["/v1/responses/input_tokens"]);
    const { attempts } = JSON.parse(await readFile(join(directory, "onboarding-usage.json"), "utf8"));
    assert.equal(attempts[0].status, "rejected");
    assert.equal(attempts[0].estimatedMicros, 0);
    assert.equal(attempts[0].generationDispatched, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
