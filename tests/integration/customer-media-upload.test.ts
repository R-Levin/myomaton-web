import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { fingerprint } from "../../lib/platform/canonical/model";
import { readManagedObject } from "../../lib/platform/assets/local-storage";
import { type CustomerUploadAuthority, type UploadAgreement } from "../../lib/platform/acquisition/customer-upload";
import { SuppliedMediaIntake, type SuppliedMediaAuthority } from "../../lib/platform/acquisition/supplied-media";
import { PostgresProposalPersistence } from "../../lib/platform/content-editing/proposal-postgres";
import { SiteProposalService } from "../../lib/platform/content-editing/proposals";
import { SiteReleaseService } from "../../lib/platform/content-editing/releases";
import { siteReleaseFixture } from "../../scripts/site-releases/disposable";
import { enableDisposableSuppliedMedia } from "../../scripts/acquisition/supplied-disposable";

test("authenticated customer PNG uses verified standing agreement through existing exact release", async t => {
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
  const root = await mkdtemp(path.join(tmp, "miopages-customer-upload-"));
  try {
    const { pool, scope } = fixture;
    const quarantine = path.join(root, "staging"), managed = path.join(root, "managed");
    await Promise.all([mkdir(quarantine), mkdir(managed)]);
    await enableDisposableSuppliedMedia(pool);
    const target = { ...scope, pageId: fixture.page.pageId, sectionId: fixture.page.sections[1].id };
    await pool.query("INSERT INTO pages(id,managed_site_id,slug,name,title) VALUES($1,$2,'/','Prior Page','Prior Page')", [target.pageId, scope.managedSiteId]);
    await pool.query("INSERT INTO sections(id,page_id,type,variant,name,content) VALUES($1,$2,'intro','stack','Prior Intro',$3)",
      [target.sectionId, target.pageId, { heading: "Prior Intro", text: "Prior text" }]);
    const reviewer = {}, withdrawer = {};
    const operator: SuppliedMediaAuthority = { async authorize(context, operation, placement) {
      assert.deepEqual(placement, target);
      assert.ok((context === reviewer && operation === "review-supplied-media")
        || (context === withdrawer && operation === "revoke-supplied-media"), "Distinct scoped Operator authority required");
      return { operatorId: operation, authorityReference: "synthetic operator grant" };
    } };
    const token = randomBytes(32).toString("hex");
    const accepted: UploadAgreement = { submitterId: "synthetic uploader", submissionGrant: "synthetic upload-only grant",
      version: "synthetic-service-agreement/1", acceptanceReference: "synthetic acceptance 18",
      acceptedBy: "synthetic authorized representative", acceptedAt: new Date(Date.now() - 1000).toISOString(), use: "disposable-intro-image" };
    let supplied: UploadAgreement | null = accepted;
    let current: UploadAgreement | null = accepted;
    let permission: "current" | "withdrawn" | "disputed" = "current";
    const customer: CustomerUploadAuthority = {
      async authenticate(credential, placement) {
        return credential === token && fingerprint(placement) === fingerprint(target) ? structuredClone(supplied) : null;
      },
      async verifyCurrent(db, placement, evidence) {
        assert.equal((await db.query("SELECT current_schema() AS schema")).rows[0].schema, fixture.schema);
        return permission === "current" && fingerprint(placement) === fingerprint(target) && fingerprint(evidence) === fingerprint(current);
      },
    };
    const intake = new SuppliedMediaIntake(pool, operator, quarantine, managed, customer);
    const proposals = new SiteProposalService(pool, fixture.authority, new PostgresProposalPersistence(pool), managed, customer.verifyCurrent);
    const releases = new SiteReleaseService(pool, fixture.releaseAuthority, managed, customer.verifyCurrent);
    const original = await sharp({ create: { width: 120, height: 90, channels: 3, background: "#305a45" } }).withMetadata().png().toBuffer();
    const submissionId = randomUUID();
    function request(body: RequestInit["body"] = Uint8Array.from(original), key = submissionId, headers: Record<string, string> = {}) {
      return new Request("https://fixture.invalid/upload", { method: "POST", body, duplex: "half",
        headers: { "content-type": "image/png", authorization: "Bearer " + token, "idempotency-key": key, ...headers },
      } as RequestInit & { duplex: "half" });
    }

    await t.test("authenticates before reading and requires verified current agreement for the exact tenant", async () => {
      let pulls = 0;
      const body = new ReadableStream<Uint8Array>({ pull(controller) { pulls++; controller.close(); } }, { highWaterMark: 0 });
      await assert.rejects(intake.receiveCustomer(request(body, submissionId, { authorization: "" }), target), /Authenticated customer/);
      assert.equal(pulls, 0);
      await assert.rejects(intake.receiveCustomer(request(undefined, submissionId, { authorization: "Bearer " + "0".repeat(64),
        "x-agreement-reference": accepted.acceptanceReference }), target), /Verified customer/);
      await assert.rejects(intake.receiveCustomer(request(), { ...target, webPresenceId: randomUUID() }), /Verified customer/);
      supplied = null;
      await assert.rejects(intake.receiveCustomer(request(), target), /Verified customer/);
      supplied = { ...accepted, acceptedAt: "invalid" };
      await assert.rejects(intake.receiveCustomer(request(), target), /agreement acceptance/);
      supplied = { ...accepted, acceptanceReference: "synthetic but unverified" };
      await assert.rejects(intake.receiveCustomer(request(), target), /no longer current/);
      supplied = accepted;
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM external_work")).rows[0].n, 0);
    });

    await t.test("checks actual PNG, bounded streams and request framing", async () => {
      await assert.rejects(intake.receiveCustomer(request(Uint8Array.from([1, 2, 3])), target), /declared PNG/);
      await assert.rejects(intake.receiveCustomer(request(Uint8Array.from(original.subarray(0, 10))), target));
      await assert.rejects(intake.receiveCustomer(request(undefined, submissionId, { "content-length": "1048577" }), target), /size limits/);
      await assert.rejects(intake.receiveCustomer(request(undefined, submissionId, { "content-length": "100" }), target), /declared PNG/);
      await assert.rejects(intake.receiveCustomer(request(undefined, submissionId, { "content-encoding": "gzip" }), target), /uncompressed PNG/);
      const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); controller.enqueue(Uint8Array.of(1)); controller.close(); } });
      await assert.rejects(intake.receiveCustomer(request(stream), target), /size limits/);
      const abort = new AbortController();
      let started!: () => void;
      const reading = new Promise<void>(resolve => { started = resolve; });
      const stalled = new ReadableStream<Uint8Array>({ pull() { started(); } }, { highWaterMark: 0 });
      const pending = assert.rejects(intake.receiveCustomer(new Request(request(stalled), { signal: abort.signal }), target), /aborted/);
      await reading;
      abort.abort();
      await pending;
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM media_candidates")).rows[0].n, 0);
    });

    const [receipt, retry] = await Promise.all([intake.receiveCustomer(request(), target), intake.receiveCustomer(request(), target)]);
    assert.deepEqual(retry, receipt);
    assert.equal(receipt.state, "proposed");
    const staged = await intake.inspect(reviewer, target, receipt.candidateId);
    const sourceDigest = createHash("sha256").update(original).digest("hex");
    assert.equal(staged.candidate.provenance.sourceDigest, sourceDigest);
    assert.notEqual(staged.candidate.bytes_digest, sourceDigest);
    assert.deepEqual(await readManagedObject(quarantine, scope.webPresenceId, "objects/" + sourceDigest), original);
    assert.deepEqual(staged.candidate.provenance.source, { kind: "authenticated-upload", agreement: accepted, existingAssetId: null });
    const audit = await pool.query("SELECT kind,payload,created_at FROM external_work_events WHERE work_id=$1", [staged.candidate.work_id]);
    assert.equal(audit.rows.find(row => row.kind === "queued")?.payload.submissionId, submissionId);
    assert.ok(audit.rows.every(row => row.created_at instanceof Date));
    assert.ok(!JSON.stringify([audit.rows, staged.candidate]).includes(token));
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM assets WHERE web_presence_id=$1", [scope.webPresenceId])).rows[0].n, 0);

    const approval = { candidateId: receipt.candidateId, subjectDigest: receipt.subjectDigest, decision: "approve" as const,
      rights: { basis: "service-agreement" as const, reference: accepted.acceptanceReference }, altText: "Green sample image", reason: "Routine image suitable for the Intro" };

    await t.test("conflicting retries, disputed evidence, altered original and rejected candidates refuse", async () => {
      supplied = current = { ...accepted, version: "synthetic-service-agreement/2" };
      await assert.rejects(intake.receiveCustomer(request(), target), /idempotency conflict/);
      await assert.rejects(intake.decide(reviewer, target, approval), /no longer current/);
      supplied = current = accepted;
      const changedBytes = Buffer.concat([original, Buffer.of(1)]);
      await assert.rejects(intake.receiveCustomer(request(Uint8Array.from(changedBytes)), target), /idempotency conflict/);
      await assert.rejects(intake.decide(token, target, approval), /Distinct scoped/);
      await assert.rejects(intake.decide(reviewer, target, { ...approval, rights: { ...approval.rights, basis: "customer-attestation" } }), /conflicts/);
      permission = "disputed";
      await assert.rejects(intake.decide(reviewer, target, approval), /no longer current/);
      permission = "current";
      const sourcePath = path.join(quarantine, scope.webPresenceId, "objects", sourceDigest);
      await writeFile(sourcePath, Buffer.from("tampered"));
      try { await assert.rejects(intake.decide(reviewer, target, approval), /does not match/); }
      finally { await writeFile(sourcePath, original); }
      const rejected = await intake.receiveCustomer(request(undefined, randomUUID()), target);
      await intake.decide(reviewer, target, { ...rejected, decision: "reject", reason: "Suitable rights evidence does not make this image suitable for the site" });
      await assert.rejects(intake.decide(reviewer, target, { ...approval, ...rejected }), /not reviewable/);
    });

    await t.test("agreement is bound to the exact page preview and rechecked at release", async () => {
      const approved = await intake.decide(reviewer, target, approval);
      assert.deepEqual(await intake.decide(reviewer, target, approval), approved);
      const { assetId } = approved;
      assert.ok(assetId);
      const usageId = randomUUID();
      const page = { ...fixture.page, operation: "replace-page" as const, sections: fixture.page.sections.map(section => section.id === target.sectionId
        ? { ...section, image: { assetId, usageId, altText: approval.altText } } : section) };
      const inspect = () => releases.inspect(fixture.inspectContext, scope);
      const before = await inspect();
      const prepared = await proposals.prepare(fixture.operator, randomUUID(), scope, randomUUID(), page);
      const binding = prepared.revision!.binding;
      const media = prepared.revision?.candidate.media;
      assert.ok(media?.evidence.source === "customer-supplied");
      assert.deepEqual(media.evidence.agreement, accepted);
      const preview = await proposals.preview(fixture.operator, binding, randomUUID());
      assert.match(preview.html, /service-agreement/);
      assert.match(preview.html, /data:image\/png;base64,/);
      const consent = await proposals.approve(fixture.approver, { binding, requestId: randomUUID(), previewDigest: preview.digest,
        previewEvent: preview.event, reference: "Synthetic exact page consent" });
      const releaseInput = { binding, previewDigest: preview.digest, approvalEvent: consent.hash, requestId: randomUUID(), reference: "Synthetic distinct release mandate" };
      await assert.rejects(new SiteReleaseService(pool, fixture.releaseAuthority, managed).release(fixture.releaseContext, releaseInput), /no longer current/);
      for (const state of ["withdrawn", "disputed"] as const) {
        permission = state;
        await assert.rejects(releases.release(fixture.releaseContext, releaseInput), /no longer current/);
      }
      permission = "current";
      current = { ...accepted, submissionGrant: "superseded synthetic grant" };
      await assert.rejects(releases.release(fixture.releaseContext, releaseInput), /no longer current/);
      current = accepted;
      const managedPath = path.join(managed, scope.webPresenceId, staged.candidate.quarantine_key);
      await writeFile(managedPath, Buffer.from("tampered"));
      try { await assert.rejects(releases.release(fixture.releaseContext, releaseInput), /Prepared media bytes/); }
      finally { await writeFile(managedPath, staged.bytes); }
      assert.deepEqual(await inspect(), before);
      const release = await releases.release(fixture.releaseContext, releaseInput);
      assert.deepEqual(await releases.release(fixture.releaseContext, releaseInput), release);
      assert.equal((await pool.query("SELECT asset_id FROM asset_usages WHERE id=$1", [usageId])).rows[0].asset_id, assetId);
      await releases.rollback(fixture.rollbackContext, scope, { releaseId: release.id, expectedFingerprint: release.after_fingerprint,
        requestId: randomUUID(), reference: "Synthetic rollback mandate" });
      assert.equal((await inspect()).fingerprint, before.fingerprint);
      await intake.decide(withdrawer, target, { candidateId: receipt.candidateId, subjectDigest: receipt.subjectDigest, decision: "revoke", reason: "Synthetic image-specific withdrawal" });
      await assert.rejects(proposals.prepare(fixture.operator, randomUUID(), scope, randomUUID(), page), /Current supplied-media permission/);
    });
  } finally {
    try { await fixture.stop(); }
    finally {
      assert.equal(await realpath(root), root);
      assert.equal(path.dirname(root), tmp);
      assert.match(path.basename(root), /^miopages-customer-upload-/);
      await rm(root, { recursive: true });
    }
  }
});
