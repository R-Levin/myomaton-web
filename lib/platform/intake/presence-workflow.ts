import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { fingerprint, object, text } from "../canonical/model";
import type { DeploymentSelection } from "../managed-sites/deployment";
import type { EntryIntent } from "./model";
import { IntakeError } from "./model";
import type { EvaluationBinding } from "./presence-evaluation";
import { composeHomeConcept, homeConceptDigest } from "./presence-home-concept";
import { strategyBasis } from "./presence-decision-brief";
import { applyEditorialPatch } from "./presence-editorial-patch";
import { editorialDecision, editorialFindings, withEditorialHistory, type EditorialDecision, type EditorialFinding } from "./presence-editorial-decisions";
import { presenceVisualPlacement, type PresenceVisual, type PresenceVisualOperations } from "./presence-workflow-visual";
import {
  ArtifactValidationError, readBlueprint, readDirection, readEditorial, readPage, readReport, type ArtifactIssue, type PresenceEvidence,
  type WorkflowBlueprint, type WorkflowDirection, type WorkflowEditorial, type WorkflowPage, type WorkflowReport,
} from "./presence-workflow-artifacts";

import { commercialRevisionGuidance, qualityPass, readQualityReview, verifyCommercialJourneys, type MarketingAuthority, type QualityReview } from "./presence-marketing-authority";
import type { ResolvePrivateVisuals } from "../content-editing/proposal-media";

export type WorkflowContext = {
  scope: DeploymentSelection;
  intakeId: string;
  entry: EntryIntent;
  evidence: PresenceEvidence[];
  limitations: string[];
  conflicts: string[];
  evaluation?: EvaluationBinding;
};
export type WorkflowOperation = "research" | "report" | "direction" | "blueprint" | "page" | "editorial";
export type WorkflowActor = { id: string; role: "customer" | "operator"; simulated: boolean; authority?: string };
type Actor = WorkflowActor;
type ConceptReviewStage = { phase: "home-concept"; target: string };

type Work = {
  operation: WorkflowOperation;
  path?: string;
  attempt: string;
  until: number;
  inputDigest: string;
  retryOf?: string;
  reviewStage?: ConceptReviewStage;
};
type Failure = "operation-blocked" | "output-invalid" | "outcome-unknown";
type Decision = { actor: Actor; at: string; target: string; decision: "confirmed" | "development-continuation" | "reviewed" };
type Correction = { finding: WorkflowReport["findings"][number]; text: string; reportDigest: string; actor: Actor; at: string };
type RevisionRequest = { paths: string[]; audit: WorkflowEditorial; priorPages: WorkflowPage[]; actor: Actor; at: string; ordinal: number; source?: "home-concept" | "operator-editorial"; batch?: "pending" | "applied" };
export type SourceRepairAuthorization = { authorization: string; baseVersion: number; previousStateDigest: string; materialsDigest: string };
type SourceRecovery = SourceRepairAuthorization & { actor: Actor; at: string; priorRevisionOrdinal: number;
  previous: { report: WorkflowReport | null; direction: WorkflowDirection | null; blueprint: WorkflowBlueprint | null; pages: WorkflowPage[] } };

type State = {
  version: number;
  contextDigest: string;
  sourceSnapshot: Pick<WorkflowContext, "evidence" | "limitations" | "conflicts" | "entry">;
  marketingAuthorityDigest?: string;
  evaluation?: EvaluationBinding;
  homeReview?: { digest: string; reference: string; actor: Actor; at: string } | null;
  mode: "fixture" | "provider";
  research: PresenceEvidence[] | null;
  report: WorkflowReport | null;
  confirmation: Decision | null;
  corrections: Correction[];
  direction: WorkflowDirection | null;
  blueprint: WorkflowBlueprint | null;
  pages: WorkflowPage[];
  editorial: WorkflowEditorial | null;
  editorialFindings?: EditorialFinding[];
  editorialDecisions?: EditorialDecision[];
  revisionRequest?: RevisionRequest | null;
  replan?: { ordinal: number; concerns: QualityReview["findings"][number]["criterion"][];
    priorRejectedPages?: WorkflowPage[];
    conceptCritique?: { target: string; inputDigest: string; editorial: WorkflowEditorial } };
  operatorReview: Decision | null;
  qualityReviews?: { actor: Actor; at: string; review: QualityReview; phase?: "home-concept" }[];
  conceptEditorial?: { target: string; inputDigest: string; editorial: WorkflowEditorial } | null;
  sourceRecovery?: SourceRecovery;
  work: Work | null;
  failure: Failure | null;
  artifactIssue?: ArtifactIssue | null;
  retry?: { previous: string; count: number };
  visuals?: PresenceVisual[];
};
type Task = Pick<Work, "operation" | "path">;
export type WorkflowInput = Pick<State, "research" | "report" | "corrections" | "direction" | "blueprint" | "pages" | "revisionRequest" | "replan"> &
  Pick<WorkflowContext, "entry" | "evidence" | "limitations" | "conflicts"> & { reviewStage?: ConceptReviewStage; sourceRecovery?: SourceRecovery };
export type WorkflowRun = { context: WorkflowContext; input: WorkflowInput; work: Work };
export interface PresenceWorkflowOperations {
  readonly mode: State["mode"];
  readonly maxRetries?: number;
  readonly marketingAuthority?: MarketingAuthority;
  readonly requiresResearch?: boolean;
  readonly maxEditorialRevisions?: number;
  readonly maxCommercialReplans?: number;
  readonly sourceRepair?: SourceRepairAuthorization;
  readonly visuals?: PresenceVisualOperations;
  preflight?(run: WorkflowRun): Promise<void>;
  run(run: WorkflowRun, retain: (bytes: Buffer) => Promise<void>): Promise<unknown>;
  recover(run: WorkflowRun, bytes: Buffer): Promise<unknown>;
  verifyReportReplacement?(run: WorkflowRun): Promise<void>;
  verifyUndispatchedRequest?(run:WorkflowRun):Promise<void>;
  completeMarketResearch?(run: WorkflowRun, original: Buffer, custody: {
    read(attempt: string): Promise<Buffer | null>;
    retain(attempt: string, bytes: Buffer): Promise<void>;
  }): Promise<unknown>;
}

export class WorkflowBlocked extends Error {}
const contentDigest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const identity = ({ scope, intakeId }: WorkflowContext) => [scope.webPresenceId, scope.managedSiteId, intakeId];

class WorkflowStore {
  private readonly events: string;
  private readonly outputs: string;
  private readonly intakes: string;

  constructor(private pool: Pool, boundary: "disposable" | "protected") {
    const schema = boundary === "protected" ? "miopages_core_workflow" : "public";
    this.events = schema + ".presence_workflow_events";
    this.outputs = schema + ".presence_workflow_outputs";
    this.intakes = boundary === "protected" ? "miopages_wp.core_development_drafts" : "public.prospect_intakes";
  }

