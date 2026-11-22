import { createHash, createPublicKey, sign, verify, type KeyObject } from "node:crypto";
import { fingerprint, object } from "../canonical/model";
import { nativeDraftBaseline, nativeDraftRollback, verifyNativeMediaPlacements, type bindSiteDraft } from "./site-draft";
import { readSignedDraftBrand } from "./draft-brand";
import { readNativeDraftMedia } from "./native-draft-media";
import { readReviewDraftCandidate, type bindReviewDraft } from "./review-draft";

type Preview = ReturnType<typeof bindSiteDraft>;
type ReviewDraft = ReturnType<typeof bindReviewDraft>;
const domain = (version: number) => Buffer.from(`MioPages-WP-Native-Draft-v${version}\n`);
const purposeFor = (version: number) => version === 6 ? "operator-review-draft" : "non-public-draft-only";

function signDraft(version: number, digest: string, candidate: unknown, keyId: string, publicKeyBase64: string, key: KeyObject,
  operation: "apply" | "restore") {
  if (key.type !== "private" || key.asymmetricKeyType !== "ed25519" ||
      createPublicKey(key).export({ format: "jwk" }).x !== Buffer.from(publicKeyBase64, "base64").toString("base64url")) {
    throw Error("Native draft signer does not match installation");
  }
  const now = Date.now();
  const payload = Buffer.from(JSON.stringify({ schema: "miopages.wordpress.native-draft", version, operation,
    purpose: purposeFor(version), issuedAt: Math.floor(now / 1000), expiresAt: Math.floor(now / 1000) + 900,
    digest, candidate }), "utf8");
  if (payload.length > 700_000) throw Error("Native draft payload too large");
  return {
    schema: "miopages.wordpress.native-draft-envelope", version, keyId,
    payloadBase64: payload.toString("base64"),
    payloadSha256: createHash("sha256").update(payload).digest("hex"),
    signatureBase64: sign(null, Buffer.concat([domain(version), payload]), key).toString("base64"),
  };
}

// Only the protected operator service issues this envelope after revalidating
// the durable exact draft authorization. It is distinct from release v1.
export function nativeDraftEnvelope(preview: Preview, keyId: string, publicKeyBase64: string, key: KeyObject, operation: "apply" | "restore") {
  if (operation === "restore" && !preview.candidate.previousDigest) throw Error("Native draft has no predecessor to restore");
  const version = preview.candidate.brand ? 5 : preview.candidate.baselinePages ? 4 : preview.candidate.media?.length ? 3 : preview.candidate.rollback ? 2 : 1;
  return signDraft(version, preview.digest, preview.candidate, keyId, publicKeyBase64, key, operation);
}

/** A private review draft for Operator WordPress (version 6). Same key and checks as
 * every delivery; no per-page approval (owner decision, Nov 22). */
export function reviewDraftEnvelope(draft: ReviewDraft, keyId: string, publicKeyBase64: string, key: KeyObject, operation: "apply" | "restore" = "apply") {
  if (operation === "restore" && !draft.candidate.previousDigest) throw Error("Native draft has no predecessor to restore");
  return signDraft(6, draft.digest, draft.candidate, keyId, publicKeyBase64, key, operation);
}

export function readNativeDraftEnvelope(wire: unknown, keyId: string, publicKeyBase64: string) {
  const envelope = object(wire, ["schema", "version", "keyId", "payloadBase64", "payloadSha256", "signatureBase64"]);
  if (envelope.schema !== "miopages.wordpress.native-draft-envelope" || ![1, 2, 3, 4, 5, 6].includes(Number(envelope.version)) || typeof envelope.version !== "number" || envelope.keyId !== keyId ||
      typeof envelope.payloadBase64 !== "string" || envelope.payloadBase64.length > 934_000 ||
      typeof envelope.signatureBase64 !== "string" || envelope.signatureBase64.length !== 88) throw Error("Native draft envelope refused");
  const bytes = Buffer.from(envelope.payloadBase64, "base64"), signature = Buffer.from(envelope.signatureBase64, "base64");
  const publicKey = Buffer.from(publicKeyBase64, "base64");
  if (bytes.toString("base64") !== envelope.payloadBase64 || signature.toString("base64") !== envelope.signatureBase64 ||
      signature.length !== 64 || publicKey.length !== 32 || createHash("sha256").update(bytes).digest("hex") !== envelope.payloadSha256 ||
      !verify(null, Buffer.concat([domain(envelope.version), bytes]), createPublicKey({ type: "spki", format: "der",
        key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), publicKey]) }), signature)) {
    throw Error("Native draft envelope signature refused");
  }
  const payload = JSON.parse(bytes.toString("utf8")) as Preview & { schema: string; version: number; purpose: string;
    operation: "apply" | "restore"; issuedAt: number; expiresAt: number };
  if (payload.version === 6 && envelope.version === 6) {
    if (payload.schema !== "miopages.wordpress.native-draft" || payload.purpose !== "operator-review-draft" ||
        !["apply", "restore"].includes(payload.operation) || !Number.isSafeInteger(payload.issuedAt) ||
        payload.issuedAt > Math.floor(Date.now() / 1000) + 60 || payload.expiresAt - payload.issuedAt !== 900 ||
        payload.digest !== fingerprint(payload.candidate)) throw Error("Native draft envelope claim mismatch");
    readReviewDraftCandidate(payload.candidate);
    return payload;
  }
  if (payload.schema !== "miopages.wordpress.native-draft" || payload.version !== envelope.version || payload.purpose !== "non-public-draft-only" ||
      !["apply", "restore"].includes(payload.operation) || !Number.isSafeInteger(payload.issuedAt) ||
      payload.issuedAt > Math.floor(Date.now() / 1000) + 60 || payload.expiresAt - payload.issuedAt !== 900 ||
      payload.digest !== fingerprint(payload.candidate) ||
      Object.hasOwn(payload.candidate, "brand") !== (payload.version === 5) ||
      (payload.version < 5 && Object.hasOwn(payload.candidate, "baselinePages") !== (payload.version === 4)) ||
      (payload.version < 4 && Object.hasOwn(payload.candidate, "media") !== (payload.version === 3)) ||
      (payload.version < 3 && Object.hasOwn(payload.candidate, "rollback") !== (payload.version === 2))) throw Error("Native draft envelope claim mismatch");
  if (Object.hasOwn(payload.candidate, "media")) {
    const media = payload.candidate.media;
    if (!Array.isArray(media) || !media.length) throw Error("Native draft media claim mismatch");
    verifyNativeMediaPlacements(media.map(readNativeDraftMedia), payload.candidate.pages);
  }
  if (payload.candidate.brand) readSignedDraftBrand(payload.candidate.brand, payload.candidate.scope);
  if (Object.hasOwn(payload.candidate, "baselinePages")) {
    if (payload.candidate.revision < 2 || !payload.candidate.previousDigest) throw Error("Native draft membership baseline missing");
    const baseline = nativeDraftBaseline(payload.candidate.baselinePages);
    if (fingerprint(baseline) !== fingerprint(payload.candidate.baselinePages) ||
        payload.candidate.pages.some(page => baseline.some(prior => (prior.id === page.id || prior.path === page.path) &&
          (prior.id !== page.id || prior.path !== page.path)))) throw Error("Native draft membership claim mismatch");
  }
  if (payload.candidate.rollback) {
    const rollback = nativeDraftRollback(payload.candidate.rollback, payload.candidate.revision);
    if (rollback.digest === payload.candidate.previousDigest) throw Error("Native draft rollback claim mismatch");
  }
  return payload;
}
