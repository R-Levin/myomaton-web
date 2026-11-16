import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { JSDOM } from "jsdom";
import { build } from "esbuild";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PresenceWorkflowView } from "../lib/platform/intake/presence-workflow";

test("the owner sees an operational status before the report and decisions with labeled citations after it", async () => {
  const { outputFiles } = await build({
    entryPoints: ["scripts/intake/presence-workflow-panel.tsx"], bundle: true, write: false,
    platform: "node", format: "cjs", jsx: "automatic", packages: "external", loader: { ".module.css": "empty" },
  });
  const bundle: { exports: { PresenceWorkflowPanel?: ComponentType<{
    hosted: boolean; workflow: PresenceWorkflowView; busy: boolean; run: () => Promise<void>;
  }> } } = { exports: {} };
  new Function("module", "exports", "require", outputFiles[0].text)(bundle, bundle.exports, createRequire(import.meta.url));
  const Panel = bundle.exports.PresenceWorkflowPanel!;
  const pending: PresenceWorkflowView = {
    version: 1, mode: "provider", contextDigest: "fixture", research: null, report: null, confirmation: null,
    corrections: [], direction: null, blueprint: null, pages: [], editorial: null, operatorReview: null,
    failure: null, next: "research", pendingOperation: null, recoverable: false, limitations: [], conflicts: [],
    entry: "DIRECT_START",
    sources: [
      { id: "owner", label: "Owner’s current offer", kind: "owner-confirmed", reference: "Owner record", date: null, content: "Private source body marker" },
      { id: "historical", label: "Earlier interview", kind: "historical-discovery", reference: "Earlier record", date: null, content: "Historical source body marker" },
    ],
  };
  const render = (workflow: PresenceWorkflowView) =>
    renderToStaticMarkup(createElement(Panel, { hosted: true, workflow, busy: false, run: async () => {} }));
  const waiting = render(pending);
  assert.match(waiting, /Your assessment is queued/);
  assert.doesNotMatch(waiting, /Source history|source body marker|Continue to development site planning/);

  const reviewed = render({
    ...pending, version: 6, next: "customer-review",
    report: { title: "Working assessment", summary: "Check the service and its audience.", findings: [
      { id: "audience", heading: "Who it serves", body: "Startups can be a fit.", status: "established", sourceIds: ["owner"] },
      { id: "meaning", heading: "One possible position", body: "Explore this angle.", status: "proposed", sourceIds: ["owner", "historical"] },
      { id: "gap", heading: "Missing evidence", body: "Confirm the open decision.", status: "unresolved", sourceIds: ["historical"] },
    ] },
  });
  for (const text of ["Working assessment", "AI-generated assessment", "Findings grounded in confirmed evidence",
    "Interpretations to review", "Open decisions", "Owner-confirmed knowledge", "Historical discovery",
    "Flag a correction", "Continue to development site planning", "Source history and open conflicts"]) {
    assert.ok(reviewed.includes(text), text);
  }
  assert.doesNotMatch(reviewed, /source body marker|<details[^>]*\bopen[=>\s]/u);
  const site = new JSDOM(render({
    ...pending, version: 11, next: "operator-review",
    editorial: { summary: "Review the offer.", concerns: [] },
    pages: [{
      path: "/", heading: "Home", searchTitle: "Home", searchDescription: "Home", sections: [], internalLinks: [],
      unresolvedLinks: ["/undeclared"],
      actions: [{ label: "Existing account", kind: "existing-account", destination: null },
        { label: "Read Home", kind: "navigate", destination: null, unresolvedDestination: "/" }],
    }],
  })).window.document.querySelector('[aria-label="Unresolved destinations"]');
  assert.match(site?.textContent ?? "", /Suggested path \/undeclared.*Existing account needs a verified destination.*Read Home points back to this page/u);
  assert.equal(site?.querySelector("a, button"), null);
});

test("the signed-in browser follows a saved development continuation to the website proposal without another click", async () => {
  const { outputFiles } = await build({
    stdin: { contents: `
      import { createElement } from "react";
      import { createRoot } from "react-dom/client";
      import { Journey } from "./scripts/intake/c0-site-journey-client";
      createRoot(document.querySelector("#root")).render(createElement(Journey, { hosted: true }));`,
      resolveDir: process.cwd(), loader: "tsx" },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' }, loader: { ".module.css": "empty" },
  });
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true, runScripts: "outside-only",
    url: "https://core.example.test/core" });
  let revision = 6;
  let complete = false;
  let requests = 0;
  let continuation = 0;
  const nativeTimer = dom.window.setTimeout.bind(dom.window);
  dom.window.setTimeout = (fn, ms, ...args) => nativeTimer(fn, ms === 5_000 ? 30 : ms, ...args);
  dom.window.fetch = async (endpoint, options) => {
    assert.equal(endpoint, "/api/protected-core");
    assert.equal(new Headers(options?.headers).get("X-Intake-Request"), "1");
    if (options?.method === "POST") {
      assert.deepEqual(JSON.parse(String(options.body)), { operation: "workflow-continue", version: 6 });
      revision = 7;
      continuation++;
    } else {
      assert.equal(options?.method, "GET");
      requests++;
    }
    const queued = revision === 7;
    const draft = complete && queued;
    const workflow = {
      version: draft ? 10 : revision, mode: "provider", contextDigest: "fixture",
      report: { title: "Saved assessment", summary: "Existing evidence", findings: [] },
      corrections: [], sources: [], limitations: [], conflicts: [], research: null, failure: null,
      next: draft ? "operator-review" : queued ? "direction" : "customer-review",
      confirmation: queued ? { decision: "development-continuation" } : null,
      direction: draft ? { positioning: "One managed offer", approach: "Launch and continuing care", visitorDecisions: [] } : null,
      blueprint: draft ? { pages: [{ path: "/", label: "Home" }], navigation: ["/"], articles: [] } : null,
      pages: draft ? [{ path: "/", heading: "Proposed Home", sections: [], actions: [], internalLinks: [] }] : [],
      editorial: draft ? { summary: "Ready to review", concerns: [] } : null,
    };
    return Response.json({ state: "draft", version: 28, prepared: { scenario: "c0" }, answers: {}, workflowAvailable: true, workflow,
      portal: { role: "operator", identity: "Authorized Operator", account: "MioPages", site: "C0 development site",
        environment: "protected-development" } });
  };
  const text = () => dom.window.document.body.textContent ?? "";
  async function observe(value: string) {
    for (let tries = 0; tries < 100; tries++) {
      if (text().includes(value)) return;
      await delay(20);
    }
    assert.fail("Browser did not render " + value + ": " + text());
  }
  try {
    dom.window.eval(outputFiles[0].text);
    await observe("Continue to development site planning");
    assert.match(text(), /Operator workspace/);
    assert.match(text(), /Authorized Operator/);
    assert.match(text(), /C0 development site/);
    const button = [...dom.window.document.querySelectorAll("button")].find(item =>
      item.textContent === "Continue to development site planning");
    assert.ok(button);
    button.click();
    await observe("Website planning queued");
    assert.equal(revision, 7);
    assert.equal(continuation, 1);
    complete = true;
    await observe("Website proposal ready for review");
    assert.match(text(), /One managed offer/);
    assert.match(text(), /Proposed Home/);
    const readsAtReview = requests;
    await delay(100);
    assert.equal(requests, readsAtReview);
    assert.equal(continuation, 1);
  } finally {
    dom.window.close();
  }
});