  async read(context: WorkflowContext): Promise<State | null> {
    const { rows: [row] } = await this.pool.query<{ payload: State; digest: string }>(`
      SELECT payload, digest FROM ${this.events}
      WHERE web_presence_id=$1 AND managed_site_id=$2 AND intake_id=$3
      ORDER BY version DESC LIMIT 1`, identity(context));
    if (!row) return null;
    if (fingerprint(row.payload) !== row.digest) throw new IntakeError("unavailable", 503);
    return row.payload;
  }

  async append(context: WorkflowContext, previous: number, next: Omit<State, "version">) {
    const state = { ...next, version: previous + 1 };
    const { rowCount } = await this.pool.query(`
      INSERT INTO ${this.events} (web_presence_id,managed_site_id,intake_id,version,payload,digest)
      SELECT web_presence_id, managed_site_id, id, $4::int, $5::jsonb, $6
      FROM ${this.intakes}
      WHERE web_presence_id=$1 AND managed_site_id=$2 AND id=$3
      AND $4::int = 1 + COALESCE((SELECT max(version) FROM ${this.events}
        WHERE web_presence_id=$1 AND managed_site_id=$2 AND intake_id=$3), 0)
      ON CONFLICT DO NOTHING`, [...identity(context), state.version, JSON.stringify(state), fingerprint(state)]);
    if (rowCount !== 1) throw new IntakeError("draft_changed", 409);
    return state;
  }

  async retain(context: WorkflowContext, work: Pick<Work, "attempt">, bytes: Buffer) {
    const digest = contentDigest(bytes);
    await this.pool.query(`
      INSERT INTO ${this.outputs} (web_presence_id,managed_site_id,intake_id,attempt_id,bytes,digest)
      SELECT web_presence_id,managed_site_id,id,$4,$5,$6 FROM ${this.intakes}
      WHERE web_presence_id=$1 AND managed_site_id=$2 AND id=$3
      ON CONFLICT DO NOTHING`, [...identity(context), work.attempt, bytes, digest]);
    if (contentDigest((await this.output(context, work)) ?? Buffer.alloc(0)) !== digest) throw Error("Conflicting retained output");
  }

  async output(context: WorkflowContext, work: Pick<Work, "attempt">) {
    const { rows: [row] } = await this.pool.query<{ bytes: Buffer; digest: string }>(`
      SELECT bytes, digest FROM ${this.outputs}
      WHERE web_presence_id=$1 AND managed_site_id=$2 AND intake_id=$3 AND attempt_id=$4`, [...identity(context), work.attempt]);
    if (!row) return null;
    if (contentDigest(row.bytes) !== row.digest) throw Error("Retained output integrity failed");
    return row.bytes;
  }
}

function savedEditorialFindings(state: State) {
  return state.editorialFindings ?? editorialFindings(state.editorial, state.version);
}

function editorialProgress(state: State) {
  const findings = withEditorialHistory(savedEditorialFindings(state), state.editorialDecisions ?? []);
  const pages = new Map(state.pages.map(page => [page.path, page]));
  const assigned = findings.flatMap(finding => {
    const decision = finding.history.at(-1);
    return decision?.status === "assigned" && decision.pages.every(({ path, baseline }) =>
      pages.has(path) && fingerprint(pages.get(path)) === baseline) ? [{ finding, decision }] : [];
  });
  return { findings, assigned, open: findings.some(finding => finding.history.at(-1)?.status !== "resolved") };
}

function candidateReviewTarget(state: State) {
  return fingerprint({ confirmation: state.confirmation?.target, direction: state.direction, blueprint: state.blueprint,
    pages: state.pages, editorial: state.editorial, ...(state.editorialDecisions?.length && { editorialDecisions: state.editorialDecisions }) });
}

function conceptQualityTarget(context: WorkflowContext, state: State, authority: MarketingAuthority | undefined, disposable: boolean) {
  if (!disposable || !authority?.earlyConceptReview || !state.evaluation || !state.confirmation ||
      state.homeReview || state.work || state.failure || state.contextDigest !== fingerprint(context) ||
      state.marketingAuthorityDigest !== fingerprint(authority)) return undefined;
  const concept = homeConceptDigest(context, state);
  if (!concept) return undefined;
  const visuals = (state.visuals ?? []).filter(visual => visual.placement.candidateDigest === concept);
  if (visuals.some(visual => !["approved", "rejected", "revoked"].includes(visual.state))) return undefined;
  return fingerprint({ phase: "home-concept", candidate: concept, context: state.contextDigest, authority, visuals,
    report: state.report, confirmation: state.confirmation, corrections: state.corrections, research: state.research });
}

function nextTask(state: State): Task | null {
  if (!state.research) return { operation: "research" };
  if (!state.report) return { operation: "report" };
  if (!state.confirmation) return null;
  if (!state.direction) return { operation: "direction" };
  if (!state.blueprint) return { operation: "blueprint" };
  const drafted = new Set(state.pages.map(page => page.path));
  if (!drafted.has("/") && state.blueprint.pages.some(page => page.path === "/")) return { operation: "page", path: "/" };
  if (state.evaluation && !state.homeReview) return null;
  if (state.evaluation && state.revisionRequest?.batch === "pending") return { operation: "page" };
  const missing = state.blueprint.pages.find(page => !drafted.has(page.path));
  if (missing) return { operation: "page", path: missing.path };
  if (!state.editorial) return { operation: "editorial" };
  return null;
}
function runInput(context: WorkflowContext, state: State, reviewStage = state.work?.reviewStage): WorkflowInput {
  const { entry, evidence, limitations, conflicts } = context;
  const { report, research, direction, blueprint, pages, corrections, revisionRequest, replan, sourceRecovery } = state;
  return { entry, evidence, limitations, conflicts, report, research, direction, blueprint, pages, corrections, ...(revisionRequest && { revisionRequest }), ...(replan && { replan }), ...(sourceRecovery && { sourceRecovery }), ...(reviewStage && { reviewStage }) };
}
function readResearch(value: unknown, ids: readonly string[]): PresenceEvidence[] {
  if (!Array.isArray(value) || !value.length) throw Error("Research record is incomplete");
  const seen = new Set(ids);
  return value.map(item => {
    const record = object(item, ["id", "kind", "label", "reference", "date", "content", "rawDigest", "discoveredFrom", "captureStatus"]);
    const id = text(record.id, 160);
    const reference = new URL(text(record.reference, 500));
    const date = text(record.date, 10);
    if (seen.has(id) || record.kind !== "public-research" || reference.protocol !== "https:" || reference.username ||
        reference.password || reference.search || reference.hash || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw Error("Research provenance refused");
    }
    const rawDigest = record.rawDigest === undefined ? undefined : text(record.rawDigest, 64);
    if (rawDigest !== undefined && !/^[a-f0-9]{64}$/u.test(rawDigest)) throw Error("Research integrity refused");
    seen.add(id);
    return { id, kind: "public-research", reference: reference.href, date, label: text(record.label, 250),
      content: text(record.content, Infinity, true), ...(rawDigest && { rawDigest }),
      ...(record.captureStatus==="incomplete" && {captureStatus:"incomplete" as const}),
      ...(typeof record.discoveredFrom === "string" && { discoveredFrom: text(record.discoveredFrom, 500) }) };
  });
}

