import { createHash } from "node:crypto";
import { lstat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fingerprint } from "../lib/platform/canonical/model";
import type { StockSearchHit } from "../lib/platform/acquisition/stock-discovery";
import { prepareManagedBytes } from "../lib/platform/assets/ingestion";
import { validateStoredMedia } from "../lib/platform/assets/media-validation";
import reviewed from "./customer-updates/miopages-focus-reviewed.json";
import { c0Trial } from "./pixabay-live-search";

const captureSha = "c1f2974e1d4dac7a8062c29deea843c2bbcc61b3424079d698a5f044c422c9e7";
const maxBytes = 1024 * 1024;
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";

type Hit = StockSearchHit & { digest: string };
type Receipt = { status: string; httpStatus: number; providerRequests: number; query: string; results: Hit[] };
type Notes = { receiptSha: string; summary: string; candidates: { sourceId: string; assessment: string }[] };

function reviewHtml(receipt: Receipt, notes: Notes, capture: Buffer) {
  if (sha(capture) !== captureSha) throw Error("unexpected_home_capture");
  const home = reviewed.after.sections.filter(section => section.page_id === c0Trial.target.pageId);
  const excerpts = [0, 10, 30].map(order => {
    const { content } = home.find(section => section.sort_order === order)!;
    return `<section><h3>${escape(content.heading!)}</h3><p>${escape(content.text!.split("\n\n")[0])}</p></section>`;
  });
  const rows = notes.candidates.map(({ sourceId, assessment }) => {
    const hit = receipt.results.find(row => row.sourceId === sourceId);
    if (!hit) throw Error("candidate_outside_search_receipt");
    const { digest, ...normalized } = hit;
    const url = new URL(hit.sourceUrl);
    if (fingerprint(normalized) !== digest || hit.provider !== "pixabay" || !/^\d+$/.test(sourceId) ||
        url.origin !== "https://pixabay.com" || url.username || url.password || url.search || url.hash ||
        !/^\/photos\/[a-z0-9-]+\/$/.test(url.pathname) || !url.pathname.endsWith(`-${sourceId}/`)) throw Error("invalid_review_candidate");
    return `<li><h3><a href="${escape(url.href)}" rel="noreferrer" target="_blank">View Pixabay photo ${sourceId}</a></h3>
<p>${escape(hit.creator ?? "Creator unavailable")} · ${hit.representation.width} × ${hit.representation.height} px</p><p>${escape(assessment)}</p></li>`;
  }).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>MioPages Home · Editorial image review</title><style>
body{font:17px/1.55 system-ui;color:#26212d;background:#f7f5fa;max-width:60rem;margin:2rem auto;padding:0 1rem}h1,h2,h3{line-height:1.16;color:#322f7e}a{color:#322f7e}p{max-width:70ch}li{margin:1.25rem 0}main section{background:#fbf7ef;padding:.4rem 1rem;margin:.6rem 0}summary{cursor:pointer;font-weight:bold}img{display:block;max-width:100%;height:auto;margin-top:1rem}</style></head><body><main>
<h1>MioPages Home · Editorial image review</h1>
<p>${escape(notes.summary)}</p>
<h2>Photo review</h2><p>One search for “${escape(receipt.query)}” returned ${receipt.results.length} results. View the photographs on their original source pages. Source credit <a href="https://pixabay.com/" rel="noreferrer">Pixabay</a>.</p>
${rows ? `<ul>${rows}</ul>` : "<p>No candidates shortlisted.</p>"}
<h2>Accepted page context</h2><p>Consider a photo only for editorial support in one of the two Intro sections. The conceptual Hero and illustrative Review report have dedicated visual roles. An authored graphic can explain handoff and continuing care if photography adds little.</p>
${excerpts.join("\n")}
<details><summary>Open the accepted full Home capture</summary><img src="data:image/png;base64,${capture.toString("base64")}" width="1440" height="3554" alt="Accepted MioPages Home with conceptual Hero, text-only Intro, service explanation, and Review invitation"></details></main></body></html>`;
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

export async function acquireForReview(
  directory: string, review: { planDigest: string; plan: { expiresAt: number }; hit: Pick<Hit, "representation"> },
  approvedDigest: string, send?: typeof fetch, now = Date.now(),
) {
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
  if (args.length) throw Error(args[0] === "--download-approved" ? "no_approved_selection" : "unsupported_arguments");
  await safePath("runtime-content", true);
  await safePath("runtime-content/pixabay-live", true);
  const directory = await safePath(path.join("runtime-content/pixabay-live", c0Trial.id), true);
  await safePath("runtime-content/business-focus-final", true);
  const bytes = await readFile(await safePath(path.join(directory, "result.json")));
  const notes = JSON.parse(await readFile(await safePath(path.join(directory, "owner-review-notes.json")), "utf8")) as Notes;
  const receipt = JSON.parse(bytes.toString("utf8")) as Receipt;
  if (sha(bytes) !== notes.receiptSha || receipt.status !== "PASS" || receipt.httpStatus !== 200 || receipt.providerRequests !== 1 ||
      receipt.query !== c0Trial.query || !Array.isArray(receipt.results) || receipt.results.length > 8 ||
      !Array.isArray(notes.candidates) || notes.candidates.length > 5 || new Set(notes.candidates.map(candidate => candidate.sourceId)).size !== notes.candidates.length) throw Error("unexpected_search_receipt");
  const capture = await readFile(await safePath("runtime-content/business-focus-final/miopages-desktop-home.png"));
  const output = path.join(directory, "owner-review.html");
  await writeFile(output, reviewHtml(receipt, notes, capture), { flag: "wx", mode: 0o600 });
  console.log(json({ status: "PASS", candidates: notes.candidates.length, output: path.resolve(output) }).trim());
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/pixabay-placement-review.ts")) {
  main(process.argv.slice(2)).catch(error => {
    const code = /^(?:unexpected_[a-z_]+|unsafe_[a-z_]+|unsupported_arguments|no_approved_selection|candidate_outside_search_receipt|invalid_review_candidate)$/.test(error.message)
      ? error.message : error.code === "EEXIST" ? "local_output_or_attempt_exists" : "local_review_failed";
    console.log(json({ status: "BLOCKED", code }).trim());
    process.exitCode = 1;
  });
}
