import { ContactError } from "./model";

export async function contactHttp(request: Request, accept: (value: unknown) => Promise<unknown>) {
  const respond = (body: unknown, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) throw new ContactError("invalid_origin", 403);
    if (request.headers.get("content-type")?.split(";")[0] !== "application/json") throw new ContactError("invalid_content_type", 415);
    if (Number(request.headers.get("content-length")) > 16384) throw new ContactError("payload_too_large", 413);
    const reader = request.body?.getReader(); if (!reader) throw new ContactError("invalid_request");
    const parts: Uint8Array[] = []; let size = 0;
    try {
      for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength;
        if (size > 16384) { await reader.cancel(); throw new ContactError("payload_too_large", 413); } parts.push(value); }
    } finally { reader.releaseLock(); }
    let input: unknown;
    try { input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(parts))); }
    catch { throw new ContactError("invalid_json"); }
    return respond(await accept(input), 200);
  } catch (error) {
    if (error instanceof ContactError) return respond({ error: error.code, fieldErrors: error.fieldErrors }, error.status);
    // Never log or expose request bodies, provider exceptions, or DB details.
    return respond({ error: "unavailable" }, 503);
  }
}
