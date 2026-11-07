import type { Pool, PoolClient } from "pg";
import { projectContent } from "../canonical/projections";
import { fingerprint, uuid } from "../canonical/model";
import { readProposalState } from "../content-editing/proposal-postgres";
import { resolvePage, siteBase } from "../content-editing/proposal-context";
import { hash, pageProposal } from "../content-editing/proposal";
import { proposalPreview } from "../content-editing/proposal-preview";
import { validatePages, type ReviewedProjection, type Site } from "./authority";
import { customerMandate, type ProtectedOperator } from "./operator";

async function approvedProjection(db: PoolClient, site: Site, proposalId: string, approvalId: string) {
  const identity = (await db.query(`SELECT p.created_at,g.operator_id,g.id AS grant_id,g.customer
    FROM site_change_proposals p JOIN wordpress_proposal_approvals a ON a.proposal_id=p.id
    JOIN wordpress_operator_grants g ON g.id=a.grant_id AND g.permission='approve-site-proposal'
      AND g.web_presence_id=p.web_presence_id AND g.managed_site_id=p.managed_site_id
    WHERE p.id=$1 AND a.approval_digest=$2 AND p.organization_id=$3
    AND p.web_presence_id=$4 AND p.managed_site_id=$5 AND g.revoked_at IS NULL`,
  [proposalId, approvalId, site.organizationId, site.webPresenceId, site.managedSiteId])).rows[0];
  if (!identity) throw Error("Protected approval required");
  const scope = { webPresenceId: site.webPresenceId, managedSiteId: site.managedSiteId };
  const state = await readProposalState(db, proposalId, scope, identity.created_at);
  const approved = state.events.find(event => event.hash === approvalId);
  const revision = state.revisions.at(-1);
  if (state.state !== "APPROVED" || !revision || !approved?.approval
    || approved.actor.operatorId !== identity.operator_id || approved.actor.authorityReference !== identity.grant_id
    || fingerprint(customerMandate(identity.customer)) !== fingerprint(approved.approval.customer)) {
    throw Error("Exact protected approval required");
  }
  const base = await siteBase(db, scope);
  if (base.graph.organization.id !== site.organizationId || fingerprint(base) !== revision.binding.baseFingerprint) {
    throw Error("Stale canonical source");
  }
  if (revision.candidate.media || revision.page.sections.some(section => section.image)) {
    throw Error("Private staging v1 excludes media-bound content");
  }
  const resolved = await resolvePage(db, scope, pageProposal(revision.page), base);
  if (fingerprint(resolved.candidate) !== fingerprint(revision.candidate)
    || fingerprint(resolved.resolved) !== fingerprint(revision.resolved)
    || fingerprint(proposalPreview(revision)) !== approved.approval.previewDigest) throw Error("Changed approved candidate");

  for (const copy of resolved.resolved) {
    if (copy.origin.kind !== "canonical") continue;
    const source = copy.origin.source;
    const knowledge = source.domain === "knowledge";
    const rows = (base as Record<string, unknown>)[knowledge ? "business_knowledge" : "offerings"] as Parameters<typeof projectContent>[3][];
    const row = rows.find(candidate => candidate.id === source.recordId);
    const binding = knowledge ? { role: "knowledge" as const, knowledgeId: source.recordId, keys: [source.field] }
      : { role: "offering-overview" as const, offeringId: source.recordId };
    if (!row || !projectContent("intro", {}, binding, row)) throw Error("Canonical fact is not approved for public projection");
  }
  const ids = [revision.page.pageId, ...resolved.candidate.sections.map(s => s.id),
    ...base.sections.filter(s => s.page_id === revision.page.pageId).map(s => s.id)];
  if ((await db.query("SELECT 1 FROM asset_usages WHERE entity_id=ANY($1::uuid[]) LIMIT 1", [ids])).rowCount) {
    throw Error("Private staging v1 excludes media-bound content");
  }
  if (resolved.candidate.sections.some(s => s.action || s.content.actionId || s.type === "cta")) {
    throw Error("Private staging v1 excludes action-bound content");
  }
  const pages = [{ id: revision.page.pageId, path: revision.page.slug, title: resolved.candidate.title,
    sections: resolved.candidate.sections.map(s => ({ id: s.id, type: s.type,
      content: { heading: s.content.heading, text: s.content.text ?? "" } })) }];
  validatePages(pages);
  return { pages, projectionDigest: fingerprint(pages), sourceDigest: revision.binding.baseFingerprint,
    approvalId, previewDigest: approved.approval.previewDigest, revision: revision.binding.revision,
    approver: identity.operator_id as string };
}

