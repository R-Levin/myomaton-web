import { createHmac, randomBytes, sign, timingSafeEqual, type KeyObject } from "node:crypto";
import type { WordPressTarget } from "./review-delivery";
import { draftEndpoint } from "./review-delivery";

/**
 * Core reads back what it delivered to Operator WordPress: each page as it is now,
 * whether the Operator edited it, and the Operator's Notes with the block each one is
 * attached to (owner direction, Nov 22). Read-only on the WordPress side.
 */
const REQUEST = "MioPages-WP-Readback-Request-v1\n";
const RESPONSE = "MioPages-WP-Readback-v1\n";

export function readbackRequest(installationId: string, keyId: string, key: KeyObject, now = Date.now()) {
  if (key.type !== "private" || key.asymmetricKeyType !== "ed25519") throw Error("Read-back signer refused");
  const nonce = randomBytes(16).toString("hex");
  const issuedAt = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({ installationId, issuedAt, expiresAt: issuedAt + 120, nonce }), "utf8");
  return { nonce, wire: { schema: "miopages.wordpress.readback-request", keyId, payloadBase64: payload.toString("base64"),
    signatureBase64: sign(null, Buffer.concat([Buffer.from(REQUEST), payload]), key).toString("base64") } };
}

export type ReadbackNote = { id: number; postId: number; parent: number; author: string; content: string; dateGmt: string; status: string };
export type ReadbackPage = { path: string; id: number; missing?: true; status?: string; title?: string; content?: string;
  contentSha256?: string; deliveredSha256?: string; edited?: boolean; modifiedGmt?: string };
export type Readback = { installationId: string; revision: number | null; digest: string | null; siteProposalId: string | null;
  pages: ReadbackPage[]; notes: ReadbackNote[] };

export function verifyReadback(value: unknown, secret: Buffer, expected: { installationId: string; nonce: string }): Readback {
  const wire = value as { bodyBase64?: unknown; mac?: unknown };
  if (secret.length !== 32 || !wire || typeof wire.bodyBase64 !== "string" || typeof wire.mac !== "string" ||
      !/^[a-f0-9]{64}$/u.test(wire.mac) || wire.bodyBase64.length > 12_000_000) throw Error("Read-back answer refused");
  const bytes = Buffer.from(wire.bodyBase64, "base64");
  if (bytes.toString("base64") !== wire.bodyBase64) throw Error("Read-back answer refused");
  const mac = createHmac("sha256", secret).update(RESPONSE).update(bytes).digest();
  if (!timingSafeEqual(mac, Buffer.from(wire.mac, "hex"))) throw Error("Read-back answer authentication refused");
  const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (body.schema !== "miopages.wordpress.readback" || body.version !== 1 || body.installationId !== expected.installationId ||
      body.nonce !== expected.nonce || !Array.isArray(body.pages) || !Array.isArray(body.notes)) throw Error("Read-back answer mismatch");
  return { installationId: body.installationId, revision: body.revision, digest: body.digest, siteProposalId: body.siteProposalId,
    pages: body.pages, notes: body.notes };
}

export async function fetchReadback(target: WordPressTarget, installationId: string, keyId: string, key: KeyObject, secret: Buffer,
  fetcher: typeof fetch = fetch, timeoutMs = 60_000) {
  const { nonce, wire } = readbackRequest(installationId, keyId, key);
  const url = new URL(draftEndpoint(target));
  url.searchParams.set("rest_route", "/miopages/v1/readback");
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (target.gate) headers.Authorization = "Basic " + Buffer.from(target.gate.user + ":" + target.gate.password, "utf8").toString("base64");
  const response = await fetcher(url, { method: "POST", headers, body: JSON.stringify(wire), redirect: "error", signal: AbortSignal.timeout(timeoutMs) });
  if (response.status !== 200) throw Error(`WordPress refused the read-back (HTTP ${response.status})`);
  return verifyReadback(JSON.parse(await response.text()), secret, { installationId, nonce });
}

/** The block a Note is attached to: its type and visible text, so a revision can target that spot. */
export type NoteThread = { id: number; path: string; status: string; author: string; dateGmt: string; text: string;
  replies: { author: string; text: string; dateGmt: string }[]; block: { name: string; text: string } | null };

const plain = (html: string) => html.replace(/<!--[\s\S]*?-->/gu, " ").replace(/<[^>]+>/gu, " ")
  .replace(/&nbsp;/gu, " ").replace(/&amp;/gu, "&").replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&quot;/gu, '"')
  .replace(/&#0?39;/gu, "'").replace(/\s+/gu, " ").trim();

/** Each Note id attached to a block (WordPress stores it in the block's metadata.noteId). */
export function noteBlocks(content: string) {
  const found = new Map<number, { name: string; text: string }>();
  const opener = /<!-- wp:([a-z0-9/-]+) (\{[\s\S]*?\}) (\/)?-->/gu;
  for (let match = opener.exec(content); match; match = opener.exec(content)) {
    let attributes: { metadata?: { noteId?: unknown } };
    try { attributes = JSON.parse(match[2]); } catch { continue; }
    const ids = attributes.metadata?.noteId;
    if (!Array.isArray(ids) && typeof ids !== "number") continue;
    const name = match[1];
    // Text up to this block's own closing comment (nested blocks of the same type close first).
    let text = "";
    if (!match[3]) {
      const rest = content.slice(opener.lastIndex);
      const tag = new RegExp(`<!-- (/?)wp:${name.replace("/", "\\/")}[ ]`, "gu");
      let depth = 1, end = rest.length;
      for (let step = tag.exec(rest); step; step = tag.exec(rest)) {
        depth += step[1] ? -1 : 1;
        if (depth === 0) { end = step.index; break; }
      }
      text = plain(rest.slice(0, end)).slice(0, 600);
    }
    for (const id of [ids].flat()) if (Number.isSafeInteger(id)) found.set(id as number, { name: name.replace(/^core\//u, ""), text });
  }
  return found;
}

/** What the Operator did since delivery: edited pages, and Note threads tied to their blocks. */
export function summarizeReadback(readback: Readback) {
  const byPost = new Map(readback.pages.map(page => [page.id, page]));
  const blocks = new Map<number, { name: string; text: string }>();
  for (const page of readback.pages) if (page.content) for (const [id, block] of noteBlocks(page.content)) blocks.set(id, block);
  const threads: NoteThread[] = readback.notes.filter(note => note.parent === 0).map(note => ({
    id: note.id, path: byPost.get(note.postId)?.path ?? "", status: note.status || "open", author: note.author, dateGmt: note.dateGmt,
    text: note.content, block: blocks.get(note.id) ?? null,
    replies: readback.notes.filter(reply => reply.parent === note.id).map(reply => ({ author: reply.author, text: reply.content, dateGmt: reply.dateGmt })),
  }));
  return {
    revision: readback.revision,
    editedPages: readback.pages.filter(page => page.edited).map(page => page.path),
    missingPages: readback.pages.filter(page => page.missing).map(page => page.path),
    openNotes: threads.filter(thread => thread.status !== "resolved"),
    resolvedNotes: threads.filter(thread => thread.status === "resolved"),
  };
}
