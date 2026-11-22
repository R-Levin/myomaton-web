/**
 * Dry run of the rebuilt site-creation path (rebuild 2026-11-22), with no AI spending.
 *
 * Real: workflow engine and store (disposable PostgreSQL), provider request building
 * (rebuilt instructions, schemas, citation binding), output validation, site design,
 * placeholders, candidate projection and the PHP WordPress renderer.
 * Simulated: only the AI's answers, built from the exact schema each request carries,
 * and the fetched research page. This checks that the pieces connect; it says nothing
 * about the quality a real model will produce.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fingerprint } from "../../lib/platform/canonical/model";
import { createC0Onboarding } from "../../scripts/intake/c0-onboarding";
import { PresenceWorkflow, type WorkflowContext } from "../../lib/platform/intake/presence-workflow";
import { workPresenceCase } from "../../lib/platform/intake/protected-presence-workflow";
import { createResponsesPresenceWorkflow } from "../../lib/platform/intake/presence-workflow-provider";
import { initializeResponsesUsageLedger } from "../../lib/platform/intake/intelligent-responses";
import { workflowNativeReviewCandidate } from "../../lib/platform/intake/presence-workflow-delivery";
import { pendingContent, type NativeNode } from "../../lib/platform/intake/presence-native-component";
import type { MarketingAuthority } from "../../lib/platform/intake/presence-marketing-authority";
import { IntakeService } from "../../lib/platform/intake/service";

type Schema = { properties?: Record<string, Schema>; items?: Schema; enum?: unknown[] };
const enumAt = (schema: Schema, ...path: string[]) => {
  let node: Schema | undefined = schema;
  for (const key of path) node = key === "[]" ? node?.items : node?.properties?.[key];
  return (node?.items?.enum ?? node?.enum ?? []) as string[];
};
const layout: NativeNode["layout"] = { arrangement: "flow", columns: [], gap: "medium", inset: "none", surface: "none", align: "start",
  measure: "full", typeScale: "body", span: 1, mobileOrder: 0, border: false, rounded: false };
const node = (kind: NativeNode["kind"], changes: Partial<NativeNode> = {}): NativeNode =>
  ({ kind, text: null, level: null, items: [], ordered: false, reference: null, layout, children: [], ...changes });

/** Stand-in for the model: a plausible answer in exactly the requested format. */
function simulatedAnswer(name: string, schema: Schema, instructions: string) {
  const stage = name.replace("presence_workflow_", "");
  if (stage === "report") {
    const ids = enumAt(schema, "findings", "[]", "sourceIds");
    return { title: "Business understanding (simulated)", summary: "Simulated summary.", findings: [
      { id: "offer", heading: "One managed service", body: "Simulated finding about the offer.", status: "proposed", sourceIds: ids.slice(0, 1) },
      { id: "audience", heading: "Who it serves", body: "Simulated finding about the audience.", status: "proposed", sourceIds: ids.slice(0, 1) }] };
  }
  if (stage === "direction") {
    assert.ok(schema.properties?.design, "Rebuilt Direction requests carry the site design schema");
    assert.match(instructions, /fill the design object/);
    const ids = enumAt(schema, "sourceIds");
    const pair = (background: string, text: string) => ({ background, text });
    return { positioning: "Simulated positioning.", approach: "Simulated approach.", visitorDecisions: ["Understand the service", "Choose how to start"],
      sourceIds: ids.slice(0, 1), design: {
        palette: { light: pair("#fbf7f0", "#1d1a16"), strong: pair("#e8dccb", "#1d1a16"), tonal: pair("#f1ebe2", "#c9c2b8"),
          brand: pair("#9fd3bf", "#ffffff"), supporting: pair("#dbe8e1", "#123528"), contrast: pair("#14201b", "#f5efe4"), border: "#d8cdbd", muted: "#5a5247" },
        typography: { headingFamily: "fraunces", bodyFamily: "work-sans", baseSize: 17, headingScale: 3, lineHeight: 1.6, headingWeight: 600 },
        shape: "soft", density: "airy", imagery: { style: "illustration", direction: "Simulated art direction." },
        rationale: "Simulated rationale.", sourceIds: ids.filter(id => id.startsWith("research:")).slice(0, 1) } };
  }
  if (stage === "blueprint") {
    const brief = (path: string) => ({ decision: "Simulated page decision for " + path,
      findingIds: enumAt(schema, "pages", "[]", "decisionBrief", "findingIds").slice(0, 1),
      directionSteps: enumAt(schema, "pages", "[]", "decisionBrief", "directionSteps").slice(0, 1),
      claimIds: enumAt(schema, "pages", "[]", "decisionBrief", "claimIds").slice(0, 1),
      influences: path === "/" ? [{ sourceIds: enumAt(schema, "pages", "[]", "decisionBrief", "influences", "[]", "sourceIds")
        .filter(id => id.startsWith("research:")).slice(0, 1), use: "composition", implication: "Simulated research influence." }] : [],
      avoid: [] });
    const ids = enumAt(schema, "pages", "[]", "sourceIds").slice(0, 1);
    return { pages: [["/", "Home"], ["/service", "Service"], ["/start", "Start"]].map(([path, label]) =>
      ({ path, label, purpose: "Simulated purpose.", sourceIds: ids, decisionBrief: brief(path) })), navigation: ["/", "/service", "/start"], articles: [] };
  }
  if (stage === "page") {
    const path = enumAt(schema, "path")[0];
    assert.match(instructions, /place a placeholder node exactly where it belongs/);
    assert.ok(!/Never turn internal proof-policy/.test(instructions), "Old warning blocks are gone");
    const hero = { version: 2, name: "simulated-opening", purpose: "Simulated hero", mode: "section", root: node("group", {
      layout: { ...layout, arrangement: "columns", columns: [3, 2], gap: "large" }, children: [
        node("group", { children: [node("heading", { level: 1, text: "Simulated heading for " + path }), node("paragraph", { text: "Simulated opening." }),
          node("action", { reference: "action-0", text: "See how it works" })] }),
        node("image", { reference: "section-0" })] }) };
    const proof = { version: 2, name: "simulated-proof", purpose: "Simulated proof", mode: "section", root: node("group", {
      layout: { ...layout, surface: "supporting", inset: "medium", rounded: true }, children: [
        node("heading", { level: 2, text: "What clients say" }),
        node("placeholder", { reference: "need-testimonial", text: "A recent client describing how onboarding went." })] }) };
    const visual = (status: string) => ({ purpose: "Simulated", brief: "Simulated brief.", altIntent: "Simulated alt", status });
    return { path, heading: "Simulated heading for " + path, searchTitle: "Simulated", searchDescription: "Simulated description.",
      composition: "managed-v1", internalLinks: [path === "/" ? "/service" : "/"],
      actions: [{ label: "See how it works", kind: "navigate", destination: path === "/" ? "/service" : "/", sectionIndex: 0 },
        { label: "Talk to us", kind: "request-contact", destination: null, sectionIndex: null }], sections: [
        { heading: "Simulated heading for " + path, body: "Simulated opening.", sourceIds: [], role: "hero", visual: visual("asset-needed"), block: hero },
        { heading: "What clients say", body: "Simulated proof section.", sourceIds: [], role: "intro", visual: visual("text-only"), block: proof }] };
  }
  if (stage === "editorial") return { summary: "Simulated critique.", concerns: [] };
  throw Error("Unexpected simulated stage " + name);
}

