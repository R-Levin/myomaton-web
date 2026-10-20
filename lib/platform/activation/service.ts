import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { fingerprint, object, text, uuid } from "../canonical/model";
import { questionsFor } from "../intake/model";
import type { Submission } from "../reviews/model";
import { approvedReview, type ApprovedReviewSource } from "./review-source";
import { assessment, commercial, digest, initialAssessment, same, scope, source, type Authority, type CaseState, type CreateCase, type Operation, type OperatorAuthority, type ReviewBinding, type Scope, type Source } from "./model";

export type CaseIdentity = { id: string; scope: Scope; source: Source; review: ReviewBinding | null; createdAt: string; createdBy: string; authorityReference: string };
export type CaseEvent = { version: number; requestId: string; requestDigest: string; operation: string; actor: string; authorityReference: string; at: string; previous: string | null; snapshot: CaseState; digest: string };
export type CaseInspection = CaseIdentity & { version: number; state: CaseState; history: CaseEvent[] };
type CaseRow = { id: string; web_presence_id: string; managed_site_id: string; pending_customer_id: string; submission_id: string; source: Source; review: ReviewBinding | null; request_id: string; request_digest: string; created_by: string; authority_reference: string; created_at: Date };

// Private trusted service API; deliberately no HTTP/Server Action exposure or default
// authority. This slice refuses shared/public schemas even if a caller has a DB URL.
export class ActivationService {
  constructor(private pool: Pool, private authority: OperatorAuthority, private reviews: ApprovedReviewSource) {}
  private async transaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      const schema = (await c.query("SELECT current_schema() s")).rows[0].s;
      if (process.env.NODE_ENV === "production" || !/^canonical_test_[a-f0-9]{32}_intake$/.test(schema)) throw Error("Activation requires an isolated disposable schema; shared/production activation is not authorized");
      // Never fall through to public if an expected private relation is missing.
      await c.query(`SET LOCAL search_path="${schema}"`);
      const result = await fn(c); await c.query("COMMIT"); return result;
    } catch (error) { await c.query("ROLLBACK"); throw error; } finally { c.release(); }
  }
  private async authorize(context: unknown, op: Operation, owner: Scope): Promise<Authority> {
    if (!this.authority || typeof this.authority.authorize !== "function") throw Error("Operator authority required");
    const grant = await this.authority.authorize(context, op, structuredClone(owner));
    object(grant, ["operatorId", "authorityReference"]);
    return { operatorId: text(grant.operatorId, 200), authorityReference: text(grant.authorityReference, 300) };
  }
  private async submission(c: PoolClient, id: string, owner: Scope): Promise<Submission> {
    const r = (await c.query(`SELECT s.* FROM prospect_intake_submissions s JOIN prospect_intakes i ON i.id=s.intake_id AND i.web_presence_id=s.web_presence_id
      WHERE s.id=$1 AND s.web_presence_id=$2 AND i.managed_site_id=$3 AND s.state='submitted' AND i.state='needs_operator_review'`, [uuid(id), owner.webPresenceId, owner.managedSiteId])).rows[0];
    if (!r) throw Error("Owned immutable submitted intake required");
    const s: Submission = { id: r.id, intake_id: r.intake_id, web_presence_id: r.web_presence_id, entry_intent: r.entry_intent, questionnaire_version: r.questionnaire_version, draft_version: r.draft_version, answers: r.answers, provenance: r.provenance, digest: r.digest, submitted_at: r.submitted_at.toISOString() };
    questionsFor(s.questionnaire_version); source(s); return s;
  }
  private async row(c: PoolClient, id: string, owner: Scope): Promise<CaseRow> {
    const r = (await c.query("SELECT * FROM activation_cases WHERE id=$1 AND web_presence_id=$2 AND managed_site_id=$3 AND pending_customer_id=$4 FOR UPDATE", [uuid(id), owner.webPresenceId, owner.managedSiteId, owner.pendingCustomerId])).rows[0];
    if (!r) throw Error("Activation case scope mismatch"); return r;
  }
  private async inspectRow(c: PoolClient, r: CaseRow): Promise<CaseInspection> {
    const history: CaseEvent[] = (await c.query("SELECT * FROM activation_case_events WHERE case_id=$1 ORDER BY version", [r.id])).rows.map(e => ({ version: e.version, requestId: e.request_id, requestDigest: e.request_digest, operation: e.operation, actor: e.actor, authorityReference: e.authority_reference, at: e.at.toISOString(), previous: e.previous, snapshot: e.snapshot, digest: e.digest }));
    let previous: string | null = null;
    for (const [i, event] of history.entries()) { const { digest: hash, ...body } = event; if (event.version !== i + 1 || event.previous !== previous || fingerprint({ caseId: r.id, ...body }) !== hash) throw Error("Activation history integrity failure"); previous = hash; }
    if (!history.length) throw Error("Activation history missing");
    return { id: r.id, scope: { webPresenceId: r.web_presence_id, managedSiteId: r.managed_site_id, pendingCustomerId: r.pending_customer_id }, source: r.source, review: r.review, createdAt: r.created_at.toISOString(), createdBy: r.created_by, authorityReference: r.authority_reference, version: history.length, state: history.at(-1)!.snapshot, history };
  }
  private async append(c: PoolClient, id: string, history: CaseEvent[], requestId: string, requestDigest: string, operation: string, actor: Authority, snapshot: CaseState) {
    const body = { version: history.length + 1, requestId, requestDigest, operation, actor: actor.operatorId, authorityReference: actor.authorityReference, at: new Date().toISOString(), previous: history.at(-1)?.digest ?? null, snapshot };
    await c.query("INSERT INTO activation_case_events(case_id,version,request_id,request_digest,operation,actor,authority_reference,at,previous,snapshot,digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", [id, body.version, requestId, requestDigest, operation, body.actor, body.authorityReference, body.at, body.previous, snapshot, fingerprint({ caseId: id, ...body })]);
  }
  async create(context: unknown, input: CreateCase): Promise<CaseInspection> {
    input = structuredClone(input);
    object(input, ["requestId", "scope", "submissionId", "submissionDigest", "review"]);
    const owner = scope(input.scope), requestId = uuid(input.requestId), submissionId = uuid(input.submissionId);
    digest(input.submissionDigest);
    if (input.review) { object(input.review, ["id", "revision", "digest"]); uuid(input.review.id); digest(input.review.digest); if (!Number.isSafeInteger(input.review.revision) || input.review.revision < 1) throw Error("Exact Review revision required"); }
    const actor = await this.authorize(context, "create", owner), requestDigest = fingerprint(input);
    return this.transaction(async c => {
      // Serialize concurrent create/retry for the same source, including different request IDs.
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [submissionId]);
      const existing: CaseRow | undefined = (await c.query("SELECT * FROM activation_cases WHERE submission_id=$1 OR (web_presence_id=$2 AND request_id=$3)", [submissionId, owner.webPresenceId, requestId])).rows[0];
      if (existing) {
        if (existing.request_id !== requestId || existing.request_digest !== requestDigest || existing.created_by !== actor.operatorId || !same(owner, { webPresenceId: existing.web_presence_id, managedSiteId: existing.managed_site_id, pendingCustomerId: existing.pending_customer_id })) throw Error("Duplicate activation creation conflict");
        return this.inspectRow(c, existing);
      }
      const s = await this.submission(c, submissionId, owner); if (s.digest !== input.submissionDigest) throw Error("Source digest mismatch");
      const review = input.review ? await approvedReview(this.reviews, input.review, owner, s) : null;
      const id = randomUUID();
      const r: CaseRow = (await c.query("INSERT INTO activation_cases(id,web_presence_id,managed_site_id,pending_customer_id,submission_id,source,review,request_id,request_digest,created_by,authority_reference) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *", [id, owner.webPresenceId, owner.managedSiteId, owner.pendingCustomerId, s.id, source(s), review, requestId, requestDigest, actor.operatorId, actor.authorityReference])).rows[0];
      await this.append(c, id, [], requestId, requestDigest, "create", actor, { status: "PENDING_COMMERCIAL", commercial: null, assessment: initialAssessment(s) });
      return this.inspectRow(c, r);
    });
  }
  async inspect(context: unknown, id: string, selection: Scope) {
    const owner = scope(selection); await this.authorize(context, "inspect", owner);
    return this.transaction(async c => this.inspectRow(c, await this.row(c, id, owner)));
  }
  async update(context: unknown, id: string, selection: Scope, expectedVersion: number, requestId: string, operation: "confirm-commercial" | "assess", value: unknown): Promise<CaseInspection> {
    value = structuredClone(value);
    const owner = scope(selection); uuid(requestId);
    if (!["confirm-commercial", "assess"].includes(operation) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw Error("Invalid operation/version");
    const actor = await this.authorize(context, operation, owner), requestDigest = fingerprint({ id, owner, expectedVersion, operation, value });
    return this.transaction(async c => {
      const r = await this.row(c, id, owner), current = await this.inspectRow(c, r);
      const retry = current.history.find(e => e.requestId === requestId);
      if (retry) { if (retry.requestDigest !== requestDigest || retry.actor !== actor.operatorId) throw Error("Request idempotency conflict"); return current; }
      if (current.version !== expectedVersion) throw Error("Stale activation version");
      const state = structuredClone(current.state);
      if (operation === "confirm-commercial") {
        const confirmation = commercial(value, actor);
        if (state.commercial) { if (!same(state.commercial, confirmation)) throw Error("Conflicting commercial confirmation"); return current; }
        state.commercial = confirmation; state.status = "AUTHORIZED_FOR_ONBOARDING";
      } else {
        const s = await this.submission(c, r.submission_id, owner);
        const assessed = assessment(value, s, actor, new Date().toISOString());
        if (assessed.some(a => a.state === "CONFIRMED")) {
          const confirmer = await this.authorize(context, "confirm-information", owner);
          if (confirmer.operatorId !== actor.operatorId) throw Error("Information confirmation authority identity mismatch");
        }
        state.assessment = assessed;
      }
      await this.append(c, id, current.history, requestId, requestDigest, operation, actor, state);
      return this.inspectRow(c, r);
    });
  }
}

export function inspectionText(c: CaseInspection): string {
  return `Activation case ${c.id}\nSource path: ${c.source.path}\nSubmission: ${c.source.submissionId} (${c.source.questionnaireVersion}, ${c.source.digest})\nReview: ${c.review ? `${c.review.id} revision ${c.review.revision}, ${c.review.digest}` : "none (not required)"}\nScope: ${JSON.stringify(c.scope)}\nStatus: ${c.state.status}\nCommercial: ${JSON.stringify(c.state.commercial)}\nInformation assessment (references only, no automatic canonical promotion):\n${c.state.assessment.map(a => `- ${a.area}: ${a.state}; ${JSON.stringify(a)}`).join("\n")}\nHistory:\n${c.history.map(e => `- v${e.version} ${e.operation} by ${e.actor} (${e.authorityReference}) at ${e.at}; ${e.digest}`).join("\n")}\n`;
}
