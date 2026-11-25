import { versionPages, versionPlan, withoutIdentity, workDigest, type VersionIndex } from "../work-products/pages";
import { createHash, randomUUID } from "node:crypto";
import { applyOperatorEdits, droppedWording, keptWording, notedSections, operatorConcerns, readReviewAnalysis, type OperatorFeedback } from "./operator-feedback";
import type { Pool, PoolClient } from "pg";
import { fingerprint, object, text } from "../canonical/model";
import type { DeploymentSelection } from "../managed-sites/deployment";
import type { EntryIntent } from "./model";
import { IntakeError } from "./model";
import type { EvaluationBinding } from "./presence-evaluation";
import { composeHomeConcept, homeConceptDigest } from "./presence-home-concept";
import { strategyBasis, type DecisionBrief } from "./presence-decision-brief";
import { applyEditorialPatch } from "./presence-editorial-patch";
import { editorialDecision, editorialFindings, withEditorialHistory, type EditorialDecision, type EditorialFinding } from "./presence-editorial-decisions";
import { placedAt, presenceVisualPlacement, samePlacement, type PresenceVisual, type PresenceVisualOperations } from "./presence-workflow-visual";
import {
  ArtifactValidationError, readBlueprint, readDirection, readEditorial, readPage, readReport, readSectionRevision, type ArtifactIssue, type PresenceEvidence,
  type WorkflowBlueprint, type WorkflowDirection, type WorkflowEditorial, type WorkflowPage, type WorkflowReport,
} from "./presence-workflow-artifacts";

import { commercialRevisionGuidance, qualityPass, readQualityReview, verifyCommercialJourneys, sourceTransitionAuthorityMatches, type MarketingAuthority, type QualityReview } from "./presence-marketing-authority";
import type { ResolvePrivateVisuals } from "../content-editing/proposal-media";
import { confirmedKnowledgeEvidence, pendingUnderstanding, type UnderstandingCorrection } from "./account-work";
import { confirmKnowledge, knowledgeConfirmationInput, KnowledgeConfirmationError, knowledgeTargets, type KnowledgeConfirmation } from "../canonical/confirmed-information";
import { canonicalWritePool } from "../canonical/transaction";
import { inspectCanonical } from "../canonical/writes";
import type { CustomerAuthority } from "../content-editing/proposal";
import { ChangeError, decide, emptyLedger, markApplied, takeIn, withdrawRound, type ChangeLedger } from "../change/model";
import { analysedRound, appliedInRound, approvedInRound, reviewRound, roundLedger, RoundConflict, takeInRound } from "./review-round-changes";
import { factKey, quotedIn, statusOf, type Fact, type FactStatus, type SaidBy } from "../knowledge/facts";
import { currentFacts, recordFacts, type KnowledgeReceipt } from "../knowledge/store";

export type WorkflowContext = {
  scope: DeploymentSelection;
  intakeId: string;
  entry: EntryIntent;
  evidence: PresenceEvidence[];
  limitations: string[];
  conflicts: string[];
  evaluation?: EvaluationBinding;
};
export type WorkflowOperation = "research" | "report" | "direction" | "blueprint" | "page" | "editorial" | "review-analysis";
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
type RevisionRequest = { paths: string[]; audit: WorkflowEditorial; priorPages: WorkflowPage[]; actor: Actor; at: string; ordinal: number;
  source?: "home-concept" | "operator-editorial" | "operator-review"; batch?: "pending" | "applied";
  /** Operator wording a revised page must still contain, word for word (operator-review). */
  keep?: { path: string; text: string }[];
  /** Pages whose revision is limited to these sections (zero-based); other pages are revised whole. */
  sections?: { path: string; indexes: number[] }[] };
/** A business fact Core proposes from an Operator review: from an edit (spotted by Core) or a Note starting "Fact:". */
export type ReviewFact = { id: string; statement: string; publicUse: boolean; source: { path: string; kind: "edit" | "note"; text: string } };
/** Sections Core proposes to revise. An empty indexes list means the whole Page. `newPageIds` ties a
 * revision (usually a link) to proposed new Pages; it is made only if one of them is approved. */
export type ReviewRevision = { path: string; indexes: number[]; reason: string; source: "note" | "fact" | "page"; factIds: string[]; newPageIds?: string[] };
/**
 * A Page Core proposes to add to the site plan because of an Operator Note starting "New page:"
 * (owner request, Nov 24). It carries a full Page brief, checked like the planned Pages' briefs;
 * the Page is written only after the Operator approves it on the Review summary.
 */
export type ReviewNewPage = { id: string; noteId: number; request: string; path: string; label: string; purpose: string;
  navigation: boolean; sourceIds: string[]; decisionBrief: DecisionBrief };
/**
 * One Operator review round (owner decision, Nov 23). Kept edits apply at take-in. Core then
 * analyses the round (facts, affected sections, cost) and shows a Review summary; nothing is
 * recorded as fact and no paid revision runs until the Operator decides on it.
 */
export type ReviewRound = { id: string; at: string; actor: Actor; status: "analysing" | "summary" | "decided";
  edits: { path: string; before: string; after: string }[];
  notes: { id: number; path: string; text: string }[];
  factNotes: { id: number; path: string; statement: string }[];
  /** Notes starting "New page:": a Page the Operator wants added to the site. */
  pageNotes?: { id: number; path: string; request: string }[];
  concerns: { path: string; concern: string }[];
  keep: { path: string; text: string }[];
  noteRevisions: ReviewRevision[];
  analysis?: { facts: ReviewFact[]; revisions: ReviewRevision[]; summary: string; estimateMicros: number; newPages?: ReviewNewPage[] };
  /** Rounds decided before Nov 24 only: what was decided now lives in the Change ledger. */
  decision?: { at: string; actor: Actor; confirmedFacts: string[]; rejectedFacts: string[]; revisions: ReviewRevision[]; addedPages?: string[] };
  /** What Core left out of the AI's analysis: facts that did not trace to the Operator, revisions already queued. */
  analysisNotes?: { untracedFacts: number; skippedRevisions: number; refusedPages?: number; refusedPageNotes?: number[] } };
/** A Note asking for a Page to be added: "New page: …" (also "Add page:" / "Add a page:"). */
export const newPagePattern = /^\s*(new page|add (a )?page)\s*:\s*/iu;
/** A business fact the Operator confirmed; every later AI step receives it as owner-confirmed knowledge. */
export type BusinessFact = { id: string; statement: string; publicUse: boolean; source: ReviewFact["source"]; roundId: string;
  confirmedBy: Actor; at: string; corrected: boolean };
/** A change beyond the noted sections that Core judged necessary; proposed to the Operator, not made. */
export type WiderChange = { path: string; reason: string; at: string; reviewAt: string };
/** One Operator review round read back from Operator WordPress (owner direction, Nov 22). */
export type WordPressReview = { at: string; actor: Actor; readbackRevision: number;
  /** The WordPress content Core has taken in, by path; the next delivery may replace exactly this. */
  acknowledged: { path: string; contentSha256: string; title: string }[];
  /** Notes Core acted on: answered and resolved with the next delivery. */
  notes: { id: number; path: string; text: string; revised: boolean; sectionOnly?: boolean; reply?: string }[];
  /** Notes stay open until the round is decided (the Review summary is in between). */
  deferNotes?: boolean;
  keptEdits: number; revisedPaths: string[] };
export type SourceRepairAuthorization = { authorization: string; baseVersion: number; previousStateDigest: string; materialsDigest: string;
  contextTransition?: { previousContextDigest: string; previousAuthorityDigest: string; nextContextDigest: string; nextAuthorityDigest: string; addedEvidenceDigests: string[] } };
type SourceRecovery = SourceRepairAuthorization & { actor: Actor; at: string; priorRevisionOrdinal: number;
  previous: { report: WorkflowReport | null; direction: WorkflowDirection | null; blueprint: WorkflowBlueprint | null; pages: WorkflowPage[] } };
type KnowledgeReassessment = { id: string; correctionIds: string[]; confirmations: KnowledgeConfirmation[]; actor: Actor; at: string; revisionOrdinal: number; replanOrdinal: number;
  previous: { report: WorkflowReport | null; direction: WorkflowDirection | null; blueprint: WorkflowBlueprint | null; pages: WorkflowPage[] } };
type ReasoningReassessment = Pick<KnowledgeReassessment, "id" | "correctionIds" | "previous"> & {
  confirmations: Pick<KnowledgeConfirmation, "recordId" | "key" | "kind" | "value" | "publicUse" | "previousValue" | "version" | "fingerprint" | "at">[];
};

type State = {
  version: number;
  contextDigest: string;
  sourceSnapshot: Pick<WorkflowContext, "evidence" | "limitations" | "conflicts" | "entry">;
  marketingAuthorityDigest?: string;
  processingContinuations?: {authorization:string;from:string;to:string;fromVersion:number;at:string}[];
  evaluation?: EvaluationBinding;
  homeReview?: { digest: string; reference: string; actor: Actor; at: string } | null;
  mode: "fixture" | "provider";
  research: PresenceEvidence[] | null;
  report: WorkflowReport | null;
  confirmation: Decision | null;
  corrections: Correction[];
  understandingCorrections?: UnderstandingCorrection[];
  knowledgeReassessments?: KnowledgeReassessment[];
  direction: WorkflowDirection | null;
  blueprint: WorkflowBlueprint | null;
  pages: WorkflowPage[];
  /** The latest version of every Page and Section made for this Account's site (step 4). */
  workProducts?: VersionIndex;
  editorial: WorkflowEditorial | null;
  editorialFindings?: EditorialFinding[];
  editorialDecisions?: EditorialDecision[];
  revisionRequest?: RevisionRequest | null;
  replan?: { ordinal: number; concerns: QualityReview["findings"][number]["criterion"][];
    priorRejectedPages?: WorkflowPage[];
    conceptCritique?: { target: string; inputDigest: string; editorial: WorkflowEditorial } };
  operatorReview: Decision | null;
  wordpressReviews?: WordPressReview[];
  /** Reviews taken in and then withdrawn before any revision ran (kept on record). */
  withdrawnReviews?: (WordPressReview & { withdrawnAt: string; withdrawnBy: Actor; reason: string })[];
  qualityReviews?: { actor: Actor; at: string; review: QualityReview; phase?: "home-concept" }[];
  conceptEditorial?: { target: string; inputDigest: string; editorial: WorkflowEditorial } | null;
  sourceRecovery?: SourceRecovery;
  work: Work | null;
  failure: Failure | null;
  artifactIssue?: ArtifactIssue | null;
  retry?: { previous: string; count: number };
  lostAnswers?: { attempt: string; operation: string; reservedMicros: number; by: string; at: string }[];
  widerChanges?: WiderChange[];
  reviewRounds?: ReviewRound[];
  /** The Account's Requests, Decisions, Changes and Reviews (the Change area; review rounds first). */
  changes?: ChangeLedger;
  /** Rounds decided before Nov 24 only. Facts now live in the one Knowledge (`knowledge`). */
  businessFacts?: BusinessFact[];
  /** Receipts of this workflow's writes to the Account's Knowledge, checked against the record. */
  knowledge?: KnowledgeReceipt[];
  /** Client emails a Specialist entered, kept as Evidence for the Facts taken from them. */
  clientStatements?: ClientStatement[];
  visuals?: PresenceVisual[];
};
/** A Client's email, entered by a Specialist: Evidence of the Client's own word (Principal, Nov 24). */
export type ClientStatement = { id: string; from: string; sentAt: string; text: string; enteredBy: Actor; at: string; facts: string[] };
/** A Fact as later AI steps receive it: from the one Knowledge, with its standing. */
export type InputFact = { id: string; statement: string; publicUse: boolean; status: FactStatus; at?: string };
type Task = Pick<Work, "operation" | "path">;
export type WorkflowInput = Pick<State, "research" | "report" | "corrections" | "direction" | "blueprint" | "pages" | "revisionRequest" | "replan"> & { businessFacts?: InputFact[];
  /** Findings whose correction Core has not yet answered: the Report lists the facts each one states. */
  openCorrections?: string[] } &
  { reviewRound?: Pick<ReviewRound, "id" | "edits" | "factNotes" | "noteRevisions" | "notes" | "pageNotes"> } &
  Pick<WorkflowContext, "entry" | "evidence" | "limitations" | "conflicts"> & { reviewStage?: ConceptReviewStage; sourceRecovery?: SourceRecovery; knowledgeReassessment?: ReasoningReassessment };
