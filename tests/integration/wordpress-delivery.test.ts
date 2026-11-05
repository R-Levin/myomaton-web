import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
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
      const migrate = async () => {
        const db = await admin.connect();
        try {
          await db.query("BEGIN");
          await integratePrivateStage(db, fixture.schema);
          await db.query("COMMIT");
        } catch (error) { await db.query("ROLLBACK"); throw error; }
        finally { db.release(); }
      };
      await migrate();
      await migrate();

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
        const author = await provision(["prepare-site-proposal", "preview-site-proposal"]);
        const reviewer = await provision(["review-private-stage", "enroll", "issue"]);
        const expired = await provision(["enroll"], new Date(0));
        const origin = "https://core.example.test";
        const protectedServices = protectedOperatorServices(operatorDb, boundary(operatorRole), origin);
        await assert.rejects(protectedServices.operator.authenticate(expired.token), /authentication refused/);
        await assert.rejects(protectedServices.operator.authorize({ operatorId: reviewer.id }, "issue", site), /authorization refused/);
        const reviewerContext = await protectedServices.operator.authenticate(reviewer.token);
        const authorContext = await protectedServices.operator.authenticate(author.token);
        const approverContext = await protectedServices.operator.authenticate(approver.token);
        await assert.rejects(protectedServices.operator.authorize(reviewerContext, "issue", { ...site, managedSiteId: randomUUID() }), /authorization refused/);

        const approvePage = async (page = fixture.page) => {
          const proposed = await protectedServices.proposals(authorContext).prepare(authorContext, randomUUID(), fixture.scope, randomUUID(), page);
          const binding = proposed.revision!.binding;
          const preview = await protectedServices.proposals(authorContext).preview(authorContext, binding, randomUUID());
          const approval = await protectedServices.proposals(approverContext).approve(approverContext, {
            binding, requestId: randomUUID(), previewDigest: preview.digest, previewEvent: preview.event, reference: "Test customer review",
          });
          return { site, proposalId: binding.proposalId, approvalId: approval.hash };
        };
        const internal = await approvePage();
        await assert.rejects(protectedServices.review.review(reviewerContext, internal), /not approved for public projection/);

        // Seed the authorized public source through the existing writer, with the
        // disposable presence temporarily active. The adapter itself cannot write it.
        const now = new Date().toISOString(), knowledgeId = fixture.confirmed[0].confirmation.recordId;
        const priorKnowledge = await inspectCanonical(admin, "knowledge", site.webPresenceId, knowledgeId);
        assert.ok(priorKnowledge);
        await admin.query("UPDATE web_presences SET status='active' WHERE id=$1", [site.webPresenceId]);
        try {
          await writeCanonical(admin, { domain: "knowledge", id: knowledgeId, webPresenceId: site.webPresenceId,
            expectedVersion: priorKnowledge.row.version, expectedFingerprint: priorKnowledge.fingerprint, responsibleIdentity: "test-public-fact-reviewer",
            changeReason: "Disposable fixture", payload: { ...priorKnowledge.row.payload, entries: [
              ...priorKnowledge.row.payload.entries,
              { key: "public-fact", kind: "audience", value: "Independent businesses",
                evidence: { sourceKind: "operator", sourceReference: "Disposable approved source", confirmation: "confirmed",
                  visibility: "public", confirmedBy: "test-public-fact-reviewer", confirmedAt: now } },
            ], approval: { by: "test-public-fact-reviewer", at: now, scope: "public" } } });
        } finally { await admin.query("UPDATE web_presences SET status='inactive' WHERE id=$1", [site.webPresenceId]); }
        const canonical = await inspectCanonical(admin, "knowledge", site.webPresenceId, knowledgeId);
        assert.ok(canonical);
        const page = { ...fixture.page, sections: [{ id: randomUUID(), type: "intro" as const,
          heading: fixture.editorial("Who this is for"), text: { kind: "canonical" as const,
            source: { domain: "knowledge" as const, recordId: knowledgeId, revision: canonical.row.version,
              fingerprint: canonical.fingerprint, field: "public-fact" } } }] };
        const review = await approvePage(page);
        await assert.rejects(protectedServices.review.review(approverContext, review), /Independent/);
        const preview = await protectedServices.review.review(reviewerContext, review);
        assert.equal(preview.pages[0].sections[0].content.text, "Independent businesses");
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
        const handler = new WordPressDelivery(pullDb, async () => null, async id => id === credentialId ? secret : null,
          origin, undefined, boundary(pullRole));
        const request = (operation: string, receipt = "") => {
          const nonce = randomBytes(16).toString("hex"), time = String(Date.now());
          const mac = requestMac(secret, [origin, operation, installationId, wpOrigin, credentialId, releaseId, nonce, time, receipt]);
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
          const { url, headers } = staged.requests[1];
          assert.equal((await handler.handle(new Request(url, { method: "POST", headers }))).status, 204);
          assert.deepEqual(await readdir(directory), [".release.lock", "objects"]);
        } finally {
          assert.match(path.basename(root), /^miopages-wordpress-pull-/);
          assert.equal(path.dirname(root), await realpath(tmpdir()));
          await rm(root, { recursive: true });
        }
        await admin.query("UPDATE miopages_wp.wordpress_operator_grants SET revoked_at=now() WHERE operator_id=$1 AND permission='approve-site-proposal'", [approver.id]);
        assert.equal((await handler.handle(request("pull"))).status, 409);
        assert.equal((await admin.query("SELECT count(*)::int n FROM pages WHERE id=$1", [page.pageId])).rows[0].n, 0);
        assert.equal((await admin.query("SELECT count(*)::int n FROM site_content_events")).rows[0].n, 0);
      } finally { await Promise.all([operatorDb.end(), pullDb.end(), runtimeDb.end()]); }
    } finally { await fixture.stop(); }
  } finally { await cluster.stop(); }
});