export class PresenceWorkflow {
  private store: WorkflowStore;

  constructor(pool: Pool, private operations: PresenceWorkflowOperations,
    private destinations: Parameters<typeof readPage>[4] = {}, private clock = Date.now, private boundary: "disposable" | "protected" = "disposable") {
    this.store = new WorkflowStore(pool, boundary);
  }

  async review(context: WorkflowContext) {
    return this.view(context, await this.store.read(context));
  }

  private view(context: WorkflowContext, state: State | null) {
    if (!state) return null;
    const authority = this.operations.marketingAuthority;
    const current = state.contextDigest === fingerprint(context) &&
      state.marketingAuthorityDigest === (authority && fingerprint(authority));
    const editorial = editorialProgress(state);
    const concept = current && state.evaluation && !state.homeReview ? homeConceptDigest(context, state) : undefined;
    const canRenderForEditorial = current && this.boundary === "disposable" && Boolean(authority?.earlyConceptReview) &&
      !state.work && !state.failure && nextTask(state)?.operation === "editorial";
    const canQueueEditorialRevision = current && Boolean(state.editorial) && !state.work && !state.operatorReview &&
      (state.revisionRequest?.ordinal ?? 0) < (this.operations.maxEditorialRevisions ?? 1) &&
      Boolean(state.editorial?.concerns.length || editorial.assigned.length);
    const next = !current ? "evidence-changed" : state.failure ? "recover" : state.work ? "in-progress" :
      nextTask(state)?.operation ?? (concept ? "home-concept" : !state.confirmation ? "customer-review" :
        state.editorial && (state.editorial.concerns.length || editorial.open) ? "editorial-review" :
          !state.operatorReview ? "operator-review" : "review-complete");
    const reviewedVisuals = (state.visuals ?? []).filter(visual => visual.placement.candidateDigest === state.operatorReview?.target);
    const qualityTarget = current && authority && state.operatorReview && !reviewedVisuals.some(visual =>
      !["approved", "rejected", "revoked"].includes(visual.state))
      ? fingerprint({ candidate: state.operatorReview.target, context: state.contextDigest, authority, visuals: reviewedVisuals }) : undefined;
    const deliveryHistory = (state.qualityReviews ?? []).filter(review => !review.phase);
    const lastQualityReview = deliveryHistory.at(-1);
    const conceptTarget = conceptQualityTarget(context, state, authority, this.boundary === "disposable");
    const conceptHistory = (state.qualityReviews ?? []).filter(review => review.phase === "home-concept");
    const lastConceptReview = conceptHistory.at(-1);
    const conceptQuality = conceptTarget ? {
      target: conceptTarget,
      critique: state.conceptEditorial?.target === conceptTarget ? state.conceptEditorial : null,
      passed: Boolean(lastConceptReview && lastConceptReview.review.target === conceptTarget &&
        lastConceptReview.actor.id === authority?.qualityReviewerId && qualityPass(lastConceptReview.review, conceptTarget)),
      history: conceptHistory,
    } : undefined;
    const deliveryQuality = authority ? {
      target: qualityTarget ?? null,
      passed: Boolean(qualityTarget && lastQualityReview && qualityPass(lastQualityReview.review, lastQualityReview.review.target) &&
        lastQualityReview.review.target === qualityTarget && lastQualityReview.actor.id === authority.qualityReviewerId),
      history: deliveryHistory,
    } : undefined;
    const { research, report, confirmation, corrections, direction, blueprint, pages, operatorReview, version, mode, failure } = state;
    return { version, mode, contextDigest: state.contextDigest, research, report, confirmation, corrections, direction, blueprint, pages, editorial: state.editorial, operatorReview,
      ...(editorial.findings.length > 0 && { editorialFindings: editorial.findings }), canQueueEditorialRevision,
      ...(concept && { homeConcept: { digest: concept } }), ...(state.homeReview && { homeReview: state.homeReview }),
      ...(operatorReview && { candidateReviewTarget: candidateReviewTarget(state) }),
      ...(deliveryQuality && { deliveryQuality }), ...(conceptQuality && { conceptQuality }),
      ...(canRenderForEditorial && { canRenderForEditorial: true as const }),
      ...(current && authority && { brandDigest: authority.brandDigest }),
      ...((state.marketingAuthorityDigest && !authority) && { deliveryQuality: { target: null, passed: false, history: state.qualityReviews ?? [] } }),
      failure, ...(failure === "output-invalid" && state.artifactIssue && { artifactIssue: state.artifactIssue }),
      next, pendingOperation: state.work?.operation ?? null, recoverable: current && Boolean(state.work && (state.failure || state.work.until <= this.clock())),
      sources: state.sourceSnapshot.evidence, limitations: state.sourceSnapshot.limitations,
      conflicts: state.sourceSnapshot.conflicts, entry: state.sourceSnapshot.entry,
      ...(this.operations.visuals && current && { visualBriefs: this.operations.visuals.requestable ? this.operations.visuals.briefs : [],
        visuals: (state.visuals ?? []).filter(visual => visual.placement.candidateDigest === (state.operatorReview?.target ?? concept)) }) };
  }

  async start(context: WorkflowContext) {
    const existing = await this.store.read(context);
    if (existing) return this.view(context, existing);
    if (!context.evidence.length || new Set(context.evidence.map(source => source.id)).size !== context.evidence.length) {
      throw new IntakeError("invalid_request");
    }
    const state = await this.store.append(context, 0, {
      contextDigest: fingerprint(context), sourceSnapshot: { evidence: context.evidence, limitations: context.limitations,
        conflicts: context.conflicts, entry: context.entry }, mode: this.operations.mode, research: this.operations.marketingAuthority?.strategy && context.evaluation && !this.operations.requiresResearch ? [] : null, report: null, corrections: [],
      ...(context.evaluation && { evaluation: context.evaluation }),
      ...(this.operations.marketingAuthority && { marketingAuthorityDigest: fingerprint(this.operations.marketingAuthority) }),
      confirmation: null, direction: null, blueprint: null, pages: [], editorial: null, operatorReview: null,
      work: null, failure: null,
    });
    return this.view(context, state);
  }

  private async current(context: WorkflowContext, version: number) {
    const state = await this.store.read(context);
    if (!state || state.version !== version || state.contextDigest !== fingerprint(context) || state.mode !== this.operations.mode ||
        state.marketingAuthorityDigest !== (this.operations.marketingAuthority && fingerprint(this.operations.marketingAuthority))) {
      throw new IntakeError("draft_changed", 409);
    }
    return state;
  }

