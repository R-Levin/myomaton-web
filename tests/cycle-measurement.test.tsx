import assert from "node:assert/strict";
import { test } from "node:test";
import { cycleSnapshot, type CycleObservation } from "../lib/platform/wordpress-delivery/cycle-measurement";

const draft = { installationId: "installation", siteProposalId: "site-proposal", appliedDigest: "a", revision: 3,
  posts: [{ id: 14, path: "/service", contentSha256: "baseline" }] };
const event: CycleObservation = { id: "example", installationId: draft.installationId, siteProposalId: draft.siteProposalId,
  draftDigest: draft.appliedDigest, pageId: 14, at: "2026-11-12T20:00:00Z",
  source: "synthetic-development", kind: "inquiry-sample", topic: "existing-website-handoff" };

test("draft measurements deduplicate exact retries and preserve outcome uncertainty", () => {
  const snapshot = cycleSnapshot(draft, [event, event]);
  assert.equal(snapshot.syntheticInquirySamples, 1);
  assert.deepEqual(snapshot.recommendation?.evidence, ["example"]);
  assert.equal(snapshot.acceptedInquiries, "not exercised");
  assert.equal(snapshot.customerOutcomes, "unknown");
  assert.equal(cycleSnapshot(draft, []).recommendation, null);
});

test("draft measurements refuse foreign site, foreign Page, stale revision and conflicting retry", () => {
  for (const change of [{ installationId: "other" }, { siteProposalId: "other" }, { pageId: 16 }, { draftDigest: "other" }]) {
    assert.throws(() => cycleSnapshot(draft, [{ ...event, ...change }]), /does not match/);
  }
  assert.throws(() => cycleSnapshot(draft, [event, { ...event, at: "2026-11-12T20:01:00Z" }]), /Conflicting/);
});
