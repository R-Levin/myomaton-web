import type { Pool } from "pg";
import { ContactError, normalizeDefinition, normalizeFields, submissionInput } from "./model";
import { contactRetentionDays } from "../policy/site-policy";
import { object } from "../site-globals/model";
import { canonicalPagePath } from "../managed-sites/paths";
import type { ContactAbuseGuard, ContactDeliveryProvider, ContactEvents } from "./boundaries";

export async function acceptContactSubmission(pool: Pool, selection: { domain: string; managedSiteName: string }, value: unknown,
  options: { abuse: ContactAbuseGuard; provider?: ContactDeliveryProvider; events?: ContactEvents; servicePolicy?: unknown; now?: Date }) {
  const input = submissionInput(value);
  // Bound direct service use as well as HTTP streaming.
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > 16384) throw new ContactError("payload_too_large", 413);
  if (!await options.abuse.allow(`${selection.domain}:${selection.managedSiteName}`)) throw new ContactError("rate_limited", 429);
  const client = await pool.connect();
  let accepted: { id: string; webPresenceId: string; route: string | null; fields: ReturnType<typeof normalizeFields>; created: boolean; successText: string };
  try {
    await client.query("BEGIN");
    const sites = await client.query(`SELECT m.id FROM managed_sites m JOIN web_presences w ON w.id=m.web_presence_id
      WHERE w.primary_domain=$1 AND m.name=$2 AND w.status='active' AND m.status='active' FOR SHARE OF m,w`, [selection.domain, selection.managedSiteName]);
    if (sites.rows.length !== 1) throw new ContactError("unavailable", 404);
    const rows = await client.query(`SELECT d.id,d.version,d.status,d.configuration,d.delivery_route_key,
      w.id AS web_presence_id,m.id AS managed_site_id,p.id AS page_id,p.slug,s.id AS section_id,
      w.configuration AS presence_configuration,m.configuration AS site_configuration
      FROM sections s JOIN pages p ON p.id=s.page_id JOIN managed_sites m ON m.id=p.managed_site_id
      JOIN web_presences w ON w.id=m.web_presence_id
      JOIN contact_definitions d ON d.web_presence_id=w.id AND d.id=$2
      WHERE s.id=$1 AND m.id=$3 AND s.type='contact' AND lower(s.content->>'contact_definition_id')=d.id::text
      AND s.status='active' AND p.status='active' AND m.status='active' AND w.status='active' AND d.status='active'
      FOR SHARE OF s,p,m,w,d`, [input.sectionId, input.definitionId, sites.rows[0].id]);
    if (rows.rows.length !== 1) throw new ContactError("unavailable", 404);
    const row = rows.rows[0], definition = normalizeDefinition(row);
    if (!canonicalPagePath(row.slug)) throw new ContactError("unavailable", 404);
    if (definition.version !== input.version) throw new ContactError("definition_changed", 409);
    const fields = normalizeFields(input.fields, definition);
    const days = contactRetentionDays(options.servicePolicy, object(row.presence_configuration).policy, object(row.site_configuration).policy);
    const now = options.now ?? new Date(), expires = new Date(now.getTime() + days * 86400000);
    const inserted = await client.query(`INSERT INTO contact_submissions
      (web_presence_id,managed_site_id,page_id,section_id,contact_definition_id,contact_definition_version,fields,
       delivery_route_key,delivery_status,idempotency_key,created_at,updated_at,expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12)
      ON CONFLICT (web_presence_id,contact_definition_id,idempotency_key) DO NOTHING RETURNING id`,
      [row.web_presence_id,row.managed_site_id,row.page_id,row.section_id,definition.id,definition.version,JSON.stringify(fields),
        row.delivery_route_key,row.delivery_route_key === null ? "disabled" : "pending",input.idempotencyKey,now,expires]);
    let id = inserted.rows[0]?.id;
    if (!id) {
      const previous = (await client.query(`SELECT *, fields=$4::jsonb AS same_fields FROM contact_submissions
        WHERE web_presence_id=$1 AND contact_definition_id=$2 AND idempotency_key=$3 FOR UPDATE`,
        [row.web_presence_id,definition.id,input.idempotencyKey,JSON.stringify(fields)])).rows[0];
      if (!previous || !previous.same_fields || previous.contact_definition_version !== definition.version || previous.managed_site_id !== row.managed_site_id || previous.page_id !== row.page_id || previous.section_id !== row.section_id)
        throw new ContactError("idempotency_conflict", 409);
      id = previous.id;
    }
    accepted = { id, webPresenceId: row.web_presence_id, route: row.delivery_route_key, fields, created: !!inserted.rowCount, successText: definition.successText };
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }

  if (accepted.created && accepted.route !== null) {
    // Acceptance is durable before any provider call. No transaction across SMTP.
    // Only the creating request attempts delivery; exact retries never send twice.
    try {
      if (!options.provider) {
        await pool.query("UPDATE contact_submissions SET delivery_status='failed',delivery_error_code='provider_unavailable',updated_at=now() WHERE id=$1", [accepted.id]);
      } else {
        await pool.query("UPDATE contact_submissions SET delivery_attempts=delivery_attempts+1,last_attempt_at=now(),updated_at=now() WHERE id=$1", [accepted.id]);
        let delivered = false;
        try { await options.provider.deliverSubmission({ submissionId: accepted.id, routeKey: accepted.route, fields: accepted.fields }); delivered = true; }
        catch { /* Only a provider failure is classified as failed delivery. */ }
        if (delivered) await pool.query("UPDATE contact_submissions SET delivery_status='delivered',delivered_at=now(),delivery_error_code=NULL,updated_at=now() WHERE id=$1", [accepted.id]);
        else await pool.query("UPDATE contact_submissions SET delivery_status='failed',delivery_error_code='delivery_failed',updated_at=now() WHERE id=$1", [accepted.id]);
      }
    } catch { /* Persisted acceptance survives delivery-state DB failure; pending requires operator reconciliation. */ }
  }
  if (accepted.created && options.events) {
    try { await options.events.accepted({ name: "form_submit", submissionId: accepted.id, webPresenceId: accepted.webPresenceId, definitionId: input.definitionId }); }
    catch { /* Measurement must not invalidate an accepted lead. No message content is emitted. */ }
  }
  return { accepted: true, duplicate: !accepted.created, successText: accepted.successText };
}