  /** One explicitly authorized disposable source repair, retaining all prior events,
   * provider usage and consumed editorial/replan allowances. This is not customer
   * confirmation, a public rewrite, or permission to change source scope. */
  async reassessFromRepairedSources(context: WorkflowContext, version: number, actor: Actor, authorization: unknown) {
    const state = await this.current(context, version);
    const permitted = this.operations.sourceRepair;
    if (this.boundary !== "disposable" || !state.evaluation || this.operations.marketingAuthority?.projectionVersion !== 2 ||
        actor.role !== "operator" || actor.simulated !== (state.mode === "fixture") || !actor.authority || !permitted ||
        authorization !== permitted.authorization || ![permitted.authorization,permitted.previousStateDigest,permitted.materialsDigest].every(x=>/^[a-f0-9]{64}$/u.test(x))) {
      throw new IntakeError("unavailable", 403);
    }
    if (state.sourceRecovery) {
      if (state.sourceRecovery.authorization !== authorization || fingerprint(permitted) !== fingerprint({
        authorization: state.sourceRecovery.authorization, baseVersion: state.sourceRecovery.baseVersion,
        previousStateDigest: state.sourceRecovery.previousStateDigest, materialsDigest: state.sourceRecovery.materialsDigest })) throw new IntakeError("draft_changed",409);
      return this.view(context,state);
    }
    if (state.work || state.failure || state.operatorReview || state.version !== permitted.baseVersion ||
        fingerprint(state) !== permitted.previousStateDigest) throw new IntakeError("draft_changed",409);
    const sourceRecovery: SourceRecovery = {...permitted,actor,at:new Date(this.clock()).toISOString(),
      priorRevisionOrdinal: state.revisionRequest?.ordinal ?? 0,
      previous: structuredClone({report:state.report,direction:state.direction,blueprint:state.blueprint,pages:state.pages})};
    return this.view(context,await this.store.append(context,version,{...state,sourceRecovery,
      report:null,confirmation:null,direction:null,blueprint:null,pages:[],editorial:null,operatorReview:null,
      editorialFindings:[],editorialDecisions:[],revisionRequest:null,homeReview:null,conceptEditorial:null,visuals:[]}));
  }

  async advance(context: WorkflowContext, version: number) {
    const state = await this.current(context, version);
    const task = nextTask(state);
    if (!task || state.work) throw new IntakeError("workflow_not_ready", 409);
    return this.executeTask(context, state, task);
  }

  /** Read-only input for the trusted renderer before any provider dispatch. */
  async conceptCritiqueInput(context: WorkflowContext, version: number, actor: Actor): Promise<WorkflowRun> {
    const state = await this.current(context, version);
    const task = this.conceptCritiqueTask(context, state, actor);
    return { context, input: runInput(context, state, task.reviewStage),
      work: { ...task, attempt: "preparation-only", until: 0,
        inputDigest: fingerprint(runInput(context, state, task.reviewStage)) } };
  }

  async editorialCritiqueInput(context: WorkflowContext, version: number, actor: Actor): Promise<WorkflowRun> {
    const state = await this.current(context, version);
    this.visualActor(actor, state);
    if (!this.view(context, state)?.canRenderForEditorial) throw new IntakeError("workflow_not_ready", 409);
    const input = runInput(context, state);
    return { context, input, work: { operation: "editorial", attempt: "preparation-only", until: 0, inputDigest: fingerprint(input) } };
  }

  async critiqueSite(context: WorkflowContext, version: number, actor: Actor) {
    await this.editorialCritiqueInput(context, version, actor);
    return this.advance(context, version);
  }

  async critiqueHomeConcept(context: WorkflowContext, version: number, actor: Actor) {
    const state = await this.current(context, version);
    const task = this.conceptCritiqueTask(context, state, actor);
    if (state.conceptEditorial?.target === task.reviewStage.target) return this.view(context, state);
    return this.executeTask(context, state, task);
  }

  private conceptCritiqueTask(context: WorkflowContext, state: State, actor: Actor) {
    this.visualActor(actor, state);
    const view = this.view(context, state)!;
    if (view.next !== "home-concept" || !view.conceptQuality) throw new IntakeError("workflow_not_ready", 409);
    return { operation: "editorial" as const, reviewStage: { phase: "home-concept" as const, target: view.conceptQuality.target } };
  }

  private async executeTask(context: WorkflowContext, state: State, task: Task & { reviewStage?: ConceptReviewStage }) {
    const input = runInput(context, state, task.reviewStage);
    const work = { ...task, attempt: randomUUID(), until: this.clock() + 180_000, inputDigest: fingerprint(input),
      ...(state.retry?.previous && { retryOf: state.retry.previous }) };
    const run = { context, input, work };
    await this.operations.preflight?.(run);
    const claimed = await this.store.append(context, state.version, { ...state, work });
    let output: unknown;
    try {
      output = await this.operations.run(run, bytes => this.store.retain(context, work, bytes));
      if (!await this.store.output(context, work)) throw Error("Response custody missing");
    } catch (error) {
      return this.fail(context, claimed, error instanceof WorkflowBlocked ? "operation-blocked" : "outcome-unknown");
    }
    return this.settle(context, claimed, output);
  }

  async recover(context: WorkflowContext, version: number) {
    const state = await this.current(context, version);
    const work = state.work;
    if (!work || (!state.failure && work.until > this.clock())) throw new IntakeError("workflow_not_ready", 409);
    const input = runInput(context, state);
    if (fingerprint(input) !== work.inputDigest) throw new IntakeError("draft_changed", 409);
    let output: unknown;
    try {
      const bytes = await this.store.output(context, work);
      if (!bytes) return this.fail(context, state, state.failure ?? "outcome-unknown");
      output = await this.operations.recover({ context, input, work }, bytes);
    } catch { return this.fail(context, state, "outcome-unknown"); }
    return this.settle(context, state, output);
  }

  async replaceTimedOutReport(context: WorkflowContext, version: number) {
    const state = await this.current(context, version);
    const work = state.work;
    if (!state.evaluation || !this.operations.verifyReportReplacement || state.failure !== "outcome-unknown" ||
        work?.operation !== "report" || state.report || await this.store.output(context, work)) {
      throw new IntakeError("workflow_not_ready", 409);
    }
    const input = runInput(context, state);
    if (fingerprint(input) !== work.inputDigest) throw new IntakeError("draft_changed", 409);
    await this.operations.verifyReportReplacement({ context, input, work });
    const next = await this.store.append(context, version, { ...state, failure: null, work: null,
      retry: { count: (state.retry?.count ?? 0) + 1, previous: work.attempt } });
    return this.advance(context, next.version);
  }

  async completeMarketResearch(context: WorkflowContext, version: number) {
    const state = await this.current(context, version);
    const work = state.work;
    if (!this.operations.completeMarketResearch || !state.failure || work?.operation !== "research" || !state.evaluation) {
      throw new IntakeError("workflow_not_ready", 409);
    }
    const input = runInput(context, state);
    if (fingerprint(input) !== work.inputDigest) throw new IntakeError("draft_changed", 409);
    const original = await this.store.output(context, work);
    if (!original) throw new IntakeError("workflow_not_ready", 409);
    const output = await this.operations.completeMarketResearch({ context, input, work }, original, {
      read: attempt => this.store.output(context, { attempt }),
      retain: (attempt, bytes) => this.store.retain(context, { attempt }, bytes),
    });
    return this.settle(context, state, output);
  }

