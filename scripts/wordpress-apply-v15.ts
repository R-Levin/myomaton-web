import assert from "node:assert/strict";
import { createHash, createPrivateKey, randomBytes, randomUUID } from "node:crypto";
import { lstat, readFile, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fingerprint } from "../lib/platform/canonical/model";
import { proposalPreview } from "../lib/platform/content-editing/proposal-preview";
import { siteBase } from "../lib/platform/content-editing/proposal-context";
import { readProposalState } from "../lib/platform/content-editing/proposal-postgres";
import { migrationRole, operatorRole, protectedPool, verifyProtectedSession, protectedConnection } from "../lib/platform/wordpress-delivery/protected-connection";
import { protectedOperatorServices } from "../lib/platform/wordpress-delivery/protected-services";
import { readNativeDraftEnvelope } from "../lib/platform/wordpress-delivery/native-draft-envelope";
import { NativeDraftReceiptJournal, verifyNativeDraftReceipt } from "../lib/platform/wordpress-delivery/native-draft-receipt";
import { rehearsalSite } from "./db/wordpress-rehearsal-principals";

const approved = "ba185f4c51f60e04c787678df9722ecbf76445596840f23d11f668b753433646";
const permissions = ["approve-site-proposal", "review-private-stage", "authorize-native-draft"] as const;
const selection = { webPresenceId: rehearsalSite.webPresenceId, managedSiteId: rehearsalSite.managedSiteId };
const mandate = { kind: "accepted-authority", subjectId: "synthetic-native-draft-fixture",
  authorityReference: "Owner approval of exact C0 v15 private apply and restore scope " + approved };
let stage = "custody";

async function guarded(path: string, directory = false) {
  const stat = await lstat(path);
  assert.ok((directory ? stat.isDirectory() : stat.isFile()) && stat.uid === process.getuid?.() &&
    (stat.mode & 0o777) === (directory ? 0o700 : 0o600) && await realpath(path) === path);
}

async function privateFile(path: string) {
  await guarded(path);
  return readFile(path, "utf8");
}