export async function reviewedPrivateSource(db: PoolClient, site: Site): Promise<ReviewedProjection | null> {
  const record = (await db.query(`SELECT r.* FROM wordpress_private_releases r
    WHERE r.web_presence_id=$1 AND r.managed_site_id=$2 ORDER BY r.reviewed_at DESC,r.id DESC LIMIT 1`,
  [site.webPresenceId, site.managedSiteId])).rows[0];
  if (!record) return null;
  const reviewer = (await db.query(`SELECT operator_id FROM wordpress_operator_grants WHERE id=$1 AND web_presence_id=$2
    AND managed_site_id=$3 AND permission='review-private-stage' AND revoked_at IS NULL`,
  [record.reviewer_grant_id, site.webPresenceId, site.managedSiteId])).rows[0];
  const { approver, ...projection } = await approvedProjection(db, site, record.proposal_id, record.approval_digest);
  if (!reviewer || reviewer.operator_id === approver || record.projection_digest !== projection.projectionDigest) return null;
  return { ...site, ...projection, releaseId: record.id, releaseDigest: fingerprint(record), version: 1, publishable: true };
}

export class PrivateReleaseReview {
  constructor(private pool: Pool, private operator: ProtectedOperator, private boundary: (db: PoolClient) => Promise<void>) {}

  async review(context: unknown, input: { site: Site; proposalId: string; approvalId: string;
    commit?: { releaseId: string; projectionDigest: string } }) {
    const site = { organizationId: uuid(input.site.organizationId), webPresenceId: uuid(input.site.webPresenceId),
      managedSiteId: uuid(input.site.managedSiteId) };
    const proposalId = uuid(input.proposalId), approvalId = hash(input.approvalId);
    const commit = input.commit && { releaseId: uuid(input.commit.releaseId), projectionDigest: hash(input.commit.projectionDigest) };
    const db = await this.pool.connect();
    try {
      await db.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      await this.boundary(db);
      await db.query("SET LOCAL TIME ZONE 'UTC'");
      const actor = await this.operator.authorizeIn(db, context, "review-private-stage", site);
      const { approver, ...projection } = await approvedProjection(db, site, proposalId, approvalId);
      if (actor.operatorId === approver) throw Error("Independent projection reviewer required");
      if (commit) {
        if (commit.projectionDigest !== projection.projectionDigest) throw Error("Reviewed projection digest mismatch");
        await db.query(`INSERT INTO wordpress_private_releases
          (id,web_presence_id,managed_site_id,proposal_id,approval_digest,projection_digest,reviewer_grant_id)
          VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING`,
        [commit.releaseId, site.webPresenceId, site.managedSiteId, proposalId, approvalId,
          commit.projectionDigest, actor.authorityReference]);
        const recorded = (await db.query(`SELECT 1 FROM wordpress_private_releases WHERE id=$1 AND web_presence_id=$2
          AND managed_site_id=$3 AND proposal_id=$4 AND approval_digest=$5 AND projection_digest=$6 AND reviewer_grant_id=$7`,
        [commit.releaseId, site.webPresenceId, site.managedSiteId, proposalId, approvalId,
          commit.projectionDigest, actor.authorityReference])).rowCount;
        if (!recorded) throw Error("Private release idempotency conflict");
      }
      await db.query("COMMIT");
      return { ...projection, releaseId: commit?.releaseId ?? null };
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally { db.release(); }
  }
}
