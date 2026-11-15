import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { JSDOM } from "jsdom";
import { text } from "../canonical/model";
import type { PresenceEvidence } from "./presence-workflow-artifacts";

export type PublicResearchSource = { id: string; url: string; label: string };

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
  recheck: () => Promise<void>, fetchPage: typeof fetch = fetch, clock = Date.now): Promise<PresenceEvidence[]> {
  validateResearchSources(sources);
  if (!Number.isSafeInteger(byteLimit) || byteLimit < 1 || byteLimit > 2_000_000) throw Error("Research response envelope refused");
  const results: PresenceEvidence[] = [];
  for (const source of sources) {
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
      document.querySelectorAll("script,style,nav,iframe,template,noscript,footer,[hidden]").forEach(element => element.remove());
      const main = document.querySelector("main,article") ?? document.body;
      const content = text((main.textContent ?? "").replace(/\s+/gu, " ").replace(/[<>]/gu, " "), Infinity);
      const rawDigest = createHash("sha256").update(bytes).digest("hex");
      results.push({ id: source.id, kind: "public-research", label: source.label, reference: source.url,
        date: new Date(clock()).toISOString().slice(0, 10), content, rawDigest });
    } finally { dom.window.close(); }
  }
  return results;
}
