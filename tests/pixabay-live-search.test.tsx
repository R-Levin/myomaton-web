import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { c0PixabaySearch, firstPixabaySearch } from "../scripts/pixabay-live-search";

const key = "fixture-Only-Test-Key-01234";
const response = { hits: [{ id: 23, type: "photo", user: "Fixture Creator", tags: "workbench, tools",
  pageURL: "https://pixabay.com/photos/fixture-23/", previewURL: "https://cdn.pixabay.com/photo/example.jpg",
  webformatURL: "https://pixabay.com/get/example_640.jpg", webformatWidth: 640, webformatHeight: 420 }] };
const reply = (status: number, value: unknown = response) => ({
  status, contentType: "application/json; charset=UTF-8",
  body: (async function* () { yield Buffer.from(JSON.stringify(value)); })(),
});

async function withDirectory<T>(fn: (directory: string) => Promise<T>) {
  const tmp = await realpath(tmpdir());
  const directory = await mkdtemp(path.join(tmp, "miopages-pixabay-"));
  try { return await fn(directory); }
  finally {
    assert.equal(path.dirname(directory), tmp);
    assert.equal(await realpath(directory), directory);
    assert.match(path.basename(directory), /^miopages-pixabay-/);
    await rm(directory, { recursive: true });
  }
}

test("one pinned HTTPS request, exclusive attempt, private cached receipt and inert review", () => withDirectory(async directory => {
  let calls = 0;
  const run = () => firstPixabaySearch(directory, key, async options => {
    calls++;
    assert.equal(options.hostname, "pixabay.com");
    assert.equal(options.protocol, "https:");
    assert.equal(options.method, "GET");
    assert.equal(options.rejectUnauthorized, true);
    assert.equal(options.agent, false);
    assert.ok(options.signal);
    const url = new URL(options.path!, "https://pixabay.com");
    assert.equal(url.pathname, "/api/");
    assert.equal(url.searchParams.get("key"), key);
    assert.equal(url.searchParams.get("q"), "workshop workbench");
    assert.equal(url.searchParams.get("per_page"), "8");
    return reply(200);
  });
  const results = await Promise.all([run(), run()]);
  assert.ok(results.some(result => result.status === "PASS"));
  assert.ok(results.some(result => result.status === "BLOCKED" && result.code === "attempt_already_recorded"));
  assert.equal(calls, 1);
  const receipt = JSON.parse(await readFile(path.join(directory, "result.json"), "utf8"));
  assert.equal(receipt.providerRequests, 1);
  assert.equal(receipt.httpStatus, 200);
  assert.equal(receipt.results[0].description, "workbench, tools");
  assert.equal(receipt.results[0].creator, "Fixture Creator");
  assert.ok(receipt.expiresAt - Date.parse(receipt.fetchedAt) > 86_399_000);
  const html = await readFile(path.join(directory, "review.html"), "utf8");
  assert.match(html, /https:\/\/pixabay.com\/photos\/fixture-23\//);
  assert.doesNotMatch(html, /<img|<script|<iframe/);
  for (const file of await readdir(directory)) assert.ok(!(await readFile(path.join(directory, file), "utf8")).includes(key));
}));

test("refusals and redirects consume the attempt without reading provider error text or retrying", async () => {
  for (const status of [302, 401, 403, 429, 503]) await withDirectory(async directory => {
    let calls = 0;
    const run = () => firstPixabaySearch(directory, key, async () => {
      calls++;
      return { status, body: (async function* () { assert.fail("Unexpected read of provider error body"); yield Buffer.alloc(0); })() };
    });
    assert.deepEqual(await run(), { status: "BLOCKED", code: "http_" + status, stage: "response_validation", httpStatus: status });
    assert.deepEqual(await run(), { status: "BLOCKED", code: "attempt_already_recorded" });
    assert.equal(calls, 1);
  });
});

test("C0 search uses its pinned human query and the same one-attempt gate", () => withDirectory(async directory => {
  const run = () => c0PixabaySearch(directory, key, async options => {
    const url = new URL(options.path!, "https://pixabay.com");
    assert.equal(url.searchParams.get("q"), "small business laptop");
    assert.equal(url.searchParams.get("safesearch"), "true");
    return reply(200);
  });
  assert.equal((await run()).status, "PASS");
  assert.deepEqual(await run(), { status: "BLOCKED", code: "attempt_already_recorded" });
  assert.equal(JSON.parse(await readFile(path.join(directory, "attempt.json"), "utf8")).maximumRequests, 1);
}));

test("invalid key, reflected secret, invalid or oversized success response leave no result or review", async () => {
  await withDirectory(async directory => {
    assert.deepEqual(await firstPixabaySearch(directory, "", async () => assert.fail("Invalid key must refuse before transport")), { status: "BLOCKED", code: "invalid_local_key_format" });
    assert.deepEqual(await readdir(directory), []);
  });
  for (const [value, expected] of [
    [{ hits: [{ ...response.hits[0], tags: key }] }, "credential_reflected"],
    [{ hits: [{ id: 23 }] }, "unsupported_search_response"],
    ["x".repeat(130 * 1024), "response_too_large"],
  ] as const) await withDirectory(async directory => {
    const result = await firstPixabaySearch(directory, key, async () => reply(200, value));
    assert.equal(result.status === "BLOCKED" && result.code, expected);
    assert.deepEqual((await readdir(directory)).sort(), ["attempt.json", "failure.json"]);
    assert.ok(!(await readFile(path.join(directory, "failure.json"), "utf8")).includes(key));
  });
});
