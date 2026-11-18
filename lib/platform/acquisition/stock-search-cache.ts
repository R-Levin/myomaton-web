import { lstat, open, readFile, realpath, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { fingerprint } from "../canonical/model";
import type { StockSearchCache, StockSearchHit } from "./stock-discovery";

/** Private 24-hour provider cache. A shared filesystem lock prevents parallel
 * workers from buying or dispatching the same uncached search twice. */
export function privateStockSearchCache(root: string): StockSearchCache {
  return { async readOrCreate(query, acquire) {
    const meta = await lstat(root);
    if (!meta.isDirectory() || meta.isSymbolicLink() || await realpath(root) !== root ||
        process.platform !== "win32" && (meta.uid !== process.getuid?.() || (meta.mode & 0o777) !== 0o700)) {
      throw Error("Private stock cache directory refused");
    }
    const path = join(root, fingerprint({ query }) + ".json"), lock = await open(path + ".lock", "wx", 0o600);
    try {
      let stored: { query: string; expiresAt: number; results: StockSearchHit[]; digest: string } | undefined;
      try {
        const info = await lstat(path);
        if (!info.isFile() || info.isSymbolicLink() || await realpath(path) !== path ||
            process.platform !== "win32" && (info.uid !== meta.uid || (info.mode & 0o777) !== 0o600)) throw Error("Stock cache custody differs");
        stored = JSON.parse(await readFile(path, "utf8"));
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      if (stored) {
        const { digest, ...body } = stored;
        if (digest !== fingerprint(body) || stored.query !== query || !Array.isArray(stored.results) ||
            !Number.isSafeInteger(stored.expiresAt)) throw Error("Stock cache integrity differs");
        if (stored.expiresAt > Date.now()) return { expiresAt: stored.expiresAt, results: stored.results };
      }
      const results = await acquire(), expiresAt = Date.now() + 24 * 3600_000;
      const body = { query, expiresAt, results };
      const output = await open(path + ".next", "wx", 0o600);
      try { await output.writeFile(JSON.stringify({ ...body, digest: fingerprint(body) })); await output.sync(); } finally { await output.close(); }
      await rename(path + ".next", path);
      return { results, expiresAt };
    } finally { await lock.close(); await unlink(path + ".lock"); }
  } };
}
