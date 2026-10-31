import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { supportedMajor, versionPolicy, applicationSemantic, managedDependencies, assertManagedLocale, assertManagedEquivalent, type ManagedState } from "../scripts/backup/managed";
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

const icuLocale = { encoding: "UTF8", datlocprovider: "i", datcollate: "en_US.UTF-8", datctype: "en_US.UTF-8", datlocale: "en-US", datcollversion: "153.121" };
const libcLocale = { encoding: "UTF8", datlocprovider: "c", datcollate: "C", datctype: "C", datlocale: null, datcollversion: null };

function providerClient(locale: Record<string, unknown>) {
  return { query: async (sql: string) => {
    if (sql === "SHOW server_version_num") return { rows: [{ server_version_num: "170011" }] };
    if (sql.includes("pg_extension")) return { rows: [{ extversion: "1.0" }] };
    if (sql.includes("to_regprocedure")) return { rows: [{ name: "gen_random_uuid()" }] };
    if (sql.includes("::jsonb")) return { rows: [{ ok: true }] };
    if (sql === "SHOW TimeZone") return { rows: [{ TimeZone: "UTC" }] };
    assert.equal(sql, "SELECT pg_encoding_to_char(encoding) encoding,datlocprovider,datcollate,datctype,datlocale,datcollversion,daticurules FROM pg_database WHERE datname=current_database()");
    return { rows: [{ daticurules: null, ...structuredClone(locale) }] };
  } };
}

test("managed PG17 provider accepts ICU and libc, retaining all six locale identity fields", async () => {
  for (const locale of [icuLocale, libcLocale]) {
    const original = structuredClone(locale);
    const provider = await managedDependencies(providerClient(locale) as never, "postgresql://localhost/synthetic");
    assert.equal(provider.major, 17); assert.deepEqual(provider.locale, original);
    assert.deepEqual(locale, original); assert.deepEqual(Object.keys(provider.locale), Object.keys(original));
  }
});

test("managed provider fails closed for unsupported or incomplete locale identities", async () => {
  for (const locale of [
    ...["b", "x", "", null].map(datlocprovider => ({ ...icuLocale, datlocprovider })),
    { ...icuLocale, daticurules: "&a<b" }, { ...icuLocale, encoding: "SQL_ASCII" }, { ...icuLocale, datlocale: null },
    { ...icuLocale, datlocale: "" }, { ...icuLocale, datcollversion: null },
    { ...icuLocale, datcollversion: "" }, { ...icuLocale, datcollate: null },
    { ...icuLocale, datctype: undefined }, { ...libcLocale, datlocale: "en-US" },
  ]) await assert.rejects(managedDependencies(providerClient(locale) as never, "postgresql://localhost/synthetic"));
  assertManagedLocale({ ...libcLocale, datcollversion: "2.41" });
});

test("managed equivalence preserves exact ICU provider/locale/version and libc boundaries", async () => {
  const provider = await managedDependencies(providerClient(icuLocale) as never, "postgresql://localhost/synthetic");
  const source = { provider, semantic: {}, security: [], tables: [], sequences: [], migrations: [], media: [], bootstrapReceipt: null } as unknown as ManagedState;
  assertManagedEquivalent(source, structuredClone(source));
  for (const locale of [
    libcLocale, { ...icuLocale, datlocale: "de-DE" },
    { ...icuLocale, datlocale: "en_US" }, { ...icuLocale, datcollversion: "153.122" },
    { ...icuLocale, datcollate: "C" }, { ...icuLocale, datctype: "C" },
    { ...icuLocale, encoding: "LATIN1" }, { ...icuLocale, datlocprovider: "b" },
  ]) {
    const target = structuredClone(source); target.provider.locale = locale;
    assert.throws(() => assertManagedEquivalent(source, target));
    assert.throws(() => assertManagedEquivalent(target, source));
  }
  const unsupported = structuredClone(source); unsupported.provider.locale.datlocprovider = "b";
  assert.throws(() => assertManagedEquivalent(unsupported, structuredClone(unsupported)), /Only libc and ICU/);
});
