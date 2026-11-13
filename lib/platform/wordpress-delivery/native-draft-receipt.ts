import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { link, lstat, open, readFile, realpath, unlink } from "node:fs/promises";
import path from "node:path";
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
  requestedRevision?: number;
  materializedBaseline?: { requestedDigest: string; appliedDigest: string; revision: number };
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

/** Development receipts live in the existing protected Core account. */
export class NativeDraftReceiptJournal {
  constructor(private root: string) {}

  private async file(installationId: string, digest: string, operation: "apply" | "restore") {
    const stat = await lstat(this.root);
    if (!path.isAbsolute(this.root) || await realpath(this.root) !== this.root || !stat.isDirectory() ||
        (process.getuid && (stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o700))) {
      throw Error("Native draft receipt root refused");
    }
    return path.join(this.root, [uuid(installationId), hash(digest), operation].join("-") + ".json");
  }

  async read(installationId: string, digest: string, operation: "apply" | "restore") {
    const file = await this.file(installationId, digest, operation), stat = await lstat(file);
    if (!stat.isFile() || stat.size > 20_000 || (process.getuid && (stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600))) {
      throw Error("Stored native draft receipt refused");
    }
    return JSON.parse(await readFile(file, "utf8")) as unknown;
  }

  async verifyMaterializedBaseline(expected: Omit<NativeDraftReceiptExpectation, "operation">, secret: Buffer) {
    const prior = verifyNativeDraftReceipt(await this.read(expected.installationId, expected.appliedDigest, "apply"), secret, {
      ...expected, operation: "apply", requestedDigest: expected.appliedDigest,
    });
    const restored = verifyNativeDraftReceipt(await this.read(expected.installationId, expected.requestedDigest, "restore"), secret, {
      ...expected, operation: "restore",
    });
    if (JSON.stringify(prior.posts) !== JSON.stringify(restored.posts)) throw Error("Materialized baseline differs from prior readback");
    return restored;
  }

  async record(expected: NativeDraftReceiptExpectation, secret: Buffer, wire: unknown) {
    const verified = verifyNativeDraftReceipt(wire, secret, expected);
    if (expected.operation === "apply" && expected.materializedBaseline) {
      const baseline = await this.verifyMaterializedBaseline({ installationId: expected.installationId,
        siteProposalId: expected.siteProposalId, paths: expected.paths, ...expected.materializedBaseline }, secret);
      if (baseline.posts.some((post, index) => post.id !== verified.posts[index].id)) {
        throw Error("Applied draft differs from materialized Page identities");
      }
    }
    if (expected.operation === "restore") {
      const previous = verifyNativeDraftReceipt(await this.read(expected.installationId, expected.appliedDigest, "apply"), secret, {
        ...expected, operation: "apply", requestedDigest: expected.appliedDigest,
      });
      verifyNativeDraftReceipt(await this.read(expected.installationId, expected.requestedDigest, "apply"), secret, {
        ...expected, operation: "apply", appliedDigest: expected.requestedDigest, revision: expected.requestedRevision ?? expected.revision + 1,
      });
      if (JSON.stringify(previous.posts) !== JSON.stringify(verified.posts)) throw Error("Restored draft differs from previous readback");
    }
    const file = await this.file(expected.installationId, expected.requestedDigest, expected.operation);
    const temp = file + "." + randomUUID() + ".tmp";
    const writer = await open(temp, "wx", 0o600);
    try {
      try { await writer.writeFile(JSON.stringify(wire) + "\n"); await writer.sync(); } finally { await writer.close(); }
      try { await link(temp, file); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      if (process.platform !== "win32") {
        const directory = await open(this.root, "r");
        try { await directory.sync(); } finally { await directory.close(); }
      }
      const recorded = verifyNativeDraftReceipt(await this.read(expected.installationId, expected.requestedDigest, expected.operation), secret, expected);
      if (JSON.stringify(recorded) !== JSON.stringify(verified)) throw Error("Conflicting native draft receipt");
      return recorded;
    } finally { await unlink(temp); }
  }
}