export type WorkflowRun = { context: WorkflowContext; input: WorkflowInput; work: Work };
/** The Operator's answers on a Review summary. Revision indexes number the summary's proposed revisions in order. */
export type ReviewDecision = { approved: boolean; rejectFacts: string[]; correctFacts: { id: string; statement: string }[]; rejectRevisions: number[];
  /** Operator additions to a proposed change, by its index. */
  reviseNotes?: { index: number; text: string }[];
  /** Proposed new Pages the Operator left out (P1, P2, …), and Operator additions to the others. */
  rejectPages?: string[]; pageNotes?: { id: string; text: string }[] };
export interface PresenceWorkflowOperations {
  readonly mode: State["mode"];
  readonly maxRetries?: number;
  readonly marketingAuthority?: MarketingAuthority;
  /** Verified private amendment receipt, supplied only by the composition root. */
  readonly processingContinuation?: {authority:MarketingAuthority;authorization:string;baseVersion:number};
  readonly requiresResearch?: boolean;
  readonly maxEditorialRevisions?: number;
  readonly maxCommercialReplans?: number;
  /** Explicit disposable-evaluation sequencing; never an approval or publication grant. */
  readonly reviewSequence?: "site-first";
  readonly sourceRepair?: SourceRepairAuthorization;
  /** Trusted composition capability; never inferred from site-proposal permissions. */
  readonly knowledgeConfirmation?: { authorize(actor: Actor, context: WorkflowContext): Promise<{
    operatorId: string; authorityReference: string; customer: CustomerAuthority;
    foundation?: import("../canonical/writes").OnboardingOwner;
  }> };
  readonly visuals?: PresenceVisualOperations;
  /** The people who speak for the Client on this Account (by id or email), for checking who sent a Client email. */
  clientPeople?(context: WorkflowContext): Promise<readonly string[]>;
  preflight?(run: WorkflowRun): Promise<void>;
  run(run: WorkflowRun, retain: (bytes: Buffer) => Promise<void>): Promise<unknown>;
  recover(run: WorkflowRun, bytes: Buffer): Promise<unknown>;
  verifyReportReplacement?(run: WorkflowRun): Promise<void>;
  verifyUndispatchedRequest?(run:WorkflowRun):Promise<void>;
  /** Settle a sent generation whose answer never arrived, debiting its full reservation. */
  settleLostAnswer?(run: WorkflowRun): Promise<{ reservedMicros: number }>;
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

  constructor(private pool: Pool, private boundary: "disposable" | "protected") {
    const schema = boundary === "protected" ? "miopages_core_workflow" : "public";
    this.events = schema + ".presence_workflow_events";
    this.outputs = schema + ".presence_workflow_outputs";
    this.intakes = boundary === "protected" ? "miopages_wp.core_development_drafts" : "public.prospect_intakes";
  }

  async atomic<T>(context: WorkflowContext, action: (store: WorkflowStore, client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT id FROM web_presences WHERE id=$1 FOR UPDATE", [context.scope.webPresenceId]);
      const bound = await client.query(`SELECT id FROM ${this.intakes} WHERE web_presence_id=$1 AND managed_site_id=$2 AND id=$3 FOR UPDATE`, identity(context));
      if (bound.rowCount !== 1) throw new IntakeError("draft_changed", 409);
      const result = await action(new WorkflowStore(canonicalWritePool(client), this.boundary), client);
      await client.query("COMMIT"); return result;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
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

  async readVersion(context: WorkflowContext, version: number): Promise<State | null> {
    const { rows: [row] } = await this.pool.query<{ payload: State; digest: string }>(`
      SELECT payload, digest FROM ${this.events}
      WHERE web_presence_id=$1 AND managed_site_id=$2 AND intake_id=$3 AND version=$4`, [...identity(context), version]);
    if (!row) return null;
    if (fingerprint(row.payload) !== row.digest) throw new IntakeError("unavailable", 503);
    return row.payload;
  }

  async append(context: WorkflowContext, previous: number, next: Omit<State, "version">) {
    // Every saved change to the pages makes new versions of the same Page and Section Work products.
    const before = previous ? await this.readVersion(context, previous) : null;
    const versioned = versionPages(context.scope.managedSiteId, before?.pages ?? [], next.pages, before?.workProducts ?? next.workProducts);
    const index = versionPlan(context.scope.managedSiteId, next.blueprint, versioned.index);
    const state = { ...next, pages: versioned.pages, ...(versioned.pages.length || next.blueprint || before?.workProducts ? { workProducts: index } : {}), version: previous + 1 };
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
      pages.has(path) && workDigest(pages.get(path)) === baseline) ? [{ finding, decision }] : [];
  });
  return { findings, assigned, open: findings.some(finding => finding.history.at(-1)?.status !== "resolved") };
}

