import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { NativeDraftReceiptJournal, verifyNativeDraftReceipt, type NativeDraftReceiptExpectation } from "../../lib/platform/wordpress-delivery/native-draft-receipt";

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

test("the protected Core journal accepts exact retries and checks restore against prior native post IDs and hashes", async () => {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "miopages-receipt-"));
  try {
    const journal = new NativeDraftReceiptJournal(root);
    const key = randomBytes(32), installationId = randomUUID(), siteProposalId = randomUUID();
    const one = "1".repeat(64), two = "2".repeat(64);
    const expected: NativeDraftReceiptExpectation = { installationId, siteProposalId, operation: "apply",
      requestedDigest: one, appliedDigest: one, revision: 1, paths: ["/"] };
    const restore: NativeDraftReceiptExpectation = { ...expected, operation: "restore", requestedDigest: two };
    const receipt = (decision: NativeDraftReceiptExpectation, id: number) => {
      const php = spawnSync("php", ["wordpress/miopages-delivery/tests/native-draft-receipt.php"], { encoding: "utf8",
        input: JSON.stringify({ key: key.toString("hex"), result: { ...decision, applied: { siteProposalId, digest: decision.appliedDigest, revision: decision.revision,
          posts: { "/": { ID: id, post_status: "draft", post_content: "Home" } } } } }) });
      assert.equal(php.status, 0, php.stderr);
      return JSON.parse(php.stdout);
    };
    await assert.rejects(journal.record(restore, key, receipt(restore, 14)), { code: "ENOENT" });
    const applied = receipt(expected, 14);
    const result = await journal.record(expected, key, applied);
    assert.deepEqual(await journal.record(expected, key, applied), result);
    await assert.rejects(journal.record(expected, key, receipt(expected, 15)), /Conflicting/);
    const newer = { ...expected, requestedDigest: two, appliedDigest: two, revision: 2 };
    await journal.record(newer, key, receipt(newer, 23));
    await assert.rejects(journal.record(restore, key, receipt(restore, 15)), /differs from previous/);
    assert.deepEqual((await journal.record(restore, key, receipt(restore, 14))).posts, result.posts);
  } finally { await rm(root, { recursive: true, force: true }); }
});
