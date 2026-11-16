import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
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
});