async function main() {
  const [mode] = process.argv.slice(2);
  assert.ok(process.argv.length === 3 && ["prepare", "issue", "reconcile-apply", "reconcile-restore"].includes(mode));
  const password = process.env.MIOPAGES_V15_MIGRATION_PASSWORD;
  delete process.env.MIOPAGES_V15_MIGRATION_PASSWORD;
  const home = await realpath(process.env.HOME ?? "");
  assert.equal(home, "/home/virtual/vps-bef564/5/53b4381d42");
  assert.equal(await realpath(process.cwd()), join(home, "miopages-wp-rehearsal", "review-ba185f4c"));
  const review = join(home, "miopages-wp-review-1333ddc4"), run = join(review, "apply-ba185f4c");
  const retained = join(home, "miopages-native-draft-enrollment-LaSVWc");
  for (const path of [review, run, retained]) await guarded(path, true);
  const json = async (path: string) => JSON.parse(await privateFile(path));
  const readRun = (name: string) => json(join(run, name + ".json"));
  const save = (name: string, value: unknown) => writeFile(join(run, name + ".json"), JSON.stringify(value) + "\n", { flag: "wx", mode: 0o600 });
  const report = await json(join(review, "review-evidence.json"));
  const { installation, secretHex, signingKey } = await json(join(retained, "session.json"));
  const scope = report.finalScope;
  assert.equal(report.status, "PASS");
  assert.equal(report.scopeDigest, approved);
  assert.equal(fingerprint(scope), approved);
  assert.deepEqual(scope.site, rehearsalSite);
  assert.equal(installation.installationId, scope.installationId);
  assert.equal(installation.origin, "https://miopages.org");
  assert.deepEqual(scope.pages.map((p: { wordpressId: number; path: string }) => [p.wordpressId, p.path]), [[13, "/"], [14, "/service"]]);
  assert.deepEqual([scope.revision, scope.rollback.revision], [5, 3]);
  const secret = Buffer.from(secretHex, "hex");
  const journal = new NativeDraftReceiptJournal(join(retained, "receipts"));
  const recovery = { journal, secret, credentialId: installation.credentialId };
  const target = { installationId: scope.installationId, siteProposalId: scope.siteProposalId, requestedDigest: scope.previousDigest,
    appliedDigest: scope.rollback.digest, revision: 3, paths: ["/", "/service"] };
  const expectedPosts = (key: string) => scope.pages.map((p: { path: string; wordpressId: number } & Record<string, unknown>) =>
    ({ path: p.path, id: p.wordpressId, contentSha256: p[key] }));
  stage = "recovery";
  const prior = await journal.verifyMaterializedBaseline(target, secret);
  assert.deepEqual(prior.posts, expectedPosts("baselineContentSha256"));
  const saved = await json(join(home, "miopages-wp-db-20261105T181534Z/wordpress-role-credentials.json"));
  const ca = await readFile(join(home, "supabase-ca.crt"), "utf8");
  const operator = protectedPool(saved.operator.url, operatorRole, ca);
  try {
    stage = "operator-session";
    const db = await operator.connect();
    try { await verifyProtectedSession(db, operatorRole, "postgres"); } finally { db.release(); }
    const services = protectedOperatorServices(operator, db => protectedConnection(db, operatorRole, "postgres"), "https://wp-acceptance.miopages.com");
    const authenticate = async (principals: { permission: typeof permissions[number]; id: string; grantId: string; token: string }[]) => {
      assert.deepEqual(principals.map(item => item.permission), permissions);
      assert.equal(new Set(principals.map(item => item.id)).size, permissions.length);
      return Promise.all(principals.map(async principal => {
        const actor = await services.operator.authenticate(principal.token);
        const grant = await services.operator.authorize(actor, principal.permission, selection);
        assert.equal(grant.operatorId, principal.id);
        assert.equal(grant.authorityReference, principal.grantId);
        assert.deepEqual(grant.customer, principal.permission === "approve-site-proposal" ? mandate : undefined);
        await assert.rejects(services.operator.authorize(actor, principal.permission, { ...selection, managedSiteId: randomUUID() }), /refused/);
        for (const permission of [...permissions, "issue", "prepare-site-proposal", "revise-site-proposal", "enroll", "rotate", "revoke"] as const) {
          if (permission !== principal.permission) await assert.rejects(services.operator.authorize(actor, permission, selection), /refused/);
        }
        return actor;
      }));
    };
    const draft = { installationId: scope.installationId, siteProposalId: scope.siteProposalId, revision: scope.revision,
      previousDigest: scope.previousDigest, rollback: scope.rollback, navigation: ["/", "/service"], actions: scope.actions };
    if (mode !== "prepare") {
      const { principals } = await readRun("custody");
      const [, reviewer, authorizer] = await authenticate(principals);
      const projection = await readRun("projection");
      assert.equal(projection.authorizedScope, approved);
      assert.deepEqual(projection.draft, draft);
      if (mode === "issue") {
        stage = "site-authorize";
        await services.review.authorizeSiteDraft(authorizer, reviewer, scope.site, projection.references, draft, projection.digest, recovery);
        const key = createPrivateKey(signingKey);
        for (const operation of ["apply", "restore"] as const) {
          stage = "issue-" + operation;
          const envelope = await services.review.issueSiteDraft(authorizer, reviewer, scope.site, projection.references, draft, projection.digest, key, operation, recovery);
          const signed = readNativeDraftEnvelope(envelope, installation.keyId, installation.publicKeyBase64);
          assert.equal(signed.version, 2);
          assert.equal(signed.digest, projection.digest);
          assert.equal(signed.operation, operation);
          await save(operation, envelope);
        }
        console.log(JSON.stringify({ status: "PASS", mode, candidateDigest: projection.digest }));
        return;
      }
      stage = "receipt";
      const operation = mode === "reconcile-apply" ? "apply" : "restore";
      const envelope = await readRun(operation);
      const decision = await services.review.nativeDraftReceiptDecision(reviewer, scope.site, scope.installationId, envelope);
      assert.equal(decision.credentialId, installation.credentialId);
      assert.equal(decision.expected.requestedDigest, projection.digest);
      const wire = await readRun("received-" + operation);
      const verify = (value: unknown) => verifyNativeDraftReceipt(value, secret, decision.expected);
      const verified = verify(wire);
      assert.deepEqual(verified.posts, expectedPosts(operation === "apply" ? "proposedContentSha256" : "baselineContentSha256"));
      if (operation === "apply") assert.deepEqual(verify(await readRun("received-retry")), verified);
      assert.deepEqual(await journal.record(decision.expected, secret, wire), verified);
      console.log(JSON.stringify({ status: "PASS", ...verified }));
      return;
    }
    stage = "approval-preflight";
    assert.ok(password);
    const connection = new URL(saved.operator.url);
    assert.ok(connection.username.startsWith(operatorRole + "."));
    connection.username = connection.username.replace(operatorRole + ".", migrationRole + ".");
    connection.password = encodeURIComponent(password);
    const migration = protectedPool(connection.href, migrationRole, ca);
    const principals = permissions.map(permission => ({ permission, id: randomUUID(), grantId: randomUUID(), token: randomBytes(32).toString("hex") }));
    const expiresAt = new Date(Date.now() + 4 * 3_600_000).toISOString();
    try {
      const db = await migration.connect();
      try {
        await verifyProtectedSession(db, migrationRole, "postgres");
        await db.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
        try {
          await db.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
          await db.query("SELECT pg_advisory_xact_lock(hashtext('miopages-v15-apply-ba185f4c'))");
          assert.equal(fingerprint(await siteBase(db, selection)), scope.canonicalBase);
          const lineage = (await db.query("SELECT revision,candidate_digest FROM wordpress_native_draft_authorizations WHERE installation_id=$1 AND site_proposal_id=$2 ORDER BY revision DESC LIMIT 2", [scope.installationId, scope.siteProposalId])).rows;
          assert.deepEqual(lineage, [{ revision: 4, candidate_digest: scope.previousDigest }, { revision: 3, candidate_digest: scope.rollback.digest }]);
          assert.equal((await db.query("SELECT 1 FROM wordpress_installations WHERE id=$1 AND origin=$2 AND generation=1 AND status='active' AND organization_id=$3 AND web_presence_id=$4 AND managed_site_id=$5", [scope.installationId, installation.origin, rehearsalSite.organizationId, selection.webPresenceId, selection.managedSiteId])).rowCount, 1);
          assert.equal((await db.query("SELECT 1 FROM wordpress_operator_grants g JOIN wordpress_operator_credentials c ON c.id=g.operator_id WHERE g.web_presence_id=$1 AND g.managed_site_id=$2 AND g.permission=ANY($3::text[]) AND g.revoked_at IS NULL AND c.revoked_at IS NULL AND c.expires_at>clock_timestamp()", [selection.webPresenceId, selection.managedSiteId, permissions])).rowCount, 0);
          for (const preview of scope.previews) {
            const identity = (await db.query("SELECT created_at FROM site_change_proposals WHERE id=$1 AND organization_id=$2 AND web_presence_id=$3 AND managed_site_id=$4",
              [preview.binding.proposalId, rehearsalSite.organizationId, selection.webPresenceId, selection.managedSiteId])).rows[0];
            const state = await readProposalState(db, preview.binding.proposalId, selection, identity.created_at);
            assert.equal(state.state, "PROPOSED");
            const latest = state.revisions.at(-1)!;
            assert.deepEqual(latest.binding, preview.binding);
            assert.deepEqual(state.events.at(-1)?.preview, { binding: preview.binding, digest: preview.previewDigest });
            assert.equal(state.events.at(-1)?.hash, preview.previewEvent);
            assert.equal(fingerprint(proposalPreview(latest)), preview.previewDigest);
          }
          stage = "principal-custody";
          await save("custody", { principals, expiresAt });
          for (const principal of principals) {
            await db.query("INSERT INTO wordpress_operator_credentials(id,token_sha256,expires_at) VALUES($1,$2,$3)",
              [principal.id, createHash("sha256").update(Buffer.from(principal.token, "hex")).digest("hex"), expiresAt]);
            await db.query("INSERT INTO wordpress_operator_grants(id,operator_id,web_presence_id,managed_site_id,permission,customer) VALUES($1,$2,$3,$4,$5,$6)",
              [principal.grantId, principal.id, selection.webPresenceId, selection.managedSiteId,
                principal.permission, principal.permission === "approve-site-proposal" ? mandate : null]);
          }
          await db.query("COMMIT");
        } catch (error) { await db.query("ROLLBACK"); throw error; }
      } finally { db.release(); }
    } finally { await migration.end(); }
    stage = "independent-grants";
    const [approver, reviewer] = await authenticate(principals);
    stage = "page-approval";
    const references = [];
    for (const preview of scope.previews) {
      const event = await services.proposals(approver).approve(approver, { binding: preview.binding, previewDigest: preview.previewDigest,
        previewEvent: preview.previewEvent, requestId: randomUUID(), reference: mandate.authorityReference });
      references.push({ proposalId: preview.binding.proposalId, approvalId: event.hash });
    }
    stage = "site-projection";
    const preview = await services.review.previewSiteDraft(reviewer, scope.site, references, draft);
    assert.deepEqual(preview.candidate.pages.map(page => [page.id, page.path]),
      scope.pages.map((p: { logicalPageId: string; path: string }) => [p.logicalPageId, p.path]));
    await save("projection", { authorizedScope: approved, references, draft, digest: preview.digest });
    const evidence = { status: "PASS", mode, scope: approved, candidateDigest: preview.digest, references, expiresAt,
      principals: principals.map(({ permission, id, grantId }) => ({ permission, id, grantId })) };
    await save("approval-evidence", evidence);
    console.log(JSON.stringify(evidence));
  } finally { secret.fill(0); await operator.end(); }
}

main().catch(error => {
  console.error(JSON.stringify({ status: "BLOCKED", stage, code: (error as { code?: string }).code ?? "VALIDATION" }));
  process.exitCode = 1;
});
