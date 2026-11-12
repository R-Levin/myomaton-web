import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { verifyNativeDraftReceipt, type NativeDraftReceiptExpectation } from "../../lib/platform/wordpress-delivery/native-draft-receipt";

test("PHP native draft receipts authenticate exact Core apply and restore readback", () => {
  const key = randomBytes(32), installationId = randomUUID(), siteProposalId = randomUUID();
  const one = "1".repeat(64), two = "2".repeat(64);
  const posts = { "/": { ID: 14, post_status: "draft", post_content: "Home" },
    "/service": { ID: 15, post_status: "draft", post_content: "Service" } };
  for (const operation of ["apply", "restore"] as const) {
    const expected: NativeDraftReceiptExpectation = { installationId, siteProposalId, operation, requestedDigest: two,
      appliedDigest: operation === "apply" ? two : one, revision: operation === "apply" ? 2 : 1, paths: ["/", "/service"] };
    const makeReceipt = (readback = posts) => {
      const result = { installationId, operation, requestedDigest: two,
        applied: { siteProposalId, digest: expected.appliedDigest, revision: expected.revision, posts: readback } };
      const php = spawnSync("php", ["wordpress/miopages-delivery/tests/native-draft-receipt.php"],
        { encoding: "utf8", input: JSON.stringify({ result, key: key.toString("hex") }) });
      assert.equal(php.status, 0, php.stderr);
      return JSON.parse(php.stdout);
    };
    const receipt = makeReceipt();
    const verified = verifyNativeDraftReceipt(receipt, key, expected);
    assert.deepEqual(verified.posts.map(post => post.id), [14, 15]);
    assert.equal(verified.posts[1].contentSha256, createHash("sha256").update("Service").digest("hex"));
    assert.throws(() => verifyNativeDraftReceipt(receipt, randomBytes(32), expected), /authentication/);
    assert.throws(() => verifyNativeDraftReceipt(receipt, key, { ...expected, installationId: randomUUID() }), /decision mismatch/);
    assert.throws(() => verifyNativeDraftReceipt(receipt, key, { ...expected, paths: ["/service", "/"] }), /post mismatch/);
    assert.throws(() => verifyNativeDraftReceipt(makeReceipt({ ...posts, "/service": { ...posts["/service"], ID: 14 } }), key, expected), /Duplicate/);
    assert.throws(() => verifyNativeDraftReceipt(makeReceipt({ ...posts, "/service": { ...posts["/service"], post_status: "publish" } }), key, expected), /post mismatch/);
  }
});
