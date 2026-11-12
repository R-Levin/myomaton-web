import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import test from "node:test";
import { migrateWithBootstrapCompatibility } from "../../scripts/db/bootstrap";
import { mioPagesIntakeOwner } from "../../lib/platform/intake/availability";
import { disposableCluster } from "../../scripts/backup/disposable-cluster";
import { siteReleaseFixture } from "../../scripts/site-releases/disposable";
import { fingerprint } from "../../lib/platform/canonical/model";
import type { ReviewedProjection } from "../../lib/platform/wordpress-delivery/authority";
import { sharedInventory } from "../../scripts/db/wordpress-shared-inventory";
import { integratePrivateStage } from "../../scripts/db/wordpress-private-stage";
import { operatorRole, pullRole } from "../../lib/platform/wordpress-delivery/protected-connection";
import { protectedOperatorServices } from "../../lib/platform/wordpress-delivery/protected-services";
import { inspectCanonical, writeCanonical } from "../../lib/platform/canonical/writes";
import { requestMac, WordPressDelivery } from "../../lib/platform/wordpress-delivery/service";
import { c0SpineInterview, prepareCycleInquiry, presenceDirection, writeC0SpineReview } from "../helpers/c0-spine";
import { privateSiteCandidate, type DraftInput } from "../helpers/private-site-candidate";

async function initializeWordPressTestBaseline(url: string) {
  const baseline = new Pool({ connectionString: url });
  try {
    await migrateWithBootstrapCompatibility(baseline);
    const organization = randomUUID();
    await baseline.query("INSERT INTO organizations(id,name) VALUES($1,'Synthetic intake organization')", [organization]);
    await baseline.query("INSERT INTO web_presences(id,organization_id,name) VALUES($1,$2,'Synthetic intake presence')",
      [mioPagesIntakeOwner.webPresenceId, organization]);
    await baseline.query("INSERT INTO managed_sites(id,web_presence_id,name) VALUES($1,$2,'Synthetic intake site')",
      [mioPagesIntakeOwner.managedSiteId, mioPagesIntakeOwner.webPresenceId]);
  } finally { await baseline.end(); }
}

