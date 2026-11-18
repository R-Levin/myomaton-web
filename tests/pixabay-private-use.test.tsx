import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import { downloadPixabaySelection, pixabayPrivateSelection } from "../lib/platform/acquisition/pixabay-download";
import { eligibleStock, stockPolicyFor } from "../lib/platform/acquisition/stock";
import { privateStockSearchCache } from "../lib/platform/acquisition/stock-search-cache";
import { StockDiscovery, type StockSearchHit } from "../lib/platform/acquisition/stock-discovery";

const target = { webPresenceId: "11111111-1111-4111-8111-111111111111", managedSiteId: "22222222-2222-4222-8222-222222222222",
  pageId: "33333333-3333-4333-8333-333333333333", sectionId: "44444444-4444-4444-8444-444444444444" };
const hit: StockSearchHit = { provider: "pixabay", sourceId: "99999999", sourceUrl: "https://pixabay.com/photos/synthetic-fixture-99999999/",
  creator: "Offline fixture only", previewUrl: "https://cdn.pixabay.com/photo/fixture.png",
  representation: { id: "webformat", url: "https://cdn.pixabay.com/photo/fixture.jpg", width: 20, height: 12 } };

test("private Pixabay acquisition validates actual JPEG bytes, converts through safe ingestion and preserves both digests", async () => {
  const bytes = await sharp({ create: { width: 20, height: 12, channels: 3, background: "#abc" } }).jpeg().toBuffer();
  let allowed = 0;
  const acquired = await downloadPixabaySelection(hit, async () => { allowed++; },
    async (_url, init) => {
      assert.equal(init?.redirect, "error");
      return new Response(bytes, { headers: { "content-type": "image/jpeg" } });
    });
  assert.equal(allowed, 2);
  assert.equal(acquired.prepared.mimeType, "image/png");
  assert.notEqual(acquired.sourceSha256, acquired.preparedSha256);
  const selection = pixabayPrivateSelection(hit, acquired.sourceSha256, new Date(Date.now() + 60_000).toISOString());
  assert.equal(stockPolicyFor(selection), "disposable-pixabay/1");
  assert.equal(selection.license.use, "isolated-private-site-evaluation");
  assert.throws(() => eligibleStock({ ...selection, license: { ...selection.license, use: "public-unrestricted" } }));
  for (const id of ["384740", "6389104", "7642551"]) {
    assert.throws(() => pixabayPrivateSelection({ ...hit, sourceId: id, sourceUrl: "https://pixabay.com/photos/fixture-" + id + "/" },
      acquired.sourceSha256, selection.license.expiresAt));
  }
  await assert.rejects(downloadPixabaySelection({ ...hit, representation: { ...hit.representation, url: "https://foreign.example/file.jpg" } }, async () => {}));
  await assert.rejects(downloadPixabaySelection(hit, async () => {}, async () =>
    new Response(bytes, { headers: { "content-type": "text/html" } })));
});

test("a restarted stock discovery reuses the private 24-hour result and reauthorizes its placement", async () => {
  const root = await mkdtemp(join(tmpdir(), "miopages-pixabay-cache-"));
  try {
    let requests = 0, authorityChecks = 0;
    const provider = { credit: { label: "Images from Pixabay", url: "https://pixabay.com/" },
      search: async () => { requests++; return [hit]; } };
    const authority = { authorize: async () => { authorityChecks++; return { operatorId: "fixture", authorityReference: "offline-only" }; } };
    const first = new StockDiscovery(provider, authority, privateStockSearchCache(root));
    const initial = await first.search({}, target, "fixture illustration");
    const resumed = new StockDiscovery(provider, authority, privateStockSearchCache(root));
    const result = await resumed.search({}, target, "fixture illustration");
    assert.equal(requests, 1);
    assert.equal(authorityChecks, 2);
    assert.deepEqual(result.results, initial.results);
    assert.equal(result.expiresAt, initial.expiresAt);
    assert.equal((await resumed.select({}, target, result.query, hit.sourceId, result.results[0].digest)).state, "requires-rights-review");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("download custody retains a mismatched provider raster before validation without making it eligible", async()=>{
  const bytes=await sharp({create:{width:20,height:13,channels:3,background:"#abc"}}).jpeg().toBuffer();
  let retained:Buffer|undefined;
  await assert.rejects(downloadPixabaySelection(hit,async()=>{},async()=>new Response(bytes,{headers:{"content-type":"image/jpeg"}}),
    async(source,mime)=>{assert.equal(mime,"image/jpeg");retained=source}),/dimensions differ/);
  assert.deepEqual(retained,bytes);
});
