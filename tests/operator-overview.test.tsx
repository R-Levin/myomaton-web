import assert from "node:assert/strict";
import { once } from "node:events";
import { get } from "node:http";
import test from "node:test";
import { JSDOM } from "jsdom";
import { createOperatorOverview } from "../scripts/operator-overview";
import reviewed from "../scripts/customer-updates/miopages-focus-reviewed.json";
import { accountPath, previewPath, snapshotAccount } from "../scripts/operator-overview/model";
import { overview } from "../scripts/operator-overview/views";

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
    const account = await document(presencePath);
    assert.match(account.body.textContent!, /Pending approval status is unknown/);
    assert.match(account.body.textContent!, /no publication authorization/);
    const next = account.querySelector(".op-alert a")!.getAttribute("href")!;
    assert.match((await document(next)).querySelector("title")!.textContent!, /Experience preview/);
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
