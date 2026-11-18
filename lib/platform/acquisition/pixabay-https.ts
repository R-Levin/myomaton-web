import { get, type RequestOptions } from "node:https";
import { open, lstat, realpath } from "node:fs/promises";
import { join } from "node:path";
import { fingerprint } from "../canonical/model";
import { pixabaySearch } from "./pixabay";
import { StockDiscovery } from "./stock-discovery";
import { privateStockSearchCache } from "./stock-search-cache";
import type { SuppliedMediaAuthority } from "./supplied-media";

type Reply = { status: number; contentType?: string; body: AsyncIterable<Uint8Array> };
export type PixabaySend = (options: RequestOptions) => Promise<Reply>;
const isJson = (value?: string) => /^application\/json(?:\s*;|$)/i.test(value ?? "");
const bodyLimit = 128 * 1024;

export const sendPixabayHttps: PixabaySend = options => new Promise((resolve, reject) => {
  const request = get(options, response => {
    const status = response.statusCode ?? 0, contentType = response.headers["content-type"];
    if (status !== 200 || !isJson(contentType)) response.destroy();
    resolve({ status, contentType, body: response });
  });
  request.on("error", () => reject(Error("Pixabay HTTPS request failed")));
});

/** The API requires its key in the transient HTTPS request path. Neither the
 * URL, key, nor a transport error containing them is returned or persisted. */
export async function readPixabayResponse(key: string, params: URLSearchParams, send: PixabaySend = sendPixabayHttps) {
  if (!/^[A-Za-z0-9_-]{12,128}$/.test(key)) throw Error("invalid_local_key_format");
  if (["NODE_DEBUG", "NODE_DEBUG_NATIVE", "SSLKEYLOGFILE", "NODE_USE_ENV_PROXY"].some(name => process.env[name])) {
    throw Error("Unsafe stock request diagnostics");
  }
  const authenticated = new URLSearchParams(params);
  authenticated.set("key", key);
  let reply: Reply;
  try {
    reply = await send({ protocol: "https:", hostname: "pixabay.com", port: 443, method: "GET",
      path: "/api/?" + authenticated.toString(), agent: false, rejectUnauthorized: true,
      headers: { accept: "application/json", "accept-encoding": "identity", "user-agent": "MioPages/1 operator search" },
      signal: AbortSignal.timeout(12_000) });
  } catch { throw Error("Pixabay HTTPS request failed"); }
  if (reply.status !== 200) return { status: reply.status, body: null };
  if (!isJson(reply.contentType)) throw Error("unexpected_content_type");
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of reply.body) {
      size += chunk.byteLength;
      if (size > bodyLimit) throw Error("response_too_large");
      chunks.push(Buffer.from(chunk));
    }
  } catch (error) {
    if (error instanceof Error && error.message === "response_too_large") throw Error("response_too_large");
    throw Error("Pixabay response unavailable");
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (raw.includes(key)) throw Error("credential_reflected");
  let body: unknown;
  try { body = JSON.parse(raw); } catch { throw Error("invalid_json"); }
  if (JSON.stringify(body).includes(key)) throw Error("credential_reflected");
  return { status: 200, body };
}

/** Only the exact human-requested searches are eligible. A failed/ambiguous
 * dispatch keeps its receipt and cannot be silently repeated after restart.
 * Placement and rights authority remain in the existing acquisition lifecycle. */
export function privatePixabayDiscovery(options: { key: string; directory: string; queries: readonly string[];
  authority: SuppliedMediaAuthority; recheck: () => Promise<void>; send?: PixabaySend }) {
  const normalized = options.queries.map(query => query.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase());
  if (!normalized.length || normalized.some(query => !query || query.length > 100) ||
      new Set(normalized).size !== normalized.length) throw Error("Exact Operator stock searches required");
  const provider = pixabaySearch(async params => {
    const query = params.get("q")!;
    if (!normalized.includes(query)) throw Error("Stock query outside authorized request");
    await options.recheck();
    const meta = await lstat(options.directory);
    if (!meta.isDirectory() || meta.isSymbolicLink() || await realpath(options.directory) !== options.directory ||
        process.platform !== "win32" && (meta.uid !== process.getuid?.() || (meta.mode & 0o777) !== 0o700)) {
      throw Error("Private stock request custody refused");
    }
    const file = await open(join(options.directory, fingerprint({ query }) + ".attempt.json"), "wx", 0o600);
    try { await file.writeFile(JSON.stringify({ query, startedAt: new Date().toISOString(), automaticRetries: 0 })); await file.sync(); }
    finally { await file.close(); }
    return readPixabayResponse(options.key, params, options.send);
  });
  return new StockDiscovery(provider, options.authority, privateStockSearchCache(options.directory));
}
