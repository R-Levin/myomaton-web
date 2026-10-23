import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { bootstrapFiles, pg17RenamePlan } from "../scripts/db/bootstrap";

test("0006 adapter pins the complete historical body and omits only its PG18 name-only suffix", () => {
  const migration = bootstrapFiles()[6], plan = pg17RenamePlan(migration, 17);
  assert.equal(plan.originalHash, "916b37ef27eba28149f1093a170993026f080a5258276d59c30180d1c2a83180");
  assert.equal(createHash("sha256").update(readFileSync("lib/platform/db/migrations/0006_managed-site-terminology.sql")).digest("hex"), plan.originalHash);
  const cut = migration.sql[0].indexOf("  -- PostgreSQL 18 stores named NOT NULL constraints");
  assert.equal(plan.sql, migration.sql[0].slice(0, cut) + "END $$;\n");
  for (const statement of ["LOCK TABLE", "Legacy surfaces.microsite", 'RENAME TO "managed_sites"', 'RENAME COLUMN "microsite_id"', 'TO "managed_sites_pkey"', 'TO "managed_sites_web_presence_id_web_presences_id_fk"', 'TO "pages_managed_site_id_managed_sites_id_fk"', 'TO "pages_managed_site_id_slug_unique"']) assert.ok(plan.sql.includes(statement));
  assert.notEqual(plan.executedHash, plan.originalHash);
});
test("bootstrap exception rejects changed hashes, extra statements and unsupported execution majors", () => {
  const migration = bootstrapFiles()[6];
  for (const major of [16, 18, 19, 0]) assert.throws(() => pg17RenamePlan(migration, major));
  assert.throws(() => pg17RenamePlan({ ...migration, hash: "0".repeat(64) }, 17));
  assert.throws(() => pg17RenamePlan({ ...migration, sql: [...migration.sql, "SELECT 1"] }, 17));
  assert.throws(() => pg17RenamePlan({ ...migration, sql: [migration.sql[0].replace("LOCK TABLE", "-- Unrelated rewrite\nLOCK TABLE")] }, 17));
  assert.throws(() => pg17RenamePlan({ ...migration, folderMillis: 1 }, 17));
});
