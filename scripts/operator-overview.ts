import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import reviewed from "./customer-updates/miopages-focus-reviewed.json";
import { sourceSans } from "../lib/platform/presentation/fonts";
import { accountPath, previewPath, snapshotAccount } from "./operator-overview/model";
import { exactPreviewPath, loadProposalEvidence } from "./operator-overview/proposal-evidence";
import { loadC0Review } from "./operator-overview/c0-review";
import { accountView, onboardingEvidenceView, overview, pageView, proposalEvidenceView } from "./operator-overview/views";
import { loadOnboardingEvidence, onboardingEvidencePath, type OnboardingEvidence } from "./operator-overview/onboarding-evidence";

const host = "127.0.0.1";
const port = 4317;
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
};
const roleScript = "/operator-role.js";
const designCaptures: Record<string, readonly [name: string, digest: string]> = {
  "/": ["home", "c1f2974e1d4dac7a8062c29deea843c2bbcc61b3424079d698a5f044c422c9e7"],
  "/service": ["service", "e009cdbf30afc113d73fa47ebfc091df9dbd24a6df76d867b2490c1b6327dfb7"],
  "/experience": ["experience", "5aad2217ca3fd094a24997adc2ae3b5d5c6fb75a6ce0926fe10065930123e3bf"],
  "/review": ["review", "64e40435fbe903826ef2c6d3fc35ab06cd9ce4a305afa2ea04dee71a4ecc733d"],
};

export async function createOperatorOverview(onboarding?: OnboardingEvidence) {
  const account = snapshotAccount(reviewed.after, reviewed.target);
  const [evidence, review] = await Promise.all([loadProposalEvidence(), loadC0Review(reviewed.target)]);
  if (evidence && (evidence.latest.scope.webPresenceId === account.id || evidence.latest.scope.managedSiteId === reviewed.target.managedSiteId)) {
    throw Error("Synthetic proposal evidence must stay separate from the C0 account");
  }
  const routes = new Map<string, { type: string; body: Buffer | string; interactive?: boolean }>();
  const html = (path: string, body: string | null) => {
    if (!body) throw Error("Expected reviewed preview");
    routes.set(path, { type: "text/html; charset=utf-8", body, interactive: true });
  };
  html("/", overview([account], Boolean(evidence), Boolean(onboarding)));
  if (onboarding) html(onboardingEvidencePath, onboardingEvidenceView(onboarding));
  html(accountPath(account.id), accountView(account, review));
  if (evidence) {
    const development = proposalEvidenceView(evidence);
    html("/development-evidence", development);
    html(accountPath(evidence.latest.scope.webPresenceId), development);
    for (const { revision, preview } of evidence.revisions) {
      if (preview) routes.set(exactPreviewPath(evidence, revision.binding.revision), { type: "text/html; charset=utf-8", body: preview.html });
    }
  }
  for (const page of account.pages) {
    const path = previewPath(account.id, String(page.id));
    const capture = designCaptures[String(page.slug)];
    const bytes = capture && await readFile(`runtime-content/business-focus-final/miopages-desktop-${capture[0]}.png`).catch(() => null);
    const verified = bytes && createHash("sha256").update(bytes).digest("hex") === capture[1];
    const imagePath = `${path}/accepted-design.png`;
    if (verified) routes.set(imagePath, { type: "image/png", body: bytes });
    html(path, pageView(account, String(page.id), verified ? imagePath : undefined));
  }
  routes.set(roleScript, { type: "text/javascript; charset=utf-8", body: await readFile("scripts/operator-overview/role-preview.js") });
  routes.set("/operator.css", { type: "text/css; charset=utf-8", body: await readFile("scripts/operator-overview/operator.css") });
  const styles = await Promise.all(["app/presentation.css", "app/focus-presentation.css"].map(file => readFile(file, "utf8")));
  for (const font of sourceSans.resources) {
    routes.set(font.path, { type: "font/woff2", body: await readFile(`public${font.path}`) });
    styles.push(`@font-face{font-family:"Source Sans 3";font-weight:${font.weight};font-display:swap;src:url("${font.path}") format("woff2")}`);
  }
  routes.set("/presentation.css", { type: "text/css; charset=utf-8", body: styles.join("\n") });

  const server = createServer((request, response) => {
    const address = server.address();
    const path = request.url ?? "";
    const route = routes.get(path);
    const reply = (status: number, message: string, extra = {}) => {
      response.writeHead(status, { ...headers, "Content-Type": "text/plain; charset=utf-8", ...extra }).end(message);
    };
    if (request.socket.remoteAddress !== host || !address || typeof address === "string" || request.headers.host !== `${host}:${address.port}`) return reply(403, "Loopback access required");
    if (request.headers["sec-fetch-site"] === "cross-site" && request.headers["sec-fetch-mode"] !== "navigate") return reply(403, "Open the local console directly");
    if (request.method !== "GET") return reply(405, "Read-only review", { Allow: "GET" });
    if (!route) return reply(404, "Unknown review page");
    const policy = route.interactive ? `${headers["Content-Security-Policy"]}; script-src 'self'` : headers["Content-Security-Policy"];
    response.writeHead(200, { ...headers, "Content-Type": route.type, "Content-Security-Policy": policy }).end(route.body);
  });
  return server;
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/operator-overview.ts")) {
  async function main() {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== "--onboarding-review")) throw Error("Unexpected review arguments");
    const onboarding = args.length ? await loadOnboardingEvidence(args[1]) : undefined;
    const listenPort = onboarding ? 4322 : port;
    const path = onboarding ? onboardingEvidencePath : "/";
    const server = await createOperatorOverview(onboarding);
    server.on("error", () => { console.error(`Could not bind the local Operator view to ${host}:${listenPort}.`); process.exitCode = 1; });
    server.listen(listenPort, host, () => console.log(`MioPages Operator review http://${host}:${listenPort}${path} (Ctrl+C to stop)`));
  }
  main().catch(() => { console.error("Could not prepare the requested local review evidence."); process.exitCode = 1; });
}
