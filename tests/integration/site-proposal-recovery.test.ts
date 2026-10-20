import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool } from "pg";
import { siteProposalFixture } from "../../scripts/site-proposals/disposable";
import { backup, restoreTest, verify, type Config } from "../../scripts/backup/core";
import { assetRoot } from "../../lib/platform/assets/local-storage";
import { SiteProposalService } from "../../lib/platform/content-editing/proposals";
import { PostgresProposalPersistence } from "../../lib/platform/content-editing/proposal-postgres";
import { proposalPreview } from "../../lib/platform/content-editing/proposal-preview";
import { fingerprint } from "../../lib/platform/canonical/model";

test("normal custom-format backup/isolated restore preserves durable proposal approval without runtime ledger", async () => {
  const input = process.env.ASSET_TEST_DATABASE_URL; assert.ok(input);
  const u = new URL(input); assert.equal(u.hostname, "127.0.0.1"); assert.notEqual(u.port, "5432"); assert.match(u.pathname, /^\/migration_rehearsal_[a-f0-9]{32}$/);
  const old = { NODE_ENV: process.env.NODE_ENV, MIOPAGES_SITE_PROPOSALS: process.env.MIOPAGES_SITE_PROPOSALS, MIOPAGES_REVIEW_SYNTHESIS: process.env.MIOPAGES_REVIEW_SYNTHESIS };
  Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_SITE_PROPOSALS: "local-operator", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" });
  const f = await siteProposalFixture(input, true), admin = new Pool({ connectionString: input }), id = randomUUID(), renamed = "canonical_test_" + randomUUID().replaceAll("-", "") + "_recovery_source"; let swapped = false;
  const swap = async (forward: boolean) => {
    const c = await admin.connect(); try {
      await c.query("BEGIN");
      await c.query(`ALTER SCHEMA public RENAME TO "${forward ? renamed : f.schema}"`);
      await c.query(`ALTER SCHEMA "${forward ? f.schema : renamed}" RENAME TO public`);
      await c.query("COMMIT");
    } catch (error) { await c.query("ROLLBACK"); throw error; } finally { c.release(); }
  };
  try {
    const prepared = await f.service.prepare(f.operator, id, f.scope, randomUUID(), f.page), initial = await f.service.preview(f.operator, prepared.revision!.binding, randomUUID());
    await f.service.approve(f.approver, { binding: initial.binding, requestId: randomUUID(), previewDigest: initial.digest, previewEvent: initial.event, reference: "Synthetic initial approval for recovery proof" });
    const revised = await f.service.prepare(f.operator, id, f.scope, randomUUID(), { ...f.page, title: f.editorial("A revised direction for recovery proof") }, initial.binding);
    const preview = await f.service.preview(f.operator, revised.revision!.binding, randomUUID());
    await f.service.approve(f.approver, { binding: preview.binding, requestId: randomUUID(), previewDigest: preview.digest, previewEvent: preview.event, reference: "Synthetic revised approval for recovery proof" });
    const expected = await f.service.inspect(f.operator, id, f.scope);
    // Only this generated private cluster/database. Swap its synthetic schema into
    // public so unchanged normal backup exclusions apply exactly as in shared use.
    await swap(true); swapped = true;
    // The renamed template-public seed remains a disposable excluded fixture.
    // Give this new public fixture an explicit ordinary restricted owner ACL;
    // do not carry template-public pg_init_privs into a renamed included schema.
    assert.equal((await admin.query("SELECT current_user u")).rows[0].u, "postgres");
    await admin.query("GRANT USAGE,CREATE ON SCHEMA public TO postgres");
    process.env.MIOPAGES_SITE_PROPOSALS = "shared-development";
    const sharedService = new SiteProposalService(admin, f.authority, new PostgresProposalPersistence(admin));
    assert.deepEqual(await sharedService.inspect(f.operator, id, f.scope), expected);
    const root = await mkdtemp(path.join(tmpdir(), "site-proposal-recovery-"));
    const config: Config = { root, databaseUrl: input, objectsRoot: assetRoot(), pgBin: process.env.PG_BIN_DIR || "C:\\Program Files\\PostgreSQL\\18\\bin", repository: process.cwd() };
    const point = await backup(config), checked = await verify(config, point.id);
    for (const table of ["site_change_proposals", "site_change_revisions", "site_change_events"]) assert.ok(checked.manifest.state.tables.some(t => t.schema === "public" && t.table === table && t.count > 0));
    const result = await restoreTest(config, point.id, async target => {
      const restored = await new SiteProposalService(target, f.authority, new PostgresProposalPersistence(target)).inspect(f.operator, id, f.scope);
      assert.deepEqual(restored, expected); assert.equal(restored.approvalValid, true);
      assert.equal(restored.revisions.length, 2); assert.equal(restored.events.filter(e => e.action === "approve").length, 2);
      assert.equal(fingerprint(proposalPreview(restored.revisions.at(-1)!)), preview.digest);
      assert.equal((await target.query("SELECT count(*)::int n FROM pages WHERE managed_site_id=$1", [f.scope.managedSiteId])).rows[0].n, 0);
    });
    assert.equal(result.semanticSchemaMatches, true); assert.equal(result.securityMatches, true); assert.equal(result.temporaryTargetRemoved, true);
    await mkdir("runtime-content/site-proposal-durable-proof", { recursive: true });
    await writeFile("runtime-content/site-proposal-durable-proof/recovery.json", JSON.stringify({ source: "isolated disposable cluster only", root, point: point.id, restoreReceipt: result.receipt, proposal: id, exactHistoryRestored: true, revisionsRestored: 2, approvalsRestored: 2, previewDigest: preview.digest, runtimeLedgerRequired: false, sharedStateTouched: false }, null, 2));
  } finally {
    if (swapped) await swap(false);
    await admin.end(); await f.stop(); Object.assign(process.env, old);
  }
});
