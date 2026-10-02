import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { bootstrapMyomaton } from "../scripts/customer-bootstrap/myomaton";
import { seedPlatform } from "../scripts/seed-data/platform";
import { myomatonDesignConfiguration } from "../scripts/customer-bootstrap/myomaton-design-system";
import { myomatonAction } from "../scripts/customer-bootstrap/myomaton-action";

type Row = Record<string, unknown>;
// In-memory driver for real Drizzle statements, never a connection to the customer DB.
// Snapshot rollback models atomicity; these are not PostgreSQL constraint/locking tests.
function fixture() {
  let state: Record<string, Row[]> = Object.fromEntries([
    "subject_types", "organizations", "web_presences", "subjects", "design_systems", "actions",
    "managed_sites", "pages", "sections", "navigations", "navigation_items", "assets", "asset_usages",
  ].map((name) => [name, []]));
  let snapshot: typeof state | undefined;
  const statements: string[] = [];
  const writes: string[] = [];
  let failTable: string | undefined;
  const client = { async query(input: string | { text: string }, params: unknown[] = []) {
    const sql = typeof input === "string" ? input : input.text;
    statements.push(sql);
    if (sql === "begin") { snapshot = structuredClone(state); return { rows: [] }; }
    if (sql === "commit") { snapshot = undefined; return { rows: [] }; }
    if (sql === "rollback") { assert.ok(snapshot); state = snapshot; snapshot = undefined; return { rows: [] }; }
    if (sql.includes("pg_advisory_xact_lock")) { assert.ok(snapshot); return { rows: [] }; }
    if (sql.startsWith("insert into")) {
      const match = sql.match(/^insert into "([a-z_]+)" \((.*?)\) values (.*?)(?: on conflict| returning|$)/);
      assert.ok(match, sql);
      const [, table, columnsText, valuesText] = match;
      assert.ok(!["assets", "asset_usages"].includes(table), "No Asset writes permitted");
      if (table === failTable) throw new Error("Forced fixture failure");
      if (table !== "subject_types") assert.ok(snapshot, "Customer writes require a transaction");
      writes.push(table);
      const columns = columnsText.split(", ").map((name) => name.replaceAll('"', ""));
      const created: Row[] = [];
      for (const group of valuesText.matchAll(/\(([^()]*)\)/g)) {
        const row: Row = { id: randomUUID(), status: "active", version: 1, created_at: "unchanged", updated_at: "unchanged" };
        group[1].split(", ").forEach((token, index) => {
          if (token === "default") return;
          assert.match(token, /^\$\d+$/);
          const value = params[Number(token.slice(1)) - 1];
          row[columns[index]] = ["configuration", "content", "metadata"].includes(columns[index]) && typeof value === "string" ? JSON.parse(value) : value;
        });
        if (table === "subject_types" && state[table].some((item) => item.key === row.key)) {
          assert.match(sql, /on conflict \("key"\) do nothing/); continue;
        }
        state[table].push(row); created.push(row);
      }
      const returning = sql.split(" returning ")[1];
      const fields = returning?.split(", ").map((field) => field.replaceAll('"', ""));
      return { rows: fields ? created.map((row) => fields.map((field) => row[field])) : [] };
    }
    const table = sql.match(/from "([a-z_]+)"/)?.[1];
    assert.ok(table && ["web_presences", "organizations", "subject_types"].includes(table), `Unexpected SQL: ${sql}`);
    let rows = state[table];
    const normalized = (value: unknown) => typeof value === "string" ? value.trim().toLowerCase() : "";
    if (table === "web_presences") {
      assert.match(sql, /lower\(btrim\("web_presences"\."primary_domain"\)\)/);
      assert.match(sql, /lower\(btrim\("web_presences"\."name"\)\)/);
      assert.match(sql, /for update$/);
      assert.ok(!sql.includes('"status"'), "Inactive roots must still be recognized");
      rows = rows.filter((row) => normalized(row.primary_domain) === "myomaton.com" || normalized(row.name) === "myomaton" || params.includes(row.id));
    } else if (table === "organizations") {
      rows = rows.filter((row) => normalized(row.name) === "open practical robotics");
    } else {
      assert.deepEqual(params, ["project", 1]);
      rows = rows.filter((row) => row.key === "project");
    }
    const limit = params.at(-1); assert.equal(typeof limit, "number");
    const fields = sql.slice(7, sql.indexOf(" from ")).split(", ").map((field) => field.replaceAll('"', ""));
    return { rows: rows.slice(0, limit as number).map((row) => fields.map((field) => row[field])) };
  } };
  return { db: drizzle({ client: client as unknown as Pool }), get state() { return state; }, statements, writes,
    failOn(table: string) { failTable = table; } };
}

