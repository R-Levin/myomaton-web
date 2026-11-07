import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { acquireForReview, prepareSelectedJpeg } from "../scripts/pixabay-placement-review";

const representation = { id: "webformat", url: "https://pixabay.com/get/fixture_640.jpg", width: 640, height: 426 };
const jpeg = () => sharp({ create: { width: 640, height: 426, channels: 3, background: "#fbf7ef" } }).jpeg().toBuffer();

test("prepares exact selected JPEG through the existing safe image pipeline", async () => {
  const source = await jpeg();
  let requests = 0;
  const image = await prepareSelectedJpeg(representation, async (url, options) => {
    requests++;
    assert.equal(String(url), representation.url);
    assert.equal(options?.method, "GET");
    assert.equal(options?.redirect, "error");
    assert.ok(options?.signal);
    return new Response(new Uint8Array(source), { headers: { "content-type": "image/jpeg" } });
  });
  assert.equal(requests, 1);
  assert.match(image.sourceSha256, /^[a-f0-9]{64}$/);
  assert.match(image.preparedSha256, /^[a-f0-9]{64}$/);
  const metadata = await sharp(image.bytes).metadata();
  assert.deepEqual([metadata.format, metadata.width, metadata.height], ["jpeg", 640, 426]);
});

test("refuses substituted endpoints, redirects, oversized replies and mismatched image content", async () => {
  for (const url of ["http://pixabay.com/get/fixture_640.jpg", "https://pixabay.com/get/fixture_640.jpg?key=fixture", "https://pixabay.com.evil.test/get/fixture_640.jpg"]) {
    await assert.rejects(prepareSelectedJpeg({ ...representation, url }, async () => assert.fail("network called")), /unexpected_image_endpoint/);
  }
  const headers = { "content-type": "image/jpeg" };
  await assert.rejects(prepareSelectedJpeg(representation, async () => new Response(null, { status: 302 })), /unexpected_image_response/);
  await assert.rejects(prepareSelectedJpeg(representation, async () => new Response(new Uint8Array(1024 * 1024 + 1), { headers })), /image_response_too_large/);
  await assert.rejects(prepareSelectedJpeg(representation, async () => new Response("<html>wrong format</html>", { headers })));
  const source = await jpeg();
  await assert.rejects(prepareSelectedJpeg({ ...representation, height: 425 }, async () => new Response(new Uint8Array(source), { headers })), /dimensions differ/);
});

test("requires exact confirmation and live cached representation, with only one exclusive attempt", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "miopages-placement-"));
  const review = { planDigest: "fixture", plan: { expiresAt: 50 }, hit: { representation } };
  let calls = 0;
  const send = async () => { calls++; return new Response(null, { status: 403 }); };
  try {
    await assert.rejects(acquireForReview(directory, review, "different", send, 49), /exact_plan_confirmation_required/);
    await assert.rejects(acquireForReview(directory, review, "fixture", send, 50), /search_representation_expired/);
    assert.deepEqual(await readdir(directory), []);
    await assert.rejects(acquireForReview(directory, review, "fixture", send, 49), /unexpected_image_response/);
    await assert.rejects(acquireForReview(directory, review, "fixture", send, 49), { code: "EEXIST" });
    assert.equal(calls, 1);
  } finally {
    await rm(path.join(directory, "download-attempt.json"), { force: true });
    await rmdir(directory);
  }
});
