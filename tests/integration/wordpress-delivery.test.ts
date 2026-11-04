import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool } from "pg";
import test from "node:test";
import { migrateWithBootstrapCompatibility } from "../../scripts/db/bootstrap";
import { mioPagesIntakeOwner } from "../../lib/platform/intake/availability";
import { disposableCluster } from "../../scripts/backup/disposable-cluster";
import { siteReleaseFixture } from "../../scripts/site-releases/disposable";
import { fingerprint } from "../../lib/platform/canonical/model";
import type { ReviewedProjection } from "../../lib/platform/wordpress-delivery/authority";
import { requestMac, WordPressDelivery } from "../../lib/platform/wordpress-delivery/service";

test("WordPress private delivery through Core evidence, durable enrollment and exact PHP receipt", { timeout: 120_000 }, async () => {
  const bin = process.env.WORDPRESS_TEST_PG_BIN;
  assert.ok(bin, "Set WORDPRESS_TEST_PG_BIN to a local PostgreSQL 18 bin directory");
  Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_SITE_PROPOSALS: "local-operator",
    MIOPAGES_SITE_RELEASES: "disposable-operator", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" });
  const cluster = await disposableCluster(bin);
  try {
    const baseline = new Pool({ connectionString: cluster.url });
    try {
      await migrateWithBootstrapCompatibility(baseline);
      const organization = randomUUID();
      await baseline.query("INSERT INTO organizations(id,name) VALUES($1,'Synthetic intake organization')", [organization]);
      await baseline.query("INSERT INTO web_presences(id,organization_id,name) VALUES($1,$2,'Synthetic intake presence')",
        [mioPagesIntakeOwner.webPresenceId, organization]);
      await baseline.query("INSERT INTO managed_sites(id,web_presence_id,name) VALUES($1,$2,'Synthetic intake site')",
        [mioPagesIntakeOwner.managedSiteId, mioPagesIntakeOwner.webPresenceId]);
    } finally { await baseline.end(); }
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
