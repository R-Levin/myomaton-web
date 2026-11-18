import { readPixabayResponse, sendPixabayHttps, type PixabaySend } from "../lib/platform/acquisition/pixabay-https";
import { lstat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fingerprint } from "../lib/platform/canonical/model";
import { pixabaySearch } from "../lib/platform/acquisition/pixabay";
import { StockDiscovery } from "../lib/platform/acquisition/stock-discovery";
import reviewed from "./customer-updates/miopages-focus-reviewed.json";

const technicalTrial = {
  id: "first-search-574c573", query: "workshop workbench",
  target: { webPresenceId: "4bcd9832-8149-4a97-9552-553b8ad26e4a", managedSiteId: "4bcd9832-8149-4a97-9552-553b8ad26e4b",
    pageId: "4bcd9832-8149-4a97-9552-553b8ad26e4c", sectionId: "4bcd9832-8149-4a97-9552-553b8ad26e4d" },
};
export const c0Trial = {
  id: "c0-home-editorial-9a638b2", query: "small business laptop",
  target: { webPresenceId: reviewed.target.webPresenceId, managedSiteId: reviewed.target.managedSiteId,
    pageId: "f4155bb3-e2a0-4db1-b88f-9ec55de5af0d", sectionId: "c18776da-f19a-481a-a239-6644eda51f94" },
};
type Send = PixabaySend;
const sendHttps = sendPixabayHttps;
const searchResponse = readPixabayResponse;

type Discovery = Awaited<ReturnType<StockDiscovery["search"]>>;
const escaped = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function reviewHtml(result: Discovery) {
  const rows = result.results.map(hit => `<li><strong>${escaped(hit.description ?? "Photo " + hit.sourceId)}</strong>
  <p>Creator: ${escaped(hit.creator ?? "Unspecified")} · ${hit.representation.width} × ${hit.representation.height} · Pixabay ID ${hit.sourceId}</p>
  <a href="${escaped(hit.sourceUrl)}" rel="noreferrer noopener" target="_blank">Inspect photo on Pixabay</a></li>`).join("\n");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex,nofollow">
<meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'">
<title>MioPages local Pixabay review</title><style>body{font:16px/1.5 system-ui;max-width:54rem;margin:2rem auto;padding:0 1rem}li{margin:1rem 0}p{margin:.3rem 0}</style>
<h1>MioPages local Pixabay search review</h1><p>Search: ${escaped(result.query)}. Source: <a href="https://pixabay.com/" rel="noreferrer">Pixabay</a>.</p>
<p>Descriptions are provider tags. Open a photo's source page to inspect it visually. This review loads no images automatically. Each result awaits separate rights and placement review.</p>
<ol>${rows}</ol></html>`;
}

const safeFailures = new Set(["unexpected_content_type", "response_too_large", "credential_reflected", "invalid_json"]);
const networkFailures = new Set(["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ABORT_ERR",
  "CERT_HAS_EXPIRED", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN", "ERR_TLS_CERT_ALTNAME_INVALID"]);
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";

async function runPixabaySearch(directory: string, key: string, trial: typeof technicalTrial, send: Send) {
  const { query, target } = trial;
  if (!/^[A-Za-z0-9_-]{12,128}$/.test(key)) return { status: "BLOCKED", code: "invalid_local_key_format" } as const;
  const attempt = path.join(directory, "attempt.json");
  try {
    await writeFile(attempt, json({ query, startedAt: new Date().toISOString(), maximumRequests: 1 }), { flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return { status: "BLOCKED", code: "attempt_already_recorded" } as const;
    throw error;
  }
  let httpStatus: number | null = null;
  let stage = "transport";
  try {
    let sent = false;
    const provider = pixabaySearch(async params => {
      if (sent) throw Error("attempt_already_recorded");
      sent = true;
      const response = await searchResponse(key, params, async options => {
        const reply = await send(options);
        httpStatus = Number.isInteger(reply.status) && reply.status >= 100 && reply.status <= 599 ? reply.status : null;
        return reply;
      });
      stage = "response_validation";
      return response;
    });
    const operator = Object.freeze({});
    const discovery = new StockDiscovery(provider, { async authorize(context, operation, placement) {
      if (context !== operator || operation !== "receive-supplied-media" || fingerprint(placement) !== fingerprint(target)) {
        throw Error("Local search authority required");
      }
      return { operatorId: "local-operator", authorityReference: trial.id };
    } });
    const result = await discovery.search(operator, target, query);
    stage = "private_evidence";
    const receipt = json({ status: "PASS", httpStatus, providerRequests: 1, fetchedAt: new Date().toISOString(), ...result });
    const html = reviewHtml(result);
    if (receipt.includes(key) || html.includes(key)) throw Error("credential_reflected");
    await writeFile(path.join(directory, "result.json"), receipt, { flag: "wx", mode: 0o600 });
    await writeFile(path.join(directory, "review.html"), html, { flag: "wx", mode: 0o600 });
    return { status: "PASS", httpStatus, results: result.results.length } as const;
  } catch (error) {
    const e = error as NodeJS.ErrnoException;
    const code = httpStatus !== null && httpStatus !== 200 ? `http_${httpStatus}`
      : safeFailures.has(e.message) ? e.message
      : e.code && networkFailures.has(e.code) ? e.code
      : stage === "response_validation" ? "unsupported_search_response" : stage === "private_evidence" ? "local_evidence_failed" : "request_failed";
    const failure = { status: "BLOCKED", code, stage, httpStatus } as const;
    await writeFile(path.join(directory, "failure.json"), json(failure), { flag: "wx", mode: 0o600 });
    return failure;
  }
}

export function firstPixabaySearch(directory: string, key: string, send: Send = sendHttps) {
  return runPixabaySearch(directory, key, technicalTrial, send);
}

export function c0PixabaySearch(directory: string, key: string, send: Send = sendHttps) {
  return runPixabaySearch(directory, key, c0Trial, send);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--c0-home") {
    console.log('{"status":"BLOCKED","code":"c0_search_closed"}');
    process.exitCode = 1;
    return;
  }
  if (args.length) throw Error("unsupported_search_trial");
  const trial = technicalTrial;
  if (["NODE_OPTIONS", "NODE_DEBUG", "NODE_DEBUG_NATIVE", "NODE_USE_ENV_PROXY", "SSLKEYLOGFILE"].some(name => process.env[name])) {
    throw Error("unsafe_node_diagnostics_or_proxy_configuration");
  }
  let key = "";
  for await (const chunk of process.stdin.setEncoding("utf8")) {
    key += chunk;
    if (key.length > 140) throw Error("invalid_local_key_format");
  }
  let directory = process.cwd();
  for (const segment of ["runtime-content", "pixabay-live", trial.id]) {
    directory = path.join(directory, segment);
    await mkdir(directory, { mode: 0o700 }).catch(error => { if (error.code !== "EEXIST") throw error; });
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink()) throw Error("unsafe_private_directory");
  }
  const outcome = await runPixabaySearch(directory, key.trim(), trial, sendHttps);
  key = "";
  console.log(JSON.stringify(outcome));
  if (outcome.status !== "PASS") process.exitCode = 1;
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/pixabay-live-search.ts")) {
  main().catch(() => {
    console.log('{"status":"BLOCKED","code":"local_launcher_failed","next":"Inspect private attempt evidence before any retry"}');
    process.exitCode = 1;
  });
}
