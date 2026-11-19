import { createHash } from "node:crypto";
import { lstat, open, readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { fingerprint } from "../canonical/model";
import { validateOriginalGrant, validateOriginalMaterial, verifyCandidateReview, type OriginalMaterialGrant, type OriginalMaterial } from "./presence-source-material";
import type { WorkflowRun } from "./presence-workflow";

type Material = { source: OriginalMaterial; bytes: Buffer };

async function privateDirectory(root: string) {
  const info = await lstat(root);
  if (!info.isDirectory() || info.isSymbolicLink() || await realpath(root) !== root ||
      process.platform !== "win32" && (info.uid !== process.getuid?.() || (info.mode & 0o777) !== 0o700)) {
    throw Error("Original source directory refused");
  }
  return info;
}

async function privateFile(path: string, uid: number) {
  const meta = await lstat(path);
  if (!meta.isFile() || meta.isSymbolicLink() || await realpath(path) !== path ||
      process.platform !== "win32" && (meta.uid !== uid || (meta.mode & 0o777) !== 0o600)) {
    throw Error("Original custody conflict");
  }
  return meta;
}

async function save(path: string, bytes: Buffer, uid: number) {
  let file;
  try { file = await open(path, "wx", 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    await privateFile(path, uid);
    if (!(await readFile(path)).equals(bytes)) throw Error("Original custody conflict");
    return;
  }
  try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
}

function verifyBytes({ source, bytes }: Material) {
  validateOriginalMaterial(source);
  if (bytes.length !== source.bytes || createHash("sha256").update(bytes).digest("hex") !== source.sha256) {
    throw Error("Original source differs from reviewed input");
  }
}

/** Prepare authorized originals, never an excerpt. The caller establishes the
 * private directory/Windows ACL. Existing different data is never overwritten. */
export async function prepareOriginalCustody(root: string, grant: OriginalMaterialGrant, contextDigest: string,
  read: (source: OriginalMaterial) => Promise<Buffer>) {
  validateOriginalGrant(grant, contextDigest);
  const info = await privateDirectory(root);
  const input = await Promise.all(grant.records.map(async source => {
    const row = { source, bytes: await read(source) };
    verifyBytes(row);
    return row;
  }));
  for (const { source, bytes } of input) await save(join(root, source.sha256 + ".source"), bytes, info.uid);
  await save(join(root, "index.json"), Buffer.from(JSON.stringify(grant.records) + "\n"), info.uid);
  return { records: input.length, bytes: input.reduce((sum, row) => sum + row.bytes.length, 0),
    descriptorDigest: fingerprint(grant.records) };
}

/** Input-scoped derived evidence uses the same private immutable source custody.
 * The trusted renderer/caller establishes what was actually rendered; hashes
 * bind those bytes, not the truth or quality of their depicted content. */
export async function prepareRenderedCandidateCustody(root: string, run: WorkflowRun, grant: OriginalMaterialGrant, rows: readonly Material[]) {
  validateOriginalGrant(grant, fingerprint(run.context));
  verifyCandidateReview(run, grant, rows);
  if (!rows.length) throw Error("Rendered candidate material required");
  rows.forEach(verifyBytes);
  const info = await privateDirectory(root);
  const index = { version: 1, contextDigest: fingerprint(run.context), inputDigest: run.work.inputDigest,
    sources: rows.map(row => row.source) };
  for (const { source, bytes } of rows) await save(join(root, source.sha256 + ".source"), bytes, info.uid);
  await save(join(root, run.work.inputDigest + ".review.json"), Buffer.from(JSON.stringify(index) + "\n"), info.uid);
  return { records: rows.length, bytes: rows.reduce((sum, row) => sum + row.bytes.length, 0), descriptorDigest: fingerprint(index) };
}

export async function readRenderedCandidateCustody(root: string, run: WorkflowRun, grant: OriginalMaterialGrant): Promise<Material[]> {
  validateOriginalGrant(grant, fingerprint(run.context));
  if (!grant.candidateReview?.operations.some(operation => operation === run.work.operation)) return [];
  const info = await privateDirectory(root);
  // Derive the name from a verified digest, never an operator-provided path.
  if (!/^[a-f0-9]{64}$/u.test(run.work.inputDigest) || fingerprint(run.input) !== run.work.inputDigest) throw Error("Rendered review input changed");
  const path = join(root, run.work.inputDigest + ".review.json");
  const metadata = await privateFile(path, info.uid);
  if (metadata.size > grant.requestBytes) throw Error("Rendered review index exceeds its request envelope");
  const index = JSON.parse((await readFile(path)).toString("utf8"));
  if (index.version !== 1 || index.contextDigest !== fingerprint(run.context) || index.inputDigest !== run.work.inputDigest ||
      !Array.isArray(index.sources)) throw Error("Rendered review index binding changed");
  // Validate the descriptors and aggregate size before reading image buffers.
  const sources = index.sources as OriginalMaterial[];
  sources.forEach(validateOriginalMaterial);
  const rows = sources.map(source => ({ source, bytes: Buffer.alloc(0) }));
  if (sources.some(source => source.purpose !== "candidate-review") ||
      sources.reduce((sum, source) => sum + source.bytes, 0) > grant.candidateReview.maximumBytes) throw Error("Rendered review source scope differs");
  verifyCandidateReview(run, grant, rows);
  return Promise.all(sources.map(async source => {
    const file = join(root, source.sha256 + ".source");
    const metadata = await privateFile(file, info.uid);
    if (metadata.size !== source.bytes) throw Error("Rendered candidate bytes changed");
    const row = { source, bytes: await readFile(file) };
    verifyBytes(row);
    return row;
  }));
}
