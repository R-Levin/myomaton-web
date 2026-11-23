import { request } from "node:https";
import type { Readable } from "node:stream";
import type { ResponsesTransport } from "./intelligent-responses";

/** Longest silence tolerated while a streamed answer is being written (reasoning emits no text). */
export const streamIdleMs = 300_000;
/** Longest a single streamed answer may take, if the authorization lasts that long. */
export const streamTotalMs = 30 * 60_000;
const eventBytes = 4_000_000, streamBytes = 96_000_000;

/** The same two HTTPS operations as the live onboarding proof. Generations are streamed, so a long
 * answer is received as it is written instead of being abandoned at a fixed deadline; the response
 * and request identifiers are reported as soon as the provider starts the answer. */
export function responsesHttps(key: string, expiresAt: number, requestBytes = 18_000, timeoutMs = 45_000): ResponsesTransport {
  if (!/^sk-[a-zA-Z0-9_-]{20,512}$/.test(key) || !Number.isSafeInteger(expiresAt) ||
      !Number.isSafeInteger(requestBytes) || requestBytes < 1 || requestBytes > 48_000_000 ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 150_000) throw Error("Responses credentials unavailable");
  return {
    async send(path, body, started) {
      if (Date.now() >= expiresAt || (path !== "/v1/responses/input_tokens" && path !== "/v1/responses")) {
        throw Error("Responses dispatch refused");
      }
      const stream = path === "/v1/responses";
      const bytes = Buffer.from(JSON.stringify(stream ? { ...body, stream: true } : body));
      if (bytes.length > requestBytes + 64) throw Error("Responses request too large");
      const remainingMs = expiresAt - Date.now();
      if (remainingMs < 1) throw Error("Responses dispatch refused");
      return new Promise((resolve, reject) => {
        let settled = false;
        const fail = (reason: string) => { clearTimeout(deadline); if (!settled) { settled = true; reject(Error(reason)); } };
        const unavailable = () => fail("Responses HTTPS result unavailable");
        const total = new AbortController();
        const deadline = setTimeout(() => total.abort(), Math.min(stream ? streamTotalMs : timeoutMs, remainingMs));
        const outgoing = request({
          protocol: "https:", hostname: "api.openai.com", port: 443, path, method: "POST",
          agent: false, rejectUnauthorized: true, signal: total.signal,
          headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", "Content-Length": bytes.length,
            ...(stream && { Accept: "text/event-stream" }) },
        }, response => {
          const status = response.statusCode ?? 0;
          const type = response.headers["content-type"] ?? "";
          const id = response.headers["x-request-id"];
          const requestId = typeof id === "string" ? id : undefined;
          if (status < 200 || status >= 300 || !type.startsWith(stream ? "text/event-stream" : "application/json")) {
            response.destroy();
            fail(`Responses HTTP status ${status}`);
            return;
          }
          response.on("aborted", unavailable);
          response.on("error", unavailable);
          response.on("close", () => clearTimeout(deadline));
          if (!stream) {
            const chunks: Buffer[] = [];
            let size = 0;
            response.on("data", (chunk: Buffer) => {
              size += chunk.length;
              if (size > 256_000) { response.destroy(); unavailable(); }
              else chunks.push(chunk);
            });
            response.on("end", () => {
              try {
                const rawBody = Buffer.concat(chunks);
                const body = JSON.parse(rawBody.toString("utf8"));
                clearTimeout(deadline);
                settled = true;
                resolve({ body, rawBody, requestId });
              } catch { unavailable(); }
            });
            return;
          }
          streamedAnswer(response, requestId, started).then(reply => { clearTimeout(deadline); if (!settled) { settled = true; resolve(reply); } },
            error => fail(error instanceof Error ? error.message : "Responses HTTPS result unavailable"));
        });
        outgoing.on("error", unavailable);
        outgoing.end(bytes);
      });
    },
  };
}

type Started = Parameters<ResponsesTransport["send"]>[2];
type Answer = { body: unknown; rawBody: Buffer; requestId?: string };

/** Read a streamed Responses answer (server-sent events). Only the start and the final response
 * are kept; text deltas are discarded. Silence longer than `idleMs` abandons the stream. */
export function streamedAnswer(response: Readable & { setTimeout?(ms: number, callback: () => void): unknown },
  requestId: string | undefined, started: Started, idleMs = streamIdleMs): Promise<Answer> {
  return new Promise((resolve, reject) => {
    let done = false, pending = "", size = 0, final: { body: unknown; rawBody: Buffer } | undefined, announced: Promise<void> | undefined;
    const fail = (reason: string) => { if (!done) { done = true; response.destroy(); reject(Error(reason)); } };
    const event = (block: string) => {
      const data = block.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
      if (!data || data === "[DONE]") return;
      const parsed = JSON.parse(data) as { type?: unknown; response?: unknown };
      if (parsed.type === "error") throw Error("Responses stream error");
      const answer = parsed.response as { id?: unknown } | undefined;
      if (parsed.type === "response.created" && !announced && typeof answer?.id === "string") {
        announced = started ? started({ responseId: answer.id, requestId }) : Promise.resolve();
        announced.catch(() => fail("Responses start not recorded"));
      }
      if (["response.completed", "response.incomplete", "response.failed"].includes(String(parsed.type))) {
        if (final || !answer || typeof answer !== "object") throw Error("Responses stream ended ambiguously");
        const rawBody = Buffer.from(JSON.stringify(answer));
        final = { body: JSON.parse(rawBody.toString("utf8")), rawBody };
      }
    };
    response.setTimeout?.(idleMs, () => fail("Responses stream went silent"));
    response.setEncoding("utf8");
    response.on("data", (chunk: string) => {
      if (done) return;
      size += Buffer.byteLength(chunk);
      pending += chunk.replace(/\r\n/gu, "\n");
      try {
        if (size > streamBytes) throw Error("too large");
        let split: number;
        while ((split = pending.indexOf("\n\n")) >= 0) {
          event(pending.slice(0, split));
          pending = pending.slice(split + 2);
        }
        if (pending.length > eventBytes) throw Error("too large");
      } catch { fail("Responses HTTPS result unavailable"); }
    });
    response.on("error", () => fail("Responses HTTPS result unavailable"));
    response.on("end", () => {
      void (async () => {
        try {
          if (pending.trim()) event(pending);
          await announced;
          if (done) return;
          if (!final) return fail("Responses HTTPS result unavailable");
          done = true;
          resolve({ ...final, requestId });
        } catch { fail("Responses HTTPS result unavailable"); }
      })();
    });
  });
}
