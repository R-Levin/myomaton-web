import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fingerprint } from "../lib/platform/canonical/model";
import type { StockSearchHit } from "../lib/platform/acquisition/stock-discovery";
import { prepareManagedBytes } from "../lib/platform/assets/ingestion";
import { validateStoredMedia } from "../lib/platform/assets/media-validation";
import reviewed from "./customer-updates/miopages-focus-reviewed.json";

const receiptSha = "74c3fd6f296a320ecf24eab16a9c18658245a5520512fdfe8b874df4d28295d4";
const captureSha = "c1f2974e1d4dac7a8062c29deea843c2bbcc61b3424079d698a5f044c422c9e7";
const pageId = "f4155bb3-e2a0-4db1-b88f-9ec55de5af0d";
const sectionId = "c18776da-f19a-481a-a239-6644eda51f94";
const hitDigest = "131699b3f90fe8f5f3dbf05d5122784169ac7a239a5fb0fb8dd7da198d3e2c28";
const alt = "Hammer and pliers on a workbench";
const maxBytes = 1024 * 1024;
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";

type Hit = StockSearchHit & { digest: string };

export function placementReview(bytes: Buffer) {
  if (sha(bytes) !== receiptSha) throw Error("unexpected_search_receipt");
  const receipt = JSON.parse(bytes.toString("utf8")) as { results: Hit[]; expiresAt: number };
  const hit = receipt.results.find(row => row.sourceId === "384740");
  const alternative = receipt.results.find(row => row.sourceId === "1083796");
  const page = reviewed.after.pages.find(row => row.id === pageId);
  const section = reviewed.after.sections.find(row => row.id === sectionId);
  if (!hit || !alternative || !page || page.slug !== "/" || page.managed_site_id !== reviewed.target.managedSiteId ||
      !section || section.page_id !== page.id || section.type !== "intro" || section.sort_order !== 10 || !section.content.heading || !section.content.text) {
    throw Error("unexpected_placement_context");
  }
  const { digest, ...normalized } = hit;
  if (digest !== hitDigest || fingerprint(normalized) !== digest) throw Error("unexpected_selection_digest");
  const plan = {
    receiptSha, hitDigest, expiresAt: receipt.expiresAt,
    selection: { provider: hit.provider, sourceId: hit.sourceId, sourceUrl: hit.sourceUrl, creator: hit.creator,
      representation: { id: hit.representation.id, width: hit.representation.width, height: hit.representation.height, mimeType: "image/jpeg" } },
    placement: { ...reviewed.target, pageId, pageVersion: page.version, sectionId, sectionVersion: section.version,
      role: "editorial-support-after-intro-copy", alt, crop: "none", maxDisplayWidth: 640 },
    use: "local-private-page-context-review-only",
  };
  return { plan, planDigest: fingerprint(plan), hit, alternative, heading: section.content.heading, copy: section.content.text };
}

type Review = ReturnType<typeof placementReview>;

