import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { generateDrizzleJson } from "drizzle-kit/api";
import { visibleOnSurface } from "../lib/platform/navigations/model";
import { baseline } from "../scripts/customer-updates/myomaton-home-v1";

// Immutable historical evidence: old terminology here is intentional.
const historicalHashes = {
  "scripts/customer-updates/myomaton-home-v1-baseline.json": "dc80495e2360624250750dd0eea24f355c361b578cdecb8731de17543c780c44",
  "lib/platform/db/migrations/0000_initial-foundation.sql": "44f936f11b8d7498c653af3b6e83fe068d4dd756d0ba83c091bb6dffd117b924",
  "lib/platform/db/migrations/0001_microsite-foundation.sql": "6f0c72eb9c90c40a28bcf351bb6ff8d0c8c8b3578a3a0d11e647aae9d113f271",
  "lib/platform/db/migrations/0002_design-system-foundation.sql": "2b06b4efc9758157bafd963bf4eec625eaa7d22eb967b83fa85b80a5ba7c32e3",
  "lib/platform/db/migrations/0003_action-foundation.sql": "31ad42ead532fbbd0eec60c265c535df069509710c8e6f28e6aff1137fa29a01",
  "lib/platform/db/migrations/0004_navigation-foundation.sql": "9b7da026fdcdb6e1c8d0f88072da44b5424d5184ec7204744f77cd0fe80f444d",
  "lib/platform/db/migrations/0005_asset-foundation.sql": "69f0886e36a64ede3f4ad5fd00e2477d779215b57e447712d7f8ddc2b0a20b8c",
  "lib/platform/db/migrations/meta/0000_snapshot.json": "f600b3b11a51ce813342b0303b7573dcc6c4ca25da9fb9c4717258db4fe25c3b",
  "lib/platform/db/migrations/meta/0001_snapshot.json": "ec27ec7db51ae3691e61ca4318a46a63279779b068f71ef6d2bad39f366e63a9",
  "lib/platform/db/migrations/meta/0002_snapshot.json": "5eb7dfb3e3d0f32faaf7815a8d364b055c7ddfe4c470b1f86cc9c09c558663d0",
  "lib/platform/db/migrations/meta/0003_snapshot.json": "4585eb99d529442a898e352ef7e9f594a39a891b39c5368a2e7b64e0ee822e34",
  "lib/platform/db/migrations/meta/0004_snapshot.json": "0fb5e238759bc914bcf5079cce2bb2bfbfeb704d20708040c90a71b912b37b15",
  "lib/platform/db/migrations/meta/0005_snapshot.json": "743004aa2727ea6229d2db4da231d7fcfb6151355f25ca3a7045e4593dfd1d40"
};
const historicalJournal = [
  {
    "idx": 0,
    "version": "7",
    "when": 1790522828994,
    "tag": "0000_initial-foundation",
    "breakpoints": true
  },
  {
    "idx": 1,
    "version": "7",
    "when": 1790525683157,
    "tag": "0001_microsite-foundation",
    "breakpoints": true
  },
  {
    "idx": 2,
    "version": "7",
    "when": 1790537698702,
    "tag": "0002_design-system-foundation",
    "breakpoints": true
  },
  {
    "idx": 3,
    "version": "7",
    "when": 1790558322905,
    "tag": "0003_action-foundation",
    "breakpoints": true
  },
  {
    "idx": 4,
    "version": "7",
    "when": 1790600904099,
    "tag": "0004_navigation-foundation",
    "breakpoints": true
  },
  {
    "idx": 5,
    "version": "7",
    "when": 1790641266624,
    "tag": "0005_asset-foundation",
    "breakpoints": true
  }
];

test("historical migrations, snapshots, journal entries and frozen Home v1 evidence are unchanged", () => {
  for (const [file, hash] of Object.entries(historicalHashes)) {
    assert.equal(createHash("sha256").update(readFileSync(file)).digest("hex"), hash, file);
  }
  const journal = JSON.parse(readFileSync("lib/platform/db/migrations/meta/_journal.json", "utf8"));
  assert.deepEqual(journal.entries.slice(0, 6), historicalJournal); assert.equal(journal.entries.length, 7);
  const old = JSON.parse(readFileSync("scripts/customer-updates/myomaton-home-v1-baseline.json", "utf8"));
  const { microsites, ...rest } = old;
  assert.deepEqual(baseline, { ...rest, managed_sites: microsites,
    pages: old.pages.map(({ microsite_id, ...p }: Record<string, unknown>) => ({ ...p, managed_site_id: microsite_id })),
  });
});

test("new Drizzle snapshot exactly matches the renamed active schema and links to 0005", async () => {
  const imports: Record<string, unknown> = {};
  for (const file of readdirSync("lib/platform/db/schema").filter(f => f.endsWith(".ts"))) {
    Object.assign(imports, await import(pathToFileURL(resolve("lib/platform/db/schema", file)).href));
  }
  const previous = JSON.parse(readFileSync("lib/platform/db/migrations/meta/0005_snapshot.json", "utf8"));
  const snapshot = JSON.parse(readFileSync("lib/platform/db/migrations/meta/0006_snapshot.json", "utf8"));
  const generated = generateDrizzleJson(imports, previous.id);
  assert.deepEqual(JSON.parse(JSON.stringify({ ...generated, id: snapshot.id })), snapshot);
  assert.equal(snapshot.prevId, previous.id);
  assert.ok(snapshot.tables["public.managed_sites"]);
  assert.ok(snapshot.tables["public.pages"].columns.managed_site_id);
  assert.ok(!JSON.stringify(snapshot).includes("microsite"));
});

test("managedSite visibility is explicit; legacy serialized visibility fails closed on both surfaces", () => {
  assert.equal(visibleOnSurface({ surfaces: { managedSite: false } }, "managedSite"), false);
  assert.equal(visibleOnSurface({ surfaces: { managedSite: false } }, "content"), true);
  for (const legacy of [true, false, null]) for (const surface of ["managedSite", "content"] as const) {
    assert.equal(visibleOnSurface({ surfaces: { microsite: legacy } }, surface), false);
    assert.equal(visibleOnSurface({ surfaces: { microsite: legacy, managedSite: true } }, surface), false);
  }
});
