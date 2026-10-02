import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile, mkdir, symlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { renderToStaticMarkup } from "react-dom/server";
import { managedKey, provisionManagedObject, readManagedObject } from "../lib/platform/assets/local-storage";
import { prepareManagedAsset } from "../lib/platform/assets/ingestion";
import { presentImage, requireManagedKey } from "../lib/platform/assets/source";
import { deliverPublicAsset } from "../lib/platform/assets/delivery";
import type { Asset } from "../lib/platform/assets/model";
import { SectionRenderer } from "../components/microsites/section-renderer";

const uuid = randomUUID();
const presence = randomUUID();
const jpeg = () => sharp({ create: { width: 8, height: 6, channels: 3, background: "red" } }).jpeg().toBuffer();
function row(key: string): Asset {
  return { id: uuid, webPresenceId: presence, name: "Photo", type: "image", mimeType: "image/jpeg", width: 8, height: 6,
    altText: "A project robot", status: "active", sourceType: "managed", sourceReference: key, configuration: {}, metadata: {}, version: 1, createdAt: new Date(), updatedAt: new Date() };
}

test("managed keys reject URL, absolute, traversal, encoded, backslash, and malformed inputs", () => {
  const key = `objects/${"a".repeat(64)}`;
  assert.equal(requireManagedKey(key), key);
  for (const bad of ["/" + key, "C:\\photo.jpg", "../" + key, "images/../photo.jpg", "images/%2e%2e/photo.jpg", "https://example.com/x.jpg", key + "?token=x", key + "\n", key.replace("/", "\\"), "images/a.jpg", key + ".svg"]) assert.throws(() => requireManagedKey(bad));
});

