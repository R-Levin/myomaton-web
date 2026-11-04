import { httpsOrigin } from "./service";

// Next may construct Request.url using its internal listener address. The
// protected proxy must overwrite Host and X-Forwarded-Proto and keep that
// listener private. Installation HMAC remains mandatory in the handler.
export async function privateStageIngress(request: Request, configuredOrigin: string) {
  const origin = new URL(httpsOrigin(configuredOrigin));
  const url = new URL(request.url);
  const host = request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto");
  if (request.method !== "POST" || url.search
    || (url.pathname !== "/api/wordpress-delivery/pull" && url.pathname !== "/api/wordpress-delivery/receipt")
    || (host !== null && host !== origin.host) || (proto !== null && proto !== "https")
    || (url.origin !== origin.origin && (host !== origin.host || proto !== "https"))
    || request.headers.has("transfer-encoding")
    || (request.headers.has("content-length") && request.headers.get("content-length") !== "0")) return null;

  // Node-backed Next Requests may expose an empty stream even when the HTTP
  // request has no entity. Read only until the first nonempty chunk.
  if (request.body) {
    const reader = request.body.getReader();
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        if (chunk.value.byteLength > 0) {
          void reader.cancel().catch(() => {});
          return null;
        }
      }
    } finally { reader.releaseLock(); }
  }
  origin.pathname = url.pathname;
  return new Request(origin, { method: "POST", headers: request.headers });
}
