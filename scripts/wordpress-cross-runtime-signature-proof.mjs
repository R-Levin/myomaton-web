/**
 * Node-to-PHP cryptographic contract proof. No private key persistence,
 * database, WordPress installation, or HTTP requests.
 * Run: node scripts/wordpress-cross-runtime-signature-proof.mjs
 */
import { generateKeyPairSync, sign, createPublicKey, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const der = publicKey.export({ format: "der", type: "spki" });
const prefix = Buffer.from("302a300506032b6570032100", "hex");
if (der.length !== prefix.length + 32 || !der.subarray(0, prefix.length).equals(prefix)) {
  throw Error("Unexpected Ed25519 public key DER shape");
}
const rawPublic = der.subarray(prefix.length);
const reconstructed = createPublicKey({
  key: Buffer.concat([prefix, rawPublic]), format: "der", type: "spki"
});
if (!reconstructed.equals(publicKey)) {
  throw Error("Public verification key round-trip failed");
}
const now = Date.now();
const payload = {
  schema: "miopages.wordpress.managed-release",
  version: 1,
  releaseId: "synthetic-node-cross-runtime",
  organizationId: "synthetic-org",
  webPresenceId: "synthetic-presence",
  managedSiteId: "synthetic-site",
  installationId: "synthetic-installation",
  sequence: 1,
  previousReleaseId: null,
  issuedAt: new Date(now - 60000).toISOString().replace(/\.\d{3}Z$/, "Z"),
  expiresAt: new Date(now + 3600000).toISOString().replace(/\.\d{3}Z$/, "Z"),
  approval: { state: "approved", approvalId: "synthetic-compat-test" },
  pages: [{
    id: "synthetic-page", path: "/", title: "Synthetic",
    sections: [{
      id: "synthetic-intro", type: "intro",
      content: { heading: "Node to PHP interoperability", text: "Nonpublic test only" }
    }]
  }],
  assets: []
};
const payloadBytes = Buffer.from(JSON.stringify(payload), "utf8");
const prefixBytes = Buffer.from("MioPages-WP-Release-v1\n", "ascii");
const envelope = {
  schema: "miopages.wordpress.release-envelope",
  version: 1,
  keyId: "synthetic-node-test",
  payloadBase64: payloadBytes.toString("base64"),
  payloadSha256: createHash("sha256").update(payloadBytes).digest("hex"),
  signatureBase64: sign(null, Buffer.concat([prefixBytes, payloadBytes]), privateKey).toString("base64")
};
const input = JSON.stringify({
  envelope: JSON.stringify(envelope),
  publicKeyBase64: rawPublic.toString("base64")
});
const target = resolve(root, "wordpress/miopages-delivery/tests/node-issuer-compat.php");
const result = spawnSync("php", [target], {
  input, encoding: "utf8", timeout: 15000, maxBuffer: 1024 * 1024
});
if (result.error || result.status !== 0) {
  process.stderr.write(result.stderr || result.error?.message || "PHP verification failed\n");
  process.exit(1);
}
process.stdout.write(result.stdout);
console.log("PASS: ephemeral Node issuer key was never stored or deployed.");
