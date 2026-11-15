import type { Pool, PoolClient } from "pg";
import type { KeyObject } from "node:crypto";
import { projectContent } from "../canonical/projections";
import { fingerprint, uuid } from "../canonical/model";
import { readProposalState } from "../content-editing/proposal-postgres";
import { resolvePage, siteBase } from "../content-editing/proposal-context";
import { resolveProposalCandidate, type ResolvePrivateVisuals } from "../content-editing/proposal-media";
import { hash, pageProposal } from "../content-editing/proposal";
import { proposalPreview } from "../content-editing/proposal-preview";
import { validatePages, type ReviewedProjection, type Site } from "./authority";
import { customerMandate, type ProtectedOperator } from "./operator";
import { bindSiteDraft } from "./site-draft";
import { nativeDraftEnvelope, readNativeDraftEnvelope } from "./native-draft-envelope";
import { prepareNativeDraftMedia } from "./native-draft-media";
import type { NativeDraftReceiptExpectation, NativeDraftReceiptJournal } from "./native-draft-receipt";

type WorkflowMedia = { root: string; resolve: ResolvePrivateVisuals };

type RecoveryEvidence = { journal: NativeDraftReceiptJournal; secret: Buffer; credentialId: string };

async function approvedProjection(db: PoolClient, site: Site, proposalId: string, approvalId: string, mediaRoot?: string, workflowMedia?: WorkflowMedia) {
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
  const withMedia = Boolean(revision.candidate.media || revision.candidate.privateMedia || revision.page.sections.some(section => section.image));
  const root = revision.page.workflowReview ? workflowMedia?.root : mediaRoot;
  if (withMedia && !root) throw Error("Private staging v1 excludes media-bound content");
  const resolved = withMedia || revision.page.workflowReview
    ? await resolveProposalCandidate(db, scope, pageProposal(revision.page), base, mediaRoot, undefined, workflowMedia?.resolve)
    : { ...await resolvePage(db, scope, pageProposal(revision.page), base), image: undefined, privateImages: undefined };
  if (fingerprint(resolved.candidate) !== fingerprint(revision.candidate)
    || fingerprint(resolved.resolved) !== fingerprint(revision.resolved)
    || fingerprint(proposalPreview(revision, resolved.image, resolved.privateImages)) !== approved.approval.previewDigest) throw Error("Changed approved candidate");

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
  if (!withMedia && (await db.query("SELECT 1 FROM asset_usages WHERE entity_id=ANY($1::uuid[]) LIMIT 1", [ids])).rowCount) {
    throw Error("Private staging v1 excludes media-bound content");
  }
  if (resolved.candidate.sections.some(s => s.action || s.content.actionId || s.type === "cta")) {
    throw Error("Private staging v1 excludes action-bound content");
  }
  const pages = [{ id: revision.page.pageId, path: revision.page.slug, title: resolved.candidate.title,
    sections: resolved.candidate.sections.map(s => ({ id: s.id, type: s.type,
      content: { heading: s.content.heading, text: s.content.text ?? "" } })) }];
  validatePages(pages, Boolean(workflowMedia));
  const media = resolved.candidate.privateMedia ?? (resolved.candidate.media ? [resolved.candidate.media] : []);
  const copies = root ? await Promise.all(media.map(item => prepareNativeDraftMedia(root, scope.webPresenceId, revision.page.pageId, item))) : [];
  return { pages, projectionDigest: fingerprint(pages), sourceDigest: revision.binding.baseFingerprint,
    approvalId, previewDigest: approved.approval.previewDigest, revision: revision.binding.revision,
    approver: identity.operator_id as string, copies, ...(copies.length && { media: copies.map(copy => copy.descriptor) }) };
}

