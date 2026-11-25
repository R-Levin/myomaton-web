import { wellFormedRates } from "./intelligent-responses";
import { randomBytes } from "node:crypto";
import { lstat, realpath, readFile } from "node:fs/promises";
import { fingerprint, uuid } from "../canonical/model";
import { protectedConnection, protectedPool } from "../wordpress-delivery/protected-connection";
import { protectedOwnerId, protectedOwnerScope, protectedOwnerSessionSeconds, protectedOwnerToken, protectedOwnerUsername, protectedOwnerVerifier } from "./protected-owner";
import { ProtectedOperator } from "../wordpress-delivery/operator";
import { IntakeService, type IntakeEvidence } from "./service";
import { adaptiveOnboardingVersion, type PreparedUnderstanding } from "./adaptive";
import { type IntakePortalWorkspace, IntakeError, normalizeAnswers } from "./model";
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
import { compactSitePlanningVersion, prepareSitePlanning, type SitePlanningEvidence } from "./site-planning";
import { projectInterviewHistory, type AnswerScope } from "./answer-projection";
import { composePresenceCase, protectedWorkflowWorkspace, reviewWorkflowChange } from "./protected-presence-workflow";
import { accountWork } from "./account-work";
import { protectedAccountBoundary, protectedAccountConfirmation, protectedAccountPool } from "./protected-account";
import { InquiryOutcomes } from "../contact/outcomes";
import { ContactError } from "../contact/model";
import { protectedRetainedSiteReader } from "./protected-retained-site";

export const coreCookie = "__Host-miopages_core";
type Config = {
  webPresenceId: string; managedSiteId: string; draftToken: string;
  answers: unknown; provenance: Record<string, IntakeEvidence>;
  prepared: PreparedUnderstanding; step: number;
};

