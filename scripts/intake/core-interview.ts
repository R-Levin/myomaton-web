import { contactHttp } from "../../lib/platform/contact/http";
import { developmentGuard } from "../../lib/platform/contact/boundaries";
import { sessionToken } from "../../lib/platform/intake/http";
import { IntelligentOnboarding } from "../../lib/platform/intake/intelligent";
import { interviewAnswer } from "../../lib/platform/intake/intelligent-model";
import { IntakeError, type EntryIntent } from "../../lib/platform/intake/model";
import { IntakeService, newResumeToken, resumeHash } from "../../lib/platform/intake/service";
import { developmentOnly } from "../../lib/platform/reviews/model";
import { localInterviewProvider, type InterviewScenario } from "./core-interview-provider";
import { openIntelligentFixture } from "./intelligent-proof-fixture";
import { readManifest } from "./intelligent-live-proof";
import { previousQuestions, researchCases } from "./research-first";

export const coreInterviewApi = "/api/core-interview";
const cookie = "miopages_core_interview_local";
const labels = { c0: "MioPages C0", c2: "Fictional C2 tree service", startup: "Hypothetical mobile bicycle startup" };
type Principal = InterviewScenario | "operator";
type Session = { principal: Principal; expires: number };
type Entry = Awaited<ReturnType<Awaited<ReturnType<typeof openIntelligentFixture>>["createEntry"]>>;
type Interview = { entry: Entry; engine: IntelligentOnboarding; inspector: object };

