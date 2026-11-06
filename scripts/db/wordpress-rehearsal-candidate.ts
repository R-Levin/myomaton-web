import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { fingerprint } from "../../lib/platform/canonical/model";
import { readProposalState } from "../../lib/platform/content-editing/proposal-postgres";
import { siteBase, resolvePage } from "../../lib/platform/content-editing/proposal-context";
import { proposalPreview } from "../../lib/platform/content-editing/proposal-preview";
import { rehearsalSite } from "./wordpress-rehearsal-principals";

export const exactRehearsal = {
  proposalId: "b6beda24-564c-4e19-9de0-09861ec32f24", revision: 1,
  digest: "fce4a96bd33a4d6ff2e7e50b380e735fe4d1e636a7dd98b2a57f2c40c335662c",
  baseFingerprint: "8ffe7283ada7fa2da60ac9848dea557a9189a069183bd44ae72f175e27005bc1",
  previewDigest: "10692cea76d3afb3eb825d7eaabfa53fbf73c8b4f7e9abdf07dda86c38548bd3",
  previewEvent: "e2d0f346e4060bef9f0c83e3e10268cc3d91ac452c71bc735da8a9c6cb7a3190",
  htmlSha256: "816c135718cb1c06c62ec72ad61cf9301729ae8f133ced929853b750f0017bb1",
  projectionDigest: "f71a65739ec0b18d75516b27584d4042446e9c4df8721f0d49b346cef5f1327e",
};
export const rehearsalOperators = ["72bb2f38-28d7-4d3c-bea6-72540bf3d603", "c606cd74-b587-4248-8cba-3df6718fefec"];

export async function verifyExactRehearsalCandidate(db: PoolClient, approved = false) {
  const scope = { webPresenceId: rehearsalSite.webPresenceId, managedSiteId: rehearsalSite.managedSiteId };
  const row = (await db.query("SELECT * FROM site_change_proposals WHERE id=$1", [exactRehearsal.proposalId])).rows[0];
  assert.equal(row?.organization_id, rehearsalSite.organizationId);
  const state = await readProposalState(db, exactRehearsal.proposalId, scope, row.created_at);
  assert.equal(state.state, approved ? "APPROVED" : "PROPOSED");
  assert.equal(state.revisions.length, 1);
  assert.deepEqual(state.events.map(e => e.action), approved ? ["revise", "preview", "approve"] : ["revise", "preview"]);
  const r = state.revisions[0], base = await siteBase(db, scope);
  assert.deepEqual(r.binding, { proposalId: exactRehearsal.proposalId, revision: 1, scope,
    digest: exactRehearsal.digest, baseFingerprint: exactRehearsal.baseFingerprint });
  assert.equal(fingerprint(base), exactRehearsal.baseFingerprint);
  const resolved = await resolvePage(db, scope, r.page, base);
  assert.deepEqual(resolved.candidate, r.candidate); assert.deepEqual(resolved.resolved, r.resolved);
  const html = proposalPreview(r);
  assert.equal(fingerprint(html), exactRehearsal.previewDigest);
  assert.equal(createHash("sha256").update(html).digest("hex"), exactRehearsal.htmlSha256);
  assert.equal(state.events[1].preview?.digest, exactRehearsal.previewDigest);
  assert.equal(state.events[1].hash, exactRehearsal.previewEvent);
  if (approved) {
    assert.equal(state.events[2].actor.operatorId, rehearsalOperators[0]);
    assert.equal(state.events[2].actor.authorityReference, "da70a65e-a89e-4b38-938f-87290bf1447e");
    assert.equal(state.approval?.previewDigest, exactRehearsal.previewDigest);
    assert.deepEqual(state.approval?.binding, r.binding);
    assert.equal((await db.query(`SELECT 1 FROM wordpress_proposal_approvals
      WHERE proposal_id=$1 AND approval_digest=$2 AND grant_id=$3`,
    [exactRehearsal.proposalId, state.events[2].hash, "da70a65e-a89e-4b38-938f-87290bf1447e"])).rowCount, 1);
  } else assert.equal(state.approval, null);
  return state;
}
