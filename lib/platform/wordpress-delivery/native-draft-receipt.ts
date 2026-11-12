import { createHmac, timingSafeEqual } from "node:crypto";
import { object, uuid } from "../canonical/model";
import { hash } from "../content-editing/proposal";

export type NativeDraftReceiptExpectation = {
  installationId: string;
  siteProposalId: string;
  operation: "apply" | "restore";
  requestedDigest: string;
  appliedDigest: string;
  revision: number;
  paths: readonly string[];
};

// The caller supplies the expected operation and applied revision from Core's
// authorized state. A valid MAC alone cannot select which revision to accept.
export function verifyNativeDraftReceipt(value: unknown, secret: Buffer, expected: NativeDraftReceiptExpectation) {
  const wire = object(value, ["receiptBase64", "mac"]);
  if (secret.length !== 32 || typeof wire.receiptBase64 !== "string" || wire.receiptBase64.length > 16_384) {
    throw Error("Native draft receipt encoding refused");
  }
  const bytes = Buffer.from(wire.receiptBase64, "base64");
  if (bytes.toString("base64") !== wire.receiptBase64) throw Error("Native draft receipt encoding refused");
  const mac = createHmac("sha256", secret).update("MioPages-WP-Native-Draft-Receipt-v1\n").update(bytes).digest();
  if (!timingSafeEqual(mac, Buffer.from(hash(wire.mac), "hex"))) throw Error("Native draft receipt authentication refused");
  const body = object(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    ["schema", "version", "installationId", "siteProposalId", "operation", "requestedDigest", "appliedDigest", "revision", "posts"]);
  const installationId = uuid(body.installationId), siteProposalId = uuid(body.siteProposalId);
  const requestedDigest = hash(body.requestedDigest), appliedDigest = hash(body.appliedDigest);
  if (body.schema !== "miopages.wordpress.native-draft-receipt" || body.version !== 1 ||
      installationId !== expected.installationId || siteProposalId !== expected.siteProposalId ||
      body.operation !== expected.operation || requestedDigest !== expected.requestedDigest || appliedDigest !== expected.appliedDigest ||
      (expected.operation === "apply" ? requestedDigest !== appliedDigest : requestedDigest === appliedDigest) ||
      typeof body.revision !== "number" || !Number.isSafeInteger(body.revision) || body.revision < 1 || body.revision !== expected.revision ||
      !Array.isArray(body.posts) || body.posts.length < 1 || body.posts.length > 16 || body.posts.length !== expected.paths.length) {
    throw Error("Native draft receipt decision mismatch");
  }
  const posts = body.posts.map((value, index) => {
    const post = object(value, ["path", "id", "status", "contentSha256"]);
    if (post.path !== expected.paths[index] || post.status !== "draft" ||
        typeof post.id !== "number" || !Number.isSafeInteger(post.id) || post.id < 1) throw Error("Native draft receipt post mismatch");
    return { path: expected.paths[index], id: post.id, contentSha256: hash(post.contentSha256) };
  });
  if (new Set(posts.map(post => post.id)).size !== posts.length) throw Error("Duplicate native draft receipt post");
  return { installationId, siteProposalId, operation: expected.operation, requestedDigest, appliedDigest, revision: body.revision, posts };
}
