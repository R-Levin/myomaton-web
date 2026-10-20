import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { Pool } from "pg";
import { siteProposalFixture } from "../../scripts/site-proposals/disposable";
import { SiteProposalService } from "../../lib/platform/content-editing/proposals";
import { PostgresProposalPersistence, durableProposalFingerprint } from "../../lib/platform/content-editing/proposal-postgres";
import { proposalPreview } from "../../lib/platform/content-editing/proposal-preview";
import { fingerprint } from "../../lib/platform/canonical/model";
import { inspectCanonical } from "../../lib/platform/canonical/writes";

test("durable proposals: atomic concurrency, reopen, SQL guards and exact authority history", async t => {
  const url = process.env.ASSET_TEST_DATABASE_URL; assert.ok(url);
  const old = { NODE_ENV: process.env.NODE_ENV, MIOPAGES_SITE_PROPOSALS: process.env.MIOPAGES_SITE_PROPOSALS, MIOPAGES_REVIEW_SYNTHESIS: process.env.MIOPAGES_REVIEW_SYNTHESIS };
  Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_SITE_PROPOSALS: "local-operator", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" });
  const f = await siteProposalFixture(url, true), id = randomUUID(), requestId = randomUUID();
  const reopen = () => new SiteProposalService(f.pool, f.authority, new PostgresProposalPersistence(f.pool));
  const stored = async () => { const c = await f.pool.connect(); try { return await durableProposalFingerprint(c); } finally { c.release(); } };
  try {
    await t.test("concurrent duplicate create/revision retries append once and conflicting reuse refuses", async () => {
      const replies = await Promise.all([f.service.prepare(f.operator, id, f.scope, requestId, f.page), reopen().prepare(f.operator, id, f.scope, requestId, f.page)]);
      assert.deepEqual(replies[0], replies[1]); assert.equal((await reopen().inspect(f.operator, id, f.scope)).events.length, 1);
      await assert.rejects(reopen().prepare(f.operator, id, f.scope, requestId, { ...f.page, purpose: "Conflicting creation" }), /idempotency conflict/);
      const input = { ...f.page, title: f.editorial("Revised durable direction") }, expected = replies[0].revision!.binding, key = randomUUID();
      const revisions = await Promise.all([reopen().prepare(f.operator, id, f.scope, key, input, expected), reopen().prepare(f.operator, id, f.scope, key, input, expected)]);
      assert.deepEqual(revisions[0], revisions[1]); assert.equal(revisions[0].revision!.binding.revision, 2);
    });
    await t.test("approval/revision race cannot transfer consent; restart preserves exact approved event", async () => {
      const current = await reopen().inspect(f.operator, id, f.scope), binding = current.revisions.at(-1)!.binding;
      const preview = await reopen().preview(f.operator, binding, randomUUID());
      const results = await Promise.allSettled([
        reopen().approve(f.approver, { binding, requestId: randomUUID(), previewDigest: preview.digest, previewEvent: preview.event, reference: "Synthetic representative consent" }),
        reopen().prepare(f.operator, id, f.scope, randomUUID(), { ...f.page, title: f.editorial("New direction needs fresh consent") }, binding),
      ]);
      assert.ok(results.some(r => r.status === "fulfilled"));
      const next = await reopen().inspect(f.operator, id, f.scope); assert.equal(next.revisions.length, 3); assert.equal(next.state, "PROPOSED"); assert.equal(next.approval, null);
      const reviewed = await reopen().preview(f.operator, next.revisions.at(-1)!.binding, randomUUID());
      const input = { binding: reviewed.binding, requestId: randomUUID(), previewDigest: reviewed.digest, previewEvent: reviewed.event, reference: "Synthetic human inspected final durable candidate" };
      const approvals = await Promise.all([reopen().approve(f.approver, input), reopen().approve(f.approver, input)]); assert.deepEqual(approvals[0], approvals[1]);
      const state = await reopen().inspect(f.operator, id, f.scope); assert.equal(state.state, "APPROVED"); assert.equal(state.approvalValid, true); assert.equal(state.approval!.customer.subjectId, "synthetic-customer-representative");
      assert.equal((await f.pool.query("SELECT count(*)::int n FROM site_change_events WHERE proposal_id=$1 AND revision=3 AND operation='approve'", [id])).rows[0].n, 1);
      const html = proposalPreview(state.revisions.at(-1)!); assert.equal(fingerprint(html), state.approval!.previewDigest);
      await mkdir("runtime-content/site-proposal-durable-proof", { recursive: true });
      await writeFile("runtime-content/site-proposal-durable-proof/candidate.html", html);
      await writeFile("runtime-content/site-proposal-durable-proof/inspection.json", JSON.stringify({ label: "SYNTHETIC DURABLE DATABASE PROOF; disposable source removed", state, rereadAfterReopen: true, activeSiteUnchanged: true }, null, 2));
      await writeFile("runtime-content/site-proposal-durable-proof/inspection.md", `# Synthetic durable proposal\n\nProposal: ${id}\nScope: ${JSON.stringify(f.scope)}\nRevision: 3\nDigest: ${state.approval!.binding.digest}\nPreview digest: ${state.approval!.previewDigest}\nState: APPROVED (synthetic only)\nApproving authority: ${state.approval!.customer.subjectId}\nRecording operator: ${state.approval!.recordedBy.operatorId}\n\nReopened using a new PostgreSQL store/service. Source revisions, exact operations, editorial rationales and complete immutable approval/history are in inspection.json. No local ledger is needed for reread. No active Page/Section was created or changed.\n`);
    });
    await t.test("database refuses retargeting, immutable history changes, truncation, orphan revisions and forged approval", async () => {
      const before = await stored();
      for (const table of ["site_change_proposals", "site_change_revisions", "site_change_events"]) {
        await assert.rejects(f.pool.query(`UPDATE ${table} SET ${table === "site_change_proposals" ? "managed_site_id" : "proposal_id"}=$1 WHERE ${table === "site_change_proposals" ? "id" : "proposal_id"}=$2`, [randomUUID(), id]), /immutable/);
        await assert.rejects(f.pool.query(`DELETE FROM ${table} WHERE ${table === "site_change_proposals" ? "id" : "proposal_id"}=$1`, [id]), /immutable/);
      }
      await assert.rejects(f.pool.query("TRUNCATE site_change_proposals CASCADE"), /immutable/);
      await assert.rejects(f.pool.query("INSERT INTO site_change_proposals SELECT $1,organization_id,web_presence_id,managed_site_id,created_at FROM site_change_proposals WHERE id=$2", [randomUUID(), id]), /atomic first revision/);
      await assert.rejects(f.pool.query("INSERT INTO site_change_revisions SELECT proposal_id,99,digest,base_fingerprint,data,created_at FROM site_change_revisions WHERE proposal_id=$1 AND revision=3", [id]), /revision\/destination/);
      await assert.rejects(f.pool.query("INSERT INTO site_change_events SELECT proposal_id,sequence+1,$2,request_digest,operation,revision,$3,base_fingerprint,previous,digest,preview_digest,preview_event,renderer,actor,authority_reference,customer,approval_reference,at,data FROM site_change_events WHERE proposal_id=$1 AND operation='approve' AND revision=3", [id, randomUUID(), "0".repeat(64)]));
      const c = await f.pool.connect(); try { assert.equal(await durableProposalFingerprint(c), before); } finally { c.release(); }
      await assert.rejects(reopen().publish(), /not implemented/);
      assert.equal((await f.pool.query("SELECT count(*)::int n FROM pages WHERE managed_site_id=$1", [f.scope.managedSiteId])).rows[0].n, 0);
    });
    await t.test("another customer's real canonical revision cannot supply this proposal", async () => {
      const row = (await f.pool.query("SELECT id,web_presence_id,payload FROM business_knowledge WHERE web_presence_id<>$1 LIMIT 1", [f.scope.webPresenceId])).rows[0]; assert.ok(row);
      const foreign = (await inspectCanonical(f.pool, "knowledge", row.web_presence_id, row.id))!;
      const input = structuredClone(f.page); input.sections[1].text = { kind: "canonical", source: { domain: "knowledge", recordId: row.id, revision: foreign.row.version, fingerprint: foreign.fingerprint, field: foreign.row.payload.entries[0].key } };
      await assert.rejects(reopen().prepare(f.operator, randomUUID(), f.scope, randomUUID(), input), /owned canonical/);
    });
    await t.test("event failure atomically rolls back first identity and revision without changing prior approvals", async () => {
      const before = await stored(), failedId = randomUUID();
      await f.pool.query("CREATE FUNCTION synthetic_proposal_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Forced proposal event failure'; END $$");
      try {
        await f.pool.query("CREATE TRIGGER synthetic_proposal_failure BEFORE INSERT ON site_change_events FOR EACH ROW EXECUTE FUNCTION synthetic_proposal_failure()");
        await assert.rejects(reopen().prepare(f.operator, failedId, f.scope, randomUUID(), f.page), /Forced proposal event failure/);
        assert.equal(await stored(), before);
      } finally { await f.pool.query("DROP TRIGGER IF EXISTS synthetic_proposal_failure ON site_change_events"); await f.pool.query("DROP FUNCTION synthetic_proposal_failure()"); }
    });
    // Reopen using a new connection pool, not merely a cached in-memory store.
    const freshPool = new Pool({ connectionString: url, options: `-c search_path=${f.schema}` });
    try { const state = await new SiteProposalService(freshPool, f.authority, new PostgresProposalPersistence(freshPool)).inspect(f.operator, id, f.scope); assert.equal(state.state, "APPROVED"); assert.equal(state.approvalValid, true); }
    finally { await freshPool.end(); }
    const proof = JSON.parse(await readFile("runtime-content/site-proposal-durable-proof/inspection.json", "utf8")); assert.equal(proof.state.id, id);
    await f.verify();
  } finally { await f.stop(); Object.assign(process.env, old); }
});
