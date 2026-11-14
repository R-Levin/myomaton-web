import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { lstat, readFile, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fingerprint } from "../lib/platform/canonical/model";
import { pageProposal, type Binding } from "../lib/platform/content-editing/proposal";
import { proposalPreview } from "../lib/platform/content-editing/proposal-preview";
import { siteBase } from "../lib/platform/content-editing/proposal-context";
import { migrationRole, operatorRole, protectedPool, verifyProtectedSession, protectedConnection } from "../lib/platform/wordpress-delivery/protected-connection";
import { protectedOperatorServices } from "../lib/platform/wordpress-delivery/protected-services";
import { NativeDraftReceiptJournal, verifyNativeDraftReceipt } from "../lib/platform/wordpress-delivery/native-draft-receipt";
import { readNativeDraftEnvelope } from "../lib/platform/wordpress-delivery/native-draft-envelope";
import { resolveProposalCandidate } from "../lib/platform/content-editing/proposal-media";
import { rehearsalSite } from "./db/wordpress-rehearsal-principals";

const digest = "1333ddc4e88cb0cdaef0ab379c16f3ac71e0c36dcb18160b2192350d5b70a4da";
const installationId = "d84ebc69-46d5-4c64-adc6-ac7b87468f89";
const siteProposalId = "1e28f792-624d-4141-96db-45c4ba05e17d";
const prior = "1a6343c049c0430e51ef7fa3780123c9475352af0328301d661a38a9b500eb2a";
const restored = "85786f251ed5b93e42d9ae2b8c7247d85d99280aa9b1bc5932a1321330a043db";
const base = "8c342e25aa3c962b98a9292bfd871873aca87364b0a6d44b3be6847c09a11ebd";
const scope = { webPresenceId: rehearsalSite.webPresenceId, managedSiteId: rehearsalSite.managedSiteId };
const permissions = ["revise-site-proposal", "preview-site-proposal", "inspect-site-proposal"] as const;
const refused = ["prepare-site-proposal", "approve-site-proposal", "review-private-stage", "authorize-native-draft",
  "enroll", "rotate", "revoke", "issue"] as const;
let stage = "custody";

async function privateFile(path: string) {
  const info = await lstat(path);
  assert.ok(info.isFile() && info.uid === process.getuid?.() && (info.mode & 511) === 384 && await realpath(path) === path);
  return readFile(path, "utf8");
}

