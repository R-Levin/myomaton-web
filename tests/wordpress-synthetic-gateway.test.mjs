import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  syntheticEnrollment, syntheticEligibility, createSyntheticEnvelope,
  reconcileSyntheticStage
} from "../lib/platform/wordpress-delivery/synthetic-gateway.mjs";

const keys = generateKeyPairSync("ed25519");
const der = keys.publicKey.export({ format: "der", type: "spki" });
const publicKeyBase64 = der.subarray(-32).toString("base64");
const target = {
  organizationId: "synthetic-org",
  webPresenceId: "synthetic-presence",
  managedSiteId: "synthetic-site",
  installationId: "synthetic-installation",
};
const enrolled = () => syntheticEnrollment({
  ...target, keyId: "synthetic-node-test",
  publicKeyBase64, status: "active", host: "test.example.org"
});
const eligible = () => ({
  ...target, releaseId: "synthetic-batch1-r1",
  approvalId: "synthetic-approved",
  sourceDigest: "a".repeat(64), publishable: true,
  authority: "synthetic-disposable-only", sequence: 1,
  previousReleaseId: null
});
const pages = [{
  id: "synthetic-page", path: "/", title: "Synthetic",
  sections: [{
    id: "synthetic-section", type: "intro",
    content: { heading: "Development-only signed release", text: "Never public" }
  }]
}];

test("synthetic gateway signs exact target and reconciles exact private stage", () => {
  const e = enrolled();
  const evidence = syntheticEligibility(e, eligible(), 0);
  const signed = createSyntheticEnvelope(e, evidence, pages, keys.privateKey);
  const parsed = JSON.parse(signed.envelope);
  assert.equal(parsed.keyId, e.keyId);
  assert.equal(JSON.parse(Buffer.from(parsed.payloadBase64, "base64").toString()).installationId,
    e.installationId);
  assert.deepEqual(reconcileSyntheticStage(signed, e, {
    releaseId: signed.releaseId,
    installationId: signed.installationId,
    sequence: signed.sequence,
    envelopeSha256: signed.envelopeSha256,
    state: "staged"
  }), {
    state: "staged-reconciled", releaseId: signed.releaseId,
    installationId: signed.installationId, publication: "disabled"
  });
});

test("untrusted identities, revoked installs, and nonpublishable fixture refuse", () => {
  assert.throws(() => syntheticEnrollment({
    ...target, installationId: "real-installation",
    keyId: "synthetic-node-test", publicKeyBase64,
    status: "active", host: "test.example.org"
  }));
  assert.throws(() => syntheticEnrollment({
    ...target, keyId: "synthetic-node-test", publicKeyBase64,
    status: "revoked", host: "test.example.org"
  }));
  assert.throws(() => syntheticEligibility(enrolled(),
    { ...eligible(), publishable: false }, 0));
  assert.throws(() => syntheticEligibility(enrolled(),
    { ...eligible(), authority: "production-approved" }, 0));
  assert.throws(() => syntheticEligibility(enrolled(),
    { ...eligible(), installationId: "synthetic-foreign" }, 0));
  assert.throws(() => syntheticEligibility(enrolled(),
    { ...eligible(), approvalId: "user-asserted-approval" }, 0));
  assert.throws(() => syntheticEligibility(enrolled(),
    { ...eligible(), sequence: 2 }, 0));
  assert.throws(() => syntheticEligibility(enrolled(),
    { ...eligible(), unexpected: true }, 0));
});

test("wrong issuer key, false receipt, and foreign receipt are refused", () => {
  const e = enrolled();
  const ev = syntheticEligibility(e, eligible(), 0);
  const foreign = generateKeyPairSync("ed25519");
  assert.throws(() => createSyntheticEnvelope(e, ev, pages, foreign.privateKey),
    /Issuer does not match/);
  const signed = createSyntheticEnvelope(e, ev, pages, keys.privateKey);
  const base = {
    releaseId: signed.releaseId,
    installationId: signed.installationId,
    sequence: signed.sequence,
    envelopeSha256: signed.envelopeSha256, state: "staged"
  };
  for (const receipt of [
    { ...base, installationId: "synthetic-foreign" },
    { ...base, envelopeSha256: "0".repeat(64) },
    { ...base, state: "activated" },
    { ...base, sequence: 2 },
    { ...base, unexpected: true },
  ]) assert.throws(() => reconcileSyntheticStage(signed, e, receipt));
});

test("real PHP validator accepts the gateway-issued exact synthetic envelope", () => {
  const e = enrolled();
  const proof = syntheticEligibility(e, {
    ...eligible(), releaseId: "synthetic-node-cross-runtime"
  }, 0);
  const signed = createSyntheticEnvelope(e, proof, pages, keys.privateKey);
  const path = resolve(dirname(fileURLToPath(import.meta.url)),
    "../wordpress/miopages-delivery/tests/node-issuer-compat.php");
  const result = spawnSync("php", [path], {
    input: JSON.stringify({ envelope: signed.envelope, publicKeyBase64 }),
    encoding: "utf8", timeout: 15000
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stdout, /PASS: Node Ed25519 envelope accepted by PHP/);
});
