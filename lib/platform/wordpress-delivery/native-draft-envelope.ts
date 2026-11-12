import { createHash, createPublicKey, sign, type KeyObject } from "node:crypto";
import type { bindSiteDraft } from "./site-draft";

type Preview = ReturnType<typeof bindSiteDraft>;

// Only the protected operator service issues this envelope after revalidating
// the durable exact draft authorization. It is distinct from release v1.
export function nativeDraftEnvelope(preview: Preview, keyId: string, publicKeyBase64: string, key: KeyObject, now = Date.now()) {
  if (key.type !== "private" || key.asymmetricKeyType !== "ed25519" ||
      createPublicKey(key).export({ format: "jwk" }).x !== Buffer.from(publicKeyBase64, "base64").toString("base64url")) {
    throw Error("Native draft signer does not match installation");
  }
  const payload = Buffer.from(JSON.stringify({ schema: "miopages.wordpress.native-draft", version: 1,
    purpose: "non-public-draft-only", issuedAt: Math.floor(now / 1000), expiresAt: Math.floor(now / 1000) + 900,
    digest: preview.digest, candidate: preview.candidate }), "utf8");
  if (payload.length > 700_000) throw Error("Native draft payload too large");
  return {
    schema: "miopages.wordpress.native-draft-envelope", version: 1, keyId,
    payloadBase64: payload.toString("base64"),
    payloadSha256: createHash("sha256").update(payload).digest("hex"),
    signatureBase64: sign(null, Buffer.concat([Buffer.from("MioPages-WP-Native-Draft-v1\n"), payload]), key).toString("base64"),
  };
}