test("generic platform seed only creates missing reference data and never synchronizes customer state", async () => {
  const f = fixture();
  await seedPlatform(f.db);
  assert.deepEqual(f.writes, ["subject_types"]);
  assert.equal(f.state.subject_types.length, 1);
  for (const [table, rows] of Object.entries(f.state)) if (table !== "subject_types") assert.deepEqual(rows, []);
  Object.assign(f.state.subject_types[0], { name: "Customized reference", status: "inactive" });
  const before = structuredClone(f.state);
  await seedPlatform(f.db);
  assert.deepEqual(f.state, before);
  const entry = readFileSync("scripts/seed.ts", "utf8");
  assert.match(entry, /await seedPlatform/);
  assert.ok(!entry.includes("customer-bootstrap"));
  assert.ok(!entry.includes("myomaton"));
});

test("customer bootstrap creates the unchanged baseline with linked generated identities and no photo", async () => {
  const f = fixture(); await seedPlatform(f.db);
  const result = await bootstrapMyomaton(f.db);
  assert.equal(result.created, true);
  assert.equal(f.state.web_presences[0].id, result.webPresenceId);
  assert.equal(f.state.web_presences[0].organization_id, f.state.organizations[0].id);
  assert.equal(f.state.subjects[0].subject_type_id, f.state.subject_types[0].id);
  for (const table of ["subjects", "design_systems", "actions", "managed_sites", "navigations"]) {
    assert.equal(f.state[table].length, 1); assert.equal(f.state[table][0].web_presence_id, result.webPresenceId);
  }
  assert.deepEqual(f.state.design_systems[0].configuration, myomatonDesignConfiguration);
  for (const [key, value] of Object.entries(myomatonAction)) assert.equal(f.state.actions[0][key], value);
  assert.equal(f.state.pages[0].managed_site_id, f.state.managed_sites[0].id);
  assert.deepEqual(f.state.sections.map((row) => [row.type, row.name, row.sort_order]), [["hero", "Hero", 0], ["intro", "Introduction", 10], ["cta", "Primary Call to Action", 20]]);
  for (const row of f.state.sections) assert.equal(row.page_id, f.state.pages[0].id);
  const intro = f.state.sections[1], cta = f.state.sections[2];
  assert.equal((cta.content as Row).actionId, f.state.actions[0].id);
  assert.deepEqual(intro.configuration, { anchor: "about" });
  assert.deepEqual(f.state.navigation_items.map((row) => [row.navigation_id, row.target_type, row.target_reference]), [
    [f.state.navigations[0].id, "section", intro.id], [f.state.navigations[0].id, "action", f.state.actions[0].id],
  ]);
  assert.deepEqual(f.state.assets, []); assert.deepEqual(f.state.asset_usages, []);
  const before = structuredClone(f.state), writes = f.writes.length;
  assert.deepEqual(await bootstrapMyomaton(f.db), { created: false, webPresenceId: result.webPresenceId });
  assert.deepEqual(f.state, before); assert.equal(f.writes.length, writes);
});

