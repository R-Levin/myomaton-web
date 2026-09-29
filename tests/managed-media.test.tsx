import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { prepareManagedAsset, prepareManagedBytes } from "../lib/platform/assets/ingestion";
import { managedKey, provisionManagedObject, readManagedObject } from "../lib/platform/assets/local-storage";
import { deliverPublicAsset } from "../lib/platform/assets/delivery";
import { prepareSvg } from "../lib/platform/assets/svg-ingestion";
import { apngFixture, mediaFixtures, pdfFixture } from "./helpers/managed-media";
import type { Asset } from "../lib/platform/assets/model";

test("all five formats derive MIME/type from bytes, store exact prepared bytes and deliver safely", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "managed-formats-"));
  try {
    const mimes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "application/pdf"];
    const inputs = await mediaFixtures();
    for (let i = 0; i < inputs.length; i++) {
      const file = path.join(root, "misleading.txt"); await writeFile(file, inputs[i]);
      const prepared = await prepareManagedAsset(file);
      assert.equal(prepared.mimeType, mimes[i]);
      assert.equal(prepared.type, i === 4 ? "document" : "image");
      assert.equal(prepared.sourceReference, managedKey(prepared.bytes));
      assert.equal(prepared.width, i === 4 ? null : 8); assert.equal(prepared.height, i === 4 ? null : 6);
      const asset: Asset = { id: randomUUID(), webPresenceId: randomUUID(), name: "Fixture", altText: "Fixture", status: "active", sourceType: "managed", ...prepared, configuration: {}, metadata: {}, version: 1, createdAt: new Date(), updatedAt: new Date() };
      await provisionManagedObject(root, asset.webPresenceId, prepared.sourceReference, prepared.bytes);
      assert.deepEqual(await readManagedObject(root, asset.webPresenceId, prepared.sourceReference), prepared.bytes);
      const response = await deliverPublicAsset(asset.id, async () => asset, root);
      assert.equal(response.status, 200, mimes[i]); assert.equal(response.headers.get("content-type"), mimes[i]);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; sandbox");
      assert.equal(response.headers.get("content-disposition"), i === 4 ? 'attachment; filename="document.pdf"' : "inline");
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), prepared.bytes);
      assert.equal((await deliverPublicAsset(asset.id, async () => ({ ...asset, mimeType: i === 0 ? "image/png" : "image/jpeg" }), root)).status, 404);
      assert.equal((await deliverPublicAsset(asset.id, async () => ({ ...asset, status: "inactive" }), root)).status, 404);
      if (i === 1 || i === 2) {
        const meta = await sharp(prepared.bytes).metadata(); assert.equal(meta.hasAlpha, true);
        const { data, info } = await sharp(prepared.bytes).raw().toBuffer({ resolveWithObject: true });
        assert.equal(info.channels, 4); assert.ok(data[3] > 0 && data[3] < 255);
      }
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("raster orientation, metadata stripping, unsupported/malformed and multipage rejection", async () => {
  const input = await sharp({ create: { width: 8, height: 6, channels: 3, background: "red" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const prepared = await prepareManagedBytes(input);
  assert.equal(prepared.width, 6); assert.equal(prepared.height, 8);
  const meta = await sharp(prepared.bytes).metadata(); assert.equal(meta.orientation, undefined); assert.equal(meta.exif, undefined); assert.equal(meta.icc, undefined);
  const frames = Buffer.concat([Buffer.alloc(8 * 6 * 4, 0), Buffer.alloc(8 * 6 * 4, 255)]);
  const animated = await sharp(frames, { raw: { width: 8, height: 12, pageHeight: 6, channels: 4 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
  assert.equal((await sharp(animated, { animated: true }).metadata()).pages, 2);
  await assert.rejects(prepareManagedBytes(animated), /Animated\/multipage/);
  const apng = await apngFixture();
  assert.equal((await sharp(apng).metadata()).format, "png");
  await assert.rejects(prepareManagedBytes(apng), /Animated\/multipage/);
  const mpo = Buffer.concat([input.subarray(0, 2), Buffer.from([255, 226, 0, 6, 77, 80, 70, 0]), input.subarray(2)]);
  await assert.rejects(prepareManagedBytes(mpo), /Animated\/multipage/);
  const tiff = await sharp(input).tiff().toBuffer(); await assert.rejects(prepareManagedBytes(tiff), /Unsupported/);
  for (const invalid of [Buffer.from("garbage"), input.subarray(0, 30), Buffer.from("GIF89a"), Buffer.from("%PDF-1.7\nnot a document\n%%EOF")]) await assert.rejects(prepareManagedBytes(invalid));
});

test("SVG removes active content, styles, external references and hashes sanitized bytes", async () => {
  const unsafe = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 8 6" onload="alert(1)">
    <script>alert(1)</script><style>@import 'https://evil.test/x';</style><foreignObject><div>html</div></foreignObject>
    <image href="https://evil.test/x"/><use xlink:href="https://evil.test/x#s"/><animate attributeName="href" values="javascript:alert(1)"/>
    <path d="M0 0h8v6H0z" onclick="alert(1)" style="fill:url(https://evil.test/x)" fill="url(https://evil.test/x)"/>
  </svg>`);
  const prepared = await prepareManagedBytes(unsafe);
  assert.equal(prepared.mimeType, "image/svg+xml"); assert.notEqual(prepared.sourceReference, managedKey(unsafe));
  assert.equal(prepared.sourceReference, managedKey(prepared.bytes));
  assert.doesNotMatch(prepared.bytes.toString(), /script|onload|onclick|style|foreignObject|animate|href|evil\.test/i);
  assert.deepEqual(prepareSvg(prepared.bytes).bytes, prepared.bytes);
  for (const invalid of ['<svg xmlns="http://www.w3.org/2000/svg"><path></svg>', '<html/>', '<svg/>', '<!DOCTYPE svg [<!ENTITY x "bad">]><svg xmlns="http://www.w3.org/2000/svg">&x;</svg>']) await assert.rejects(prepareManagedBytes(Buffer.from(invalid)));
});

test("PDF validation preserves accepted bytes and rejects malformed structure", async () => {
  const bytes = pdfFixture(); const prepared = await prepareManagedBytes(bytes);
  assert.deepEqual(prepared.bytes, bytes); assert.equal(prepared.width, null); assert.equal(prepared.type, "document");
  for (const invalid of [bytes.subarray(0, 80), Buffer.from("%PDF-1.7\n%%EOF"), Buffer.from("<html>not PDF</html>")]) await assert.rejects(prepareManagedBytes(invalid));
});

test("generic storage accepts format-neutral bytes without a media dependency", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "managed-bytes-"));
  try {
    const bytes = Buffer.from("validated by a future ingestion policy"); const key = managedKey(bytes); const presence = randomUUID();
    assert.match(key, /^objects\/[a-f0-9]{64}$/);
    await provisionManagedObject(root, presence, key, bytes);
    assert.deepEqual(await readManagedObject(root, presence, key), bytes);
  } finally { await rm(root, { recursive: true, force: true }); }
});