export function renderReview(review: Review, capture: Buffer, prepared?: Buffer) {
  if (sha(capture) !== captureSha) throw Error("unexpected_home_capture");
  const row = (hit: Hit, label: string, reason: string) => `<li><strong>${label}</strong> <a href="${escape(hit.sourceUrl)}" rel="noreferrer" target="_blank">Pixabay photo ${hit.sourceId}</a> by ${escape(hit.creator ?? "Unknown")} · ${hit.representation.width} × ${hit.representation.height} px. ${reason}</li>`;
  const { width, height } = review.hit.representation;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>MioPages Home · Stock image placement review</title><style>
body{font:17px/1.55 system-ui;color:#26212d;background:#f7f5fa;max-width:62rem;margin:2rem auto;padding:0 1rem}h1,h2{line-height:1.12}h1{color:#322f7e}a{color:#322f7e}li{margin:.6rem 0}code{overflow-wrap:anywhere}
.intro{padding:clamp(1.25rem,4vw,3rem);background:#fbf7ef;border:1px solid #d9d2cb}.intro h2{font-size:clamp(1.8rem,4vw,2.7rem);max-width:28ch;margin:0}.intro p{max-width:58ch}figure{margin:1.8rem 0 0;max-width:640px}.slot{box-sizing:border-box;aspect-ratio:640/426;display:grid;place-content:center;text-align:center;padding:1rem;border:2px dashed #736a8b;background:#e8e2f2}figcaption{margin-top:.5rem}.capture{margin-top:1rem}img{display:block;max-width:100%;height:auto}</style></head><body>
<h1>MioPages Home · Stock image placement review</h1>
<p>Local review of the accepted Home Intro, directly after the service illustration and before the service explanation. The section below reproduces the reviewed copy. Expand the original capture to see its place in the full page.</p>
<section class="intro"><h2>${escape(review.heading)}</h2>${review.copy.split("\n\n").map(p => `<p>${escape(p)}</p>`).join("")}
<figure>${prepared ? `<img src="data:image/jpeg;base64,${prepared.toString("base64")}" width="${width}" height="${height}" alt="${alt}">`
    : `<div class="slot"><strong>Proposed image placement</strong><span>Photo linked below · acquisition pending</span></div>`}
<figcaption>Illustrative stock photo · after the Intro copy · up to ${width} px wide · full frame, no crop.</figcaption></figure></section>
<h2>Selection</h2><p>Source credit: <a href="https://pixabay.com/" rel="noreferrer">Pixabay</a>. The links open the provider’s public source pages.</p><ul>
${row(review.hit, "Recommended.", "A workbench gives the opening copy a practical example of business expertise without suggesting a MioPages customer or project.")}
${row(review.alternative, "Alternative.", "Antique hand tools also suit the copy, with a stronger traditional-craft emphasis.")}</ul>
<p>Proposed alt text: “${alt}”. Confirm the visible subject and check for recognizable people, marks or other rights concerns before wider use.</p>
<p>${prepared ? "The selected JPEG was acquired and prepared for this private review." : "The placeholder shows placement and proportions. Open the recommended source link to inspect the photo."} Acquisition plan <code>${review.planDigest}</code>.</p>
<details><summary>Open the accepted full Home capture</summary><img class="capture" src="data:image/png;base64,${capture.toString("base64")}" width="1440" height="3554" alt="Accepted MioPages Home with conceptual Hero, text-only Intro, service explanation, and Review invitation"></details></body></html>`;
}

export async function prepareSelectedJpeg(
  representation: Hit["representation"], send: typeof fetch = fetch,
) {
  const url = new URL(representation.url);
  if (url.origin !== "https://pixabay.com" || url.username || url.password || url.search || url.hash ||
      !/^\/get\/[a-z0-9]+_640\.jpg$/.test(url.pathname) || representation.id !== "webformat") throw Error("unexpected_image_endpoint");
  const response = await send(url, { method: "GET", redirect: "error", signal: AbortSignal.timeout(12_000),
    headers: { accept: "image/jpeg", "accept-encoding": "identity" } });
  if (response.status !== 200 || response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "image/jpeg" ||
      !response.body || Number(response.headers.get("content-length")) > maxBytes) {
    await response.body?.cancel();
    throw Error("unexpected_image_response");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw Error("image_response_too_large");
    }
    chunks.push(value);
  }
  const source = Buffer.concat(chunks);
  await validateStoredMedia(source, "image/jpeg", representation);
  const prepared = await prepareManagedBytes(source);
  if (prepared.mimeType !== "image/jpeg" || prepared.width !== representation.width || prepared.height !== representation.height) throw Error("unexpected_prepared_dimensions");
  return { bytes: prepared.bytes, sourceSha256: sha(source), preparedSha256: sha(prepared.bytes) };
}

export async function acquireForReview(directory: string, review: Review, approvedDigest: string, send?: typeof fetch, now = Date.now()) {
  if (approvedDigest !== review.planDigest) throw Error("exact_plan_confirmation_required");
  if (now >= review.plan.expiresAt) throw Error("search_representation_expired");
  if (["NODE_OPTIONS", "NODE_DEBUG", "NODE_DEBUG_NATIVE", "NODE_USE_ENV_PROXY", "SSLKEYLOGFILE", "NODE_TLS_REJECT_UNAUTHORIZED"].some(name => process.env[name])) {
    throw Error("unsafe_network_environment");
  }
  await writeFile(path.join(directory, "download-attempt.json"), json({ planDigest: approvedDigest, at: new Date(now).toISOString() }), { flag: "wx", mode: 0o600 });
  return prepareSelectedJpeg(review.hit.representation, send);
}

async function safePath(file: string, directory = false) {
  const info = await lstat(file);
  if (info.isSymbolicLink() || (directory ? !info.isDirectory() : !info.isFile())) throw Error("unsafe_review_path");
  return file;
}

async function main(args: string[]) {
  if (args.length && (args.length !== 2 || args[0] !== "--download-approved")) throw Error("unsupported_arguments");
  await safePath("runtime-content", true);
  await safePath("runtime-content/pixabay-live", true);
  await safePath("runtime-content/pixabay-live/first-search-574c573", true);
  await safePath("runtime-content/business-focus-final", true);
  const review = placementReview(await readFile(await safePath("runtime-content/pixabay-live/first-search-574c573/result.json")));
  const capture = await readFile(await safePath("runtime-content/business-focus-final/miopages-desktop-home.png"));
  const html = renderReview(review, capture);
  const directory = "runtime-content/pixabay-placement-review";
  await mkdir(directory, { mode: 0o700 }).catch(error => { if (error.code !== "EEXIST") throw error; });
  await safePath(directory, true);
  const output = path.join(directory, args.length ? "acquired-review.html" : "review.html");
  if (args.length) {
    const { bytes, ...evidence } = await acquireForReview(directory, review, args[1]);
    await writeFile(output, renderReview(review, capture, bytes), { flag: "wx", mode: 0o600 });
    await writeFile(path.join(directory, "download-evidence.json"), json({ ...review.plan, planDigest: review.planDigest, ...evidence }), { flag: "wx", mode: 0o600 });
  } else {
    await writeFile(output, html, { flag: "wx", mode: 0o600 });
  }
  console.log(json({ status: "PASS", planDigest: review.planDigest, output: path.resolve(output) }).trim());
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/pixabay-placement-review.ts")) {
  main(process.argv.slice(2)).catch(error => {
    const code = /^(?:unexpected_[a-z_]+|unsafe_[a-z_]+|exact_plan_confirmation_required|search_representation_expired|unsupported_arguments|image_response_too_large)$/.test(error.message)
      ? error.message : error.code === "EEXIST" ? "local_output_or_attempt_exists" : "local_review_failed";
    console.log(json({ status: "BLOCKED", code }).trim());
    process.exitCode = 1;
  });
}
