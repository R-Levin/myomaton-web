import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { siteReleaseFixture } from "../../scripts/site-releases/disposable";
import { writeReleaseInspection, renderContent } from "../../scripts/site-releases/inspection";
import { SiteReleaseService } from "../../lib/platform/content-editing/releases";

test("content release: exact approved canonical mutation, immutable evidence and bounded atomic rollback", async t => {
  const url = process.env.ASSET_TEST_DATABASE_URL; assert.ok(url);
  const old = { NODE_ENV: process.env.NODE_ENV, MIOPAGES_SITE_PROPOSALS: process.env.MIOPAGES_SITE_PROPOSALS, MIOPAGES_SITE_RELEASES: process.env.MIOPAGES_SITE_RELEASES, MIOPAGES_REVIEW_SYNTHESIS: process.env.MIOPAGES_REVIEW_SYNTHESIS };
  Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_SITE_PROPOSALS: "local-operator", MIOPAGES_SITE_RELEASES: "disposable-operator", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" });
  const f = await siteReleaseFixture(url);
  try {
    // Nonempty replacement proves restoration of IDs, versions, metadata and full
    // PostgreSQL timestamp precision, including a removed predecessor Section.
    const removed = randomUUID();
    await f.pool.query("INSERT INTO pages(id,managed_site_id,slug,name,title,version,metadata,created_at,updated_at) VALUES($1,$2,'/','Original name','Original title',7,'{\"retained\":true}','2026-01-01T01:02:03.123456Z','2026-01-02T01:02:03.654321Z')", [f.page.pageId, f.scope.managedSiteId]);
    for (const [id, order] of [[f.page.sections[0].id, 0], [removed, 1]] as const) await f.pool.query("INSERT INTO sections(id,page_id,type,variant,name,sort_order,content,metadata,version,created_at,updated_at) VALUES($1,$2,'intro','stack','Prior Section',$3,'{\"heading\":\"Original heading\",\"text\":\"Prior exact copy\"}','{\"prior\":true}',4,'2026-01-01T01:02:03.123456Z','2026-01-02T01:02:03.654321Z')", [id, f.page.pageId, order]);
    const action = randomUUID(); await f.pool.query("INSERT INTO actions(id,web_presence_id,name,type,label,destination) VALUES($1,$2,'synthetic-link','link','Learn more','https://example.test/contact')", [action, f.scope.webPresenceId]);
    const page = { ...f.page, operation: "replace-page" as const, sections: f.page.sections.map((s, i) => i === 2 ? { ...s, actionId: action } : s) };
    const prepared = await f.prepare(page), before = await f.releases.inspect(f.inspectContext, f.scope);
    const fake = { binding: prepared.binding, approvalEvent: "0".repeat(64), previewDigest: "0".repeat(64), requestId: randomUUID(), reference: "Synthetic" };
    await t.test("unapproved, forged/free-form authority, foreign scopes and unsupported operations refuse", async () => {
      await assert.rejects(f.releases.release(f.releaseContext, fake), /approved/);
      for (const context of ["operator", {}, f.approver, f.inspectContext]) await assert.rejects(f.releases.release(context, fake), /authority/);
      await assert.rejects(f.releases.release(f.releaseContext, { ...fake, binding: { ...fake.binding, scope: { ...f.scope, managedSiteId: randomUUID() } } }), /authority/);
      await assert.rejects(f.releases.release(f.releaseContext, { ...fake, binding: { ...fake.binding, scope: { ...f.scope, webPresenceId: randomUUID() } } }), /authority/);
      const foreign = { ...f.scope, managedSiteId: randomUUID() };
      await assert.rejects(f.releases.release(f.releaseGrant(["release-managed-site-change"], foreign), { ...fake, binding: { ...fake.binding, scope: foreign } }), /Foreign proposal scope/);
      await assert.rejects(f.service.prepare(f.operator, randomUUID(), f.scope, randomUUID(), { ...page, operation: "deploy-site" } as never));
    });
    const input = await f.approve(prepared);
    await t.test("a waiting release takes its canonical snapshot after a concurrent writer commits", async () => {
      const c = await f.pool.connect(), extra = randomUUID(); let pending: Promise<unknown> | undefined;
      try {
        await c.query("BEGIN"); await c.query("INSERT INTO pages(id,managed_site_id,slug,name,title) VALUES($1,$2,'/unrelated','Unrelated','Unrelated')", [extra, f.scope.managedSiteId]);
        // Attach rejection immediately so the test never produces an unhandled rejection.
        pending = assert.rejects(f.releases.release(f.releaseContext, input), /Stale/);
        await new Promise(resolve => setTimeout(resolve, 50)); await c.query("COMMIT"); await pending;
      } finally { await c.query("ROLLBACK"); c.release(); await f.pool.query("DELETE FROM pages WHERE id=$1", [extra]); }
    });
    await t.test("wrong revision/digests/approval event, stale Page and unavailable canonical source refuse", async () => {
      for (const patch of [{ digest: "0".repeat(64) }, { revision: 2 }, { baseFingerprint: "0".repeat(64) }]) await assert.rejects(f.releases.release(f.releaseContext, { ...input, binding: { ...input.binding, ...patch } }), /approved/);
      await assert.rejects(f.releases.release(f.releaseContext, { ...input, previewDigest: "0".repeat(64) }), /approved/);
      await assert.rejects(f.releases.release(f.releaseContext, { ...input, approvalEvent: "0".repeat(64) }), /approved/);
      await f.pool.query("UPDATE pages SET title='Unrelated edit' WHERE id=$1", [page.pageId]);
      try { await assert.rejects(f.releases.release(f.releaseContext, input), /Stale/); } finally { await f.pool.query("UPDATE pages SET title='Original title' WHERE id=$1", [page.pageId]); }
      const source = f.confirmed[1].confirmation.recordId;
      await f.pool.query("UPDATE offerings SET version=version+1 WHERE id=$1", [source]);
      try { await assert.rejects(f.releases.release(f.releaseContext, input), /Stale/); } finally { await f.pool.query("UPDATE offerings SET version=version-1 WHERE id=$1", [source]); }
    });
    await t.test("failure before commit rolls back all Page/Section changes and successful history", async () => {
      await f.pool.query("CREATE FUNCTION synthetic_release_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Forced release failure'; END $$");
      await f.pool.query("CREATE TRIGGER synthetic_release_failure BEFORE INSERT ON site_content_events FOR EACH ROW EXECUTE FUNCTION synthetic_release_failure()");
      try { await assert.rejects(f.releases.release(f.releaseContext, input), /Forced release failure/); assert.deepEqual(await f.releases.inspect(f.inspectContext, f.scope), before); }
      finally { await f.pool.query("DROP TRIGGER synthetic_release_failure ON site_content_events"); await f.pool.query("DROP FUNCTION synthetic_release_failure()"); }
    });
    const [release, duplicate] = await Promise.all([f.releases.release(f.releaseContext, input), f.releases.release(f.releaseContext, input)]);
    await t.test("concurrent matching retries release once; exact rows, copy, Actions and durable reopen agree", async () => {
      assert.deepEqual(duplicate, release); assert.equal(release.before_fingerprint, before.fingerprint);
      const after = await f.releases.inspect(f.inspectContext, f.scope); assert.equal(after.history.length, 1); assert.equal(after.rollbackAvailable, true); assert.equal(after.fingerprint, release.after_fingerprint);
      const current = after.base.sections.filter(s => s.page_id === page.pageId).sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
      assert.deepEqual(current.map(s => s.content), (await f.service.inspect(f.operator, prepared.id, f.scope)).revisions[0].candidate.sections.map(s => s.content));
      assert.equal(after.base.graph.site.status, "inactive"); assert.equal(release.after_content.page!.name, "Original name");
      assert.equal(release.after_content.sections.find(s => s.id === page.sections[0].id)!.version, 5);
      assert.ok(release.before_content.sections[0].created_at!.toString().includes("123456"));
      assert.equal((await f.pool.query("SELECT label FROM actions WHERE id=$1", [action])).rows[0].label, "Learn more");
      await assert.rejects(f.releases.release(f.releaseContext, { ...input, reference: "Conflicting key" }), /idempotency/);
      await assert.rejects(f.releases.release(f.releaseContext, { ...input, requestId: randomUUID() }), /already released/);
      const pool = new Pool({ connectionString: url, options: `-c search_path=${f.schema}` });
      try { assert.deepEqual(await new SiteReleaseService(pool, f.releaseAuthority).inspect(f.inspectContext, f.scope), after); } finally { await pool.end(); }
    });
    const rollbackInput = { releaseId: release.id, expectedFingerprint: release.after_fingerprint, requestId: randomUUID(), reference: "Synthetic rollback authorization" };
    await t.test("unauthorized, foreign, stale and unrelated-edit rollback refuse", async () => {
      await assert.rejects(f.releases.rollback(f.releaseContext, f.scope, rollbackInput), /authority/);
      await assert.rejects(f.releases.rollback(f.rollbackContext, { ...f.scope, managedSiteId: randomUUID() }, rollbackInput), /authority/);
      await assert.rejects(f.releases.rollback(f.rollbackContext, f.scope, { ...rollbackInput, expectedFingerprint: "0".repeat(64) }), /Stale|stale/);
      // A sub-millisecond edit must not evade exact rollback drift detection.
      await f.pool.query("UPDATE pages SET updated_at=updated_at+interval '1 microsecond' WHERE id=$1", [page.pageId]);
      try { await assert.rejects(f.releases.rollback(f.rollbackContext, f.scope, rollbackInput), /Unrelated/); }
      finally { await f.pool.query("UPDATE pages SET updated_at=updated_at-interval '1 microsecond' WHERE id=$1", [page.pageId]); }
      await f.pool.query("UPDATE actions SET updated_at=updated_at+interval '1 microsecond' WHERE id=$1", [action]);
      try { await assert.rejects(f.releases.rollback(f.rollbackContext, f.scope, rollbackInput), /Unrelated/); }
      finally { await f.pool.query("UPDATE actions SET updated_at=updated_at-interval '1 microsecond' WHERE id=$1", [action]); }
      await f.pool.query("CREATE FUNCTION synthetic_rollback_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.operation='rollback' THEN RAISE EXCEPTION 'Forced rollback failure'; END IF; RETURN NEW; END $$");
      await f.pool.query("CREATE TRIGGER synthetic_rollback_failure BEFORE INSERT ON site_content_events FOR EACH ROW EXECUTE FUNCTION synthetic_rollback_failure()");
      try { await assert.rejects(f.releases.rollback(f.rollbackContext, f.scope, rollbackInput), /Forced rollback failure/); assert.equal((await f.releases.inspect(f.inspectContext, f.scope)).fingerprint, release.after_fingerprint); }
      finally { await f.pool.query("DROP TRIGGER synthetic_rollback_failure ON site_content_events"); await f.pool.query("DROP FUNCTION synthetic_rollback_failure()"); }
    });
    const [rollback, rollbackDuplicate] = await Promise.all([f.releases.rollback(f.rollbackContext, f.scope, rollbackInput), f.releases.rollback(f.rollbackContext, f.scope, rollbackInput)]);
    await t.test("exact rollback restores prior bytes/versions/metadata, retains immutable history and rejects double rollback", async () => {
      assert.deepEqual(rollbackDuplicate, rollback); const restored = await f.releases.inspect(f.inspectContext, f.scope);
      assert.equal(restored.fingerprint, before.fingerprint); assert.deepEqual(restored.base, before.base); assert.equal(restored.history.length, 2); assert.equal(restored.rollbackAvailable, false);
      assert.equal(renderContent(rollback.after_content), renderContent(release.before_content));
      await assert.rejects(f.releases.rollback(f.rollbackContext, f.scope, { ...rollbackInput, requestId: randomUUID() }), /current latest/);
      await assert.rejects(f.releases.rollback(f.rollbackContext, f.scope, { ...rollbackInput, reference: "Conflicting key" }), /idempotency/);
      for (const sql of ["UPDATE site_content_events SET reference='tampered'", "DELETE FROM site_content_events", "TRUNCATE site_content_events"]) await assert.rejects(f.pool.query(sql), /immutable/);
      for (const patch of [{ approval_event: "0".repeat(64) }, { managed_site_id: randomUUID() }, { before_content: { page: null, sections: [] } }]) {
        await assert.rejects(f.pool.query("INSERT INTO site_content_events SELECT * FROM jsonb_populate_record(NULL::site_content_events,$1::jsonb)", [JSON.stringify({ ...release, ...patch, id: randomUUID(), sequence: 3, request_id: randomUUID(), previous_digest: rollback.digest })]));
      }
      const proposal = await f.service.inspect(f.operator, prepared.id, f.scope); await writeReleaseInspection(proposal.revisions[0], release, rollback);
    });
    await t.test("superseded proposal and non-current releases refuse; new exact approval can release again", async () => {
      const next = await f.prepare({ ...page, title: f.editorial("Second exact release") }), priorInput = await f.approve(next);
      const revised = await f.service.prepare(f.operator, next.id, f.scope, randomUUID(), { ...page, title: f.editorial("Third exact direction") }, next.binding);
      await assert.rejects(f.releases.release(f.releaseContext, priorInput), /approved/);
      const finalInput = await f.approve({ id: next.id, binding: revised.revision!.binding });
      const second = await f.releases.release(f.releaseContext, finalInput);
      await assert.rejects(f.releases.rollback(f.rollbackContext, f.scope, { ...rollbackInput, requestId: randomUUID() }), /current latest/);
      await f.releases.rollback(f.rollbackContext, f.scope, { releaseId: second.id, expectedFingerprint: second.after_fingerprint, requestId: randomUUID(), reference: "Synthetic final restoration" });
      assert.equal((await f.releases.inspect(f.inspectContext, f.scope)).fingerprint, before.fingerprint);
    });
    await t.test("competing approved proposals cannot both commit against the same canonical baseline", async () => {
      const first = await f.approve(await f.prepare({ ...page, title: f.editorial("Competing first direction") }));
      const second = await f.approve(await f.prepare({ ...page, title: f.editorial("Competing second direction") }));
      const results = await Promise.allSettled([f.releases.release(f.releaseContext, first), f.releases.release(f.releaseContext, second)]);
      const successes = results.filter(r => r.status === "fulfilled"); assert.equal(successes.length, 1);
      const winner = successes[0]; assert.equal(winner.status, "fulfilled");
      if (winner.status === "fulfilled") await f.releases.rollback(f.rollbackContext, f.scope, { releaseId: winner.value.id, expectedFingerprint: winner.value.after_fingerprint, requestId: randomUUID(), reference: "Synthetic competing request cleanup" });
      assert.equal((await f.releases.inspect(f.inspectContext, f.scope)).fingerprint, before.fingerprint);
    });
    await t.test("a referenced anchor cannot disappear through a Page replacement", async () => {
      const anchorAction = randomUUID();
      await f.pool.query("UPDATE sections SET configuration='{\"anchor\":\"prior-anchor\"}' WHERE id=$1", [removed]);
      await f.pool.query("INSERT INTO actions(id,web_presence_id,name,type,label,destination) VALUES($1,$2,'prior-anchor-link','section','Prior section','#prior-anchor')", [anchorAction, f.scope.webPresenceId]);
      try {
        const input = await f.approve(await f.prepare(page)), current = await f.releases.inspect(f.inspectContext, f.scope);
        await assert.rejects(f.releases.release(f.releaseContext, input), /Referenced/);
        assert.deepEqual(await f.releases.inspect(f.inspectContext, f.scope), current);
      } finally {
        await f.pool.query("DELETE FROM actions WHERE id=$1", [anchorAction]); await f.pool.query("UPDATE sections SET configuration='{}' WHERE id=$1", [removed]);
      }
    });
    await f.verify();
  } finally { await f.stop(); Object.assign(process.env, old); }
});
