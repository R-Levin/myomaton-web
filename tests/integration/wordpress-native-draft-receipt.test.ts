import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { NativeDraftReceiptJournal, verifyNativeDraftReceipt, type NativeDraftReceiptExpectation } from "../../lib/platform/wordpress-delivery/native-draft-receipt";
import { nativeDraftEnvelope, readNativeDraftEnvelope } from "../../lib/platform/wordpress-delivery/native-draft-envelope";
import { bindSiteDraft } from "../../lib/platform/wordpress-delivery/site-draft";
import { PrivateReleaseReview } from "../../lib/platform/wordpress-delivery/private-source";
import type { ProtectedOperator } from "../../lib/platform/wordpress-delivery/operator";
import { fingerprint } from "../../lib/platform/canonical/model";

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
    const one = "1".repeat(64), two = "2".repeat(64), three = "3".repeat(64);
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
    const materializedBaseline = { requestedDigest: two, appliedDigest: one, revision: 1 };
    assert.deepEqual((await journal.verifyMaterializedBaseline({ ...expected, ...materializedBaseline }, key)).posts, result.posts);
    await assert.rejects(journal.verifyMaterializedBaseline({ ...expected, ...materializedBaseline, requestedDigest: three }, key), { code: "ENOENT" });
    const forward = { ...expected, revision: 3, requestedDigest: three, appliedDigest: three, materializedBaseline };
    await assert.rejects(journal.record(forward, key, receipt(forward, 23)), /materialized Page identities/);
    await journal.record(forward, key, receipt(forward, 14));
    const recover = { ...restore, requestedDigest: three, requestedRevision: 3 };
    assert.deepEqual((await journal.record(recover, key, receipt(recover, 14))).posts, result.posts);
    await assert.rejects(journal.record({ ...recover, requestedRevision: 2 }, key, receipt(recover, 14)), /decision mismatch/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Core reconciles a changed Page set against its retained receipt and restores the exact prior membership", async () => {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "miopages-membership-receipt-"));
  try {
    const journal = new NativeDraftReceiptJournal(root);
    const key = randomBytes(32), installationId = randomUUID(), siteProposalId = randomUUID();
    const prior = "a".repeat(64), proposed = "b".repeat(64);
    const first: NativeDraftReceiptExpectation = { installationId, siteProposalId, operation: "apply",
      requestedDigest: prior, appliedDigest: prior, revision: 1, paths: ["/", "/historical"] };
    const apply: NativeDraftReceiptExpectation = { ...first, requestedDigest: proposed, appliedDigest: proposed, revision: 2,
      paths: ["/new", "/"], baselinePaths: first.paths, appliedBaseline: prior };
    const restore: NativeDraftReceiptExpectation = { ...first, operation: "restore", requestedDigest: proposed,
      requestedPaths: apply.paths, requestedRevision: 2 };
    const receipt = (selection: NativeDraftReceiptExpectation, ids: number[]) => {
      const response = spawnSync("php", ["wordpress/miopages-delivery/tests/native-draft-receipt.php"], { encoding: "utf8",
        input: JSON.stringify({ key: key.toString("hex"), result: {
          ...selection, applied: { siteProposalId, digest: selection.appliedDigest, revision: selection.revision,
            posts: Object.fromEntries(selection.paths.map((route, index) => [route, { ID: ids[index], post_status: "draft", post_content: route }])) },
        } }) });
      assert.equal(response.status, 0, response.stderr);
      return JSON.parse(response.stdout);
    };
    await journal.record(first, key, receipt(first, [13, 14]));
    await assert.rejects(journal.record(apply, key, receipt(apply, [15, 16])), /materialized Page identities/);
    assert.deepEqual((await journal.record(apply, key, receipt(apply, [15, 13]))).posts.map(post => post.id), [15, 13]);
    await assert.rejects(journal.record(restore, key, receipt(restore, [13, 15])), /differs from previous/);
    assert.deepEqual((await journal.record(restore, key, receipt(restore, [13, 14]))).posts.map(post => post.id), [13, 14]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("an independent original authorizer can reissue an exact restore from authenticated apply receipts", async () => {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "miopages-retained-restore-"));
  const journal = new NativeDraftReceiptJournal(root);
  try {
    const site = { organizationId: randomUUID(), webPresenceId: randomUUID(), managedSiteId: randomUUID() };
    const installationId = randomUUID(), siteProposalId = randomUUID(), credentialId = randomUUID(), secret = randomBytes(32);
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const publicKeyBase64 = Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url").toString("base64");
    const keyId = "fixture";
    const page = { id: randomUUID(), path: "/", title: "Home", sections: [{
      id: randomUUID(), type: "intro", content: { heading: "Draft", text: "Fixture" },
    }] };
    const member = { ...site, proposalId: randomUUID(), revision: 1, approvalId: fingerprint("approval"),
      previewDigest: fingerprint("preview"), sourceDigest: fingerprint("source"), projectionDigest: fingerprint([page]), pages: [page] };
    const draft = { siteProposalId, installationId, navigation: ["/"], actions: [] };
    const first = bindSiteDraft(site, [member], { ...draft, revision: 1, previousDigest: null });
    const next = bindSiteDraft(site, [member], { ...draft, revision: 2, previousDigest: first.digest });
    const apply = nativeDraftEnvelope(next, keyId, publicKeyBase64, privateKey, "apply");
    const expected: NativeDraftReceiptExpectation = { installationId, siteProposalId, operation: "apply",
      requestedDigest: next.digest, appliedDigest: next.digest, revision: 2, paths: ["/"] };
    const operator = { authorize: async (actor: string) => ({ operatorId: actor, authorityReference: actor + "-grant" }) } as unknown as ProtectedOperator;
    const review = new PrivateReleaseReview(null!, operator, async () => { /* Fixture supplies authorization readback below. */ });
    review.nativeDraftReceiptDecision = async () => ({ expected, credentialId, keyId, publicKey: publicKeyBase64,
      signed: readNativeDraftEnvelope(apply, keyId, publicKeyBase64), reviewerId: "reviewer", authorizerGrant: "authorizer-grant" });
    const recover = (actor = "authorizer", signer = privateKey) => review.issueRetainedSiteDraftRestore(actor, "reviewer", site,
      installationId, apply, signer, { credentialId, secret, journal });
    await assert.rejects(recover(), { code: "ENOENT" });
    for (const prior of [first, next]) {
      const proof = { ...expected, appliedDigest: prior.digest, requestedDigest: prior.digest, revision: prior.candidate.revision };
      const php = spawnSync("php", ["wordpress/miopages-delivery/tests/native-draft-receipt.php"], { encoding: "utf8",
        input: JSON.stringify({ key: secret.toString("hex"), result: { ...proof, applied: { siteProposalId, digest: prior.digest,
          revision: proof.revision, posts: { "/": { ID: 13, post_status: "draft", post_content: "Fixture" } } } } }) });
      assert.equal(php.status, 0, php.stderr);
      await journal.record(proof, secret, JSON.parse(php.stdout));
    }
    await assert.rejects(recover("reviewer"), /Independent original/);
    await assert.rejects(recover("foreign"), /Independent original/);
    await assert.rejects(recover("authorizer", generateKeyPairSync("ed25519").privateKey), /signer does not match/);
    const restore = readNativeDraftEnvelope(await recover(), keyId, publicKeyBase64);
    assert.equal(restore.operation, "restore");
    assert.equal(restore.digest, next.digest);
    assert.equal(restore.candidate.previousDigest, first.digest);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a branded restore reconciles against the exact original brand even with unchanged posts", async () => {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "miopages-brand-receipt-"));
  try {
    const journal = new NativeDraftReceiptJournal(root);
    const key = randomBytes(32);
    const first = "1".repeat(64), second = "2".repeat(64), originalBrand = "3".repeat(64), newBrand = "4".repeat(64);
    const base: NativeDraftReceiptExpectation = { installationId: randomUUID(), siteProposalId: randomUUID(),
      operation: "apply", requestedDigest: first, appliedDigest: first, revision: 1, paths: ["/"], brandDigest: originalBrand };
    const next = { ...base, requestedDigest: second, appliedDigest: second, revision: 2, brandDigest: newBrand };
    const restore = { ...base, requestedDigest: second, operation: "restore" as const, brandDigest: undefined };
    const receipt = (expected: NativeDraftReceiptExpectation, brandDigest?: string) => {
      const result = { operation: expected.operation, installationId: expected.installationId, requestedDigest: expected.requestedDigest,
        applied: { siteProposalId: expected.siteProposalId, digest: expected.appliedDigest, revision: expected.revision,
          posts: { "/": { ID: 22, post_status: "draft", post_content: "Home" } },
          ...(brandDigest && { brand: { digest: brandDigest } }) } };
      const php = spawnSync("php", ["wordpress/miopages-delivery/tests/native-draft-receipt.php"], { encoding: "utf8",
        input: JSON.stringify({ result, key: key.toString("hex") }) });
      assert.equal(php.status, 0, php.stderr);
      return JSON.parse(php.stdout);
    };
    await assert.rejects(journal.record(base, key, receipt(base)), /brand differs from authorization/);
    await journal.record(base, key, receipt(base, originalBrand));
    await journal.record(next, key, receipt(next, newBrand));
    await assert.rejects(journal.record(restore, key, receipt(restore)), /differs from previous/);
    await assert.rejects(journal.record(restore, key, receipt(restore, newBrand)), /differs from previous/);
    assert.equal((await journal.record(restore, key, receipt(restore, originalBrand))).brandDigest, originalBrand);
  } finally { await rm(root, { recursive: true, force: true }); }
});
