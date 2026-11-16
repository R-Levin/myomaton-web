import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fingerprint } from "../lib/platform/canonical/model";
import { initializeResponsesUsageLedger, type ResponsesRates } from "../lib/platform/intake/intelligent-responses";
import { createResponsesPresenceWorkflow, type PresenceWorkflowGrant } from "../lib/platform/intake/presence-workflow-provider";
import type { WorkflowContext, WorkflowInput, WorkflowOperation, WorkflowRun } from "../lib/platform/intake/presence-workflow";
import { readBlueprint, readPage, readReport } from "../lib/platform/intake/presence-workflow-artifacts";
import { validateResearchSources } from "../lib/platform/intake/presence-workflow-research";

test("Core retrieves only pinned public sources and sends source-bound stages through the existing usage and recovery rules", async () => {
  const directory = await mkdtemp(join(tmpdir(), "miopages-workflow-provider-"));
  const ledgerPath = join(directory, "onboarding-usage.json");
  try {
    const rates: ResponsesRates = { model: "test-model", verifiedOn: "2026-11-15", inputPerMillion: 750_000,
      cachedPerMillion: 75_000, cacheWritePerMillion: 0, outputPerMillion: 4_500_000, countMicros: 0 };
    await initializeResponsesUsageLedger(directory, rates);
    const context: WorkflowContext = {
      scope: { webPresenceId: "test-presence", managedSiteId: "test-site" }, intakeId: "test-intake", entry: "FREE_REVIEW",
      evidence: [{ id: "owner", kind: "owner-confirmed", label: "Offer", reference: "private-owner-pointer",
        date: "2026-11-01", content: "The business offers managed Launch and Ongoing." }], limitations: [], conflicts: [],
    };
    const grant: PresenceWorkflowGrant = {
      contextDigest: fingerprint(context), approvedSources: context.evidence.map(source => fingerprint(source)), approvedCorrections: [],
      researchSources: [{ id: "research:market", label: "Market example", url: "https://example.org/" }],
      researchResponseBytes: 12_000, expiresAt: Date.now() + 60_000, maxOutputTokens: 2000,
      ledger: { id: fingerprint("workflow-grant"), baselineAttempts: 0,
        startingLedger: createHash("sha256").update(await readFile(ledgerPath)).digest("hex"),
        inputTokens: 7000, inputBytes: 26_000, requests: 2, generations: 1, capMicros: 20_000 },
    };
    const requested: string[] = [];
    const web: string[] = [];
    let activeGrant = grant;
    const report = { title: "Report", summary: "Test only.", findings: [
      { id: "business", heading: "Offer", body: "Launch with ongoing care", status: "established", sourceIds: ["owner"] },
      { id: "market", heading: "Opportunity", body: "Consider a market position", status: "established", sourceIds: ["owner", "research:market"] },
    ] };
    const responseBody = { id: "resp_offline_workflow", model: rates.model, status: "completed", service_tier: "default",
      usage: { input_tokens: 5000, input_tokens_details: { cached_tokens: 0 }, output_tokens: 60,
        output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 5060 },
      output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(report) }] }] };
    const provider = createResponsesPresenceWorkflow({
      grant, readGrant: async () => activeGrant, readContext: async () => context, rates, ledgerDirectory: directory,
      fetchPage: async (source, init) => {
        web.push(String(source));
        assert.equal(init?.redirect, "error");
        const response = new Response("<main>Public evidence<script>private-script</script></main>", { headers: { "content-type": "text/html" } });
        Object.defineProperty(response, "url", { value: source });
        return response;
      },
      transport: { async send(path, body) {
        requested.push(path);
        const encoded = JSON.stringify(body);
        assert.match(encoded, /Public evidence/);
        assert.doesNotMatch(encoded, /private-script|private-owner-pointer|test-presence|test-intake/);
        if (path.endsWith("/input_tokens")) return { body: { input_tokens: 5000 } };
        assert.equal((body as { store: boolean }).store, false);
        return { body: responseBody, rawBody: Buffer.from(JSON.stringify(responseBody)) };
      } },
    });

    let kept: Buffer | undefined;
    const retain = async (bytes: Buffer) => { kept = bytes; };
    const makeRun = (operation: WorkflowOperation, input: WorkflowInput): WorkflowRun => ({
      context, input, work: { operation, attempt: "fixture", until: Date.now() + 60_000, inputDigest: fingerprint(input) },
    });
    const base: WorkflowInput = { entry: context.entry, evidence: context.evidence, limitations: [], conflicts: [], research: null,
      report: null, corrections: [], direction: null, blueprint: null, pages: [] };
    assert.throws(() => validateResearchSources([{ id: "research:private", url: "https://127.0.0.1/", label: "refused" }]), /refused/i);
    const research = await provider.run(makeRun("research", base), retain) as WorkflowInput["research"];
    assert.deepEqual(web, ["https://example.org/"]);
    assert.equal(research?.[0].content, "Public evidence");
    assert.match(research?.[0].rawDigest ?? "", /^[a-f0-9]{64}$/u);
    const work = makeRun("report", { ...base, research });
    const changed = makeRun("report", { ...base, evidence: [{ ...context.evidence[0], content: "Unapproved" }], research });
    await assert.rejects(provider.run(changed, retain), /authorization/i);
    const newCorrection = makeRun("report", { ...base, research, corrections: [{
      finding: { id: "business", heading: "Offer", body: "Proposed service scope", status: "proposed", sourceIds: ["owner"] },
      text: "New private correction outside the existing transmission authorization.",
      actor: { id: "owner-test", role: "operator", simulated: false }, reportDigest: fingerprint(report), at: new Date().toISOString(),
    }] });
    await assert.rejects(provider.run(newCorrection, retain), /authorization/i);
    assert.deepEqual(requested, []);
    assert.deepEqual(await provider.run(work, retain), report);
    assert.deepEqual(requested, ["/v1/responses/input_tokens", "/v1/responses"]);
    const retained = await provider.recover(work, kept!);
    assert.deepEqual(retained, report);
    assert.deepEqual(kept, Buffer.from(JSON.stringify(responseBody)));
    const sources = [...context.evidence, ...research!];
    assert.throws(() => readReport(retained, sources), /lacks confirmed evidence/);
    assert.deepEqual(readReport(retained, sources, true).findings,
      [report.findings[0], { ...report.findings[1], status: "proposed" }]);
    assert.throws(() => readReport({ ...report, findings: [{ ...report.findings[1], sourceIds: ["unknown"] }] }, sources, true),
      /Unknown artifact reference/);
    await assert.rejects(provider.run(makeRun("direction", { ...base, research, report: report as WorkflowInput["report"] }), retain), { code: "usage_gate" });
    activeGrant = { ...grant, revoked: true };
    await assert.rejects(provider.run(work, retain), /authorization/i);
    assert.equal(requested.length, 2);
  } finally {
    await rm(ledgerPath, { force: true });
    await rmdir(directory);
  }
});

