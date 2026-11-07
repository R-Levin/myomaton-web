import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { drizzle } from "drizzle-orm/node-postgres";
import { eligibleSectionAssets } from "../../lib/platform/assets/presentation-queries";
import { type StockSelection } from "../../lib/platform/acquisition/stock";
import { SuppliedMediaIntake, type SuppliedMediaAuthority } from "../../lib/platform/acquisition/supplied-media";
import { PostgresProposalPersistence } from "../../lib/platform/content-editing/proposal-postgres";
import { SiteProposalService } from "../../lib/platform/content-editing/proposals";
import { SiteReleaseService } from "../../lib/platform/content-editing/releases";
import { siteReleaseFixture } from "../../scripts/site-releases/disposable";
import { enableDisposableSuppliedMedia } from "../../scripts/acquisition/supplied-disposable";

test("synthetic permissioned stock raster uses the existing acquisition and release path", async t => {
  const url = process.env.ASSET_TEST_DATABASE_URL;
  assert.ok(url);
  const db = new URL(url);
  assert.equal(db.hostname, "127.0.0.1");
  assert.notEqual(db.port, "5432");
  assert.match(db.pathname, /^\/migration_rehearsal_[a-f0-9]{32}$/);
  Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_SITE_PROPOSALS: "local-operator",
    MIOPAGES_SITE_RELEASES: "disposable-operator", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" });
  const fixture = await siteReleaseFixture(url);
  const tmp = await realpath(tmpdir());
  const root = await mkdtemp(path.join(tmp, "miopages-stock-"));
  try {
    const { pool, scope } = fixture;
    const quarantine = path.join(root, "staging"), managed = path.join(root, "managed");
    await Promise.all([mkdir(quarantine), mkdir(managed)]);
    await enableDisposableSuppliedMedia(pool);
    const target = { ...scope, pageId: fixture.page.pageId, sectionId: fixture.page.sections[1].id };
    const otherSection = fixture.page.sections[2].id;
    await pool.query("INSERT INTO pages(id,managed_site_id,slug,name,title) VALUES($1,$2,'/','Prior Page','Prior Page')", [target.pageId, scope.managedSiteId]);
    for (const section of [target.sectionId, otherSection]) {
      await pool.query("INSERT INTO sections(id,page_id,type,variant,name,content) VALUES($1,$2,'intro','stack','Prior Intro',$3)",
        [section, target.pageId, { heading: "Prior Intro", text: "Prior text" }]);
    }
    const grants = { "receive-supplied-media": {}, "review-supplied-media": {}, "revoke-supplied-media": {} };
    const authority: SuppliedMediaAuthority = { async authorize(context, operation, placement) {
      assert.equal(context, grants[operation], "Missing scoped stock authority");
      assert.deepEqual(placement, target, "Foreign stock scope");
      return { operatorId: operation, authorityReference: "synthetic scoped Operator grant" };
    } };
    const intake = new SuppliedMediaIntake(pool, authority, quarantine, managed);
    const receive = grants["receive-supplied-media"], review = grants["review-supplied-media"], revoke = grants["revoke-supplied-media"];
    // Project-created fixture output, independent of all real stock providers.
    const bytes = await sharp({ create: { width: 120, height: 90, channels: 3, background: "#264653" } }).withMetadata().png().toBuffer();
    const selection: StockSelection = {
      provider: "synthetic-stock-library", sourceId: "project-raster-1", sourceUrl: "https://stock.fixture.invalid/photos/project-raster-1",
      creator: "MioPages synthetic fixture", representation: { id: "project-png-120x90", sourceDigest: createHash("sha256").update(bytes).digest("hex") },
      license: { reference: "synthetic-project-permission/1", use: "disposable-intro-image", copy: "allowed", expiresAt: new Date(Date.now() + 600_000).toISOString() },
      integration: { reference: "synthetic-local-integration/1", delivery: "managed-copy", attribution: "optional" },
    };
    const input = { submissionId: randomUUID(), selection, bytes };
    const countAssets = async () => (await pool.query("SELECT count(*)::int AS n FROM assets WHERE web_presence_id=$1", [scope.webPresenceId])).rows[0].n;
    const stage = () => intake.receiveStock(receive, target, input);

    await t.test("scoped fixture and explicitly permitted representation only", async () => {
      await assert.rejects(intake.receiveStock(review, target, input), /Missing scoped stock authority/);
      await assert.rejects(intake.receiveStock(receive, { ...target, webPresenceId: randomUUID() }, input), /Foreign stock scope/);
      await assert.rejects(intake.receiveStock(receive, { ...target, sectionId: otherSection }, input), /Foreign stock scope/);
      await assert.rejects(intake.receiveStock(receive, target, { ...input, selection: { ...selection, provider: "pexels" } }), /Synthetic stock source/);
      for (const changed of [
        { ...selection, license: { ...selection.license, copy: "prohibited" as const } },
        { ...selection, integration: { ...selection.integration, delivery: "provider-hosted-only" as const } },
        { ...selection, integration: { ...selection.integration, attribution: "required" as const } },
        { ...selection, license: { ...selection.license, reference: "unknown-license" } },
      ]) await assert.rejects(intake.receiveStock(receive, target, { ...input, selection: changed }), /Unsupported stock license/);
      await assert.rejects(intake.receiveStock(receive, target, { ...input, selection: { ...selection,
        license: { ...selection.license, expiresAt: new Date(0).toISOString() } } }), /Current stock permission/);
      await assert.rejects(intake.receiveStock(receive, target, { ...input, bytes: Buffer.from("changed") }), /representation bytes changed/);
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM external_work")).rows[0].n, 0);
      assert.equal(await countAssets(), 0);
    });

    const [candidate, duplicate] = await Promise.all([stage(), stage()]);
    assert.deepEqual(duplicate, candidate);
    assert.equal(candidate.state, "proposed");
    assert.equal(candidate.source_kind, "permissioned-stock");
    assert.equal(candidate.provider, selection.provider);
    assert.notEqual(candidate.bytes_digest, selection.representation.sourceDigest);
    assert.deepEqual(candidate.provenance.source, { kind: "permissioned-stock", selection, existingAssetId: null });
    assert.equal(await countAssets(), 0);
    const staged = await intake.inspect(review, target, candidate.id);
    const decision = { candidateId: candidate.id, subjectDigest: candidate.subject_digest, decision: "approve" as const,
      rights: { basis: "provider-license" as const, reference: selection.license.reference }, altText: "Deep blue sample", reason: "Suitable context and synthetic permission verified" };

    await t.test("conflicts, stale placement, tampering and rejection leave no Asset", async () => {
      await assert.rejects(intake.receiveStock(receive, target, { ...input, selection: { ...selection, creator: "Different credit" } }), /idempotency conflict/);
      await assert.rejects(intake.decide(review, target, { ...decision, rights: { ...decision.rights, basis: "service-agreement" } }), /Exact reviewed stock license/);
      await assert.rejects(intake.decide(review, target, { ...decision, subjectDigest: "0".repeat(64) }), /Exact current/);
      await pool.query("UPDATE sections SET version=version+1 WHERE id=$1", [target.sectionId]);
      try { await assert.rejects(intake.decide(review, target, decision), /Stale supplied-media placement/); }
      finally { await pool.query("UPDATE sections SET version=version-1 WHERE id=$1", [target.sectionId]); }
      const stagedPath = path.join(quarantine, scope.webPresenceId, candidate.quarantine_key);
      await writeFile(stagedPath, Buffer.from("changed"));
      try { await assert.rejects(intake.decide(review, target, decision), /does not match/); }
      finally { await writeFile(stagedPath, staged.bytes); }
      const rejected = await intake.receiveStock(receive, target, { ...input, submissionId: randomUUID() });
      await intake.decide(review, target, { candidateId: rejected.id, subjectDigest: rejected.subject_digest, decision: "reject", reason: "Unhelpful illustration" });
      await assert.rejects(intake.decide(review, target, { ...decision, candidateId: rejected.id, subjectDigest: rejected.subject_digest }), /not reviewable/);
      assert.equal(await countAssets(), 0);
    });

    await t.test("stock evidence is bound to exact placement, release, rollback and withdrawal", async t => {
      const approved = await intake.decide(review, target, decision);
      assert.deepEqual(await intake.decide(review, target, decision), approved);
      const assetId = approved.assetId;
      assert.ok(assetId);
      assert.equal(await countAssets(), 1);
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM asset_usages WHERE web_presence_id=$1", [scope.webPresenceId])).rows[0].n, 0);
      const usageId = randomUUID();
      const pageAt = (sectionId: string) => ({ ...fixture.page, operation: "replace-page" as const, sections: fixture.page.sections.map(section =>
        section.id === sectionId ? { ...section, image: { assetId, usageId, altText: decision.altText } } : section) });
      const proposals = new SiteProposalService(pool, fixture.authority, new PostgresProposalPersistence(pool), managed);
      const releases = new SiteReleaseService(pool, fixture.releaseAuthority, managed);
      const inspect = () => releases.inspect(fixture.inspectContext, scope);
      await assert.rejects(proposals.prepare(fixture.operator, randomUUID(), scope, randomUUID(), pageAt(otherSection)), /rights review, placement and alt text/);
      const { revision } = await proposals.prepare(fixture.operator, randomUUID(), scope, randomUUID(), pageAt(target.sectionId));
      assert.ok(revision?.candidate.media?.evidence.source === "permissioned-stock");
      assert.deepEqual(revision.candidate.media.evidence.stock, selection);
      const preview = await proposals.preview(fixture.operator, revision.binding, randomUUID());
      assert.match(preview.html, /Synthetic stock evidence/);
      assert.match(preview.html, /synthetic-stock-library/);
      assert.match(preview.html, /provider-license/);
      assert.match(preview.html, /data:image\/png;base64,/);
      const consent = await proposals.approve(fixture.approver, { binding: revision.binding, previewDigest: preview.digest,
        previewEvent: preview.event, requestId: randomUUID(), reference: "Synthetic exact stock consent" });
      const request = { binding: revision.binding, previewDigest: preview.digest, approvalEvent: consent.hash, requestId: randomUUID(), reference: "Synthetic separate release authority" };
      const before = await inspect();
      t.mock.timers.enable({ apis: ["Date"], now: new Date(selection.license.expiresAt) });
      try { await assert.rejects(releases.release(fixture.releaseContext, request), /Current stock permission/); }
      finally { t.mock.timers.reset(); }
      const managedPath = path.join(managed, scope.webPresenceId, candidate.quarantine_key);
      await writeFile(managedPath, Buffer.from("changed"));
      try { await assert.rejects(releases.release(fixture.releaseContext, request), /Prepared media bytes/); }
      finally { await writeFile(managedPath, staged.bytes); }
      assert.deepEqual(await inspect(), before);
      const release = await releases.release(fixture.releaseContext, request);
      assert.deepEqual(await releases.release(fixture.releaseContext, request), release);
      assert.equal((await pool.query("SELECT asset_id FROM asset_usages WHERE id=$1", [usageId])).rows[0].asset_id, assetId);
      assert.equal((await eligibleSectionAssets(drizzle(pool), scope.webPresenceId, [target.sectionId], scope.managedSiteId)).size, 0);
      const rollback = await releases.rollback(fixture.rollbackContext, scope, { releaseId: release.id, expectedFingerprint: release.after_fingerprint,
        requestId: randomUUID(), reference: "Synthetic rollback" });
      assert.equal(rollback.after_fingerprint, before.fingerprint);
      assert.deepEqual((await inspect()).base, before.base);
      const second = await proposals.prepare(fixture.operator, randomUUID(), scope, randomUUID(), pageAt(target.sectionId));
      const secondBinding = second.revision!.binding;
      const secondPreview = await proposals.preview(fixture.operator, secondBinding, randomUUID());
      const secondConsent = await proposals.approve(fixture.approver, { binding: secondBinding, previewDigest: secondPreview.digest,
        previewEvent: secondPreview.event, requestId: randomUUID(), reference: "Synthetic exact stock consent" });
      const withdrawal = { candidateId: candidate.id, subjectDigest: candidate.subject_digest, decision: "revoke" as const, reason: "Synthetic source permission withdrawn" };
      await assert.rejects(intake.decide(review, target, withdrawal), /Missing scoped stock authority/);
      await intake.decide(revoke, target, withdrawal);
      await assert.rejects(releases.release(fixture.releaseContext, { ...request, binding: secondBinding, previewDigest: secondPreview.digest,
        approvalEvent: secondConsent.hash, requestId: randomUUID() }), /Current supplied-media permission/);
    });
  } finally {
    try { await fixture.stop(); }
    finally {
      assert.equal(await realpath(root), root);
      assert.equal(path.dirname(root), tmp);
      assert.match(path.basename(root), /^miopages-stock-/);
      await rm(root, { recursive: true });
    }
  }
});