test("prepared JPEG storage is immutable, scoped, validated, and rejects filesystem escapes", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "asset-storage-"));
  try {
    const input = path.join(temp, "input.jpg");
    await writeFile(input, await jpeg());
    const photo = await prepareManagedAsset(input);
    assert.equal(photo.width, 8); assert.equal(photo.height, 6);
    const root = path.join(temp, "store");
    await provisionManagedObject(root, presence, photo.sourceReference, photo.bytes);
    await provisionManagedObject(root, presence, photo.sourceReference, photo.bytes);
    assert.deepEqual(await readManagedObject(root, presence, photo.sourceReference), photo.bytes);
    await assert.rejects(readManagedObject(root, randomUUID(), photo.sourceReference));
    await assert.rejects(readManagedObject(root, presence, "../input.jpg"));
    await assert.rejects(provisionManagedObject(root, presence, photo.sourceReference, Buffer.from("bad")));
    await writeFile(path.join(root, presence, photo.sourceReference), Buffer.from("corrupt"));
    await assert.rejects(readManagedObject(root, presence, photo.sourceReference));
    await assert.rejects(provisionManagedObject(root, presence, photo.sourceReference, photo.bytes));
    const png = path.join(temp, "input.png");
    await writeFile(png, await sharp({ create: { width: 1, height: 1, channels: 3, background: "red" } }).png().toBuffer());
    assert.equal((await prepareManagedAsset(png)).mimeType, "image/png");
    await writeFile(input, Buffer.from("not a jpeg")); await assert.rejects(prepareManagedAsset(input));
    const outside = path.join(temp, "outside"); await mkdir(outside);
    const linkedRoot = path.join(temp, "linked");
    await symlink(outside, linkedRoot, "junction");
    await assert.rejects(provisionManagedObject(linkedRoot, presence, photo.sourceReference, photo.bytes));
    const otherPresence = randomUUID();
    await symlink(outside, path.join(root, otherPresence), "junction");
    await assert.rejects(provisionManagedObject(root, otherPresence, photo.sourceReference, photo.bytes));
    const thirdPresence = randomUUID(); await mkdir(path.join(root, thirdPresence));
    await symlink(outside, path.join(root, thirdPresence, "objects"), "junction");
    await assert.rejects(provisionManagedObject(root, thirdPresence, photo.sourceReference, photo.bytes));
    // A junction at the leaf also must never be treated as a file.
    const leafPresence = randomUUID(); await mkdir(path.join(root, leafPresence, "objects"), { recursive: true });
    await symlink(outside, path.join(root, leafPresence, photo.sourceReference), "junction");
    await assert.rejects(readManagedObject(root, leafPresence, photo.sourceReference));
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test("presentation contains identity and delivery data only; renderer preserves text without an image", () => {
  const asset = row(`objects/${"a".repeat(64)}`);
  const image = presentImage(asset)!;
  assert.deepEqual(Object.keys(image).sort(), ["alt", "assetId", "height", "src", "width"]);
  assert.equal(image.src, `/media/assets/${uuid}`);
  for (const change of [{ status: "inactive" }, { type: "document" }, { mimeType: "image/gif" }, { sourceType: "url" }, { sourceReference: "/etc/passwd" }, { width: 0 }, { altText: null }]) assert.equal(presentImage({ ...asset, ...change }), null);
  const section = { id: randomUUID(), type: "intro", variant: null, name: "Intro", content: { heading: "Project", text: "Keep this text" }, configuration: {} };
  const html = renderToStaticMarkup(<SectionRenderer section={{ ...section, image }} />);
  assert.ok(html.includes('width="8"')); assert.ok(html.includes('height="6"')); assert.ok(html.includes('alt="A project robot"'));
  assert.ok(html.includes("Keep this text")); assert.ok(!html.includes(asset.sourceReference));
  const without = renderToStaticMarkup(<SectionRenderer section={section} />);
  assert.ok(without.includes("Keep this text")); assert.ok(!without.includes("<img"));
});

test("delivery hides unavailable assets and filesystem failures, serves JPEG without caching", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "asset-delivery-"));
  try {
    const bytes = await jpeg(); const asset = row(managedKey(bytes));
    await provisionManagedObject(temp, presence, asset.sourceReference, bytes);
    const response = await deliverPublicAsset(uuid, async () => asset, temp);
    assert.equal(response.status, 200); assert.equal(response.headers.get("content-type"), "image/jpeg");
    assert.equal(response.headers.get("cache-control"), "no-store"); assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    assert.equal((await deliverPublicAsset("bad", async () => { throw new Error("must not query"); }, temp)).status, 404);
    assert.equal((await deliverPublicAsset(uuid, async () => null, temp)).status, 404);
    assert.equal((await deliverPublicAsset(uuid, async () => ({ ...asset, status: "inactive" }), temp)).status, 404);
    assert.equal((await deliverPublicAsset(uuid, async () => ({ ...asset, id: randomUUID() }), temp)).status, 404);
    const missing = await deliverPublicAsset(uuid, async () => asset, path.join(temp, "missing"));
    assert.equal(missing.status, 404); assert.equal(await missing.text(), "Not found");
    const failed = await deliverPublicAsset(uuid, async () => { throw new Error("secret DB details"); }, temp);
    assert.equal(failed.status, 500); assert.equal(await failed.text(), "Unable to deliver Asset");
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test("media route binds delivery to the configured Myomaton domain, never the request Host", async () => {
  const { loadService } = await import("./helpers/load-service");
  const response = new Response("JPEG fixture");
  const route = loadService("app/media/assets/[assetId]/route.ts", {
    "@/lib/platform/microsites/deployment": await import("../lib/platform/microsites/deployment"),
    "@/lib/platform/assets/presentation-service": { getPublicAsset: async (domain: string, assetId: string) => {
      assert.equal(domain, "myomaton.com"); assert.equal(assetId, uuid); return null;
    } },
    "@/lib/platform/assets/local-storage": { assetRoot: () => "operator-root" },
    "@/lib/platform/assets/delivery": { deliverPublicAsset: async (assetId: string, lookup: (id: string) => Promise<unknown>, root: string) => {
      assert.equal(assetId, uuid); assert.equal(root, "operator-root"); await lookup(assetId); return response;
    } },
  }) as typeof import("../app/media/assets/[assetId]/route");
  assert.equal(route.runtime, "nodejs");
  assert.strictEqual(await route.GET(new Request("https://foreign.example/media/assets/" + uuid), { params: Promise.resolve({ assetId: uuid }) }), response);
});