  private async fail(context: WorkflowContext, state: State, failure: Failure, artifactIssue = state.artifactIssue) {
    const next = state.failure === failure && state.artifactIssue === artifactIssue ? state :
      await this.store.append(context, state.version, { ...state, failure, ...(artifactIssue && { artifactIssue }) });
    return this.view(context, next);
  }

  private async settle(context: WorkflowContext, state: State, output: unknown) {
    const work = state.work!;
    const sources = [...context.evidence, ...state.research ?? []];
    const ids = sources.map(source => source.id);
    const paths = state.blueprint?.pages.map(page => page.path) ?? [];
    let next: State;
    const provider = state.mode === "provider";
    try {
      if (output instanceof ArtifactValidationError) throw output;
      switch (work.operation) {
        case "research": next = { ...state, research: readResearch(output, ids) }; break;
        case "report": next = { ...state, report: readReport(output, sources, provider) }; break;
        case "direction": next = { ...state, direction: readDirection(output, ids, provider) }; break;
        case "blueprint": {
          const blueprint = readBlueprint(output, ids, provider, Boolean(this.operations.marketingAuthority?.strategy));
          next = { ...state, blueprint: { ...blueprint, ...(this.operations.marketingAuthority?.strategy && {
            strategyBasis: strategyBasis(context, state),
          }) } };
          break;
        }
        case "page": {
          if (state.evaluation && state.revisionRequest?.batch === "pending" && !work.path) {
            const revisionRequest = state.revisionRequest;
            next = { ...state, revisionRequest: { ...revisionRequest, batch: "applied" },
              pages: applyEditorialPatch(output, state.pages, revisionRequest.paths, paths, ids, this.destinations) };
            break;
          }
          const destinations = state.evaluation ? Object.fromEntries(Object.entries(this.destinations).filter(([, destination]) =>
            destination !== work.path && paths.includes(destination))) : this.destinations;
          const page = readPage(output, work.path!, paths, ids, destinations, provider, Boolean(state.evaluation),
            Boolean(this.operations.marketingAuthority?.strategy && this.boundary === "disposable"));
          if (state.evaluation && page.composition !== "managed-v1") throw Error("Evaluation Page needs the composed format");
          // Keep the exact sitemap order when selected pages are redrafted.
          const drafts = new Map([...state.pages, page].map(draft => [draft.path, draft]));
          next = { ...state, pages: paths.flatMap(path => drafts.get(path) ?? []) };
          break;
        }
        case "editorial": {
          const editorial = readEditorial(output, work.reviewStage ? ["/"] : paths, provider);
          if (work.reviewStage) {
            if (work.reviewStage.phase !== "home-concept" || !this.operations.marketingAuthority?.earlyConceptReview ||
                this.boundary !== "disposable" || !state.evaluation) throw Error("Concept critique scope differs");
            next = { ...state, conceptEditorial: { target: work.reviewStage.target, inputDigest: work.inputDigest, editorial } };
            break;
          }
          next = { ...state, editorial, editorialFindings: [...savedEditorialFindings(state),
            ...editorialFindings(editorial, state.version + 1)] };
          break;
        }
      }
    } catch (error) {
      return this.fail(context, state, "output-invalid", error instanceof ArtifactValidationError ? error.issue : "shape-or-content");
    }
    return this.view(context, await this.store.append(context, state.version, { ...next, work: null, failure: null,
      ...(state.artifactIssue && { artifactIssue: null }), ...(state.retry && { retry: { ...state.retry, previous: "" } }) }));
  }

  async correctReport(context: WorkflowContext, version: number, finding: string, correction: unknown, actor: Actor, developmentCorrection = false) {
    const state = await this.current(context, version);
    if (actor.role !== (developmentCorrection ? "operator" : "customer") || actor.simulated !== (state.mode === "fixture")) throw new IntakeError("unavailable", 403);
    const priorFinding = state.report?.findings.find(item => item.id === finding);
    if (state.work || state.visuals?.some(visual => visual.state === "running") || !state.report || !priorFinding) throw new IntakeError("workflow_not_ready", 409);
    const note = { finding: priorFinding, text: text(correction, 8_000, true), actor,
      reportDigest: fingerprint(state.report), at: new Date(this.clock()).toISOString() };
    return this.view(context, await this.store.append(context, version, { ...state,
      corrections: [...state.corrections.filter(item => item.finding.id !== finding), note],
      report: null, confirmation: null, direction: null, blueprint: null, pages: [], editorial: null, revisionRequest: null, operatorReview: null,
      editorialFindings: savedEditorialFindings(state),
      ...(state.evaluation && { homeReview: null }),
      ...(state.retry && { retry: { ...state.retry, previous: "" } }),
    }));
  }

  async resumeUndispatchedRequest(context:WorkflowContext,version:number,actor:Actor) {
    const state=await this.current(context,version),work=state.work;
    if(this.boundary!=="disposable"||!context.evaluation||state.mode!=="provider"||!state.failure||!work||
      actor.role!=="operator"||actor.simulated||!actor.authority||!this.operations.verifyUndispatchedRequest||
      await this.store.output(context,work))throw new IntakeError("workflow_not_ready",409);
    const input=runInput(context,state);
    if(fingerprint(input)!==work.inputDigest)throw new IntakeError("draft_changed",409);
    await this.operations.verifyUndispatchedRequest({context,input,work});
    return this.view(context,await this.store.append(context,version,{...state,work:null,failure:null,
      retry:{previous:work.attempt,count:state.retry?.count??0}}));
  }

  async retryRejectedOutput(context: WorkflowContext, version: number, actor: Actor) {
    const state = await this.current(context, version);
    if (actor.role !== "operator" || actor.simulated !== (state.mode === "fixture")) throw new IntakeError("unavailable", 403);
    const attempt = state.work;
    const count = state.retry?.count ?? 0;
    if (state.failure !== "output-invalid" || !attempt || count >= (this.operations.maxRetries ?? 0)) throw new IntakeError("workflow_not_ready", 409);
    const bytes = await this.store.output(context, attempt);
    const input = runInput(context, state);
    if (!bytes || fingerprint(input) !== attempt.inputDigest) throw new IntakeError("workflow_not_ready", 409);
    await this.operations.recover({ context, input, work: attempt }, bytes);
    return this.view(context, await this.store.append(context, version, { ...state, work: null, failure: null,
      retry: { previous: attempt.attempt, count: count + 1 } }));
  }

  async decideEditorialFinding(context: WorkflowContext, version: number, actor: Actor, input: unknown) {
    const state = await this.current(context, version);
    if (actor.role !== "operator" || actor.simulated !== (state.mode === "fixture") || (!actor.simulated && !actor.authority)) {
      throw new IntakeError("unavailable", 403);
    }
    if (!state.editorial || state.work || state.operatorReview) throw new IntakeError("workflow_not_ready", 409);
    const { findings } = editorialProgress(state);
    const decision = editorialDecision(input, findings, state.pages, state.sourceSnapshot.evidence, actor, version, this.clock());
    return this.view(context, await this.store.append(context, version, {
      ...state, editorialFindings: savedEditorialFindings(state), editorialDecisions: [...state.editorialDecisions ?? [], decision],
    }));
  }

