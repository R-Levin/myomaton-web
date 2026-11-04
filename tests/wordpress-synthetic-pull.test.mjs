import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { makeSyntheticPull, SyntheticPullHub } from "../lib/platform/wordpress-delivery/synthetic-pull.mjs";

const now = Date.now();
const secretA = randomBytes(32), secretB = randomBytes(32);
const installationId = "synthetic-wp-a", releaseId = "synthetic-release-a";
const envelope = '{"test":"nonpublic"}';
const envelopeSha256 = createHash("sha256").update(envelope).digest("hex");
const pull = (args = {}) => makeSyntheticPull({
  installationId, releaseId, secret: secretA,
  nonce: randomBytes(16).toString("hex"), issuedAt: now, ...args
});
const hub = () => {
  const h = new SyntheticPullHub();
  h.enroll({ installationId, secret: secretA });
  h.enroll({ installationId: "synthetic-wp-b", secret: secretB });
  h.queue({ installationId, releaseId, envelope, envelopeSha256 });
  return h;
};

test("synthetic authenticated pull and idempotent queued release", () => {
  const h = hub();
  const result = h.pull(pull(), now);
  assert.equal(result.envelopeSha256, envelopeSha256);
  assert.equal(result.installationId, installationId);
  assert.deepEqual(h.pull(pull(), now), result);
  h.queue({ installationId, releaseId, envelope, envelopeSha256 });
  assert.throws(() => h.queue({
    installationId, releaseId, envelope: "different", envelopeSha256
  }), /conflict/);
});

test("replay, foreign scope, invalid HMAC, clock skew and absence refuse", () => {
  const h = hub();
  const same = pull();
  h.pull(same, now);
  assert.throws(() => h.pull(same, now), /replay/);
  assert.throws(() => h.pull(pull({ secret: secretB }), now), /authentication/);
  assert.throws(() => h.pull(pull({ installationId: "synthetic-wp-b" }), now));
  assert.throws(() => h.pull(pull(), now + 120001));
  assert.throws(() => h.pull(pull({ releaseId: "synthetic-unlisted" }), now));
  const malformed = { ...pull(), untrusted: true };
  assert.throws(() => h.pull(malformed, now));
});

test("revoked installation is not allowed to pull or be queued", () => {
  const h = hub();
  h.revoke(installationId);
  assert.throws(() => h.pull(pull(), now), /authentication/);
  assert.throws(() => h.queue({ installationId, releaseId, envelope, envelopeSha256 }));
});
