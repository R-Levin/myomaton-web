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
import { loadC0Review } from "../scripts/operator-overview/c0-review";
import { loadOnboardingEvidence, onboardingEvidencePath } from "../scripts/operator-overview/onboarding-evidence";
import { fingerprint } from "../lib/platform/canonical/model";

test("the account projection refuses unrelated ownership and keeps quiet accounts out of attention", () => {
  const graph = structuredClone(reviewed.after);
  graph.pages.push({ ...graph.pages[0], id: "12345678-1234-1234-1234-123456789abc", managed_site_id: "foreign-site" });
  const account = snapshotAccount(graph, reviewed.target);
  assert.equal(account.pages.length, 4);
  assert.equal(account.preview("12345678-1234-1234-1234-123456789abc"), null);
  assert.equal(account.nextReview?.pageName, "Experience");
  assert.equal(account.knowledge[0].version, 1);
  assert.equal(account.offerings[0].components.length, 3);
  assert.throws(() => snapshotAccount(graph, { ...reviewed.target, organizationId: "foreign-org" }), /ownership/);
  const doc = new JSDOM(overview([{ ...account, nextReview: undefined }])).window.document;
  assert.equal(doc.querySelector(".op-alert"), null);
  assert.match(doc.querySelector(".op-directory")!.textContent!, /No review flagged/);
});

