import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { JSDOM } from "jsdom";
import sharp from "sharp";
import { prepareManagedBytes } from "../../lib/platform/assets/ingestion";
import { provisionManagedObject } from "../../lib/platform/assets/local-storage";
import { eligibleSectionAssets } from "../../lib/platform/assets/presentation-queries";
import { PostgresProposalPersistence } from "../../lib/platform/content-editing/proposal-postgres";
import { SiteProposalService } from "../../lib/platform/content-editing/proposals";
import { SiteReleaseService } from "../../lib/platform/content-editing/releases";
import type { PageProposal } from "../../lib/platform/content-editing/proposal";
import { siteReleaseFixture } from "../../scripts/site-releases/disposable";

test("one permissioned Intro raster through exact preview, release and rollback", async t => {
  const url = process.env.ASSET_TEST_DATABASE_URL;
  assert.ok(url, "Disposable PostgreSQL URL required");
  const db = new URL(url);
  assert.equal(db.hostname, "127.0.0.1");
  assert.notEqual(db.port, "5432");
  assert.match(db.pathname, /^\/migration_rehearsal_[a-f0-9]{32}$/);
  Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_SITE_PROPOSALS: "local-operator",
    MIOPAGES_SITE_RELEASES: "disposable-operator", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" });
  const fixture = await siteReleaseFixture(url);
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "miopages-intro-media-"));
  try {
    const { pool, scope } = fixture;
    const proposals = new SiteProposalService(pool, fixture.authority, new PostgresProposalPersistence(pool), root);
    const releases = new SiteReleaseService(pool, fixture.releaseAuthority, root);
    const assetId = randomUUID(), usageId = randomUUID(), intro = fixture.page.sections[1];
    const original = await sharp({ create: { width: 120, height: 80, channels: 3, background: "#6843cf" } }).png().toBuffer();
    const prepared = await prepareManagedBytes(original);
    assert.equal(prepared.mimeType, "image/png");
    const source = { source: "synthetic-project-raster", sourceDigest: createHash("sha256").update(original).digest("hex"),
      permission: "disposable-preview-release", reference: "Project-created raster authorized for this synthetic proof" };
    const metadata = { proposalFixture: source };
    const objectPath = path.join(root, scope.webPresenceId, prepared.sourceReference);
    await provisionManagedObject(root, scope.webPresenceId, prepared.sourceReference, prepared.bytes);
    await pool.query(`INSERT INTO assets(id,web_presence_id,name,type,mime_type,width,height,alt_text,source_type,source_reference,metadata)
      VALUES($1,$2,'Synthetic raster','image','image/png',$3,$4,'Purple sample','managed',$5,$6)`,
    [assetId, scope.webPresenceId, prepared.width, prepared.height, prepared.sourceReference, metadata]);
    await pool.query("INSERT INTO pages(id,managed_site_id,slug,name,title) VALUES($1,$2,'/','Prior Page','Prior Page')",
      [fixture.page.pageId, scope.managedSiteId]);
    await pool.query("INSERT INTO sections(id,page_id,type,variant,name,content) VALUES($1,$2,'intro','stack','Prior Intro',$3)",
      [intro.id, fixture.page.pageId, { heading: "Prior Intro", text: "Prior text" }]);
    const page: PageProposal = { ...fixture.page, operation: "replace-page", sections: fixture.page.sections.map(section =>
      section.id === intro.id ? { ...section, image: { assetId, usageId, altText: "Purple raster in the proposed Intro" } } : section) };
    const inspect = () => releases.inspect(fixture.inspectContext, scope);
    const prepare = async (candidate = page) => (await proposals.prepare(fixture.operator, randomUUID(), scope, randomUUID(), candidate)).revision!;
    const before = await inspect();

    await t.test("only the designated fixture and scoped disposable composition can prepare", async () => {
      await assert.rejects(fixture.service.prepare(fixture.operator, randomUUID(), scope, randomUUID(), page), /media is unavailable/);
      await assert.rejects(prepare({ ...page, sections: page.sections.map(section => section.image ? { ...section, id: randomUUID() } : section) }), /existing active Intro/);
      await assert.rejects(prepare({ ...page, sections: page.sections.map(section => section.image ? { ...section, image: { ...section.image, assetId: randomUUID() } } : section) }), /owned fixture raster/);
      const collision = randomUUID();
      await pool.query("INSERT INTO asset_usages(id,web_presence_id,asset_id,entity_type,entity_id,role) VALUES($1,$2,$3,'section',$4,'attachment')",
        [collision, scope.webPresenceId, assetId, intro.id]);
      try { await assert.rejects(prepare(), /Conflicting or unreviewed AssetUsage/); }
      finally { await pool.query("DELETE FROM asset_usages WHERE id=$1", [collision]); }
      assert.deepEqual(await inspect(), before);
    });

    const exercise = async () => {
      const initial = await inspect();
      const revision = await prepare();
      const previewRequest = randomUUID();
      const preview = await proposals.preview(fixture.operator, revision.binding, previewRequest);
      assert.deepEqual(await proposals.preview(fixture.operator, revision.binding, previewRequest), preview);
      const { document } = new JSDOM(preview.html).window;
      const images = [...document.querySelectorAll<HTMLImageElement>("main img")];
      assert.equal(images.length, 1);
      assert.equal(images[0].closest("section")?.querySelector("h2")?.textContent, "Who this is for");
      assert.equal(images[0].alt, "Purple raster in the proposed Intro");
      assert.equal(images[0].getAttribute("width"), "120");
      assert.equal(images[0].getAttribute("height"), "80");
      assert.equal(images[0].getAttribute("src"), `data:image/png;base64,${prepared.bytes.toString("base64")}`);
      assert.equal(revision.candidate.media?.preparedDigest, prepared.sourceReference.slice(8));
      assert.deepEqual(revision.candidate.media?.evidence, source);
      const consent = { binding: revision.binding, previewDigest: preview.digest, previewEvent: preview.event, requestId: randomUUID(), reference: "Synthetic exact image and copy approval" };
      await assert.rejects(proposals.approve(fixture.approver, { ...consent, previewDigest: "0".repeat(64) }), /Exact reviewed preview/);
      await writeFile(objectPath, Buffer.from("different bytes"));
      try { await assert.rejects(proposals.approve(fixture.approver, consent), /Prepared media bytes/); }
      finally { await writeFile(objectPath, prepared.bytes); }
      const approval = await proposals.approve(fixture.approver, consent);
      assert.deepEqual(await proposals.approve(fixture.approver, consent), approval);
      assert.equal((await proposals.inspect(fixture.operator, revision.binding.proposalId, scope)).approvalValid, true);
      const request = { binding: revision.binding, previewDigest: preview.digest, approvalEvent: approval.hash, requestId: randomUUID(), reference: "Synthetic release authority" };
      await assert.rejects(releases.release(fixture.approver, request), /authority/);
      await pool.query("UPDATE assets SET metadata=$2 WHERE id=$1", [assetId, { proposalFixture: { ...source, permission: "revoked" } }]);
      try { await assert.rejects(releases.release(fixture.releaseContext, request), /Stale canonical site base/); }
      finally { await pool.query("UPDATE assets SET metadata=$2 WHERE id=$1", [assetId, metadata]); }
      await writeFile(objectPath, Buffer.from("different bytes"));
      try { await assert.rejects(releases.release(fixture.releaseContext, request), /Prepared media bytes/); }
      finally { await writeFile(objectPath, prepared.bytes); }
      assert.deepEqual(await inspect(), initial);
      await pool.query(`CREATE FUNCTION reject_fixture_event() RETURNS trigger LANGUAGE plpgsql AS
        $$ BEGIN RAISE EXCEPTION 'synthetic release ledger failure'; END $$`);
      await pool.query("CREATE TRIGGER reject_fixture_event BEFORE INSERT ON site_content_events FOR EACH ROW EXECUTE FUNCTION reject_fixture_event()");
      try { await assert.rejects(releases.release(fixture.releaseContext, request), /synthetic release ledger failure/); }
      finally { await pool.query("DROP TRIGGER reject_fixture_event ON site_content_events"); await pool.query("DROP FUNCTION reject_fixture_event()"); }
      assert.deepEqual(await inspect(), initial);

      const [release, retry] = await Promise.all([releases.release(fixture.releaseContext, request), releases.release(fixture.releaseContext, request)]);
      assert.deepEqual(retry, release);
      await assert.rejects(releases.release(fixture.releaseContext, { ...request, reference: "Conflicting retry" }), /idempotency conflict/);
      const actual = (await pool.query("SELECT * FROM asset_usages WHERE id=$1", [usageId])).rows[0];
      assert.equal(actual.asset_id, assetId);
      assert.equal(actual.entity_id, intro.id);
      assert.equal(actual.role, "image");
      assert.deepEqual(actual.configuration, revision.candidate.media?.configuration);
      assert.equal(actual.version, revision.candidate.media?.priorUsage ? 5 : 1);
      assert.equal((await eligibleSectionAssets(drizzle(pool), scope.webPresenceId, [intro.id], scope.managedSiteId)).size, 0);
      assert.equal((await inspect()).fingerprint, release.after_fingerprint);
      const rollbackRequest = { releaseId: release.id, expectedFingerprint: release.after_fingerprint, requestId: randomUUID(), reference: "Synthetic rollback authority" };
      await assert.rejects(releases.rollback(fixture.releaseContext, scope, rollbackRequest), /authority/);
      await pool.query("UPDATE asset_usages SET configuration='{}' WHERE id=$1", [usageId]);
      try { await assert.rejects(releases.rollback(fixture.rollbackContext, scope, rollbackRequest), /stale rollback base/); }
      finally { await pool.query("UPDATE asset_usages SET configuration=$2 WHERE id=$1", [usageId, actual.configuration]); }
      if (revision.candidate.media?.priorUsage) {
        await writeFile(objectPath, Buffer.from("different bytes"));
        try { await assert.rejects(releases.rollback(fixture.rollbackContext, scope, rollbackRequest), /Prepared media bytes/); }
        finally { await writeFile(objectPath, prepared.bytes); }
      }
      const rollback = await releases.rollback(fixture.rollbackContext, scope, rollbackRequest);
      assert.deepEqual(await releases.rollback(fixture.rollbackContext, scope, rollbackRequest), rollback);
      const restored = await inspect();
      assert.deepEqual(restored.base, initial.base);
      assert.equal(restored.fingerprint, initial.fingerprint);
      assert.equal(restored.history.length, initial.history.length + 2);
      assert.equal(rollback.after_fingerprint, release.before_fingerprint);
    };
    await t.test("an empty slot is populated and rollback removes the exact usage", exercise);
    await t.test("an existing usage is restored with its original metadata, version and microseconds", async () => {
      await pool.query(`INSERT INTO asset_usages(id,web_presence_id,asset_id,entity_type,entity_id,role,configuration,metadata,version,created_at,updated_at)
        VALUES($1,$2,$3,'section',$4,'image','{"image":{"altText":"Prior contextual alt","decorative":false}}',
          '{"retained":true}',4,'2026-01-01T01:02:03.123456Z','2026-01-02T01:02:03.654321Z')`, [usageId, scope.webPresenceId, assetId, intro.id]);
      await exercise();
      const prior = (await pool.query("SELECT to_jsonb(u) AS usage FROM asset_usages u WHERE id=$1", [usageId])).rows[0].usage;
      assert.equal(prior.created_at, "2026-01-01T01:02:03.123456+00:00");
      assert.equal(prior.updated_at, "2026-01-02T01:02:03.654321+00:00");
      assert.deepEqual(prior.metadata, { retained: true });
      assert.equal(prior.configuration.image.altText, "Prior contextual alt");
    });
  } finally {
    try { await fixture.stop(); }
    finally {
      assert.equal(await realpath(root), root);
      assert.match(path.basename(root), /^miopages-intro-media-/);
      assert.equal(path.dirname(root), await realpath(tmpdir()));
      await rm(root, { recursive: true });
    }
  }
});
