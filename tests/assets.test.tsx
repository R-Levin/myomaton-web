import assert from "node:assert/strict";
import { test } from "node:test";
import { getTableName } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { assets } from "../lib/platform/db/schema/assets";
import { assetUsages } from "../lib/platform/db/schema/asset-usages";
import { requireAssetEntityType, requireAssetUuid } from "../lib/platform/assets/model";

const uuid = "AAAAAAAA-1111-4111-8111-111111111111";

test("canonical query identifiers reject malformed inputs instead of implying no references", () => {
  assert.equal(requireAssetUuid(uuid), uuid.toLowerCase());
  for (const value of [null, undefined, 1, "", "not-a-uuid", ` ${uuid}`, `${uuid}\n`]) {
    assert.throws(() => requireAssetUuid(value));
  }
  for (const type of ["page", "section", "subject", "web_presence", "future_entity"]) {
    assert.equal(requireAssetEntityType(type), type);
  }
  for (const value of [null, [], 1, "", " ", " page"]) assert.throws(() => requireAssetEntityType(value));
});

test("asset schema separates UUID identity from nonunique source and supports optional dimensions", () => {
  const config = getTableConfig(assets);
  assert.equal(assets.id.primary, true);
  assert.equal(assets.id.hasDefault, true);
  assert.equal(assets.type.default, "image");
  assert.equal(assets.type.enumValues, undefined);
  assert.equal(assets.sourceType.enumValues, undefined);
  assert.equal(assets.status.default, "active");
  for (const column of [assets.width, assets.height, assets.altText]) assert.equal(column.notNull, false);
  assert.deepEqual(config.uniqueConstraints.map((constraint) => constraint.columns.map((column) => column.name)), [["web_presence_id", "id"]]);
  assert.equal(getTableName(config.foreignKeys[0].reference().foreignTable), "web_presences");
  const dialect = new PgDialect();
  for (const dimension of ["width", "height"]) {
    const check = config.checks.find((check) => check.name === `assets_${dimension}_positive`)!;
    assert.match(dialect.sqlToQuery(check.value).sql, new RegExp(`"${dimension}" IS NULL OR .*"${dimension}" > 0`));
  }
});

test("usage schema enforces same-presence asset ownership, blocks referenced deletion and indexes reverse lookups", () => {
  const config = getTableConfig(assetUsages);
  const fk = config.foreignKeys[0];
  assert.deepEqual(fk.reference().columns.map((column) => column.name), ["web_presence_id", "asset_id"]);
  assert.deepEqual(fk.reference().foreignColumns.map((column) => column.name), ["web_presence_id", "id"]);
  assert.equal(fk.reference().foreignTable, assets);
  assert.equal(fk.onDelete, "no action");
  assert.deepEqual(config.uniqueConstraints[0].columns.map((column) => column.name), ["web_presence_id", "entity_type", "entity_id", "role", "asset_id"]);
  assert.equal(config.indexes[0].config.name, "asset_usages_web_presence_asset_idx");
  assert.ok(!config.columns.some((column) => ["status", "deleted_at"].includes(column.name)));
});
