import { createHash, randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { DeploymentSelection } from "../managed-sites/deployment";
import { fingerprint } from "../canonical/model";
import { IntakeError, intakeVersion, legacyIntakeVersion, normalizeAnswers, validateComplete, type Answers, type EntryIntent } from "./model";
import { onboardingVersion } from "./onboarding";

export const draftDays = 30, submissionDays = 90;
export const newResumeToken = () => randomBytes(32).toString("hex");
export function resumeHash(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new IntakeError("session_unavailable", 404);
  return createHash("sha256").update(token).digest("hex");
}
type Row = { id: string; entry_intent: EntryIntent; questionnaire_version: string; state: "draft" | "needs_operator_review"; answers: Answers; provenance: Record<string, unknown>; step: number; version: number; expires_at: Date; submitted_at: Date | null };
export type IntakeEvidence = { source: "c0-discovery" | "rehearsal-response"; confirmation: "prior-approved" | "unconfirmed"; suppliedAt: string; reference: string; author: string };
export type IntakeView = { questionnaireVersion: string; intent: EntryIntent; state: Row["state"]; answers: Answers; step: number; version: number; expiresAt: string;
  provenance?: Record<string, IntakeEvidence>; submission?: { digest: string; submittedAt: string } };
type Rehearsal = { database: string; answers: Answers; provenance: Record<string, IntakeEvidence> };
function view(r: Row): IntakeView { return { questionnaireVersion: r.questionnaire_version, intent: r.entry_intent, state: r.state, answers: r.answers, step: r.step, version: r.version, expiresAt: r.expires_at.toISOString() }; }
async function transaction<T>(pool: Pool, run: (db: PoolClient) => Promise<T>) {
  const db = await pool.connect();
  try { await db.query("BEGIN"); const result = await run(db); await db.query("COMMIT"); return result; }
  catch (error) { await db.query("ROLLBACK"); throw error; }
  finally { db.release(); }
}
export class IntakeService {
  constructor(readonly pool: Pool, readonly selection: DeploymentSelection, private readonly rehearsal?: Rehearsal) {}
  get isOnboarding() { return Boolean(this.rehearsal); }
  private async scope(db: Pick<PoolClient, "query">, lock = false) {
    if (this.rehearsal) {
      const { database, schema, host, port } = (await db.query("SELECT current_database() AS database, current_schema() AS schema, host(inet_server_addr()) AS host, inet_server_port() AS port")).rows[0];
      if (!/^migration_rehearsal_[a-f0-9]{32}$/.test(database) || database !== this.rehearsal.database || schema !== "public" || host !== "127.0.0.1" || !port || port === 5432) throw new IntakeError("unavailable", 503);
    }
    const { webPresenceId, managedSiteId } = this.selection;
    const r = await db.query(`SELECT m.id FROM managed_sites m JOIN web_presences w ON w.id=m.web_presence_id WHERE m.id=$1 AND w.id=$2 AND m.status='active' AND w.status='active' ${lock ? "FOR SHARE OF m,w" : ""}`, [managedSiteId, webPresenceId]);
    if (r.rows.length !== 1) throw new IntakeError("unavailable", 404);
  }
  private async owned(db: Pick<PoolClient, "query">, token: string, lock = false): Promise<Row> {
    await this.scope(db, lock);
    const r = await db.query(`SELECT * FROM prospect_intakes WHERE web_presence_id=$1 AND managed_site_id=$2 AND resume_hash=$3 AND expires_at>now() AND resume_expires_at>now() ${lock ? "FOR UPDATE" : ""}`, [this.selection.webPresenceId, this.selection.managedSiteId, resumeHash(token)]);
    if (r.rows.length !== 1) throw new IntakeError("session_unavailable", 404);
    if (!(this.rehearsal ? [onboardingVersion] : [legacyIntakeVersion, intakeVersion]).includes(r.rows[0].questionnaire_version)) throw new IntakeError("session_unavailable", 404);
    return r.rows[0];
  }
  private async readView(db: Pick<PoolClient, "query">, row: Row): Promise<IntakeView> {
    if (!this.rehearsal) return view(row);
    const result = { ...view(row), provenance: row.provenance as Record<string, IntakeEvidence> };
    if (row.state !== "needs_operator_review") return result;
    const { rows } = await db.query("SELECT answers,provenance,digest,draft_version,submitted_at FROM prospect_intake_submissions WHERE intake_id=$1 AND web_presence_id=$2 AND questionnaire_version=$3", [row.id, this.selection.webPresenceId, onboardingVersion]);
    const snapshot = rows[0];
    if (!snapshot || snapshot.draft_version !== row.version - 1 || snapshot.digest !== fingerprint({ intent: row.entry_intent, questionnaireVersion: onboardingVersion, draftVersion: snapshot.draft_version, answers: row.answers, provenance: row.provenance }) ||
        fingerprint(snapshot.answers) !== fingerprint(row.answers) || fingerprint(snapshot.provenance) !== fingerprint(row.provenance)) throw new IntakeError("unavailable", 503);
    return { ...result, submission: { digest: snapshot.digest, submittedAt: snapshot.submitted_at.toISOString() } };
  }
  async resume(token: string) { return this.readView(this.pool, await this.owned(this.pool, token)); }
  async create(token: string, intent: EntryIntent) {
    if (!["FREE_REVIEW", "DIRECT_START"].includes(intent) || this.rehearsal && intent !== "DIRECT_START") throw new IntakeError("invalid_intent");
    return transaction(this.pool, async db => {
      await this.scope(db, true);
      const inserted = await db.query(`INSERT INTO prospect_intakes(web_presence_id,managed_site_id,entry_intent,questionnaire_version,resume_hash,expires_at,resume_expires_at)
        VALUES($1,$2,$3,$4,$5,now()+interval '30 days',now()+interval '30 days') ON CONFLICT(resume_hash) DO NOTHING`, [this.selection.webPresenceId, this.selection.managedSiteId, intent, this.rehearsal ? onboardingVersion : intakeVersion, resumeHash(token)]);
      let r = await this.owned(db, token, true);
      if (r.entry_intent !== intent) throw new IntakeError("intent_conflict", 409);
      if (this.rehearsal && inserted.rowCount) {
        const answers = normalizeAnswers(this.rehearsal.answers, onboardingVersion);
        r = (await db.query("UPDATE prospect_intakes SET answers=$2,provenance=$3,version=version+1 WHERE id=$1 RETURNING *", [r.id, JSON.stringify(answers), JSON.stringify(this.rehearsal.provenance)])).rows[0];
      }
      return this.readView(db, r);
    });
  }
  async save(token: string, version: number, value: unknown, step: number) {
    if (!Number.isInteger(version) || version < 1 || !Number.isInteger(step) || step < 0 || step > (this.rehearsal ? 10 : 12)) throw new IntakeError("invalid_request");
    return transaction(this.pool, async db => {
      const r = await this.owned(db, token, true);
      if (r.state !== "draft") throw new IntakeError("already_submitted", 409);
      const answers = normalizeAnswers(value, r.questionnaire_version);
      if (this.rehearsal) for (const key of Object.keys(answers)) if (answers[key] === "") delete answers[key];
      // Lost-response retries are idempotent; stale tabs cannot overwrite newer answers.
      if (fingerprint(r.answers) === fingerprint(answers) && r.step === step) return this.readView(db, r);
      if (r.version !== version) throw new IntakeError("draft_changed", 409);
      const provenance: Record<string, unknown> = {};
      const at = new Date().toISOString();
      for (const [key, value] of Object.entries(answers)) provenance[key] = fingerprint(r.answers[key] ?? null) === fingerprint(value) && r.provenance[key]
        ? r.provenance[key] : this.rehearsal ? { source: "rehearsal-response", confirmation: "unconfirmed", suppliedAt: at, reference: onboardingVersion, author: `rehearsal-customer:${r.id}` } : { source: "prospect-supplied", confirmation: "unconfirmed", suppliedAt: at };
      const saved = await db.query("UPDATE prospect_intakes SET answers=$2,provenance=$3,step=$4,version=version+1,updated_at=now() WHERE id=$1 RETURNING *", [r.id, JSON.stringify(answers), JSON.stringify(provenance), step]);
      return this.readView(db, saved.rows[0]);
    });
  }
  async submit(token: string, version: number) {
    if (!Number.isInteger(version) || version < 1) throw new IntakeError("invalid_request");
    return transaction(this.pool, async db => {
      const r = await this.owned(db, token, true);
      if (r.state === "needs_operator_review") return this.readView(db, r);
      if (r.version !== version) throw new IntakeError("draft_changed", 409);
      if (this.rehearsal && r.step !== 10) throw new IntakeError("incomplete");
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
