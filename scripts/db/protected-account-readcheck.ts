import assert from "node:assert/strict";
import { join } from "node:path";
import { fingerprint } from "../../lib/platform/canonical/model";
import { knowledgeTargets } from "../../lib/platform/canonical/confirmed-information";
import { accountWork } from "../../lib/platform/intake/account-work";
import { composePresenceCase, openProtectedPresenceWorkspace, privateWorkflowFile } from "../../lib/platform/intake/protected-presence-workflow";

// Actual protected Core composition, without provider transport, writes or an
// invented authenticated owner. Password sign-in remains a separate browser check.
async function main() {
  assert.equal(process.argv[2], "READ-ONLY-ACCOUNT");
  assert.equal(process.env.MIOPAGES_PROTECTED_ACCOUNT, "enabled");
  const root = "/home/virtual/vps-bef564/e/e494602172/miopages-private-acceptance";
  const config = await privateWorkflowFile<{ databaseUrl: string; ca: string }>(join(root, "core-config.json"), root);
  const { workspace, pool, intake, token } = await openProtectedPresenceWorkspace(true, { url: config.databaseUrl, ca: config.ca });
  try {
    const before = await pool.query("SELECT count(*)::int AS count,max(version)::int AS version FROM miopages_core_workflow.presence_workflow_events");
    const caseWork = composePresenceCase(pool, intake, token, workspace, { kind: "review" });
    const current = await caseWork.context();
    const workflow = await caseWork.open();
    const review = await workflow.review(current);
    assert.equal(review?.version, 41);
    assert.notEqual(review?.next, "evidence-changed");
    assert.ok(review?.report && review.direction && review.pages.length);
    const account = accountWork(current, review);
    const db = await pool.connect();
    let targets;
    try { targets = await knowledgeTargets(db, current.scope); }
    finally { db.release(); }
    assert.equal(targets.length, 1);
    const outcomes = await pool.query("SELECT count(*)::int AS count FROM miopages_core_account.contact_outcome_events");
    assert.equal(outcomes.rows[0].count, 0);
    assert.deepEqual((await pool.query("SELECT count(*)::int AS count,max(version)::int AS version FROM miopages_core_workflow.presence_workflow_events")).rows, before.rows);
    const grant = await privateWorkflowFile<{ revoked: boolean; contextDigest: string }>(workspace.grantFile, root);
    assert.equal(grant.revoked, true);
    assert.equal(grant.contextDigest, fingerprint(current));
    console.log(JSON.stringify({ status: "PASS", operation: "protected-account-case-readcheck", workflowVersion: review.version,
      next: review.next, reportAvailable: true, directionAvailable: true, draftedPages: review.pages.length,
      proposedPages: account.work.proposedPages, knowledgeTargets: targets.length, pendingCorrections: account.pendingCorrections,
      outcomes: 0, workflowUnchanged: true, providerDispatchRevoked: true, authenticatedOwnerTest: false }));
  } finally { await pool.end(); }
}
void main().catch((error: { code?: string }) => {
  console.error(JSON.stringify({ status: "BLOCKED", operation: "protected-account-case-readcheck", code: error.code ?? "VALIDATION" }));
  process.exitCode = 1;
});