test("provider blueprint recovery preserves Page identity and resolves only exact unambiguous labels", () => {
  const plan = {
    pages: [
      { path: "/", label: "Home", purpose: "Start here", sourceIds: ["owner", "owner"] },
      { path: "/service", label: "Service", purpose: "Explain the offer", sourceIds: ["owner"] },
    ],
    navigation: ["Home", "Service"],
    articles: [{ title: "Guide", question: "Where to start?", target: "/service", sourceIds: ["owner", "owner"] }],
  };
  assert.throws(() => readBlueprint(plan, ["owner"]), /Repeated artifact identity/);
  const normalized = readBlueprint(plan, ["owner"], true);
  assert.deepEqual(normalized.navigation, ["/", "/service"]);
  assert.deepEqual(normalized.pages[0], { ...plan.pages[0], sourceIds: ["owner"] });
  assert.deepEqual(normalized.articles[0], { ...plan.articles[0], sourceIds: ["owner"] });
  assert.throws(() => readBlueprint({ ...plan, navigation: ["Home", "/"] }, ["owner"], true), /Repeated artifact identity/);
  assert.throws(() => readBlueprint({ ...plan, navigation: ["Home", "Missing"] }, ["owner"], true), /Unknown artifact reference/);
  assert.throws(() => readBlueprint({
    ...plan, pages: [plan.pages[0], { ...plan.pages[1], label: "Home" }],
  }, ["owner"], true), /Unknown artifact reference/);
  assert.throws(() => readBlueprint({
    ...plan, pages: [plan.pages[0], { ...plan.pages[1], sourceIds: ["missing"] }],
  }, ["owner"], true), /Unknown artifact reference/);
});

test("provider Page recovery quarantines unverified actions and preserves unresolved suggestions without wiring them", () => {
  const page = {
    path: "/", heading: "Home", searchTitle: "Home", searchDescription: "See our offer.",
    sections: [{ heading: "Useful next step", body: "Read the service details.", sourceIds: ["owner", "owner"],
      visual: { purpose: "Show the offer", brief: "Concept image", altIntent: "Show the setting", status: "asset-needed" } }],
    actions: [{ label: "Account", kind: "existing-account", destination: "https://example.test/account" },
      { label: "Our service", kind: "navigate", destination: "/service" }],
    internalLinks: ["/service", "/unverified"],
  };
  const normalized = readPage(page, "/", ["/", "/service"], ["owner"], {}, true);
  assert.deepEqual(normalized.actions, [{ ...page.actions[0], destination: null }, page.actions[1]]);
  assert.deepEqual(normalized.internalLinks, ["/service"]);
  assert.deepEqual(normalized.unresolvedLinks, ["/unverified"]);
  assert.deepEqual(normalized.sections[0].sourceIds, ["owner"]);
  const selfNavigation = { ...page, sections: normalized.sections, actions: [{ label: "See this page", kind: "navigate", destination: "/" }] };
  assert.deepEqual(readPage(selfNavigation, "/", ["/", "/service"], ["owner"], {}, true).actions,
    [{ label: "See this page", kind: "navigate", destination: null, unresolvedDestination: "/" }]);
  assert.throws(() => readPage(selfNavigation, "/", ["/", "/service"], ["owner"], {}), /Unknown Action destination/);
  assert.throws(() => readPage({ ...page, actions: [{ ...page.actions[1], destination: "/unknown" }] }, "/", ["/", "/service"], ["owner"], {}, true),
    /Unknown Action destination/);
  assert.throws(() => readPage({ ...page, internalLinks: ["https://example.test/"] }, "/", ["/", "/service"], ["owner"], {}, true),
    /Invalid Page path/);
});
