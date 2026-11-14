import { constants } from "node:fs";
import { link, lstat, open, readdir, realpath, unlink } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fingerprint } from "../canonical/model";
import { PlanningFailureError } from "./planning-diagnostics";
import { confirmSitePlanningReceipt } from "./intelligent-responses";
import type { PreparedPlanning } from "./site-planning";

export type PlanningAttempt = {
  id: string; at: string; basis: string; ownerDigest: string; inputDigest: string; model: string; workDigest?: string;
};
type Captured = { attempt: PlanningAttempt; capturedAt: number; format: "compact/2" | "full"; prepared: PreparedPlanning; bytes: string };
const digest = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const attemptId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;
export const planningResponseRetentionMs = 24 * 60 * 60 * 1000;

export class PlanningResponseCustody {
  constructor(private directory: string, private clock = Date.now, private ledgerDirectory?: string) {}

  async verifyReceipt(attempt: PlanningAttempt, bytes: Buffer) {
    if (!this.ledgerDirectory) return;
    if (!attempt.workDigest) throw new PlanningFailureError("usage_gate");
    try { await this.secureDirectory(this.ledgerDirectory); }
    catch { throw new PlanningFailureError("usage_gate"); }
    await confirmSitePlanningReceipt(this.ledgerDirectory, attempt.ownerDigest, attempt.workDigest, bytes);
  }

  private async secureDirectory(path: string) {
    const dir = await lstat(path);
    if (!dir.isDirectory() || await realpath(path) !== path ||
        (process.platform !== "win32" && (dir.uid !== process.getuid?.() || (dir.mode & 0o777) !== 0o700))) throw Error("Invalid custody boundary");
  }

  private async checkDirectory() {
    await this.secureDirectory(this.directory);
    if (process.platform !== "win32") await this.secureDirectory(dirname(this.directory));
  }

  private async path(attempt: PlanningAttempt) {
    await this.checkDirectory();
    if (!attemptId.test(attempt.id)) throw Error("Invalid custody reference");
    return join(this.directory, attempt.id + ".json");
  }

  async pruneExpired() {
    await this.checkDirectory();
    for (const name of await readdir(this.directory)) {
      const [id, extension, temporary, suffix, extra] = name.split(".");
      if (!attemptId.test(id) || extension !== "json" || extra !== undefined ||
          (temporary !== undefined && (!attemptId.test(temporary) || suffix !== "tmp"))) continue;
      const path = join(this.directory, name);
      const info = await lstat(path).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
      if (!info || !info.isFile() || this.clock() - info.mtimeMs < planningResponseRetentionMs) continue;
      if (process.platform !== "win32" && (info.uid !== process.getuid?.() || (info.mode & 0o777) !== 0o600)) throw Error("Invalid custody file");
      await unlink(path).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
    }
  }

  async ready(attempt: PlanningAttempt) {
    try {
      const path = await this.path(attempt);
      await this.pruneExpired();
      await lstat(path).then(() => { throw Error(); }, error => {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      });
      const probe = path + "." + randomUUID() + ".tmp";
      const handle = await open(probe, "wx", 0o600);
      try { await handle.close(); } finally { await unlink(probe); }
    } catch { throw new PlanningFailureError("custody_write"); }
  }

  async save(attempt: PlanningAttempt, format: Captured["format"], prepared: PreparedPlanning, bytes: Uint8Array) {
    if (!bytes.length) throw new PlanningFailureError("custody_write");
    let temporary: string | undefined;
    try {
      const path = await this.path(attempt);
      const record: Captured = { attempt, capturedAt: this.clock(), format, prepared, bytes: Buffer.from(bytes).toString("base64") };
      const payload = JSON.stringify(record);
      const name = path + "." + randomUUID() + ".tmp";
      const file = await open(name, "wx", 0o600);
      temporary = name;
      try {
        await file.writeFile(JSON.stringify({ sha256: digest(Buffer.from(payload)), payload }) + "\n");
        await file.sync();
      } finally { await file.close(); }
      await link(temporary, path);
      if (process.platform !== "win32") {
        const directory = await open(this.directory, "r");
        try { await directory.sync(); } finally { await directory.close(); }
      }
      if (!(await this.read(attempt))?.bytes.equals(bytes)) throw Error("Response bytes changed");
    } catch { throw new PlanningFailureError("custody_write"); }
    finally { if (temporary) await unlink(temporary).catch(() => undefined); }
  }

  async read(attempt: PlanningAttempt) {
    try {
      const path = await this.path(attempt);
      const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try {
        const info = await file.stat();
        if (!info.isFile() || await realpath(path) !== path ||
            (process.platform !== "win32" && (info.uid !== process.getuid?.() || (info.mode & 0o777) !== 0o600))) throw Error();
        const { sha256, payload } = JSON.parse(await file.readFile("utf8"));
        if (typeof payload !== "string" || digest(Buffer.from(payload)) !== sha256) throw Error();
        const record = JSON.parse(payload) as Captured;
        const { prepared, capturedAt } = record;
        if (fingerprint(record.attempt) !== fingerprint(attempt) || !Number.isSafeInteger(capturedAt) ||
            capturedAt < Date.parse(attempt.at) || capturedAt > this.clock() ||
            (record.format !== "compact/2" && record.format !== "full") ||
            prepared.ownerDigest !== attempt.ownerDigest || prepared.inputDigest !== attempt.inputDigest ||
            fingerprint({ ownerDigest: prepared.ownerDigest, input: prepared.input }) !== attempt.inputDigest ||
            fingerprint([...prepared.input.sources, ...prepared.input.answers].map(source => source.id)) !== fingerprint(prepared.sourceIds) ||
            prepared.input.answers.some(answer => answer.confirmation !== "unconfirmed")) throw Error();
        if (this.clock() - capturedAt >= planningResponseRetentionMs) throw new PlanningFailureError("custody_expired");
        return { ...record, sha256, bytes: Buffer.from(record.bytes, "base64") };
      } finally { await file.close(); }
    } catch (error) {
      if (error instanceof PlanningFailureError) throw error;
      if ((error as NodeJS.ErrnoException).code === "ENOENT" && await this.path(attempt).then(() => true, () => false)) return null;
      throw new PlanningFailureError("custody_read");
    }
  }
}
