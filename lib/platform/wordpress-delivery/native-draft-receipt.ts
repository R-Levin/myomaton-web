import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { link, lstat, open, readFile, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import { fingerprint, object, uuid } from "../canonical/model";
import { hash } from "../content-editing/proposal";
import { readNativeDraftMedia, type NativeDraftMedia } from "./native-draft-media";

export type NativeDraftReceiptExpectation = {
  installationId: string;
  siteProposalId: string;
  operation: "apply" | "restore";
  requestedDigest: string;
  appliedDigest: string;
  revision: number;
  paths: readonly string[];
  media?: readonly NativeDraftMedia[];
  pageIds?: readonly string[];
  baselinePaths?: readonly string[];
  appliedBaseline?: string;
  requestedPaths?: readonly string[];
  requestedRevision?: number;
  materializedBaseline?: { requestedDigest: string; appliedDigest: string; revision: number };
};

// The caller supplies the expected operation and applied revision from Core's
// authorized state. A valid MAC alone cannot select which revision to accept.
export function verifyNativeDraftReceipt(value: unknown, secret: Buffer, expected: NativeDraftReceiptExpectation) {
  return verifyReceipt(value, secret, expected, false);
}

function verifyReceipt(value: unknown, secret: Buffer, expected: NativeDraftReceiptExpectation, historicalMedia: boolean) {
  const wire = object(value, ["receiptBase64", "mac"]);
  if (secret.length !== 32 || typeof wire.receiptBase64 !== "string" || wire.receiptBase64.length > 1_048_576) {
    throw Error("Native draft receipt encoding refused");
  }
  const bytes = Buffer.from(wire.receiptBase64, "base64");
  if (bytes.toString("base64") !== wire.receiptBase64) throw Error("Native draft receipt encoding refused");
  const body = object(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    ["schema", "version", "installationId", "siteProposalId", "operation", "requestedDigest", "appliedDigest", "revision", "posts", "attachments"]);
  if (body.version !== 1 && body.version !== 2) throw Error("Native draft receipt version refused");
  const mac = createHmac("sha256", secret).update(`MioPages-WP-Native-Draft-Receipt-v${body.version}\n`).update(bytes).digest();
  if (!timingSafeEqual(mac, Buffer.from(hash(wire.mac), "hex"))) throw Error("Native draft receipt authentication refused");
  const installationId = uuid(body.installationId), siteProposalId = uuid(body.siteProposalId);
  const requestedDigest = hash(body.requestedDigest), appliedDigest = hash(body.appliedDigest);
  if (body.schema !== "miopages.wordpress.native-draft-receipt" || Object.hasOwn(body, "attachments") !== (body.version === 2) ||
      installationId !== expected.installationId || siteProposalId !== expected.siteProposalId ||
      body.operation !== expected.operation || requestedDigest !== expected.requestedDigest || appliedDigest !== expected.appliedDigest ||
      (expected.operation === "apply" ? requestedDigest !== appliedDigest : requestedDigest === appliedDigest) ||
      typeof body.revision !== "number" || !Number.isSafeInteger(body.revision) || body.revision < 1 || body.revision !== expected.revision ||
      !Array.isArray(body.posts) || body.posts.length < 1 || body.posts.length !== expected.paths.length) {
    throw Error("Native draft receipt decision mismatch");
  }
  const posts = body.posts.map((value, index) => {
    const post = object(value, ["path", "id", "status", "contentSha256"]);
    if (post.path !== expected.paths[index] || post.status !== "draft" ||
        typeof post.id !== "number" || !Number.isSafeInteger(post.id) || post.id < 1) throw Error("Native draft receipt post mismatch");
    return { path: expected.paths[index], id: post.id, contentSha256: hash(post.contentSha256) };
  });
  if (new Set(posts.map(post => post.id)).size !== posts.length) throw Error("Duplicate native draft receipt post");
  if (body.version === 2 && (!Array.isArray(body.attachments) || !body.attachments.length)) {
    throw Error("Native draft attachment count refused");
  }
  const attachments = (body.attachments as unknown[] | undefined)?.map(value => {
    const item = object(value, ["id", "postId", "media"]);
    const media = readNativeDraftMedia(item.media);
    if (typeof item.id !== "number" || !Number.isSafeInteger(item.id) || item.id < 1 ||
        posts.some(post => post.id === item.id) || !posts.some(post => post.id === item.postId)) {
      throw Error("Native draft attachment identity refused");
    }
    if (expected.pageIds && posts[expected.pageIds.indexOf(media.pageId)]?.id !== item.postId) {
      throw Error("Native draft attachment placement mismatch");
    }
    return { id: item.id, postId: item.postId as number, media };
  });
  if (attachments && (new Set(attachments.map(item => item.id)).size !== attachments.length ||
      new Set(attachments.map(item => item.media.sectionId)).size !== attachments.length ||
      new Set(attachments.map(item => item.media.usageId)).size !== attachments.length)) throw Error("Duplicate native draft attachment");
  if ((!historicalMedia || expected.media) &&
      fingerprint(attachments?.map(item => item.media) ?? []) !== fingerprint(expected.media ?? [])) {
    throw Error("Native draft receipt media differs from authorization");
  }
  return { installationId, siteProposalId, operation: expected.operation, requestedDigest, appliedDigest, revision: body.revision, posts,
    ...(attachments && { attachments }) };
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
    if (!stat.isFile() || stat.size > 1_055_000 || (process.getuid && (stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600))) {
      throw Error("Stored native draft receipt refused");
    }
    return JSON.parse(await readFile(file, "utf8")) as unknown;
  }

  async verifyAppliedBaseline(expected: Omit<NativeDraftReceiptExpectation, "operation">, secret: Buffer) {
    return verifyReceipt(await this.read(expected.installationId, expected.appliedDigest, "apply"), secret,
      { ...expected, operation: "apply" }, true);
  }

  async verifyMaterializedBaseline(expected: Omit<NativeDraftReceiptExpectation, "operation">, secret: Buffer) {
    const prior = verifyReceipt(await this.read(expected.installationId, expected.appliedDigest, "apply"), secret, {
      ...expected, operation: "apply", requestedDigest: expected.appliedDigest,
    }, true);
    const restored = verifyReceipt(await this.read(expected.installationId, expected.requestedDigest, "restore"), secret, {
      ...expected, operation: "restore",
    }, true);
    if (fingerprint(prior.posts) !== fingerprint(restored.posts) ||
        fingerprint(prior.attachments ?? []) !== fingerprint(restored.attachments ?? [])) throw Error("Materialized baseline differs from prior readback");
    return restored;
  }

  async record(expected: NativeDraftReceiptExpectation, secret: Buffer, wire: unknown) {
    const verify = (value: unknown) => verifyReceipt(value, secret, expected, expected.operation === "restore");
    const verified = verify(wire);
    if (expected.operation === "apply" && (expected.materializedBaseline || expected.appliedBaseline)) {
      const selection = { installationId: expected.installationId, siteProposalId: expected.siteProposalId,
        paths: expected.baselinePaths ?? expected.paths };
      const baseline = expected.materializedBaseline
        ? await this.verifyMaterializedBaseline({ ...selection, ...expected.materializedBaseline }, secret)
        : await this.verifyAppliedBaseline({ ...selection, requestedDigest: expected.appliedBaseline!,
          appliedDigest: expected.appliedBaseline!, revision: expected.revision - 1 }, secret);
      const original = new Map(baseline.posts.map(post => [post.path, post.id]));
      if (verified.posts.some(post => original.has(post.path) && original.get(post.path) !== post.id)) {
        throw Error("Applied draft differs from materialized Page identities");
      }
    }
    if (expected.operation === "restore") {
      const previous = verifyReceipt(await this.read(expected.installationId, expected.appliedDigest, "apply"), secret, {
        ...expected, operation: "apply", requestedDigest: expected.appliedDigest,
      }, true);
      verifyReceipt(await this.read(expected.installationId, expected.requestedDigest, "apply"), secret, {
        ...expected, operation: "apply", appliedDigest: expected.requestedDigest, revision: expected.requestedRevision ?? expected.revision + 1,
        media: undefined, pageIds: undefined, paths: expected.requestedPaths ?? expected.paths,
      }, true);
      if (fingerprint(previous.posts) !== fingerprint(verified.posts) ||
          fingerprint(previous.attachments ?? []) !== fingerprint(verified.attachments ?? [])) throw Error("Restored draft differs from previous readback");
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
      const recorded = verify(await this.read(expected.installationId, expected.requestedDigest, expected.operation));
      if (JSON.stringify(recorded) !== JSON.stringify(verified)) throw Error("Conflicting native draft receipt");
      return recorded;
    } finally { await unlink(temp); }
  }
}
