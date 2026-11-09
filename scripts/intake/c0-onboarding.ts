import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { build } from "esbuild";
import { Pool } from "pg";
import reviewed from "../customer-updates/miopages-focus-reviewed.json";
import { disposableCluster } from "../backup/disposable-cluster";
import { migrateWithBootstrapCompatibility } from "../db/bootstrap";
import { developmentGuard } from "../../lib/platform/contact/boundaries";
import { normalizeKnowledge, normalizeOffering } from "../../lib/platform/canonical/model";
import { intakeHttp } from "../../lib/platform/intake/http";
import { IntakeService, type IntakeEvidence } from "../../lib/platform/intake/service";

const host = "127.0.0.1", port = 4320;
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'" };
const page = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Start with MioPages · Local rehearsal</title><link rel="stylesheet" href="/onboarding.css"><script defer src="/onboarding.js"></script></head><body><div id="onboarding"></div><noscript>This local interview requires JavaScript.</noscript></body></html>';

function prefill() {
  const presence = reviewed.after.web_presences.find(row => row.id === reviewed.target.webPresenceId)!;
  const knowledge = normalizeKnowledge(reviewed.after.business_knowledge.find(row => row.web_presence_id === presence.id)!.payload);
  const offering = normalizeOffering(reviewed.after.offerings.find(row => row.web_presence_id === presence.id)!.payload);
  const audience = knowledge.entries.find(row => row.key === "audience" && row.evidence.confirmation === "confirmed")!;
  const geography = knowledge.entries.find(row => row.key === "initial-geography" && row.evidence.confirmation === "confirmed")!;
  if (!geography.value.startsWith("Remote/national United States") || offering.evidence.confirmation !== "confirmed") throw Error("C0 discovery baseline changed");
  const answers = { businessName: presence.name, website: `https://${presence.primary_domain}/`, audience: audience.value, offer: offering.summary, serviceArea: "Nationwide" };
  const evidence = (reference: string): IntakeEvidence => ({ source: "c0-discovery", confirmation: "prior-approved", suppliedAt: knowledge.approval.at,
    reference: `docs/miopages-c0-business-brief.md · ${reference}`, author: knowledge.approval.by });
  return { answers, provenance: { businessName: evidence("business identity"), website: evidence("existing domain"), audience: evidence("confirmed audience"),
    offer: evidence("approved offer summary"), serviceArea: evidence("remote/national US; mapped to Nationwide") } };
}

export async function createC0Onboarding(bin: string) {
  const client = await build({ entryPoints: { onboarding: "scripts/intake/c0-onboarding-client.tsx" }, bundle: true, write: false,
    outdir: "onboarding", jsx: "automatic", platform: "browser", define: { "process.env.NODE_ENV": '"production"' }, minify: true });
  const assets = new Map(client.outputFiles.map(file => [file.path.endsWith(".css") ? "/onboarding.css" : "/onboarding.js", file.text]));
  if (assets.size !== 2) throw Error("Expected isolated interview assets");
  // This entry point creates its own password-protected loopback cluster. It
  // never reads a shared database URL, customer store, or hosted configuration.
  const cluster = await disposableCluster(bin);
  const pool = new Pool({ connectionString: cluster.url });
  try {
    await migrateWithBootstrapCompatibility(pool);
    const organization = randomUUID(), webPresenceId = randomUUID(), managedSiteId = randomUUID();
    await pool.query("INSERT INTO organizations(id,name,status) VALUES($1,'C0 onboarding rehearsal','active')", [organization]);
    await pool.query("INSERT INTO web_presences(id,organization_id,name,status) VALUES($1,$2,'C0 onboarding rehearsal','active')", [webPresenceId, organization]);
    await pool.query("INSERT INTO managed_sites(id,web_presence_id,name,status) VALUES($1,$2,'C0 onboarding rehearsal','active')", [managedSiteId, webPresenceId]);
    const selection = { webPresenceId, managedSiteId };
    const service = new IntakeService(pool, selection, { database: new URL(cluster.url).pathname.slice(1), ...prefill() });
    const abuse = developmentGuard(120);
    function listener() {
      const server = createServer(async (req, res) => {
        const addr = server.address();
        const send = (status: number, contentType: string, body: string) => res.writeHead(status, { ...headers, "Content-Type": contentType }).end(body);
        if (req.socket.remoteAddress !== host || !addr || typeof addr === "string" || req.headers.host !== `${host}:${addr.port}`) return send(403, "text/plain", "Local access required.");
        try {
          const route = req.url;
          if (route === "/api/onboarding" && (req.method === "GET" || req.method === "POST")) {
            const request = new Request(`http://${host}:${addr.port}/api/onboarding`, { method: req.method, headers: new Headers(req.headers as Record<string, string>),
              ...(req.method === "POST" && { body: Readable.toWeb(req), duplex: "half" }) } as RequestInit);
            const response = await intakeHttp(request, service, abuse, true);
            const body = await response.text();
            res.writeHead(response.status, { ...headers, ...Object.fromEntries(response.headers) }).end(body);
          } else if (req.method !== "GET") send(405, "text/plain", "Unsupported request.");
          else if (route === "/onboarding" || route === "/") send(200, "text/html; charset=utf-8", page);
          else if (route && assets.has(route)) send(200, route.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8", assets.get(route)!);
          else send(404, "text/plain", "Unknown rehearsal page.");
        } catch { send(503, "text/plain", "Local rehearsal unavailable."); }
      });
      return server;
    }
    return { listener, pool, selection, stop: async () => { try { await pool.end(); } finally { await cluster.stop(); } } };
  } catch (error) { try { await pool.end(); } finally { await cluster.stop(); } throw error; }
}

async function main() {
  const rehearsal = await createC0Onboarding(process.env.PG_BIN_DIR ?? "C:/Program Files/PostgreSQL/18/bin");
  const server = rehearsal.listener();
  try {
    server.listen(port, host); await once(server, "listening");
    console.log(`Customer 0 onboarding rehearsal: http://${host}:${port}/onboarding (Ctrl+C closes the disposable session)`);
    await new Promise<void>(resolve => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); });
  } finally {
    if (server.listening) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
    await rehearsal.stop();
  }
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/intake/c0-onboarding.ts")) {
  main().catch(() => { console.error("Unable to start isolated C0 onboarding. Check local PostgreSQL utilities and port 4320."); process.exitCode = 1; });
}
