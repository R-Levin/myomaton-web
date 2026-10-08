import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { JSDOM } from "jsdom";
import { manifest } from "./customer-initializers/miopages-c0";
import { prepareDisposablePreview } from "./customer-previews/disposable";
import { focusMioPagesPreview as mioPagesPreview } from "./customer-previews/miopages-focus";

export async function validateMioPagesPreview(base: string, logo: { id: string; bytes: Buffer; mimeType: string; light?: { id: string; bytes: Buffer; mimeType: string } }) {
  const routes = [];
  for (const [route, sections] of Object.entries(mioPagesPreview.pages)) {
    const response = await fetch(base + route); assert.equal(response.status, 200);
    const html = await response.text(); const doc = new JSDOM(html).window.document;
    assert.match(doc.title, /MioPages/);
    assert.equal(doc.querySelector("h1")?.textContent, sections[0].content.heading);
    assert.equal(doc.querySelectorAll("main > section").length, sections.length);
    assert.ok(doc.querySelector('[data-contract-version="2"][data-grammar="service-led"][data-grammar-version="3"]'));
    assert.equal(doc.querySelectorAll("[data-motion-slot],form,input,textarea").length, 0);
    assert.doesNotMatch(doc.body.textContent!, /\$1,095|\$1095|\$249|TaBot|A-Bot/);
    assert.doesNotMatch(html, /source_reference|objects\/[a-f0-9]{64}|brand[\\/]miopages/);
    assert.deepEqual([...doc.querySelectorAll('header nav[aria-label="Primary Navigation"] a')].map(a => a.getAttribute("href")), ["/service", "/experience", "/review"]);
    const images = [...doc.querySelectorAll("img")]; assert.equal(images.length, 2);
    for (const [i, img] of images.entries()) { assert.equal(img.getAttribute("src"), `/media/assets/${i === 1 && logo.light ? logo.light.id : logo.id}`); assert.equal(img.getAttribute("alt"), "MioPages"); }
    for (const link of doc.querySelectorAll("a")) assert.ok(["/", "/service", "/experience", "/review"].includes(link.getAttribute("href")!));
    assert.match(doc.body.textContent!, /MioPages is not open for service or Review requests/);
    assert.doesNotMatch(doc.body.textContent!, /under development|not operational services|structured business knowledge|customer separation|operational validation|provisional product-definition|platform is still being proven/i);
    if (route === "/review") assert.match(doc.body.textContent!, /no information can be submitted here/);
    if (route === "/experience") assert.match(doc.body.textContent!, /No client imagery/);
    routes.push({ route, status: 200, sections: sections.length, heading: doc.querySelector("h1")?.textContent, forms: 0, motionConsumers: 0 });
  }
  for (const media of [logo, ...(logo.light ? [logo.light] : [])]) {
  const response = await fetch(`${base}/media/assets/${media.id}`);
  assert.equal(response.status, 200); assert.equal(response.headers.get("content-type"), media.mimeType);
  assert.ok(Buffer.from(await response.arrayBuffer()).equals(media.bytes), "Prepared managed bytes match delivery");
  }
  assert.equal((await fetch(base + "/api/contact", { method: "POST" })).status, 503);
  for (const route of ["/about", "/pricing", "/contact", "/start"]) assert.equal((await fetch(base + route)).status, 404);
  return routes;
}

async function main() {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL required");
  const sourceBytes = await readFile(mioPagesPreview.logo.file);
  const sourceDigest = createHash("sha256").update(sourceBytes).digest("hex");
  const preview = await prepareDisposablePreview(process.env.DATABASE_URL, manifest, mioPagesPreview);
  try {
    const server = await preview.start();
    const routes = await validateMioPagesPreview(server.base, preview.logo);
    // The isolated schema does not contain another customer's records or objects.
    for (const asset of preview.before.assets) assert.equal((await fetch(`${server.base}/media/assets/${asset.id}`)).status, 404);
    const preservation = await preview.verifyPreservation();
    assert.equal(createHash("sha256").update(await readFile(mioPagesPreview.logo.file)).digest("hex"), sourceDigest);
    const report = { schema: preview.schema, url: server.base, processId: server.processId, assetRoot: preview.root,
      iteration: 6, contractVersion: 2, grammar: { id: "service-led", version: 3 }, motion: "off", logo: { id: preview.logo.id, source: "MioPagesDV.png", sourceDigest, lightId: preview.logo.light?.id }, routes, fpoSlots: Object.entries(mioPagesPreview.pages).flatMap(([route, sections]) => sections.filter(s => s.configuration.previewMedia).map(s => ({ route, ...s.configuration.previewMedia as object }))), preservation,
      visuallyReviewed: false, commercialLaunchAuthorized: false };
    await mkdir("runtime-content", { recursive: true });
    await writeFile("runtime-content/miopages-focus-preview.json", JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
    console.log("Preview running. Ctrl+C stops the server, removes only its disposable schema, and rechecks real-state preservation.");
    await new Promise<void>(resolve => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); });
  } finally { await preview.stop(); }
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/preview-miopages-focus.ts")) main().catch(error => { console.error(error); process.exitCode = 1; });
