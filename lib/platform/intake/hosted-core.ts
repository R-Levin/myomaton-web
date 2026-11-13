import { randomBytes } from "node:crypto";
import { lstat, realpath, readFile } from "node:fs/promises";
import { fingerprint, uuid } from "../canonical/model";
import { protectedConnection, protectedPool } from "../wordpress-delivery/protected-connection";
import { ProtectedOperator } from "../wordpress-delivery/operator";
import { IntakeService, type IntakeEvidence } from "./service";
import { adaptiveOnboardingVersion, type PreparedUnderstanding } from "./adaptive";
import { IntakeError, normalizeAnswers } from "./model";
import { sessionToken } from "./http";
import { contactHttp } from "../contact/http";
import { developmentGuard } from "../contact/boundaries";
import { ProtectedInterview } from "./protected-interview";
import { initializeResponsesUsageLedger, protectedResponsesProvider, type ResponsesRates } from "./intelligent-responses";
import { responsesHttps } from "./responses-https";
import type { QuestionContext } from "./intelligent-model";

export const coreCookie = "__Host-miopages_core";
type Config = {
  webPresenceId: string; managedSiteId: string; draftToken: string;
  answers: unknown; provenance: Record<string, IntakeEvidence>;
  prepared: PreparedUnderstanding; step: number;
};

export function coreOrigin() {
  if (process.env.MIOPAGES_PROTECTED_CORE !== "enabled") return null;
  const url = new URL(process.env.MIOPAGES_PROTECTED_CORE_ORIGIN ?? "");
  if (url.origin !== "https://wp-acceptance.miopages.com" || url.href !== url.origin + "/") throw Error("Protected Core origin refused");
  return url;
}

