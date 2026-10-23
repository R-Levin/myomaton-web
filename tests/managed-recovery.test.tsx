import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { supportedMajor, versionPolicy, applicationSemantic } from "../scripts/backup/managed";
import { recoveryCatalog, type RecoveryCatalog } from "../scripts/backup/catalog";
import ownership from "../scripts/backup/application-ownership.json";

test("managed scope is explicit and follows all committed tables, not all public objects", () => {
  const snapshot = JSON.parse(readFileSync("lib/platform/db/migrations/meta/0015_snapshot.json", "utf8"));
  assert.deepEqual(ownership.tables, [...Object.keys(snapshot.tables), "drizzle.__drizzle_migrations"].sort());
  assert.ok(ownership.tables.includes("public.managed_site_hostnames")); assert.equal(ownership.functions.length, 17);
  assert.deepEqual(ownership.extensions, []); assert.deepEqual(ownership.rolesCreatedByMigrations, []);
});
test("managed native tooling policy refuses mismatched clients, downgrades and unsupported majors", () => {
  versionPolicy(17, 17); versionPolicy(18, 18); versionPolicy(17, 17, 18, 18);
  for (const args of [[17, 18], [18, 17], [18, 18, 17, 17], [17, 17, 18, 17]]) assert.throws(() => versionPolicy(...args as [number, number, number?, number?]));
  for (const value of [16, 19, 0, NaN]) assert.throws(() => supportedMajor(value));
});
test("PG17 catalog reads use enforced=true only where the PG18 column is absent", async () => {
  for (const major of [17, 18]) { const sql: string[] = []; const client = { query: async (query: string) => { sql.push(query); return { rows: query === "SHOW server_version_num" ? [{ server_version_num: String(major * 10000) }] : [] }; } };
    await recoveryCatalog(client as never, ["public", "drizzle"]);
    assert.equal(sql.some(s => s.includes("con.conenforced")), major === 18); assert.equal(sql.some(s => s.includes("true AS conenforced")), major === 17);
  }
});
test("only managed projection bridges NOT NULL representation; real enforcement/column drift stays visible", () => {
  const base = { version: 2, semantic: { columns: [{ nspname: "public", relname: "pages", attnotnull: true }], constraints: [{ nspname: "public", relname: "pages", contype: "c", conenforced: true, definition: "CHECK (version > 0)" }], functions: [], extensions: [{ extname: "provider_extension" }] }, security: {}, roles: [], environment: [] } as RecoveryCatalog;
  const newer = structuredClone(base); newer.semantic.constraints.push({ nspname: "public", relname: "pages", contype: "n", definition: "NOT NULL id" }); newer.semantic.columns.push({ nspname: "public", relname: "provider_table", attnotnull: true });
  assert.deepEqual(applicationSemantic(base), applicationSemantic(newer)); assert.notDeepEqual(base, newer);
  newer.semantic.columns[0].attnotnull = false; assert.notDeepEqual(applicationSemantic(base), applicationSemantic(newer));
  newer.semantic.columns[0].attnotnull = true; newer.semantic.constraints[0].conenforced = false; assert.notDeepEqual(applicationSemantic(base), applicationSemantic(newer));
});