  async requestEditorialRevision(context: WorkflowContext, version: number, actor: Actor, evaluationPath?: string | readonly string[]) {
    const state = await this.current(context, version);
    if (actor.role !== "operator" || actor.simulated !== (state.mode === "fixture")) throw new IntakeError("unavailable", 403);
    const selected=evaluationPath===undefined?undefined:typeof evaluationPath==="string"?[evaluationPath]:[...evaluationPath];
    // Reuse the same bounded editorial revision path for an exact rejected
    // source-aware Home concept. No free-form Operator feedback becomes evidence.
    const authority = this.operations.marketingAuthority;
    const target = conceptQualityTarget(context, state, authority, this.boundary === "disposable");
    const last = state.qualityReviews?.at(-1);
    const conceptAudit = authority?.projectionVersion === 2 && target && state.conceptEditorial?.target === target &&
      last?.phase === "home-concept" && last.review.target === target && last.actor.id === authority.qualityReviewerId &&
      !qualityPass(last.review, target) ? state.conceptEditorial.editorial : undefined;
    const audit = state.editorial ?? conceptAudit;
    if (!audit || state.work || state.operatorReview ||
        (selected !== undefined && (this.boundary !== "disposable" || !context.evaluation || !selected.length || new Set(selected).size!==selected.length ||
          selected.some(path=>!state.pages.some(page=>page.path===path))))) throw new IntakeError("workflow_not_ready", 409);
    const { assigned } = editorialProgress(state);
    const concerns = [...audit.concerns, ...assigned.flatMap(({ finding, decision }) =>
      decision.pages.map(page => ({ path: page.path,
        concern: finding.commercialCriterion ? commercialRevisionGuidance[finding.commercialCriterion] : finding.concern })))].filter(
      concern => selected === undefined || selected.includes(concern.path));
    if (!concerns.length) throw new IntakeError("workflow_not_ready", 409);
    const paths = [...new Set(concerns.map(item => item.path))];
    const ordinal = Math.max(state.revisionRequest?.ordinal ?? 0, state.sourceRecovery?.priorRevisionOrdinal ?? 0) + 1;
    if (ordinal > (this.operations.maxEditorialRevisions ?? 1)) throw new IntakeError("workflow_not_ready", 409);
    const at = new Date(this.clock()).toISOString();
    const batch = !this.operations.marketingAuthority && Boolean(state.evaluation) && state.mode === "provider" && paths.length > 1;
    const revisionRequest = { paths, audit: { summary: audit.summary, concerns }, priorPages: state.pages.filter(page => paths.includes(page.path)),
      actor, at, ordinal, ...(this.operations.marketingAuthority && assigned.some(item => !item.finding.commercialCriterion) && { source: "operator-editorial" as const }),
      ...(batch && { batch: "pending" as const }) };
    const queued = assigned.filter(({ decision }) => selected === undefined || decision.pages.every(page => selected.includes(page.path)))
      .map(({ decision }) => ({ ...decision, status: "queued" as const, actor, at, basedOnVersion: version }));
    return this.view(context, await this.store.append(context, version, { ...state, revisionRequest, editorial: null,
      editorialFindings: savedEditorialFindings(state), editorialDecisions: [...state.editorialDecisions ?? [], ...queued],
      pages: batch ? state.pages : state.pages.filter(page => !paths.includes(page.path)) }));
  }

  async confirmReport(context: WorkflowContext, version: number, actor: Actor, developmentContinuation = false) {
    const state = await this.current(context, version);
    if (actor.role !== (developmentContinuation ? "operator" : "customer") || actor.simulated !== (state.mode === "fixture")) throw new IntakeError("unavailable", 403);
    if (!state.report || state.confirmation || state.work) throw new IntakeError("workflow_not_ready", 409);
    const confirmation = { actor, at: new Date(this.clock()).toISOString(), target: fingerprint(state.report), decision: developmentContinuation ? "development-continuation" : "confirmed" } as const;
    return this.view(context, await this.store.append(context, version, { ...state, confirmation }));
  }

  async reviseHomeConcept(context: WorkflowContext, version: number, actor: Actor, digest: unknown, concern: unknown) {
    const state = await this.current(context, version);
    this.visualActor(actor, state);
    const view = this.view(context, state)!;
    if (view.next !== "home-concept" || view.visuals?.some(item => ["queued", "running", "review", "unverified"].includes(item.state))) {
      throw new IntakeError("workflow_not_ready", 409);
    }
    if (digest !== composeHomeConcept(context, view).digest) throw new IntakeError("draft_changed", 409);
    const ordinal = Math.max(state.revisionRequest?.ordinal ?? 0, state.sourceRecovery?.priorRevisionOrdinal ?? 0) + 1;
    if (ordinal > (this.operations.maxEditorialRevisions ?? 1)) throw new IntakeError("workflow_not_ready", 409);
    const detail = text(concern, 1200);
    const revisionRequest = { paths: ["/"], source: "home-concept" as const,
      audit: { summary: detail, concerns: [{ path: "/", concern: detail }] },
      priorPages: state.pages.filter(page => page.path === "/"), actor, at: new Date(this.clock()).toISOString(), ordinal };
    return this.view(context, await this.store.append(context, version, { ...state, revisionRequest,
      pages: state.pages.filter(page => page.path !== "/") }));
  }

  async reviewHomeConcept(context: WorkflowContext, version: number, actor: Actor, digest: unknown, reference: unknown, localDraft = false) {
    const state = await this.current(context, version);
    this.visualActor(actor, state);
    const view = this.view(context, state)!;
    if ((localDraft && (this.boundary !== "disposable" || !context.evaluation)) || view.next !== "home-concept" || state.work || view.visuals?.some(visual =>
      ["queued", "running", "unverified"].includes(visual.state) || (!localDraft && visual.state === "review"))) {
      throw new IntakeError("workflow_not_ready", 409);
    }
    const concept = composeHomeConcept(context, view);
    if (digest !== concept.digest) throw new IntakeError("draft_changed", 409);
    if (this.operations.marketingAuthority?.earlyConceptReview && !view.conceptQuality?.passed) throw new IntakeError("workflow_not_ready", 409);
    if (concept.image) await this.visualImage(context, concept.image.id);
    return this.view(context, await this.store.append(context, version, {
      ...state, homeReview: { digest: concept.digest, reference: text(reference, 350), actor, at: new Date(this.clock()).toISOString() },
    }));
  }

  private visualActor(actor: Actor, state: State) {
    if (actor.role !== "operator" || actor.simulated !== (state.mode === "fixture") || !actor.authority) {
      throw new IntakeError("unavailable", 403);
    }
    return { id: text(actor.id, 160), authority: text(actor.authority, 300) };
  }

