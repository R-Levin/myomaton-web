import { createHash } from "node:crypto";
import { lstat, open, readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { fingerprint } from "../canonical/model";
import { validateOriginalGrant, type OriginalMaterialGrant, type OriginalMaterial } from "./presence-source-material";

/** Prepare authorized originals, never an excerpt. The caller establishes the
 * private directory/Windows ACL. Existing different data is never overwritten. */
export async function prepareOriginalCustody(root: string, grant: OriginalMaterialGrant, contextDigest: string,
  read: (source: OriginalMaterial) => Promise<Buffer>) {
  validateOriginalGrant(grant, contextDigest);
  const info = await lstat(root);
  if (!info.isDirectory() || info.isSymbolicLink() || await realpath(root) !== root ||
      process.platform !== "win32" && (info.uid !== process.getuid?.() || (info.mode & 0o777) !== 0o700)) {
    throw Error("Original source directory refused");
  }
  const input = await Promise.all(grant.records.map(async source => {
    const bytes = await read(source);
    if (bytes.length !== source.bytes || createHash("sha256").update(bytes).digest("hex") !== source.sha256) {
      throw Error("Original source differs from reviewed input");
    }
    return { source, bytes };
  }));
  async function save(path: string, bytes: Buffer) {
    let file;
    try { file = await open(path, "wx", 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const meta = await lstat(path);
      if (!meta.isFile() || meta.isSymbolicLink() || await realpath(path) !== path ||
          process.platform !== "win32" && (meta.uid !== info.uid || (meta.mode & 0o777) !== 0o600) ||
          !(await readFile(path)).equals(bytes)) throw Error("Original custody conflict");
      return;
    }
    try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
  }
  for (const { source, bytes } of input) await save(join(root, source.sha256 + ".source"), bytes);
  await save(join(root, "index.json"), Buffer.from(JSON.stringify(grant.records) + "\n"));
  return { records: input.length, bytes: input.reduce((sum, row) => sum + row.bytes.length, 0),
    descriptorDigest: fingerprint(grant.records) };
}