test("WordPress private delivery through Core evidence, durable enrollment and exact PHP receipt", { timeout: 120_000 }, async () => {
  const bin = process.env.WORDPRESS_TEST_PG_BIN;
  assert.ok(bin, "Set WORDPRESS_TEST_PG_BIN to a local PostgreSQL 18 bin directory");
  Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_SITE_PROPOSALS: "local-operator",
    MIOPAGES_SITE_RELEASES: "disposable-operator", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" });
  const cluster = await disposableCluster(bin);
  try {
    await initializeWordPressTestBaseline(cluster.url);
    const inventoryPool = new Pool({ connectionString: cluster.url });
    try {
      const original = (await inventoryPool.query("SELECT organization_id FROM web_presences WHERE id=$1",
        [mioPagesIntakeOwner.webPresenceId])).rows[0].organization_id;
      const c0 = "152aebd3-00b3-4296-a64e-e281522e64f0";
      await inventoryPool.query("INSERT INTO organizations(id,name) VALUES($1,'Synthetic C0')", [c0]);
      await inventoryPool.query("UPDATE web_presences SET organization_id=$1 WHERE id=$2", [c0, mioPagesIntakeOwner.webPresenceId]);
      await inventoryPool.query("INSERT INTO managed_site_hostnames(id,hostname,web_presence_id,managed_site_id) VALUES($1,$2,$5,$6),($3,$4,$5,$6)",
        ["bfd0daa1-3a9d-429d-8b60-b2d9851f9603", "runtime.miopages.com", "46bbd56e-9f28-4006-8bc0-df70c955cda3",
          "domain-test.miopages.com", mioPagesIntakeOwner.webPresenceId, mioPagesIntakeOwner.managedSiteId]);
      await inventoryPool.query("GRANT SELECT(name) ON public.organizations TO PUBLIC");
      const db = await inventoryPool.connect();
      try {
        await assert.rejects(sharedInventory(db, []), /Read-only inventory transaction required/);
        await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        const inventory = await sharedInventory(db, []);
        assert.equal(inventory.status, "BLOCKED");
        assert.equal(inventory.c0.graph, true);
        assert.ok(Object.values(inventory.c0.bindings).every(Boolean));
        assert.equal(inventory.inventory.c0, 3);
        assert.equal(inventory.inventory.unknownOrReal, 1);
        assert.equal(inventory.publicGrants.column_grants, 1);
        assert.equal(inventory.publicGrants.acceptable, false);
        assert.equal(inventory.fixture.inactiveUnhostedActivationBoundCandidates, 0);
      } finally { await db.query("ROLLBACK"); db.release(); }
      await inventoryPool.query("REVOKE SELECT(name) ON public.organizations FROM PUBLIC");
      await inventoryPool.query("DELETE FROM managed_site_hostnames WHERE managed_site_id=$1", [mioPagesIntakeOwner.managedSiteId]);
      await inventoryPool.query("UPDATE web_presences SET organization_id=$1 WHERE id=$2", [original, mioPagesIntakeOwner.webPresenceId]);
      await inventoryPool.query("DELETE FROM organizations WHERE id=$1", [c0]);
    } finally { await inventoryPool.end(); }
    const fixture = await siteReleaseFixture(cluster.url);
    try {
      await fixture.pool.query(await readFile("lib/platform/wordpress-delivery/0016_wordpress_delivery.sql", "utf8"));
      const release = await fixture.releases.release(fixture.releaseContext, await fixture.approve(await fixture.prepare()));
      const site = { ...fixture.scope, organizationId: (await fixture.pool.query(
        "SELECT organization_id FROM web_presences WHERE id=$1", [fixture.scope.webPresenceId])).rows[0].organization_id };
      const pages = [{ id: release.page_id, path: "/", title: String(release.after_content.page!.title),
        sections: release.after_content.sections.map(section => ({ id: String(section.id), type: String(section.type),
          content: section.content as { heading: string; text: string } })) }];
      const reviewed: ReviewedProjection = { ...site, version: 1, publishable: true, releaseId: release.id,
        releaseDigest: release.digest, revision: release.revision, approvalId: release.approval_event,
        previewDigest: release.preview_digest, sourceDigest: release.after_fingerprint, projectionDigest: fingerprint(pages), pages };
      const core = "https://core.example.test", origin = "https://wp.example.test";
      const key = generateKeyPairSync("ed25519");
      const publicPin = (pub: typeof key.publicKey) => Buffer.from(pub.export({ format: "jwk" }).x!, "base64url").toString("base64");
      const credentialId = randomUUID(), installationId = randomUUID(), secret = randomBytes(32);
      const enroll = { ...site, installationId, origin, credentialId, keyId: "initial", publicKeyBase64: publicPin(key.publicKey) };
      const operator = Object.freeze({});
      const options = [async (context: unknown) => context === operator ? "test-operator" : null,
        async (id: string) => id === credentialId ? secret : null, core] as const;
      const disabled = new WordPressDelivery(fixture.pool, ...options);
      let proof = reviewed;
      const hub = new WordPressDelivery(fixture.pool, ...options, async () => proof);
      await assert.rejects(hub.enroll({}, enroll), /Operator authority/);
      await assert.rejects(hub.enroll(operator, { ...enroll, organizationId: randomUUID() }), /scope/);
      await assert.rejects(hub.enroll(operator, { ...enroll, origin: "http://wp.example.test" }), /HTTPS/);
      await hub.enroll(operator, enroll);
      await assert.rejects(hub.enroll(operator, { ...enroll, installationId: randomUUID() }), /unique/);
      assert.equal(await disabled.issue(operator, installationId, release.id, key.privateKey), null);
      for (const patch of [{ organizationId: randomUUID() }, { revision: release.revision + 1 }, { version: 2 },
        { approvalId: "0".repeat(64) }, { sourceDigest: "0".repeat(64) }, { projectionDigest: "0".repeat(64) },
        { publishable: false }]) {
        proof = { ...reviewed, ...patch } as ReviewedProjection;
        assert.equal(await hub.issue(operator, installationId, release.id, key.privateKey), null);
      }
      proof = reviewed;
      await assert.rejects(hub.issue(operator, installationId, release.id, generateKeyPairSync("ed25519").privateKey), /Unpinned issuer/);
      const issued = await hub.issue(operator, installationId, release.id, key.privateKey);
      assert.ok(issued);
      assert.deepEqual(await hub.issue(operator, installationId, release.id, key.privateKey), issued);
      const nextKey = { keyId: "rotated", credentialId: randomUUID(), publicKeyBase64: publicPin(generateKeyPairSync("ed25519").publicKey) };
      await assert.rejects(hub.rotate(operator, installationId, 1, nextKey), /Rotation refused/);

      // Reopen independently to prove eligibility, registry, replay state and receipts are durable.
      const pool = new Pool({ connectionString: cluster.url, options: "-c search_path=" + fixture.schema });
      const root = await realpath(await mkdtemp(path.join(tmpdir(), "miopages-wordpress-pull-")));
      try {
        const reopened = new WordPressDelivery(pool, ...options, async () => proof);
        const request = (action: string, receipt = "", patch: Record<string, string> = {}) => {
          const headers = { origin, installation: installationId, credential: credentialId, release: release.id,
            nonce: randomBytes(16).toString("hex"), time: String(Date.now()), receipt, ...patch };
          const mac = requestMac(secret, [core, action, headers.installation, headers.origin, headers.credential,
            headers.release, headers.nonce, headers.time, headers.receipt]);
          return new Request(core + "/api/wordpress-delivery/" + action, { method: "POST", headers:
            Object.fromEntries(Object.entries({ ...headers, mac: patch.mac ?? mac }).map(([k, v]) => ["X-MioPages-" + k, v])) });
        };
        const exactReceipt = "staged:1:" + issued.envelopeSha256;
        assert.equal((await reopened.handle(request("receipt", exactReceipt))).status, 409);
        assert.equal((await reopened.handle(request("pull", "", { time: String(Date.now() - 130_000) }))).status, 400);
        assert.equal((await reopened.handle(request("pull", "", { origin: "https://foreign.example.test" }))).status, 403);
        assert.equal((await reopened.handle(request("pull", "", { installation: randomUUID() }))).status, 403);
        assert.equal((await reopened.handle(request("pull", "", { mac: "0".repeat(64) }))).status, 403);
        assert.equal((await reopened.handle(request("pull", "", { release: randomUUID() }))).status, 404);
        await pool.query("UPDATE pages SET updated_at=updated_at+interval '1 microsecond' WHERE id=$1", [release.page_id]);
        assert.equal((await reopened.handle(request("pull"))).status, 409);
        await pool.query("UPDATE pages SET updated_at=updated_at-interval '1 microsecond' WHERE id=$1", [release.page_id]);

        const pull = request("pull");
        const raced = await Promise.all([hub.handle(pull), reopened.handle(pull)]);
        assert.equal(raced.filter(r => r.status === 200).length, 1);
        assert.equal((await reopened.handle(pull)).status, 409);
        const envelope = await raced.find(r => r.status === 200)!.text();
        assert.equal(createHash("sha256").update(envelope).digest("hex"), issued.envelopeSha256);
        assert.equal((await reopened.handle(request("receipt", "staged:1:" + "0".repeat(64)))).status, 409);
        assert.equal((await reopened.handle(request("receipt", exactReceipt.replace("staged", "published")))).status, 400);

        const directory = path.join(root, "private"), webroot = path.join(root, "public");
        await mkdir(directory, { mode: 0o700 });
        await mkdir(webroot, { mode: 0o700 });
        const identity = { ...site, installationId, keyId: enroll.keyId, publicKeyBase64: enroll.publicKeyBase64 };
        const client = (overrides = {}) => {
          const php = spawnSync("php", ["wordpress/miopages-delivery/tests/core-pull-compat.php"], { encoding: "utf8",
            input: JSON.stringify({ core, origin, credentialId, secret: secret.toString("hex"), releaseId: release.id,
              identity, directory, webroot, envelope, digest: issued.envelopeSha256, ...overrides }) });
          assert.equal(php.status, 0, php.stderr || php.error?.message);
          return JSON.parse(php.stdout) as { result: { state?: string; code?: string }; requests: { url: string; headers: HeadersInit }[] };
        };
        assert.equal(client({ identity: { ...identity, publicKeyBase64: nextKey.publicKeyBase64 } }).requests.length, 1);
        assert.equal(client({ releaseId: randomUUID() }).requests.length, 1);
        assert.deepEqual(await readdir(directory), [".release.lock"]);
        for (let i = 0; i < 2; i++) {
          const staged = client();
          assert.equal(staged.result.state, "staged", JSON.stringify(staged.result));
          assert.equal(staged.requests.length, 2);
          for (const [index, { url, headers }] of staged.requests.entries()) {
            assert.equal((await reopened.handle(new Request(url, { method: "POST", headers }))).status, index === 0 ? 200 : 204);
          }
        }
        assert.deepEqual(await readdir(directory), [".release.lock", "objects"]);
        assert.equal(await readFile(path.join(directory, "objects", issued.envelopeSha256 + ".json"), "utf8"), envelope);
        const audit = await pool.query("SELECT action FROM wordpress_delivery_events WHERE installation_id=$1", [installationId]);
        assert.equal(audit.rows.filter(r => r.action === "staged").length, 1);
        assert.equal(audit.rows.filter(r => r.action === "receipt-retry").length, 1);
        await reopened.rotate(operator, installationId, 1, nextKey);
        assert.equal((await reopened.handle(request("receipt", exactReceipt))).status, 403);
        assert.equal((await pool.query("SELECT count(*)::int n FROM wordpress_installation_keys WHERE installation_id=$1", [installationId])).rows[0].n, 2);
        await reopened.revoke(operator, installationId);
        await assert.rejects(reopened.issue(operator, installationId, release.id, key.privateKey), /Issuance refused/);
      } finally {
        await pool.end();
        assert.match(path.basename(root), /^miopages-wordpress-pull-/);
        assert.equal(path.dirname(root), await realpath(tmpdir()));
        await rm(root, { recursive: true });
      }
    } finally { await fixture.stop(); }
  } finally { await cluster.stop(); }
});

