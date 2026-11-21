/** Actual retained-case, no-provider readcheck. Run sequentially while only the
 * protected Core app is stopped; never authenticates an invented browser session. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, realpath, lstat } from "node:fs/promises";
import { join } from "node:path";
import { protectedRetainedSiteReader, retainedCoreAssociation } from "../../lib/platform/intake/protected-retained-site";
import { renderRetainedNativePreview } from "../../lib/platform/intake/retained-native-preview";

async function main() {
  assert.equal(process.platform, "linux");
  const home = await realpath(process.env.HOME ?? "");
  assert.equal(home, "/home/virtual/vps-bef564/e/e494602172");
  const root = join(home, "miopages-private-acceptance", "presence-evaluation", retainedCoreAssociation.sourceCaseId);
  const files = ["grant.json", "usage/onboarding-usage.json", "context.json"];
  const hashes = () => Promise.all(files.map(async file => createHash("sha256").update(await readFile(join(root, file))).digest("hex")));
  const before = await hashes();
  const reader = await protectedRetainedSiteReader(); assert.ok(reader);
  try {
    await assert.rejects(reader.read("different-owner"));
    const review = await reader.read(retainedCoreAssociation.ownerId);
    assert.equal(review.revision, 106); assert.equal(review.baselineRevision, 97);
    assert.equal(review.needsUnderstandingRefresh, false);
    assert.ok(review.report && review.direction && review.pages.length > 0);
    assert.deepEqual(review.changes.map(page => page.path).sort(), ["/", "/how-it-works", "/service"]);
    assert.ok(review.wordpress && review.wordpress.revision === 6 && review.wordpress.pages.length === 13);
    const rendered = [];
    for (const page of review.pages) {
      const input = await reader.preview(retainedCoreAssociation.ownerId, page.path, false);
      const html = await renderRetainedNativePreview(input);
      assert.ok(html.includes("default-src 'none'") && !/<script\b/iu.test(html));
      assert.ok(html.includes('aria-label="Temporary review guide"') && html.includes('not the installed WordPress site'));
      rendered.push({ path: page.path, sha256: createHash("sha256").update(html).digest("hex"), bytes: Buffer.byteLength(html) });
    }
    for (const change of review.changes) {
      const input = await reader.preview(retainedCoreAssociation.ownerId, change.path, true);
      assert.ok((await renderRetainedNativePreview(input)).length > 0);
    }
    await assert.rejects(reader.preview(retainedCoreAssociation.ownerId, "/foreign", false));
    await assert.rejects(reader.reference(retainedCoreAssociation.ownerId, "../context.json"));
    for (const image of review.referenceImages) {
      const file = await reader.reference(retainedCoreAssociation.ownerId, image.id);
      assert.ok(file.width > 0 && file.height > 0 && file.bytes.length > 0);
    }
    assert.deepEqual(await hashes(), before);
    const usage = await lstat(join(root, "usage/onboarding-usage.json")); assert.equal(usage.mode & 0o777, 0o600);
    console.log(JSON.stringify({ status: "PASS", operation: "actual-retained-core-review", revision: review.revision,
      unchangedPrivateState: true, ownerScopeRefusal: true, foreignPathRefusal: true, exactBeforeAfter: true,
      lineageVerified: true, rendered, referencesVerified: review.referenceImages.length, providerRequests: 0, databaseWrites: 0,
      ownerPasswordLoginTested: false, rssBytes: process.resourceUsage().maxRSS * 1024 }));
  } finally { await reader.close(); }
}
void main().catch(() => { console.error(JSON.stringify({ status: "BLOCKED", operation: "actual-retained-core-review", detail: "Retained projection or native renderer failed; preserve evidence, no provider dispatch." })); process.exitCode = 1; });
