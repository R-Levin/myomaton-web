import { randomBytes } from "node:crypto";
import { lstat, realpath, readFile } from "node:fs/promises";
import { fingerprint, uuid } from "../canonical/model";
import { protectedConnection, protectedPool } from "../wordpress-delivery/protected-connection";
import { ProtectedOperator } from "../wordpress-delivery/operator";
import { IntakeService, type IntakeEvidence } from "./service";
import { adaptiveOnboardingVersion, type PreparedUnderstanding } from "./adaptive";
import { IntakeError, normalizeAnswers } from "./model";
import { sessionToken } from "./http";
import { protectedInquiry } from "../contact/protected-inquiry";
import { protectedDevelopmentDraft } from "../wordpress-delivery/cycle-measurement";
import { contactHttp } from "../contact/http";
import { developmentGuard } from "../contact/boundaries";
import { ProtectedInterview } from "./protected-interview";
import { freshCompactComparison, outcomeCompactComparison, initializeResponsesUsageLedger, protectedResponsesProvider, protectedSitePlanningProvider, type ResponsesRates } from "./intelligent-responses";
import { responsesHttps } from "./responses-https";
import type { QuestionContext } from "./intelligent-model";
import { readPresencePlan } from "./presence-plan";
import { interviewDirection } from "./interview-direction";
import { ProtectedSitePlanning, reviewedSitePlanning, sitePlanningBasis } from "./protected-site-planning";
import { PlanningResponseCustody } from "./planning-response-custody";
import { compactSitePlanningVersion, prepareSitePlanning } from "./site-planning";
import { projectInterviewHistory, type AnswerScope } from "./answer-projection";

export const coreCookie = "__Host-miopages_core";
type Config = {
  webPresenceId: string; managedSiteId: string; draftToken: string;
  answers: unknown; provenance: Record<string, IntakeEvidence>;
  prepared: PreparedUnderstanding; step: number;
};

type SitePlanGrant = AnswerScope & {
  ownerDigest: string; basis: string; inputDigest: string; evidenceDigest: string; sources: QuestionContext["evidence"];
  expiresAt: number; maxRequests: number; capMicros: number; revoked?: boolean;
  format?: typeof compactSitePlanningVersion; maxOutputTokens?: number; scopeDigest?: string; retainedReservation?: string; comparisonId?: string; comparisonAttempt?: number;
};
type ProviderGrant = AnswerScope & { ownerDigest: string; sources: QuestionContext["evidence"];
  expiresAt: number; maxRequests: number; capMicros: number; rates: ResponsesRates; ledgerDirectory: string; revoked?: boolean };

function grantBinding(grant: ProviderGrant) {
  return fingerprint({ ownerDigest: grant.ownerDigest, sources: grant.sources, expiresAt: grant.expiresAt,
    maxRequests: grant.maxRequests, capMicros: grant.capMicros, rates: grant.rates, ledgerDirectory: grant.ledgerDirectory });
}

const protectedCoreOrigin = "https://wp-acceptance.miopages.com";

