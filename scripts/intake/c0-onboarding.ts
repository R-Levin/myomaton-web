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
import { prepareC0, prepareC2 } from "./adaptive-sources";
import { coreInterviewApi, createCoreInterview } from "./core-interview";

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

async function browserAssets(entry: string) {
  const client = await build({ entryPoints: { onboarding: entry }, bundle: true, write: false,
    outdir: "onboarding", jsx: "automatic", platform: "browser", define: { "process.env.NODE_ENV": '"production"' }, minify: true });
  const assets = new Map(client.outputFiles.map(file => [file.path.endsWith(".css") ? "/onboarding.css" : "/onboarding.js", file.text]));
  if (assets.size !== 2) throw Error("Expected isolated interview assets");
  return assets;
}

function localListener(handle: (route: string, request: Request) => Promise<Response>, assets: Map<string, string>, pages: string[]) {
  const server = createServer(async (req, res) => {
    const addr = server.address();
    const send = (status: number, contentType: string, body: string) => res.writeHead(status, { ...headers, "Content-Type": contentType }).end(body);
    if (req.socket.remoteAddress !== host || !addr || typeof addr === "string" || req.headers.host !== `${host}:${addr.port}`) {
      return send(403, "text/plain", "Local access required.");
    }
    try {
      const route = (req.url ?? "").split("?", 1)[0];
      if (route.startsWith("/api/")) {
        const request = new Request(`http://${host}:${addr.port}${route}`, { method: req.method,
          headers: new Headers(req.headers as Record<string, string>),
          ...(req.method === "POST" && { body: Readable.toWeb(req), duplex: "half" }) } as RequestInit);
        const response = await handle(route, request);
        res.writeHead(response.status, { ...headers, ...Object.fromEntries(response.headers) }).end(await response.text());
      } else if (req.method !== "GET") send(405, "text/plain", "Unsupported request.");
      else if (pages.includes(route)) send(200, "text/html; charset=utf-8", page);
      else if (assets.has(route)) send(200, route.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8", assets.get(route)!);
      else send(404, "text/plain", "Unknown rehearsal page.");
    } catch { send(503, "text/plain", "Local rehearsal unavailable."); }
  });
  return server;
}

export async function createCoreInterviewRehearsal(bin: string) {
  const assets = await browserAssets("scripts/intake/core-interview-client.tsx");
  const { handle, credentials, close } = await createCoreInterview(bin);
  return { listener: () => localListener((route, request) => route === coreInterviewApi || route.startsWith(coreInterviewApi + "/")
    ? handle(request, route) : Promise.resolve(new Response(null, { status: 404 })), assets, ["/", "/onboarding"]),
  credentials, stop: close };
}

export async function createC0Onboarding(bin: string, adaptive = false) {
  const assets = await browserAssets(adaptive ? "scripts/intake/adaptive-onboarding-client.tsx" : "scripts/intake/c0-onboarding-client.tsx");
  // This entry point creates its own password-protected loopback cluster. It
  // never reads a shared database URL, customer store, or hosted configuration.
  const cluster = await disposableCluster(bin);
  const pool = new Pool({ connectionString: cluster.url });
  try {
    await migrateWithBootstrapCompatibility(pool);
    async function scope(name: string) {
      const organization = randomUUID(), webPresenceId = randomUUID(), managedSiteId = randomUUID();
      await pool.query("INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')", [organization, name]);
      await pool.query("INSERT INTO web_presences(id,organization_id,name,status) VALUES($1,$2,$3,'active')", [webPresenceId, organization, name]);
      await pool.query("INSERT INTO managed_sites(id,web_presence_id,name,status) VALUES($1,$2,$3,'active')", [managedSiteId, webPresenceId, name]);
      return { webPresenceId, managedSiteId };
    }
    const database = new URL(cluster.url).pathname.slice(1);
    const selection = await scope("C0 onboarding rehearsal");
    const c0 = adaptive ? { answers: {}, provenance: {}, prepared: await prepareC0() } : prefill();
    const service = new IntakeService(pool, selection, { database, ...c0 });
    const routes = new Map([["/api/onboarding", service]]);
    if (adaptive) routes.set("/api/onboarding/customer-2", new IntakeService(pool, await scope("Fictional C2 onboarding rehearsal"),
      { database, answers: {}, provenance: {}, prepared: prepareC2() }));
    const abuse = developmentGuard(120);
    const listener = () => localListener((route, request) => {
      const intake = routes.get(route);
      if (intake && (request.method === "GET" || request.method === "POST")) return intakeHttp(request, intake, abuse, true);
      return Promise.resolve(new Response(null, { status: request.method === "GET" ? 404 : 405 }));
    }, assets, ["/", "/onboarding", ...(adaptive ? ["/onboarding/customer-2"] : [])]);
    return { listener, pool, selection, stop: async () => { try { await pool.end(); } finally { await cluster.stop(); } } };
  } catch (error) { try { await pool.end(); } finally { await cluster.stop(); } throw error; }
}

async function main() {
  const adaptive = process.argv[2] === "--adaptive", core = process.argv[2] === "--core-interview";
  if (process.argv.length > (adaptive || core ? 3 : 2)) throw Error("Unexpected rehearsal argument");
  const listenPort = core ? 4323 : adaptive ? 4321 : port;
  const bin = process.env.PG_BIN_DIR ?? "C:/Program Files/PostgreSQL/18/bin";
  if (core) {
    if (process.env.NODE_ENV === "production") throw Error("Development interview only");
    Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" });
  }
  const rehearsal = core ? await createCoreInterviewRehearsal(bin) : await createC0Onboarding(bin, adaptive);
  const server = rehearsal.listener();
  try {
    server.listen(listenPort, host); await once(server, "listening");
    console.log(`Onboarding rehearsal: http://${host}:${listenPort}/onboarding (Ctrl+C closes the disposable session)`);
    if ("credentials" in rehearsal) {
      console.log("Local sign-in codes. Keep them in this terminal.");
      for (const [name, code] of Object.entries(rehearsal.credentials)) console.log(`${name}: ${code}`);
    }
    if (adaptive) console.log(`Fictional Customer 2: http://${host}:${listenPort}/onboarding/customer-2`);
    await new Promise<void>(resolve => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); });
  } finally {
    if (server.listening) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
    await rehearsal.stop();
  }
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/intake/c0-onboarding.ts")) {
  main().catch(() => { console.error("Unable to start isolated onboarding. Check local PostgreSQL utilities and the selected loopback port."); process.exitCode = 1; });
}