async function main() {
  const home = await realpath(process.env.HOME ?? "");
  assert.equal(home, "/home/virtual/vps-bef564/5/53b4381d42");
  assert.equal(await realpath(process.cwd()), join(home, "miopages-wp-rehearsal"));
  const root = join(home, "miopages-wp-review-1333ddc4");
  const meta = await lstat(root);
  assert.ok(meta.isDirectory() && meta.uid === process.getuid?.() && (meta.mode & 511) === 448 && await realpath(root) === root);
  const check = process.argv.length === 3 && process.argv[2] === "--check";
  assert.ok(check || process.argv.length === 2);
  const credential = process.env.MIOPAGES_V15_MIGRATION_PASSWORD;
  delete process.env.MIOPAGES_V15_MIGRATION_PASSWORD;
  const ca = await readFile(join(home, "supabase-ca.crt"), "utf8");
  stage = "approved-input";
  const { approval, review, prepared } = JSON.parse(await privateFile(join(root, "input.json")));
  assert.equal(approval.scopeDigest, digest);
  const bound = approval.applicationScope;
  assert.equal(fingerprint(bound), digest);
  assert.equal(fingerprint(review.packet), bound.reviewInput);
  assert.equal(fingerprint(prepared.scope), bound.preparationScope);
  assert.equal(review.digest, bound.reviewInput);
  assert.equal(prepared.scope.prepared.inputDigest, review.digest);
  assert.deepEqual(review.packet.scope, scope);
  assert.deepEqual(bound.site, rehearsalSite);
  assert.equal(bound.canonicalBase, base);
  assert.equal(bound.installationId, installationId);
  assert.equal(bound.siteProposalId, siteProposalId);
  assert.equal(bound.previousDigest, prior);
  assert.deepEqual(bound.rollback, { revision: 3, digest: restored });
  assert.equal(bound.revision, 5);
  const pages = prepared.scope.prepared.pages.map((item: { proposal: unknown }) => pageProposal(item.proposal));
  assert.equal(pages.length, 2);
  assert.deepEqual(pages.map((page: { slug: string }) => page.slug), ["/", "/service"]);
  assert.deepEqual(pages.map((page: { pageId: string }) => page.pageId), bound.pages.map((page: { logicalPageId: string }) => page.logicalPageId));
  assert.deepEqual(prepared.scope.prepared.pages.map((page: { action: unknown }) => page.action), bound.actions);
  assert.deepEqual(review.packet.improvement, bound.improvement);
  stage = "baseline-receipts";
  const retained = join(home, "miopages-native-draft-enrollment-LaSVWc");
  const { installation, secretHex } = JSON.parse(await privateFile(join(retained, "session.json")));
  assert.equal(installation.installationId, installationId);
  const apply3 = readNativeDraftEnvelope(JSON.parse(await privateFile(join(retained, "envelope-stable-3.json"))),
    installation.keyId, installation.publicKeyBase64);
  const restore4 = readNativeDraftEnvelope(JSON.parse(await privateFile(join(retained, "envelope-stable-restore.json"))),
    installation.keyId, installation.publicKeyBase64);
  for (const signed of [apply3, restore4]) {
    assert.deepEqual(signed.candidate.scope, rehearsalSite);
    assert.equal(signed.candidate.installationId, installationId);
    assert.equal(signed.candidate.siteProposalId, siteProposalId);
  }
  assert.equal(apply3.operation, "apply");
  assert.equal(apply3.candidate.revision, 3);
  assert.equal(apply3.digest, restored);
  assert.equal(restore4.operation, "restore");
  assert.equal(restore4.candidate.revision, 4);
  assert.equal(restore4.digest, prior);
  assert.equal(restore4.candidate.previousDigest, apply3.digest);
  const journal = new NativeDraftReceiptJournal(join(retained, "receipts"));
  const receiptKey = Buffer.from(secretHex, "hex");
  const expectation = { installationId, siteProposalId, requestedDigest: prior, appliedDigest: restored,
    revision: 3, paths: ["/", "/service"] };
  let baseline;
  try {
    baseline = verifyNativeDraftReceipt(await journal.read(installationId, prior, "restore"), receiptKey, {
      ...expectation, operation: "restore",
    });
    const applied = verifyNativeDraftReceipt(await journal.read(installationId, restored, "apply"), receiptKey, {
      ...expectation, operation: "apply", requestedDigest: restored,
    });
    assert.deepEqual(applied.posts, baseline.posts);
  } finally { receiptKey.fill(0); }
  assert.deepEqual(baseline.posts, bound.pages.map((page: { path: string; wordpressId: number; baselineContentSha256: string }) => ({
    path: page.path, id: page.wordpressId, contentSha256: page.baselineContentSha256,
  })));

  const recovery = join(home, "miopages-wp-db-20261105T181534Z");
  const recoveryEvidence = JSON.parse(await privateFile(join(recovery, "database-rollout-evidence.json")));
  assert.equal(recoveryEvidence.status, "PASS");
  assert.equal(recoveryEvidence.recovery?.verified, true);
  const credentials = JSON.parse(await privateFile(join(recovery, "wordpress-role-credentials.json")));
  stage = "operator-session";
  const operator = protectedPool(credentials.operator.url, operatorRole, ca);
  try {
    const db = await operator.connect();
    try { await verifyProtectedSession(db, operatorRole, "postgres"); }
    finally { db.release(); }
  } catch (error) { await operator.end(); throw error; }
  if (check) {
    await operator.end();
    console.log(JSON.stringify({ status: "PASS", operation: "read-only-preview-preflight", signedBaseline: true, tlsSession: true }));
    return;
  }
  stage = "migration-connection";
  const url = new URL(credentials.operator.url);
  assert.ok(credential && url.username.startsWith(operatorRole + "."));
  url.username = url.username.replace(operatorRole + ".", migrationRole + ".");
  url.password = encodeURIComponent(credential);
  const migration = protectedPool(url.href, migrationRole, ca);
  const actors = [permissions.slice(0, 2), permissions.slice(2)].map(allowed => ({
    id: randomUUID(), token: randomBytes(32).toString("hex"),
    grants: allowed.map(permission => ({ id: randomUUID(), permission })),
  }));
  const expiresAt = new Date(Date.now() + 4 * 3_600_000).toISOString();
  let committed = false;
  try {
    stage = "migration-session";
    const db = await migration.connect();
    try {
      await verifyProtectedSession(db, migrationRole, "postgres");
      await db.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      stage = "canonical-base";
      try {
        await db.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
        await db.query("SELECT pg_advisory_xact_lock(hashtext('miopages-v15-review-1333ddc4'))");
        const canonical = await siteBase(db, scope);
        assert.equal(fingerprint(canonical), base);
        for (const page of pages) await resolveProposalCandidate(db, scope, page, canonical);
        stage = "native-authorization-lineage";
        const latest = (await db.query(`SELECT revision, candidate_digest, previous_digest FROM wordpress_native_draft_authorizations
          WHERE installation_id=$1 AND site_proposal_id=$2 ORDER BY revision DESC LIMIT 2`, [installationId, siteProposalId])).rows;
        assert.equal(latest[0].revision, 4);
        assert.equal(latest[0].candidate_digest, prior);
        assert.equal(latest[0].previous_digest, restored);
        assert.equal(latest[1].revision, 3);
        assert.equal(latest[1].candidate_digest, restored);
        stage = "active-installation";
        const current = (await db.query("SELECT status,generation,organization_id,web_presence_id,managed_site_id,origin FROM wordpress_installations WHERE id=$1",
          [installationId])).rows[0];
        assert.deepEqual(current, { status: "active", generation: 1, organization_id: rehearsalSite.organizationId, web_presence_id: scope.webPresenceId, managed_site_id: scope.managedSiteId, origin: installation.origin });
        stage = "credential-conflict";
        const existing = (await db.query(`SELECT 1 FROM wordpress_operator_grants g JOIN wordpress_operator_credentials c ON c.id=g.operator_id
          WHERE g.web_presence_id=$1 AND g.managed_site_id=$2 AND g.permission IN ('revise-site-proposal','preview-site-proposal')
          AND g.revoked_at IS NULL AND c.revoked_at IS NULL AND c.expires_at>clock_timestamp()`, [scope.webPresenceId,scope.managedSiteId])).rows;
        assert.equal(existing.length, 0);
        stage = "private-principals";
        await writeFile(join(root,"principals.json"), JSON.stringify({ digest, expiresAt, actors }) + "\n", { flag: "wx", mode: 0o600 });
        for (const actor of actors) {
          await db.query("INSERT INTO wordpress_operator_credentials(id,token_sha256,expires_at) VALUES($1,$2,$3)",
            [actor.id, createHash("sha256").update(Buffer.from(actor.token, "hex")).digest("hex"), expiresAt]);
          for (const grant of actor.grants) {
            await db.query(`INSERT INTO wordpress_operator_grants(id,operator_id,web_presence_id,managed_site_id,permission)
              VALUES($1,$2,$3,$4,$5)`, [grant.id, actor.id, scope.webPresenceId, scope.managedSiteId, grant.permission]);
          }
        }
        await db.query("COMMIT");
        committed = true;
      } catch (error) { await db.query("ROLLBACK"); throw error; }
    } finally { db.release(); }
    stage = "independent-grants";
    const services = protectedOperatorServices(operator, db => protectedConnection(db, operatorRole, "postgres"), "https://wp-acceptance.miopages.com");
    const contexts = [];
    for (const actor of actors) {
      const context = await services.operator.authenticate(actor.token);
      contexts.push(context);
      for (const grant of actor.grants) {
        assert.deepEqual(await services.operator.authorize(context, grant.permission, scope),
          { operatorId: actor.id, authorityReference: grant.id });
        await assert.rejects(services.operator.authorize(context, grant.permission, { ...scope, managedSiteId: randomUUID() }), /refused/);
      }
      for (const permission of [...permissions, ...refused]) {
        if (!actor.grants.some(g => g.permission === permission)) {
          await assert.rejects(services.operator.authorize(context, permission, scope), /refused/);
        }
      }
    }
    stage = "governed-previews";
    const [author, reviewer] = contexts;
    const read = services.proposals(reviewer);
    const writer = services.proposals(author);
    const expected: Binding[] = [];
    for (const target of bound.pages) {
      const state = await read.inspect(reviewer, target.proposalId, scope);
      const before = state.revisions.at(-1)!.binding;
      assert.equal(before.digest, target.previousPageDigest);
      assert.equal(before.revision + 1, target.proposedPageRevision);
      expected.push(before);
    }
    const previews = [];
    for (const [i, before] of expected.entries()) {
      const proposalId = before.proposalId;
      const event = await writer.prepare(author, proposalId, scope, randomUUID(), pages[i], before);
      const revision = event.revision!;
      assert.equal(revision.binding.baseFingerprint, base);
      const preview = await writer.preview(author, revision.binding, randomUUID());
      const verified = await read.inspect(reviewer, proposalId, scope);
      assert.equal(verified.state, "PROPOSED");
      assert.equal(verified.stale, false);
      assert.equal(verified.events.at(-1)?.hash, preview.event);
      const independent = proposalPreview(verified.revisions.at(-1)!);
      assert.equal(fingerprint(independent), preview.digest);
      assert.equal(independent, preview.html);
      const path = pages[i].slug === "/" ? "home" : "service";
      await writeFile(join(root, path + ".html"), preview.html, { flag: "wx", mode: 0o600 });
      previews.push({ path: pages[i].slug, binding: preview.binding, previewDigest: preview.digest, previewEvent: preview.event });
    }
    const finalScope = { ...bound, preparationDigest: digest, previews };
    const report = { status: "PASS", operation: "c0-v15-governed-previews", scopeDigest: fingerprint(finalScope),
      finalScope, expiresAt, baselineVerified: true, principals: actors.map(({ id, grants }) => ({ id, grants })) };
    await writeFile(join(root, "review-evidence.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify({ status: report.status, operation: report.operation, scopeDigest: report.scopeDigest,
      previews, expiresAt, baselineVerified: true, principals: report.principals, approvalRecorded: false }));
  } catch (error) {
    console.error(JSON.stringify({ status: "BLOCKED", stage, principalsCommitted: committed,
      code: (error as { code?: string }).code ?? "VALIDATION" }));
    process.exitCode = 1;
  } finally { await Promise.all([migration.end(), operator.end()]); }
}

main().catch(error => {
  console.error(JSON.stringify({ status: "BLOCKED", stage, code: (error as { code?: string }).code ?? "VALIDATION" }));
  process.exitCode = 1;
});