export function coreOrigin(host: string | null) {
  if (process.env.MIOPAGES_PROTECTED_CORE !== "enabled") return null;
  if (process.env.MIOPAGES_PROTECTED_CORE_ORIGIN !== protectedCoreOrigin) throw Error("Protected Core origin refused");
  const origin = new URL(protectedCoreOrigin);
  return host === origin.host ? origin : null;
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
  const operators = new ProtectedOperator(pool, db => protectedConnection(db, role, "postgres"), true);
  const answers = normalizeAnswers(cfg.answers, adaptiveOnboardingVersion);
  if (fingerprint(answers) !== fingerprint(cfg.answers) ||
      Object.keys(answers).some(key => cfg.provenance[key]?.confirmation !== "unconfirmed")) throw Error("Protected Core answer binding refused");
  async function fixtureScope(db: Parameters<typeof protectedConnection>[0]) {
    await protectedConnection(db, role, "postgres");
    await db.query("SET search_path TO miopages_core_guard, miopages_wp, public");
    const rows = (await db.query(`SELECT 1 FROM miopages_wp.core_development_scope WHERE managed_site_id=$1 AND web_presence_id=$2`,
      [selection.managedSiteId, selection.webPresenceId])).rows;
    if (rows.length !== 1) throw new IntakeError("unavailable", 404);
  }
  const intake = new IntakeService(pool, selection, {
    database: "postgres", answers, provenance: cfg.provenance, prepared: cfg.prepared, step: cfg.step,
    protectedScope: fixtureScope,
  });
  const inquiryFile = process.env.MIOPAGES_PROTECTED_CORE_INQUIRY_SCOPE;
  const inquiry = async (accept = false) => {
    if (!inquiryFile) return null;
    const grant = await privateConfig<{ binding: string; enabled: boolean; expiresAt: number }>(inquiryFile);
    if (grant.enabled !== true || grant.binding !== fingerprint({ selection, draft: protectedDevelopmentDraft }) ||
        !Number.isSafeInteger(grant.expiresAt) || grant.expiresAt <= Date.now() ||
        grant.expiresAt > Date.now() + 86_400_000) return null;
    const db = await pool.connect();
    try {
      await fixtureScope(db);
      return await protectedInquiry(db, selection, protectedDevelopmentDraft, accept);
    } finally { db.release(); }
  };
  let interview: ProtectedInterview | undefined;
  const coreHome = await realpath(process.env.HOME ?? "");
  const privateRoot = coreHome + "/miopages-private-acceptance";
  const custody = new PlanningResponseCustody(privateRoot + "/site-planning-proof/responses", Date.now, privateRoot + "/core-usage");
  let sitePlanning = new ProtectedSitePlanning(intake, undefined, custody);
  let sitePlanningEnabled = false;
  const planningFile = process.env.MIOPAGES_PROTECTED_CORE_SITE_PLANNING_SCOPE;

  const providerFile = process.env.MIOPAGES_PROTECTED_CORE_AI_SCOPE;
  if (providerFile) {
    const grant = await privateConfig<ProviderGrant>(providerFile);
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
        ...grant, async project(context, attribution) {
          const current = await privateConfig<ProviderGrant>(providerFile);
          if ((current.revoked !== undefined && current.revoked !== false) || grantBinding(current) !== grantBinding(grant)) {
            throw Error("Protected AI authorization refused");
          }
          if (attribution.ownerDigest !== grant.ownerDigest || fingerprint(context.evidence) !== fingerprint(grant.sources)) throw Error("Model evidence scope refused");
          const history = projectInterviewHistory(context.history, current, grant.expiresAt);
          return { entryPath: context.entryPath, evidence: grant.sources, gap: context.gap, history };
        },
      });
    interview = new ProtectedInterview(intake, provider, grant.sources);
    if (planningFile) {
      const readGrant = () => privateConfig<SitePlanGrant>(planningFile);
      const initial = await readGrant();
      const binding = fingerprint(initial);
      if (initial.revoked !== true && initial.expiresAt > Date.now()) {
        if (initial.ownerDigest !== fingerprint(selection) ||
            initial.expiresAt > Date.now() + 86_400_000 || initial.maxRequests !== 2 ||
            initial.capMicros > 500_000 || !/^[0-9a-f]{64}$/u.test(initial.basis)) throw Error("Protected site planning scope refused");
        const compact = initial.format === compactSitePlanningVersion;
        const outcome = initial.comparisonId === outcomeCompactComparison.id;
        const comparison = outcome ? outcomeCompactComparison : freshCompactComparison;
        const fresh = initial.comparisonId === comparison.id;
        if (initial.comparisonId !== undefined && !fresh) throw Error("Invalid comparison identity");
        if (compact && (initial.expiresAt > grant.expiresAt || grant.revoked === true ||
            initial.capMicros !== (fresh ? comparison.capMicros : 74_029) ||
            (fresh && (grant.maxRequests < (outcome ? outcomeCompactComparison.baselineRequests + 2 : comparison.maxRequests) ||
              grant.capMicros < comparison.capMicros)) ||
            initial.retainedReservation !== comparison.retainedReservation ||
            initial.scopeDigest !== comparison.scopeDigest ||
            initial.inputDigest !== comparison.c0)) throw Error("Compact site planning grant exceeds approved scope");
        if (!compact && (fresh || initial.retainedReservation !== undefined)) throw Error("Prior reservation authorization refused");
        if (grant.ledgerDirectory !== privateRoot + "/core-usage") throw Error("Site planning recovery ledger refused");
        const generate = protectedSitePlanningProvider(grant.ledgerDirectory, grant.rates,
          responsesHttps(process.env.MIOPAGES_OPENAI_DEV_API_KEY ?? "", initial.expiresAt), { ...initial,
            // Absolute ledger ceilings preserve accrued usage in the existing shared ledger.
            maxRequests: compact ? Math.min(outcome ? outcomeCompactComparison.maxRequests : grant.maxRequests,
              fresh ? comparison.maxRequests : 16) : grant.maxRequests,
            capMicros: Math.min(grant.capMicros, initial.capMicros),
            maxAdditionalRequests: initial.maxRequests,
          });
        sitePlanning = new ProtectedSitePlanning(intake, { model: grant.rates.model,
          generate, format: compact ? compactSitePlanningVersion : "full",
          comparisonId: initial.comparisonId, comparisonAttempt: initial.comparisonAttempt,
          async input(view) {
            const current = await readGrant();
            if (compact) {
              const governing = await privateConfig<ProviderGrant>(providerFile);
              if (governing.revoked === true || governing.expiresAt < current.expiresAt ||
                  grantBinding(governing) !== grantBinding(grant)) throw Error("Governing AI authorization changed");
            }
            if (fingerprint(current) !== binding || current.revoked === true ||
                current.basis !== sitePlanningBasis(view)) throw Error("Site planning authorization refused");
            const prepared = prepareSitePlanning(current.ownerDigest, current.sources, view.interview?.turns ?? [], current);
            if (fresh && (prepared.input.answers.length !== 1 || prepared.input.answers[0].confirmation !== "unconfirmed")) {
              throw Error("Fresh comparison answer scope refused");
            }
            return prepared;
          },
        }, custody);
        sitePlanningEnabled = true;
      }
    }
  }
  return { operators, selection, intake, interview, inquiry, sitePlanning, sitePlanningEnabled, draftToken: cfg.draftToken };
}
let core: ReturnType<typeof openCore> | undefined;
const sessions = new Map<string, { credential: string; expires: number; origin: string }>();
const loginGuard = developmentGuard(20);