  async queueVisual(context: WorkflowContext, version: number, actor: Actor, path: string, index: number, briefId: unknown) {
    const state = await this.current(context, version);
    const requester = this.visualActor(actor, state);
    const brief = this.operations.visuals?.briefs.find(option => option.id === briefId);
    if (!brief || !this.operations.visuals?.requestable) throw new IntakeError("workflow_not_ready", 409);
    const placement = presenceVisualPlacement(context, this.view(context, state)!, path, index);
    const visuals = state.visuals ?? [];
    if (visuals.some(item => fingerprint(item.placement) === fingerprint(placement) &&
        !["rejected", "revoked"].includes(item.state))) throw new IntakeError("workflow_not_ready", 409);
    const visual: PresenceVisual = { id: randomUUID(), placement, briefId: brief.id, requestDigest: brief.requestDigest, requester, state: "queued" };
    return this.view(context, await this.store.append(context, version, { ...state, visuals: [...visuals, visual] }));
  }

  private async saveVisual(context: WorkflowContext, state: State, visual: PresenceVisual) {
    return this.store.append(context, state.version, { ...state, visuals: state.visuals?.map(entry => entry.id === visual.id ? visual : entry) });
  }

  async advanceVisual(context: WorkflowContext, version: number) {
    const state = await this.current(context, version);
    const ops = this.operations.visuals;
    const target = state.operatorReview?.target ?? this.view(context, state)?.homeConcept?.digest;
    if (!ops?.execute || !target || state.work) throw new IntakeError("workflow_not_ready", 409);
    const visual = state.visuals?.find(item => item.placement.candidateDigest === target &&
      ["queued", "running", "unverified"].includes(item.state));
    if (!visual || (visual.state === "running" && (visual.leaseUntil ?? 0) > this.clock())) return this.view(context, state);

    // A claimed or uncertain image can only be recovered, never re-dispatched.
    const attempt = { attempt: visual.id };
    let working = state;
    try {
      if (visual.state === "queued") {
        working = await this.saveVisual(context, state, { ...visual, state: "running", leaseUntil: this.clock() + 180_000 });
        await ops.execute(visual, result => this.store.retain(context, attempt, Buffer.from(JSON.stringify(result))));
      }
      const bytes = await this.store.output(context, attempt);
      if (!bytes) throw Error("Image outcome unavailable");
      const result = await ops.recover(visual, bytes);
      return this.view(context, await this.saveVisual(context, working, { ...visual, result, state: "review" }));
    } catch {
      if (working === state && visual.state === "queued") throw new IntakeError("draft_changed", 409);
      return this.view(context, visual.state === "unverified" ? state :
        await this.saveVisual(context, working, { ...visual, state: "unverified" }));
    }
  }

  async decideVisual(context: WorkflowContext, version: number, actor: Actor, input: unknown) {
    const state = await this.current(context, version);
    const reviewer = this.visualActor(actor, state);
    const decision = object(input, ["id", "provenanceDigest", "decision", "reference", "alt"]);
    const visual = state.visuals?.find(item => item.id === decision.id);
    if (!visual?.result || !this.operations.visuals ||
        fingerprint(presenceVisualPlacement(context, this.view(context, state)!, visual.placement.path, visual.placement.sectionIndex)) !== fingerprint(visual.placement) ||
        decision.provenanceDigest !== visual.result.provenanceDigest) throw new IntakeError("workflow_not_ready", 409);
    const next = decision.decision;
    if (next !== "approved" && next !== "rejected" && next !== "revoked" ||
        (next === "revoked" ? visual.state !== "approved" : visual.state !== "review")) throw new IntakeError("workflow_not_ready", 409);
    await this.operations.visuals.read(visual);
    return this.view(context, await this.saveVisual(context, state, { ...visual, state: next,
      ...(next === "approved" && { association: { assetId: randomUUID(), usageId: randomUUID() } }), decision: {
      scope: "non-public-draft-only", at: new Date(this.clock()).toISOString(), reviewer, reference: text(decision.reference, 350),
      provenanceDigest: visual.result.provenanceDigest, alt: next === "approved" ? text(decision.alt, 500) : null,
    } }));
  }

  private async resolveVisualProjection(context: WorkflowContext, scope: Parameters<ResolvePrivateVisuals>[0],
    page: Parameters<ResolvePrivateVisuals>[1], resolved: Parameters<ResolvePrivateVisuals>[2]) {
    const view = await this.review(context);
    if (fingerprint(scope) !== fingerprint(context.scope) || page.workflowReview?.intakeId !== context.intakeId ||
        view?.next !== "review-complete" || !view.operatorReview || view.operatorReview.target !== page.workflowReview?.candidateDigest ||
        view.deliveryQuality?.passed === false || !this.operations.visuals) throw Error("Current protected visual review required");
    const reviewedPage = view.pages.find(item => item.path === page.slug);
    if (!reviewedPage || reviewedPage.composition !== page.composition ||
        (page.composition && page.navigationLabel !== view.blueprint?.pages.find(item => item.path === page.slug)?.label) ||
        (reviewedPage.composition && resolved.sections.some((section, index) => section.type !== reviewedPage.sections[index]?.role)) ||
        reviewedPage.heading !== resolved.title || !resolved.sections.length ||
        reviewedPage.sections.length !== resolved.sections.length ||
        resolved.sections.some((section, i) => section.content.heading !== reviewedPage.sections[i].heading ||
          (section.content.text ?? "") !== reviewedPage.sections[i].body || section.action)) throw Error("Reviewed Page shape or copy changed");
    const choices = view.visuals?.filter(item => item.placement.path === page.slug && item.state === "approved") ?? [];
    const wanted = page.sections.flatMap((section, index) => section.image ? [{ index, section, image: section.image }] : []);
    if (choices.length !== wanted.length || new Set(wanted.map(item => item.image.usageId)).size !== wanted.length) {
      throw Error("Exact approved private image placements required");
    }
    const placements = await Promise.all(wanted.map(async ({ index, section, image }) => {
      const approved = choices.find(value => value.placement.sectionIndex === index && value.association?.assetId === image.assetId &&
        value.association?.usageId === image.usageId);
      const decision = approved?.decision, result = approved?.result;
      const currentSection = resolved.sections[index];
      const reviewedSection = reviewedPage.sections[index];
      if (!approved || !decision || !result || decision.scope !== "non-public-draft-only" ||
          decision.provenanceDigest !== result.provenanceDigest || decision.alt !== image.altText ||
          fingerprint(reviewedSection) !== approved.placement.sectionDigest || currentSection.id !== section.id ||
          currentSection.content.heading !== reviewedSection.heading || (currentSection.content.text ?? "") !== reviewedSection.body) {
        throw Error("Protected image rights, reviewed copy or placement changed");
      }
      const bytes = await this.operations.visuals!.read(approved);
      const media = {
        sectionId: section.id, usageId: image.usageId, assetId: image.assetId, role: "image" as const, priorUsage: null,
        configuration: { image: { altText: image.altText, decorative: false as const } }, preparedDigest: result.masterDigest,
        mimeType: "image/png" as const, width: result.width, height: result.height,
        evidence: { source: "private-generated" as const, permission: decision.scope, sourceDigest: result.sourceDigest,
          provenanceDigest: result.provenanceDigest, reviewDigest: fingerprint({ decision, association: approved.association }), reference: decision.reference },
      };
      return { media, image: { assetId: media.assetId, alt: image.altText, width: result.width, height: result.height,
        src: "data:image/png;base64," + bytes.toString("base64") } };
    }));
    return { media: placements.map(item => item.media),
      images: Object.fromEntries(placements.map(item => [item.media.sectionId, item.image])) };
  }

