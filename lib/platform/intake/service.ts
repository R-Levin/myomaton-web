import { createHash, randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { DeploymentSelection } from "../managed-sites/deployment";
import { fingerprint } from "../canonical/model";
import { IntakeError, intakeVersion, legacyIntakeVersion, normalizeAnswers, questionErrors, questionsFor, validateComplete, type Answers, type EntryIntent } from "./model";
import { onboardingVersion } from "./onboarding";
import { adaptiveFoundationErrors, adaptiveOfferStep, adaptiveOnboardingVersion, adaptiveQuestions, adaptiveScopeStep, prospectPriorities, type PreparedUnderstanding } from "./adaptive";
import type { OnboardingEntry } from "../activation/service";
import type { InterviewState } from "./intelligent-model";

const intelligentVersion = "paid-onboarding/3";

export const draftDays = 30, submissionDays = 90;
export const newResumeToken = () => randomBytes(32).toString("hex");
export function resumeHash(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new IntakeError("session_unavailable", 404);
  return createHash("sha256").update(token).digest("hex");
}
type Row = { id: string; entry_intent: EntryIntent; questionnaire_version: string; state: "draft" | "needs_operator_review"; answers: Answers; provenance: Record<string, unknown>; step: number; version: number; expires_at: Date; submitted_at: Date | null };
export type IntakeEvidence = { source: "c0-discovery" | "rehearsal-response"; confirmation: "prior-approved" | "unconfirmed"; suppliedAt: string; reference: string; author: string };
export type IntakeView = { questionnaireVersion: string; intent: EntryIntent; state: Row["state"]; answers: Answers; step: number; version: number; expiresAt: string;
  provenance?: Record<string, IntakeEvidence>; prepared?: PreparedUnderstanding; submission?: { digest: string; submittedAt: string };
  planningEvidence?: { version: number; evidenceDigest: string }; interview?: InterviewState };
type Rehearsal = { database: string; answers: Answers; provenance: Record<string, IntakeEvidence>; prepared?: PreparedUnderstanding; intelligentFixtureSchema?: string; step?: number;
  protectedScope?: (db: Pick<PoolClient, "query">) => Promise<void> };
function view(r: Row): IntakeView { return { questionnaireVersion: r.questionnaire_version, intent: r.entry_intent, state: r.state, answers: r.answers, step: r.step, version: r.version, expiresAt: r.expires_at.toISOString() }; }
async function transaction<T>(pool: Pool, run: (db: PoolClient) => Promise<T>) {
  const db = await pool.connect();
  try { await db.query("BEGIN"); const result = await run(db); await db.query("COMMIT"); return result; }
  catch (error) { await db.query("ROLLBACK"); throw error; }
  finally { db.release(); }
}
export class IntakeService {
  constructor(readonly pool: Pool, readonly selection: DeploymentSelection, private readonly rehearsal?: Rehearsal) {}
  private get draftTable() { return this.rehearsal?.protectedScope ? "miopages_wp.core_development_drafts" : "prospect_intakes"; }
  get isOnboarding() { return Boolean(this.rehearsal); }
  get onboardingCookie() {
    const scenario = this.rehearsal?.prepared?.scenario;
    return scenario ? "miopages_adaptive_" + scenario : "miopages_c0_onboarding";
  }
  private get paidVersion() { return this.rehearsal?.prepared ? adaptiveOnboardingVersion : onboardingVersion; }
  private get preparedDigest() { return this.rehearsal?.prepared ? fingerprint(this.rehearsal.prepared) : undefined; }
  private assertPrepared(row: Row) {
    if (this.rehearsal?.prepared && row.provenance.preparedDigest !== this.preparedDigest) throw new IntakeError("prepared_source_changed", 409);
  }
  private checkAdaptiveProgress(row: Row, answers: Answers, step: number, prepared: PreparedUnderstanding) {
    if (step > row.step + 1 || (!prepared.foundationGap && answers.foundationGoal)) throw new IntakeError("invalid_request");
    const changed = (key: string) => fingerprint(answers[key] ?? null) !== fingerprint(row.answers[key] ?? null);
    if (answers.rehearsalCommitment && changed("rehearsalCommitment") && row.step !== adaptiveScopeStep) throw new IntakeError("invalid_request");
    const foundationChanged = adaptiveQuestions[0].fields.some(field => changed(field.key));
    if (foundationChanged) delete answers.rehearsalCommitment;
    if ((!row.answers.rehearsalCommitment || foundationChanged) &&
        adaptiveQuestions.slice(adaptiveOfferStep).some(question => question.fields.some(field => changed(field.key)))) throw new IntakeError("scope_review_required", 409);
    const errors = {
      ...(step >= adaptiveScopeStep && { ...questionErrors(0, answers, adaptiveOnboardingVersion), ...adaptiveFoundationErrors(prepared, answers) }),
      ...(step >= adaptiveOfferStep && questionErrors(adaptiveScopeStep, answers, adaptiveOnboardingVersion)),
    };
    if (Object.keys(errors).length) throw new IntakeError("incomplete", 400, errors);
  }
  private async scope(db: Pick<PoolClient, "query">, lock = false, intelligent = false) {
    if (this.rehearsal?.protectedScope) {
      await this.rehearsal.protectedScope(db);
      return;
    }
    if (this.rehearsal) {
      const { database, schema, host, port } = (await db.query("SELECT current_database() AS database, current_schema() AS schema, host(inet_server_addr()) AS host, inet_server_port() AS port")).rows[0];
      const fixtureSchema = intelligent ? this.rehearsal.intelligentFixtureSchema : undefined;
      if (fixtureSchema !== undefined && !/^canonical_test_[a-f0-9]{32}_intake$/.test(fixtureSchema)) throw new IntakeError("unavailable", 503);
      if (!/^migration_rehearsal_[a-f0-9]{32}$/.test(database) || database !== this.rehearsal.database || schema !== (fixtureSchema ?? "public") || host !== "127.0.0.1" || !port || port === 5432) throw new IntakeError("unavailable", 503);
    }
    const { webPresenceId, managedSiteId } = this.selection;
    const r = await db.query(`SELECT m.id FROM managed_sites m JOIN web_presences w ON w.id=m.web_presence_id WHERE m.id=$1 AND w.id=$2 AND m.status='active' AND w.status='active' ${lock ? "FOR SHARE OF m,w" : ""}`, [managedSiteId, webPresenceId]);
    if (r.rows.length !== 1) throw new IntakeError("unavailable", 404);
  }
  private async owned(db: Pick<PoolClient, "query">, token: string, lock = false, versions = this.rehearsal ? [this.paidVersion] : [legacyIntakeVersion, intakeVersion], intelligent = false): Promise<Row> {
    await this.scope(db, lock, intelligent);
    const r = await db.query(`SELECT * FROM ${this.draftTable} WHERE web_presence_id=$1 AND managed_site_id=$2 AND resume_hash=$3 AND expires_at>now() AND resume_expires_at>now() ${lock ? "FOR UPDATE" : ""}`, [this.selection.webPresenceId, this.selection.managedSiteId, resumeHash(token)]);
    if (r.rows.length !== 1) throw new IntakeError("session_unavailable", 404);
    if (!versions.includes(r.rows[0].questionnaire_version)) throw new IntakeError("session_unavailable", 404);
    return r.rows[0];
  }
  private async insertDraft(db: PoolClient, token: string, intent: EntryIntent, version: string) {
    return db.query(`INSERT INTO ${this.draftTable}(web_presence_id,managed_site_id,entry_intent,questionnaire_version,resume_hash,expires_at,resume_expires_at)
      VALUES($1,$2,$3,$4,$5,now()+interval '30 days',now()+interval '30 days') ON CONFLICT DO NOTHING`, [this.selection.webPresenceId, this.selection.managedSiteId, intent, version, resumeHash(token)]);
  }
  // The caller supplies the transaction and verified entry from ActivationService.
  // The browser intake routes have no access to this draft version.
  async intelligentDraft(db: PoolClient, entry: OnboardingEntry, token: string, sourceDigest: string, open: boolean,
    change?: (state: InterviewState, version: number) => InterviewState) {
    if (process.env.NODE_ENV === "production" || !this.rehearsal || this.rehearsal.prepared ||
        entry.scope.webPresenceId !== this.selection.webPresenceId || entry.scope.managedSiteId !== this.selection.managedSiteId) {
      throw new IntakeError("unavailable", 503);
    }
    await this.scope(db, true, true);
    const inserted = open && (await this.insertDraft(db, token, entry.source.path, intelligentVersion)).rowCount === 1;
    const row = await this.owned(db, token, true, [intelligentVersion], true);
    if (row.state !== "draft" || row.entry_intent !== entry.source.path) throw new IntakeError("session_unavailable", 404);
    const binding = fingerprint(entry);
    const prior = row.provenance.intelligent as { binding: string; sourceDigest: string; state: InterviewState } | undefined;
    if (!inserted && (prior?.binding !== binding || prior.sourceDigest !== sourceDigest)) throw new IntakeError("prepared_source_changed", 409);
    const current: InterviewState = prior?.state ?? { turns: [], pending: null, failure: null };
    if (!inserted && !change) return { version: row.version, state: current };
    const state = change ? change(current, row.version) : current;
    const record = JSON.stringify({ intelligent: { binding, sourceDigest, state } });
    // Reserve room for JSONB serialization and stay under both existing bounds.
    if (Buffer.byteLength(record) > 12_000) throw new IntakeError("payload_too_large", 413);
    await db.query("UPDATE prospect_intakes SET provenance=$2,version=version+1,updated_at=now() WHERE id=$1", [row.id, record]);
    return { version: row.version + 1, state };
  }
  private async readView(db: Pick<PoolClient, "query">, row: Row): Promise<IntakeView> {
    if (!this.rehearsal) return view(row);
    this.assertPrepared(row);
    const provenance = { ...row.provenance };
    delete provenance.preparedDigest;
    const interview = provenance.protectedInterview as InterviewState | undefined;
    delete provenance.protectedInterview;
    const result = { ...view(row), provenance: provenance as Record<string, IntakeEvidence>, prepared: this.rehearsal.prepared };
    if (this.rehearsal.step !== undefined) {
      return { ...result, ...(interview && { interview }), planningEvidence: { version: row.version, evidenceDigest: fingerprint({
        scope: { webPresenceId: this.selection.webPresenceId, managedSiteId: this.selection.managedSiteId },
        version: row.version, intent: row.entry_intent, answers: row.answers, provenance: row.provenance,
      }) } };
    }
    if (row.state !== "needs_operator_review") return result;
    const { rows } = await db.query("SELECT answers,provenance,digest,draft_version,submitted_at FROM prospect_intake_submissions WHERE intake_id=$1 AND web_presence_id=$2 AND questionnaire_version=$3", [row.id, this.selection.webPresenceId, row.questionnaire_version]);
    const snapshot = rows[0];
    if (!snapshot || snapshot.draft_version !== row.version - 1 || snapshot.digest !== fingerprint({ intent: row.entry_intent, questionnaireVersion: row.questionnaire_version, draftVersion: snapshot.draft_version, answers: row.answers, provenance: row.provenance }) ||
        fingerprint(snapshot.answers) !== fingerprint(row.answers) || fingerprint(snapshot.provenance) !== fingerprint(row.provenance)) throw new IntakeError("unavailable", 503);
    return { ...result, submission: { digest: snapshot.digest, submittedAt: snapshot.submitted_at.toISOString() } };
  }
  async resume(token: string) { return this.readView(this.pool, await this.owned(this.pool, token)); }
  async create(token: string, intent: EntryIntent) {
    if (!["FREE_REVIEW", "DIRECT_START"].includes(intent) || this.rehearsal && intent !== "DIRECT_START") throw new IntakeError("invalid_intent");
    return transaction(this.pool, async db => {
      await this.scope(db, true);
      const inserted = await this.insertDraft(db, token, intent, this.rehearsal ? this.paidVersion : intakeVersion);
      let r = await this.owned(db, token, true);
      if (r.entry_intent !== intent) throw new IntakeError("intent_conflict", 409);
      if (this.rehearsal && inserted.rowCount) {
        const answers = normalizeAnswers(this.rehearsal.answers, this.paidVersion);
        const provenance = { ...this.rehearsal.provenance, preparedDigest: this.preparedDigest };
        r = (await db.query(`UPDATE ${this.draftTable} SET answers=$2,provenance=$3,step=$4,version=version+1 WHERE id=$1 RETURNING *`,
          [r.id, JSON.stringify(answers), JSON.stringify(provenance), this.rehearsal.step ?? 0])).rows[0];
      }
      return this.readView(db, r);
    });
  }
  async save(token: string, version: number, value: unknown, step: number) {
    if (!Number.isInteger(version) || version < 1 || !Number.isInteger(step) || step < 0 || step > (this.rehearsal ? questionsFor(this.paidVersion).length : 12)) throw new IntakeError("invalid_request");
    return transaction(this.pool, async db => {
      const r = await this.owned(db, token, true);
      this.assertPrepared(r);
      if (r.state !== "draft") throw new IntakeError("already_submitted", 409);
      if ((r.provenance.protectedInterview as InterviewState | undefined)?.pending) throw new IntakeError("draft_changed", 409);
      const answers = normalizeAnswers(value, r.questionnaire_version);
      if (answers.sitePriority !== undefined && this.rehearsal?.step === undefined) throw new IntakeError("invalid_request");
      if (this.rehearsal) for (const key of Object.keys(answers)) if (answers[key] === "") delete answers[key];
      // Lost-response retries are idempotent; stale tabs cannot overwrite newer answers.
      if (fingerprint(r.answers) === fingerprint(answers) && r.step === step) return this.readView(db, r);
      if (r.version !== version) throw new IntakeError("draft_changed", 409);
      if (this.rehearsal?.prepared) this.checkAdaptiveProgress(r, answers, step, this.rehearsal.prepared);
      const provenance: Record<string, unknown> = {};
      if (this.rehearsal?.prepared) provenance.preparedDigest = r.provenance.preparedDigest;
      if (r.provenance.protectedInterview) provenance.protectedInterview = r.provenance.protectedInterview;
      const at = new Date().toISOString();
      for (const [key, value] of Object.entries(answers)) provenance[key] = fingerprint(r.answers[key] ?? null) === fingerprint(value) && r.provenance[key]
        ? r.provenance[key] : this.rehearsal ? { source: "rehearsal-response", confirmation: "unconfirmed", suppliedAt: at, reference: r.questionnaire_version, author: `rehearsal-customer:${r.id}` } : { source: "prospect-supplied", confirmation: "unconfirmed", suppliedAt: at };
      const saved = await db.query(`UPDATE ${this.draftTable} SET answers=$2,provenance=$3,step=$4,version=version+1,updated_at=now() WHERE id=$1 RETURNING *`, [r.id, JSON.stringify(answers), JSON.stringify(provenance), step]);
      return this.readView(db, saved.rows[0]);
    });
  }
  async saveSitePriority(token: string, version: number, priority: unknown) {
    if (this.rehearsal?.step === undefined || this.rehearsal.prepared?.scenario !== "c0") throw new IntakeError("unavailable", 404);
    if (!Number.isSafeInteger(version) || !prospectPriorities.some(option => option === priority)) throw new IntakeError("invalid_request");
    const current = await this.resume(token);
    if (current.version !== version && current.answers.sitePriority !== priority) throw new IntakeError("draft_changed", 409);
    return this.save(token, version, { ...current.answers, sitePriority: priority }, current.step);
  }
  async editProtectedInterview(token: string, version: number, change: (state: InterviewState, view: IntakeView) => InterviewState) {
    if (!this.rehearsal?.protectedScope) throw new IntakeError("unavailable", 404);
    return transaction(this.pool, async db => {
      const row = await this.owned(db, token, true);
      if (row.state !== "draft" || row.version !== version) throw new IntakeError("draft_changed", 409);
      const view = await this.readView(db, row);
      const state = change(view.interview ?? { turns: [], pending: null, failure: null }, view);
      const provenance = { ...row.provenance, protectedInterview: state };
      if (Buffer.byteLength(JSON.stringify(provenance)) > 14_000) throw new IntakeError("payload_too_large", 413);
      const saved = await db.query(`UPDATE ${this.draftTable} SET provenance=$2,version=version+1,updated_at=now() WHERE id=$1 RETURNING *`,
        [row.id, JSON.stringify(provenance)]);
      return this.readView(db, saved.rows[0]);
    });
  }
  async submit(token: string, version: number) {
    if (this.rehearsal?.step !== undefined) throw new IntakeError("unavailable", 404);
    if (!Number.isInteger(version) || version < 1) throw new IntakeError("invalid_request");
    return transaction(this.pool, async db => {
      const r = await this.owned(db, token, true);
      this.assertPrepared(r);
      if (r.state === "needs_operator_review") return this.readView(db, r);
      if (r.version !== version) throw new IntakeError("draft_changed", 409);
      if (this.rehearsal && r.step !== questionsFor(this.paidVersion).length) throw new IntakeError("incomplete");
      const answers = normalizeAnswers(r.answers, r.questionnaire_version); validateComplete(answers, r.questionnaire_version);
      const at = new Date(), expires = new Date(at.getTime() + submissionDays * 86400000);
      const snapshot = { intent: r.entry_intent, questionnaireVersion: r.questionnaire_version, draftVersion: r.version, answers, provenance: r.provenance };
      await db.query(`INSERT INTO prospect_intake_submissions(web_presence_id,intake_id,entry_intent,questionnaire_version,draft_version,answers,provenance,digest,submitted_at,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [this.selection.webPresenceId, r.id, r.entry_intent, r.questionnaire_version, r.version, JSON.stringify(answers), JSON.stringify(r.provenance), fingerprint(snapshot), at, expires]);
      const saved = await db.query("UPDATE prospect_intakes SET state='needs_operator_review',submitted_at=$2,expires_at=$3,version=version+1,updated_at=$2 WHERE id=$1 RETURNING *", [r.id, at, expires]);
      return this.readView(db, saved.rows[0]);
    });
  }
  // Local trusted operator/development command only, never a public API.
  async queue(id?: string) {
    await this.scope(this.pool);
    if (id && !/^[a-f0-9-]{36}$/i.test(id)) throw new IntakeError("invalid_request");
    if (this.rehearsal) throw new IntakeError("unavailable", 503);
    const r = await this.pool.query(`SELECT i.id,i.entry_intent,i.state,i.submitted_at,i.expires_at,s.answers,s.provenance,s.digest FROM prospect_intakes i JOIN prospect_intake_submissions s ON s.intake_id=i.id AND s.web_presence_id=i.web_presence_id WHERE i.web_presence_id=$1 AND i.managed_site_id=$2 AND i.state='needs_operator_review' AND i.expires_at>now() AND i.questionnaire_version IN ('foundational-intake/1','foundational-intake/2') ${id ? "AND i.id=$3" : ""} ORDER BY i.submitted_at,i.id LIMIT 100`, [this.selection.webPresenceId, this.selection.managedSiteId, ...(id ? [id] : [])]);
    return r.rows;
  }
}