function candidateReviewTarget(state: State) {
  return fingerprint({ confirmation: state.confirmation?.target, direction: state.direction, blueprint: state.blueprint,
    ...(state.knowledgeReassessments?.length && { knowledgeReassessment: fingerprint(state.knowledgeReassessments.at(-1)) }),
    pages: state.pages.map(withoutIdentity), editorial: state.editorial, ...(state.editorialDecisions?.length && { editorialDecisions: state.editorialDecisions }) });
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

function nextTask(state: State, siteFirst = false): Task | null {
  if (!state.research) return { operation: "research" };
  if (!state.report) return { operation: "report" };
  if (!state.confirmation) return null;
  if (!state.direction) return { operation: "direction" };
  if (!state.blueprint) return { operation: "blueprint" };
  const round = state.reviewRounds?.at(-1)?.status;
  if (round === "analysing") return { operation: "review-analysis" };
  if (round === "summary") return null;
  const drafted = new Set(state.pages.map(page => page.path));
  if (!drafted.has("/") && state.blueprint.pages.some(page => page.path === "/")) return { operation: "page", path: "/" };
  if (state.evaluation && !state.homeReview && !siteFirst) return null;
  if (state.evaluation && state.revisionRequest?.batch === "pending") return { operation: "page" };
  const missing = state.blueprint.pages.find(page => !drafted.has(page.path));
  if (missing) return { operation: "page", path: missing.path };
  if (!state.editorial) return { operation: "editorial" };
  return null;
}
function unassessedKnowledge(state: State) {
  const assessed = new Set(state.knowledgeReassessments?.flatMap(item => item.correctionIds) ?? []);
  return (state.understandingCorrections ?? []).filter(item => item.confirmation && !assessed.has(item.id));
}
function confirmedSources(state: State): PresenceEvidence[] {
  return confirmedKnowledgeEvidence(state.knowledgeReassessments?.at(-1)?.confirmations ?? []);
}
function revisionOrdinal(state: State) {
  return Math.max(state.revisionRequest?.ordinal ?? 0, state.sourceRecovery?.priorRevisionOrdinal ?? 0, state.knowledgeReassessments?.at(-1)?.revisionOrdinal ?? 0);
}
function replanOrdinal(state: State) {
  return Math.max(state.replan?.ordinal ?? 0, state.knowledgeReassessments?.at(-1)?.replanOrdinal ?? 0);
}
/**
 * The Facts later AI steps receive: every Fact in the one Knowledge as of this workflow's last
 * write, with its standing. Facts recorded before Nov 24 (by a Specialist alone) count as Proposed.
 */
function inputFacts(state: State): InputFact[] {
  const known = state.knowledge?.at(-1)?.facts ?? [];
  return [...(state.businessFacts ?? []).filter(fact => !known.some(item => item.source === fact.id))
    .map(fact => ({ id: fact.id, statement: fact.statement, publicUse: fact.publicUse, status: "proposed" as const })),
    ...known.map(fact => ({ id: fact.key, statement: fact.statement, publicUse: fact.publicUse, status: fact.status, ...(fact.at && { at: fact.at }) }))];
}
export const correctionRound = (note: Pick<Correction, "finding" | "at">) => `report-correction:${note.finding.id}:${note.at}`;
const understandingRound = (id: string) => `understanding:${id}`;
/** The Client's confirmation of a correction is their Decision on its Request: the Knowledge entry it changed, applied. */
function confirmedUnderstanding(ledger: ChangeLedger, id: string, input: { target: { key: string; version: number }; value: string },
  actor: Actor, at: string, version: number): ChangeLedger {
  const requestId = understandingRound(id) + ":request";
  if (!ledger.requests.some(request => request.id === requestId && request.status === "open")) return ledger;
  const by = { id: actor.id, role: actor.role, simulated: actor.simulated }, changeId = understandingRound(id) + ":K1";
  const decided = decide(ledger, { id: understandingRound(id) + ":confirmed", at, by, requestIds: [requestId], outcome: "change",
    reasoning: "Confirmed by someone with the Client's standing." }, [{ id: changeId, label: "K1", at, requestIds: [requestId],
    target: { grain: "fact", path: input.target.key }, base: { version: input.target.version },
    difference: { summary: "The Client's confirmed wording", after: input.value }, preserve: [], consequence: "routine" }]);
  return markApplied(decided, [changeId], at, version);
}
const openCorrections = (state: State) => state.corrections.filter(note => state.changes?.requests
  .some(request => request.id === correctionRound(note) + ":request" && request.status === "open")).map(note => note.finding.id);

/**
 * Core's Decision on the open Report corrections: the facts each one states, from the Report's AI
 * output. The Client's own words in their correction are Confirmed; Core's rewording, and anything
 * from a Specialist's correction, is Proposed (Principal, Nov 24).
 */
export function reportCorrectionFacts(state: Pick<State, "changes" | "corrections" | "version">, value: unknown, at: string) {
  if (!Array.isArray(value) || value.length > 40) throw Error("Correction facts refused");
  let ledger = state.changes ?? emptyLedger();
  const open = state.corrections.map(note => ({ note, requestId: correctionRound(note) + ":request" }))
    .filter(item => ledger.requests.some(request => request.id === item.requestId && request.status === "open"));
  const facts: Fact[] = [];
  const changes = value.map((item, index) => {
    const fact = object(item, ["findingId", "statement", "publicUse"]);
    const source = open.find(entry => entry.note.finding.id === fact.findingId);
    if (!source || typeof fact.publicUse !== "boolean") throw Error("Correction fact does not trace to an open correction");
    const statement = text(fact.statement, 2000, true), requestId = source.requestId;
    const said: SaidBy = source.note.actor.role !== "customer" ? { kind: "specialist", person: source.note.actor.id }
      : quotedIn(statement, source.note.text) ? { kind: "client", person: source.note.actor.id, record: requestId } : { kind: "core" };
    const key = factKey("report", `${fingerprint(requestId).slice(0, 8)}-${index + 1}`);
    facts.push({ key, statement, publicUse: fact.publicUse, said, source: requestId, enteredBy: "core" });
    return { id: `${requestId}:F${index + 1}`, label: `F${index + 1}`, at, requestIds: [requestId], target: { grain: "fact" as const, path: key },
      base: { version: state.version }, preserve: [], consequence: "routine" as const,
      difference: { summary: statusOf(said) === "confirmed" ? "Record the Client's own words as a Confirmed fact" : "Record as a Proposed fact for the Client to confirm",
        after: statement } };
  });
  if (open.length) {
    ledger = decide(ledger, { id: `report:${state.version}:corrections`, at, by: { id: "core", role: "core" }, requestIds: open.map(item => item.requestId),
      outcome: changes.length ? "change" : "answer", reasoning: "The facts stated in the corrections to the Report." }, changes);
    if (changes.length) ledger = markApplied(ledger, changes.map(item => item.id), at, state.version + 1);
  } else if (changes.length) throw Error("Correction facts without an open correction");
  return { ledger, facts };
}

/** What Core sends the AI: the pages' content, never their Work product identities (the AI's input is unchanged by step 4). */
const bare = <T extends { pages: WorkflowPage[] }>(value: T): T => ({ ...value, pages: value.pages.map(withoutIdentity) });

export function runInput(context: WorkflowContext, state: State, reviewStage = state.work?.reviewStage): WorkflowInput {
  const { entry, evidence, limitations, conflicts } = context;
  const { report, research, direction, blueprint, corrections, replan } = state;
  const pages = state.pages.map(withoutIdentity);
  const revisionRequest = state.revisionRequest && { ...state.revisionRequest, priorPages: state.revisionRequest.priorPages.map(withoutIdentity) };
  const sourceRecovery = state.sourceRecovery && { ...state.sourceRecovery, previous: bare(state.sourceRecovery.previous) };
  const retained = state.knowledgeReassessments?.at(-1);
  const retainedReassessment = retained && { ...retained, previous: bare(retained.previous) };
  const knowledgeReassessment: ReasoningReassessment | undefined = retainedReassessment && {
    id: retainedReassessment.id, correctionIds: retainedReassessment.correctionIds, previous: retainedReassessment.previous,
    confirmations: retainedReassessment.confirmations.map(({ recordId, key, kind, value, publicUse, previousValue, version, fingerprint, at }) =>
      ({ recordId, key, kind, value, publicUse, previousValue, version, fingerprint, at })),
  };
  return { entry, evidence: knowledgeReassessment ? [...evidence, ...confirmedSources(state)] : evidence, limitations, conflicts,
    report, research, direction, blueprint, pages, corrections, ...(knowledgeReassessment && { knowledgeReassessment }),
    ...(inputFacts(state).length && { businessFacts: inputFacts(state) }),
    ...(openCorrections(state).length && { openCorrections: openCorrections(state) }),
    ...(state.reviewRounds?.at(-1)?.status === "analysing" && { reviewRound: (({ id, edits, factNotes, noteRevisions, notes, pageNotes }) =>
      ({ id, edits, factNotes, noteRevisions, notes, ...(pageNotes?.length && { pageNotes }) }))(state.reviewRounds.at(-1)!) }),
    ...(revisionRequest && { revisionRequest }), ...(replan && { replan }), ...(!knowledgeReassessment && sourceRecovery && { sourceRecovery }), ...(reviewStage && { reviewStage }) };
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

  private authorityCurrent(state:State) {
    const authority=this.operations.marketingAuthority;
    if(state.marketingAuthorityDigest===(authority&&fingerprint(authority)))return true;
    const receipt=this.operations.processingContinuation;
    return Boolean(this.boundary==="disposable"&&state.evaluation&&state.mode==="provider"&&receipt&&authority&&
      /^[a-f0-9]{64}$/u.test(receipt.authorization)&&state.version>=receipt.baseVersion&&
      state.marketingAuthorityDigest===fingerprint(receipt.authority)&&
      sourceTransitionAuthorityMatches(authority,state.marketingAuthorityDigest,receipt.authority));
  }

  constructor(private pool: Pool, private operations: PresenceWorkflowOperations,
    private destinations: Parameters<typeof readPage>[4] = {}, private clock = Date.now, private boundary: "disposable" | "protected" = "disposable") {
    if (operations.reviewSequence !== undefined && (operations.reviewSequence !== "site-first" ||
        boundary !== "disposable" || operations.marketingAuthority?.projectionVersion !== 2)) {
      throw new IntakeError("unavailable", 403);
    }
    this.store = new WorkflowStore(pool, boundary);
  }

  async review(context: WorkflowContext) {
    const state = await this.store.read(context);
    const canonicalCurrent = state ? await this.confirmedKnowledgeCurrent(context, state) : true;
    const view = this.view(context, state, canonicalCurrent);
    if (!view || !this.operations.knowledgeConfirmation) return view;
    const client = await this.pool.connect();
    try { return { ...view, knowledgeTargets: await knowledgeTargets(client, context.scope) }; }
    finally { client.release(); }
  }

  private async confirmedKnowledgeCurrent(context: WorkflowContext, state: State) {
    const latest = new Map<string, { recordId: string; version: number; fingerprint: string }>();
    const receipts: { recordId: string; version: number; fingerprint: string }[] = [
      ...(state.understandingCorrections ?? []).flatMap(item => item.confirmation ? [item.confirmation] : []), ...state.knowledge ?? []];
    for (const item of receipts) {
      const prior = latest.get(item.recordId);
      if (!prior || prior.version < item.version) latest.set(item.recordId, item);
    }
    for (const item of latest.values()) {
      const current = await inspectCanonical(this.pool, "knowledge", context.scope.webPresenceId, item.recordId);
      if (!current || current.row.version !== item.version || current.fingerprint !== item.fingerprint) return false;
    }
    return true;
  }

  private view(context: WorkflowContext, state: State | null, canonicalCurrent = true) {
    if (!state) return null;
    const authority = this.operations.marketingAuthority;
    const current = canonicalCurrent && state.contextDigest === fingerprint(context) && this.authorityCurrent(state);
    const knowledgePending = pendingUnderstanding(state.understandingCorrections).length > 0;
    const reassessmentPending = unassessedKnowledge(state).length > 0;
    const editorial = editorialProgress(state);
    const siteFirst = this.operations.reviewSequence === "site-first" && Boolean(context.evaluation);
    const concept = current && state.evaluation && !state.homeReview && !siteFirst ? homeConceptDigest(context, state) : undefined;
    const canRenderForEditorial = current && !knowledgePending && !reassessmentPending && this.boundary === "disposable" && Boolean(authority?.earlyConceptReview) &&
      !state.work && !state.failure && nextTask(state, siteFirst)?.operation === "editorial";
    const canQueueEditorialRevision = current && !knowledgePending && !reassessmentPending && Boolean(state.editorial) && !state.work && !state.operatorReview &&
      revisionOrdinal(state) < (this.operations.maxEditorialRevisions ?? 1) &&
      Boolean(state.editorial?.concerns.length || editorial.assigned.length);
    const next = !current ? "evidence-changed" : knowledgePending ? "understanding-review" : reassessmentPending ? "reassessment-ready" : state.failure ? "recover" : state.work ? "in-progress" :
      state.reviewRounds?.at(-1)?.status === "summary" ? "review-summary" :
      nextTask(state, siteFirst)?.operation ?? (concept ? "home-concept" : !state.confirmation ? "customer-review" :
        state.editorial && (state.editorial.concerns.length || editorial.open) ? "editorial-review" :
          !state.operatorReview ? "operator-review" : "review-complete");
    const reviewedVisuals = (state.visuals ?? []).filter(visual => visual.placement.candidateDigest === state.operatorReview?.target);
    const qualityTarget = current && !knowledgePending && !reassessmentPending && authority && state.operatorReview && !reviewedVisuals.some(visual =>
      !["approved", "rejected", "revoked"].includes(visual.state))
      ? fingerprint({ candidate: state.operatorReview.target, context: state.contextDigest, authority, visuals: reviewedVisuals }) : undefined;
    const deliveryHistory = (state.qualityReviews ?? []).filter(review => !review.phase);
    const lastQualityReview = deliveryHistory.at(-1);
    const conceptTarget = !siteFirst ? conceptQualityTarget(context, state, authority, this.boundary === "disposable") : undefined;
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
      ...(state.understandingCorrections && { understandingCorrections: state.understandingCorrections }),
      ...(state.wordpressReviews && { wordpressReviews: state.wordpressReviews }),
      ...(state.widerChanges && { widerChanges: state.widerChanges }),
      ...(state.reviewRounds && { reviewRounds: state.reviewRounds }),
      ...(state.changes && { changes: state.changes }),
      // The Site plan and its Menu as Work products: their identities and current versions.
      ...(state.workProducts?.plan && { sitePlan: { id: state.workProducts.plan.id, version: state.workProducts.plan.version,
        ...(state.workProducts.menu && { menu: { id: state.workProducts.menu.id, version: state.workProducts.menu.version } }) } }),
      ...(state.businessFacts && { businessFacts: state.businessFacts }),
      ...(state.knowledge?.length && { facts: state.knowledge.at(-1)!.facts, knowledgeReceipts: state.knowledge }),
      ...(state.clientStatements && { clientStatements: state.clientStatements }),
      ...(this.operations.knowledgeConfirmation && { knowledgeConfirmationAvailable: true as const }),
      ...(state.knowledgeReassessments && { knowledgeReassessments: state.knowledgeReassessments }),
      ...(editorial.findings.length > 0 && { editorialFindings: editorial.findings }), canQueueEditorialRevision,
      ...(concept && { homeConcept: { digest: concept } }), ...(state.homeReview && { homeReview: state.homeReview }),
      ...(operatorReview && { candidateReviewTarget: candidateReviewTarget(state) }),
      ...(deliveryQuality && { deliveryQuality }), ...(conceptQuality && { conceptQuality }),
      ...(canRenderForEditorial && { canRenderForEditorial: true as const }),
      ...(current && authority && { brandDigest: authority.brandDigest }),
      ...((state.marketingAuthorityDigest && !authority) && { deliveryQuality: { target: null, passed: false, history: state.qualityReviews ?? [] } }),
      failure, ...(failure === "output-invalid" && state.artifactIssue && { artifactIssue: state.artifactIssue }),
      next, pendingOperation: state.work?.operation ?? null, recoverable: current && Boolean(state.work && (state.failure || state.work.until <= this.clock())),
      sources: [...state.sourceSnapshot.evidence, ...confirmedSources(state)], limitations: state.sourceSnapshot.limitations,
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

  private async current(context: WorkflowContext, version: number, understandingReview = false) {
    const state = await this.store.read(context);
    if (!state || state.version !== version || state.contextDigest !== fingerprint(context) || state.mode !== this.operations.mode ||
        !this.authorityCurrent(state)) {
      throw new IntakeError("draft_changed", 409);
    }
    if (!await this.confirmedKnowledgeCurrent(context, state)) throw new IntakeError("draft_changed", 409);
    if (!understandingReview && (pendingUnderstanding(state.understandingCorrections).length || unassessedKnowledge(state).length)) {
      throw new IntakeError("workflow_not_ready", 409);
    }
    return state;
  }

  async verifyResumeState(context:WorkflowContext) {
    const state=await this.store.read(context);
    if(!state)throw new IntakeError("workflow_not_ready",409);
    await this.current(context,state.version,true);
    return state.version;
  }

  async correctUnderstanding(context: WorkflowContext, version: number, value: unknown, actor: Actor) {
    let proposed: Pick<UnderstandingCorrection, "id" | "sourceId" | "sourceDigest" | "text">;
    try {
      const input = object(value, ["id", "sourceId", "sourceDigest", "text"]);
      const id = text(input.id, 36), sourceId = text(input.sourceId, 160);
      if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(id) ||
          typeof input.sourceDigest !== "string" || !/^[a-f0-9]{64}$/u.test(input.sourceDigest)) throw Error("Invalid source correction binding");
      proposed = { id, sourceId, sourceDigest: input.sourceDigest, text: text(input.text, Infinity, true) };
    } catch { throw new IntakeError("invalid_request"); }
    if (!Number.isSafeInteger(version) || version < 1) throw new IntakeError("invalid_request");
    const saved = await this.store.read(context);
    if (!saved) throw new IntakeError("workflow_not_ready", 409);
    const state = await this.current(context, saved.version, true);
    if (!["customer", "operator"].includes(actor.role) || actor.simulated !== (state.mode === "fixture") || !actor.id.trim()) throw new IntakeError("unavailable", 403);
    const existing = state.understandingCorrections?.find(item => item.id === proposed.id);
    if (existing) {
      const { at, withdrawn, confirmation, ...previous } = existing; void at; void withdrawn; void confirmation;
      if (fingerprint(previous) !== fingerprint({ ...proposed, actor })) throw new IntakeError("draft_changed", 409);
      return this.view(context, state);
    }
    if (state.version !== version) throw new IntakeError("draft_changed", 409);
    const source = [...state.sourceSnapshot.evidence, ...state.research ?? []].find(item => item.id === proposed.sourceId);
    if (!source || fingerprint(source) !== proposed.sourceDigest) throw new IntakeError("draft_changed", 409);
    if (state.work || state.visuals?.some(visual => visual.state === "running")) throw new IntakeError("workflow_not_ready", 409);
    // A correction to what Core understood from a source is a Request on Knowledge, on the Account's record.
    const at = new Date(this.clock()).toISOString(), by = { id: actor.id, role: actor.role, simulated: actor.simulated };
    const changes = takeIn(state.changes ?? emptyLedger(), { id: understandingRound(proposed.id), at, by }, [{ id: understandingRound(proposed.id) + ":request", at,
      origin: { kind: actor.role === "customer" ? "customer" : "operator", by, channel: "core-screen" },
      target: { grain: "fact", path: proposed.sourceId }, words: proposed.text.slice(0, 4000) }]);
    return this.view(context, await this.store.append(context, version, { ...state, changes,
      understandingCorrections: [...state.understandingCorrections ?? [], { ...proposed, actor, at }],
    }));
  }

  /**
   * A Specialist enters an email from the Client (Principal, Nov 24). The Client introduced
   * what it says, so a Fact quoted from it goes into the one Knowledge as Confirmed by the
   * Client; anything the Specialist words differently goes in as Proposed. The email is kept as
   * Evidence, and the Request, Decision and Changes are on the Account's record.
   */
  async recordClientEmail(context: WorkflowContext, version: number, actor: Actor, value: unknown) {
    let input: { id: string; from: string; sentAt: string; text: string; facts: { statement: string; publicUse: boolean }[] };
    try {
      const raw = object(value, ["id", "from", "sentAt", "text", "facts"]);
      if (!Array.isArray(raw.facts) || !raw.facts.length || raw.facts.length > 20) throw Error();
      input = { id: text(raw.id, 36), from: text(raw.from, 200), sentAt: text(raw.sentAt, 40), text: text(raw.text, 20_000, true),
        facts: raw.facts.map(item => { const fact = object(item, ["statement", "publicUse"]);
          if (typeof fact.publicUse !== "boolean") throw Error();
          return { statement: text(fact.statement, 2000, true), publicUse: fact.publicUse }; }) };
      if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(input.id) || !Number.isFinite(Date.parse(input.sentAt))) throw Error();
    } catch { throw new IntakeError("invalid_request"); }
    if (!Number.isSafeInteger(version) || version < 1) throw new IntakeError("invalid_request");
    const saved = await this.store.read(context);
    if (!saved) throw new IntakeError("workflow_not_ready", 409);
    const state = await this.current(context, saved.version, true);
    if (actor.role !== "operator" || actor.simulated !== (state.mode === "fixture") || !actor.authority) throw new IntakeError("unavailable", 403);
    // Only someone who speaks for the Client on this Account can give the Client's word.
    const people = await this.operations.clientPeople?.(context) ?? [];
    if (!people.some(person => person.toLowerCase() === input.from.toLowerCase())) throw new IntakeError("unavailable", 403);
    const existing = state.clientStatements?.find(item => item.id === input.id);
    if (existing) {
      if (existing.text !== input.text || existing.from !== input.from) throw new IntakeError("draft_changed", 409);
      return this.view(context, state);
    }
    if (state.version !== version) throw new IntakeError("draft_changed", 409);
    if (state.work) throw new IntakeError("workflow_not_ready", 409);
    const at = new Date(this.clock()).toISOString();
    const client = { id: input.from, role: "customer" as const }, specialist = { id: actor.id, role: actor.role, simulated: actor.simulated };
    const facts: Fact[] = input.facts.map((fact, index) => ({ key: factKey(input.id.slice(0, 8), "m" + (index + 1)), statement: fact.statement,
      publicUse: fact.publicUse, source: `client-email:${input.id}`, enteredBy: actor.id,
      said: quotedIn(fact.statement, input.text) ? { kind: "client", person: input.from, record: `client-email:${input.id}` } : { kind: "specialist", person: actor.id } }));
    // The Client's Request, and the Specialist's Decision to record it, on the Account's record.
    const requestId = `${input.id}:email`;
    let ledger = takeIn(state.changes ?? emptyLedger(), { id: input.id, at, by: specialist }, [{ id: requestId, at: input.sentAt,
      origin: { kind: "customer", by: client, channel: "email", enteredBy: specialist }, target: { grain: "fact" }, words: input.text.slice(0, 4000),
      channelRef: input.id }]);
    const changes = facts.map((fact, index) => ({ id: `${input.id}:F${index + 1}`, label: `F${index + 1}`, at, requestIds: [requestId],
      target: { grain: "fact" as const, path: fact.key }, base: { version },
      difference: { summary: statusOf(fact.said) === "confirmed" ? "Record the Client's own words as a Confirmed fact"
        : "Record as a Proposed fact: the Specialist's wording, not the Client's", after: fact.statement },
      preserve: [], consequence: "routine" as const }));
    ledger = decide(ledger, { id: `${input.id}:recorded`, at, by: specialist, requestIds: [requestId], outcome: "change",
      reasoning: "A Client email entered by a Specialist: quoted facts are the Client's word; the rest wait for the Client." }, changes);
    ledger = markApplied(ledger, changes.map(item => item.id), at, version + 1);
    const statement: ClientStatement = { id: input.id, from: input.from, sentAt: input.sentAt, text: input.text, enteredBy: actor, at, facts: facts.map(fact => fact.key) };
    return this.view(context, await this.store.atomic(context, async (store, db) => {
      if ((await store.read(context))?.version !== version) throw new IntakeError("draft_changed", 409);
      const receipt = await recordFacts(db, context.scope, facts, actor.id, at, `Client email ${input.id} from ${input.from}, entered by ${actor.id}`);
      return store.append(context, version, { ...state, changes: ledger, knowledge: [...state.knowledge ?? [], receipt],
        clientStatements: [...state.clientStatements ?? [], statement] });
    }));
  }

  /**
   * The Client answers a Fact in My Business: confirm it as it stands, correct its wording, or say
   * it is not true. Only someone with the Client's standing may (the same check as confirming a
   * business correction). A confirmed or corrected Fact is the Client's word; a declined one
   * leaves Knowledge (its history stays) and raises a Request to revise any copy that relied on it.
   */
  async reviewFact(context: WorkflowContext, version: number, value: unknown, actor: Actor) {
    let input: { requestId: string; key: string; response: "confirm" | "correct" | "decline"; wording?: string };
    try {
      const raw = object(value, ["requestId", "key", "response", "wording"]);
      const response = raw.response;
      if (response !== "confirm" && response !== "correct" && response !== "decline") throw Error();
      input = { requestId: text(raw.requestId, 36), key: text(raw.key, 64), response,
        ...(response === "correct" && { wording: text(raw.wording, 2000, true) }) };
      if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(input.requestId) || (response !== "correct" && raw.wording !== undefined)) throw Error();
    } catch { throw new IntakeError("invalid_request"); }
    if (!this.operations.knowledgeConfirmation || actor.simulated !== (this.operations.mode === "fixture")) throw new IntakeError("unavailable", 403);
    const grant = await this.operations.knowledgeConfirmation.authorize(actor, context).catch(() => { throw new IntakeError("unavailable", 403); });
    if (grant.operatorId !== actor.id || !["business-representative", "accepted-authority"].includes(grant.customer?.kind)) throw new IntakeError("unavailable", 403);
    const saved = await this.store.read(context);
    if (!saved) throw new IntakeError("workflow_not_ready", 409);
    const state = await this.current(context, saved.version, true);
    if (state.changes?.rounds.some(item => item.id === input.requestId)) return this.view(context, state);
    if (state.version !== version) throw new IntakeError("draft_changed", 409);
    if (state.work) throw new IntakeError("workflow_not_ready", 409);
    const at = new Date(this.clock()).toISOString();
    const client = { id: grant.customer.subjectId, role: "customer" as const };
    const record = `my-business:${input.requestId}` + (grant.customer.kind === "accepted-authority" ? `; authority ${grant.customer.authorityReference}` : "");
    return this.view(context, await this.store.atomic(context, async (store, db) => {
      if ((await store.read(context))?.version !== version) throw new IntakeError("draft_changed", 409);
      const fact = (await currentFacts(db, context.scope.webPresenceId)).find(item => item.key === input.key);
      if (!fact) throw new IntakeError("draft_changed", 409);
      const statement = input.wording ?? fact.statement;
      const requestId = `${input.requestId}:request`;
      let ledger = takeIn(state.changes ?? emptyLedger(), { id: input.requestId, at, by: client }, [{ id: requestId, at,
        origin: { kind: "customer", by: client, channel: "core-screen" }, target: { grain: "fact", path: fact.key },
        words: input.response === "decline" ? `Not true: ${fact.statement}` : input.response === "correct" ? `Correct to: ${statement}` : `Confirm: ${statement}` }]);
      const change = { id: `${input.requestId}:F1`, label: "F1", at, requestIds: [requestId], target: { grain: "fact" as const, path: fact.key },
        base: { version }, difference: { summary: input.response === "decline" ? "Remove this Fact: the Client says it is not true"
          : "The Client confirms this Fact in their own words", before: fact.statement, ...(input.response !== "decline" && { after: statement }) },
        preserve: [], consequence: "routine" as const };
      ledger = decide(ledger, { id: `${input.requestId}:decided`, at, by: client, requestIds: [requestId], outcome: "change",
        reasoning: "The Client's own answer about their business." }, [change]);
      ledger = markApplied(ledger, [change.id], at, version + 1);
      if (input.response === "decline") ledger = takeIn(ledger, { id: `${input.requestId}:follow-up`, at, by: { id: "core", role: "core" } }, [{
        id: `${input.requestId}:revise-copy`, at, origin: { kind: "core", by: { id: "core", role: "core" }, channel: "core-screen" }, target: { grain: "site" },
        words: `The Client says this is not true: "${fact.statement}". Revise any copy that relies on it.` }]);
      const receipt = await recordFacts(db, context.scope,
        input.response === "decline" ? [] : [{ key: fact.key, statement, publicUse: fact.publicUse, source: fact.source, enteredBy: actor.id,
          said: { kind: "client", person: client.id, record } }],
        actor.id, at, `The Client ${input.response === "decline" ? "declined" : input.response === "correct" ? "corrected" : "confirmed"} Fact ${fact.key} in My Business`,
        input.response === "decline" ? [fact.key] : []);
      return store.append(context, version, { ...state, changes: ledger, knowledge: [...state.knowledge ?? [], receipt] });
    }));
  }

  /** Withdraw a correction not yet confirmed; its Request stays on record, withdrawn. */
  async withdrawUnderstandingCorrection(context: WorkflowContext, version: number, value: unknown, actor: Actor) {
    let input: Record<string, unknown>, reason: string;
    try { input = object(value, ["id", "reason"]); reason = text(input.reason, Infinity, true); }
    catch { throw new IntakeError("invalid_request"); }
    if (!Number.isSafeInteger(version) || version < 1) throw new IntakeError("invalid_request");
    const saved = await this.store.read(context);
    if (!saved) throw new IntakeError("workflow_not_ready", 409);
    const state = await this.current(context, saved.version, true);
    const item = state.understandingCorrections?.find(item => item.id === input.id);
    if (!item || fingerprint(item.actor) !== fingerprint(actor)) throw new IntakeError("unavailable", 403);
    if (item.confirmation) throw new IntakeError("workflow_not_ready", 409);
    if (item.withdrawn) {
      if (item.withdrawn.reason !== reason) throw new IntakeError("draft_changed", 409);
      return this.view(context, state);
    }
    if (state.version !== version) throw new IntakeError("draft_changed", 409);
    const at = new Date(this.clock()).toISOString();
    const round = state.changes?.rounds.find(entry => entry.id === understandingRound(item.id) && entry.status === "taken-in");
    return this.view(context, await this.store.append(context, version, { ...state,
      ...(round && { changes: withdrawRound(state.changes!, round.id, at, { id: actor.id, role: actor.role, simulated: actor.simulated }) }),
      understandingCorrections: state.understandingCorrections!.map(entry => entry.id !== item.id ? entry
        : { ...entry, withdrawn: { actor, reason, at } }),
    }));
  }

  async confirmUnderstanding(context: WorkflowContext, version: number, value: unknown, actor: Actor) {
    if (!this.operations.knowledgeConfirmation || actor.simulated !== (this.operations.mode === "fixture")) throw new IntakeError("unavailable", 403);
    try {
      const input = knowledgeConfirmationInput(value);
      const grant = await this.operations.knowledgeConfirmation.authorize(actor, context).catch(() => { throw new IntakeError("unavailable", 403); });
      if (grant.operatorId !== actor.id || !["business-representative", "accepted-authority"].includes(grant.customer?.kind)) throw new IntakeError("unavailable", 403);
      const authority = { id: text(grant.operatorId), authorityReference: text(grant.authorityReference, 300), customer: {
        kind: grant.customer.kind, subjectId: text(grant.customer.subjectId), authorityReference: text(grant.customer.authorityReference, 500),
      } };
      return await this.store.atomic(context, async (store, client) => {
        const state = await store.read(context);
        if (!state || state.contextDigest !== fingerprint(context) || state.mode !== this.operations.mode ||
            state.marketingAuthorityDigest !== (this.operations.marketingAuthority && fingerprint(this.operations.marketingAuthority))) throw new IntakeError("draft_changed", 409);
        const retry = state.understandingCorrections?.find(item => item.confirmation?.requestId === input.requestId)?.confirmation;
        if (retry) {
          if (retry.inputDigest !== fingerprint(input) || retry.by !== actor.id || fingerprint(retry.customer) !== fingerprint(authority.customer)) throw new IntakeError("draft_changed", 409);
          return this.view(context, state);
        }
        if (state.version !== version) throw new IntakeError("draft_changed", 409);
        const note = state.understandingCorrections?.find(item => item.id === input.correctionId);
        if (!note || note.confirmation || note.withdrawn || state.work || state.visuals?.some(visual => visual.state === "running")) throw new IntakeError("workflow_not_ready", 409);
        const confirmation = await confirmKnowledge(client, context.scope, input, authority,
          { intakeId: context.intakeId, sourceId: note.sourceId, sourceDigest: note.sourceDigest, proposedCorrectionDigest: fingerprint(note) },
          new Date(this.clock()).toISOString(), grant.foundation);
        return this.view(context, await store.append(context, version, { ...state,
          ...(state.changes && { changes: confirmedUnderstanding(state.changes, note.id, input, actor, new Date(this.clock()).toISOString(), version + 1) }),
          understandingCorrections: state.understandingCorrections!.map(item => item.id === note.id ? { ...item, confirmation } : item),
        }));
      });
    } catch (error) {
      if (error instanceof KnowledgeConfirmationError) throw new IntakeError(error.code === "invalid" ? "invalid_request" : error.code === "stale" ? "draft_changed" : "unavailable", error.code === "invalid" ? 400 : error.code === "stale" ? 409 : 403);
      throw error;
    }
  }

  async reassessUnderstanding(context: WorkflowContext, version: number, value: unknown, actor: Actor) {
    let id: string;
    try { id = text(object(value, ["id"]).id, 36); if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(id)) throw Error(); }
    catch { throw new IntakeError("invalid_request"); }
    const saved = await this.store.read(context);
    if (!saved) throw new IntakeError("workflow_not_ready", 409);
    const state = await this.current(context, saved.version, true);
    if (actor.simulated !== (state.mode === "fixture")) throw new IntakeError("unavailable", 403);
    const retry = state.knowledgeReassessments?.find(item => item.id === id);
    if (retry) {
      if (fingerprint(retry.actor) !== fingerprint(actor)) throw new IntakeError("draft_changed", 409);
      return this.view(context, state);
    }
    if (version !== state.version) throw new IntakeError("draft_changed", 409);
    const pending = unassessedKnowledge(state);
    if (!pending.length || pendingUnderstanding(state.understandingCorrections).length || state.work || state.visuals?.some(visual => visual.state === "running")) throw new IntakeError("workflow_not_ready", 409);
    const latest = new Map<string, KnowledgeConfirmation>();
    for (const note of state.understandingCorrections ?? []) if (note.confirmation) {
      const key = note.confirmation.recordId + ":" + note.confirmation.key, prior = latest.get(key);
      if (!prior || prior.version < note.confirmation.version) latest.set(key, note.confirmation);
    }
    const reassessment: KnowledgeReassessment = { id, correctionIds: pending.map(item => item.id), confirmations: [...latest.values()],
      revisionOrdinal: revisionOrdinal(state), replanOrdinal: replanOrdinal(state),
      actor, at: new Date(this.clock()).toISOString(), previous: { report: state.report, direction: state.direction, blueprint: state.blueprint, pages: state.pages } };
    return this.view(context, await this.store.append(context, version, { ...state,
      knowledgeReassessments: [...state.knowledgeReassessments ?? [], reassessment],
      report: null, confirmation: null, direction: null, blueprint: null, pages: [], editorial: null, operatorReview: null,
      revisionRequest: null, replan: undefined,
      editorialFindings: [], editorialDecisions: [], homeReview: null, conceptEditorial: null,
    }));
  }

  /** One explicitly authorized disposable source repair, retaining all prior events,
   * provider usage and consumed editorial/replan allowances. This is not customer
   * confirmation, a public rewrite, or permission to change source scope. */
  async reassessFromRepairedSources(context: WorkflowContext, version: number, actor: Actor, authorization: unknown) {
    const permitted = this.operations.sourceRepair;
    const transition = permitted?.contextTransition;
    const state = transition ? await this.store.read(context) : await this.current(context, version);
    const authority = this.operations.marketingAuthority;
    if (this.boundary !== "disposable" || !state?.evaluation || authority?.projectionVersion !== 2 ||
        actor.role !== "operator" || actor.simulated !== (state.mode === "fixture") || !actor.authority || !permitted ||
        state.mode !== this.operations.mode || state.version !== version ||
        authorization !== permitted.authorization || ![permitted.authorization,permitted.previousStateDigest,permitted.materialsDigest].every(x=>/^[a-f0-9]{64}$/u.test(x))) {
      throw new IntakeError("unavailable", 403);
    }
    if (state.sourceRecovery?.authorization === authorization) {
      const {actor:previousActor,at,priorRevisionOrdinal,previous,...saved}=state.sourceRecovery;
      void previousActor;void at;void priorRevisionOrdinal;void previous;
      if (fingerprint(permitted)!==fingerprint(saved)||state.contextDigest!==fingerprint(context)||
          state.marketingAuthorityDigest!==fingerprint(authority)) throw new IntakeError("draft_changed",409);
      return this.view(context,state);
    }
    if (state.sourceRecovery && !transition) throw new IntakeError("draft_changed",409);
    if (transition) {
      const hashes=[transition.previousContextDigest,transition.previousAuthorityDigest,transition.nextContextDigest,
        transition.nextAuthorityDigest,...transition.addedEvidenceDigests];
      const oldEvidence=state.sourceSnapshot.evidence,added=context.evidence.slice(oldEvidence.length);
      const priorContext={...context,...state.sourceSnapshot};
      const priorAuthority={...authority,contextDigest:transition.previousContextDigest,sources:authority.sources.slice(0,oldEvidence.length)};
      if (!transition.addedEvidenceDigests.length||!hashes.every(x=>/^[a-f0-9]{64}$/u.test(x))||
          new Set(context.evidence.map(source=>source.id)).size!==context.evidence.length||
          state.contextDigest!==transition.previousContextDigest||state.marketingAuthorityDigest!==transition.previousAuthorityDigest||
          fingerprint(context)!==transition.nextContextDigest||fingerprint(authority)!==transition.nextAuthorityDigest||
          fingerprint(priorContext)!==transition.previousContextDigest||fingerprint(priorAuthority)!==transition.previousAuthorityDigest||
          fingerprint(context.evidence.slice(0,oldEvidence.length))!==fingerprint(oldEvidence)||
          fingerprint(added.map(fingerprint))!==fingerprint(transition.addedEvidenceDigests)||
          added.some(source=>!authority.sources.some(row=>row.digest===fingerprint(source)&&row.use==="analysis"))) {
        throw new IntakeError("draft_changed",409);
      }
    }
    if (state.work || state.failure || state.operatorReview || state.version !== permitted.baseVersion ||
        fingerprint(state) !== permitted.previousStateDigest) throw new IntakeError("draft_changed",409);
    const sourceRecovery: SourceRecovery = {...permitted,actor,at:new Date(this.clock()).toISOString(),
      priorRevisionOrdinal: revisionOrdinal(state),
      previous: structuredClone({report:state.report,direction:state.direction,blueprint:state.blueprint,pages:state.pages})};
    return this.view(context,await this.store.append(context,version,{...state,sourceRecovery,
      ...(transition&&{contextDigest:fingerprint(context),marketingAuthorityDigest:fingerprint(authority),
        sourceSnapshot:{evidence:context.evidence,entry:context.entry,limitations:context.limitations,conflicts:context.conflicts}}),
      report:null,confirmation:null,direction:null,blueprint:null,pages:[],editorial:null,operatorReview:null,
      editorialFindings:[],editorialDecisions:[],revisionRequest:null,homeReview:null,conceptEditorial:null,visuals:[]}));
  }

  async advance(context: WorkflowContext, version: number) {
    const state = await this.current(context, version);
    const task = nextTask(state, this.operations.reviewSequence === "site-first" && Boolean(context.evaluation));
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
    // The lease outlasts the longest streamed answer, so no one treats live work as abandoned.
    const work = { ...task, attempt: randomUUID(), until: this.clock() + 35 * 60_000, inputDigest: fingerprint(input),
      ...(state.retry?.previous && { retryOf: state.retry.previous }) };
    const run = { context, input, work };
    await this.operations.preflight?.(run);
    const receipt=this.operations.processingContinuation,authority=this.operations.marketingAuthority;
    const continuation=receipt&&authority&&state.marketingAuthorityDigest!==fingerprint(authority)?{
      marketingAuthorityDigest:fingerprint(authority),processingContinuations:[...state.processingContinuations??[],{
        authorization:receipt.authorization,from:state.marketingAuthorityDigest!,to:fingerprint(authority),
        fromVersion:state.version,at:new Date(this.clock()).toISOString()}]}:{};
    const claimed = await this.store.append(context, state.version, { ...state, ...continuation, work });
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
    let knowledgeWrite: Fact[] = [];
    const work = state.work!;
    const sources = [...context.evidence, ...confirmedSources(state), ...state.research ?? []];
    const ids = sources.map(source => source.id);
    const internalIds = new Set(confirmedKnowledgeEvidence((state.knowledgeReassessments?.at(-1)?.confirmations ?? []).filter(item => !item.publicUse)).map(source => source.id));
    const pageIds = ids.filter(id => !internalIds.has(id));
    const paths = state.blueprint?.pages.map(page => page.path) ?? [];
    let next: State;
    const provider = state.mode === "provider";
    try {
      if (output instanceof ArtifactValidationError) throw output;
      switch (work.operation) {
        case "research": next = { ...state, research: readResearch(output, ids) }; break;
        case "report": {
          const { correctionFacts, ...report } = (output && typeof output === "object" ? output : {}) as Record<string, unknown>;
          next = { ...state, report: readReport(correctionFacts === undefined ? output : report, sources, provider) };
          if (correctionFacts !== undefined) {
            const answered = reportCorrectionFacts(state, correctionFacts, new Date(this.clock()).toISOString());
            next = { ...next, changes: answered.ledger };
            knowledgeWrite = answered.facts;
          }
          break;
        }
        case "direction": next = { ...state, direction: readDirection(output, ids, provider) }; break;
        case "blueprint": {
          const reassessment = state.knowledgeReassessments?.at(-1);
          const blueprint = readBlueprint(output, ids, provider, Boolean(this.operations.marketingAuthority?.strategy), Boolean(reassessment));
          const retained: WorkflowPage[] = [];
          if (reassessment) for (const page of blueprint.pages) {
            const previous = reassessment.previous.pages.find(item => item.path === page.path);
            if (page.change === "retain") { if (!previous) throw Error("Cannot retain an absent Page"); retained.push(previous); }
            else if ((page.change === "revise") !== Boolean(previous)) throw Error("Page change plan differs from retained site");
          }
          next = { ...state, blueprint: { ...blueprint, ...(this.operations.marketingAuthority?.strategy && {
            strategyBasis: strategyBasis(context, state),
          }) }, ...(reassessment && { pages: retained }) };
          break;
        }
        case "page": {
          if (state.evaluation && state.revisionRequest?.batch === "pending" && !work.path) {
            const revisionRequest = state.revisionRequest;
            next = { ...state, revisionRequest: { ...revisionRequest, batch: "applied" },
              pages: applyEditorialPatch(output, state.pages, revisionRequest.paths, paths, pageIds, this.destinations) };
            break;
          }
          const destinations = state.evaluation ? Object.fromEntries(Object.entries(this.destinations).filter(([, destination]) =>
            destination !== work.path && paths.includes(destination))) : this.destinations;
          // A revision limited to noted sections keeps the rest of the Page exactly (owner, Nov 23).
          const noted = state.revisionRequest?.sections?.find(item => item.path === work.path);
          const prior = noted && state.revisionRequest!.priorPages.find(item => item.path === work.path);
          let widerChange: string | null = null;
          let page: WorkflowPage;
          if (noted && prior) {
            const revised = readSectionRevision(output, prior, noted.indexes, pageIds, provider,
              Boolean(this.operations.marketingAuthority?.strategy && this.boundary === "disposable"));
            page = revised.page;
            widerChange = revised.widerChange;
          } else page = readPage(output, work.path!, paths, pageIds, destinations, provider, Boolean(state.evaluation),
            Boolean(this.operations.marketingAuthority?.strategy && this.boundary === "disposable"));
          if (state.evaluation && page.composition !== "managed-v1") throw Error("Evaluation Page needs the composed format");
          // A page revised from Operator Notes must still contain the Operator's own wording.
          if (droppedWording(page, state.revisionRequest?.keep).length) {
            throw new ArtifactValidationError("operator-wording", "Revised page dropped the Operator's wording");
          }
          // Keep the exact sitemap order when selected pages are redrafted.
          const drafts = new Map([...state.pages, page].map(draft => [draft.path, draft]));
          // A page revised for an Operator review round carries out that round's approved Changes on it.
          const decidedRound = state.revisionRequest?.source === "operator-review" ? state.reviewRounds?.findLast(item => item.status === "decided") : undefined;
          next = { ...state, pages: paths.flatMap(path => drafts.get(path) ?? []),
            ...(decidedRound && state.changes && { changes: appliedInRound(state.changes, decidedRound.id, change =>
              change.label.startsWith("C") && change.target.path === work.path, new Date(this.clock()).toISOString(), state.version + 1) }),
            ...(widerChange && { widerChanges: [...state.widerChanges ?? [], { path: work.path!, reason: widerChange,
              at: new Date(this.clock()).toISOString(), reviewAt: state.revisionRequest!.at }] }) };
          break;
        }
        case "review-analysis": {
          const round = state.reviewRounds?.at(-1);
          if (round?.status !== "analysing") throw Error("No review round is being analysed");
          const { untraced, skipped, refusedPages, refusedNotes, ...analysis } = readReviewAnalysis(output, round, state.pages, paths);
          const analysed: ReviewRound = { ...round, status: "summary", analysis,
            ...((untraced || skipped || refusedPages) && { analysisNotes: { untracedFacts: untraced, skippedRevisions: skipped,
              ...(refusedPages && { refusedPages, refusedPageNotes: refusedNotes }) } }) };
          // Core's analysis is its Decision on the round's Requests: the Changes it proposes, each made against these pages.
          const taken = roundLedger(state.changes, { ...round, analysis: undefined }, state.version, state.pages);
          next = { ...state, reviewRounds: [...state.reviewRounds!.slice(0, -1), analysed],
            changes: analysedRound(taken, analysed, state.version, state.pages, new Date(this.clock()).toISOString(),
              state.workProducts?.plan && { id: state.workProducts.plan.id, version: state.workProducts.plan.version }) };
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
      if (process.env.MIOPAGES_DEBUG_VALIDATION) console.error("VALIDATION:", work.operation, work.path, error instanceof Error ? error.message : error);
      return this.fail(context, state, "output-invalid", error instanceof ArtifactValidationError ? error.issue : "shape-or-content");
    }
    const settled = { ...next, work: null, failure: null,
      ...(state.artifactIssue && { artifactIssue: null }), ...(state.retry && { retry: { ...state.retry, previous: "" } }) };
    if (!knowledgeWrite.length) return this.view(context, await this.store.append(context, state.version, settled));
    // Facts from Report corrections go into the one Knowledge with the Report, or not at all.
    const facts = knowledgeWrite;
    return this.view(context, await this.store.atomic(context, async (store, db) => {
      if ((await store.read(context))?.version !== state.version) throw new IntakeError("draft_changed", 409);
      const receipt = await recordFacts(db, context.scope, facts, "core", new Date(this.clock()).toISOString(), "Facts stated in corrections to the Business Understanding Report");
      return store.append(context, state.version, { ...settled, knowledge: [...state.knowledge ?? [], receipt] });
    }));
  }

  async correctReport(context: WorkflowContext, version: number, finding: string, correction: unknown, actor: Actor, developmentCorrection = false) {
    const state = await this.current(context, version);
    if (actor.role !== (developmentCorrection ? "operator" : "customer") || actor.simulated !== (state.mode === "fixture")) throw new IntakeError("unavailable", 403);
    const priorFinding = state.report?.findings.find(item => item.id === finding);
    if (state.work || state.visuals?.some(visual => visual.state === "running") || !state.report || !priorFinding) throw new IntakeError("workflow_not_ready", 409);
    const note = { finding: priorFinding, text: text(correction, 8_000, true), actor,
      reportDigest: fingerprint(state.report), at: new Date(this.clock()).toISOString() };
    // A Request on the Report (Change area). When Core next writes the Report it lists the facts
    // the correction states, under the standing rule (Principal, Nov 24).
    const by = { id: actor.id, role: actor.role, simulated: actor.simulated };
    const roundId = correctionRound(note);
    // A newer correction of the same finding replaces the earlier one, which stays on record, withdrawn.
    const earlier = state.corrections.find(item => item.finding.id === finding);
    const earlierRound = earlier && state.changes?.rounds.find(item => item.id === correctionRound(earlier) && item.status === "taken-in");
    const prior = earlierRound ? withdrawRound(state.changes!, earlierRound.id, note.at, by) : state.changes ?? emptyLedger();
    const changes = takeIn(prior, { id: roundId, at: note.at, by }, [{ id: roundId + ":request", at: note.at,
      origin: { kind: actor.role === "customer" ? "customer" : "operator", by, channel: "core-screen" },
      target: { grain: "report", path: priorFinding.id }, words: note.text }]);
    return this.view(context, await this.store.append(context, version, { ...state, changes,
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

  /** Operator retry after an answer was lost in transit: the lost attempt stays on record, charged at
   * its full reservation, and the same unchanged work is queued again as a new attempt. */
  async retryLostAnswer(context: WorkflowContext, version: number, actor: Actor) {
    const state = await this.current(context, version), work = state.work;
    if (actor.role !== "operator" || actor.simulated !== (state.mode === "fixture") || (!actor.simulated && !actor.authority)) {
      throw new IntakeError("unavailable", 403);
    }
    const count = state.retry?.count ?? 0;
    if (state.failure !== "outcome-unknown" || !work || work.attempt === "preparation-only" || !this.operations.settleLostAnswer ||
        count >= (this.operations.maxRetries ?? 0) || await this.store.output(context, work)) throw new IntakeError("workflow_not_ready", 409);
    const input = runInput(context, state, work.reviewStage);
    if (fingerprint(input) !== work.inputDigest) throw new IntakeError("draft_changed", 409);
    const settled = await this.operations.settleLostAnswer({ context, input, work });
    const next = await this.store.append(context, version, { ...state, work: null, failure: null,
      retry: { previous: work.attempt, count: count + 1 },
      lostAnswers: [...state.lostAnswers ?? [], { attempt: work.attempt, operation: work.operation, reservedMicros: settled.reservedMicros,
        by: actor.id, at: new Date(this.clock()).toISOString() }] });
    return this.view(context, next);
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
    const ordinal = revisionOrdinal(state) + 1;
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

  /**
   * Take in an Operator review from WordPress: the Operator's wording is written into
   * Core's pages as is; pages with Notes or structural changes go to Core's revision,
   * which must keep that wording. Notes are recorded so the next delivery answers and
   * resolves them. No AI call happens here; revision runs with the case's next work.
   */
  /**
   * Take in an Operator review read back from WordPress. Kept edits become Core's text at once.
   * Notes, "Fact:" Notes and the edits themselves go into a review round that Core analyses and
   * shows as a Review summary; nothing is revised or recorded as fact until the Operator decides.
   */
  async applyOperatorReview(context: WorkflowContext, version: number, actor: Actor, feedback: OperatorFeedback) {
    const state = await this.current(context, version);
    if (actor.role !== "operator" || actor.simulated !== (state.mode === "fixture") || !actor.authority) throw new IntakeError("unavailable", 403);
    if (state.work || state.failure || !state.pages.length || state.revisionRequest?.batch === "pending" ||
        ["analysing", "summary"].includes(state.reviewRounds?.at(-1)?.status ?? "")) throw new IntakeError("workflow_not_ready", 409);
    const view = this.view(context, state)!;
    const pages = applyOperatorEdits(context, view, feedback);
    const factPattern = /^\s*fact\s*:\s*/iu;
    const factNotes = feedback.notes.filter(note => factPattern.test(note.text));
    const pageNotes = feedback.notes.filter(note => newPagePattern.test(note.text));
    const revisionNotes = { ...feedback, notes: feedback.notes.filter(note => !factPattern.test(note.text) && !newPagePattern.test(note.text)) };
    const concerns = operatorConcerns(revisionNotes);
    const paths = [...new Set(concerns.map(item => item.path))].filter(path => pages.some(page => page.path === path));
    const scoped = notedSections(context, view, revisionNotes, paths);
    const at = new Date(this.clock()).toISOString();
    const edits = [...feedback.titles.map(({ path, before, after }) => ({ path, before, after })),
      ...feedback.edits.map(({ path, before, after }) => ({ path, before, after }))];
    const hasRound = edits.length > 0 || feedback.notes.length > 0 || feedback.structural.length > 0;
    const review: WordPressReview = { at, actor, readbackRevision: feedback.readbackRevision, acknowledged: feedback.acknowledged,
      notes: feedback.notes.map(note => ({ id: note.id, path: note.path, text: note.text, revised: false })),
      keptEdits: feedback.edits.length + feedback.titles.length, revisedPaths: [], ...(hasRound && { deferNotes: true }) };
    const round: ReviewRound | null = hasRound ? { id: randomUUID(), at, actor, status: "analysing", edits,
      notes: revisionNotes.notes.map(({ id, path, text }) => ({ id, path, text })),
      factNotes: factNotes.map(({ id, path, text }) => ({ id, path, statement: text.replace(factPattern, "").trim() })).filter(note => note.statement),
      ...(pageNotes.length && { pageNotes: pageNotes.map(({ id, path, text }) => ({ id, path, request: text.replace(newPagePattern, "").trim().slice(0, 4000) }))
        .filter(note => note.request) }),
      concerns, keep: keptWording(feedback, paths),
      noteRevisions: paths.map(path => {
        const sections = scoped.find(item => item.path === path);
        return { path, indexes: sections?.indexes ?? [], source: "note" as const, factIds: [],
          reason: concerns.filter(item => item.path === path).map(item => item.concern).join(" ").slice(0, 2000) };
      }) } : null;
    return this.view(context, await this.store.append(context, version, { ...state, pages,
      wordpressReviews: [...state.wordpressReviews ?? [], review], ...(round && { reviewRounds: [...state.reviewRounds ?? [], round],
        changes: takeInRound(state.changes, round, version) }) }));
  }

  /**
   * The Operator's decision on a Review summary (owner decision, Nov 23). Confirmed facts become
   * owner-confirmed business knowledge in Core; approved revisions are queued, limited to their
   * sections. `summaryReview` records the WordPress content read back with the decision.
   */
  async decideReview(context: WorkflowContext, version: number, actor: Actor, decision: ReviewDecision,
    summaryReview: Pick<WordPressReview, "readbackRevision" | "acknowledged"> & { summaryNotes: { id: number; path: string; text: string; reply: string }[] }) {
    const state = await this.current(context, version);
    if (actor.role !== "operator" || actor.simulated !== (state.mode === "fixture") || !actor.authority) throw new IntakeError("unavailable", 403);
    const round = state.reviewRounds?.at(-1);
    if (!round || round.status !== "summary" || !round.analysis || state.work || state.failure) throw new IntakeError("workflow_not_ready", 409);
    if (!decision.approved) throw new IntakeError("invalid_request", 400);
    const at = new Date(this.clock()).toISOString();
    // The Operator's answers become Reviews of the round's Changes; what is recorded, added or
    // revised is read from the Change ledger, not from the summary's lists.
    let ledger: ChangeLedger;
    try {
      ledger = reviewRound(roundLedger(state.changes, round, version, state.pages), round, decision, actor, at, state.pages);
    } catch (error) {
      if (error instanceof RoundConflict) throw new IntakeError("draft_changed", 409);
      if (error instanceof ChangeError) throw new IntakeError("invalid_request", 400);
      throw error;
    }
    const outcome = approvedInRound(ledger, round.id);
    const confirmed = round.analysis.facts.filter(fact => outcome.facts.some(item => item.label === fact.id));
    const rejected = new Set(round.analysis.facts.filter(fact => !confirmed.includes(fact)).map(fact => fact.id));
    const facts: BusinessFact[] = confirmed.map(fact => {
      const item = outcome.facts.find(entry => entry.label === fact.id)!;
      return { id: round.id + ":" + fact.id, statement: item.statement, publicUse: fact.publicUse, source: fact.source, roundId: round.id,
        confirmedBy: actor, at, corrected: item.corrected };
    });
    // New Pages the Operator asked for and did not leave out join the site plan with their brief.
    const added = (round.analysis.newPages ?? []).filter(page => outcome.pages.some(item => item.label === page.id) &&
      !state.blueprint?.pages.some(planned => planned.path === page.path));
    const proposed = [...round.noteRevisions, ...round.analysis.revisions];
    const approved = outcome.revisions.flatMap(item => proposed[item.index] ?? []).filter(revision => revision.source === "note" ||
      revision.factIds.some(id => confirmed.some(fact => fact.id === id)) || (revision.newPageIds ?? []).some(id => added.some(page => page.id === id)));
    const paths = [...new Set(approved.map(item => item.path))].filter(path => state.pages.some(page => page.path === path));
    const sections = paths.flatMap(path => {
      const own = approved.filter(item => item.path === path);
      return own.some(item => !item.indexes.length) ? [] : [{ path, indexes: [...new Set(own.flatMap(item => item.indexes))].sort((a, b) => a - b) }];
    });
    const statement = (id: string) => facts.find(fact => fact.id === round.id + ":" + id)?.statement;
    const concerns = [...round.concerns.filter(item => approved.some(revision => revision.source === "note" && revision.path === item.path)),
      ...approved.filter(revision => revision.source === "fact").map(revision => ({ path: revision.path,
        concern: "Confirmed business fact: " + revision.factIds.flatMap(id => statement(id) ?? []).join(" ") + " " + revision.reason })),
      ...approved.filter(revision => revision.source === "page").map(revision => ({ path: revision.path,
        concern: "New Page added to the site at the Operator's request: " + added.filter(page => revision.newPageIds?.includes(page.id))
          .map(page => `${page.label} (${page.path})`).join(", ") + ". " + revision.reason })),
      ...outcome.revisions.flatMap(item => approved.includes(proposed[item.index]) ? item.words.map(words =>
        ({ path: proposed[item.index].path, concern: "Operator note on the Review summary for this change: " + words })) : [])]
      .filter(item => paths.includes(item.path));
    const factNoteReply = (id: number) => {
      const note = round.factNotes.find(item => item.id === id);
      const fact = note && round.analysis!.facts.find(item => item.source.kind === "note" && item.source.text === note.statement);
      return fact && !rejected.has(fact.id) ? "MioPages Core recorded this in the business's Knowledge as a Proposed fact. The Client confirms it before anything is published."
        : "MioPages Core did not record this as a fact.";
    };
    const pageNoteReply = (id: number) => {
      const page = round.analysis!.newPages?.find(item => item.noteId === id);
      if (!page) return round.analysisNotes?.refusedPageNotes?.includes(id)
        ? "MioPages Core's plan for this page did not pass its checks, so no page was added. Add a new note starting New page: to try again."
        : "MioPages Core did not propose a page for this note; the Review summary says why.";
      return added.includes(page) ? `MioPages Core added the page "${page.label}" (${page.path}) in response to this note. Please review it.`
        : "MioPages Core did not add this page: it was left out on the Review summary.";
    };
    const extra = new Map(outcome.pages.map(item => [item.label, item.words]));
    const blueprint = added.length && state.blueprint ? { ...state.blueprint,
      pages: [...state.blueprint.pages, ...added.map(page => ({ path: page.path, label: page.label, purpose: page.purpose, sourceIds: page.sourceIds,
        decisionBrief: page.decisionBrief, operatorRequest: [page.request, ...extra.get(page.id) ?? []].join("\n\n") }))],
      navigation: [...state.blueprint.navigation, ...added.filter(page => page.navigation).map(page => page.path)] } : state.blueprint;
    const review: WordPressReview = { at, actor, readbackRevision: summaryReview.readbackRevision, acknowledged: summaryReview.acknowledged,
      notes: [...round.notes.map(note => ({ id: note.id, path: note.path, text: note.text, revised: paths.includes(note.path),
          ...(sections.some(item => item.path === note.path) && { sectionOnly: true }) })),
        ...round.factNotes.map(note => ({ id: note.id, path: note.path, text: note.statement, revised: false, reply: factNoteReply(note.id) })),
        ...(round.pageNotes ?? []).map(note => ({ id: note.id, path: note.path, text: note.request, revised: false, reply: pageNoteReply(note.id) })),
        ...summaryReview.summaryNotes.map(note => ({ id: note.id, path: note.path, text: note.text, revised: false, reply: note.reply }))],
      keptEdits: 0, revisedPaths: paths };
    const revision = paths.length ? {
      revisionRequest: { paths, audit: { summary: "Operator review in WordPress", concerns }, priorPages: state.pages.filter(page => paths.includes(page.path)),
        actor, at, ordinal: revisionOrdinal(state), source: "operator-review" as const, keep: round.keep.filter(item => paths.includes(item.path)), sections },
      editorial: null, operatorReview: null,
    } : added.length ? { editorial: null, operatorReview: null } : {};
    // Approved facts go into the one Knowledge. A Specialist introduced them (their edits and
    // Notes), so they are Proposed until the Client confirms them (Principal, Nov 24).
    const knowledgeFacts: Fact[] = facts.map(fact => ({ key: factKey(round.id.slice(0, 8), fact.id.slice(round.id.length + 1)),
      statement: fact.statement, publicUse: fact.publicUse, said: { kind: "specialist", person: actor.id },
      source: fact.id, enteredBy: actor.id }));
    return this.view(context, await this.store.atomic(context, async (store, client) => {
      if ((await store.read(context))?.version !== version) throw new IntakeError("draft_changed", 409);
      const receipt = knowledgeFacts.length ? await recordFacts(client, context.scope, knowledgeFacts, actor.id, at,
        `Facts from Operator review round ${round.id}, approved by ${actor.id}; Proposed until the Client confirms`) : undefined;
      return store.append(context, version, { ...state, ...revision, blueprint,
      pages: state.pages.filter(page => !paths.includes(page.path)), wordpressReviews: [...state.wordpressReviews ?? [], review],
      ...(receipt && { knowledge: [...state.knowledge ?? [], receipt] }),
      // Facts are recorded and pages added now; section and page revisions are applied when Core writes them.
      changes: appliedInRound(ledger, round.id, change => change.target.grain === "fact" ||
        (change.target.grain === "new-page" && added.some(page => page.path === change.target.path)), at, version + 1),
      // What was decided lives in the Change ledger (its Reviews); the round records only that it was decided.
      reviewRounds: [...state.reviewRounds!.slice(0, -1), { ...round, status: "decided" }] });
    }));
  }

  /**
   * Withdraw the Operator review just taken in, while nothing has run since: the case
   * returns exactly to its state before the take-in, and the withdrawn review stays on
   * record with who withdrew it and why. No AI call; WordPress is not touched.
   */
  async withdrawOperatorReview(context: WorkflowContext, version: number, actor: Actor, reason: string) {
    const state = await this.current(context, version);
    if (actor.role !== "operator" || actor.simulated !== (state.mode === "fixture") || !actor.authority) throw new IntakeError("unavailable", 403);
    const last = state.wordpressReviews?.at(-1);
    const before = version > 1 ? await this.store.readVersion(context, version - 1) : null;
    if (!last || state.work || state.revisionRequest?.source !== "operator-review" && last.revisedPaths.length ||
        !before || (before.wordpressReviews?.length ?? 0) !== state.wordpressReviews!.length - 1) throw new IntakeError("workflow_not_ready", 409);
    const { version: _previousVersion, ...restored } = before;
    // The withdrawn round stays in the Change ledger: its Requests withdrawn, its kept edits reverted.
    const withdrawnRound = (state.reviewRounds?.length ?? 0) > (before.reviewRounds?.length ?? 0) ? state.reviewRounds!.at(-1) : undefined;
    const changes = withdrawnRound && state.changes?.rounds.some(item => item.id === withdrawnRound.id)
      ? withdrawRound(state.changes, withdrawnRound.id, new Date(this.clock()).toISOString(), { id: actor.id, role: actor.role, simulated: actor.simulated })
      : restored.changes;
    return this.view(context, await this.store.append(context, version, { ...restored, ...(changes && { changes }),
      withdrawnReviews: [...state.withdrawnReviews ?? [], { ...last, withdrawnAt: new Date(this.clock()).toISOString(), withdrawnBy: actor,
        reason: text(reason, 500) }] }));
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
    const ordinal = revisionOrdinal(state) + 1;
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
    if (visuals.some(item => samePlacement(placement, item.placement) &&
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
        !samePlacement(presenceVisualPlacement(context, this.view(context, state)!, visual.placement.path,
          placedAt(visual.placement, state.pages.find(page => page.path === visual.placement.path)?.sections ?? [])), visual.placement) ||
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
      const approved = choices.find(value => placedAt(value.placement, view.pages.find(item => item.path === page.slug)?.sections ?? []) === index &&
        value.association?.assetId === image.assetId &&
        value.association?.usageId === image.usageId);
      const decision = approved?.decision, result = approved?.result;
      const currentSection = resolved.sections[index];
      const reviewedSection = reviewedPage.sections[index];
      if (!approved || !decision || !result || decision.scope !== "non-public-draft-only" ||
          decision.provenanceDigest !== result.provenanceDigest || decision.alt !== image.altText ||
          workDigest(reviewedSection) !== approved.placement.sectionDigest || currentSection.id !== section.id ||
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
    const imagePage = state.pages.find(page => page.path === image?.placement.path);
    const section = image && imagePage ? imagePage.sections[placedAt(image.placement, imagePage.sections)] : undefined;
    if (this.boundary !== "disposable" || !context.evaluation || !image?.result || !section ||
        workDigest(section) !== image.placement.sectionDigest || !this.operations.visuals) {
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
    const ordinal = replanOrdinal(state) + 1;
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