async function privateConfig<T>(file: string): Promise<T> {
  const meta = await lstat(file);
  const home = await realpath(process.env.HOME ?? "");
  if (!meta.isFile() || meta.size > 128_000 || meta.uid !== process.getuid?.() || (meta.mode & 0o777) !== 0o600 ||
      await realpath(file) !== file || !file.startsWith(home + "/") || file.includes("/public_html/")) throw Error("Protected Core configuration refused");
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function openCore() {
  const data = await privateConfig<Config>(process.env.MIOPAGES_PROTECTED_CORE_INPUT ?? "");
  if (!/^[0-9a-f]{64}$/.test(data.draftToken) || data.step !== 3 || !Array.isArray(data.prepared?.sources) ||
      !data.provenance || typeof data.provenance !== "object") throw Error("Protected Core draft binding refused");
  const cfg = data;
  const selection = { webPresenceId: uuid(cfg.webPresenceId), managedSiteId: uuid(cfg.managedSiteId) };
  const ca = process.env.MIOPAGES_WP_DATABASE_CA;
  if (!ca) throw Error("Protected Core CA required");
  const role = "miopages_core_development";
  const pool = protectedPool(process.env.MIOPAGES_PROTECTED_CORE_DB_URL ?? "", role, ca);
  const operators = new ProtectedOperator(pool, db => protectedConnection(db, role, "postgres"));
  const answers = normalizeAnswers(cfg.answers, adaptiveOnboardingVersion);
  if (fingerprint(answers) !== fingerprint(cfg.answers) ||
      Object.keys(answers).some(key => cfg.provenance[key]?.confirmation !== "unconfirmed")) throw Error("Protected Core answer binding refused");
  const intake = new IntakeService(pool, selection, {
    database: "postgres", answers, provenance: cfg.provenance, prepared: cfg.prepared, step: cfg.step,
    async protectedScope(db) {
      await protectedConnection(db, role, "postgres");
      const rows = (await db.query(`SELECT 1 FROM public.managed_sites m
        JOIN public.web_presences w ON w.id=m.web_presence_id JOIN public.organizations o ON o.id=w.organization_id
        JOIN public.activation_customer_bindings b ON b.managed_site_id=m.id AND b.web_presence_id=w.id AND b.organization_id=o.id
        WHERE m.id=$1 AND w.id=$2 AND m.status='inactive' AND w.status='inactive' AND o.status='inactive'`,
      [selection.managedSiteId, selection.webPresenceId])).rows;
      if (rows.length !== 1) throw new IntakeError("unavailable", 404);
    },
  });
  let interview: ProtectedInterview | undefined;
  const providerFile = process.env.MIOPAGES_PROTECTED_CORE_AI_SCOPE;
  if (providerFile) {
    const grant = await privateConfig<{ ownerDigest: string; sources: QuestionContext["evidence"]; approvedAnswerDigests: string[];
      expiresAt: number; maxRequests: number; capMicros: number; rates: ResponsesRates; ledgerDirectory: string }>(providerFile);
    if (grant.ownerDigest !== fingerprint(selection) || !Array.isArray(grant.sources) || !grant.sources.length ||
        new Set(grant.sources.map(source => source.id)).size !== grant.sources.length ||
        !Array.isArray(grant.approvedAnswerDigests) || grant.approvedAnswerDigests.some(value => !/^[a-f0-9]{64}$/.test(value)) ||
        !Number.isSafeInteger(grant.maxRequests) || grant.maxRequests > 20 || !Number.isSafeInteger(grant.capMicros) ||
        grant.capMicros > 500_000 || grant.expiresAt > Date.now() + 86_400_000 ||
        grant.rates.model !== "gpt-5.4-mini-2026-03-17" || grant.rates.inputPerMillion !== 750_000 ||
        grant.rates.cachedPerMillion !== 75_000 || grant.rates.outputPerMillion !== 4_500_000 ||
        grant.rates.countMicros !== 0) throw Error("Protected AI scope refused");
    const ledger = await lstat(grant.ledgerDirectory);
    const home = await realpath(process.env.HOME ?? "");
    if (!ledger.isDirectory() || ledger.uid !== process.getuid?.() || (ledger.mode & 0o777) !== 0o700 ||
        await realpath(grant.ledgerDirectory) !== grant.ledgerDirectory || !grant.ledgerDirectory.startsWith(home + "/") ||
        grant.ledgerDirectory.includes("/public_html")) throw Error("Protected AI ledger refused");
    try { await initializeResponsesUsageLedger(grant.ledgerDirectory, grant.rates); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    const provider = protectedResponsesProvider(grant.ledgerDirectory, grant.rates,
      responsesHttps(process.env.MIOPAGES_OPENAI_DEV_API_KEY ?? "", grant.expiresAt), {
        ...grant, project(context, attribution) {
          if (attribution.ownerDigest !== grant.ownerDigest || fingerprint(context.evidence) !== fingerprint(grant.sources)) throw Error("Model evidence scope refused");
          const history = context.history.map(turn => {
            if (!turn.answer || !grant.approvedAnswerDigests.includes(fingerprint(turn.answer.text))) throw Error("Answer transmission not approved");
            return { id: turn.id, question: turn.question, answer: { text: turn.answer.text, disposition: turn.answer.disposition } };
          });
          return { entryPath: context.entryPath, evidence: grant.sources, gap: context.gap, history };
        },
      });
    interview = new ProtectedInterview(intake, provider, grant.sources);
  }
  return { operators, selection, intake, interview, draftToken: cfg.draftToken };
}
let core: ReturnType<typeof openCore> | undefined;
const sessions = new Map<string, { credential: string; expires: number }>();
const loginGuard = developmentGuard(20);

const headers = { "Cache-Control": "no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" };
const session = (token: string, age: number) => `${coreCookie}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;

export async function hostedCoreRequest(request: Request) {
  const reply = (value: unknown, status = 200) => Response.json(value, { status, headers });
  try {
    const origin = coreOrigin();
    if (!origin) return reply({ error: "unavailable" }, 404);
    const url = new URL(request.url);
    if (request.headers.get("host") !== origin.host || request.headers.get("x-forwarded-proto") !== "https" ||
        url.pathname !== "/api/protected-core" || url.search) return reply({ error: "unavailable" }, 404);
    if (request.headers.get("x-intake-request") !== "1" ||
        (request.method === "POST" && request.headers.get("origin") !== origin.origin)) return reply({ error: "invalid_origin" }, 403);
    if (request.method === "POST" && request.headers.get("x-core-operation") === "logout") {
      const token = sessionToken(request, coreCookie);
      if (token) sessions.delete(token);
      const response = reply({ status: "signed_out" });
      response.headers.set("Set-Cookie", session("", 0));
      return response;
    }
    if (request.method !== "GET" && request.method !== "POST") return reply({ error: "invalid_method" }, 405);
    const token = sessionToken(request, coreCookie);
    const active = token ? sessions.get(token) : undefined;
    const credential = active && active.expires > Date.now() ? active.credential : null;
    if (token && !credential) sessions.delete(token);
    if (!credential && request.method === "GET") return reply({ error: "sign_in_required" }, 401);
    const app = await (core ??= openCore());
    const authenticate = async (credential: unknown) => {
      try {
        const context = await app.operators.authenticate(credential);
        await app.operators.authorize(context, "inspect-site-proposal", app.selection);
        return context;
      } catch { return null; }
    };
    if (request.method === "GET") {
      if (!await authenticate(credential)) return reply({ error: "sign_in_required" }, 401);
      try { return reply({ ...await app.intake.resume(app.draftToken), interviewEnabled: Boolean(app.interview) }); }
      catch (error) {
        if (error instanceof IntakeError && error.code === "session_unavailable") return reply({ state: "not_started" });
        throw error;
      }
    }
    let refusal: Response | undefined;
    let signedIn: string | undefined;
    const response = await contactHttp(request, async input => {
      const value = input as Record<string, unknown> | null;
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        refusal = reply({ error: "invalid_request" }, 400);
        return null;
      }
      if (value.operation === "sign-in") {
        if (!await loginGuard.allow(origin.host)) { refusal = reply({ error: "rate_limited" }, 429); return null; }
        if (!await authenticate(value.credential)) { refusal = reply({ error: "sign_in_required" }, 401); return null; }
        const now = Date.now();
        for (const [id, active] of sessions) if (active.expires <= now || active.credential === value.credential) sessions.delete(id);
        if (sessions.size >= 32) { refusal = reply({ error: "unavailable" }, 503); return null; }
        signedIn = randomBytes(32).toString("hex");
        sessions.set(signedIn, { credential: value.credential as string, expires: now + 900_000 });
        return { status: "signed_in" };
      }
      const context = await authenticate(credential);
      if (!context) { refusal = reply({ error: "sign_in_required" }, 401); return null; }
      try { await app.operators.authorize(context, "prepare-site-proposal", app.selection); }
      catch { refusal = reply({ error: "authorization_required" }, 403); return null; }
      try {
        const view = async (result: ReturnType<IntakeService["resume"]>) => ({ ...await result, interviewEnabled: Boolean(app.interview) });
        if (value.operation === "begin") return view(app.intake.create(app.draftToken, "DIRECT_START"));
        if (value.operation === "site-priority") return view(app.intake.saveSitePriority(app.draftToken, Number(value.version), value.priority));
        if (value.operation === "interview-answer" && app.interview) {
          return view(app.interview.answer(app.draftToken, Number(value.version), value.questionId, value.answer));
        }
        if (value.operation === "interview-next" && app.interview) return view(app.interview.next(app.draftToken, Number(value.version)));
        refusal = reply({ error: "invalid_request" }, 400);
      } catch (error) {
        if (!(error instanceof IntakeError)) throw error;
        refusal = reply({ error: error.code }, error.status);
      }
      return null;
    }, origin.origin);
    if (refusal) return refusal;
    for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
    if (signedIn) response.headers.set("Set-Cookie", session(signedIn, 900));
    return response;
  } catch { return reply({ error: "unavailable" }, 503); }
}