export async function createCoreInterview(bin: string) {
  developmentOnly();
  const [cases, manifest] = await Promise.all([researchCases(), readManifest()]);
  const fixture = await openIntelligentFixture(bin);
  const credentials = Object.fromEntries([...cases.map(item => item.id), "operator"].map(id => [id, newResumeToken()])) as Record<Principal, string>;
  const users = new Map(Object.entries(credentials).map(([id, code]) => [resumeHash(code), id as Principal]));
  const sessions = new Map<string, Session>();
  const interviews = new Map<string, Promise<Interview>>();
  const abuse = developmentGuard(240);
  const loginGuard = developmentGuard(30);

  async function provision(scenario: InterviewScenario, path: EntryIntent): Promise<Interview> {
    const selection = await fixture.owner();
    const entry = await fixture.createEntry(selection, path);
    await entry.authorize();
    const base = cases.find(item => item.id === scenario)!;
    const history = scenario === "c0" ? manifest.contexts.c0.sources.filter(source => source.kind.startsWith("historical-review-")) : [];
    const evidence = [...base.sources, ...history];
    const initial = previousQuestions[scenario];
    const engine = new IntelligentOnboarding(fixture.activation, new IntakeService(fixture.pool, selection, {
      database: fixture.database, answers: {}, provenance: {},
    }), { scope: entry.scope, evidence: evidence.map(item => ({ ...item, ...selection })),
      gaps: [{ id: "first-decision", questionPurpose: initial.unknown, sourceIds: evidence.map(item => item.id),
        known: evidence.filter(item => item.kind === "owner-confirmed").map(item => item.statement) }],
    }, localInterviewProvider(scenario));
    const draft = await engine.open(entry);
    await engine.propose(entry, draft.version, "first-decision");
    return { entry, engine, inspector: fixture.inspector(entry.scope) };
  }

  async function handle(request: Request, path: string) {
    const reply = (value: unknown, status = 200, extra?: Record<string, string>) => Response.json(value, {
      status, headers: { "Cache-Control": "no-store", "Vary": "Cookie", ...extra },
    });
    if (request.headers.get("x-intake-request") !== "1" || request.headers.get("sec-fetch-site") === "cross-site") {
      return reply({ error: "invalid_origin" }, 403);
    }
    const token = sessionToken(request, cookie);
    const hash = token && resumeHash(token);
    const stored = hash ? sessions.get(hash) : undefined;
    const session = stored && stored.expires > Date.now() ? stored : undefined;
    if (hash && !session) sessions.delete(hash);
    const authenticated = () => {
      if (!session) throw new IntakeError("sign_in_required", 401);
      return session.principal;
    };
    const route = /^\/api\/core-interview\/(c0|c2|startup)\/(review|direct)$/.exec(path);
    const scenario = route?.[1] as InterviewScenario | undefined;
    const entryPath = route?.[2] === "review" ? "FREE_REVIEW" : "DIRECT_START";
    const key = route && scenario ? `${scenario}/${route[2]}` : null;
    const view = async (interview: Interview, principal: Principal) => principal === "operator"
      ? interview.engine.inspect({ ...interview.entry, context: interview.inspector })
      : interview.engine.resume(interview.entry);
    const principalForCase = () => {
      const principal = authenticated();
      if (principal !== "operator" && principal !== scenario) throw new IntakeError("not_found", 404);
      return principal;
    };
    try {
      if (request.method === "GET") {
        if (path === coreInterviewApi) return reply(session ? {
          principal: session.principal, label: session.principal === "operator" ? "Operator" : labels[session.principal],
          cases: session.principal === "operator" ? [...interviews.keys()] : [],
        } : null);
        if (!key) return reply({ error: "not_found" }, 404);
        const principal = principalForCase(), interview = interviews.get(key);
        return reply(interview ? await view(await interview, principal) : null);
      }
      if (request.method !== "POST") return reply({ error: "invalid_method" }, 405);
      if (!await abuse.allow("core-interview-local")) return reply({ error: "rate_limited" }, 429);
      let setCookie: string | undefined, failure: IntakeError | undefined;
      const response = await contactHttp(request, async value => {
        try {
          if (!value || typeof value !== "object" || Array.isArray(value)) throw new IntakeError("invalid_request");
          const input = value as Record<string, unknown>;
          const allowed = input.operation === "login" ? ["operation", "code"] : input.operation === "answer"
            ? ["operation", "version", "questionId", "answer"] : input.operation === "continue" ? ["operation", "version"] : ["operation"];
          if (Object.keys(input).some(name => !allowed.includes(name))) throw new IntakeError("invalid_request");
          if (path === coreInterviewApi && input.operation === "login") {
            if (!await loginGuard.allow("core-interview-local")) throw new IntakeError("rate_limited", 429);
            const principal = typeof input.code === "string" && /^[a-f0-9]{64}$/.test(input.code) ? users.get(resumeHash(input.code)) : undefined;
            if (!principal) throw new IntakeError("invalid_code", 401);
            if (hash) sessions.delete(hash);
            for (const [id, record] of sessions) if (record.expires <= Date.now()) sessions.delete(id);
            if (sessions.size >= 32) throw new IntakeError("session_limit", 429);
            const next = newResumeToken();
            sessions.set(resumeHash(next), { principal, expires: Date.now() + 8 * 60 * 60_000 });
            setCookie = `${cookie}=${next}; Path=${coreInterviewApi}; HttpOnly; SameSite=Strict; Max-Age=28800`;
            return { signedIn: true };
          }
          if (path === coreInterviewApi && input.operation === "logout") {
            if (hash) sessions.delete(hash);
            setCookie = `${cookie}=; Path=${coreInterviewApi}; HttpOnly; SameSite=Strict; Max-Age=0`;
            return { signedIn: false };
          }
          if (!key || !scenario) throw new IntakeError("not_found", 404);
          const principal = principalForCase();
          if (principal === "operator") throw new IntakeError("read_only", 403);
          if (input.operation === "begin") {
            if (!interviews.has(key)) interviews.set(key, provision(scenario, entryPath).catch(error => {
              interviews.delete(key);
              throw error;
            }));
            return await view(await interviews.get(key)!, principal);
          }
          const existing = interviews.get(key);
          if (!existing) throw new IntakeError("not_found", 404);
          if (!Number.isSafeInteger(input.version)) throw new IntakeError("invalid_request");
          const { engine, entry } = await existing, version = input.version as number;
          if (input.operation === "continue") return await engine.propose(entry, version, "first-decision");
          if (input.operation === "answer" && typeof input.questionId === "string") {
            const answer = typeof input.answer === "string" ? input.answer.replace(/\s+/gu, " ").trim() : input.answer;
            const disposition = answer === null ? "unknown" : "provided";
            try { interviewAnswer(disposition, answer); } catch { throw new IntakeError("invalid_answer"); }
            return await engine.answer(entry, version, input.questionId, disposition, answer);
          }
          throw new IntakeError("invalid_request");
        } catch (error) {
          if (error instanceof IntakeError) failure = error;
          throw error;
        }
      });
      if (failure) return reply({ error: failure.code }, failure.status);
      response.headers.set("Vary", "Cookie");
      if (response.ok && setCookie) response.headers.set("Set-Cookie", setCookie);
      return response;
    } catch (error) {
      return error instanceof IntakeError ? reply({ error: error.code }, error.status) : reply({ error: "unavailable" }, 503);
    }
  }
  return { handle, credentials, close: fixture.close };
}

export type CoreInterviewView = Awaited<ReturnType<IntelligentOnboarding["resume"]>>;
