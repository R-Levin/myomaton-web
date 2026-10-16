import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fingerprint } from "../../lib/platform/canonical/model";
import { evidencePacket, type Evidence, type Submission, type Owner, type PresenceCoverage } from "../../lib/platform/reviews/model";
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
// One logical adapter for both immutable snapshot sources; never a canonical reader.
export function fromSubmission(submission: Submission, owner: Owner, evidence: Evidence[], coverage: string, presence?: PresenceCoverage) { return evidencePacket(owner, submission, evidence, coverage, presence); }
export async function originalHumanPacket(evidence: Evidence[], coverage: string, presence?: PresenceCoverage, env: Record<string, string | undefined> = process.env) {
  const bundle = env.MIOPAGES_REVIEW_PRESERVATION_BUNDLE;
  if (!bundle?.trim() || !path.isAbsolute(bundle) || /[\u0000-\u001f\u007f]/.test(bundle)) throw Error("MIOPAGES_REVIEW_PRESERVATION_BUNDLE must name an explicit absolute preservation bundle directory for original-human preparation");
  const manifest = await readFile(bundle + "/manifest.json");
  if (sha(manifest) !== "49b3e12c1093dc9de6a46666e34510cbfd1de8cde5703880587c905cf8f75ecb") throw Error("Preservation authority changed");
  const m = JSON.parse(manifest.toString("utf8"));
  for (const f of m.files) { if (typeof f.file !== "string" || f.file.includes("..") || !/^[a-zA-Z0-9/_.-]+$/.test(f.file) || sha(await readFile(bundle + "/" + f.file)) !== f.sha256) throw Error("Preservation checksum failure"); }
  for (const s of m.sourceFileHashes) { const b = execFileSync("git", ["cat-file", "blob", m.source.applicationCommit + ":" + s.file], { windowsHide: true }); if (sha(b) !== s.sha256 || !b.equals(await readFile(bundle + "/" + s.storedFile))) throw Error("Accepted Git source mismatch"); }
  const item = m.records.find((r: { role: string }) => r.role === "firstHuman");
  const e = JSON.parse(await readFile(bundle + "/" + item.file, "utf8"));
  if (item.file !== "evidence/original-human-review.json" || e.intake.id !== "0e936ea0-ade4-4614-9710-a9d350b904df" || fingerprint({ intake: e.intake, submission: e.submission }) !== item.recordHash) throw Error("Wrong substantive human case");
  return fromSubmission(e.submission, { webPresenceId: e.intake.web_presence_id, managedSiteId: e.intake.managed_site_id }, evidence, coverage, presence);
}
