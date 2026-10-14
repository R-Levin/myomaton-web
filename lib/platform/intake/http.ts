import { contactHttp } from "../contact/http";
import { IntakeError } from "./model";
import { loopbackOrigin } from "./availability";
import type { ContactAbuseGuard } from "../contact/boundaries";
import type { IntakeService } from "./service";
import { newResumeToken } from "./service";

export const intakeCookie = "miopages_intake";
export function localBrowserRequest(request: Request) {
  // Next development may normalize request.url to an internal hostname. Use the
  // HTTP authority for origin checks, never forwarded headers or tenant selection.
  const url = new URL(request.url), host = request.headers.get("host");
  if (host) url.host = host;
  const init: RequestInit & { duplex: "half" } = { method: request.method, headers: request.headers, body: request.body, duplex: "half" };
  return new Request(url, init);
}
export function sessionToken(request: Request) {
  const candidates = (request.headers.get("cookie") ?? "").split(";").map(s => s.trim()).filter(s => s.startsWith(intakeCookie + "="));
  if (candidates.length !== 1) return null;
  const token = candidates[0].slice(intakeCookie.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export async function intakeHttp(request: Request, service: IntakeService, abuse: ContactAbuseGuard, enabled: boolean) {
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "Vary": "Cookie" } });
  if (!enabled || !loopbackOrigin(request.url)) return reply({ error: "unavailable" }, 503);
  if (request.headers.get("x-intake-request") !== "1") return reply({ error: "invalid_origin" }, 403);
  if (request.method !== "GET" && request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "invalid_origin" }, 403);
  let token = sessionToken(request), fresh = false;
  try {
    // Scope-only guard avoids storing IPs/contact data. Not a production spam defense.
    if (!await abuse.allow(`${service.selection.webPresenceId}:intake`)) return reply({ error: "rate_limited" }, 429);
    if (request.method === "GET") return token ? reply(await service.resume(token)) : reply({ state: "not_started" });
    if (request.method !== "POST") return reply({ error: "invalid_method" }, 405);
    let error: IntakeError | undefined;
    const response = await contactHttp(request, async value => {
      // Reuse Contact's origin/content-type/streaming/UTF-8 guards (16KiB cap).
      try {
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new IntakeError("invalid_request");
        const input = value as Record<string, unknown>;
        const keys = input.operation === "save" ? ["operation", "version", "answers", "step"] : input.operation === "submit" ? ["operation", "version"] : ["operation"];
        if (Object.keys(input).some(k => !keys.includes(k))) throw new IntakeError("invalid_request");
        if (input.operation === "begin") { if (!token) { token = newResumeToken(); fresh = true; } return await service.create(token, "FREE_REVIEW"); }
        if (!token) throw new IntakeError("session_unavailable", 404);
        if (input.operation === "save") return await service.save(token, input.version as number, input.answers, input.step as number);
        if (input.operation === "submit") return await service.submit(token, input.version as number);
        throw new IntakeError("invalid_request");
      } catch (e) { if (e instanceof IntakeError) error = e; throw e; }
    });
    if (error) return reply({ error: error.code, fieldErrors: error.fields }, error.status);
    response.headers.set("Vary", "Cookie");
    if (fresh && response.ok) response.headers.set("Set-Cookie", `${intakeCookie}=${token}; Path=/api/intake; HttpOnly; SameSite=Strict; Max-Age=2592000`);
    return response;
  } catch (e) {
    return e instanceof IntakeError ? reply({ error: e.code, fieldErrors: e.fields }, e.status) : reply({ error: "unavailable" }, 503);
  }
}