type SitePlanGrant = AnswerScope & {
  ownerDigest: string; basis: string; inputDigest: string; evidenceDigest: string; sources: SitePlanningEvidence[];
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
  const rawPool = protectedPool(process.env.MIOPAGES_PROTECTED_CORE_DB_URL ?? "", role, ca);
  const pool = process.env.MIOPAGES_PROTECTED_ACCOUNT === "enabled" ? protectedAccountPool(rawPool) : rawPool;
  const operators = new ProtectedOperator(pool, db => protectedConnection(db, role, "postgres"), true);
  const answers = normalizeAnswers(cfg.answers, adaptiveOnboardingVersion);
  if (fingerprint(answers) !== fingerprint(cfg.answers) ||
      Object.keys(answers).some(key => cfg.provenance[key]?.confirmation !== "unconfirmed")) throw Error("Protected Core answer binding refused");
  async function fixtureScope(db: Parameters<typeof protectedConnection>[0]) {
    await protectedConnection(db, role, "postgres");
    await db.query("SET search_path TO miopages_core_guard, miopages_wp, public");
    if (process.env.MIOPAGES_PROTECTED_ACCOUNT === "enabled") await protectedAccountBoundary(db);
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
        !wellFormedRates(grant.rates)) throw Error("Protected AI scope refused");
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
  const presenceCase = process.env.MIOPAGES_PROTECTED_WORKFLOW === "review"
    ? async (authenticated: unknown) => {
      const grant=process.env.MIOPAGES_PROTECTED_ACCOUNT === "enabled"
        ? await operators.authorize(authenticated,"confirm-business-information",selection).catch(()=>null) : null;
      const available=grant?.operatorId === protectedOwnerId && grant.customer?.kind === "business-representative" && grant.customer.subjectId === protectedOwnerId;
      return composePresenceCase(pool, intake, cfg.draftToken, await protectedWorkflowWorkspace(), { kind: "review" },
        available ? protectedAccountConfirmation(pool,operators,authenticated) : undefined);
    } : undefined;
  const outcomes=process.env.MIOPAGES_PROTECTED_ACCOUNT === "enabled" ? new InquiryOutcomes(pool,operators,"development") : undefined;
  const retainedReview = await protectedRetainedSiteReader();
  return { operators, selection, intake, interview, inquiry, sitePlanning, sitePlanningEnabled, presenceCase, outcomes, retainedReview, draftToken: cfg.draftToken };
}
let core: ReturnType<typeof openCore> | undefined;
const sessions = new Map<string, { credential: string; expires: number; origin: string; owner: boolean }>();
const loginGuard = developmentGuard(20);
let ownerSignInPending = false;

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
    const authenticate = async (credential: unknown, owner = false) => {
      try {
        if (typeof credential !== "string") return null;
        const context = owner
          ? await app.operators.authenticateDevelopmentOwner(protectedOwnerVerifier(credential), protectedOwnerId)
          : await app.operators.authenticate(credential);
        const grant = await app.operators.authorize(context, "inspect-site-proposal", app.selection);
        if (owner && (grant.operatorId !== protectedOwnerId || app.selection.webPresenceId !== protectedOwnerScope.webPresenceId ||
            app.selection.managedSiteId !== protectedOwnerScope.managedSiteId)) return null;
        return context;
      } catch { return null; }
    };
    const includeOperations = async (view: Awaited<ReturnType<IntakeService["resume"]>>,
      context: NonNullable<Awaited<ReturnType<typeof authenticate>>>) => {
      const proposal = view.sitePlanning?.proposal;
      if (app.retainedReview && request.headers.get("x-core-original-records") !== "1") {
        const authorized = await app.operators.authorize(context, "inspect-site-proposal", app.selection);
        if (authorized.operatorId === protectedOwnerId) {
          const portal: IntakePortalWorkspace = { role: "operator", identity: "MioPages owner", account: "MioPages",
            site: "Retained website proposal", environment: "protected-development" };
          try { return { ...view, portal, currentSiteReview: await app.retainedReview.read(authorized.operatorId) }; }
          catch { return { ...view, portal, currentSiteReviewUnavailable: true as const }; }
        }
      }
      const canSeeOutcomes=app.outcomes && await app.operators.authorize(context,"inspect-inquiry-outcomes",app.selection).catch(()=>null);
      const outcomeView=canSeeOutcomes ? await app.outcomes!.inspect(context,app.selection)
        .then(inquiryOutcomes=>({inquiryOutcomes})).catch(()=>({inquiryOutcomesUnavailable:true as const})) : {};
      // A pending or invalid workflow grant must not interrupt the prior protected owner review.
      const workflowReview = app.presenceCase && await app.presenceCase(context)
        .then(async scope => {
          const current = await scope.context(), workflow = await (await scope.open()).review(current);
          return { workflowAvailable: true, workflow, ...(workflow && { accountWork: accountWork(current, workflow) }) };
        })
        .catch(() => ({ accountWorkUnavailable: true as const }));
      const canProposeKnowledge = workflowReview && "workflow" in workflowReview && workflowReview.workflow &&
        await app.operators.authorize(context, "prepare-site-proposal", app.selection).then(() => true, () => false);
      const canTriage = workflowReview && "workflow" in workflowReview && workflowReview.workflow?.editorial &&
        await app.operators.authorize(context, "prepare-site-proposal", app.selection).then(() => true, () => false);
      return {
        ...view,
        ...(app.retainedReview && { originalAccountRecords: true as const }),
        portal: { role: "operator", identity: active?.owner ? "MioPages owner" : "Authorized Operator",
          account: "MioPages", site: "C0 development site", environment: "protected-development",
          ...(canTriage && { editorialDecisionsAvailable: true }),
          ...(canProposeKnowledge && { understandingCorrectionsAvailable: true }) } satisfies IntakePortalWorkspace,
        interviewEnabled: Boolean(app.interview), operations: await app.inquiry().catch(() => null),
        sitePlanningEnabled: app.sitePlanningEnabled,
        ...workflowReview,
        ...outcomeView,
        ...(proposal && { sitePlanningReview: { ...reviewedSitePlanning(proposal), current: proposal.basis === sitePlanningBasis(view) } }),
      };
    };
    if (request.method === "GET") {
      const context = await authenticate(credential, active?.owner);
      if (!context) return reply({ error: "sign_in_required" }, 401);
      try {
        const referenceImage = request.headers.get("x-core-review-reference");
        if (referenceImage !== null) {
          if (!app.retainedReview) return reply({ error: "unavailable" }, 404);
          const authorized = await app.operators.authorize(context, "inspect-site-proposal", app.selection);
          if (authorized.operatorId !== protectedOwnerId) return reply({ error: "unavailable" }, 403);
          const image = await app.retainedReview.reference(authorized.operatorId, referenceImage);
          return new Response(new Uint8Array(image.bytes), { headers: { ...headers, "Content-Type": "image/png",
            "X-Image-Width": String(image.width), "X-Image-Height": String(image.height) } });
        }
        const retainedPage = request.headers.get("x-core-review-page");
        if (retainedPage !== null) {
          const before = request.headers.get("x-core-review-before");
          if (!app.retainedReview || !["0", "1"].includes(before ?? "")) return reply({ error: "unavailable" }, 404);
          const authorized = await app.operators.authorize(context, "inspect-site-proposal", app.selection);
          if (authorized.operatorId !== protectedOwnerId) return reply({ error: "unavailable" }, 403);
          const input = await app.retainedReview.preview(authorized.operatorId, retainedPage, before === "1");
          const { renderRetainedNativePreview } = await import("./retained-native-preview");
          return new Response(await renderRetainedNativePreview(input), { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
        }
        const image = request.headers.get("x-miopages-workflow-image");
        if (image !== null) {
          if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(image) || !app.presenceCase) return reply({ error: "unavailable" }, 404);
          const scope = await app.presenceCase(context);
          const bytes = await (await scope.open()).visualImage(await scope.context(), image);
          return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "image/png" } });
        }
        return reply(await includeOperations(await app.intake.resume(app.draftToken), context));
      }
      catch (error) {
        if (request.headers.has("x-miopages-workflow-image")) return reply({ error: "unavailable" }, 404);
        if (error instanceof IntakeError && error.code === "session_unavailable") return reply({ state: "not_started" });
        throw error;
      }
    }
    let refusal: Response | undefined;
    let signedIn: string | undefined;
    let sessionSeconds = 900;
    const response = await contactHttp(request, async input => {
      const value = input as Record<string, unknown> | null;
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        refusal = reply({ error: "invalid_request" }, 400);
        return null;
      }
      if (value.operation === "sign-in") {
        if (!await loginGuard.allow("protected-core")) { refusal = reply({ error: "rate_limited" }, 429); return null; }
        const owner = value.username === protectedOwnerUsername && !Object.hasOwn(value, "credential");
        let secret = value.credential;
        if (owner) {
          // Bound expensive verification to one operation at a time on the shared development host.
          if (ownerSignInPending) { refusal = reply({ error: "rate_limited" }, 429); return null; }
          ownerSignInPending = true;
          try { secret = await protectedOwnerToken(value.password); }
          catch { refusal = reply({ error: "sign_in_required" }, 401); return null; }
          finally { ownerSignInPending = false; }
          sessionSeconds = protectedOwnerSessionSeconds;
        } else if (Object.hasOwn(value, "username") || Object.hasOwn(value, "password")) {
          refusal = reply({ error: "sign_in_required" }, 401); return null;
        }
        if (typeof secret !== "string" || !await authenticate(secret, owner)) {
          refusal = reply({ error: "sign_in_required" }, 401); return null;
        }
        const now = Date.now();
        for (const [id, active] of sessions) if (active.expires <= now || (active.credential === secret && active.origin === origin.origin)) sessions.delete(id);
        if (sessions.size >= 32) { refusal = reply({ error: "unavailable" }, 503); return null; }
        signedIn = randomBytes(32).toString("hex");
        sessions.set(signedIn, { credential: secret, expires: now + sessionSeconds * 1000, origin: origin.origin, owner });
        return { status: "signed_in" };
      }
      const context = await authenticate(credential, active?.owner);
      if (!context) { refusal = reply({ error: "sign_in_required" }, 401); return null; }
      if(value.operation === "record-inquiry-outcome" && app.outcomes) {
        if(Object.keys(value).some(key=>!["operation","outcome"].includes(key))) { refusal=reply({error:"invalid_request"},400);return null; }
        const permitted=await app.operators.authorize(context,"record-inquiry-outcome",app.selection).catch(()=>null);
        if(!permitted) { refusal=reply({error:"authorization_required"},403);return null; }
        try {
          await app.outcomes.record(context,app.selection,value.outcome);
          return await includeOperations(await app.intake.resume(app.draftToken),context);
        } catch(error) {
          if(!(error instanceof ContactError)) throw error;
          refusal=reply({error:error.code},error.status);return null;
        }
      }
      let actor;
      try { actor = await app.operators.authorize(context, ["workflow-visual-decide", "workflow-quality-review"].includes(String(value.operation)) ? "review-private-stage" : "prepare-site-proposal", app.selection); }
      catch { refusal = reply({ error: "authorization_required" }, 403); return null; }
      try {
        const view = async (result: ReturnType<IntakeService["resume"]>) => includeOperations(await result, context);
        const version = Number(value.version);
        if (typeof value.operation === "string" && value.operation.startsWith("workflow-") && app.presenceCase) {
          const scope = await app.presenceCase(context);
          await reviewWorkflowChange(await scope.open(), await scope.context(), value.operation, version,
            { id: actor.operatorId, role: "operator", simulated: false,
              ...((value.operation.startsWith("workflow-visual-") || value.operation === "workflow-editorial-decision" || value.operation === "workflow-quality-review" || value.operation === "workflow-commercial-replan") &&
                { authority: actor.authorityReference }) },
            { finding: value.finding, correction: value.correction, visual: value.visual, editorial: value.editorial, quality: value.quality });
          return await view(app.intake.resume(app.draftToken));
        }
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
          return { ...await view(app.intake.resume(app.draftToken)), operations };
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
    if (signedIn) response.headers.set("Set-Cookie", session(signedIn, sessionSeconds));
    return response;
  } catch { return reply({ error: "unavailable" }, 503); }
}
