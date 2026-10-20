import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fingerprint } from "../../lib/platform/canonical/model";

// Fixed synthetic artifact only: no database, writer, arbitrary file or real data.
async function main() {
  if (process.env.NODE_ENV !== "development" || process.argv.slice(2).join(" ") !== "--synthetic-proof") throw Error("Explicit development synthetic inspection required");
  const root = "runtime-content/site-release-proof", html = await readFile(`${root}/inspection.html`, "utf8"), proof = JSON.parse(await readFile(`${root}/inspection.json`, "utf8"));
  if (proof.label !== "SYNTHETIC DISPOSABLE CONTENT RELEASE PROOF" || proof.noRealPublication !== true || proof.htmlDigest !== fingerprint(html) || proof.release.after_fingerprint !== proof.rollback.before_fingerprint || proof.release.before_fingerprint !== proof.rollback.after_fingerprint) throw Error("Exact synthetic release/rollback proof required");
  const route = `/release/${randomBytes(32).toString("hex")}`;
  const server = createServer((request, response) => {
    const address = server.address();
    if (!address || typeof address === "string" || request.headers.host !== `127.0.0.1:${address.port}` || request.url !== route || !["GET", "HEAD"].includes(request.method ?? "")) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'" });
    response.end(request.method === "HEAD" ? undefined : html);
  });
  server.listen(0, "127.0.0.1", () => { const address = server.address(); if (address && typeof address !== "string") console.log(`http://127.0.0.1:${address.port}${route}`); });
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
