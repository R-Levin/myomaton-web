import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { get } from "node:http";
import test from "node:test";
import { JSDOM } from "jsdom";
import { createOperatorOverview } from "../scripts/operator-overview";
import reviewed from "../scripts/customer-updates/miopages-focus-reviewed.json";
import { accountPath, previewPath, snapshotAccount } from "../scripts/operator-overview/model";
import { evidencePath, exactPreviewPath, loadProposalEvidence, verifyProposalEvidence } from "../scripts/operator-overview/proposal-evidence";
import { overview } from "../scripts/operator-overview/views";
import { fingerprint } from "../lib/platform/canonical/model";

test("the account projection refuses unrelated ownership and keeps quiet accounts out of attention", () => {
  const graph = structuredClone(reviewed.after);
  graph.pages.push({ ...graph.pages[0], id: "12345678-1234-1234-1234-123456789abc", managed_site_id: "foreign-site" });
  const account = snapshotAccount(graph, reviewed.target);
  assert.equal(account.pages.length, 4);
  assert.equal(account.preview("12345678-1234-1234-1234-123456789abc"), null);
  assert.equal(account.nextReview?.pageName, "Experience");
  assert.throws(() => snapshotAccount(graph, { ...reviewed.target, organizationId: "foreign-org" }), /ownership/);
  const doc = new JSDOM(overview([{ ...account, nextReview: undefined }])).window.document;
  assert.equal(doc.querySelector(".op-alert"), null);
  assert.match(doc.querySelector(".op-directory")!.textContent!, /No review flagged/);
});

test("the loopback overview leads to scoped account evidence and the existing v3 previews", async () => {
  const server = await createOperatorOverview();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    const document = async (path: string) => {
      const reply = await fetch(base + path);
      assert.equal(reply.status, 200);
      assert.equal(reply.headers.get("cache-control"), "no-store");
      assert.match(reply.headers.get("content-security-policy")!, /frame-ancestors 'none'/);
      return new JSDOM(await reply.text()).window.document;
    };
    const start = await document("/");
    const presencePath = accountPath(reviewed.target.webPresenceId);
    assert.equal(start.querySelector(".op-alert a")?.getAttribute("href"), presencePath);
    assert.match(start.querySelector(".op-identity summary")!.textContent!, /Simulated.*MioPages owner.*Active role: Content Reviewer/);
    assert.match(start.querySelector(".op-identity")!.textContent!, /Sign-in and permissions are unavailable/);
    assert.equal(start.querySelectorAll(".op-alert").length, 1);
    const account = await document(presencePath);
    assert.match(account.body.textContent!, /Pending approval status is unknown/);
    assert.match(account.body.textContent!, /no publication authorization/);
    const next = account.querySelector(".op-alert a")!.getAttribute("href")!;
    assert.match((await document(next)).querySelector("title")!.textContent!, /Experience preview/);
    const evidence = await loadProposalEvidence();
    assert.ok(evidence);
    const samplePath = account.querySelector('a[href^="/accounts/"][href$="' + evidence.latest.scope.webPresenceId + '"]')?.getAttribute("href");
    assert.equal(samplePath, evidencePath(evidence));
    const proposal = await document(samplePath!);
    assert.match(proposal.querySelector("h1")!.textContent!, /Proposal evidence/);
    assert.match(proposal.body.textContent!, /Synthetic example/);
    assert.equal(proposal.querySelectorAll(".op-revisions > li").length, evidence.revisions.length);
    for (const { revision, preview } of evidence.revisions) {
      const path = exactPreviewPath(evidence, revision.binding.revision);
      const response = await fetch(base + path);
      if (preview) {
        assert.equal(response.status, 200);
        assert.equal(fingerprint(await response.text()), preview.digest);
      } else assert.equal(response.status, 404);
      assert.equal((await fetch(base + path.replace(samplePath!, presencePath))).status, 404);
    }
    assert.equal((await fetch(base + samplePath, { method: "POST" })).status, 405);
    for (const page of reviewed.after.pages) {
      const preview = await document(previewPath(reviewed.target.webPresenceId, page.id));
      const focus = preview.querySelector('[data-grammar="service-led"][data-grammar-version="3"]');
      assert.ok(focus);
      assert.equal(focus.querySelectorAll("main > section").length, reviewed.after.sections.filter(section => section.page_id === page.id).length);
      assert.equal(preview.querySelectorAll("script,form,iframe").length, 0);
    }
    assert.equal((await fetch(base + presencePath, { method: "POST" })).status, 405);
    for (const path of ["/accounts/foreign", `${presencePath}/pages/foreign`, "/.env.local", "/?site=foreign"]) {
      assert.equal((await fetch(base + path)).status, 404);
    }
    const foreignHost = await new Promise<number | undefined>((resolve, reject) => {
      get(base, { headers: { Host: "foreign.test" } }, response => { response.resume(); resolve(response.statusCode); }).on("error", reject);
    });
    assert.equal(foreignHost, 403);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("only the exact retained synthetic revision and preview are eligible for the loopback example", async () => {
  const fixture = new URL("./fixtures/approved-site-proposal/", import.meta.url);
  const inspection = JSON.parse(await readFile(new URL("inspection.json", fixture), "utf8"));
  const html = await readFile(new URL("candidate.html", fixture), "utf8");
  const verified = verifyProposalEvidence("retained", inspection, html);
  assert.equal(verified.revisions[0].preview?.html, html);
  assert.throws(() => verifyProposalEvidence("retained", inspection, html + " "), /preview mismatch/);
  inspection.revision.binding.scope.webPresenceId = reviewed.target.webPresenceId;
  assert.throws(() => verifyProposalEvidence("retained", inspection, html), /Unrecognized synthetic/);
});
