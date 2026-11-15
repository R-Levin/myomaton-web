import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { fingerprint, object, text } from "../canonical/model";
import type { DeploymentSelection } from "../managed-sites/deployment";
import type { EntryIntent } from "./model";
import { IntakeError } from "./model";
import {
  readBlueprint, readDirection, readEditorial, readPage, readReport, type PresenceEvidence,
  type WorkflowBlueprint, type WorkflowDirection, type WorkflowEditorial, type WorkflowPage, type WorkflowReport,
} from "./presence-workflow-artifacts";

export type WorkflowContext = {
  scope: DeploymentSelection;
  intakeId: string;
  entry: EntryIntent;
  evidence: PresenceEvidence[];
  limitations: string[];
  conflicts: string[];
};
export type WorkflowOperation = "research" | "report" | "direction" | "blueprint" | "page" | "editorial";
type Actor = { id: string; role: "customer" | "operator"; simulated: boolean };
type Work = {
  operation: WorkflowOperation;
  path?: string;
  attempt: string;
  until: number;
  inputDigest: string;
};
type Failure = "operation-blocked" | "output-invalid" | "outcome-unknown";
type Decision = { actor: Actor; at: string; target: string; decision: "confirmed" | "reviewed" };
type Correction = { finding: WorkflowReport["findings"][number]; text: string; reportDigest: string; actor: Actor; at: string };
type State = {
  version: number;
  contextDigest: string;
  sourceSnapshot: Pick<WorkflowContext, "evidence" | "limitations" | "conflicts" | "entry">;
  mode: "fixture" | "provider";
  research: PresenceEvidence[] | null;
  report: WorkflowReport | null;
  confirmation: Decision | null;
  corrections: Correction[];
  direction: WorkflowDirection | null;
  blueprint: WorkflowBlueprint | null;
  pages: WorkflowPage[];
  editorial: WorkflowEditorial | null;
  operatorReview: Decision | null;
  work: Work | null;
  failure: Failure | null;
};
type Task = Pick<Work, "operation" | "path">;
export type WorkflowInput = Pick<State, "research" | "report" | "corrections" | "direction" | "blueprint" | "pages"> &
  Pick<WorkflowContext, "entry" | "evidence" | "limitations" | "conflicts">;
export type WorkflowRun = { context: WorkflowContext; input: WorkflowInput; work: Work };
export interface PresenceWorkflowOperations {
  readonly mode: State["mode"];
  run(run: WorkflowRun, retain: (bytes: Buffer) => Promise<void>): Promise<unknown>;
  recover(run: WorkflowRun, bytes: Buffer): Promise<unknown>;
}

export class WorkflowBlocked extends Error {}
const contentDigest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const identity = ({ scope, intakeId }: WorkflowContext) => [scope.webPresenceId, scope.managedSiteId, intakeId];

class WorkflowStore {
  constructor(private pool: Pool) {}

  async read(context: WorkflowContext): Promise<State | null> {
    const { rows: [row] } = await this.pool.query<{ payload: State; digest: string }>(`
      SELECT payload, digest FROM presence_workflow_events
      WHERE web_presence_id=$1 AND managed_site_id=$2 AND intake_id=$3
      ORDER BY version DESC LIMIT 1`, identity(context));
    if (!row) return null;
    if (fingerprint(row.payload) !== row.digest) throw new IntakeError("unavailable", 503);
    return row.payload;
  }

  async append(context: WorkflowContext, previous: number, next: Omit<State, "version">) {
    const state = { ...next, version: previous + 1 };
    const { rowCount } = await this.pool.query(`
      INSERT INTO presence_workflow_events (web_presence_id,managed_site_id,intake_id,version,payload,digest)
      SELECT web_presence_id, managed_site_id, id, $4::int, $5::jsonb, $6
      FROM prospect_intakes
      WHERE web_presence_id=$1 AND managed_site_id=$2 AND id=$3
      AND $4::int = 1 + COALESCE((SELECT max(version) FROM presence_workflow_events
        WHERE web_presence_id=$1 AND managed_site_id=$2 AND intake_id=$3), 0)
      ON CONFLICT DO NOTHING`, [...identity(context), state.version, JSON.stringify(state), fingerprint(state)]);
    if (rowCount !== 1) throw new IntakeError("draft_changed", 409);
    return state;
  }

