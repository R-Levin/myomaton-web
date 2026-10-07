import { createHash } from "node:crypto";
import { lstat, mkdir, open, realpath } from "node:fs/promises";
import path from "node:path";
import { requireAssetUuid } from "./model";
import { MAX_MANAGED_BYTES, requireManagedKey } from "./source";

// Runtime customer bytes are supplied by a volume, never traced into the build.
export function assetRoot(): string {
  return path.resolve(/* turbopackIgnore: true */ process.env.MANAGED_ASSET_ROOT || process.env.MYOMATON_ASSET_ROOT || "runtime-assets");
}

export function managedKey(bytes: Buffer): string {
  return `objects/${createHash("sha256").update(bytes).digest("hex")}`;
}

export async function readBounded(file: string): Promise<Buffer> {
  const handle = await open(/* turbopackIgnore: true */ file, "r");
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size === 0 || stat.size > MAX_MANAGED_BYTES) throw new Error("Invalid managed object file size.");
    // Read at most the limit even if the file grows while open.
    const buffer = Buffer.alloc(MAX_MANAGED_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const read = await handle.read(buffer, length, buffer.length - length, null);
      if (!read.bytesRead) break;
      length += read.bytesRead;
    }
    if (length > MAX_MANAGED_BYTES) throw new Error("managed object file too large.");
    return buffer.subarray(0, length);
  } finally { await handle.close(); }
}

// Storage is operator-controlled. Reject symlinks/junctions at every managed
// component; the runtime directory must not be writable by untrusted processes.
async function managedPath(root: string, presenceId: string, key: string, create: boolean) {
  const presence = requireAssetUuid(presenceId);
  requireManagedKey(key);
  const configured = path.resolve(/* turbopackIgnore: true */ root);
  if (create) await mkdir(/* turbopackIgnore: true */ configured, { recursive: true });
  if ((await lstat(/* turbopackIgnore: true */ configured)).isSymbolicLink()) throw new Error("Storage root must not be a symlink.");
  const base = await realpath(/* turbopackIgnore: true */ configured);
  let directory = base;
  for (const segment of [presence, "objects"]) {
    directory = path.join(/* turbopackIgnore: true */ directory, segment);
    if (create) await mkdir(/* turbopackIgnore: true */ directory).catch((error: NodeJS.ErrnoException) => { if (error.code !== "EEXIST") throw error; });
    const stat = await lstat(/* turbopackIgnore: true */ directory);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Unsafe storage directory.");
    if (await realpath(/* turbopackIgnore: true */ directory) !== directory) throw new Error("Storage directory escaped its root.");
  }
  return path.join(/* turbopackIgnore: true */ directory, key.slice("objects/".length));
}

export async function readManagedObject(root: string, presenceId: string, key: string): Promise<Buffer> {
  const file = await managedPath(root, presenceId, key, false);
  const stat = await lstat(/* turbopackIgnore: true */ file);
  if (stat.isSymbolicLink() || !stat.isFile() || await realpath(/* turbopackIgnore: true */ file) !== file) throw new Error("Unsafe storage file.");
  const bytes = await readBounded(file);
  if (await realpath(/* turbopackIgnore: true */ file) !== file || managedKey(bytes) !== key) throw new Error("Managed object does not match its key.");
  return bytes;
}

export async function provisionManagedObject(root: string, presenceId: string, key: string, bytes: Buffer): Promise<void> {
  if (managedKey(bytes) !== requireManagedKey(key)) throw new Error("Managed object does not match its key.");
  if (!bytes.length || bytes.length > MAX_MANAGED_BYTES) throw new Error("Invalid managed object size.");
  const file = await managedPath(root, presenceId, key, true);
  try {
    const handle = await open(/* turbopackIgnore: true */ file, "wx");
    try { await handle.writeFile(bytes); } finally { await handle.close(); }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existing = await readManagedObject(root, presenceId, key);
    if (!existing.equals(bytes)) throw new Error("Existing managed object differs.");
  }
}
