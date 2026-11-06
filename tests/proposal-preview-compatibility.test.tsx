import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fingerprint } from "../lib/platform/canonical/model";
import { proposalPreview } from "../lib/platform/content-editing/proposal-preview";
import type { Revision } from "../lib/platform/content-editing/proposal";

test("retained approved synthetic candidate keeps exact HTML and approval digest", async () => {
  const directory = new URL("./fixtures/approved-site-proposal/", import.meta.url);
  const saved = JSON.parse(await readFile(new URL("inspection.json", directory), "utf8"));
  const expected = await readFile(new URL("candidate.html", directory), "utf8");
  const actual = proposalPreview(saved.revision as Revision);
  assert.equal(actual, expected, "Existing approved HTML must remain byte-identical");
  assert.equal(fingerprint(actual), saved.previewDigest);
  assert.equal(fingerprint(actual), saved.approvalEvent.approval.previewDigest);
  assert.deepEqual(saved.revision.binding, saved.approvalEvent.approval.binding);
  const { hash, ...event } = saved.approvalEvent;
  assert.equal(fingerprint(event), hash, "Retained approval event has not changed");
  assert.notEqual(fingerprint(actual + " "), saved.previewDigest, "Changed rendering cannot reuse approval");
});
