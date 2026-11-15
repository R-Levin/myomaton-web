import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { BlockList } from "node:net";

const blocked = new BlockList();
for (const [base, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(base, bits, "ipv4");

export function publicResearchAddress(address: string) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(address) && address.split(".").every(part => Number(part) <= 255) &&
    !blocked.check(address, "ipv4");
}

// DNS is resolved once per request. The chosen global IPv4 is passed to the
// actual TLS connection without a second lookup; TLS still verifies the host.
export function pinnedResearchFetch(allowed: (url: URL) => boolean, byteLimit: number): typeof fetch {
  return async (input, init) => {
    const url = typeof input === "string" || input instanceof URL ? new URL(input) : null;
    if (!url || !allowed(url) || url.protocol !== "https:" || url.port || url.username || url.password ||
        url.search || url.hash || init?.redirect !== "error") throw Error("Research egress refused");
    const candidates = await lookup(url.hostname, { family: 4, all: true });
    if (!candidates.length || candidates.some(item => !publicResearchAddress(item.address))) throw Error("Research DNS refused");
    const signal = init.signal ?? AbortSignal.timeout(15_000);
    const address = candidates[0].address;
    return new Promise<Response>((resolve, reject) => {
      const fail = () => reject(Error("Research HTTPS operation unverified"));
      const req = request({
        protocol: "https:", hostname: url.hostname, servername: url.hostname, path: url.pathname, port: 443,
        family: 4, lookup: (_host, _opts, done) => done(null, address, 4),
        rejectUnauthorized: true, agent: false, signal, method: "GET", headers: {
          "Accept": "text/html", "Accept-Encoding": "identity", "User-Agent": "MioPages research reference fetch",
        },
      }, res => {
        const type = res.headers["content-type"];
        if (res.statusCode !== 200 || !type?.startsWith("text/html") || (res.headers["content-encoding"] && res.headers["content-encoding"] !== "identity")) {
          res.destroy(); fail(); return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > byteLimit) { res.destroy(); fail(); } else chunks.push(chunk);
        });
        res.on("error", fail);
        res.on("aborted", fail);
        res.on("end", () => {
          const response = new Response(new Uint8Array(Buffer.concat(chunks)), { status: 200, headers: { "content-type": type } });
          Object.defineProperty(response, "url", { value: url.href });
          resolve(response);
        });
      });
      req.on("error", fail);
      req.end();
    });
  };
}