const headers = { "Cache-Control": "no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" };
const session = (token: string, age: number) => `${coreCookie}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;

export async function hostedCoreRequest(request: Request) {
  const reply = (value: unknown, status = 200) => Response.json(value, { status, headers });
  try {
    const origin = coreOrigin(request.headers.get("host"));
    if (!origin) return reply({ error: "unavailable" }, 404);
    const url = new URL(request.url);
    if (request.headers.get("x-forwarded-proto") !== "https" ||
        url.pathname !== "/api/protected-core" || url.search) return reply({ error: "unavailable" }, 404);
    if (request.headers.get("x-intake-request") !== "1" ||
        (request.method === "POST" && request.headers.get("origin") !== origin.origin)) return reply({ error: "invalid_origin" }, 403);
    if (request.method === "POST" && request.headers.get("x-core-operation") === "logout") {
      const token = sessionToken(request, coreCookie);
      if (token && sessions.get(token)?.origin === origin.origin) sessions.delete(token);
      const response = reply({ status: "signed_out" });
      response.headers.set("Set-Cookie", session("", 0));
      return response;
    }
    if (request.method !== "GET" && request.method !== "POST") return reply({ error: "invalid_method" }, 405);
    const token = sessionToken(request, coreCookie);
    const active = token ? sessions.get(token) : undefined;
    const credential = active && active.origin === origin.origin && active.expires > Date.now() ? active.credential : null;
    if (token && active && active.expires <= Date.now()) sessions.delete(token);
    if (!credential && request.method === "GET") return reply({ error: "sign_in_required" }, 401);
    const app = await (core ??= openCore());
    const authenticate = async (credential: unknown) => {
      try {
        const context = await app.operators.authenticate(credential);
        await app.operators.authorize(context, "inspect-site-proposal", app.selection);
        return context;
      } catch { return null; }
    };
    const includeOperations = async (view: Awaited<ReturnType<IntakeService["resume"]>>) => {
      const proposal = view.sitePlanning?.proposal;
      return {
        ...view, interviewEnabled: Boolean(app.interview), operations: await app.inquiry().catch(() => null),
        sitePlanningEnabled: app.sitePlanningEnabled,
        ...(proposal && { sitePlanningReview: { ...reviewedSitePlanning(proposal), current: proposal.basis === sitePlanningBasis(view) } }),
      };
    };
    if (request.method === "GET") {
      if (!await authenticate(credential)) return reply({ error: "sign_in_required" }, 401);
      try { return reply(await includeOperations(await app.intake.resume(app.draftToken))); }
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
        if (!await loginGuard.allow("protected-core")) { refusal = reply({ error: "rate_limited" }, 429); return null; }
        if (!await authenticate(value.credential)) { refusal = reply({ error: "sign_in_required" }, 401); return null; }
        const now = Date.now();
        for (const [id, active] of sessions) if (active.expires <= now || (active.credential === value.credential && active.origin === origin.origin)) sessions.delete(id);
        if (sessions.size >= 32) { refusal = reply({ error: "unavailable" }, 503); return null; }
        signedIn = randomBytes(32).toString("hex");
        sessions.set(signedIn, { credential: value.credential as string, expires: now + 900_000, origin: origin.origin });
        return { status: "signed_in" };
      }
      const context = await authenticate(credential);
      if (!context) { refusal = reply({ error: "sign_in_required" }, 401); return null; }
      let actor;
      try { actor = await app.operators.authorize(context, "prepare-site-proposal", app.selection); }
      catch { refusal = reply({ error: "authorization_required" }, 403); return null; }
      try {
        const view = async (result: ReturnType<IntakeService["resume"]>) => includeOperations(await result);
        const version = Number(value.version);
        if (typeof value.operation === "string" && value.operation.startsWith("site-plan-")) {
          switch (value.operation) {
            case "site-plan-generate": return await view(app.sitePlanning.generate(app.draftToken, version));
            case "site-plan-recover": return await view(app.sitePlanning.recover(app.draftToken, version));
            case "site-plan-recover-copy": return await view(app.sitePlanning.recover(app.draftToken, version,
              { homeDescription: value.homeDescription, actor }));
            case "site-plan-edit": return await view(app.sitePlanning.edit(app.draftToken, version, value.digest, value.plan, value.destinations, value.improvementCopy));
            case "site-plan-decide": return await view(app.sitePlanning.decide(app.draftToken, version, value.digest, value.status, value.note, actor));
            case "site-plan-delivery": return await app.sitePlanning.delivery(app.draftToken, value.version);
            case "site-plan-improve": {
              const operations = await app.inquiry();
              const evidence = operations?.recommendation;
              if (!evidence || !operations || evidence.evidenceId !== value.inquiryId || typeof value.pagePath !== "string") {
                throw new IntakeError("draft_changed", 409);
              }
              return await view(app.sitePlanning.improve(app.draftToken, version, value.digest, { inquiryId: evidence.evidenceId,
                draftDigest: operations.draft.appliedDigest, pagePath: value.pagePath, section: evidence.suggestedSection, synthetic: true }));
            }
            default: throw new IntakeError("invalid_request");
          }
        }
        if (value.operation === "accept-development-inquiry") {
          if (Object.keys(value).length !== 1) throw new IntakeError("invalid_request");
          const operations = await app.inquiry(true);
          if (!operations) throw new IntakeError("unavailable", 404);
          return { ...await includeOperations(await app.intake.resume(app.draftToken)), operations };
        }
        if (value.operation === "review-delivery-input") {
          const current = await app.intake.resume(app.draftToken);
          const finding = interviewDirection(current.interview?.turns ?? []);
          const reviewed = current.interview?.reviewedPlan;
          if (current.version !== value.version || !current.planningEvidence || !finding ||
              reviewed?.findingId !== finding.findingId || current.interview?.pending) throw new IntakeError("draft_changed", 409);
          const packet = { scope: app.selection, version: current.version, evidenceDigest: current.planningEvidence.evidenceDigest,
            finding: { ...finding, plan: reviewed.plan }, planOrigin: reviewed.origin ?? (finding.plan ? "model" : "operator"), ...(reviewed.improvement && { improvement: reviewed.improvement }) };
          return { packet, digest: fingerprint(packet) };
        }
        if (value.operation === "begin") return view(app.intake.create(app.draftToken, "DIRECT_START"));
        if (value.operation === "site-priority") return view(app.intake.saveSitePriority(app.draftToken, Number(value.version), value.priority));
        if (value.operation === "interview-answer" && app.interview) {
          return view(app.interview.answer(app.draftToken, Number(value.version), value.questionId, value.answer));
        }
        if (value.operation === "correct-interview-answer" && app.interview) {
          return view(app.interview.correctAnswer(app.draftToken, Number(value.version), value.questionId, value.answer));
        }
        if (value.operation === "interview-next" && app.interview) return view(app.interview.next(app.draftToken, Number(value.version)));
        if (value.operation === "edit-presence-plan" && app.interview) {
          if (value.improvementEvidence !== undefined) {
            const operations = await app.inquiry();
            const evidence = operations?.recommendation;
            if (!operations || !evidence || evidence.evidenceId !== value.improvementEvidence) throw new IntakeError("draft_changed", 409);
            let plan;
            try { plan = readPresencePlan(value.plan); } catch { throw new IntakeError("invalid_request"); }
            const page = plan.pages.find(item => item.path === value.improvementPage);
            if (!page || !page.sections.some(section => fingerprint(section) === fingerprint(evidence.suggestedSection))) {
              throw new IntakeError("invalid_request");
            }
            return view(app.interview.editPlan(app.draftToken, Number(value.version), value.findingId, plan,
              { inquiryId: evidence.evidenceId, draftDigest: operations.draft.appliedDigest, pagePath: page.path }));
          }
          return view(app.interview.editPlan(app.draftToken, Number(value.version), value.findingId, value.plan));
        }
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