test("Protected operator and reviewed private release with restricted PostgreSQL roles", { timeout: 120_000 }, async () => {
  const bin = process.env.WORDPRESS_TEST_PG_BIN;
  assert.ok(bin);
  Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" });
  let walkthrough: Parameters<typeof writeC0SpineReview> | undefined;
  const cluster = await disposableCluster(bin);
  try {
    await initializeWordPressTestBaseline(cluster.url);
    const fixture = await siteReleaseFixture(cluster.url);
    try {
      const admin = fixture.pool;
      const password = randomBytes(32).toString("hex");
      for (const role of [operatorRole, pullRole, "miopages_runtime", "miopages_backup"]) {
        await admin.query(`CREATE ROLE "${role}" LOGIN PASSWORD '${password}'`);
      }
      await admin.query(`GRANT USAGE ON SCHEMA "${fixture.schema}" TO ${operatorRole},${pullRole}`);
      const migrate = async (nativeDraft = false) => {
        const db = await admin.connect();
        try {
          await db.query("BEGIN");
          await integratePrivateStage(db, fixture.schema, nativeDraft);
          await db.query("COMMIT");
        } catch (error) { await db.query("ROLLBACK"); throw error; }
        finally { db.release(); }
      };
      await migrate();
      await migrate(true);
      await migrate(true);

      const login = (role: string) => {
        const url = new URL(cluster.url);
        url.username = role;
        url.password = password;
        return new Pool({ connectionString: url.toString(), options: `-c search_path=miopages_wp,${fixture.schema} -c timezone=UTC` });
      };
      const operatorDb = login(operatorRole), pullDb = login(pullRole), runtimeDb = login("miopages_runtime");
      const boundary = (role: string) => async (db: PoolClient) => {
        assert.equal((await db.query("SELECT session_user AS actor")).rows[0].actor, role);
      };
      try {
        await assert.rejects(pullDb.query("SELECT * FROM wordpress_operator_credentials"), /permission denied/);
        await assert.rejects(pullDb.query("UPDATE wordpress_installations SET status='active'"), /permission denied/);
        await assert.rejects(pullDb.query("UPDATE wordpress_deliveries SET envelope='x'"), /permission denied/);
        await assert.rejects(runtimeDb.query("SELECT * FROM miopages_wp.wordpress_private_releases"), /permission denied/);
        await assert.rejects(operatorDb.query("UPDATE pages SET title='x'"), /permission denied/);
        await assert.rejects(operatorDb.query("UPDATE wordpress_operator_grants SET revoked_at=NULL"), /permission denied/);

        const site = { ...fixture.scope, organizationId: (await admin.query("SELECT organization_id FROM web_presences WHERE id=$1",
          [fixture.scope.webPresenceId])).rows[0].organization_id };
        const provision = async (permissions: string[], expires = new Date(Date.now() + 60_000)) => {
          const id = randomUUID(), token = randomBytes(32).toString("hex");
          await admin.query("INSERT INTO miopages_wp.wordpress_operator_credentials VALUES($1,$2,$3)",
            [id, createHash("sha256").update(Buffer.from(token, "hex")).digest("hex"), expires]);
          for (const permission of permissions) {
            await admin.query(`INSERT INTO miopages_wp.wordpress_operator_grants
              (id,operator_id,web_presence_id,managed_site_id,permission,customer) VALUES($1,$2,$3,$4,$5,$6)`,
            [randomUUID(), id, site.webPresenceId, site.managedSiteId, permission, permission === "approve-site-proposal"
              ? { kind: "accepted-authority", subjectId: "disposable-customer", authorityReference: "Test exact mandate" } : null]);
          }
          return { id, token };
        };
        const approver = await provision(["approve-site-proposal", "review-private-stage"]);
        const author = await provision(["prepare-site-proposal", "revise-site-proposal", "preview-site-proposal"]);
        const reviewer = await provision(["review-private-stage", "enroll", "issue", "revoke"]);
        const authorizer = await provision(["authorize-native-draft"]);
        const expired = await provision(["enroll"], new Date(0));
        const origin = "https://core.example.test";
        const protectedServices = protectedOperatorServices(operatorDb, boundary(operatorRole), origin);
        await assert.rejects(protectedServices.operator.authenticate(expired.token), /authentication refused/);
        await assert.rejects(protectedServices.operator.authorize({ operatorId: reviewer.id }, "issue", site), /authorization refused/);
        const reviewerContext = await protectedServices.operator.authenticate(reviewer.token);
        const authorContext = await protectedServices.operator.authenticate(author.token);
        const approverContext = await protectedServices.operator.authenticate(approver.token);
        const authorizerContext = await protectedServices.operator.authenticate(authorizer.token);
        await assert.rejects(protectedServices.operator.authorize(reviewerContext, "issue", { ...site, managedSiteId: randomUUID() }), /authorization refused/);

        const approvePage = async (page = fixture.page, expected?: Parameters<ReturnType<typeof protectedServices.proposals>["prepare"]>[5]) => {
          const proposed = await protectedServices.proposals(authorContext).prepare(authorContext,
            expected?.proposalId ?? randomUUID(), fixture.scope, randomUUID(), page, expected ?? null);
          const binding = proposed.revision!.binding;
          const preview = await protectedServices.proposals(authorContext).preview(authorContext, binding, randomUUID());
          const approval = await protectedServices.proposals(approverContext).approve(approverContext, {
            binding, requestId: randomUUID(), previewDigest: preview.digest, previewEvent: preview.event, reference: "Test customer review",
          });
          return { site, proposalId: binding.proposalId, approvalId: approval.hash, binding, revision: proposed.revision!, previewDigest: preview.digest,
            authorGrant: proposed.actor.authorityReference, approvalGrant: approval.actor.authorityReference };
        };
        const internal = await approvePage();
        await assert.rejects(protectedServices.review.review(reviewerContext, internal), /not approved for public projection/);

        // Seed the authorized public source through the existing writer, with the
        // disposable presence temporarily active. The adapter itself cannot write it.
        const now = new Date().toISOString(), knowledgeId = fixture.confirmed[0].confirmation.recordId;
        const transition = "MioPages is moving from legacy offerings toward one managed Web Presence service.";
        const serviceDirection = "The planned service starts with Launch for a new site or migration and continues with Ongoing care.";
        const runInquiry = await prepareCycleInquiry(admin, site);
        const priorKnowledge = await inspectCanonical(admin, "knowledge", site.webPresenceId, knowledgeId);
        assert.ok(priorKnowledge);
        await admin.query("UPDATE web_presences SET status='active' WHERE id=$1", [site.webPresenceId]);
        try {
          await writeCanonical(admin, { domain: "knowledge", id: knowledgeId, webPresenceId: site.webPresenceId,
            expectedVersion: priorKnowledge.row.version, expectedFingerprint: priorKnowledge.fingerprint, responsibleIdentity: "test-public-fact-reviewer",
            changeReason: "Disposable fixture", payload: { ...priorKnowledge.row.payload, entries: [
              ...priorKnowledge.row.payload.entries,
              ...[["public-fact", serviceDirection], ["transition-home", transition]].map(([key, value]) =>
                ({ key, kind: "audience", value,
                evidence: { sourceKind: "operator", sourceReference: "Disposable approved source", confirmation: "confirmed",
                  visibility: "public", confirmedBy: "test-public-fact-reviewer", confirmedAt: now } })),
            ], approval: { by: "test-public-fact-reviewer", at: now, scope: "public" } } });
        } finally { await admin.query("UPDATE web_presences SET status='inactive' WHERE id=$1", [site.webPresenceId]); }
        const canonical = await inspectCanonical(admin, "knowledge", site.webPresenceId, knowledgeId);
        assert.ok(canonical);
        const interview = await c0SpineInterview(fixture);
        const directions = presenceDirection(interview), selected = interview.direct;
        assert.equal(directions[0].draftDigest, selected.draftDigest);
        assert.notEqual(directions[0].audience, directions[1].audience);
        assert.equal(selected.finding.recommendation, "Lead with the existing-website handoff.");
        const heading = "Already have a website? Start there.";
        const page = { ...fixture.page, slug: "/service", title: fixture.editorial("Managed Web Presence"),
          sections: [{ id: randomUUID(), type: "intro" as const,
          heading: { kind: "editorial" as const, text: heading,
            rationale: `Fixture Operator selected existing-website emphasis from draft v${selected.draftVersion} ${selected.draftDigest}.` },
          text: { kind: "canonical" as const,
            source: { domain: "knowledge" as const, recordId: knowledgeId, revision: canonical.row.version,
              fingerprint: canonical.fingerprint, field: "public-fact" } } }] };
        const review = await approvePage(page);
        await assert.rejects(protectedServices.review.review(approverContext, review), /Independent/);
        const preview = await protectedServices.review.review(reviewerContext, review);
        const reviewerGrant = await protectedServices.operator.authorize(reviewerContext, "review-private-stage", site);
        assert.equal(preview.pages[0].sections[0].content.text, serviceDirection);
        const releaseId = randomUUID(), commit = { releaseId, projectionDigest: preview.projectionDigest };
        await assert.rejects(protectedServices.review.review(reviewerContext, { ...review, commit: { ...commit, projectionDigest: "0".repeat(64) } }), /digest mismatch/);
        await protectedServices.review.review(reviewerContext, { ...review, commit });
        await protectedServices.review.review(reviewerContext, { ...review, commit });

        const key = generateKeyPairSync("ed25519"), secret = randomBytes(32), credentialId = randomUUID(), installationId = randomUUID();
        const wpOrigin = "https://wp.example.test";
        await protectedServices.delivery.enroll(reviewerContext, { ...site, installationId, origin: wpOrigin, credentialId,
          keyId: "private", publicKeyBase64: Buffer.from(key.publicKey.export({ format: "jwk" }).x!, "base64url").toString("base64") });
        const issued = await protectedServices.delivery.issue(reviewerContext, installationId, releaseId, key.privateKey);
        assert.ok(issued);
        const credentials = new Map<string, Buffer>([[credentialId, secret]]);
        const handler = new WordPressDelivery(pullDb, async () => null, async id => credentials.get(id) ?? null,
          origin, undefined, boundary(pullRole));
        const request = (operation: string, receipt = "", delivery = { installationId, releaseId, credentialId, wpOrigin }) => {
          const { installationId, releaseId, credentialId, wpOrigin } = delivery;
          const nonce = randomBytes(16).toString("hex"), time = String(Date.now());
          const mac = requestMac(credentials.get(credentialId)!, [origin, operation, installationId, wpOrigin, credentialId, releaseId, nonce, time, receipt]);
          const headers = { origin: wpOrigin, installation: installationId, credential: credentialId, release: releaseId, nonce, time, receipt, mac };
          return new Request(origin + "/api/wordpress-delivery/" + operation, { method: "POST",
            headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => ["X-MioPages-" + k, v])) });
        };
        const pulled = await handler.handle(request("pull"));
        assert.equal(pulled.status, 200);
        const envelope = await pulled.text();
        const root = await realpath(await mkdtemp(path.join(tmpdir(), "miopages-wordpress-pull-")));
        try {
          const directory = path.join(root, "private"), webroot = path.join(root, "public");
          await mkdir(directory, { mode: 0o700 });
          await mkdir(webroot, { mode: 0o700 });
          const identity = { ...site, installationId, keyId: "private",
            publicKeyBase64: Buffer.from(key.publicKey.export({ format: "jwk" }).x!, "base64url").toString("base64") };
          const php = spawnSync("php", ["wordpress/miopages-delivery/tests/core-pull-compat.php"], { encoding: "utf8",
            input: JSON.stringify({ core: origin, origin: wpOrigin, credentialId, secret: secret.toString("hex"),
              releaseId, identity, directory, webroot, envelope, digest: issued.envelopeSha256 }) });
          assert.equal(php.status, 0, php.stderr || php.error?.message);
          const staged = JSON.parse(php.stdout);
          assert.equal(staged.result.state, "staged");
          const phpPull = staged.requests[0];
          const phpResponse = await handler.handle(new Request(phpPull.url, { method: "POST", headers: phpPull.headers }));
          assert.equal(phpResponse.status, 200);
          assert.equal(await phpResponse.text(), envelope);
          const { url, headers } = staged.requests[1];
          assert.equal((await handler.handle(new Request(url, { method: "POST", headers }))).status, 204);
          const exactReceipt = "staged:1:" + issued.envelopeSha256;
          assert.equal(Object.entries(headers).find(([name]) => name.toLowerCase() === "x-miopages-receipt")?.[1], exactReceipt);
          assert.equal((await handler.handle(request("receipt", exactReceipt))).status, 204);
          const receipt = (await admin.query("SELECT staged_at FROM miopages_wp.wordpress_deliveries WHERE installation_id=$1", [installationId])).rows[0];
          assert.ok(receipt.staged_at instanceof Date);
          const pins = { identity, releaseId, approvalId: review.approvalId, digest: issued.envelopeSha256, directory, webroot };
          const render = async (input = pins) => {
            const current = await handler.handle(request("pull"));
            assert.equal(current.status, 200, "Current Core delivery eligibility required");
            assert.equal(current.headers.get("X-MioPages-Envelope-SHA256"), input.digest, "Current Core stage digest required");
            assert.equal(createHash("sha256").update(await current.text()).digest("hex"), input.digest);
            const child = spawnSync("php", ["wordpress/miopages-delivery/tests/staged-intro-preview.php"],
              { encoding: "utf8", input: JSON.stringify(input) });
            assert.equal(child.status, 0, "Private staged Intro refused");
            return JSON.parse(child.stdout) as { objectSha256: string; pageId: string; sectionId: string; html: string; draftInput: DraftInput };
          };
          const rendered = await render();
          assert.deepEqual([rendered.objectSha256, rendered.pageId, rendered.sectionId],
            [issued.envelopeSha256, page.pageId, page.sections[0].id]);
          assert.match(rendered.html, /Already have a website\? Start there\./);
          assert.match(rendered.html, /planned service starts with Launch/);
          await assert.rejects(render({ ...pins, identity: { ...identity, webPresenceId: randomUUID() } }), /Private staged Intro refused/);
          await assert.rejects(render({ ...pins, identity: { ...identity, managedSiteId: randomUUID() } }), /Private staged Intro refused/);
          await assert.rejects(render({ ...pins, releaseId: randomUUID() }), /Private staged Intro refused/);
          await assert.rejects(render({ ...pins, approvalId: "0".repeat(64) }), /Private staged Intro refused/);
          await assert.rejects(render({ ...pins, digest: "0".repeat(64) }), /Core stage digest required/);
          const stagedFile = path.join(directory, "objects", pins.digest + ".json");
          const stagedBytes = await readFile(stagedFile);
          await writeFile(stagedFile, Buffer.concat([stagedBytes, Buffer.from(" ")]));
          await assert.rejects(render(), /Private staged Intro refused/);
          await writeFile(stagedFile, stagedBytes);
          assert.deepEqual(await render(), rendered);
          assert.deepEqual(await readdir(directory), [".release.lock", "objects"]);
          const originalName = (await admin.query("SELECT name FROM managed_sites WHERE id=$1", [site.managedSiteId])).rows[0].name;
          await admin.query("UPDATE managed_sites SET name=$2 WHERE id=$1", [site.managedSiteId, originalName + " (fixture change)"]);
          await assert.rejects(render(), /Current Core delivery eligibility required/);
          await admin.query("UPDATE managed_sites SET name=$2 WHERE id=$1", [site.managedSiteId, originalName]);
          assert.deepEqual(await render(), rendered);
          const stagePage = async (decision: Awaited<ReturnType<typeof approvePage>>, pathName: "/" | "/service") => {
            const stageRelease = randomUUID(), stageInstallation = randomUUID(), stageCredential = randomUUID();
            const stageSecret = randomBytes(32);
            const stageOrigin = `https://${stageInstallation}.example.test`;
            credentials.set(stageCredential, stageSecret);
            const projection = await protectedServices.review.review(reviewerContext, decision);
            await protectedServices.review.review(reviewerContext, { ...decision,
              commit: { releaseId: stageRelease, projectionDigest: projection.projectionDigest } });
            const stageIdentity = { ...identity, installationId: stageInstallation };
            await protectedServices.delivery.enroll(reviewerContext, { ...stageIdentity, origin: stageOrigin, credentialId: stageCredential });
            const delivery = await protectedServices.delivery.issue(reviewerContext, stageInstallation, stageRelease, key.privateKey);
            assert.ok(delivery);
            const pulled = await handler.handle(request("pull", "", { installationId: stageInstallation, releaseId: stageRelease, credentialId: stageCredential, wpOrigin: stageOrigin }));
            assert.equal(pulled.status, 200);
            const body = await pulled.text(), digest = delivery.envelopeSha256;
            assert.equal(createHash("sha256").update(body).digest("hex"), digest);
            const stageDirectory = path.join(root, stageInstallation);
            await mkdir(stageDirectory, { mode: 0o700 });
            const stage = spawnSync("php", ["wordpress/miopages-delivery/tests/core-pull-compat.php"], {
              encoding: "utf8", input: JSON.stringify({ core: origin, origin: stageOrigin, credentialId: stageCredential, secret: stageSecret.toString("hex"),
                releaseId: stageRelease, identity: stageIdentity, directory: stageDirectory, webroot, envelope: body, digest }),
            });
            assert.equal(stage.status, 0, stage.stderr);
            const result = JSON.parse(stage.stdout);
            assert.equal(result.result.state, "staged");
            const [pull, receipt] = result.requests;
            const checkedPull = await handler.handle(new Request(pull.url, { method: "POST", headers: pull.headers }));
            assert.equal(checkedPull.status, 200);
            assert.equal(await checkedPull.text(), body);
            const ack = await handler.handle(new Request(receipt.url, { method: "POST", headers: receipt.headers }));
            assert.equal(ack.status, 204);
            assert.ok((await admin.query("SELECT staged_at FROM miopages_wp.wordpress_deliveries WHERE installation_id=$1 AND release_id=$2",
              [stageInstallation, stageRelease])).rows[0].staged_at instanceof Date);
            const marker = new Headers(receipt.headers).get("X-MioPages-Receipt");
            assert.equal(marker, "staged:1:" + digest);
            const child = spawnSync("php", ["wordpress/miopages-delivery/tests/staged-intro-preview.php"], {
              encoding: "utf8", input: JSON.stringify({ identity: stageIdentity, directory: stageDirectory, webroot,
                releaseId: stageRelease, approvalId: decision.approvalId, digest, path: pathName }),
            });
            assert.equal(child.status, 0, child.stderr);
            const stagedPage = JSON.parse(child.stdout) as { objectSha256: string; html: string; pageId: string; draftInput: DraftInput };
            assert.equal(stagedPage.objectSha256, digest);
            assert.deepEqual(await readdir(stageDirectory), [".release.lock", "objects"]);
            return { ...stagedPage, site, path: pathName, proposalId: decision.proposalId, revision: decision.binding.revision,
              sourceDigest: projection.sourceDigest, projectionDigest: projection.projectionDigest,
              receipt: marker, release: stageRelease, previewDigest: decision.previewDigest, approvalId: decision.approvalId };
          };
          const homePage = { ...page, pageId: randomUUID(), slug: "/", title: fixture.editorial("MioPages Home"),
            sections: [{ ...page.sections[0], id: randomUUID(), heading: fixture.editorial("What’s next for MioPages"),
              text: { ...page.sections[0].text, source: { ...page.sections[0].text.source, field: "transition-home" } } }] };
          const homeDecision = await approvePage(homePage);
          const home = await stagePage(homeDecision, "/");
          assert.equal(home.pageId, homePage.pageId);
          assert.match(home.html, /moving from legacy offerings/);
          const service = { ...rendered, site, path: "/service" as const, proposalId: review.proposalId,
            revision: review.binding.revision, sourceDigest: preview.sourceDigest, projectionDigest: preview.projectionDigest,
            receipt: exactReceipt, release: releaseId, previewDigest: review.previewDigest, approvalId: review.approvalId };
          const initial = privateSiteCandidate(site, home, service);
          const draftIntent = { siteProposalId: randomUUID(), installationId, revision: 1, previousDigest: null,
            navigation: ["/", "/service"], actions: [{ id: randomUUID(), label: "Explore the planned service",
              from: "/", type: "page", destination: "/service" }] };
          const initialDraft = await protectedServices.review.previewSiteDraft(reviewerContext, site, [homeDecision, review], draftIntent);
          assert.deepEqual(initialDraft.candidate.pages.map(item => item.path), ["/", "/service"]);
          assert.deepEqual(await protectedServices.review.previewSiteDraft(reviewerContext, site, [homeDecision, review], draftIntent), initialDraft);
          const authorizeDraft = (context: unknown, digest = initialDraft.digest) => protectedServices.review.authorizeSiteDraft(
            context, reviewerContext, site, [homeDecision, review], draftIntent, digest);
          await assert.rejects(authorizeDraft(reviewerContext), /authorization refused/);
          await assert.rejects(authorizeDraft(authorizerContext, "0".repeat(64)), /preview digest mismatch/);
          const issueDraft = (digest = initialDraft.digest, signingKey = key.privateKey) =>
            protectedServices.review.issueSiteDraft(authorizerContext, reviewerContext, site, [homeDecision, review],
              draftIntent, digest, signingKey);
          await assert.rejects(issueDraft(), /authorization conflict/);
          assert.deepEqual(await authorizeDraft(authorizerContext), initialDraft);
          assert.deepEqual(await authorizeDraft(authorizerContext), initialDraft);
          await assert.rejects(issueDraft(initialDraft.digest, generateKeyPairSync("ed25519").privateKey), /signer does not match/);
          const draftEnvelope = await issueDraft();
          const verifyDraft = (envelope = draftEnvelope, target = identity) =>
            spawnSync("php", ["wordpress/miopages-delivery/tests/native-draft-envelope.php"], { encoding: "utf8",
              input: JSON.stringify({ envelope, identity: target }) });
          const verifiedDraft = verifyDraft();
          assert.equal(verifiedDraft.status, 0, verifiedDraft.stderr);
          assert.deepEqual(JSON.parse(verifiedDraft.stdout), { digest: initialDraft.digest, revision: 1, operation: "apply" });
          assert.equal(verifyDraft({ ...draftEnvelope, payloadSha256: "0".repeat(64) }).status, 1);
          assert.equal(verifyDraft(draftEnvelope, { ...identity, installationId: randomUUID() }).status, 1);
          await assert.rejects(pullDb.query("SELECT * FROM wordpress_native_draft_authorizations"), /permission denied/);
          await assert.rejects(protectedServices.review.previewSiteDraft(reviewerContext, site, [homeDecision, review],
            { ...draftIntent, installationId: randomUUID() }), /installation scope/);
          await assert.rejects(protectedServices.review.previewSiteDraft(approverContext, site, [homeDecision, review], draftIntent), /Independent/);
          const reordered = await protectedServices.review.previewSiteDraft(reviewerContext, site, [homeDecision, review],
            { ...draftIntent, navigation: ["/service", "/"] });
          assert.notEqual(reordered.digest, initialDraft.digest);
          await assert.rejects(protectedServices.review.previewSiteDraft(reviewerContext, site, [homeDecision, review],
            { ...draftIntent, actions: [{ ...draftIntent.actions[0], destination: "https://foreign.example.test/" }] }), /action destination/);
          assert.throws(() => privateSiteCandidate(site, home, { ...service, site: { ...site, managedSiteId: randomUUID() } }));
          assert.throws(() => privateSiteCandidate(site, home, { ...service, sourceDigest: "0".repeat(64) }));
          assert.throws(() => privateSiteCandidate(site, home, { ...service, receipt: home.receipt }));
          const inquiry = await runInquiry();
          const improvedPage = { ...page, sections: [{ ...page.sections[0], heading: {
            kind: "editorial" as const, text: inquiry.recommendation,
            rationale: `Disposable Operator reviewed one accepted inquiry asking what to bring. Evidence ${inquiry.submissionId}.`,
          } }] };
          const decision = await approvePage(improvedPage, review.binding);
          assert.equal(decision.proposalId, review.proposalId);
          assert.equal(decision.binding.revision, 2);
          const improved = await stagePage(decision, "/service");
          assert.equal(improved.pageId, rendered.pageId);
          assert.notEqual(improved.objectSha256, rendered.objectSha256);
          assert.match(improved.html, /Bring its address to the first conversation/);
          assert.equal(improved.draftInput.heading, inquiry.recommendation);
          assert.equal(improved.draftInput.paragraph, serviceDirection);
          assert.throws(() => privateSiteCandidate(site, home, { ...improved,
            draftInput: { ...improved.draftInput, post_status: "publish" as "draft" } }, initial));
          const currentHome = await protectedServices.review.review(reviewerContext, homeDecision);
          assert.equal(currentHome.projectionDigest, home.projectionDigest);
          assert.equal(currentHome.sourceDigest, home.sourceDigest);
          const revised = privateSiteCandidate(site, home, improved, initial);
          const updatedDraft = await protectedServices.review.previewSiteDraft(reviewerContext, site, [homeDecision, decision],
            { ...draftIntent, revision: 2, previousDigest: initialDraft.digest });
          assert.equal(updatedDraft.candidate.previousDigest, initialDraft.digest);
          assert.notEqual(updatedDraft.digest, initialDraft.digest);
          const nextIntent = { ...draftIntent, revision: 2, previousDigest: initialDraft.digest };
          assert.deepEqual(await protectedServices.review.authorizeSiteDraft(authorizerContext, reviewerContext, site,
            [homeDecision, decision], nextIntent, updatedDraft.digest), updatedDraft);
          const restoreEnvelope = await protectedServices.review.issueSiteDraft(authorizerContext, reviewerContext, site,
            [homeDecision, decision], nextIntent, updatedDraft.digest, key.privateKey, "restore");
          const verifiedRestore = verifyDraft(restoreEnvelope);
          assert.equal(verifiedRestore.status, 0, verifiedRestore.stderr);
          assert.deepEqual(JSON.parse(verifiedRestore.stdout), { digest: updatedDraft.digest, revision: 2, operation: "restore" });
          const authorizations = await admin.query("SELECT revision,candidate_digest FROM miopages_wp.wordpress_native_draft_authorizations ORDER BY revision");
          assert.deepEqual(authorizations.rows, [{ revision: 1, candidate_digest: initialDraft.digest }, { revision: 2, candidate_digest: updatedDraft.digest }]);
          assert.equal(revised.manifest.previous, initial.digest);
          assert.notEqual(revised.digest, initial.digest);
          assert.deepEqual(revised.manifest.pages[0], initial.manifest.pages[0]);
          assert.throws(() => privateSiteCandidate(site, home, { ...improved, proposalId: randomUUID() }, initial));
          await admin.query("UPDATE miopages_wp.wordpress_operator_grants SET revoked_at=now() WHERE operator_id=$1 AND permission='approve-site-proposal'", [approver.id]);
          assert.equal((await handler.handle(request("pull"))).status, 409);
          await assert.rejects(render(), /Current Core delivery eligibility required/);
          await protectedServices.delivery.revoke(reviewerContext, installationId);
          assert.equal((await handler.handle(request("pull"))).status, 403);
          await assert.rejects(render(), /Current Core delivery eligibility required/);
          walkthrough = [interview, {
            "Fixture Organization": site.organizationId, "Fixture Web Presence": site.webPresenceId,
            "Fixture Managed Site": site.managedSiteId, "Author principal": author.id,
            "Approver principal": approver.id, "Independent projection reviewer principal": reviewer.id,
            "Author grant": review.authorGrant, "Approver grant": review.approvalGrant,
            "Projection reviewer grant": reviewerGrant.authorityReference,
            "Public fixture fact": canonical.row.id, "Public fixture fact revision": canonical.row.version,
            "Proposal": review.proposalId, "Revision": review.binding.revision, "Canonical base digest": preview.sourceDigest,
            "Core preview digest": review.previewDigest, "Exact fixture approval event": review.approvalId,
            "Projection digest": preview.projectionDigest, "Installation": installationId, "Release": releaseId,
            "Core exact site preview v1": initialDraft.digest, "Core exact site preview v2": updatedDraft.digest,
            "Staged Page": rendered.pageId, "Staged Intro Section": rendered.sectionId,
            "Envelope digest": rendered.objectSha256, "Returned receipt": exactReceipt,
            "Core accepted receipt at": receipt.staged_at.toISOString(),
          }, { directions, initial, inquiry, revised }];
        } finally {
          assert.match(path.basename(root), /^miopages-wordpress-pull-/);
          assert.equal(path.dirname(root), await realpath(tmpdir()));
          await rm(root, { recursive: true });
        }
        assert.equal((await inspectCanonical(admin, "knowledge", site.webPresenceId, knowledgeId))?.fingerprint, canonical.fingerprint);
        assert.equal((await admin.query("SELECT count(*)::int n FROM pages WHERE id=$1", [page.pageId])).rows[0].n, 0);
        assert.equal((await admin.query("SELECT count(*)::int n FROM site_content_events")).rows[0].n, 0);
      } finally { await Promise.all([operatorDb.end(), pullDb.end(), runtimeDb.end()]); }
    } finally { await fixture.stop(); }
  } finally { await cluster.stop(); }
  if (process.env.MIOPAGES_C0_SPINE_REVIEW === "1" && walkthrough) {
    const file = await writeC0SpineReview(...walkthrough);
    const { JSDOM } = await import("jsdom");
    const browser = new JSDOM(await readFile(file, "utf8"), { url: "file:///rehearsal/index.html", runScripts: "outside-only" });
    try {
      const { document, Event } = browser.window;
      const script = document.querySelector("script")!.textContent!;
      const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')!.getAttribute("content")!;
      assert.ok(csp.includes("'sha256-" + createHash("sha256").update(script).digest("base64") + "'"));
      browser.window.eval(script);
      const role = document.querySelector<HTMLSelectElement>("#operator-role")!;
      const form = document.querySelector<HTMLFormElement>("#rehearsal-note")!;
      const note = document.querySelector<HTMLTextAreaElement>("#note-text")!;
      const category = document.querySelector<HTMLSelectElement>("#note-category")!;
      const submit = (value: string) => {
        note.value = value;
        assert.equal(form.dispatchEvent(new Event("submit", { cancelable: true })), false);
      };
      assert.equal(role.disabled, false);
      assert.equal(role.value, "content-reviewer");
      category.value = "Request a content change";
      submit("Check the transition wording <example>.");
      role.value = "technical-operator";
      role.dispatchEvent(new Event("change"));
      assert.equal(document.querySelector<HTMLElement>('[data-role-example="content-reviewer"]')!.hidden, true);
      assert.equal(document.querySelector<HTMLElement>('[data-role-example="technical-operator"]')!.hidden, false);
      assert.equal(category.value, "QA observation");
      assert.match(document.querySelector("#rehearsal-handoff")!.textContent!, /Content Reviewer → Technical Operator.*<example>/);
      assert.equal(document.querySelector("#rehearsal-handoff example"), null);
      submit("The Home and Service routes match the candidate.");
      assert.match(document.querySelector("#rehearsal-handoff")!.textContent!, /Technical Operator → Content Reviewer/);
      role.value = "content-reviewer";
      role.dispatchEvent(new Event("change"));
      assert.equal(document.querySelectorAll("#rehearsal-handoff li").length, 2);
    } finally { browser.window.close(); }
    const dir = path.join(path.dirname(file), "site-v2");
    const manifest = JSON.parse(await readFile(path.join(dir, "candidate.json"), "utf8"));
    const plan = JSON.parse(await readFile(path.join(dir, "wordpress-draft-plan.json"), "utf8"));
    assert.equal(plan.candidateDigest, manifest.digest);
    assert.equal(plan.state, "blocked-pending-site-approval-and-native-materializer");
    for (const [i, page] of plan.pages.entries()) {
      assert.equal(page.draftInput.post_status, "draft");
      assert.equal(fingerprint(page.draftInput), manifest.pages[i].draftInputDigest);
      assert.equal(page.pageId, manifest.pages[i].pageId);
    }
    console.log("C0 spine review: " + file);
  }
});