test("rebuilt site creation runs end to end: design chosen, placeholders and FPO placed, rendered by WordPress", async () => {
  const setup = await createC0Onboarding(process.env.PG_BIN_DIR ?? "C:/Program Files/PostgreSQL/18/bin", true, undefined, true);
  const root = await mkdtemp(join(tmpdir(), "miopages-dry-run-"));
  try {
    const intake = new IntakeService(setup.pool, setup.selection);
    await intake.create("dd".repeat(32), "DIRECT_START");
    const base = await intake.workflowContext("dd".repeat(32));
    const brief = readFileSync("docs/miopages-c0-business-brief.md", "utf8").replaceAll("\r\n", "\n");
    const launch = brief.match(/^\| Standard Launch \| (.+) \|$/m)![1];
    const service = "MioPages provides one managed Web Presence service.";
    const reference = { label: "Dry-run source", reference: "local dry run", date: "2026-11-22" };
    // A C0 evaluation case, as the real test will be (a fresh case from the same sources).
    const context: WorkflowContext = { ...base, evaluation: { scenario: "c0", basis: fingerprint("rebuilt dry run") }, evidence: [
      { ...reference, id: "service", kind: "owner-confirmed", content: service },
      { ...reference, id: "brief", kind: "service-direction", content: brief }] };
    const sources = context.evidence.map(fingerprint);
    const authority: MarketingAuthority = { projectionVersion: 2, contextDigest: fingerprint(context),
      sources: [{ digest: sources[0], use: "business-fact" }, { digest: sources[1], use: "staffed-offer" }],
      sourceSelections: [{ digest: sources[0], passages: [service] }, { digest: sources[1], passages: [launch] }],
      brandDigest: fingerprint("dry-run brand"), brandBrief: "Use the customer's brand assets.", qualityReviewerId: "reviewer",
      strategy: { version: 1, peerIds: [], discoveredPeers: true } };
    const rates = { model: "dry-run-model", verifiedOn: "2026-11-22", inputPerMillion: 750_000, cachedPerMillion: 75_000,
      outputPerMillion: 4_500_000, cacheWritePerMillion: 0, countMicros: 0 };
    await initializeResponsesUsageLedger(root, rates);
    const grant = { contextDigest: fingerprint(context), approvedSources: sources, approvedCorrections: [], marketingAuthority: authority,
      nativeComponents: 2 as const, siteComposition: "managed-v1" as const, reviewSequence: "site-first" as const, maxRetries: 1, maxEditorialRevisions: 1,
      researchSources: [{ id: "research:peer", url: "https://peer.example/", label: "Simulated peer" }],
      researchResponseBytes: 100_000, expiresAt: Date.now() + 600_000, maxOutputTokens: 20_000,
      ledger: { id: fingerprint("dry-run"), startingLedger: createHash("sha256").update(await readFile(join(root, "onboarding-usage.json"))).digest("hex"),
      baselineAttempts: 0, requests: 200, generations: 100, inputTokens: 1_000_000, inputBytes: 5_000_000, capMicros: 50_000_000 } };
    const requests: { name: string; instructions: string }[] = [];
    // The real run researches with web search and page capture; here one simulated page stands in.
    const provider = createResponsesPresenceWorkflow({ grant, readGrant: async () => grant, readContext: async () => context,
      rates, ledgerDirectory: root,
      fetchPage: (async (url: string) => ({ ok: true, url, headers: new Headers({ "content-type": "text/html" }),
        body: new Response("<html><body><main><h1>Simulated peer</h1><p>A simulated public page about managed websites.</p></main></body></html>").body,
      })) as unknown as typeof fetch,
      transport: { async send(path, body) {
        if (path.endsWith("/input_tokens")) return { body: { input_tokens: 2000 } };
        const request = body as { instructions: string; text: { format: { name: string; schema: Schema } } };
        requests.push({ name: request.text.format.name, instructions: request.instructions });
        const output = simulatedAnswer(request.text.format.name, request.text.format.schema, request.instructions);
        const response = { id: "resp_dry_run_" + requests.length, model: rates.model, status: "completed", service_tier: "default",
          usage: { input_tokens: 2000, output_tokens: 400, total_tokens: 2400, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } },
          output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(output) }] }] };
        return { body: response, rawBody: Buffer.from(JSON.stringify(response)) };
      } } });
    const operations = { ...provider, requiresResearch: true };
    const workflow = new PresenceWorkflow(setup.pool, operations);
    const actor = { id: "dry-run", authority: "test-only", role: "operator", simulated: false } as const;
    await workflow.start(context);
    let view = (await workPresenceCase(workflow, context))!;
    for (let step = 0; step < 6 && view.next !== "complete" && !view.pages.length; step++) {
      if (view.report && !view.confirmation) view = (await workflow.confirmReport(context, view.version, actor, true))!;
      view = (await workPresenceCase(workflow, context))!;
    }
    assert.equal(view.failure, null, JSON.stringify({ failure: view.failure, issue: (view as { artifactIssue?: unknown }).artifactIssue, next: view.next, requests: requests.map(r => r.name), report: Boolean(view.report), direction: Boolean(view.direction), blueprint: Boolean(view.blueprint) }));
    assert.deepEqual(view.pages.map(page => page.path), ["/", "/service", "/start"]);
    const design = view.direction?.design;
    assert.ok(design, "The Direction carries Core's chosen design");
    assert.equal(design.typography.headingFamily, "fraunces");
    assert.ok(design.adjustments.length >= 2, "Unreadable simulated colours were repaired and recorded");
    const placeholders = view.pages.flatMap(page => page.sections.flatMap(section =>
      section.block && section.block.version === 2 ? pendingContent(section.block) : []));
    assert.equal(placeholders.length, 3);
    const review = workflowNativeReviewCandidate(context, view);
    assert.equal(review.design?.version, 4);
    const php = spawnSync(process.platform === "win32" ? "C:/php/php.exe" : "php", ["wordpress/miopages-delivery/tests/native-component.php"],
      { input: JSON.stringify({ candidate: review.candidate, postIds: { "/": 1, "/service": 2, "/start": 3 } }), encoding: "utf8" });
    assert.equal(php.status, 0, php.stderr);
    assert.match(php.stdout, /miopages-fpo/);
    assert.match(php.stdout, /Customer testimonial needed/);
    assert.ok(requests.some(row => row.name === "presence_workflow_direction"));
    if (process.env.MIOPAGES_DRY_RUN_EXPORT) await writeFile(process.env.MIOPAGES_DRY_RUN_EXPORT,
      JSON.stringify({ review, home: php.stdout, requests: requests.map(row => row.name) }, null, 2));
  } finally {
    await rm(root, { recursive: true, force: true });
    await setup.stop();
  }
});
