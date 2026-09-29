import assert from "node:assert/strict";
import { test } from "node:test";
import * as orm from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import * as model from "../lib/platform/assets/model";
import * as assetsSchema from "../lib/platform/db/schema/assets";
import * as usagesSchema from "../lib/platform/db/schema/asset-usages";
import { loadService } from "./helpers/load-service";

const tenant = "aaaaaaaa-1111-4111-8111-111111111111";
const id = "bbbbbbbb-2222-4222-8222-222222222222";
const entityId = "cccccccc-3333-4333-8333-333333333333";
const usageId = "dddddddd-4444-4444-8444-444444444444";
const timestamp = "2026-09-28T12:00:00.000Z";

function setup(query: (query: { text: string }, params: unknown[]) => Promise<{ rows: unknown[][] }>) {
  const db = drizzle({ client: { query } as unknown as Pool });
  return loadService("lib/platform/assets/service.ts", {
    "drizzle-orm": orm,
    "@/lib/platform/db/connection": { db },
    "@/lib/platform/db/schema/assets": assetsSchema,
    "@/lib/platform/db/schema/asset-usages": usagesSchema,
    "./model": model,
  }) as typeof import("../lib/platform/assets/service");
}

test("asset batch reads scope ownership, deduplicate IDs and preserve canonical data across source changes", async () => {
  let queries = 0;
  let source = "https://example.com/photo.jpg";
  let type = "image", mime = "image/jpeg";
  let width: number | null = 1600;
  const service = setup(async (query, params) => {
    queries++;
    assert.match(query.text, /from "assets"/);
    assert.match(query.text, /"assets"\."web_presence_id" = \$1/);
    assert.match(query.text, /"assets"\."id" in \(\$2\)/);
    assert.ok(!query.text.includes('"status" ='));
    assert.deepEqual(params, [tenant, id]);
    return { rows: [[id, tenant, "Project photo", type, mime, width, null, "", "inactive", "url", source, { crop: "center" }, { credit: "Customer" }, 2, timestamp, timestamp]] };
  });
  const first = (await service.getAssetsByIds(tenant.toUpperCase(), [id, id.toUpperCase()])).get(id)!;
  assert.equal(first.status, "inactive");
  assert.equal(first.width, 1600);
  assert.equal(first.height, null);
  assert.equal(first.altText, "");
  assert.equal(first.version, 2);
  assert.deepEqual(first.metadata, { credit: "Customer" });
  assert.deepEqual(first.configuration, { crop: "center" });
  assert.equal(first.createdAt.toISOString(), timestamp);
  source = "https://another.example.com/relocated.jpg";
  const moved = (await service.getAssetsByIds(tenant, [id])).get(id)!;
  assert.equal(moved.id, first.id);
  assert.equal(moved.sourceReference, source);
  type = "document"; mime = "application/pdf"; width = null;
  const document = (await service.getAssetsByIds(tenant, [id])).get(id)!;
  assert.equal(document.type, "document");
  assert.equal(document.mimeType, "application/pdf");
  assert.equal(document.width, null);
  assert.equal((await service.getAssetsByIds(tenant, [])).size, 0);
  assert.equal(queries, 3);
});

test("usage reads scope entity identity and reverse inventory without hiding inactive references", async () => {
  let reverse = false;
  const service = setup(async (query, params) => {
    assert.match(query.text, /from "asset_usages"/);
    assert.match(query.text, /"asset_usages"\."web_presence_id" = \$1/);
    assert.ok(!query.text.includes(" join "));
    assert.ok(!query.text.includes("status"));
    if (reverse) {
      assert.match(query.text, /"asset_usages"\."asset_id" = \$2/);
      assert.deepEqual(params, [tenant, id]);
    } else {
      assert.match(query.text, /"asset_usages"\."entity_type" = \$2/);
      assert.match(query.text, /"asset_usages"\."entity_id" = \$3/);
      assert.deepEqual(params, [tenant, "section", entityId]);
    }
    return { rows: [[usageId, tenant, id, "section", entityId, "hero", {}, {}, 1, timestamp, timestamp]] };
  });
  const usages = await service.getAssetUsagesByEntity(tenant, { entityType: "section", entityId });
  assert.equal(usages[0].role, "hero");
  assert.equal(usages[0].assetId, id);
  reverse = true;
  assert.deepEqual(await service.getAssetUsagesByAssetId(tenant, id), usages);
});

test("missing records are empty, but malformed inputs and database failures never imply unreferenced assets", async () => {
  let calls = 0;
  const service = setup(async () => { calls++; return { rows: [] }; });
  assert.equal((await service.getAssetsByIds(tenant, [id])).size, 0);
  assert.deepEqual(await service.getAssetUsagesByAssetId(tenant, id), []);
  assert.deepEqual(await service.getAssetUsagesByEntity(tenant, { entityType: "page", entityId }), []);
  await assert.rejects(service.getAssetsByIds("invalid", []));
  await assert.rejects(service.getAssetsByIds(tenant, [id, "invalid"]));
  await assert.rejects(service.getAssetUsagesByAssetId("invalid", id));
  await assert.rejects(service.getAssetUsagesByAssetId(tenant, "invalid"));
  await assert.rejects(service.getAssetUsagesByEntity(tenant, { entityType: "", entityId }));
  await assert.rejects(service.getAssetUsagesByEntity(tenant, { entityType: "page", entityId: "invalid" }));
  assert.equal(calls, 3);
  const failed = setup(async () => { throw new Error("Database unavailable"); });
  await assert.rejects(failed.getAssetUsagesByAssetId(tenant, id));
});