test("existing customized/inactive state, stable IDs, legacy CTA and photograph associations remain byte-for-byte unchanged", async () => {
  const f = fixture(); await seedPlatform(f.db); const initial = await bootstrapMyomaton(f.db);
  for (const table of ["organizations", "web_presences", "subjects", "managed_sites", "pages", "sections", "design_systems", "actions", "navigations", "navigation_items"]) {
    for (const row of f.state[table]) Object.assign(row, { name: "Customized", status: "inactive", version: 8, configuration: { custom: true }, updated_at: "custom time" });
  }
  f.state.sections[1].name = "Introduction";
  f.state.sections[2].content = { heading: "Custom", actionLabel: "Learn more", actionHref: "#about" };
  f.state.assets.push({ id: randomUUID(), name: "Canonical photograph", source_reference: "private fixture bytes" });
  f.state.asset_usages.push({ asset_id: f.state.assets[0].id, entity_id: f.state.sections[1].id, role: "image" });
  const before = structuredClone(f.state), writes = f.writes.length;
  assert.equal((await bootstrapMyomaton(f.db)).webPresenceId, initial.webPresenceId);
  assert.deepEqual(f.state, before); assert.equal(f.writes.length, writes);
  f.state.web_presences[0].primary_domain = "renamed.example";
  const renamed = structuredClone(f.state);
  assert.equal((await bootstrapMyomaton(f.db, initial.webPresenceId.toUpperCase())).created, false);
  assert.deepEqual(f.state, renamed);
});

test("seed and repeated bootstrap never restore deliberately removed children or an empty existing presence", async () => {
  const f = fixture(); await seedPlatform(f.db); await bootstrapMyomaton(f.db);
  for (const table of ["subjects", "design_systems", "actions", "managed_sites", "pages", "sections", "navigations", "navigation_items"]) f.state[table].length = 0;
  const before = structuredClone(f.state);
  await seedPlatform(f.db); await bootstrapMyomaton(f.db);
  assert.deepEqual(f.state, before);
  assert.equal(f.statements.filter((sql) => /^(update|delete)/i.test(sql)).length, 0);
});

test("ambiguous, conflicting, missing explicit identities and residual organizations fail without writes", async () => {
  for (const candidates of [
    [{ name: "Myomaton", primary_domain: "myomaton.com" }, { name: "Other", primary_domain: " MYOMATON.COM " }],
    [{ name: "Myomaton", primary_domain: "new.example" }, { name: "Other", primary_domain: "myomaton.com" }],
  ]) {
    const f = fixture(); f.state.web_presences.push(...candidates.map((row) => ({ id: randomUUID(), ...row })));
    const before = structuredClone(f.state);
    await assert.rejects(bootstrapMyomaton(f.db), /Ambiguous\/conflicting/);
    assert.deepEqual(f.state, before); assert.deepEqual(f.writes, []);
  }
  const f = fixture();
  await assert.rejects(bootstrapMyomaton(f.db, "bad"), /Invalid/); assert.equal(f.statements.length, 0);
  await assert.rejects(bootstrapMyomaton(f.db, randomUUID()), /not found/);
  f.state.organizations.push({ id: randomUUID(), name: "Open Practical Robotics" });
  await assert.rejects(bootstrapMyomaton(f.db), /Refusing to recreate/);
  f.state.web_presences.push({ id: randomUUID(), name: "Myomaton" });
  await assert.rejects(bootstrapMyomaton(f.db, randomUUID()), /not found/);
  const other = randomUUID(); f.state.web_presences.push({ id: other, name: "Another customer" });
  await assert.rejects(bootstrapMyomaton(f.db, other), /Ambiguous\/conflicting/);
  assert.deepEqual(f.writes, []);
});

test("fresh initialization requires reference data and rolls back the entire customer graph on failure", async () => {
  const f = fixture();
  await assert.rejects(bootstrapMyomaton(f.db), /Subject Type is required/);
  assert.deepEqual(f.writes, []);
  await seedPlatform(f.db);
  f.state.subject_types[0].status = "inactive";
  await assert.rejects(bootstrapMyomaton(f.db), /Subject Type is required/);
  f.state.subject_types[0].status = "active";
  const before = structuredClone(f.state);
  f.failOn("navigation_items");
  await assert.rejects(bootstrapMyomaton(f.db), (error: unknown) => {
    assert.ok(error instanceof Error && error.cause instanceof Error);
    assert.equal(error.cause.message, "Forced fixture failure");
    return true;
  });
  assert.deepEqual(f.state, before);
  assert.equal(f.statements.at(-1), "rollback");
});
