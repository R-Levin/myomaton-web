import { contactHttp } from "../contact/http";
import { IntakeError, type IntakePortalWorkspace } from "./model";
import { loopbackOrigin } from "./availability";
import type { ContactAbuseGuard } from "../contact/boundaries";
import type { IntakeService } from "./service";
import { newResumeToken } from "./service";
import type { PresenceWorkflow } from "./presence-workflow";
import type { PerformanceSnapshot } from "../measurement/first-party";

export const intakeCookie = "miopages_intake";

async function updateLocalWorkflow(workflow: PresenceWorkflow, context: Awaited<ReturnType<IntakeService["workflowContext"]>>, input: Record<string, unknown>) {
  const keys = input.operation === "workflow-start" ? ["operation"] :
    input.operation === "workflow-correct" ? ["operation", "version", "finding", "correction"] : ["operation", "version"];
  if (Object.keys(input).some(key => !keys.includes(key))) throw new IntakeError("invalid_request");
  if (input.operation === "workflow-start") return workflow.start(context);
  const version = input.version;
  if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 1) throw new IntakeError("invalid_request");
  const customer = { id: "local-customer", role: "customer", simulated: true } as const;
  switch (input.operation) {
    case "workflow-next": return workflow.advance(context, version);
    case "workflow-recover": return workflow.recover(context, version);
    case "workflow-correct": {
      if (typeof input.finding !== "string" || typeof input.correction !== "string" || !input.correction.trim() ||
          input.correction.length > 8_000 || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(input.correction)) {
        throw new IntakeError("invalid_request");
      }
      return workflow.correctReport(context, version, input.finding, input.correction, customer);
    }
    case "workflow-confirm": return workflow.confirmReport(context, version, customer);
    case "workflow-revise": return workflow.requestEditorialRevision(context, version, { id: "local-operator", role: "operator", simulated: true });
    case "workflow-review": return workflow.reviewCandidate(context, version, { id: "local-operator", role: "operator", simulated: true });
    default: throw new IntakeError("invalid_request");
  }
}
export function localBrowserRequest(request: Request) {
  // Next development may normalize request.url to an internal hostname. Use the
  // HTTP authority for origin checks, never forwarded headers or tenant selection.
  const url = new URL(request.url), host = request.headers.get("host");
  if (host) url.host = host;
  const init: RequestInit & { duplex: "half" } = { method: request.method, headers: request.headers, body: request.body, duplex: "half" };
  return new Request(url, init);
}
export function sessionToken(request: Request, cookieName = intakeCookie) {
  const candidates = (request.headers.get("cookie") ?? "").split(";").map(s => s.trim()).filter(s => s.startsWith(cookieName + "="));
  if (candidates.length !== 1) return null;
  const token = candidates[0].slice(cookieName.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export async function intakeHttp(request: Request, service: IntakeService, abuse: ContactAbuseGuard, enabled: boolean, sharedDevelopment = false,
  workflow?: PresenceWorkflow, snapshot?: () => Promise<PerformanceSnapshot>) {
  // Loopback cookies are shared across ports. This disposable workflow must
  // never adopt the resume cookie of an earlier local intake.
  const cookieName = workflow ? "miopages_presence_workflow_draft" :
    service.isOnboarding ? service.onboardingCookie : sharedDevelopment ? "miopages_intake_shared_development" : intakeCookie;
  const cookiePath = service.isOnboarding ? "/api/onboarding" : "/api/intake";
  const sessionCookie = (value: string, age: number) => `${cookieName}=${value}; Path=${cookiePath}; HttpOnly; SameSite=Strict; Max-Age=${age}`;
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "Vary": "Cookie" } });
  if (!enabled || !loopbackOrigin(request.url)) return reply({ error: "unavailable" }, 503);
  if (request.headers.get("x-intake-request") !== "1") return reply({ error: "invalid_origin" }, 403);
  if (request.method !== "GET" && request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "invalid_origin" }, 403);
  let token = sessionToken(request, cookieName), fresh = false;
  async function withWorkflow(view: Awaited<ReturnType<IntakeService["resume"]>>) {
    if (!workflow || !token) return view;
    return { ...view, workflowAvailable: true, workflow: await workflow.review(await service.workflowContext(token)),
      portal: { role: "customer", identity: "Customer rehearsal participant", account: "MioPages C0 rehearsal",
        site: "Disposable draft", environment: "local-rehearsal" } satisfies IntakePortalWorkspace,
      ...(snapshot && { firstParty: await snapshot() }) };
  }
  try {
    // Scope-only guard avoids storing IPs/contact data. Not a production spam defense.
    if (!await abuse.allow(`${service.selection.webPresenceId}:intake`)) return reply({ error: "rate_limited" }, 429);
    if (request.method === "GET") return token ? reply(await withWorkflow(await service.resume(token))) : reply({ state: "not_started" });
    if (request.method !== "POST") return reply({ error: "invalid_method" }, 405);
    let error: IntakeError | undefined;
    const response = await contactHttp(request, async value => {
      // Reuse Contact's origin/content-type/streaming/UTF-8 guards (16KiB cap).
      try {
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new IntakeError("invalid_request");
        const input = value as Record<string, unknown>;
        if (typeof input.operation === "string" && input.operation.startsWith("workflow-")) {
          if (!workflow || !token) throw new IntakeError("session_unavailable", 404);
          await updateLocalWorkflow(workflow, await service.workflowContext(token), input);
          return await withWorkflow(await service.resume(token));
        }
        const keys = input.operation === "save" ? ["operation", "version", "answers", "step"]
          : input.operation === "site-priority" ? ["operation", "version", "priority"]
          : input.operation === "submit" ? ["operation", "version"] : ["operation"];
        if (Object.keys(input).some(k => !keys.includes(k))) throw new IntakeError("invalid_request");
        if (input.operation === "begin") { if (!token) { token = newResumeToken(); fresh = true; } return await withWorkflow(await service.create(token, service.isOnboarding ? "DIRECT_START" : "FREE_REVIEW")); }
        if (!token) throw new IntakeError("session_unavailable", 404);
        if (input.operation === "save") return await service.save(token, input.version as number, input.answers, input.step as number);
        if (input.operation === "site-priority") return await service.saveSitePriority(token, input.version as number, input.priority);
        if (input.operation === "submit") return await service.submit(token, input.version as number);
        throw new IntakeError("invalid_request");
      } catch (e) { if (e instanceof IntakeError) error = e; throw e; }
    });
    if (error) return reply({ error: error.code, fieldErrors: error.fields }, error.status);
    response.headers.set("Vary", "Cookie");
    if (fresh && response.ok) response.headers.set("Set-Cookie", sessionCookie(token!, 2_592_000));
    return response;
  } catch (e) {
    if (workflow && request.method === "GET" && e instanceof IntakeError && e.code === "session_unavailable" && e.status === 404) {
      // A restarted rehearsal has a new disposable database. A stale resume
      // token should clear only this workflow's cookie after access is verified.
      const response = reply({ state: "not_started" });
      response.headers.set("Set-Cookie", sessionCookie("", 0));
      return response;
    }
    return e instanceof IntakeError ? reply({ error: e.code, fieldErrors: e.fields }, e.status) : reply({ error: "unavailable" }, 503);
  }
}
