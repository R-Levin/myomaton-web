import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool } from "pg";
import { siteReleaseFixture } from "../../scripts/site-releases/disposable";
import { backup, verify, restoreTest, type Config } from "../../scripts/backup/core";
import { assetRoot } from "../../lib/platform/assets/local-storage";
import { releaseHistory } from "../../lib/platform/content-editing/releases";
import { releaseBase } from "../../lib/platform/content-editing/release";
import { fingerprint } from "../../lib/platform/canonical/model";

test("normal backup restores release/rollback history, current content and exact predecessor snapshots", async () => {
  const input = process.env.ASSET_TEST_DATABASE_URL; assert.ok(input); const u = new URL(input);
  assert.equal(u.hostname, "127.0.0.1"); assert.notEqual(u.port, "5432"); assert.match(u.pathname, /^\/migration_rehearsal_[a-f0-9]{32}$/);
  const old = { NODE_ENV: process.env.NODE_ENV, MIOPAGES_SITE_PROPOSALS: process.env.MIOPAGES_SITE_PROPOSALS, MIOPAGES_SITE_RELEASES: process.env.MIOPAGES_SITE_RELEASES, MIOPAGES_REVIEW_SYNTHESIS: process.env.MIOPAGES_REVIEW_SYNTHESIS };
  Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_SITE_PROPOSALS: "local-operator", MIOPAGES_SITE_RELEASES: "disposable-operator", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" });
  const f = await siteReleaseFixture(input), admin = new Pool({ connectionString: input }), renamed = "canonical_test_" + randomUUID().replaceAll("-", "") + "_release_recovery"; let swapped = false;
  const swap = async (forward: boolean) => { const c = await admin.connect(); try {
    await c.query("BEGIN"); await c.query(`ALTER SCHEMA public RENAME TO "${forward ? renamed : f.schema}"`); await c.query(`ALTER SCHEMA "${forward ? f.schema : renamed}" RENAME TO public`); await c.query("COMMIT");
  } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); } };
  try {
    const input1 = await f.approve(await f.prepare()), release = await f.releases.release(f.releaseContext, input1);
    const rollback = await f.releases.rollback(f.rollbackContext, f.scope, { releaseId: release.id, expectedFingerprint: release.after_fingerprint, requestId: randomUUID(), reference: "Synthetic restored predecessor" });
    assert.equal(rollback.after_fingerprint, release.before_fingerprint);
    const input2 = await f.approve(await f.prepare({ ...f.page, title: f.editorial("Current released recovery example") }));
    const current = await f.releases.release(f.releaseContext, input2), expected = await f.releases.inspect(f.inspectContext, f.scope);
    assert.equal(expected.history.length, 3); assert.equal(expected.rollbackAvailable, true);
    await swap(true); swapped = true; await admin.query("GRANT USAGE,CREATE ON SCHEMA public TO postgres");
    const root = await mkdtemp(path.join(tmpdir(), "site-release-recovery-"));
    const config: Config = { root, databaseUrl: input, objectsRoot: assetRoot(), pgBin: process.env.PG_BIN_DIR || "C:\\Program Files\\PostgreSQL\\18\\bin", repository: process.cwd() };
    const point = await backup(config), checked = await verify(config, point.id);
    assert.equal(checked.manifest.state.tables.find(t => t.schema === "public" && t.table === "site_content_events")?.count, 3);
    const result = await restoreTest(config, point.id, async target => {
      const c = await target.connect(); try {
        await c.query("BEGIN READ ONLY"); await c.query("SET LOCAL TIME ZONE 'UTC'");
        const history = await releaseHistory(c, f.scope), base = await releaseBase(c, f.scope);
        assert.deepEqual(history, expected.history); assert.deepEqual(JSON.parse(JSON.stringify(base)), expected.base);
        assert.equal(fingerprint(base), current.after_fingerprint); assert.deepEqual(history[1].after_content, history[0].before_content);
        assert.deepEqual(history[2].before_content, history[0].before_content);
        assert.equal((await c.query("SELECT title FROM pages WHERE id=$1", [f.page.pageId])).rows[0].title, "Current released recovery example");
        await c.query("ROLLBACK");
      } finally { c.release(); }
    });
    assert.equal(result.semanticSchemaMatches, true); assert.equal(result.securityMatches, true); assert.equal(result.temporaryTargetRemoved, true);
    await mkdir("runtime-content/site-release-proof", { recursive: true }); await writeFile("runtime-content/site-release-proof/recovery.json", JSON.stringify({ isolatedSourceOnly: true, point: point.id, receipt: result.receipt, releasesRecovered: 2, rollbacksRecovered: 1, exactHistoryAndCurrentContent: true, predecessorSnapshotsRestored: true, runtimeLedgerRequired: false, sharedTouched: false }, null, 2));
  } finally { if (swapped) await swap(false); await admin.end(); await f.stop(); Object.assign(process.env, old); }
});