  async retain(context: WorkflowContext, work: Work, bytes: Buffer) {
    const digest = contentDigest(bytes);
    await this.pool.query(`
      INSERT INTO presence_workflow_outputs (web_presence_id,managed_site_id,intake_id,attempt_id,bytes,digest)
      SELECT web_presence_id,managed_site_id,id,$4,$5,$6 FROM prospect_intakes
      WHERE web_presence_id=$1 AND managed_site_id=$2 AND id=$3
      ON CONFLICT DO NOTHING`, [...identity(context), work.attempt, bytes, digest]);
    if (contentDigest((await this.output(context, work)) ?? Buffer.alloc(0)) !== digest) throw Error("Conflicting retained output");
  }

  async output(context: WorkflowContext, work: Work) {
    const { rows: [row] } = await this.pool.query<{ bytes: Buffer; digest: string }>(`
      SELECT bytes, digest FROM presence_workflow_outputs
      WHERE web_presence_id=$1 AND managed_site_id=$2 AND intake_id=$3 AND attempt_id=$4`, [...identity(context), work.attempt]);
    if (!row) return null;
    if (contentDigest(row.bytes) !== row.digest) throw Error("Retained output integrity failed");
    return row.bytes;
  }
}

function nextTask(state: State): Task | null {
  if (!state.research) return { operation: "research" };
  if (!state.report) return { operation: "report" };
  if (!state.confirmation) return null;
  if (!state.direction) return { operation: "direction" };
  if (!state.blueprint) return { operation: "blueprint" };
  const missing = state.blueprint.pages.find(page => !state.pages.some(draft => draft.path === page.path));
  if (missing) return { operation: "page", path: missing.path };
  if (!state.editorial) return { operation: "editorial" };
  return null;
}
function runInput(context: WorkflowContext, state: State): WorkflowInput {
  const { entry, evidence, limitations, conflicts } = context;
  const { report, research, direction, blueprint, pages, corrections } = state;
  return { entry, evidence, limitations, conflicts, report, research, direction, blueprint, pages, corrections };
}
function readResearch(value: unknown, ids: readonly string[]): PresenceEvidence[] {
  if (!Array.isArray(value) || !value.length) throw Error("Research record is incomplete");
  const seen = new Set(ids);
  return value.map(item => {
    const record = object(item, ["id", "kind", "label", "reference", "date", "content", "rawDigest"]);
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
      content: text(record.content, Infinity, true), ...(rawDigest && { rawDigest }) };
  });
}

export class PresenceWorkflow {
  private store: WorkflowStore;

  constructor(pool: Pool, private operations: PresenceWorkflowOperations,
    private destinations: Parameters<typeof readPage>[4] = {}, private clock = Date.now) {
    this.store = new WorkflowStore(pool);
  }

  async review(context: WorkflowContext) {
    return this.view(context, await this.store.read(context));
  }

  private view(context: WorkflowContext, state: State | null) {
    if (!state) return null;
    const current = state.contextDigest === fingerprint(context);
    const next = !current ? "evidence-changed" : state.failure ? "recover" : state.work ? "in-progress" :
      nextTask(state)?.operation ?? (!state.confirmation ? "customer-review" : !state.operatorReview ? "operator-review" : "review-complete");
    const { research, report, confirmation, corrections, direction, blueprint, pages, editorial, operatorReview, version, mode, failure } = state;
    return { version, mode, research, report, confirmation, corrections, direction, blueprint, pages, editorial, operatorReview,
      failure, next, recoverable: current && Boolean(state.work && (state.failure || state.work.until <= this.clock())),
      sources: state.sourceSnapshot.evidence, limitations: state.sourceSnapshot.limitations,
      conflicts: state.sourceSnapshot.conflicts, entry: state.sourceSnapshot.entry };
  }

  async start(context: WorkflowContext) {
    const existing = await this.store.read(context);
    if (existing) return this.view(context, existing);
    if (!context.evidence.length || new Set(context.evidence.map(source => source.id)).size !== context.evidence.length) {
      throw new IntakeError("invalid_request");
    }
    const state = await this.store.append(context, 0, {
      contextDigest: fingerprint(context), sourceSnapshot: { evidence: context.evidence, limitations: context.limitations,
        conflicts: context.conflicts, entry: context.entry }, mode: this.operations.mode, research: null, report: null, corrections: [],
      confirmation: null, direction: null, blueprint: null, pages: [], editorial: null, operatorReview: null,
      work: null, failure: null,
    });
    return this.view(context, state);
  }

