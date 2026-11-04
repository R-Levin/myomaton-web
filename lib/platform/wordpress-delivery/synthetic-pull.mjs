/**
 * Fully in-memory rehearsal of installation-authenticated release pull.
 * No HTTP listener/client, durable credential registry, Core DB, or WordPress
 * activation. This is not a deployable production authentication service.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const hex64 = v => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
const boundedId = v => typeof v === "string" && /^[a-z0-9][a-z0-9_.:-]{0,127}$/i.test(v);
const equal = (a, b) => {
  if (!hex64(a) || !hex64(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
};
const mac = (secret, message) => createHmac("sha256", secret).update(message).digest("hex");
const signed = ({ installationId, releaseId, nonce, issuedAt }) =>
  `MioPages-WP-Pull-v0\\n${installationId}\\n${releaseId}\\n${nonce}\\n${issuedAt}`;

/** Synthetic test-only client with per-installation symmetric pull credential. */
export function makeSyntheticPull({ installationId, releaseId, secret, nonce, issuedAt }) {
  if (!boundedId(installationId) || !installationId.startsWith("synthetic-")
      || !boundedId(releaseId) || !releaseId.startsWith("synthetic-")
      || typeof nonce !== "string" || !/^[0-9a-f]{32}$/.test(nonce)
      || !Number.isSafeInteger(issuedAt) || !(secret instanceof Buffer)
      || secret.length < 32) throw Error("Invalid synthetic pull request");
  const request = { installationId, releaseId, nonce, issuedAt };
  return { ...request, authorization: mac(secret, signed(request)) };
}

/**
 * In-memory central rehearsal. Caller must supply a trusted exact issued
 * envelope record and an installation-scoped secret; no user-supplied
 * release ID or notification is treated as publication authority.
 */
export class SyntheticPullHub {
  #credentials = new Map();
  #issued = new Map();
  #seen = new Map();

  enroll({ installationId, secret }) {
    if (!boundedId(installationId) || !installationId.startsWith("synthetic-")
        || !(secret instanceof Buffer) || secret.length < 32
        || this.#credentials.has(installationId)) throw Error("Enrollment refused");
    this.#credentials.set(installationId, Buffer.from(secret));
    this.#seen.set(installationId, new Set());
  }

  revoke(installationId) {
    if (!this.#credentials.has(installationId)) throw Error("Unknown installation");
    this.#credentials.delete(installationId);
  }

  queue({ installationId, releaseId, envelope, envelopeSha256 }) {
    if (!this.#credentials.has(installationId) || !boundedId(releaseId)
        || !releaseId.startsWith("synthetic-")
        || typeof envelope !== "string" || Buffer.byteLength(envelope) > 1048576
        || !hex64(envelopeSha256)) throw Error("Synthetic delivery refused");
    const key = installationId + ":" + releaseId;
    const previous = this.#issued.get(key);
    if (previous && (previous.envelope !== envelope ||
        previous.envelopeSha256 !== envelopeSha256)) throw Error("Release conflict");
    this.#issued.set(key, Object.freeze({ installationId, releaseId, envelope, envelopeSha256 }));
  }

  pull(request, now) {
    if (!request || typeof request !== "object"
        || Object.keys(request).sort().join("|") !==
            ["installationId", "releaseId", "nonce", "issuedAt", "authorization"].sort().join("|")
        || !Number.isSafeInteger(now) || !Number.isSafeInteger(request.issuedAt)
        || Math.abs(now - request.issuedAt) > 120000
        || !/^[0-9a-f]{32}$/.test(request.nonce)
        || !hex64(request.authorization)) throw Error("Pull refused");
    const secret = this.#credentials.get(request.installationId);
    if (!secret || !equal(mac(secret, signed(request)), request.authorization)) {
      throw Error("Pull authentication refused");
    }
    const used = this.#seen.get(request.installationId);
    if (used.has(request.nonce)) throw Error("Pull replay refused");
    // Burn nonce on authenticated request, even when no release exists.
    used.add(request.nonce);
    const delivery = this.#issued.get(request.installationId + ":" + request.releaseId);
    if (!delivery) throw Error("Release not queued for installation");
    return { ...delivery };
  }
}
