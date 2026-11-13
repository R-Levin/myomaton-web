import { createHash, createPublicKey, sign, verify, type KeyObject } from "node:crypto";
import { fingerprint, object } from "../canonical/model";
import { nativeDraftRollback, type bindSiteDraft } from "./site-draft";

type Preview = ReturnType<typeof bindSiteDraft>;
const domain = (version: number) => Buffer.from(`MioPages-WP-Native-Draft-v${version}\n`);

// Only the protected operator service issues this envelope after revalidating
// the durable exact draft authorization. It is distinct from release v1.
export function nativeDraftEnvelope(preview: Preview, keyId: string, publicKeyBase64: string, key: KeyObject, operation: "apply" | "restore") {
  if (key.type !== "private" || key.asymmetricKeyType !== "ed25519" ||
      createPublicKey(key).export({ format: "jwk" }).x !== Buffer.from(publicKeyBase64, "base64").toString("base64url")) {
    throw Error("Native draft signer does not match installation");
  }
  if (operation === "restore" && !preview.candidate.previousDigest) throw Error("Native draft has no predecessor to restore");
  const version = preview.candidate.rollback ? 2 : 1;
  const now = Date.now();
  const payload = Buffer.from(JSON.stringify({ schema: "miopages.wordpress.native-draft", version, operation,
    purpose: "non-public-draft-only", issuedAt: Math.floor(now / 1000), expiresAt: Math.floor(now / 1000) + 900,
    digest: preview.digest, candidate: preview.candidate }), "utf8");
  if (payload.length > 700_000) throw Error("Native draft payload too large");
  return {
    schema: "miopages.wordpress.native-draft-envelope", version, keyId,
    payloadBase64: payload.toString("base64"),
    payloadSha256: createHash("sha256").update(payload).digest("hex"),
    signatureBase64: sign(null, Buffer.concat([domain(version), payload]), key).toString("base64"),
  };
}

export function readNativeDraftEnvelope(wire: unknown, keyId: string, publicKeyBase64: string) {
  const envelope = object(wire, ["schema", "version", "keyId", "payloadBase64", "payloadSha256", "signatureBase64"]);
  if (envelope.schema !== "miopages.wordpress.native-draft-envelope" || (envelope.version !== 1 && envelope.version !== 2) || envelope.keyId !== keyId ||
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
  if (payload.schema !== "miopages.wordpress.native-draft" || payload.version !== envelope.version || payload.purpose !== "non-public-draft-only" ||
      !["apply", "restore"].includes(payload.operation) || !Number.isSafeInteger(payload.issuedAt) ||
      payload.issuedAt > Math.floor(Date.now() / 1000) + 60 || payload.expiresAt - payload.issuedAt !== 900 ||
      payload.digest !== fingerprint(payload.candidate) || Object.hasOwn(payload.candidate, "rollback") !== (payload.version === 2)) throw Error("Native draft envelope claim mismatch");
  if (payload.version === 2) {
    const rollback = nativeDraftRollback(payload.candidate.rollback, payload.candidate.revision);
    if (rollback.digest === payload.candidate.previousDigest) throw Error("Native draft rollback claim mismatch");
  }
  return payload;
}