test("the loopback overview leads to scoped account evidence and the existing v3 previews", async () => {
  await assert.rejects(() => loadOnboardingEvidence("../attempt-11"), /numbered local/);
  const server = await createOperatorOverview([{
    id: "c0-ongoing", label: "MioPages C0 · Ongoing reply", question: "Which Launch scope is included?",
    answer: "An existing client may ask for one change.", relevance: "off-topic", topic: "Ongoing work",
    excerpt: "one change", unresolved: "Launch scope remains open.", clarification: "How many pages are included?",
    recommendation: null, status: "Still open",
  }]);
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
      return new JSDOM(await reply.text(), { url: base + path, runScripts: "outside-only" }).window.document;
    };
    const start = await document("/");
    assert.ok(start.querySelector(`a[href="${onboardingEvidencePath}"]`));
    const onboarding = await document(onboardingEvidencePath);
    assert.match(onboarding.body.textContent!, /synthetic[\s\S]*Ongoing work[\s\S]*Still open[\s\S]*How many pages/);
    assert.equal(onboarding.querySelectorAll("form, iframe").length, 0);
    assert.equal((await fetch(base + onboardingEvidencePath, { method: "POST" })).status, 405);
    const presencePath = accountPath(reviewed.target.webPresenceId);
    assert.equal(start.querySelector(".op-alert a")?.getAttribute("href"), presencePath);
    const checkRoleHeader = (document: Document) => {
      assert.match(document.querySelector(".op-identity")!.textContent!, /MioPages owner.*Simulated.*Active role/);
      assert.match(document.querySelector("#role-boundary")!.textContent!, /Read-only demo · no permissions granted/);
      const control = document.querySelector<HTMLSelectElement>("#operator-role")!;
      assert.deepEqual([...control.options].map(option => option.text), ["Content Reviewer", "Technical Operator"]);
      return control;
    };
    const control = checkRoleHeader(start);
    const roleScript = await fetch(base + "/operator-role.js");
    assert.match(roleScript.headers.get("content-type")!, /^text\/javascript/);
    const script = await roleScript.text();
    const browser = start.defaultView!;
    browser.localStorage.setItem("miopages-operator-demo-role", "invalid-role");
    browser.eval(script);
    assert.equal(control.value, "content-reviewer");
    assert.equal(control.disabled, false);
    const roleExample = start.querySelector<HTMLElement>("[data-role-example]")!;
    assert.equal(roleExample.hidden, true);
    control.value = "technical-operator";
    control.dispatchEvent(new browser.Event("change"));
    assert.equal(browser.localStorage.getItem("miopages-operator-demo-role"), "technical-operator");
    assert.equal(roleExample.hidden, false);
    assert.match(roleExample.textContent!, /Simulated role example.*Open website previews/);
    assert.equal(start.querySelectorAll(".op-alert").length, 1);
    const account = await document(presencePath);
    const accountRole = checkRoleHeader(account);
    account.defaultView!.localStorage.setItem("miopages-operator-demo-role", browser.localStorage.getItem("miopages-operator-demo-role")!);
    account.defaultView!.eval(script);
    assert.equal(accountRole.value, "technical-operator");
    assert.equal(account.querySelector<HTMLElement>('[data-role-example="content-reviewer"]')!.hidden, true);
    assert.match(account.querySelector('[data-role-example="technical-operator"]:not([hidden])')!.textContent!, /Check reviewed website pages/);
    assert.deepEqual([...account.querySelectorAll('.op-steps a')].map(link => link.getAttribute('href')), ["#interview", "#knowledge", "#website", "#review", "#next-action"]);
    assert.match(account.body.textContent!, /original interview transcript and verbatim answers were unavailable/);
    assert.match(account.body.textContent!, /An exact C0 page proposal and approval trail is unavailable/);
    assert.match(account.body.textContent!, /Business Knowledge revision 1/);
    assert.match(account.body.textContent!, /no publication authorization/);
    const next = account.querySelector(".op-alert a")!.getAttribute("href")!;
    assert.match((await document(next)).querySelector("title")!.textContent!, /Experience preview/);
    const evidence = await loadProposalEvidence();
    assert.ok(evidence);
    const samplePath = evidencePath(evidence);
    assert.equal(account.querySelector(`a[href="${samplePath}"]`), null);
    assert.equal(account.querySelector('a[href="/development-evidence"]'), null);
    const developmentPath = start.querySelector('a[href="/development-evidence"]')!.getAttribute("href")!;
    const proposal = await document(developmentPath);
    assert.match(proposal.querySelector("h1")!.textContent!, /Proposal evidence/);
    assert.match(proposal.body.textContent!, /Synthetic example/);
    checkRoleHeader(proposal);
    assert.equal(proposal.querySelectorAll(".op-revisions > li").length, evidence.revisions.length);
    for (const { revision, preview } of evidence.revisions) {
      const path = exactPreviewPath(evidence, revision.binding.revision);
      const response = await fetch(base + path);
      if (preview) {
        assert.equal(response.status, 200);
        assert.doesNotMatch(response.headers.get("content-security-policy")!, /script-src/);
        assert.equal(fingerprint(await response.text()), preview.digest);
      } else assert.equal(response.status, 404);
      assert.equal((await fetch(base + path.replace(samplePath, presencePath))).status, 404);
    }
    assert.equal((await fetch(base + samplePath, { method: "POST" })).status, 405);
    for (const page of reviewed.after.pages) {
      const preview = await document(previewPath(reviewed.target.webPresenceId, page.id));
      const focus = preview.querySelector('[data-grammar="service-led"][data-grammar-version="3"]');
      assert.ok(focus);
      assert.equal(focus.querySelectorAll("main > section").length, reviewed.after.sections.filter(section => section.page_id === page.id).length);
      checkRoleHeader(preview);
      assert.deepEqual([...preview.querySelectorAll("script")].map(element => element.getAttribute("src")), ["/operator-role.js"]);
      assert.equal(preview.querySelectorAll("form,iframe").length, 0);
      assert.equal(preview.querySelector('.op-preview a')?.getAttribute('href'), `${presencePath}#website`);
      assert.equal(preview.querySelectorAll('a[target="_blank"]').length, 0);
    }
    assert.equal((await fetch(base + presencePath, { method: "POST" })).status, 405);
    for (const path of ["/accounts/foreign", `${presencePath}/pages/foreign`, "/.env.local", "/?site=foreign"]) {
      assert.equal((await fetch(base + path)).status, 404);
    }
    const foreignHost = await new Promise<number | undefined>((resolve, reject) => {
      get(base, { headers: { Host: "foreign.test" } }, response => { response.resume(); resolve(response.statusCode); }).on("error", reject);
    });
    assert.equal(foreignHost, 403);
    assert.equal((await fetch(base + presencePath, { headers: { "Sec-Fetch-Site": "cross-site", "Sec-Fetch-Mode": "cors" } })).status, 403);
    assert.equal(await loadC0Review({ webPresenceId: "foreign", managedSiteId: reviewed.target.managedSiteId }), null);
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