export async function reviewedPrivateSource(db: PoolClient, site: Site): Promise<ReviewedProjection | null> {
  const record = (await db.query(`SELECT r.* FROM wordpress_private_releases r
    WHERE r.web_presence_id=$1 AND r.managed_site_id=$2 ORDER BY r.reviewed_at DESC,r.id DESC LIMIT 1`,
  [site.webPresenceId, site.managedSiteId])).rows[0];
  if (!record) return null;
  const reviewer = (await db.query(`SELECT operator_id FROM wordpress_operator_grants WHERE id=$1 AND web_presence_id=$2
    AND managed_site_id=$3 AND permission='review-private-stage' AND revoked_at IS NULL`,
  [record.reviewer_grant_id, site.webPresenceId, site.managedSiteId])).rows[0];
  const { approver, copies, media, ...projection } = await approvedProjection(db, site, record.proposal_id, record.approval_digest);
  if (copies.length || media) return null;
  if (!reviewer || reviewer.operator_id === approver || record.projection_digest !== projection.projectionDigest) return null;
  return { ...site, ...projection, releaseId: record.id, releaseDigest: fingerprint(record), version: 1, publishable: true };
}

export class PrivateReleaseReview {
  constructor(private pool: Pool, private operator: ProtectedOperator, private boundary: (db: PoolClient) => Promise<void>,
    private disposableMediaRoot?: string, private workflowMedia?: WorkflowMedia) {}

  // Review-only. A digest returned here does not grant draft materialization.
  async previewSiteDraft(context: unknown, site: Site, references: readonly { proposalId: string; approvalId: string }[], draft: unknown) {
    return this.siteDraft(context, site, references, draft);
  }

  async authorizeSiteDraft(context: unknown, reviewer: unknown, site: Site,
    references: readonly { proposalId: string; approvalId: string }[], draft: unknown, expectedDigest: unknown, recovery?: RecoveryEvidence) {
    return this.siteDraft(reviewer, site, references, draft, { context, digest: hash(expectedDigest), recovery });
  }

  async issueSiteDraft(context: unknown, reviewer: unknown, site: Site,
    references: readonly { proposalId: string; approvalId: string }[], draft: unknown, expectedDigest: unknown, key: KeyObject,
    operation: "apply" | "restore" = "apply", recovery?: RecoveryEvidence) {
    const preview = await this.siteDraft(reviewer, site, references, draft, { context, digest: hash(expectedDigest), key, operation, recovery });
    if (!("envelope" in preview)) throw Error("Native draft issuance refused");
    return preview.envelope;
  }

  async issueSiteDraftBundle(context: unknown, reviewer: unknown, site: Site,
    references: readonly { proposalId: string; approvalId: string }[], draft: unknown, expectedDigest: unknown, key: KeyObject,
    recovery?: RecoveryEvidence) {
    const preview = await this.siteDraft(reviewer, site, references, draft, { context, digest: hash(expectedDigest), key, recovery });
    if (!("envelope" in preview) || !preview.envelope || !preview.copies) throw Error("Native draft bundle issuance refused");
    const unique = new Map(preview.copies.map(copy => [copy.descriptor.copyDigest, copy.bytes]));
    return { envelope: preview.envelope, copies: Array.from(unique, ([copyDigest, bytes]) => ({ copyDigest, bytesBase64: bytes.toString("base64") })) };
  }

