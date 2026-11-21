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
    hosted: boolean; workflow: PresenceWorkflowView; busy: boolean; run: () => Promise<void>; canTriage?: boolean;
  }> } } = { exports: {} };
  new Function("module", "exports", "require", outputFiles[0].text)(bundle, bundle.exports, createRequire(import.meta.url));
  const Panel = bundle.exports.PresenceWorkflowPanel!;
  const pending: PresenceWorkflowView = {
    version: 1, mode: "provider", contextDigest: "fixture", research: null, report: null, confirmation: null,
    corrections: [], direction: null, blueprint: null, pages: [], editorial: null, operatorReview: null,
    failure: null, next: "research", pendingOperation: null, recoverable: false, limitations: [], conflicts: [], canQueueEditorialRevision: false,
    entry: "DIRECT_START",
    sources: [
      { id: "owner", label: "Owner’s current offer", kind: "owner-confirmed", reference: "Owner record", date: null, content: "Private source body marker" },
      { id: "historical", label: "Earlier interview", kind: "historical-discovery", reference: "Earlier record", date: null, content: "Historical source body marker" },
    ],
  };
  const render = (workflow: PresenceWorkflowView, canTriage = false) =>
    renderToStaticMarkup(createElement(Panel, { hosted: true, workflow, busy: false, run: async () => {}, canTriage }));
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
  const editorialReview: PresenceWorkflowView = {
    ...pending, version: 11, next: "editorial-review",
    editorial: { summary: "Review the offer.", concerns: [], unassigned: [
      { suggestedTarget: "Across the site", concern: "Verify how contact requests are handled." },
    ] },
    pages: [{
      path: "/", heading: "Home", searchTitle: "Home", searchDescription: "Home", sections: [], internalLinks: [],
      unresolvedLinks: ["/undeclared"],
      actions: [{ label: "Existing account", kind: "existing-account", destination: null },
        { label: "Read Home", kind: "navigate", destination: null, unresolvedDestination: "/" }],
    }],
    editorialFindings: [{ id: "finding", reviewRevision: 10, suggestedTarget: "Across the site",
      concern: "Verify how contact requests are handled.", history: [] }],
  };
  const result = new JSDOM(render(editorialReview)).window.document;
  const operator = new JSDOM(render(editorialReview, true)).window.document;
  assert.equal(operator.querySelector('fieldset input[value="/"]')?.getAttribute("checked"), null);
  assert.match(operator.querySelector("form")?.textContent ?? "", /Keep open as a whole-site requirement.*Resolve with evidence/u);
  assert.equal(result.querySelector("form"), null);
  const site = result.querySelector('[aria-label="Unresolved destinations"]');
  assert.match(site?.textContent ?? "", /Suggested path \/undeclared.*Existing account needs a verified destination.*Read Home points back to this page/u);
  assert.equal(site?.querySelector("a, button"), null);
  const unassigned = result.querySelector('[aria-label="Editorial findings awaiting a page assignment"]');
  assert.match(unassigned?.textContent ?? "", /Across the site.*Verify how contact requests are handled/u);
  assert.equal(unassigned?.querySelector("a, button"), null);
  assert.doesNotMatch(result.body.textContent ?? "", /Queue the flagged pages|Record Operator site review/);
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
    define: { "process.env.NODE_ENV": '"production"', "process.env.__NEXT_IMAGE_OPTS": "undefined", "process.env": "{}" }, loader: { ".module.css": "empty" },
  });
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true, runScripts: "outside-only",
    url: "https://core.example.test/core" });
  let revision = 6;
  let complete = false;
  let requests = 0;
  let continuation = 0;
  let decisionSaved = false;
  const nativeTimer = dom.window.setTimeout.bind(dom.window);
  dom.window.setTimeout = (fn, ms, ...args) => nativeTimer(fn, ms === 5_000 ? 30 : ms, ...args);
  dom.window.fetch = async (endpoint, options) => {
    assert.equal(endpoint, "/api/protected-core");
    assert.equal(new Headers(options?.headers).get("X-Intake-Request"), "1");
    if (options?.method === "POST") {
      const operation = JSON.parse(String(options.body));
      if (operation.operation === "workflow-editorial-decision") {
        assert.deepEqual(operation, { operation: "workflow-editorial-decision", version: 10,
          editorial: { findingId: "finding-1", status: "assigned", rationale: "Home explains visitor contact.", paths: ["/"] } });
        decisionSaved = true;
      } else {
        assert.deepEqual(operation, { operation: "workflow-continue", version: 6 });
        revision = 7;
        continuation++;
      }
    } else {
      assert.equal(options?.method, "GET");
      requests++;
    }
    const queued = revision === 7;
    const draft = complete && queued;
    const workflow = {
      version: draft ? decisionSaved ? 11 : 10 : revision, mode: "provider", contextDigest: "fixture",
      report: { title: "Saved assessment", summary: "Existing evidence", findings: [] },
      corrections: [], sources: [], limitations: [], conflicts: [], research: null, failure: null,
      next: draft ? "editorial-review" : queued ? "direction" : "customer-review",
      canQueueEditorialRevision: decisionSaved,
      confirmation: queued ? { decision: "development-continuation" } : null,
      direction: draft ? { positioning: "One managed offer", approach: "Launch and continuing care", visitorDecisions: [] } : null,
      blueprint: draft ? { pages: [{ path: "/", label: "Home" }], navigation: ["/"], articles: [] } : null,
      pages: draft ? [{ path: "/", heading: "Proposed Home", sections: [], actions: [], internalLinks: [] }] : [],
      editorial: draft ? { summary: "Ready to review", concerns: [] } : null,
      editorialFindings: draft ? [{ id: "finding-1", reviewRevision: 10, suggestedTarget: "Visitor steps", concern: "Clarify how to get in touch.",
        history: decisionSaved ? [{ status: "assigned", pages: [{ path: "/", baseline: "fixture" }], rationale: "Home explains visitor contact.",
          basedOnVersion: 10, at: "2026-11-16T15:00:00Z", actor: { id: "operator-1" } }] : [] }] : [],
    };
    return Response.json({ state: "draft", version: 28, prepared: { scenario: "c0" }, answers: {}, workflowAvailable: true, workflow,
      portal: { role: "operator", identity: "Authorized Operator", account: "MioPages", site: "C0 development site",
        environment: "protected-development", editorialDecisionsAvailable: true } });
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
    await observe("Website draft needs editorial review");
    assert.match(text(), /One managed offer/);
    assert.match(text(), /Proposed Home/);
    const form = dom.window.document.querySelector("#editorial-review form");
    assert.ok(form);
    form.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    const reason = form.querySelector("textarea")!;
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value")?.set?.call(reason, "Home explains visitor contact.");
    reason.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    await delay(20);
    const save = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    assert.ok(save && !save.disabled);
    save.click();
    await observe("Assigned for revision");
    assert.equal(decisionSaved, true);
    assert.match(text(), /Decision history/);
    assert.doesNotMatch(text(), /Record Operator site review/);
    const readsAtReview = requests;
    await delay(100);
    assert.equal(requests, readsAtReview);
    assert.equal(continuation, 1);
  } finally {
    dom.window.close();
  }
});
