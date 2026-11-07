import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { pixabaySearch } from "../lib/platform/acquisition/pixabay";
import { StockDiscovery } from "../lib/platform/acquisition/stock-discovery";
import { eligibleStock } from "../lib/platform/acquisition/stock";

// Synthetic replay using the official Pixabay image-search response shape.
// URLs and ID here are test values. Neither the adapter nor the test fetches them.
const recorded = { total: 1, totalHits: 1, hits: [{
  id: 123456789, type: "photo", pageURL: "https://pixabay.com/photos/example-fixture-123456789/",
  user: "Fixture Photographer", previewURL: "https://cdn.pixabay.com/photo/example_150.jpg",
  webformatURL: "https://pixabay.com/get/example_640.jpg", webformatWidth: 640, webformatHeight: 420,
  largeImageURL: "https://pixabay.com/get/example_1280.jpg", views: 5,
}] };
const scope = () => ({ webPresenceId: randomUUID(), managedSiteId: randomUUID(), pageId: randomUUID(), sectionId: randomUUID() });

test("one scoped human search yields bounded credited results and an exact draft selection", async () => {
  const first = scope(), second = scope(), grants = new Map([[{}, first], [{}, second]]);
  const [operator, otherOperator] = [...grants.keys()];
  const requests: Record<string, string>[] = [];
  const discovery = new StockDiscovery(pixabaySearch(async params => {
    requests.push(Object.fromEntries(params));
    return { status: 200, body: recorded };
  }), { async authorize(context, operation, placement) {
    assert.equal(operation, "receive-supplied-media");
    assert.ok(grants.has(context as object), "No Operator authority");
    assert.deepEqual(placement, grants.get(context as object));
    return { operatorId: "synthetic operator", authorityReference: "scoped search proof" };
  } });
  await assert.rejects(discovery.search({}, first, "Workshop"), /No Operator authority/);
  await assert.rejects(discovery.search(operator, second, "Workshop"));
  await assert.rejects(discovery.search(operator, first, "x".repeat(101)), /Invalid canonical text/);
  assert.equal(requests.length, 0);
  const [a, b] = await Promise.all([
    discovery.search(operator, first, "  WORKSHOP  tools "), discovery.search(operator, first, "workshop tools"),
  ]);
  assert.deepEqual(a, b);
  assert.deepEqual(requests, [{ q: "workshop tools", image_type: "photo", safesearch: "true", per_page: "8", page: "1" }]);
  assert.deepEqual(a.credit, { label: "Images from Pixabay", url: "https://pixabay.com/" });
  const [hit] = a.results;
  assert.equal(hit.sourceId, "123456789");
  assert.equal(hit.creator, "Fixture Photographer");
  assert.equal(hit.sourceUrl, recorded.hits[0].pageURL);
  assert.deepEqual(hit.representation, { id: "webformat", url: recorded.hits[0].webformatURL, width: 640, height: 420 });
  await assert.rejects(discovery.select(operator, first, a.query, hit.sourceId, "0".repeat(64)), /Exact reviewed/);
  await assert.rejects(discovery.select(otherOperator, second, a.query, hit.sourceId, hit.digest), /Current reviewed/);
  const draft = await discovery.select(operator, first, a.query, hit.sourceId, hit.digest);
  assert.deepEqual(draft.placement, first);
  assert.equal(draft.state, "requires-rights-review");
  assert.throws(() => eligibleStock(draft.selection));
  a.results[0].representation.url = "https://example.invalid/changed.jpg";
  assert.deepEqual(await discovery.select(operator, first, b.query, hit.sourceId, hit.digest), draft);
  await discovery.search(otherOperator, second, b.query);
  assert.equal(requests.length, 1);
});

test("cache serves a normalized search for exactly 24 hours and selection does not refresh it", async t => {
  const at = new Date("2026-11-07T12:00:00.000Z");
  t.mock.timers.enable({ apis: ["Date"], now: at });
  const target = scope();
  let requests = 0;
  const discovery = new StockDiscovery(pixabaySearch(async () => {
    requests++;
    return { status: 200, body: recorded };
  }), { async authorize() { return { operatorId: "fixture", authorityReference: "fixture" }; } });
  const first = await discovery.search({}, target, "Workshop");
  assert.equal(first.expiresAt, at.getTime() + 86_400_000);
  t.mock.timers.tick(86_399_999);
  assert.deepEqual(await discovery.search({}, target, "workshop"), first);
  t.mock.timers.tick(1);
  await assert.rejects(discovery.select({}, target, "workshop", first.results[0].sourceId, first.results[0].digest), /Current reviewed/);
  assert.equal(requests, 1);
  await discovery.search({}, target, "workshop");
  assert.equal(requests, 2);
});

test("rejects malformed, foreign and unbounded responses with one request per action", async () => {
  for (const status of [401, 403, 429, 503]) {
    let calls = 0;
    const provider = pixabaySearch(async () => { calls++; return { status, body: "SECRET PROVIDER BODY" }; });
    await assert.rejects(provider.search("tools"), (error: Error) => /Pixabay/.test(error.message) && !error.message.includes("SECRET"));
    assert.equal(calls, 1);
  }
  const valid = recorded.hits[0];
  for (const hits of [
    [{ ...valid, previewURL: "http://127.0.0.1/photo/example.jpg" }],
    [{ ...valid, webformatURL: "https://pixabay.com.evil.invalid/get/example.jpg" }],
    [{ ...valid, pageURL: "https://pixabay.com/photos/other-123/" }],
    [{ ...valid, webformatWidth: 641 }],
    [{ ...valid, type: "vector" }],
    [valid, valid], Array(9).fill(valid),
  ]) await assert.rejects(pixabaySearch(async () => ({ status: 200, body: { hits } })).search("tools"));
  assert.deepEqual(await pixabaySearch(async () => ({ status: 200, body: { hits: [] } })).search("tools"), []);
});
