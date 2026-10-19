import { createHash, randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { DeploymentSelection } from "../managed-sites/deployment";
import { fingerprint } from "../canonical/model";
import { IntakeError, intakeVersion, questionsFor, normalizeAnswers, validateComplete, type Answers, type EntryIntent } from "./model";

export const draftDays = 30, submissionDays = 90;
export const newResumeToken = () => randomBytes(32).toString("hex");
export function resumeHash(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new IntakeError("session_unavailable", 404);
  return createHash("sha256").update(token).digest("hex");
}
type Row = { id: string; entry_intent: EntryIntent; questionnaire_version: string; state: "draft" | "needs_operator_review"; answers: Answers; provenance: Record<string, unknown>; step: number; version: number; expires_at: Date; submitted_at: Date | null };
export type IntakeView = { questionnaireVersion: string; intent: EntryIntent; state: Row["state"]; answers: Answers; step: number; version: number; expiresAt: string };
function view(r: Row): IntakeView { return { questionnaireVersion: r.questionnaire_version, intent: r.entry_intent, state: r.state, answers: r.answers, step: r.step, version: r.version, expiresAt: r.expires_at.toISOString() }; }
async function transaction<T>(pool: Pool, run: (db: PoolClient) => Promise<T>) {
  const db = await pool.connect();
  try { await db.query("BEGIN"); const result = await run(db); await db.query("COMMIT"); return result; }
  catch (error) { await db.query("ROLLBACK"); throw error; }
  finally { db.release(); }
}
export class IntakeService {
  constructor(readonly pool: Pool, readonly selection: DeploymentSelection) {}
  private async scope(db: Pick<PoolClient, "query">, lock = false) {
    const { webPresenceId, managedSiteId } = this.selection;
    const r = await db.query(`SELECT m.id FROM managed_sites m JOIN web_presences w ON w.id=m.web_presence_id WHERE m.id=$1 AND w.id=$2 AND m.status='active' AND w.status='active' ${lock ? "FOR SHARE OF m,w" : ""}`, [managedSiteId, webPresenceId]);
    if (r.rows.length !== 1) throw new IntakeError("unavailable", 404);
  }
  private async owned(db: Pick<PoolClient, "query">, token: string, lock = false): Promise<Row> {
    await this.scope(db, lock);
    const r = await db.query(`SELECT * FROM prospect_intakes WHERE web_presence_id=$1 AND managed_site_id=$2 AND resume_hash=$3 AND expires_at>now() AND resume_expires_at>now() ${lock ? "FOR UPDATE" : ""}`, [this.selection.webPresenceId, this.selection.managedSiteId, resumeHash(token)]);
    if (r.rows.length !== 1) throw new IntakeError("session_unavailable", 404);
    try { questionsFor(r.rows[0].questionnaire_version); } catch { throw new IntakeError("session_unavailable", 404); }
    return r.rows[0];
  }
  async resume(token: string) { return view(await this.owned(this.pool, token)); }
  async create(token: string, intent: EntryIntent) {
    if (!["FREE_REVIEW", "DIRECT_START"].includes(intent)) throw new IntakeError("invalid_intent");
    return transaction(this.pool, async db => {
      await this.scope(db, true);
      await db.query(`INSERT INTO prospect_intakes(web_presence_id,managed_site_id,entry_intent,questionnaire_version,resume_hash,expires_at,resume_expires_at)
        VALUES($1,$2,$3,$4,$5,now()+interval '30 days',now()+interval '30 days') ON CONFLICT(resume_hash) DO NOTHING`, [this.selection.webPresenceId, this.selection.managedSiteId, intent, intakeVersion, resumeHash(token)]);
      const r = await this.owned(db, token, true);
      if (r.entry_intent !== intent) throw new IntakeError("intent_conflict", 409);
      return view(r);
    });
  }
  async save(token: string, version: number, value: unknown, step: number) {
    if (!Number.isInteger(version) || version < 1 || !Number.isInteger(step) || step < 0 || step > 12) throw new IntakeError("invalid_request");
    return transaction(this.pool, async db => {
      const r = await this.owned(db, token, true);
      if (r.state !== "draft") throw new IntakeError("already_submitted", 409);
      const answers = normalizeAnswers(value, r.questionnaire_version);
      // Lost-response retries are idempotent; stale tabs cannot overwrite newer answers.
      if (fingerprint(r.answers) === fingerprint(answers) && r.step === step) return view(r);
      if (r.version !== version) throw new IntakeError("draft_changed", 409);
      const provenance: Record<string, unknown> = {};
      const at = new Date().toISOString();
      for (const [key, value] of Object.entries(answers)) provenance[key] = fingerprint(r.answers[key] ?? null) === fingerprint(value) && r.provenance[key]
        ? r.provenance[key] : { source: "prospect-supplied", confirmation: "unconfirmed", suppliedAt: at };
      const saved = await db.query("UPDATE prospect_intakes SET answers=$2,provenance=$3,step=$4,version=version+1,updated_at=now() WHERE id=$1 RETURNING *", [r.id, JSON.stringify(answers), JSON.stringify(provenance), step]);
      return view(saved.rows[0]);
    });
  }
  async submit(token: string, version: number) {
    if (!Number.isInteger(version) || version < 1) throw new IntakeError("invalid_request");
    return transaction(this.pool, async db => {
      const r = await this.owned(db, token, true);
      if (r.state === "needs_operator_review") return view(r);
      if (r.version !== version) throw new IntakeError("draft_changed", 409);
      const answers = normalizeAnswers(r.answers, r.questionnaire_version); validateComplete(answers, r.questionnaire_version);
      const at = new Date(), expires = new Date(at.getTime() + submissionDays * 86400000);
      const snapshot = { intent: r.entry_intent, questionnaireVersion: r.questionnaire_version, draftVersion: r.version, answers, provenance: r.provenance };
      await db.query(`INSERT INTO prospect_intake_submissions(web_presence_id,intake_id,entry_intent,questionnaire_version,draft_version,answers,provenance,digest,submitted_at,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [this.selection.webPresenceId, r.id, r.entry_intent, r.questionnaire_version, r.version, JSON.stringify(answers), JSON.stringify(r.provenance), fingerprint(snapshot), at, expires]);
      const saved = await db.query("UPDATE prospect_intakes SET state='needs_operator_review',submitted_at=$2,expires_at=$3,version=version+1,updated_at=$2 WHERE id=$1 RETURNING *", [r.id, at, expires]);
      return view(saved.rows[0]);
    });
  }
  // Local trusted operator/development command only, never a public API.
  async queue(id?: string) {
    await this.scope(this.pool);
    if (id && !/^[a-f0-9-]{36}$/i.test(id)) throw new IntakeError("invalid_request");
    const r = await this.pool.query(`SELECT i.id,i.entry_intent,i.state,i.submitted_at,i.expires_at,s.answers,s.provenance,s.digest FROM prospect_intakes i JOIN prospect_intake_submissions s ON s.intake_id=i.id AND s.web_presence_id=i.web_presence_id WHERE i.web_presence_id=$1 AND i.managed_site_id=$2 AND i.state='needs_operator_review' AND i.expires_at>now() ${id ? "AND i.id=$3" : ""} ORDER BY i.submitted_at,i.id LIMIT 100`, [this.selection.webPresenceId, this.selection.managedSiteId, ...(id ? [id] : [])]);
    return r.rows;
  }
}