  private async current(context: WorkflowContext, version: number) {
    const state = await this.store.read(context);
    if (!state || state.version !== version || state.contextDigest !== fingerprint(context) || state.mode !== this.operations.mode) {
      throw new IntakeError("draft_changed", 409);
    }
    return state;
  }

  async advance(context: WorkflowContext, version: number) {
    const state = await this.current(context, version);
    const task = nextTask(state);
    if (!task || state.work) throw new IntakeError("workflow_not_ready", 409);
    const input = runInput(context, state);
    const work = { ...task, attempt: randomUUID(), until: this.clock() + 180_000, inputDigest: fingerprint(input) };
    const claimed = await this.store.append(context, version, { ...state, work });
    const run = { context, input, work };
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

  private async fail(context: WorkflowContext, state: State, failure: Failure) {
    return this.view(context, state.failure === failure ? state : await this.store.append(context, state.version, { ...state, failure }));
  }

  private async settle(context: WorkflowContext, state: State, output: unknown) {
    const work = state.work!;
    const sources = [...context.evidence, ...state.research ?? []];
    const ids = sources.map(source => source.id);
    const paths = state.blueprint?.pages.map(page => page.path) ?? [];
    let next: State;
    try {
      switch (work.operation) {
        case "research": next = { ...state, research: readResearch(output, ids) }; break;
        case "report": next = { ...state, report: readReport(output, sources) }; break;
        case "direction": next = { ...state, direction: readDirection(output, ids) }; break;
        case "blueprint": next = { ...state, blueprint: readBlueprint(output, ids) }; break;
        case "page": next = { ...state, pages: [...state.pages, readPage(output, work.path!, paths, ids, this.destinations)] }; break;
        case "editorial": next = { ...state, editorial: readEditorial(output, paths) }; break;
      }
    } catch { return this.fail(context, state, "output-invalid"); }
    return this.view(context, await this.store.append(context, state.version, { ...next, work: null, failure: null }));
  }

  async correctReport(context: WorkflowContext, version: number, finding: string, correction: unknown, actor: Actor) {
    const state = await this.current(context, version);
    if (actor.role !== "customer" || actor.simulated !== (state.mode === "fixture")) throw new IntakeError("unavailable", 403);
    const priorFinding = state.report?.findings.find(item => item.id === finding);
    if (state.work || !state.report || !priorFinding) throw new IntakeError("workflow_not_ready", 409);
    const note = { finding: priorFinding, text: text(correction, 8_000, true), actor,
      reportDigest: fingerprint(state.report), at: new Date(this.clock()).toISOString() };
    return this.view(context, await this.store.append(context, version, { ...state,
      corrections: [...state.corrections.filter(item => item.finding.id !== finding), note],
      report: null, confirmation: null, direction: null, blueprint: null, pages: [], editorial: null, operatorReview: null,
    }));
  }

  async confirmReport(context: WorkflowContext, version: number, actor: Actor) {
    const state = await this.current(context, version);
    if (actor.role !== "customer" || actor.simulated !== (state.mode === "fixture")) throw new IntakeError("unavailable", 403);
    if (!state.report || state.confirmation || state.work) throw new IntakeError("workflow_not_ready", 409);
    const confirmation = { actor, at: new Date(this.clock()).toISOString(), target: fingerprint(state.report), decision: "confirmed" } as const;
    return this.view(context, await this.store.append(context, version, { ...state, confirmation }));
  }

  async reviewCandidate(context: WorkflowContext, version: number, actor: Actor) {
    const state = await this.current(context, version);
    if (actor.role !== "operator" || actor.simulated !== (state.mode === "fixture")) throw new IntakeError("unavailable", 403);
    if (!state.editorial || state.work || state.operatorReview) throw new IntakeError("workflow_not_ready", 409);
    const target = fingerprint({ confirmation: state.confirmation?.target, direction: state.direction, blueprint: state.blueprint,
      pages: state.pages, editorial: state.editorial });
    const operatorReview = { actor, at: new Date(this.clock()).toISOString(), target, decision: "reviewed" } as const;
    return this.view(context, await this.store.append(context, version, { ...state, operatorReview }));
  }
}

export type PresenceWorkflowView = NonNullable<Awaited<ReturnType<PresenceWorkflow["review"]>>>;
