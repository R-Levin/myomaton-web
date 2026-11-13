import assert from "node:assert/strict";
import { lstat, readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { cycleSnapshot, type CycleObservation } from "../lib/platform/wordpress-delivery/cycle-measurement";
import { NativeDraftReceiptJournal, verifyNativeDraftReceipt } from "../lib/platform/wordpress-delivery/native-draft-receipt";

const installationId = "d84ebc69-46d5-4c64-adc6-ac7b87468f89";
const siteProposalId = "1e28f792-624d-4141-96db-45c4ba05e17d";
const baseline = "85786f251ed5b93e42d9ae2b8c7247d85d99280aa9b1bc5932a1321330a043db";
const improvement = "1a6343c049c0430e51ef7fa3780123c9475352af0328301d661a38a9b500eb2a";

async function wordpressReadback() {
  let body = "";
  for await (const chunk of process.stdin.setEncoding("utf8")) {
    body += chunk;
    assert(body.length < 4096);
  }
  const records = body.trim().split("\n").map(line => JSON.parse(line));
  assert.equal(records.length, 3);
  return records;
}

async function main() {
  const home = await realpath(process.env.HOME ?? "");
  assert.equal(home, "/home/virtual/vps-bef564/5/53b4381d42");
  const root = join(home, "miopages-native-draft-enrollment-LaSVWc");
  const file = join(root, "session.json");
  const stat = await lstat(file);
  assert(stat.isFile() && stat.uid === process.getuid?.() && (stat.mode & 0o777) === 0o600 && await realpath(file) === file);
  const session = JSON.parse(await readFile(file, "utf8"));
  assert.equal(session.installation.installationId, installationId);
  assert.match(session.secretHex, /^[a-f0-9]{64}$/u);
  const secret = Buffer.from(session.secretHex, "hex");
  const journal = new NativeDraftReceiptJournal(join(root, "receipts"));
  async function read(requestedDigest: string, appliedDigest: string, revision: number, operation: "apply" | "restore") {
    return verifyNativeDraftReceipt(await journal.read(installationId, requestedDigest, operation), secret, {
      installationId, siteProposalId, operation, requestedDigest, appliedDigest, revision, paths: ["/", "/service"],
    });
  }
  try {
    const before = await read(baseline, baseline, 3, "apply");
    const after = await read(improvement, improvement, 4, "apply");
    const restored = await read(improvement, baseline, 3, "restore");
    assert.deepEqual(before.posts, restored.posts);
    assert.deepEqual(before.posts.map(post => post.id), [13, 14]);
    assert.deepEqual(after.posts.map(post => post.id), [13, 14]);
    assert.equal(before.posts[0].contentSha256, after.posts[0].contentSha256);
    assert.notEqual(before.posts[1].contentSha256, after.posts[1].contentSha256);
    const [homePage, servicePage, changedService] = await wordpressReadback();
    for (const [row, post] of [[homePage, before.posts[0]], [servicePage, before.posts[1]]]) {
      assert.equal(row.id, post.id);
      assert.equal(row.status, "draft");
      assert.equal(row.type, "page");
      assert.equal(row.sha, post.contentSha256);
      assert(row.linksHome === true && row.linksService === true);
    }
    assert.equal(changedService.id, 20);
    assert.equal(changedService.parent, after.posts[1].id);
    assert.equal(changedService.type, "revision");
    assert.equal(changedService.sha, after.posts[1].contentSha256);
    assert(changedService.linksHome === true && changedService.linksService === true && changedService.handoff === true);
    assert.equal(servicePage.handoff, false);

    // The request is an explicit fixture, not a Contact submission or a visit.
    const sample: CycleObservation = { id: "existing-website-handoff-fixture", installationId, siteProposalId,
      draftDigest: baseline, pageId: 14, at: new Date().toISOString(), source: "synthetic-development",
      kind: "inquiry-sample", topic: "existing-website-handoff" };
    const baselineNavigation: CycleObservation = { id: "baseline-service-navigation", installationId, siteProposalId,
      draftDigest: baseline, pageId: 14, at: sample.at, source: "synthetic-development", kind: "navigation-target-verified" };
    const improvedNavigation: CycleObservation = { ...baselineNavigation, id: "improved-service-navigation", draftDigest: improvement };
    console.log(JSON.stringify({
      source: "Hosted WordPress readback verified against the authenticated Core receipt journal",
      before: cycleSnapshot(before, [sample, baselineNavigation]), after: cycleSnapshot(after, [improvedNavigation]),
      improvementCheck: { baselineExplainsWhatToBring: false, revisedExplainsWhatToBring: true, evidence: "retained WordPress revision 20" },
      restored, beforePosts: before.posts, afterPosts: after.posts,
    }));
  } finally {
    secret.fill(0);
  }
}

main().catch(() => {
  console.error("Hosted cycle readback refused. Verify scope, custody and retained receipts.");
  process.exitCode = 1;
});
