/**
 * A non-networked, synthetic-only Core → WP delivery gateway rehearsal.
 * This is NOT a production release-authority service. The real Core release
 * path currently refuses non-disposable development databases.
 */
import { createHash, createPublicKey, sign, verify } from "node:crypto";

const id = (v) => typeof v === "string" && /^[a-z0-9][a-z0-9_.:-]{0,127}$/i.test(v);
const digest = (v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const closed = (x, required) => {
  if (!x || typeof x !== "object" || Array.isArray(x)) throw Error("Invalid object");
  const keys = Object.keys(x).sort();
  if (keys.join("|") !== [...required].sort().join("|")) throw Error("Unexpected object fields");
  return x;
};
const targetKeys = ["organizationId", "webPresenceId", "managedSiteId", "installationId"];
const sameTarget = (a, b) => targetKeys.every(k => a[k] === b[k]);
const syntheticTarget = (x) => targetKeys.every(k => id(x[k]) && x[k].startsWith("synthetic-"));

/** Explicit, fail-closed mock of an enrolled installation registry. */
export function syntheticEnrollment(record) {
  closed(record, [...targetKeys, "keyId", "publicKeyBase64", "status", "host"]);
  if (!syntheticTarget(record) || !id(record.keyId) || record.status !== "active"
      || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(record.host)
      || !/^[a-zA-Z0-9+/]{43}=$/.test(record.publicKeyBase64)) {
    throw Error("Unenrolled or invalid synthetic installation");
  }
  return Object.freeze({ ...record });
}

/**
 * Caller MUST supply the result of a trusted Core authority interface.
 * The production interface is not built; this function categorically refuses
 * non-synthetic IDs and non-synthetic evidence even if supplied by a caller.
 */
export function syntheticEligibility(enrollment, evidence, expectedSequence) {
  if (!enrollment || enrollment.status !== "active" || !syntheticTarget(enrollment)) {
    throw Error("Installation not enrolled");
  }
  closed(evidence, [...targetKeys, "releaseId", "approvalId", "sourceDigest",
    "publishable", "authority", "sequence", "previousReleaseId"]);
  if (!sameTarget(evidence, enrollment) || !id(evidence.releaseId)
      || !evidence.releaseId.startsWith("synthetic-")
      || !id(evidence.approvalId) || !evidence.approvalId.startsWith("synthetic-")
      || evidence.authority !== "synthetic-disposable-only"
      || evidence.publishable !== true || !digest(evidence.sourceDigest)
      || !Number.isSafeInteger(expectedSequence) || expectedSequence < 0
      || evidence.sequence !== expectedSequence + 1
      || (expectedSequence === 0 ? evidence.previousReleaseId !== null
        : !id(evidence.previousReleaseId))) {
    throw Error("Core release eligibility refused");
  }
  return Object.freeze({ ...evidence });
}

/**
 * Test issuer: signs only immutable, eligible synthetic claims and the existing
 * bounded WP v1 text-only page format. Does NOT validate real Core approval.
 */
export function createSyntheticEnvelope(enrollment, evidence, pages, privateKey, now = Date.now()) {
  syntheticEligibility(enrollment, evidence, evidence.sequence - 1);
  if (!Array.isArray(pages) || pages.length < 1 || pages.length > 16
      || !Number.isFinite(now)) throw Error("Invalid synthetic release pages/time");
  const expires = now + 3600000;
  const format = n => new Date(n).toISOString().replace(/\.\d{3}Z$/, "Z");
  const payload = {
    schema: "miopages.wordpress.managed-release", version: 1,
    releaseId: evidence.releaseId,
    organizationId: enrollment.organizationId,
    webPresenceId: enrollment.webPresenceId,
    managedSiteId: enrollment.managedSiteId,
    installationId: enrollment.installationId,
    sequence: evidence.sequence,
    previousReleaseId: evidence.previousReleaseId,
    issuedAt: format(now - 60000), expiresAt: format(expires),
    approval: { state: "approved", approvalId: evidence.approvalId },
    pages, assets: []
  };
  const payloadBytes = Buffer.from(JSON.stringify(payload));
  if (payloadBytes.length > 786432) throw Error("Oversized release");
  const signedInput = Buffer.concat([Buffer.from("MioPages-WP-Release-v1\n"), payloadBytes]);
  const signature = sign(null, signedInput, privateKey);
  const raw = Buffer.from(enrollment.publicKeyBase64, "base64");
  const pub = createPublicKey({ key: Buffer.concat([
    Buffer.from("302a300506032b6570032100", "hex"), raw]),
    format: "der", type: "spki" });
  if (!verify(null, signedInput, pub, signature)) throw Error("Issuer does not match enrolled key");
  const envelope = {
    schema: "miopages.wordpress.release-envelope", version: 1,
    keyId: enrollment.keyId,
    payloadBase64: payloadBytes.toString("base64"),
    payloadSha256: createHash("sha256").update(payloadBytes).digest("hex"),
    signatureBase64: signature.toString("base64")
  };
  return Object.freeze({
    envelope: JSON.stringify(envelope),
    releaseId: evidence.releaseId,
    installationId: enrollment.installationId,
    sequence: evidence.sequence,
    envelopeSha256: createHash("sha256").update(JSON.stringify(envelope)).digest("hex"),
  });
}

/** Acknowledgment is never authorization or activation, only an exact stage receipt. */
export function reconcileSyntheticStage(issued, enrollment, receipt) {
  closed(receipt, ["releaseId", "installationId", "sequence", "envelopeSha256", "state"]);
  if (enrollment.status !== "active" || issued.installationId !== enrollment.installationId
      || receipt.state !== "staged" || receipt.releaseId !== issued.releaseId
      || receipt.installationId !== issued.installationId
      || receipt.sequence !== issued.sequence
      || !digest(receipt.envelopeSha256)
      || receipt.envelopeSha256 !== issued.envelopeSha256) {
    throw Error("Stage receipt mismatch or revoked installation");
  }
  return Object.freeze({ state: "staged-reconciled", releaseId: issued.releaseId,
    installationId: issued.installationId, publication: "disabled" });
}
