import { request } from "node:http";

// Node's fetch rewrites Host to its URL authority. Use the HTTP client to exercise
// real virtual-host requests on loopback without editing DNS or the hosts file.
export function hostRequest(base: string, pathname: string, host: string | null, extra: Record<string, string> = {}, method = "GET"): Promise<Response> {
  return new Promise((resolve, reject) => {
    const call = request(new URL(pathname, base), { method, setHost: false, headers: { ...(host === null ? {} : { host }), ...extra } }, response => {
      const parts: Buffer[] = []; let size = 0;
      response.on("data", (part: Buffer) => { size += part.length; if (size > 4 * 1024 * 1024) call.destroy(Error("Bounded HTTP proof response exceeded")); else parts.push(part); });
      response.on("end", () => { const headers = new Headers(); for (const [key, value] of Object.entries(response.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value); resolve(new Response(Buffer.concat(parts), { status: response.statusCode, headers })); });
      response.on("error", reject);
    });
    call.setTimeout(15000, () => call.destroy(Error("HTTP proof timeout"))); call.on("error", reject); call.end();
  });
}