  privateVisualResolver(context: WorkflowContext): ResolvePrivateVisuals {
    return (scope, page, resolved) => this.resolveVisualProjection(context, scope, page, resolved);
  }

  async visualImage(context: WorkflowContext, id: string) {
    const review = await this.review(context);
    const visual = review?.visuals?.find(entry => entry.id === id);
    if ((review?.next !== "review-complete" && review?.next !== "home-concept") || !this.operations.visuals || !visual || !["review", "approved"].includes(visual.state)) {
      throw new IntakeError("unavailable", 404);
    }
    return this.operations.visuals.read(visual);
  }

  async localDraftImage(context: WorkflowContext, version: number, id: string) {
    const state = await this.current(context, version);
    const image = state.visuals?.find(entry => entry.id === id && ["review", "approved"].includes(entry.state));
    const section = state.pages.find(page => page.path === image?.placement.path)?.sections[image?.placement.sectionIndex ?? -1];
    if (this.boundary !== "disposable" || !context.evaluation || !image?.result || !section ||
        fingerprint(section) !== image.placement.sectionDigest || !this.operations.visuals) {
      throw new IntakeError("unavailable", 404);
    }
    return this.operations.visuals.read(image);
  }

  async recordQualityReview(context: WorkflowContext, version: number, actor: Actor, input: unknown) {
    const state = await this.current(context, version);
    const authority = this.operations.marketingAuthority;
    if (!authority || actor.role !== "operator" || actor.id !== authority.qualityReviewerId ||
        actor.simulated !== (state.mode === "fixture") || !actor.authority ||
        actor.id === state.operatorReview?.actor.id || actor.id === state.confirmation?.actor.id) {
      throw new IntakeError("unavailable", 403);
    }
    const view = this.view(context, state)!;
    const early = view.next === "home-concept" && Boolean(view.conceptQuality);
    const target = early ? view.conceptQuality!.target : view.deliveryQuality?.target;
    if (!target || early && state.conceptEditorial?.target !== target || state.work || state.failure) throw new IntakeError("workflow_not_ready", 409);
    let review: QualityReview;
    try { review = readQualityReview(input, target); }
    catch { throw new IntakeError("invalid_request"); }
    const qualityReviews = [...state.qualityReviews ?? [], { actor, at: new Date(this.clock()).toISOString(), review,
      ...(early && { phase: "home-concept" as const }) }];
    // A concept judgment is advisory for expansion, never whole-site acceptance.
    if (early) return this.view(context, await this.store.append(context, version, { ...state, qualityReviews }));
    const unresolved = review.findings.filter(finding => finding.status === "revise");
    if (!unresolved.length) {
      try {
        const { "request-review": review, "start-onboarding": start } = this.destinations;
        verifyCommercialJourneys(state.pages, state.blueprint?.navigation ?? [], {
          ...(review && { "request-review": review }), ...(start && { "start-onboarding": start }),
        });
      } catch { throw new IntakeError("workflow_not_ready", 409); }
      return this.view(context, await this.store.append(context, version, { ...state, qualityReviews }));
    }
    // Reuse assignment and exact revision review. A critic cannot silently choose Pages or approve new copy.
    return this.view(context, await this.store.append(context, version, { ...state, qualityReviews, operatorReview: null,
      editorialFindings: [...savedEditorialFindings(state), ...unresolved.map(({ criterion, observation }) => ({
        id: fingerprint({ review, criterion, version }), reviewRevision: version + 1, suggestedTarget: criterion,
        commercialCriterion: criterion, concern: observation,
      }))] }));
  }

  async requestCommercialReplan(context: WorkflowContext, version: number, actor: Actor) {
    const state = await this.current(context, version);
    if (actor.role !== "operator" || actor.simulated !== (state.mode === "fixture") || (!actor.simulated && !actor.authority)) {
      throw new IntakeError("unavailable", 403);
    }
    const last = state.qualityReviews?.at(-1);
    const concerns = last?.review.findings.filter(item => item.status === "revise").map(item => item.criterion) ?? [];
    const ordinal = (state.replan?.ordinal ?? 0) + 1;
    const authority = this.operations.marketingAuthority;
    const earlyTarget = conceptQualityTarget(context, state, authority, this.boundary === "disposable");
    const early = last?.phase === "home-concept" && Boolean(earlyTarget) && last.review.target === earlyTarget &&
      last.actor.id === authority?.qualityReviewerId && state.conceptEditorial?.target === earlyTarget;
    if (!authority || !concerns.length || (last?.phase === "home-concept" ? !early : !state.editorial) || !state.blueprint || state.operatorReview ||
        state.work || state.failure || ordinal > (this.operations.maxCommercialReplans ?? 0)) {
      throw new IntakeError("workflow_not_ready", 409);
    }
    // Prior pages, findings and visuals remain in the append-only event history.
    // Carry the exact Core-generated critique, never free-form reviewer input.
    // Source status and independent review remain distinct.
    return this.view(context, await this.store.append(context, version, { ...state, replan: { ordinal, concerns, ...(authority.projectionVersion === 2 && { priorRejectedPages: structuredClone(state.pages) }), ...(early && state.conceptEditorial && { conceptCritique: state.conceptEditorial }) },
      direction: null, blueprint: null, pages: [], editorial: null, editorialFindings: [], editorialDecisions: [],
      revisionRequest: null, homeReview: null, visuals: [], ...(state.conceptEditorial && { conceptEditorial: null }) }));
  }

  async reviewCandidate(context: WorkflowContext, version: number, actor: Actor) {
    const state = await this.current(context, version);
    if (actor.role !== "operator" || actor.simulated !== (state.mode === "fixture")) throw new IntakeError("unavailable", 403);
    if (!state.editorial || state.editorial.concerns.length || editorialProgress(state).open || state.work || state.operatorReview) {
      throw new IntakeError("workflow_not_ready", 409);
    }
    const target = candidateReviewTarget(state);
    const operatorReview = { actor, at: new Date(this.clock()).toISOString(), target, decision: "reviewed" } as const;
    return this.view(context, await this.store.append(context, version, { ...state, operatorReview }));
  }
}

export type PresenceWorkflowView = NonNullable<Awaited<ReturnType<PresenceWorkflow["review"]>>>;
