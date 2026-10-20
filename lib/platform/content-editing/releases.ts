import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { fingerprint, object, text, uuid } from "../canonical/model";
import type { Scope } from "./authority";
import { binding, hash, pageProposal, proposalScope, type Binding } from "./proposal";
import { proposalPreview } from "./proposal-preview";
import { PostgresProposalPersistence } from "./proposal-postgres";
import { resolvePage, siteBase } from "./proposal-context";
import { candidateContent, contentSnapshot, exactContent, releaseActor, releaseBase, releaseEnvironment, writeContent, type ContentSnapshot, type ReleaseAuthority, type ReleasePermission } from "./release";

export type ReleaseRecord = {
  id: string; web_presence_id: string; managed_site_id: string; sequence: number; operation: "release" | "rollback";
  request_id: string; request_digest: string; proposal_id: string; revision: number; proposal_digest: string; base_fingerprint: string;
  approval_event: string; preview_digest: string; rollback_of: string | null; page_id: string; before_fingerprint: string; after_fingerprint: string;
  before_content: ContentSnapshot; after_content: ContentSnapshot; actor: { operatorId: string; authorityReference: string }; reference: string; at: string; previous_digest: string | null; digest: string;
};
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export async function releaseHistory(c: PoolClient, scope: Scope): Promise<ReleaseRecord[]> {
  const rows: ReleaseRecord[] = json((await c.query("SELECT * FROM site_content_events WHERE managed_site_id=$1 AND web_presence_id=$2 ORDER BY sequence", [scope.managedSiteId, scope.webPresenceId])).rows);
  for (const [i, row] of rows.entries()) {
    const { digest, ...body } = row;
    if (row.sequence !== i + 1 || row.previous_digest !== (rows[i - 1]?.digest ?? null) || fingerprint(body) !== digest) throw Error("Broken release history");
  }
  return rows;
}
async function append(c: PoolClient, value: Omit<ReleaseRecord, "digest">) {
  const row: ReleaseRecord = json({ ...value, digest: fingerprint(value) }), columns = Object.keys(row);
  await c.query(`INSERT INTO site_content_events(${columns.join(",")}) SELECT ${columns.join(",")} FROM jsonb_populate_record(NULL::site_content_events,$1::jsonb)`, [JSON.stringify(row)]);
  return row;
}
// No HTTP mutation surface. A durable proposal store owns the serializable
// transaction; canonical writes and immutable release evidence commit together.
export class SiteReleaseService {
  constructor(private pool: Pool, private authority: ReleaseAuthority) {}
  private persistence() {
    return new PostgresProposalPersistence(this.pool, {
      beforeBegin: c => releaseEnvironment(c, false),
      afterBegin: async c => {
        // Conservative first-slice lock: also prevents phantom inserts and direct
        // canonical writers that do not participate in our site advisory lock.
        await c.query("LOCK TABLE organizations,web_presences,managed_sites,activation_customer_bindings,pages,sections,actions,navigations,navigation_items,design_systems,business_knowledge,offerings,assets,asset_usages,subjects,contact_definitions IN SHARE ROW EXCLUSIVE MODE");
      },
    });
  }
  private async actor(context: unknown, permission: ReleasePermission, scope: Scope) {
    return releaseActor(await this.authority.authorize(context, permission, structuredClone(scope)));
  }
  async release(context: unknown, input: { binding: Binding; approvalEvent: string; previewDigest: string; requestId: string; reference: string }) {
    object(input, ["binding", "approvalEvent", "previewDigest", "requestId", "reference"]);
    const expected = binding(input.binding), scope = expected.scope, approvalEvent = hash(input.approvalEvent), previewDigest = hash(input.previewDigest), requestId = uuid(input.requestId), reference = text(input.reference, 500);
    const actor = await this.actor(context, "release-managed-site-change", scope), requestDigest = fingerprint({ operation: "release", expected, approvalEvent, previewDigest, requestId, reference, actor });
    return this.persistence().open(expected.proposalId, scope).locked(false, async (state, _append, c) => {
      if (!c) throw Error("Durable transaction required"); await releaseEnvironment(c);
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["site-content:" + scope.managedSiteId]);
      const history = await releaseHistory(c, scope), previous = history.at(-1), retry = history.find(e => e.request_id === requestId);
      if (retry) { if (retry.request_digest !== requestDigest) throw Error("Release idempotency conflict"); return retry; }
      if (history.some(e => e.operation === "release" && e.proposal_id === expected.proposalId && e.revision === expected.revision)) throw Error("Proposal revision already released; new proposal/approval required");
      const revision = state.revisions.at(-1), approval = state.approval, event = state.events.find(e => e.hash === approvalEvent);
      if (state.state !== "APPROVED" || !revision || !approval || event?.action !== "approve" || fingerprint(event.approval) !== fingerprint(approval) || fingerprint(revision.binding) !== fingerprint(expected) || fingerprint(approval.binding) !== fingerprint(expected) || approval.previewDigest !== previewDigest) throw Error("Exact current approved proposal/revision/preview required");
      const customer = object(approval.customer, ["kind", "subjectId", "authorityReference"]);
      if (!["business-representative", "accepted-authority"].includes(String(customer.kind))) throw Error("Customer mandate required"); text(customer.subjectId); text(customer.authorityReference, 500);
      const base = await siteBase(c, scope);
      if (fingerprint(base) !== expected.baseFingerprint) throw Error("Stale canonical site base");
      const resolved = await resolvePage(c, scope, pageProposal(revision.page), base);
      if (fingerprint(resolved.candidate) !== fingerprint(revision.candidate) || fingerprint(resolved.resolved) !== fingerprint(revision.resolved) || fingerprint(proposalPreview(revision)) !== previewDigest) throw Error("Changed canonical source/candidate/renderer");
      const exactBase = await releaseBase(c, scope), at = new Date().toISOString(), before = contentSnapshot(exactBase, revision.page.pageId), after = candidateContent(revision, before, at);
      // Candidate previews do not include managed media. Refuse hidden rendering additions.
      const ids = [revision.page.pageId, ...before.sections.map(s => s.id), ...after.sections.map(s => s.id)];
      if ((await c.query("SELECT 1 FROM asset_usages WHERE entity_id=ANY($1::uuid[])", [ids])).rowCount) throw Error("Media-bound Page/Sections need a separately reviewed proposal contract");
      await writeContent(c, revision.page.pageId, before, after);
      const current = await releaseBase(c, scope);
      if (!exactContent(contentSnapshot(current, revision.page.pageId), after)) throw Error("Released canonical content differs from candidate");
      return append(c, { id: randomUUID(), web_presence_id: scope.webPresenceId, managed_site_id: scope.managedSiteId, sequence: history.length + 1, operation: "release", request_id: requestId, request_digest: requestDigest, proposal_id: expected.proposalId, revision: expected.revision, proposal_digest: expected.digest, base_fingerprint: expected.baseFingerprint, approval_event: approvalEvent, preview_digest: previewDigest, rollback_of: null, page_id: revision.page.pageId, before_fingerprint: fingerprint(exactBase), after_fingerprint: fingerprint(current), before_content: before, after_content: after, actor, reference, at, previous_digest: previous?.digest ?? null });
    });
  }
  async rollback(context: unknown, selection: Scope, input: { releaseId: string; expectedFingerprint: string; requestId: string; reference: string }) {
    object(input, ["releaseId", "expectedFingerprint", "requestId", "reference"]); const scope = proposalScope(selection), id = uuid(input.releaseId), expected = hash(input.expectedFingerprint), requestId = uuid(input.requestId), reference = text(input.reference, 500);
    const actor = await this.actor(context, "rollback-managed-site-change", scope), requestDigest = fingerprint({ operation: "rollback", scope, id, expected, requestId, reference, actor });
    // Obtain the immutable proposal identity without trusting a caller-supplied owner.
    const lookup = await this.pool.connect(); let proposalId: string;
    try { await lookup.query("BEGIN READ ONLY"); await releaseEnvironment(lookup); const row = (await lookup.query("SELECT proposal_id FROM site_content_events WHERE id=$1 AND managed_site_id=$2 AND web_presence_id=$3 AND operation='release'", [id, scope.managedSiteId, scope.webPresenceId])).rows[0]; if (!row) throw Error("Missing/foreign release"); proposalId = row.proposal_id; }
    finally { await lookup.query("ROLLBACK"); lookup.release(); }
    return this.persistence().open(proposalId, scope).locked(false, async (_state, _append, c) => {
      if (!c) throw Error("Durable transaction required"); await releaseEnvironment(c);
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["site-content:" + scope.managedSiteId]);
      const history = await releaseHistory(c, scope), retry = history.find(e => e.request_id === requestId);
      if (retry) { if (retry.request_digest !== requestDigest) throw Error("Rollback idempotency conflict"); return retry; }
      const release = history.find(e => e.id === id);
      if (!release || history.at(-1)?.id !== id || release.operation !== "release") throw Error("Only current latest release may be rolled back");
      const base = await releaseBase(c, scope);
      if (fingerprint(base) !== expected || expected !== release.after_fingerprint || !exactContent(contentSnapshot(base, release.page_id), release.after_content)) throw Error("Unrelated canonical edit/stale rollback base");
      await writeContent(c, release.page_id, release.after_content, release.before_content);
      const restored = await releaseBase(c, scope);
      if (fingerprint(restored) !== release.before_fingerprint) throw Error("Exact prior canonical state was not restored");
      const { digest: oldDigest, ...body } = release; void oldDigest;
      return append(c, { ...body, id: randomUUID(), sequence: history.length + 1, operation: "rollback", request_id: requestId, request_digest: requestDigest, rollback_of: release.id, before_fingerprint: fingerprint(base), after_fingerprint: fingerprint(restored), before_content: release.after_content, after_content: release.before_content, actor, reference, at: new Date().toISOString(), previous_digest: history.at(-1)!.digest });
    });
  }
  async inspect(context: unknown, selection: Scope) {
    const scope = proposalScope(selection); await this.actor(context, "inspect-managed-site-releases", scope);
    const c = await this.pool.connect(); try { await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"); await releaseEnvironment(c); const history = await releaseHistory(c, scope), base = await releaseBase(c, scope), latest = history.at(-1); return { history, base: json(base), fingerprint: fingerprint(base), rollbackAvailable: latest?.operation === "release" && latest.after_fingerprint === fingerprint(base) }; }
    finally { await c.query("ROLLBACK"); c.release(); }
  }
}
