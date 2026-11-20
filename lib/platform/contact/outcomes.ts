import type { Pool } from "pg";
import { choice, fingerprint, object, text, uuid } from "../canonical/model";
import type { CustomerAuthority } from "../content-editing/proposal";
import type { DeploymentSelection } from "../managed-sites/deployment";
import { ContactError } from "./model";

export type InquiryAuthority = { authorize(context: unknown, operation: "inspect-inquiry-outcomes" | "record-inquiry-outcome",
  scope: DeploymentSelection): Promise<{ operatorId: string; authorityReference: string; customer?: CustomerAuthority }> };
type Outcome = { qualification: "unknown" | "qualified" | "not-qualified"; outcome: "unknown" | "conversation" | "became-customer" | "closed";
  confirmedAt: string; reference: string; by: string; authorityReference: string; customer: CustomerAuthority };

/** Manual outcome confirmation supplements durable Contact acceptance; it never
 * treats delivery, an Action click or an AI inference as a business outcome. */
export class InquiryOutcomes {
  constructor(private pool: Pool, private authority: InquiryAuthority, private environment: "development" | "live", private clock = Date.now) {}
  private scope(value: DeploymentSelection) { object(value, ["webPresenceId", "managedSiteId"]); return { webPresenceId: uuid(value.webPresenceId), managedSiteId: uuid(value.managedSiteId) }; }
  async inspect(context: unknown, selected: DeploymentSelection) {
    const scope = this.scope(selected); await this.authority.authorize(context, "inspect-inquiry-outcomes", scope);
    const { rows } = await this.pool.query(`SELECT s.id,s.created_at,s.delivery_status,s.page_id,s.expires_at,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('version',e.version,'payload',e.payload,'digest',e.digest) ORDER BY e.version)
        FROM contact_outcome_events e WHERE e.web_presence_id=s.web_presence_id AND e.managed_site_id=s.managed_site_id AND e.submission_id=s.id AND e.environment=$3),'[]') AS history
      FROM contact_submissions s WHERE s.web_presence_id=$1 AND s.managed_site_id=$2 AND s.expires_at>$4 ORDER BY s.created_at,s.id`,
    [scope.webPresenceId, scope.managedSiteId, this.environment, new Date(this.clock())]);
    return { environment: this.environment, siteRevision: null, inquiries: rows.map(row => {
      for (const entry of row.history) if (fingerprint(entry.payload) !== entry.digest) throw new ContactError("unavailable", 503);
      const latest = row.history.at(-1);
      return { id: row.id as string, acceptedAt: (row.created_at as Date).toISOString(), delivery: row.delivery_status as string,
        version: latest?.version ?? 0, qualification: latest?.payload.qualification ?? "unknown", outcome: latest?.payload.outcome ?? "unknown",
        history: row.history as { version: number; payload: Outcome; digest: string }[] };
    }) };
  }
  async record(context: unknown, selected: DeploymentSelection, value: unknown) {
    const scope = this.scope(selected), grant = await this.authority.authorize(context, "record-inquiry-outcome", scope);
    if (!grant.customer || !["business-representative", "accepted-authority"].includes(grant.customer.kind)) throw new ContactError("authorization_required", 403);
    let id: string, requestId: string, expected: number, payload: Outcome;
    try {
      const input = object(value, ["submissionId", "requestId", "expectedVersion", "qualification", "outcome", "confirmedAt", "reference", "confirmed"]);
      id = uuid(input.submissionId); requestId = uuid(input.requestId); expected = Number(input.expectedVersion);
      if (!Number.isSafeInteger(input.expectedVersion) || expected < 0 || input.confirmed !== true || typeof input.confirmedAt !== "string" ||
          !Number.isFinite(Date.parse(input.confirmedAt)) || Date.parse(input.confirmedAt) > this.clock()) throw Error();
      payload = { qualification: choice(input.qualification, ["unknown", "qualified", "not-qualified"]),
        outcome: choice(input.outcome, ["unknown", "conversation", "became-customer", "closed"]),
        confirmedAt: new Date(input.confirmedAt).toISOString(), reference: text(input.reference, 300),
        by: text(grant.operatorId), authorityReference: text(grant.authorityReference, 300), customer: {
          kind: grant.customer.kind, subjectId: text(grant.customer.subjectId), authorityReference: text(grant.customer.authorityReference, 500) } };
    } catch { throw new ContactError("invalid_request"); }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const { rows: [submission] } = await client.query(`SELECT created_at FROM contact_submissions
        WHERE id=$1 AND web_presence_id=$2 AND managed_site_id=$3 AND expires_at>$4 FOR UPDATE`, [id, scope.webPresenceId, scope.managedSiteId, new Date(this.clock())]);
      if (!submission || Date.parse(payload.confirmedAt) < submission.created_at.getTime()) throw new ContactError("unavailable", 404);
      const retry = (await client.query("SELECT submission_id,payload,digest FROM contact_outcome_events WHERE web_presence_id=$1 AND managed_site_id=$2 AND environment=$3 AND request_id=$4",
        [scope.webPresenceId, scope.managedSiteId, this.environment, requestId])).rows[0];
      if (retry) {
        if (retry.submission_id !== id || retry.digest !== fingerprint(payload) || fingerprint(retry.payload) !== retry.digest) throw new ContactError("idempotency_conflict", 409);
      } else {
        const version = (await client.query("SELECT COALESCE(max(version),0)::int AS version FROM contact_outcome_events WHERE web_presence_id=$1 AND managed_site_id=$2 AND submission_id=$3 AND environment=$4",
          [scope.webPresenceId, scope.managedSiteId, id, this.environment])).rows[0].version;
        if (version !== expected) throw new ContactError("outcome_changed", 409);
        await client.query("INSERT INTO contact_outcome_events(web_presence_id,managed_site_id,submission_id,environment,version,request_id,payload,digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [scope.webPresenceId, scope.managedSiteId, id, this.environment, version + 1, requestId, payload, fingerprint(payload)]);
      }
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
    return this.inspect(context, scope);
  }
}
export type InquiryOutcomeView = Awaited<ReturnType<InquiryOutcomes["inspect"]>>;
