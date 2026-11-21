/** Controlled browser regression of the real Core UI. Not a customer/model proof. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright-core";

async function main() {
const directory = resolve("runtime-content/current-core-ui-browser");
await mkdir(directory, { recursive: true });
const entry = join(directory, "entry.tsx");
await writeFile(entry, `import React from 'react';import{createRoot}from'react-dom/client';import{Journey}from'../../scripts/intake/c0-site-journey-client';createRoot(document.getElementById('root')!).render(<Journey hosted/>);`);
await build({ entryPoints: [entry], outfile: join(directory, "app.js"), bundle: true, platform: "browser", format: "iife", jsx: "automatic",
  loader: { ".css": "local-css" }, define: { "process.env.NODE_ENV": '"production"', "process.env.__NEXT_IMAGE_OPTS": "undefined", "process.env": "{}" } });
const pages = ["/", "/service"].map((path, i) => ({ path, heading: i ? "Controlled Service" : "Controlled Home",
  searchTitle: "Controlled search title", searchDescription: "Browser fixture only", sections: [{ heading: "Fixture opening", body: "Revised controlled wording", sourceIds: ["fixture"] }], actions: [], internalLinks: [] }));
const review = { kind: "retained-site-review/1", scope: { webPresenceId: "fixture", managedSiteId: "fixture" }, intakeId: "fixture",
  revision: 2, baselineRevision: 1, candidateDigest: "fixture", origin: "retained-core-ai", readonly: true,
  lineage: { evidenceVersion: 1, report: { generatedVersion: 1, predatesEvidence: false }, direction: { generatedVersion: 1, predatesEvidence: false }, blueprint: { generatedVersion: 1, predatesEvidence: false } },
  understanding: [{ id: "fixture", label: "Controlled business record", kind: "owner-confirmed", reference: "Browser fixture, not genuine C0 knowledge", date: null,
    content: "Visible controlled information.\n\nHIDDEN_SOURCE_MARKER", use: "staffed-offer" }], references: [],
  referenceImages: [{ id: "fixture-reference", label: "Controlled earlier reference" }], report: { title: "Fixture assessment", summary: "Controlled test assessment, not genuine AI reasoning.", findings: [] },
  direction: null, blueprint: { navigation: ["/", "/service"], pages: pages.map(page => ({ path: page.path, label: page.heading, purpose: "Controlled navigation test" })), articles: [] },
  pages, previousPages: pages, changes: pages.map(page => ({ path: page.path, label: page.heading,
    before: { ...page, sections: [{ ...page.sections[0], body: "Earlier controlled wording" }] }, after: page })),
  needsUnderstandingRefresh: false, editorial: { summary: "Controlled test concerns", concerns: [] }, editorialFindings: [], unresolved: [] };
const view = { prepared: { scenario: "c0", sources: [] }, state: "draft", version: 28, answers: {},
  portal: { role: "operator", identity: "Fixture Operator", account: "Controlled fixture", site: "Controlled fixture", environment: "local-rehearsal" }, currentSiteReview: review };
let refusePreview = false, expire = false, reads = 0;
const server = createServer(async (request, response) => {
  const send = (status: number, type: string, body: string | Buffer) => response.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" }).end(body);
  if (request.url === "/app.js" || request.url === "/app.css") return send(200, request.url.endsWith("css") ? "text/css" : "text/javascript", await readFile(join(directory, request.url.slice(1))));
  if (request.url !== "/api/protected-core") return send(200, "text/html", '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script>');
  if (request.headers["x-core-operation"] === "logout") { response.setHeader("Set-Cookie", "fixture_session=;Max-Age=0;Path=/"); return send(200, "application/json", "{}"); }
  if (request.method === "POST") {
    let bytes = ""; for await (const chunk of request) bytes += chunk;
    const input = JSON.parse(bytes);
    if (input.operation !== "sign-in" || input.password !== "browser-test-password-only") return send(401, "application/json", "{}");
    response.setHeader("Set-Cookie", "fixture_session=1;HttpOnly;SameSite=Strict;Path=/"); return send(200, "application/json", "{}");
  }
  if (!request.headers.cookie?.includes("fixture_session=1") || expire) return send(401, "application/json", "{}");
  if (request.headers["x-core-review-reference"]) {
    response.setHeader("X-Image-Width", "1"); response.setHeader("X-Image-Height", "1");
    return send(200, "image/png", Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSQ0AAAAASUVORK5CYII=", "base64"));
  }
  if (request.headers["x-core-review-page"]) {
    reads++;
    if (refusePreview) { refusePreview = false; return send(503, "application/json", "{}"); }
    const path = request.headers["x-core-review-page"], before = request.headers["x-core-review-before"] === "1";
    return send(200, "text/html", `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline'"><style>body{margin:0;padding:24px;font:18px Arial}a{display:inline-block;margin:12px}</style><h1>${before ? "Earlier" : "Proposed"} ${path === "/" ? "Home" : "Service"}</h1><a href="/?page_id=1&preview=true">Home</a><a href="/?page_id=2&preview=true">Service</a><p>Controlled preview, not a genuine generated website.</p>`);
  }
  if (request.headers["x-core-original-records"] === "1") return send(200, "application/json", JSON.stringify({ ...view, currentSiteReview: undefined, originalAccountRecords: true, workflowAvailable: true, workflow: null }));
  return send(200, "application/json", JSON.stringify(view));
});
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address(); assert.ok(address && typeof address !== "string"); const origin = "http://127.0.0.1:" + address.port;
const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, chromiumSandbox: true });
const errors: string[] = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const signIn = async () => { await page.getByLabel("Password", { exact: true }).fill("browser-test-password-only"); await page.getByRole("button", { name: "Sign in", exact: true }).click(); await page.getByRole("heading", { name: "Your business and website work" }).waitFor(); };
  await page.goto(origin + "/core"); await signIn();
  assert.match(await page.getByLabel("Temporary review guide").first().innerText(), /Core · Operator workspace/);
  assert.ok(!(await page.locator("body").innerText()).includes("HIDDEN_SOURCE_MARKER"));
  await page.screenshot({ path: join(directory, "business-desktop.png"), fullPage: true });
  await page.getByText("Original account records and tools", { exact: true }).click();
  await page.getByRole("button", { name: "Open original account records", exact: true }).click();
  await page.getByRole("button", { name: "Return to the current website work", exact: true }).click();
  await page.getByRole("heading", { name: "Your business and website work" }).waitFor();
  await page.getByRole("button", { name: "Website proposal", exact: true }).click();
  await page.frameLocator("iframe").getByRole("heading", { name: "Proposed Home" }).waitFor();
  await page.frameLocator("iframe").getByRole("link", { name: "Service", exact: true }).click();
  await page.frameLocator("iframe").getByRole("heading", { name: "Proposed Service" }).waitFor();
  await page.getByRole("button", { name: "Mobile", exact: true }).click();
  await page.getByLabel("Show the earlier version").check();
  await page.frameLocator("iframe").getByRole("heading", { name: "Earlier Service" }).waitFor();
  await page.reload(); await page.frameLocator("iframe").getByRole("heading", { name: "Earlier Service" }).waitFor();
  assert.equal(await page.getByLabel("Page", { exact: true }).inputValue(), "/service");
  assert.equal(await page.getByRole("button", { name: "Mobile", exact: true }).getAttribute("aria-pressed"), "true");
  await page.setViewportSize({ width: 390, height: 900 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: join(directory, "website-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Changes and open decisions", exact: true }).click();
  await page.getByRole("heading", { name: "What changed in the saved proposal" }).waitFor();
  assert.ok((await page.locator("body").innerText()).includes("Earlier controlled wording"));
  refusePreview = true; await page.getByRole("button", { name: "Website proposal", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "could not render" }).waitFor();
  assert.equal(await page.getByLabel("Page", { exact: true }).inputValue(), "/service");
  await page.getByLabel("Page", { exact: true }).selectOption("/"); await page.frameLocator("iframe").getByRole("heading", { name: "Proposed Home" }).waitFor();
  expire = true; await page.getByLabel("Page", { exact: true }).selectOption("/service");
  await page.getByRole("button", { name: "Sign in", exact: true }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Your business and website work" }).count(), 0);
  expire = false; await signIn(); await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).waitFor();
  assert.deepEqual(errors, []);
  const receipt = { status: "PASS", kind: "controlled-browser-regression", realCoreComponents: true,
    genuineModelProof: false, actualHostedOwnerLogin: false, desktopMobile: true, inConsoleNavigation: true,
    reloadPreservesSelection: true, beforeAfter: true, refusalPreservesSelection: true, expiryAndLogoutClearPrivateView: true,
    previewReads: reads, providerRequests: 0, pageErrors: errors };
  await writeFile(join(directory, "receipt.json"), JSON.stringify(receipt, null, 2)); console.log(JSON.stringify(receipt));
} finally { await browser.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
}
void main().catch(error => { console.error(error); process.exit(1); });
