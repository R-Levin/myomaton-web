import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { drizzle } from "drizzle-orm/node-postgres";
import { eligibleSectionAssets } from "../../lib/platform/assets/presentation-queries";
import { SuppliedMediaIntake, type SuppliedMediaAuthority } from "../../lib/platform/acquisition/supplied-media";
import { AcquisitionService } from "../../lib/platform/acquisition/service";
import { PostgresProposalPersistence } from "../../lib/platform/content-editing/proposal-postgres";
import { SiteProposalService } from "../../lib/platform/content-editing/proposals";
import { SiteReleaseService } from "../../lib/platform/content-editing/releases";
import { enableDisposableSuppliedMedia } from "../../scripts/acquisition/supplied-disposable";
import { siteReleaseFixture } from "../../scripts/site-releases/disposable";
import type { SuppliedSource } from "../../lib/platform/acquisition/supplied-evidence";

test("operator-assisted supplied image reaches exact site release using the existing ledgers", async t => {
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
  const root = await mkdtemp(path.join(tmp, "miopages-supplied-raster-"));
  try {
    const { pool, scope } = fixture;
    const quarantine = path.join(root, "staging"), managed = path.join(root, "managed");
    await Promise.all([mkdir(quarantine), mkdir(managed)]);
    await enableDisposableSuppliedMedia(pool);
    const target = { ...scope, pageId: fixture.page.pageId, sectionId: fixture.page.sections[1].id };
    await pool.query("INSERT INTO pages(id,managed_site_id,slug,name,title) VALUES($1,$2,'/','Prior Page','Prior Page')", [target.pageId, scope.managedSiteId]);
    await pool.query("INSERT INTO sections(id,page_id,type,variant,name,content) VALUES($1,$2,'intro','stack','Prior Intro',$3)",
      [target.sectionId, target.pageId, { heading: "Prior Intro", text: "Prior text" }]);
    const credentials = { "receive-supplied-media": {}, "review-supplied-media": {}, "revoke-supplied-media": {} };
    const authority: SuppliedMediaAuthority = { async authorize(context, operation, placement) {
      assert.equal(context, credentials[operation], "Missing scoped intake authority");
      assert.deepEqual(placement, target, "Foreign scope");
      return { operatorId: operation, authorityReference: "synthetic scoped operator grant" };
    } };
    const intake = new SuppliedMediaIntake(pool, authority, quarantine, managed);
    const submit = credentials["receive-supplied-media"], review = credentials["review-supplied-media"], revoke = credentials["revoke-supplied-media"];
    const bytes = await sharp({ create: { width: 90, height: 60, channels: 3, background: "#6843cf" } }).png().toBuffer();
    const source: SuppliedSource = { kind: "upload", reference: "synthetic intake record 12", suppliedBy: "synthetic customer representative",
      claim: "specific-permission", evidenceReference: "synthetic written statement 34", existingAssetId: null };
    const submission = { submissionId: randomUUID(), source, bytes };
    const receive = (input = submission) => intake.receive(submit, target, input);
    const countAssets = async () => (await pool.query("SELECT count(*)::int AS n FROM assets WHERE web_presence_id=$1", [scope.webPresenceId])).rows[0].n;
    const proposals = new SiteProposalService(pool, fixture.authority, new PostgresProposalPersistence(pool), managed);
    const releases = new SiteReleaseService(pool, fixture.releaseAuthority, managed);

    await t.test("scoped authority and actual bounded raster required", async () => {
      await assert.rejects(intake.receive(review, target, submission), /Missing scoped intake authority/);
      await assert.rejects(intake.receive(submit, { ...target, webPresenceId: randomUUID() }, submission), /Foreign scope/);
      await assert.rejects(receive({ ...submission, bytes: Buffer.alloc(20 * 1024 * 1024 + 1) }), /bounded raster/);
      await assert.rejects(receive({ ...submission, bytes: Buffer.from("<svg/>") }));
      await assert.rejects(receive({ ...submission, source: { ...source, kind: "authorized-asset", existingAssetId: randomUUID() } }), /bounded raster/);
      await assert.rejects(intake.receive(submit, target, { submissionId: randomUUID(), source: { ...source, kind: "authorized-asset", existingAssetId: randomUUID() } }), /owned source Asset/);
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM external_work")).rows[0].n, 0);
    });

    const [candidate, duplicate] = await Promise.all([receive(), receive()]);
    assert.equal(candidate.id, duplicate.id);
    assert.equal(candidate.subject_digest, duplicate.subject_digest);
    assert.equal(candidate.state, "proposed");
    assert.equal(await countAssets(), 0);
    const staged = await intake.inspect(review, target, candidate.id);
    assert.ok(staged.bytes.length);
    assert.equal(staged.candidate.provenance.sourceDigest?.toString().length, 64);
    const decision = { decision: "approve" as const, candidateId: candidate.id, subjectDigest: candidate.subject_digest,
      rights: { basis: "customer-attestation" as const, reference: source.evidenceReference! }, altText: "A purple sample image", reason: "Synthetic placement, accessibility and suitability review" };

    await t.test("conflicts, stale placement, changed bytes and rejection fail closed", async () => {
      await assert.rejects(receive({ ...submission, source: { ...source, claim: "license" } }), /idempotency conflict/);
      await assert.rejects(receive({ ...submission, bytes: Buffer.from("changed") }), /idempotency conflict/);
      await assert.rejects(intake.decide(submit, target, decision), /Missing scoped intake authority/);
      await assert.rejects(intake.decide(review, target, { ...decision, subjectDigest: "0".repeat(64) }), /Exact current/);
      await assert.rejects(intake.decide(review, target, { ...decision, rights: { ...decision.rights, basis: "independently-verified" } }), /conflicts/);
      await pool.query("UPDATE sections SET version=version+1 WHERE id=$1", [target.sectionId]);
      try { await assert.rejects(intake.decide(review, target, decision), /Stale supplied-media placement/); }
      finally { await pool.query("UPDATE sections SET version=version-1 WHERE id=$1", [target.sectionId]); }
      const stagedPath = path.join(quarantine, scope.webPresenceId, candidate.quarantine_key);
      await writeFile(stagedPath, Buffer.from("changed"));
      try { await assert.rejects(intake.decide(review, target, decision), /does not match/); }
      finally { await writeFile(stagedPath, staged.bytes); }
      const rejected = await receive({ ...submission, submissionId: randomUUID(), source: { ...source, kind: "website-reuse" } });
      const rejection = { decision: "reject" as const, candidateId: rejected.id, subjectDigest: rejected.subject_digest, reason: "Permission for this copied image is insufficient" };
      assert.deepEqual(await intake.decide(review, target, rejection), await intake.decide(review, target, rejection));
      await assert.rejects(intake.decide(review, target, { ...decision, candidateId: rejected.id, subjectDigest: rejected.subject_digest }), /not reviewable/);
      assert.equal(await countAssets(), 0);
    });

    await t.test("approval creates one unattached Asset and page approval reuses exact source evidence", async () => {
      await pool.query(`CREATE FUNCTION fail_supplied_ingestion() RETURNS trigger LANGUAGE plpgsql AS
        $$ BEGIN IF NEW.kind='ingestion' THEN RAISE EXCEPTION 'synthetic ingestion failure'; END IF; RETURN NEW; END $$`);
      await pool.query("CREATE TRIGGER fail_supplied_ingestion BEFORE INSERT ON external_work_events FOR EACH ROW EXECUTE FUNCTION fail_supplied_ingestion()");
      try { await assert.rejects(intake.decide(review, target, decision), /synthetic ingestion failure/); }
      finally { await pool.query("DROP TRIGGER fail_supplied_ingestion ON external_work_events"); await pool.query("DROP FUNCTION fail_supplied_ingestion()"); }
      assert.equal(await countAssets(), 0);
      assert.equal((await intake.inspect(review, target, candidate.id)).candidate.state, "proposed");
      const [applied, retried] = await Promise.all([intake.decide(review, target, decision), intake.decide(review, target, decision)]);
      assert.deepEqual(applied, retried);
      assert.ok(applied.assetId);
      assert.equal(await countAssets(), 1);
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM asset_usages WHERE web_presence_id=$1", [scope.webPresenceId])).rows[0].n, 0);
      const usageId = randomUUID(), assetId = applied.assetId;
      const page = { ...fixture.page, operation: "replace-page" as const, sections: fixture.page.sections.map(section => section.id === target.sectionId
        ? { ...section, image: { assetId, usageId, altText: decision.altText } } : section) };
      const prep = async () => {
        const { revision } = await proposals.prepare(fixture.operator, randomUUID(), scope, randomUUID(), page);
        assert.ok(revision);
        assert.equal(revision.candidate.media?.evidence.source, "customer-supplied");
        const preview = await proposals.preview(fixture.operator, revision.binding, randomUUID());
        assert.match(preview.html, /data:image\/png;base64,/);
        assert.match(preview.html, /customer-attestation/);
        const approval = await proposals.approve(fixture.approver, { binding: revision.binding, requestId: randomUUID(), previewDigest: preview.digest,
          previewEvent: preview.event, reference: "Synthetic exact candidate approval" });
        return { binding: revision.binding, previewDigest: preview.digest, approvalEvent: approval.hash, requestId: randomUUID(), reference: "Synthetic release mandate" };
      };
      const before = await releases.inspect(fixture.inspectContext, scope);
      const first = await prep(), second = await prep();
      const release = await releases.release(fixture.releaseContext, first);
      assert.equal((await pool.query("SELECT asset_id FROM asset_usages WHERE id=$1", [usageId])).rows[0].asset_id, assetId);
      assert.equal((await eligibleSectionAssets(drizzle(pool), scope.webPresenceId, [target.sectionId], scope.managedSiteId)).size, 0);
      await releases.rollback(fixture.rollbackContext, scope, { releaseId: release.id, expectedFingerprint: release.after_fingerprint,
        requestId: randomUUID(), reference: "Synthetic rollback" });
      assert.equal((await releases.inspect(fixture.inspectContext, scope)).fingerprint, before.fingerprint);
      const revokeInput = { decision: "revoke" as const, candidateId: candidate.id, subjectDigest: candidate.subject_digest, reason: "Supplier withdrew permission" };
      await assert.rejects(new AcquisitionService(pool, quarantine).decide(scope.webPresenceId, candidate.work_id, { ...revokeInput,
        digest: candidate.subject_digest, revision: 1, actor: "different entry point" }), /Unknown owned work/);
      await assert.rejects(intake.decide(review, target, revokeInput), /Missing scoped intake authority/);
      assert.deepEqual(await intake.decide(revoke, target, revokeInput), await intake.decide(revoke, target, revokeInput));
      await assert.rejects(releases.release(fixture.releaseContext, second), /Current supplied-media permission/);
      await assert.rejects(intake.decide(review, target, decision), /not reviewable/);
    });

    await t.test("authorized reuse pins the owned original and records a separate verification reference", async () => {
      const original = randomUUID();
      await pool.query(`INSERT INTO assets(id,web_presence_id,name,type,mime_type,width,height,alt_text,source_type,source_reference)
        VALUES($1,$2,'Owned original','image','image/png',$3,$4,'Original sample','managed',$5)`,
      [original, scope.webPresenceId, candidate.width, candidate.height, candidate.quarantine_key]);
      const reuse = await intake.receive(submit, target, { submissionId: randomUUID(), source: { ...source, kind: "authorized-asset", existingAssetId: original } });
      assert.equal(reuse.provenance.transformation, "reuse-prepared/1");
      assert.equal(reuse.bytes_digest, candidate.bytes_digest);
      const approval = { ...decision, candidateId: reuse.id, subjectDigest: reuse.subject_digest,
        rights: { basis: "independently-verified" as const, reference: "Independent synthetic permission record" } };
      await pool.query("UPDATE assets SET version=version+1 WHERE id=$1", [original]);
      try { await assert.rejects(intake.decide(review, target, approval), /source Asset changed/); }
      finally { await pool.query("UPDATE assets SET version=version-1 WHERE id=$1", [original]); }
      const result = await intake.decide(review, target, approval);
      assert.ok(result.assetId && result.assetId !== original);
      const originalRow = (await pool.query("SELECT name,version,metadata FROM assets WHERE id=$1", [original])).rows[0];
      assert.deepEqual(originalRow, { name: "Owned original", version: 1, metadata: {} });
    });
  } finally {
    try { await fixture.stop(); }
    finally {
      assert.equal(await realpath(root), root);
      assert.equal(path.dirname(root), tmp);
      assert.match(path.basename(root), /^miopages-supplied-raster-/);
      await rm(root, { recursive: true });
    }
  }
});
