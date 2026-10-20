import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fingerprint } from "../../lib/platform/canonical/model";
import { proposalOnly } from "../../lib/platform/content-editing/proposal";

// Fixed synthetic artifact only. Never a customer/public proposal endpoint.
// No database, writer, arbitrary path, external resource or operational CTA.
async function main() {
  proposalOnly();
  const flag = process.argv.slice(2).join(" ");
  if (!["--synthetic-proof", "--durable-synthetic-proof"].includes(flag)) throw Error("Explicit synthetic proof selection required");
  const durable = flag === "--durable-synthetic-proof", root = durable ? "runtime-content/site-proposal-durable-proof" : "runtime-content/site-proposal-proof";
  const html = await readFile(`${root}/candidate.html`, "utf8");
  const evidence = JSON.parse(await readFile(`${root}/inspection.json`, "utf8"));
  const label = durable ? "SYNTHETIC DURABLE DATABASE PROOF; disposable source removed" : "SYNTHETIC DISPOSABLE EVIDENCE ONLY; source fixture removed after proof";
  const digest = durable ? evidence.state?.approval?.previewDigest : evidence.previewDigest;
  if (evidence.label !== label || digest !== fingerprint(html) || durable && (evidence.state?.state !== "APPROVED" || evidence.state?.published !== false || evidence.activeSiteUnchanged !== true || evidence.rereadAfterReopen !== true)) throw Error("Exact synthetic proof digest required");
  const token = randomBytes(32).toString("hex"), route = `/proposal/${token}`;
  const server = createServer((request, response) => {
    const address = server.address();
    if (!address || typeof address === "string" || request.headers.host !== `127.0.0.1:${address.port}` || request.url !== route || !["GET", "HEAD"].includes(request.method ?? "")) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'" });
    response.end(request.method === "HEAD" ? undefined : html);
  });
  server.listen(0, "127.0.0.1", () => {
    const address = server.address(); if (!address || typeof address === "string") throw Error("Loopback preview unavailable");
    console.log(`Synthetic approved candidate snapshot only; no live schema or publication.\nhttp://127.0.0.1:${address.port}${route}`);
  });
  server.on("error", error => { console.error(error.message); process.exitCode = 1; });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
