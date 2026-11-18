import { request } from "node:https";
import type { ResponsesTransport } from "./intelligent-responses";

/** The same two HTTPS operations as the live onboarding proof. */
export function responsesHttps(key: string, expiresAt: number, requestBytes = 18_000, timeoutMs = 45_000): ResponsesTransport {
  if (!/^sk-[a-zA-Z0-9_-]{20,512}$/.test(key) || !Number.isSafeInteger(expiresAt) ||
      !Number.isSafeInteger(requestBytes) || requestBytes < 1 || requestBytes > 1_000_000 ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 150_000) throw Error("Responses credentials unavailable");
  return {
    async send(path, body) {
      if (Date.now() >= expiresAt || (path !== "/v1/responses/input_tokens" && path !== "/v1/responses")) {
        throw Error("Responses dispatch refused");
      }
      const bytes = Buffer.from(JSON.stringify(body));
      if (bytes.length > requestBytes) throw Error("Responses request too large");
      const remainingMs = expiresAt - Date.now();
      if (remainingMs < 1) throw Error("Responses dispatch refused");
      return new Promise((resolve, reject) => {
        const unavailable = () => reject(Error("Responses HTTPS result unavailable"));
        const outgoing = request({
          protocol: "https:", hostname: "api.openai.com", port: 443, path, method: "POST",
          agent: false, rejectUnauthorized: true, signal: AbortSignal.timeout(Math.min(timeoutMs, remainingMs)),
          headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", "Content-Length": bytes.length },
        }, response => {
          const status = response.statusCode ?? 0;
          if (status < 200 || status >= 300 || !response.headers["content-type"]?.startsWith("application/json")) {
            response.destroy();
            reject(Error(`Responses HTTP status ${status}`));
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          response.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > 256_000) { response.destroy(); unavailable(); }
            else chunks.push(chunk);
          });
          response.on("aborted", unavailable);
          response.on("error", unavailable);
          response.on("end", () => {
            try {
              const id = response.headers["x-request-id"];
              const rawBody = Buffer.concat(chunks);
              resolve({ body: JSON.parse(rawBody.toString("utf8")), rawBody, requestId: typeof id === "string" ? id : undefined });
            } catch { unavailable(); }
          });
        });
        outgoing.on("error", unavailable);
        outgoing.end(bytes);
      });
    },
  };
}