  async nativeDraftReceiptDecision(context: unknown, site: Site, installationId: string, envelope: unknown) {
    site = { organizationId: uuid(site.organizationId), webPresenceId: uuid(site.webPresenceId), managedSiteId: uuid(site.managedSiteId) };
    installationId = uuid(installationId);
    const db = await this.pool.connect();
    try {
      await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await this.boundary(db);
      const reviewer = await this.operator.authorizeIn(db, context, "review-private-stage", site);
      const { rows: [installation] } = await db.query(`SELECT k.key_id,k.public_key,k.credential_id FROM wordpress_installations i
        JOIN wordpress_installation_keys k ON k.installation_id=i.id AND k.generation=i.generation
        WHERE i.id=$1 AND i.organization_id=$2 AND i.web_presence_id=$3 AND i.managed_site_id=$4 AND i.status='active'`,
      [installationId, site.organizationId, site.webPresenceId, site.managedSiteId]);
      if (!installation) throw Error("Draft receipt installation scope mismatch");
      const signed = readNativeDraftEnvelope(envelope, installation.key_id, installation.public_key);
      const draft = signed.candidate;
      if (draft.installationId !== installationId || fingerprint(draft.scope) !== fingerprint(site)) throw Error("Draft receipt scope mismatch");
      const { rows: [latest] } = await db.query(`SELECT a.*, g.revoked_at FROM wordpress_native_draft_authorizations a
        JOIN wordpress_operator_grants g ON g.id=a.authorizer_grant_id AND g.permission='authorize-native-draft'
        WHERE a.installation_id=$1 AND a.site_proposal_id=$2 ORDER BY a.revision DESC LIMIT 1`,
      [installationId, uuid(draft.siteProposalId)]);
      if (!latest || latest.revoked_at !== null || latest.reviewer_grant_id !== reviewer.authorityReference ||
          latest.revision !== draft.revision || latest.candidate_digest !== signed.digest || latest.previous_digest !== draft.previousDigest) {
        throw Error("Draft receipt has no current exact authorization");
      }
      const restore = signed.operation === "restore";
      if (restore && (!draft.previousDigest || draft.revision < 2)) throw Error("Draft receipt predecessor missing");
      const expected: NativeDraftReceiptExpectation = { installationId, siteProposalId: draft.siteProposalId, operation: signed.operation,
        requestedDigest: signed.digest, appliedDigest: restore ? draft.rollback?.digest ?? hash(draft.previousDigest) : signed.digest,
        revision: restore ? draft.rollback?.revision ?? draft.revision - 1 : draft.revision,
        ...(draft.rollback && (restore ? { requestedRevision: draft.revision } : { materializedBaseline: {
          requestedDigest: hash(draft.previousDigest), appliedDigest: draft.rollback.digest, revision: draft.rollback.revision,
        } })), paths: (restore ? draft.baselinePages ?? draft.pages : draft.pages).map(page => page.path),
        ...(draft.baselinePages && { baselinePaths: draft.baselinePages.map(page => page.path),
          requestedPaths: draft.pages.map(page => page.path),
          ...(!restore && !draft.rollback && { appliedBaseline: hash(draft.previousDigest) }) }),
        ...(!restore && draft.media && { media: draft.media, pageIds: draft.pages.map(page => page.id) }) };
      await db.query("COMMIT");
      return { expected, credentialId: uuid(installation.credential_id) };
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally { db.release(); }
  }

  private async siteDraft(context: unknown, site: Site, references: readonly { proposalId: string; approvalId: string }[], draft: unknown,
    decision?: { context: unknown; digest: string; key?: KeyObject; operation?: "apply" | "restore"; recovery?: RecoveryEvidence }) {
    if (!Array.isArray(references) || references.length < 1) throw Error("Invalid draft page references");
    site = { organizationId: uuid(site.organizationId), webPresenceId: uuid(site.webPresenceId), managedSiteId: uuid(site.managedSiteId) };
    const db = await this.pool.connect();
    try {
      await db.query(decision && !decision.key ? "BEGIN ISOLATION LEVEL SERIALIZABLE" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await this.boundary(db);
      await db.query("SET LOCAL TIME ZONE 'UTC'");
      const reviewer = await this.operator.authorizeIn(db, context, "review-private-stage", site);
      const members = [];
      for (const ref of references) {
        const proposalId = uuid(ref.proposalId);
        const projection = await approvedProjection(db, site, proposalId, hash(ref.approvalId), this.disposableMediaRoot, this.workflowMedia);
        if (projection.approver === reviewer.operatorId) throw Error("Independent projection reviewer required");
        members.push({ ...site, ...projection, proposalId });
      }
      const result = bindSiteDraft(site, members, draft);
      const { rows: [installation] } = await db.query(`SELECT k.key_id,k.public_key,k.credential_id FROM wordpress_installations i
        JOIN wordpress_installation_keys k ON k.installation_id=i.id AND k.generation=i.generation
        WHERE i.id=$1 AND i.organization_id=$2 AND i.web_presence_id=$3 AND i.managed_site_id=$4 AND i.status='active'`,
      [result.candidate.installationId, site.organizationId, site.webPresenceId, site.managedSiteId]);
      if (!installation) throw Error("Draft installation scope mismatch");
      if (decision) {
        const authorizer = await this.operator.authorizeIn(db, decision.context, "authorize-native-draft", site);
        if (authorizer.operatorId === reviewer.operatorId || members.some(member => member.approver === authorizer.operatorId)) {
          throw Error("Independent draft authorizer required");
        }
        if (decision.digest !== result.digest) throw Error("Draft preview digest mismatch");
        const { installationId, siteProposalId, revision, previousDigest, rollback } = result.candidate;
        const key = [installationId, siteProposalId, revision];
        const values = [...key, result.digest, previousDigest, reviewer.authorityReference, authorizer.authorityReference];
        if (revision > 1 && !(await db.query(`SELECT 1 FROM wordpress_native_draft_authorizations WHERE installation_id=$1
          AND site_proposal_id=$2 AND revision=$3 AND candidate_digest=$4`,
        [installationId, siteProposalId, revision - 1, previousDigest])).rowCount) throw Error("Prior draft authorization mismatch");
        if (result.candidate.baselinePages && !rollback) {
          const evidence = decision.recovery;
          if (!evidence || evidence.credentialId !== installation.credential_id) throw Error("Prior Page receipt required");
          await evidence.journal.verifyAppliedBaseline({ installationId, siteProposalId,
            requestedDigest: hash(previousDigest), appliedDigest: hash(previousDigest), revision: revision - 1,
            paths: result.candidate.baselinePages.map(page => page.path) }, evidence.secret);
        }
        if (rollback) {
          const evidence = decision.recovery;
          if (!evidence || evidence.credentialId !== installation.credential_id) throw Error("Installation recovery evidence required");
          const prior = await db.query(`SELECT 1 FROM wordpress_native_draft_authorizations
            WHERE installation_id=$1 AND site_proposal_id=$2 AND revision=$3 AND candidate_digest=$4`,
          [installationId, siteProposalId, rollback.revision, rollback.digest]);
          if (prior.rowCount !== 1) throw Error("Rollback authorization missing");
          await evidence.journal.verifyMaterializedBaseline({ installationId, siteProposalId, requestedDigest: hash(previousDigest),
            appliedDigest: rollback.digest, revision: rollback.revision, paths: (result.candidate.baselinePages ?? result.candidate.pages).map(page => page.path) }, evidence.secret);
        }
        const head = (await db.query(`SELECT revision FROM wordpress_native_draft_authorizations
          WHERE installation_id=$1 AND site_proposal_id=$2 ORDER BY revision DESC LIMIT 1`, [installationId, siteProposalId])).rows[0]?.revision ?? 0;
        if (head > revision) throw Error("Native draft authorization superseded");
        if (!decision.key && head !== revision && head !== revision - 1) throw Error("Native draft authorization is out of sequence");
        if (!decision.key) await db.query(`INSERT INTO wordpress_native_draft_authorizations
          (installation_id,site_proposal_id,revision,candidate_digest,previous_digest,reviewer_grant_id,authorizer_grant_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (installation_id,site_proposal_id,revision) DO NOTHING`, values);
        if (!(await db.query(`SELECT 1 FROM wordpress_native_draft_authorizations WHERE installation_id=$1
          AND site_proposal_id=$2 AND revision=$3 AND candidate_digest=$4 AND previous_digest IS NOT DISTINCT FROM $5::text
          AND reviewer_grant_id=$6 AND authorizer_grant_id=$7`, values)).rowCount) throw Error("Draft authorization conflict");
        if (decision.key) {
          if (head !== revision) throw Error("Native draft authorization superseded");
          const envelope = nativeDraftEnvelope(result, installation.key_id, installation.public_key, decision.key, decision.operation ?? "apply");
          await db.query("COMMIT");
          return { ...result, envelope, copies: members.flatMap(member => member.copies) };
        }
      }
      await db.query("COMMIT");
      return result;
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally { db.release(); }
  }

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
