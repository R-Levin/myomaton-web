import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { JSDOM } from "jsdom";
import { text } from "../canonical/model";
import type { PresenceEvidence } from "./presence-workflow-artifacts";

export type PublicResearchSource = { id: string; url: string; label: string };
export type ResearchDiscovery = { prefixes: Readonly<Record<string, readonly string[]>>; terms: readonly string[]; maxDiscovered: number; excerptCharacters?: number };
type Link = { url: string; title: string; from: string; score: number };

export function researchUrlAllowed(url: URL, sources: readonly PublicResearchSource[], discovery?: ResearchDiscovery) {
  if (url.protocol !== "https:" || url.port || url.username || url.password || url.search || url.hash ||
      !/^\/[a-z0-9_./-]*$/iu.test(url.pathname)) return false;
  return sources.some(source => source.url === url.href) || Boolean(discovery && Object.hasOwn(discovery.prefixes, url.origin) &&
    discovery.prefixes[url.origin].some(prefix => url.pathname === prefix || url.pathname.startsWith(prefix.replace(/\/$/u, "") + "/")));
}

export function validateDiscovery(roots: readonly PublicResearchSource[], value: ResearchDiscovery) {
  if (!Number.isSafeInteger(value.maxDiscovered) || value.maxDiscovered < 1 || value.maxDiscovered > 10 ||
      (value.excerptCharacters !== undefined && (!Number.isSafeInteger(value.excerptCharacters) || value.excerptCharacters < 300 || value.excerptCharacters > 12_000)) ||
      !value.terms.length || value.terms.some(term => !/^[a-z -]{2,50}$/u.test(term))) throw Error("Research discovery scope refused");
  const origins = new Set(roots.map(root => new URL(root.url).origin));
  for (const [origin, prefixes] of Object.entries(value.prefixes)) {
    if (!origins.has(origin) || prefixes.some(prefix => !/^\/[a-z0-9][a-z0-9/-]*$/iu.test(prefix))) throw Error("Research prefix scope refused");
  }
}

export function validateResearchSources(sources: readonly PublicResearchSource[]) {
  if (!sources.length || new Set(sources.map(source => source.id)).size !== sources.length) throw Error("Research sources refused");
  for (const { url, label, id } of sources) {
    const target = new URL(url);
    const host = target.hostname.replace(/^\[|\]$/g, "");
    if (target.href !== url || target.protocol !== "https:" || target.port || target.username || target.password ||
        target.search || target.hash || isIP(host) || !host.includes(".") || /\.(?:localhost|local|internal|test)$/u.test(host) ||
        !/^research:[a-z0-9-]+$/u.test(id) || !label.trim()) throw Error("Research source URL refused");
  }
}

async function download(response: Response, byteLimit: number) {
  if (!response.body) throw Error("Research content unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > byteLimit) {
        await reader.cancel();
        throw Error("Research response exceeded its envelope");
      }
      chunks.push(part.value);
    }
    return Buffer.concat(chunks);
  } finally { reader.releaseLock(); }
}

// Uses an exact, server-side URL list. Customer URLs, response links and redirects
// cannot expand the research scope. The production composition must also restrict egress.
export async function retrievePublicResearch(sources: readonly PublicResearchSource[], byteLimit: number,
  recheck: () => Promise<void>, fetchPage: typeof fetch = fetch, clock = Date.now, discovery?: ResearchDiscovery): Promise<PresenceEvidence[]> {
  validateResearchSources(sources);
  if (discovery) validateDiscovery(sources, discovery);
  if (!Number.isSafeInteger(byteLimit) || byteLimit < 1 || byteLimit > 2_000_000) throw Error("Research response envelope refused");
  const results: PresenceEvidence[] = [];
  const links = new Map<string, Link>();
  async function readSource(source: PublicResearchSource, discoverLinks: boolean, discoveredFrom?: string) {
    await recheck();
    const response = await fetchPage(source.url, { redirect: "error", signal: AbortSignal.timeout(15_000), headers: { Accept: "text/html" } });
    if (!response.ok || response.url !== source.url || !response.headers.get("content-type")?.startsWith("text/html")) {
      await response.body?.cancel();
      throw Error("Approved research content unavailable");
    }
    const bytes = await download(response, byteLimit);
    const dom = new JSDOM(bytes);
    try {
      const document = dom.window.document;
      if (discoverLinks && discovery) {
        for (const link of document.querySelectorAll("a[href]")) {
          const target = URL.parse(link.getAttribute("href")!, source.url);
          if (!target || target.origin !== new URL(source.url).origin || !researchUrlAllowed(target, sources, discovery) ||
              sources.some(root => root.url === target.href)) continue;
          const title = (link.textContent ?? "").replace(/\s+/gu, " ").replace(/[<>]/gu, " ").trim().slice(0, 200);
          const haystack = (title + " " + target.pathname.replace(/[-_/]/gu, " ")).toLowerCase();
          const score = discovery.terms.filter(term => haystack.includes(term)).length;
          if (score > (links.get(target.href)?.score ?? 0)) links.set(target.href, { url: target.href, title, from: source.url, score });
        }
      }
      document.querySelectorAll("script,style,nav,iframe,template,noscript,footer,[hidden]").forEach(element => element.remove());
      const main = document.querySelector("main,article") ?? document.body;
      const visible = text((main.textContent ?? "").replace(/\s+/gu, " ").replace(/[<>]/gu, " "), Infinity);
      const limit = discovery?.excerptCharacters ?? 6_000;
      const content = visible.length <= limit ? visible : visible.slice(0, limit).trimEnd() + " [public excerpt]";
      const rawDigest = createHash("sha256").update(bytes).digest("hex");
      results.push({ id: source.id, kind: "public-research", label: source.label, reference: source.url,
        date: new Date(clock()).toISOString().slice(0, 10), content, rawDigest, ...(discoveredFrom && { discoveredFrom }) });
    } finally { dom.window.close(); }
  }
  for (const source of sources) await readSource(source, true);
  if (discovery) {
    const ranked = [...links.values()].sort((a, b) => b.score - a.score || a.url.localeCompare(b.url)).slice(0, discovery.maxDiscovered);
    for (const link of ranked) {
      await readSource({ id: "research:discovered-" + createHash("sha256").update(link.url).digest("hex").slice(0, 20),
        url: link.url, label: link.title || new URL(link.url).pathname }, false, link.from);
    }
  }
  return results;
}
