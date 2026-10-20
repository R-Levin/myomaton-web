import assert from "node:assert/strict";
import test from "node:test";
import { releaseActor, releaseEnvironment } from "../lib/platform/content-editing/release";
import type { PoolClient } from "pg";

test("release mandate uses a closed actor contract and production/shared environments refuse", async () => {
  assert.throws(() => releaseActor("operator")); assert.throws(() => releaseActor({ operatorId: "operator" }));
  assert.throws(() => releaseActor({ operatorId: "operator", authorityReference: "mandate", arbitrary: true }));
  assert.deepEqual(releaseActor({ operatorId: "operator", authorityReference: "verified mandate" }), { operatorId: "operator", authorityReference: "verified mandate" });
  const old = { NODE_ENV: process.env.NODE_ENV, MIOPAGES_SITE_RELEASES: process.env.MIOPAGES_SITE_RELEASES };
  try {
    Object.assign(process.env, { NODE_ENV: "production", MIOPAGES_SITE_RELEASES: "disposable-operator" });
    await assert.rejects(releaseEnvironment({ query: () => { throw Error("Unexpected query"); } } as unknown as PoolClient), /DEVELOPMENT/);
    Object.assign(process.env, { NODE_ENV: "development" });
    for (const row of [{ s: "public", db: "myomaton_dev", port: 5432 }, { s: `canonical_test_${"a".repeat(32)}_intake`, db: "myomaton_dev", port: 5432 }]) await assert.rejects(releaseEnvironment({ query: async () => ({ rows: [row] }) } as unknown as PoolClient), /private disposable/);
  } finally { Object.assign(process.env, old); }
});
