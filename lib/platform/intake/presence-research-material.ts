import { createHash, randomUUID } from "node:crypto";
import { lstat, open, readFile, realpath, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { OriginalMaterial, OriginalMaterialGrant } from "./presence-source-material";
import type { PublicResearchSource, ResearchOriginalCustody } from "./presence-workflow-research";

const operations = ["report", "direction", "blueprint", "page", "editorial"] as const;

export function researchMaterialCustody(root: string, grant: OriginalMaterialGrant,
  recheck: () => Promise<void>,
  render?: (source: PublicResearchSource, bytes: Buffer) => Promise<{
    captured: { viewport: "desktop" | "mobile"; bytes: Buffer; width: number; height: number }[]; limitations: string[];
  }>): ResearchOriginalCustody {
  if (!grant.publicResearch || grant.publicResearch.screenshots && !render) throw Error("Original research capture required");
  const permitted = grant.publicResearch;
  async function retain(source: PublicResearchSource, bytes: Buffer, viewport?: "desktop" | "mobile", limitations: string[] = [], rawDigest?: string) {
    await recheck();
    const directory = await lstat(root);
    if (!directory.isDirectory() || directory.uid !== process.getuid?.() || (directory.mode & 0o777) !== 0o700 ||
        await realpath(root) !== root) throw Error("Private research directory refused");
    const index = join(root, "index.json"), lock = await open(index + ".lock", "wx", 0o600);
    try {
      const meta = await lstat(index);
      if (!meta.isFile() || meta.uid !== directory.uid || (meta.mode & 0o777) !== 0o600 || await realpath(index) !== index) {
        throw Error("Private research index refused");
      }
      const records = JSON.parse(await readFile(index, "utf8")) as OriginalMaterial[];
      const digest = createHash("sha256").update(bytes).digest("hex");
      const entry: OriginalMaterial = {
        id: source.id + (viewport ? "-" + viewport : "-html"), sha256: digest, bytes: bytes.length,
        mime: viewport ? "image/png" : "text/html", reference: source.url, author: source.label,
        date: new Date().toISOString(), status: "public-observation", purpose: "market-research",
        // Complete observed text already travels in run.input.research. Preserve
        // raw HTML for audit/browser rendering without repeating CSS/scripts in
        // every prose request. Both real viewport images reach later stages.
        operations: viewport ? operations : ["research"], researchSourceId: source.id,
        ...(rawDigest && { derivedFromSha256: rawDigest }),
      };
      const existing = records.find(item => item.id === entry.id);
      if (existing) {
        if (existing.sha256 !== entry.sha256 || existing.bytes !== entry.bytes) throw Error("Research original changed within a run");
        return;
      }
      const research = records.filter(item => item.researchSourceId);
      if (research.length + 1 > permitted.maximumRecords || research.reduce((n, item) => n + item.bytes, bytes.length) > permitted.maximumBytes) {
        throw Error("Original research custody envelope exceeded");
      }
      const path = join(root, digest + ".source");
      let file;
      try { file = await open(path, "wx", 0o600); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        const meta = await lstat(path);
        if (!meta.isFile() || meta.uid !== directory.uid || (meta.mode & 0o777) !== 0o600 ||
            await realpath(path) !== path || !(await readFile(path)).equals(bytes)) throw Error("Research original custody collision");
      }
      if (file) { try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); } }
      const temporary = index + "." + randomUUID() + ".tmp";
      const output = await open(temporary, "wx", 0o600);
      try { await output.writeFile(JSON.stringify([...records, entry]) + "\n"); await output.sync(); } finally { await output.close(); }
      await recheck();
      await rename(temporary, index);
      if (limitations.length) {
        const receipt = await open(join(root, digest + ".capture-limitations.json"), "wx", 0o600);
        try { await receipt.writeFile(JSON.stringify({ source: source.id, viewport, limitations })); } finally { await receipt.close(); }
      }
    } finally { await lock.close(); await unlink(index + ".lock"); }
  }
  return {
    retain: (source, bytes) => retain(source, bytes),
    ...(render && { async render(source: PublicResearchSource, html: Buffer) {
      const result = await render(source, html);
      for (const capture of result.captured) await retain(source, capture.bytes, capture.viewport, result.limitations,
        createHash("sha256").update(html).digest("hex"));
    } }),
  };
}
