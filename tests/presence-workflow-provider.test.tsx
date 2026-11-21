import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fingerprint } from "../lib/platform/canonical/model";
import { initializeResponsesUsageLedger, meteredPresenceWorkflow, meteredPresenceWorkflowImage, type ResponsesRates } from "../lib/platform/intake/intelligent-responses";
import { createResponsesPresenceWorkflow, type PresenceWorkflowGrant } from "../lib/platform/intake/presence-workflow-provider";
import type { WorkflowContext, WorkflowInput, WorkflowOperation, WorkflowRun } from "../lib/platform/intake/presence-workflow";
import { ArtifactValidationError, readBlueprint, readDirection, readEditorial, readPage, readReport } from "../lib/platform/intake/presence-workflow-artifacts";
import { validateResearchSources } from "../lib/platform/intake/presence-workflow-research";
import { applyEditorialPatch } from "../lib/platform/intake/presence-editorial-patch";

test("Core retrieves only pinned public sources and sends source-bound stages through the existing usage and recovery rules", async () => {
  const directory = await mkdtemp(join(tmpdir(), "miopages-workflow-provider-"));
  const ledgerPath = join(directory, "onboarding-usage.json");
  try {
    const rates: ResponsesRates = { model: "test-model", verifiedOn: "2026-11-15", inputPerMillion: 750_000,
      cachedPerMillion: 75_000, cacheWritePerMillion: 0, outputPerMillion: 4_500_000, countMicros: 0 };
    await initializeResponsesUsageLedger(directory, rates);
    const context: WorkflowContext = {
      scope: { webPresenceId: "test-presence", managedSiteId: "test-site" }, intakeId: "test-intake", entry: "FREE_REVIEW",
      evaluation: { scenario: "c0", basis: fingerprint("evaluation fixture") },
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
        assert.match(encoded, /"sourceIds":\{"type":"array","items":\{"type":"string","enum":\["owner","research:market"\]\}\}/u);
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
    const unapprovedHome = makeRun("page", { ...base, research, revisionRequest: {
      source: "home-concept", paths: ["/"], audit: { summary: "Unapproved operator text", concerns: [{ path: "/", concern: "Unapproved operator text" }] },
      priorPages: [], actor: { id: "test", role: "operator", simulated: false }, at: new Date().toISOString(), ordinal: 1,
    } });
    await assert.rejects(provider.run(unapprovedHome, retain), /authorization/i);
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

test("evaluation budgets distinguish image and text operations before dispatch", async () => {
  const directory = await mkdtemp(join(tmpdir(), "miopages-evaluation-budget-"));
  const ledger = join(directory, "onboarding-usage.json");
  try {
    const rates: ResponsesRates = { model: "test-model", verifiedOn: "2026-11-16", inputPerMillion: 750_000,
      cachedPerMillion: 75_000, cacheWritePerMillion: 0, outputPerMillion: 4_500_000, countMicros: 0 };
    await initializeResponsesUsageLedger(directory, rates);
    const scope = { id: fingerprint("case"), startingLedger: createHash("sha256").update(await readFile(ledger)).digest("hex"),
      baselineAttempts: 0, requests: 3, generations: 2, capMicros: 600_000, inputTokens: 10, inputBytes: 1000,
      breakdown: { text: 1, images: 1, searchCalls: 0 } };
    const counts = { image: 0, text: 0 };
    const model = "gpt-image-2.5-sunburst-2026-09-08";
    const ownerDigest = fingerprint("owner");
    const recheck = async () => {};
    const image = (id: string) => meteredPresenceWorkflowImage(directory, rates, scope, { ownerDigest, workDigest: fingerprint(id) },
      model, async () => { counts.image++; return { model, requestId: null }; }, recheck);
    const text = meteredPresenceWorkflow(directory, rates, { async send(path) {
      counts.text++;
      if (path.endsWith("/input_tokens")) return { body: { input_tokens: 2 } };
      return { body: { model: rates.model, service_tier: "default", status: "completed",
        usage: { input_tokens: 2, input_tokens_details: { cached_tokens: 0 }, output_tokens: 2,
          output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 4 },
        output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "{}" }] }] } };
    } }, scope, 20);
    await image("first image");
    await assert.rejects(image("second image"), /image budget/);
    const request = { model: rates.model, instructions: "fixture", input: "fixture", text: { format: {} } };
    await text({ ownerDigest, workDigest: fingerprint("first text") }, request);
    await assert.rejects(text({ ownerDigest, workDigest: fingerprint("second text") }, request), /budget/);
    assert.deepEqual(counts, { image: 1, text: 2 });
  } finally {
    await rm(ledger, { force: true });
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
  assert.deepEqual(readBlueprint({ ...plan, navigation: ["Home", "/", "/service", "/service"] }, ["owner"], true).navigation,
    ["/", "/service"]);
  assert.throws(() => readBlueprint({ ...normalized, navigation: ["/", "/"] }, ["owner"]), /Repeated artifact identity/);
  assert.throws(() => readBlueprint({ ...plan, pages: [plan.pages[0], plan.pages[0]] }, ["owner"], true), /Repeated artifact identity/);
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

test("evaluation recovery keeps valid Intro links contextual without changing copy, targets or existing validation", () => {
  const visual = { purpose: "Fixture", brief: "Fixture", altIntent: "Fixture", status: "text-only" };
  const sections = [{ heading: "Account access", body: "Review instructions.", role: "hero", sourceIds: ["owner"], visual },
    { heading: "Other routes", body: "Choose the relevant destination.", role: "intro", sourceIds: ["owner"], visual }];
  const action = { label: "Request a Free Review", kind: "request-review", destination: "/free-review", sectionIndex: 1 };
  const page = { path: "/login", heading: "Client access", searchTitle: "Client access", searchDescription: "Find the right route.",
    sections, actions: [action], internalLinks: [], composition: "managed-v1" };
  const paths = ["/login", "/free-review"];
  assert.throws(() => readPage(page, "/login", paths, ["owner"], { "request-review": "/free-review" }, true), /Action placement/);
  const accepted = readPage(page, "/login", paths, ["owner"], { "request-review": "/free-review" }, true, true);
  assert.deepEqual(accepted.sections, sections);
  assert.deepEqual(accepted.actions, [{ label: action.label, kind: action.kind, destination: action.destination }]);
  const mismatch = readPage(page, "/login", paths, ["owner"], {}, true, true);
  assert.deepEqual(mismatch.actions, [{ label: action.label, kind: action.kind, destination: null }]);
  assert.throws(() => readPage({ ...page, actions: [{ ...action, sectionIndex: 8 }] }, "/login", paths,
    ["owner"], { "request-review": "/free-review" }, true, true), /Action placement/);
});

test("a scoped editorial patch improves actual copy and moves an existing preview Action without widening evidence or routes", () => {
  const paths = ["/", "/free-review"], allowed = ["owner", "quoted"];
  const visual = { status: "asset-needed", purpose: "Show one useful decision", brief: "Opening illustration", altIntent: "Example" };
  const raw = { path: "/", composition: "managed-v1", heading: "Old opening", searchTitle: "Home", searchDescription: "Useful starting point",
    sections: [{ role: "hero", heading: "Old heading", body: "Old text", sourceIds: ["owner"], visual },
      { role: "cta", heading: "Choices", body: "Three options", sourceIds: ["owner"], visual }],
    actions: [{ label: "Review", kind: "request-review", destination: "/free-review", sectionIndex: 1 }],
    internalLinks: ["/free-review", "/unknown"] };
  const destinations = { "request-review": "/free-review" };
  const before = readPage(raw, "/", paths, allowed, destinations, true, true);
  const section = { index: 0, heading: "Find what needs work", body: "Get a focused review.", sourceIds: ["quoted"], visual: null };
  const change = { path: "/", heading: null, sections: [section], removeInternalLinks: ["/free-review", "/"],
    actions: [{ index: 0, label: "Start the Free Review", sectionIndex: 0, remove: false }] };
  const [after] = applyEditorialPatch({ changes: [change] }, [before], ["/"], paths, allowed, destinations);
  assert.equal(after.sections[0].body, section.body);
  assert.deepEqual(after.sections[0].sourceIds, ["quoted"]);
  assert.deepEqual(after.sections[1], before.sections[1]);
  assert.deepEqual(after.actions, [{ label: "Start the Free Review", kind: "request-review", destination: "/free-review", sectionIndex: 0 }]);
  assert.deepEqual(after.unresolvedLinks, ["/unknown"]);
  assert.throws(() => applyEditorialPatch({ changes: [change] }, [before], ["/free-review"], paths, allowed, destinations), /outside/);
  const foreign = { ...change, sections: [{ ...section, sourceIds: ["foreign"] }] };
  assert.throws(() => applyEditorialPatch({ changes: [foreign] }, [before], ["/"], paths, allowed, destinations), /Unknown artifact reference/);
  assert.throws(() => applyEditorialPatch({ changes: [{ ...change, removeInternalLinks: ["/foreign"] }] },
    [before], ["/"], paths, allowed, destinations), /link change refused/);
});

test("provider artifact settlement retains editorial suggestions as advice and refuses foreign citations", () => {
  const draft = {
    summary: "Check the full candidate.",
    concerns: [
      { path: "/service", concern: "Verify the service terms." },
      { path: "/service", concern: "Verify the service terms." },
      { path: "Across the Home and Service pages", concern: "Confirm the proposed destinations." },
      { path: "/unknown", concern: "Keep this proposed path inactive." },
    ],
  };
  const expected = {
    summary: draft.summary,
    concerns: [draft.concerns[0]],
    unassigned: draft.concerns.slice(2).map(({ path, concern }) => ({ suggestedTarget: path, concern })),
  };
  assert.deepEqual(readEditorial(draft, ["/", "/service"], true), expected);
  assert.throws(() => readEditorial(draft, ["/", "/service"]), /Unknown artifact reference/);
  assert.throws(() => readEditorial({ ...draft, concerns: [{ path: "/unknown", concern: "<script>" }] }, ["/"], true), /Invalid canonical text/);
  const direction = { positioning: "A clear service", approach: "Explain the offer", visitorDecisions: ["Ask for a review"], sourceIds: ["owner", "owner"] };
  assert.deepEqual(readDirection(direction, ["owner"], true).sourceIds, ["owner"]);
  assert.throws(() => readDirection({ ...direction, sourceIds: ["main", "foreign", "foreign"] }, ["main"], true),
    error => error instanceof ArtifactValidationError && error.issue === "citation");
});


test("independent request ceilings remain enforced when earlier work does not require two requests per generation", async () => {
 const directory=await mkdtemp(join(tmpdir(),"miopages-independent-caps-"));
 try{
  const rates:ResponsesRates={model:"test-model",verifiedOn:"2026-11-21",inputPerMillion:1000000,cachedPerMillion:0,cacheWritePerMillion:0,outputPerMillion:1000000,countMicros:0};
  await initializeResponsesUsageLedger(directory,rates);
  const scope={id:fingerprint("independent-caps"),baselineAttempts:0,startingLedger:createHash("sha256").update(await readFile(join(directory,"onboarding-usage.json"))).digest("hex"),
   requests:3,generations:2,capMicros:10000,inputTokens:1000,inputBytes:10000};
  let calls=0;
  const transport={async send(path:string){calls++;if(path.endsWith("/input_tokens"))return{body:{input_tokens:100}};
   const body={id:"resp_offline_independent",model:rates.model,status:"completed",service_tier:"default",usage:{input_tokens:100,output_tokens:20,total_tokens:120,input_tokens_details:{cached_tokens:0},output_tokens_details:{reasoning_tokens:0}},output:[{type:"message",role:"assistant",content:[{type:"output_text",text:JSON.stringify({fixture:true})}]}]};return{body,rawBody:Buffer.from(JSON.stringify(body))};}};
  const run=meteredPresenceWorkflow(directory,rates,transport,scope,100);
  const request={model:rates.model,input:"Offline only",instructions:"Offline transport fixture; no provider access.",text:{format:{type:"json_object"}}};
  await run({ownerDigest:fingerprint("owner"),workDigest:fingerprint("first")},request,async()=>{},async()=>{});
  assert.equal(calls,2);
  await assert.rejects(run({ownerDigest:fingerprint("owner"),workDigest:fingerprint("second")},request,async()=>{},async()=>{}),/usage ledger or budget/);
  assert.equal(calls,2,"The stricter request ceiling refuses before another count or generation");
  const ledger=JSON.parse(await readFile(join(directory,"onboarding-usage.json"),"utf8"));assert.equal(ledger.attempts.length,1);
 }finally{await rm(directory,{recursive:true,force:true})}
});
