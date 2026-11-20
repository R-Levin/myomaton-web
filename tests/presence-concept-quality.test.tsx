import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import test from "node:test";
import { fingerprint } from "../lib/platform/canonical/model";
import { PresenceWorkflow, type WorkflowActor, type WorkflowContext, type WorkflowRun } from "../lib/platform/intake/presence-workflow";
import { composeHomeConcept } from "../lib/platform/intake/presence-home-concept";
import { qualityCriteria, type QualityReview, type MarketingAuthority } from "../lib/platform/intake/presence-marketing-authority";
import { readPage } from "../lib/platform/intake/presence-workflow-artifacts";

const author: WorkflowActor = { id: "generating-operator", role: "operator", simulated: false, authority: "offline preparation only" };
const reviewer: WorkflowActor = { id: "reviewing-operator", role: "operator", simulated: false, authority: "offline scoped review only" };

function setup(options: { enabled?: boolean; limit?: number; uncertain?: boolean; boundary?: "disposable" | "protected"; repair?: boolean; consumed?: number; siteFirst?: boolean } = {}) {
  const context: WorkflowContext = { scope: { webPresenceId: randomUUID(), managedSiteId: randomUUID() }, intakeId: randomUUID(),
    entry: "DIRECT_START", evidence: [{ id: "offer", kind: "owner-confirmed", label: "Fixture offer", reference: "Offline fixture", date: null,
      content: "The fixture business provides a managed service." }], limitations: [], conflicts: [],
    evaluation: { scenario: "c0", basis: fingerprint("offline concept review fixture") } };
  const authority: MarketingAuthority = { contextDigest: fingerprint(context), projectionVersion: 2,
    ...(options.enabled !== false && { earlyConceptReview: true }), sources: [{ digest: fingerprint(context.evidence[0]), use: "business-fact" }],
    sourceSelections: [{ digest: fingerprint(context.evidence[0]), passages: [context.evidence[0].content] }],
    brandDigest: fingerprint("fixture brand"), brandBrief: "Fixture brand", qualityReviewerId: reviewer.id };
  const paths = ["/", "/service", "/review", "/direct"];
  const page = readPage({ path: "/", heading: "Fixture managed service", searchTitle: "Fixture", searchDescription: "Fixture description.",
    composition: "managed-v1", sections: [{ heading: "Fixture managed service", body: "Fixture offer for offline testing.", sourceIds: ["offer"],
      role: "hero", block: null, visual: { purpose: "Text-only fixture", brief: "No asset", altIntent: "No asset", status: "text-only" } }],
    actions: [{ kind: "request-review", label: "Review", destination: "/review", sectionIndex: 0 },
      { kind: "start-onboarding", label: "Direct start", destination: "/direct", sectionIndex: 0 }], internalLinks: [] },
    "/", paths, ["offer"], { "request-review": "/review", "start-onboarding": "/direct" }, false, false, true);
  const report = { title: "Fixture understanding", summary: "Fixture only", findings: [{ id: "offering", heading: "Offer",
    body: "The fixture business provides a managed service.", status: "established" as const, sourceIds: ["offer"] }] };
  const initial = { version: 10, mode: "provider" as const, contextDigest: fingerprint(context), marketingAuthorityDigest: fingerprint(authority),
    evaluation: context.evaluation, sourceSnapshot: { evidence: context.evidence, entry: context.entry, limitations: [], conflicts: [] },
    research: [], report, confirmation: { actor: author, at: "2026-11-19T00:00:00Z", target: fingerprint(report), decision: "development-continuation" },
    direction: { positioning: "Initial fixture direction", approach: "Fixture approach", visitorDecisions: ["Understand the offer"], sourceIds: ["offer"] },
    blueprint: { pages: paths.map(path => ({ path, label: path === "/" ? "Home" : path.slice(1), purpose: "Fixture decision", sourceIds: ["offer"] })),
      navigation: paths, articles: [] },
    pages: [page], corrections: [], editorial: null, operatorReview: null, work: null as WorkflowRun["work"] | null,
    failure: null, homeReview: null,
    ...(options.consumed && {revisionRequest:{paths:["/"],audit:{summary:"Prior retained review",concerns:[{path:"/",concern:"Prior concern"}]},priorPages:[page],actor:author,at:"2026-11-19",ordinal:options.consumed},replan:{ordinal:2,concerns:["commercial-copy" as const]}}) };
  let saved = structuredClone(initial);
  const events = [structuredClone(initial)], outputs = new Map<string, Buffer>(), runs: WorkflowRun[] = [];
  let recoveries = 0;
  const critique = { summary: "Offline critic double: reconsider the proposition before whole-site expansion.",
    concerns: [{ path: "/", concern: "The concept lacks a distinctive grounded reason to choose the service." }] };
  const workflow = new PresenceWorkflow(null as unknown as Pool, { mode: "provider", marketingAuthority: authority, maxRetries: 0,
    ...(options.siteFirst && {reviewSequence:"site-first" as const}),
    maxCommercialReplans: options.limit ?? 1,
    ...(options.repair && {sourceRepair:{authorization:fingerprint("owner-authorized source repair"),baseVersion:initial.version,previousStateDigest:fingerprint(initial),materialsDigest:fingerprint("exact repaired materials")}}),
    async run(run, retain) {
      runs.push(structuredClone(run));
      if(options.siteFirst && run.work.operation === "page") {
        const output={...structuredClone(page),path:run.work.path!,actions:[{label:"Home",kind:"navigate",destination:"/",sectionIndex:0}],internalLinks:[]};
        await retain(Buffer.from(JSON.stringify(output)));return output;
      }
      if(options.siteFirst && run.work.operation === "editorial") {
        const output={summary:"Offline whole-site critic double, not product acceptance.",concerns:[]};
        await retain(Buffer.from(JSON.stringify(output)));return output;
      }
      await retain(Buffer.from(JSON.stringify(critique)));
      if (options.uncertain) throw Error("Offline simulated post-response interruption");
      return critique;
    },
    async recover(run, bytes) {
      recoveries++;
      assert.equal(run.work.reviewStage?.phase, "home-concept");
      return JSON.parse(bytes.toString());
    },
  }, { "request-review": "/review", "start-onboarding": "/direct" }, Date.now, options.boundary ?? "disposable");
  Reflect.set(workflow, "store", {
    read: async () => structuredClone(saved),
    append: async (_context: unknown, previous: number, next: typeof initial) => {
      assert.equal(previous, saved.version, "Optimistic state-version guard");
      saved = structuredClone({ ...next, version: previous + 1 });
      events.push(structuredClone(saved));
      return structuredClone(saved);
    },
    retain: async (_context: unknown, work: WorkflowRun["work"], bytes: Buffer) => {
      assert.ok(!outputs.has(work.attempt) || outputs.get(work.attempt)!.equals(bytes));
      outputs.set(work.attempt, bytes);
    },
    output: async (_context: unknown, work: WorkflowRun["work"]) => outputs.get(work.attempt) ?? null,
  });
  return { workflow, context, authority, initial, events, outputs, runs, recoveries: () => recoveries,
    snapshot: () => structuredClone(saved), mutate: (edit: (state: typeof initial) => void) => edit(saved) };
}

function judgment(target: string, revise = false): QualityReview {
  return { target, desktopEvidence: fingerprint("offline desktop image"), mobileEvidence: fingerprint("offline mobile image"),
    findings: qualityCriteria.map((criterion, index) => ({ criterion, status: revise && index === 0 ? "revise" : "pass",
      observation: "Offline scoped concept judgment; not customer or whole-site acceptance." })) };
}

test("an exact early critique can trigger strategic replan before any supporting Pages, retaining history and consumed allowance", async () => {
  const f = setup(), first = (await f.workflow.review(f.context))!;
  assert.equal(first.next, "home-concept");
  assert.equal(first.deliveryQuality?.target, null);
  assert.ok(first.conceptQuality && !first.conceptQuality.critique);
  const prepared = await f.workflow.conceptCritiqueInput(f.context, first.version, author);
  assert.equal(prepared.work.reviewStage!.phase, "home-concept");
  assert.deepEqual(prepared.input.reviewStage, prepared.work.reviewStage);
  assert.equal(f.events.length, 1); assert.equal(f.runs.length, 0);
  await assert.rejects(f.workflow.recordQualityReview(f.context, first.version, reviewer, judgment(first.conceptQuality.target)), { code: "workflow_not_ready" });
  const critiqued = (await f.workflow.critiqueHomeConcept(f.context, first.version, author))!;
  assert.equal(f.runs.length, 1);
  assert.equal(f.runs[0].work.inputDigest, prepared.work.inputDigest);
  assert.ok(critiqued.conceptQuality?.critique);
  assert.equal(critiqued.editorial, null, "A Home critique cannot satisfy whole-site editorial review");
  const beforeRetry = f.events.length;
  await f.workflow.critiqueHomeConcept(f.context, critiqued.version, author);
  assert.equal(f.runs.length, 1); assert.equal(f.events.length, beforeRetry, "Safe exact retry buys no duplicate critique");
  const negative = (await f.workflow.recordQualityReview(f.context, critiqued.version, reviewer, judgment(critiqued.conceptQuality!.target, true)))!;
  assert.equal(negative.conceptQuality?.passed, false);
  assert.equal(negative.deliveryQuality?.history.length, 0);
  await assert.rejects(f.workflow.reviewHomeConcept(f.context, negative.version, author,
    composeHomeConcept(f.context, negative).digest, "Offline continuation", true), { code: "workflow_not_ready" });
  const replanned = (await f.workflow.requestCommercialReplan(f.context, negative.version, author))!;
  assert.equal(replanned.next, "direction");
  assert.equal(replanned.direction, null); assert.equal(replanned.blueprint, null);
  assert.deepEqual(replanned.pages, []);
  assert.deepEqual(replanned.report, f.initial.report);
  assert.deepEqual(f.snapshot().confirmation, f.initial.confirmation);
  assert.deepEqual(f.events[0].pages, f.initial.pages, "Original Home survives in immutable event history");
  const retainedReplan = (f.snapshot() as unknown as { replan: { ordinal: number; conceptCritique: unknown; priorRejectedPages: unknown } }).replan;
  assert.equal(retainedReplan.ordinal, 1);
  assert.deepEqual(retainedReplan.conceptCritique, critiqued.conceptQuality!.critique, "Retain the specific generated reasoning, not just broad criterion codes");
  assert.deepEqual(retainedReplan.priorRejectedPages, f.initial.pages, "Keep the actual rejected concept with its critique, without mutating old history");
  assert.equal(f.runs.length, 1, "Replan records an exact queue change; it does not dispatch a model");
  await assert.rejects(f.workflow.requestCommercialReplan(f.context, replanned.version, author), { code: "workflow_not_ready" });
});

test("positive concept review permits expansion but cannot stand in for whole-site review, customer acceptance or publication", async () => {
  const f = setup();
  const critiqued = (await f.workflow.critiqueHomeConcept(f.context, 10, author))!;
  const passed = (await f.workflow.recordQualityReview(f.context, critiqued.version, reviewer, judgment(critiqued.conceptQuality!.target)))!;
  assert.ok(passed.conceptQuality?.passed);
  assert.equal(passed.deliveryQuality?.passed, false);
  assert.equal(passed.operatorReview, null);
  const continued = (await f.workflow.reviewHomeConcept(f.context, passed.version, author,
    composeHomeConcept(f.context, passed).digest, "Offline rendered concept review", true))!;
  assert.equal(continued.next, "page");
  assert.equal(continued.pages.length, 1);
  assert.equal(continued.conceptQuality, undefined);
  assert.equal(continued.editorial, null);
  assert.equal(continued.deliveryQuality?.passed, false);
  assert.equal(f.snapshot().confirmation.decision, "development-continuation");
  await assert.rejects(f.workflow.reviewCandidate(f.context, continued.version, author), { code: "workflow_not_ready" });
});

test("wrong identity, stale candidate, incomplete evidence, exhausted allowance and protected scope retain their refusals", async () => {
  const f = setup({ limit: 0 });
  await assert.rejects(f.workflow.conceptCritiqueInput(f.context, 10, { ...author, role: "customer" }), { code: "unavailable" });
  await assert.rejects(f.workflow.conceptCritiqueInput(f.context, 10, { ...author, authority: undefined }), { code: "unavailable" });
  await assert.rejects(f.workflow.conceptCritiqueInput({ ...f.context, intakeId: randomUUID() }, 10, author), { code: "draft_changed" });
  const ready = (await f.workflow.critiqueHomeConcept(f.context, 10, author))!, target = ready.conceptQuality!.target;
  for (const actor of [author, { ...reviewer, simulated: true }, { ...reviewer, role: "customer" as const }, { ...reviewer, authority: undefined }]) {
    await assert.rejects(f.workflow.recordQualityReview(f.context, ready.version, actor, judgment(target)), { code: "unavailable" });
  }
  await assert.rejects(f.workflow.recordQualityReview(f.context, ready.version, reviewer, { ...judgment(target), mobileEvidence: judgment(target).desktopEvidence }), { code: "invalid_request" });
  const rejected = (await f.workflow.recordQualityReview(f.context, ready.version, reviewer, judgment(target, true)))!;
  await assert.rejects(f.workflow.requestCommercialReplan(f.context, rejected.version, author), { code: "workflow_not_ready" });
  f.mutate(state => { state.pages[0].heading = "Changed after review"; });
  const changed = (await f.workflow.review(f.context))!;
  assert.notEqual(changed.conceptQuality?.target, target);
  f.mutate(state => { state.pages[0].heading = f.initial.pages[0].heading; state.report.summary = "Corrected understanding after the critique"; });
  assert.notEqual((await f.workflow.review(f.context))!.conceptQuality?.target, target, "The current understanding is part of the exact review target");
  await assert.rejects(f.workflow.recordQualityReview(f.context, changed.version, reviewer, judgment(target)), { code: "workflow_not_ready" });
  const protectedCase = setup({ boundary: "protected" });
  await assert.rejects(protectedCase.workflow.conceptCritiqueInput(protectedCase.context, 10, author), { code: "workflow_not_ready" });
});

test("a retained interrupted concept response recovers without dispatch and remains distinct from final editorial", async () => {
  const f = setup({ uncertain: true });
  const blocked = (await f.workflow.critiqueHomeConcept(f.context, 10, author))!;
  assert.equal(blocked.failure, "outcome-unknown");
  assert.equal(f.outputs.size, 1);
  assert.equal(f.snapshot().work?.reviewStage?.phase, "home-concept");
  await assert.rejects(f.workflow.critiqueHomeConcept(f.context, blocked.version, author), { code: "workflow_not_ready" });
  const recovered = (await f.workflow.recover(f.context, blocked.version))!;
  assert.equal(recovered.failure, null); assert.ok(recovered.conceptQuality?.critique);
  assert.equal(recovered.editorial, null);
  assert.equal(f.runs.length, 1); assert.equal(f.recoveries(), 1);
});

test("historical authoring grants keep their existing Home continuation without the new feature", async () => {
  const f = setup({ enabled: false });
  const view = (await f.workflow.review(f.context))!;
  assert.equal(view.conceptQuality, undefined);
  await assert.rejects(f.workflow.critiqueHomeConcept(f.context, view.version, author), { code: "workflow_not_ready" });
  const continued = (await f.workflow.reviewHomeConcept(f.context, view.version, author,
    composeHomeConcept(f.context, view).digest, "Historical local review", true))!;
  assert.equal(continued.next, "page");
  assert.equal(f.runs.length, 0);
});

test("the normal metered concept critique requires actual scoped image inputs and separates its instructions from whole-site review", async () => {
  const { mkdtemp, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createHash } = await import("node:crypto");
  const sharp = (await import("sharp")).default;
  const { createResponsesPresenceWorkflow } = await import("../lib/platform/intake/presence-workflow-provider");
  const { initializeResponsesUsageLedger } = await import("../lib/platform/intake/intelligent-responses");
  const { resolveSourceReferences } = await import("../lib/platform/intake/presence-source-material");
  const f = setup(), run = await f.workflow.conceptCritiqueInput(f.context, 10, author);
  const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
  const original = Buffer.from(f.context.evidence[0].content);
  const source = { id: "offer", sha256: digest(original), bytes: original.length, mime: "text/plain" as const,
    reference: "Offline recorded source", author: "Fixture owner", date: "2026-11-19", status: "owner-confirmed" as const,
    purpose: "business-context" as const, operations: ["editorial" as const] };
  const frames = await Promise.all((["desktop", "mobile"] as const).map(async viewport => {
    const bytes = await sharp({ create: { width: viewport === "desktop" ? 144 : 39, height: 100, channels: 3, background: "#332f7e" } }).png().toBuffer();
    return { bytes, source: { id: "concept-" + viewport, sha256: digest(bytes), bytes: bytes.length, mime: "image/png" as const,
      reference: "Offline native-render fixture", author: "Controlled fixture renderer", date: "2026-11-19",
      status: "unconfirmed" as const, purpose: "candidate-review" as const, operations: ["editorial" as const],
      reviewOf: { contextDigest: fingerprint(f.context), inputDigest: run.work.inputDigest, representationDigest: fingerprint("offline representation"),
        path: "/", viewport, representation: "wordpress-native-draft" as const, variant: "core-candidate" as const } } };
  }));
  const root = await mkdtemp(join(tmpdir(), "miopages-concept-request-"));
  try {
    const rates = { model: "offline-model", verifiedOn: "2026-11-19", inputPerMillion: 750_000, cachedPerMillion: 75_000,
      outputPerMillion: 4_500_000, cacheWritePerMillion: 0, countMicros: 0 };
    await initializeResponsesUsageLedger(root, rates);
    const grant = { contextDigest: fingerprint(f.context), approvedSources: f.context.evidence.map(fingerprint), approvedCorrections: [],
      marketingAuthority: f.authority, researchSources: [{ id: "research:offline", url: "https://example.org/", label: "Never fetched" }],
      researchResponseBytes: 10_000, expiresAt: Date.now() + 60_000, maxOutputTokens: 1000,
      originalMaterials: { version: 1 as const, contextDigest: fingerprint(f.context), records: [source], requestBytes: 100_000,
        candidateReview: { operations: ["editorial" as const], maximumRecords: 2, maximumBytes: 50_000 } },
      ledger: { id: fingerprint("offline-concept-grant"), startingLedger: digest(await readFile(join(root, "onboarding-usage.json"))),
        baselineAttempts: 0, requests: 2, generations: 1, inputTokens: 2000, inputBytes: 100_000, capMicros: 20_000 } };
    let available = false, retained: Buffer | undefined, request: Buffer | undefined, calls = 0;
    const output = { summary: "Offline early concept criticism, not acceptance.", concerns: [{ path: "/", concern: "Reconsider the commercial proposition." }] };
    const provider = createResponsesPresenceWorkflow({ grant, readGrant: async () => grant, readContext: async () => f.context,
      rates, ledgerDirectory: root, fetchPage: async () => { throw Error("No network"); },
      readOriginalMaterials: async () => [{ source, bytes: original }, ...(available ? frames : [])],
      retainRequest: async (_run, bytes) => { request = bytes; },
      transport: { async send(path, body) {
        calls++; assert.ok(request);
        const value = body as { instructions: string; input: { content: { type: string; text?: string }[] }[] };
        assert.match(value.instructions, /early Home-concept critique/);
        assert.match(value.instructions, /Review only the supplied Home/);
        assert.doesNotMatch(value.instructions, /Critically review the complete candidate/);
        assert.match(value.instructions, /Challenge the underlying positioning/);
        assert.match(value.instructions, /do not demand public publication rights before a permitted non-public preview/);
        const content = value.input[0].content;
        assert.equal(content.filter(row => row.type === "input_image").length, 2);
        const task = resolveSourceReferences(JSON.parse(content[0].text!).task, new Map([[source.id, original.toString()]])) as { reviewStage: unknown };
        assert.deepEqual(task.reviewStage, run.work.reviewStage);
        if (path.endsWith("/input_tokens")) return { body: { input_tokens: 1000 } };
        const response = { id: "resp_offline_concept", model: rates.model, status: "completed", service_tier: "default",
          usage: { input_tokens: 1000, output_tokens: 30, total_tokens: 1030, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } },
          output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(output) }] }] };
        return { body: response, rawBody: Buffer.from(JSON.stringify(response)) };
      } } });
    await assert.rejects(provider.preflight!(run), /Required rendered review/);
    assert.equal(calls, 0, "Missing visual evidence refuses in preflight before any work claim or request");
    await assert.rejects(provider.run(run, async () => {}), /Required rendered review/);
    assert.equal(calls, 0, "A missing rendered candidate stops before provider counting or dispatch");
    available = true;
    await provider.preflight!(run);
    assert.deepEqual(await provider.run(run, async bytes => { retained = bytes; }), output);
    assert.ok(retained);
    assert.deepEqual(await provider.recover(run, retained), output);
    assert.equal(calls, 2);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("the trusted capture adapter refuses non-loopback, stale, foreign or widened rendering bindings", async () => {
  const { validateRenderedCandidateBinding } = await import("../lib/platform/intake/presence-candidate-capture");
  const f = setup(), run = await f.workflow.conceptCritiqueInput(f.context, 10, author);
  const source = { id: "offer", sha256: fingerprint("source"), bytes: 10, mime: "text/plain" as const, reference: "Offline fixture",
    author: "Test fixture", date: "2026-11-19", status: "owner-confirmed" as const, purpose: "business-context" as const, operations: ["editorial" as const] };
  const grant = { version: 1 as const, contextDigest: fingerprint(f.context), records: [source], requestBytes: 100_000,
    candidateReview: { operations: ["editorial" as const], maximumRecords: 2, maximumBytes: 50_000 } };
  const binding = { contextDigest: grant.contextDigest, inputDigest: run.work.inputDigest, representationDigest: fingerprint("fixture-render"), nativeReadbackDigest: fingerprint("fixture-native-readback"),
    variant: "core-candidate" as const, origin: "http://127.0.0.1:43299", pages: [{ path: "/", wordpressPageId: 1 }] };
  validateRenderedCandidateBinding(run, grant, binding);
  for (const changed of [
    { ...binding, origin: "https://miopages.org" }, { ...binding, origin: "http://localhost:43299" },
    { ...binding, origin: "http://127.0.0.1:43299/extra" }, { ...binding, inputDigest: "f".repeat(64) },
    { ...binding, contextDigest: "f".repeat(64) }, { ...binding, pages: [{ path: "/other", wordpressPageId: 2 }] },
    { ...binding, pages: [...binding.pages, { path: "/service", wordpressPageId: 2 }] },
    { ...binding, variant: "operator-proposed-preview" as const },
  ]) assert.throws(() => validateRenderedCandidateBinding(run, grant, changed));
});

test("whole-site rendering precedes critique without requiring a fabricated editorial or weakening signed delivery", async () => {
  const { workflowLocalDraftInput, workflowDeliveryInput } = await import("../lib/platform/intake/presence-workflow-delivery");
  const { workPresenceCase } = await import("../lib/platform/intake/protected-presence-workflow");
  const f = setup();
  const critiqued = (await f.workflow.critiqueHomeConcept(f.context, 10, author))!;
  const passed = (await f.workflow.recordQualityReview(f.context, critiqued.version, reviewer, judgment(critiqued.conceptQuality!.target)))!;
  await f.workflow.reviewHomeConcept(f.context, passed.version, author, composeHomeConcept(f.context, passed).digest, "Offline Home render", true);
  f.mutate(state => {
    const home = state.pages[0];
    for (const page of state.blueprint.pages.filter(page => page.path !== "/")) {
      state.pages.push({ ...structuredClone(home), path: page.path, heading: "Supporting fixture Page",
        actions: [{ label: "Home", kind: "navigate", destination: "/", sectionIndex: 0 }], internalLinks: ["/"] });
    }
  });
  const ready = (await f.workflow.review(f.context))!;
  assert.equal(ready.next, "editorial"); assert.equal(ready.editorial, null);
  assert.equal(ready.canRenderForEditorial, true);
  const calls = f.runs.length;
  const paused = (await workPresenceCase(f.workflow, f.context))!;
  assert.equal(paused.version, ready.version); assert.equal(f.runs.length, calls);
  const projected = workflowLocalDraftInput(f.context, ready);
  assert.equal(projected.pages.length, ready.pages.length);
  assert.equal(projected.scope.webPresenceId, f.context.scope.webPresenceId);
  assert.throws(() => workflowDeliveryInput(f.context, ready, null, []), /Independent product-quality/);
  const run = await f.workflow.editorialCritiqueInput(f.context, ready.version, author);
  assert.equal(run.input.pages.length, ready.pages.length);
  assert.equal(run.work.operation, "editorial"); assert.equal(run.work.reviewStage, undefined);
  const reviewed = (await f.workflow.critiqueSite(f.context, ready.version, author))!;
  assert.ok(reviewed.editorial);
  assert.equal(reviewed.canRenderForEditorial, undefined);
  assert.equal(f.runs.length, calls + 1);
  assert.equal(f.runs.at(-1)!.work.inputDigest, run.work.inputDigest);
});

test("render capture intent carries only visitor headings and hashes while Core retains the full evidence boundary",async()=>{
 const {renderedCaptureIntent,validateRenderedCaptureIntent}=await import("../lib/platform/intake/presence-candidate-capture");
 const f=setup(),run=await f.workflow.conceptCritiqueInput(f.context,10,author);
 const grant={version:1 as const,contextDigest:fingerprint(f.context),records:[{id:"offer",sha256:fingerprint("fixture source"),bytes:10,mime:"text/plain" as const,reference:"Offline source",author:"Fixture",date:"2026-11-19",status:"owner-confirmed" as const,purpose:"business-context" as const,operations:["editorial" as const]}],requestBytes:100000,
  candidateReview:{operations:["editorial" as const],maximumRecords:2,maximumBytes:50000}};
 const intent=renderedCaptureIntent(run,grant);
 assert.deepEqual(intent.expectedPages,[{path:"/",title:run.input.pages[0].heading,heading:run.input.pages[0].sections[0].heading}]);
 assert.equal(intent.contextDigest,fingerprint(f.context));
 assert.ok(!JSON.stringify(intent).includes(f.context.evidence[0].content));
 assert.ok(!("evidence" in intent)&&!("context" in intent)&&!("report" in intent));
 const binding={contextDigest:intent.contextDigest,inputDigest:intent.inputDigest,representationDigest:fingerprint("fixture packet"),
  nativeReadbackDigest:fingerprint("actual row fixture"),variant:"core-candidate" as const,origin:"http://127.0.0.1:4474",pages:[{path:"/",wordpressPageId:1}]};
 validateRenderedCaptureIntent(intent,binding);
 assert.throws(()=>validateRenderedCaptureIntent(intent,{...binding,pages:[{path:"/foreign",wordpressPageId:1}]}));
 assert.throws(()=>validateRenderedCaptureIntent({...intent,maximumRecords:1},binding));
 assert.throws(()=>validateRenderedCaptureIntent(intent,{...binding,origin:"https://example.org"}));
});

test("native capture preserves distinct Page metadata title and actual Hero H1 instead of rewriting either",async()=>{
 const {renderedCaptureIntent}=await import("../lib/platform/intake/presence-candidate-capture");
 const f=setup();f.mutate(s=>{s.pages[0].heading="Different Page metadata title";});
 const run=await f.workflow.conceptCritiqueInput(f.context,10,author);
 const source={id:"offer",sha256:fingerprint("fixture source"),bytes:10,mime:"text/plain" as const,reference:"Offline source",author:"Fixture",date:"2026-11-19",status:"owner-confirmed" as const,purpose:"business-context" as const,operations:["editorial" as const]};
 const intent=renderedCaptureIntent(run,{version:1,contextDigest:fingerprint(f.context),records:[source],requestBytes:100000,
  candidateReview:{operations:["editorial"],maximumRecords:2,maximumBytes:50000}});
 assert.equal(intent.expectedPages[0].title,"Different Page metadata title");
 assert.equal(intent.expectedPages[0].heading,"Fixture managed service");
 assert.equal(run.input.pages[0].heading,"Different Page metadata title");
 assert.equal(run.input.pages[0].sections[0].heading,"Fixture managed service");
});

test("an exact negative Home judgment permits a bounded Core-editorial correction without a third strategic replan or new feedback authority",async()=>{
 const f=setup(),critiqued=(await f.workflow.critiqueHomeConcept(f.context,10,author))!;
 await assert.rejects(f.workflow.requestEditorialRevision(f.context,critiqued.version,author,["/"]),{code:"workflow_not_ready"});
 const judged=(await f.workflow.recordQualityReview(f.context,critiqued.version,reviewer,judgment(critiqued.conceptQuality!.target,true)))!;
 const queued=(await f.workflow.requestEditorialRevision(f.context,judged.version,author,["/"]))!;
 const state=f.snapshot() as unknown as {revisionRequest:{audit:unknown;priorPages:unknown;ordinal:number;source?:string};pages:unknown[]};
 assert.equal(queued.next,"page");assert.equal(state.revisionRequest.ordinal,1);
 assert.deepEqual(state.revisionRequest.audit,critiqued.conceptQuality!.critique!.editorial);
 assert.deepEqual(state.revisionRequest.priorPages,f.initial.pages);
 assert.equal(state.revisionRequest.source,undefined,"Core critique is not unapproved free-form Operator feedback");
 assert.deepEqual(state.pages,[]);assert.equal(f.runs.length,1,"Queueing buys no additional generation");
 await assert.rejects(f.workflow.requestEditorialRevision(f.context,judged.version,author,["/"]),{code:"draft_changed"});
 assert.equal(f.events[0].pages.length,1,"Rejected prior content remains in immutable history");
 const g=setup(),fresh=(await g.workflow.critiqueHomeConcept(g.context,10,author))!;
 const passed=(await g.workflow.recordQualityReview(g.context,fresh.version,reviewer,judgment(fresh.conceptQuality!.target)))!;
 await assert.rejects(g.workflow.requestEditorialRevision(g.context,passed.version,author,["/"]),{code:"workflow_not_ready"});
});

test("an authorized source repair reopens assessment with prior useful work, research and history retained; retry is idempotent",async()=>{
 const f=setup({repair:true}),before=f.snapshot(),authority=f.authority,context=structuredClone(f.context),token=fingerprint("owner-authorized source repair");
 const view=(await f.workflow.reassessFromRepairedSources(f.context,before.version,author,token))!;
 assert.equal(view.version,before.version+1);
 assert.equal(view.next,"report");
 const saved=f.snapshot() as typeof before & {sourceRecovery:{previous:Pick<typeof before,"report"|"direction"|"blueprint"|"pages">;priorRevisionOrdinal:number}};
 assert.deepEqual(saved.research,before.research);
 assert.deepEqual(saved.sourceRecovery.previous,{report:before.report,direction:before.direction,blueprint:before.blueprint,pages:before.pages});
 assert.equal(saved.confirmation,null);
 assert.deepEqual(f.events[0],before);
 assert.deepEqual(f.context,context);
 assert.deepEqual(f.authority,authority);
 assert.equal(f.runs.length,0,"Source recovery is not a provider dispatch");
 await f.workflow.reassessFromRepairedSources(f.context,view.version,author,token);
 assert.equal(f.events.length,2);
 await assert.rejects(f.workflow.reassessFromRepairedSources(f.context,before.version,author,token),{code:"draft_changed"});
});

test("source repair refuses missing grant, wrong principal, protected boundary, changed baseline, unknown outcome and another repair",async()=>{
 const token=fingerprint("owner-authorized source repair");
 for(const options of [{},{repair:true,boundary:"protected" as const}]){
  const f=setup(options);
  await assert.rejects(f.workflow.reassessFromRepairedSources(f.context,f.snapshot().version,author,token),{code:"unavailable"});
  assert.equal(f.events.length,1);
 }
 for(const mutate of [
  (f:ReturnType<typeof setup>)=>f.mutate(s=>{s.direction!.positioning="Unreviewed concurrent change"}),
  (f:ReturnType<typeof setup>)=>f.mutate(s=>{s.work={operation:"page",attempt:"pending",until:1,inputDigest:fingerprint("pending")}}),
  (f:ReturnType<typeof setup>)=>f.mutate(s=>{s.failure="outcome-unknown" as never}),
 ]){
  const f=setup({repair:true});mutate(f);
  await assert.rejects(f.workflow.reassessFromRepairedSources(f.context,f.snapshot().version,author,token));
  assert.equal(f.events.length,1);
 }
 const f=setup({repair:true});
 for(const actor of [{...author,role:"customer" as const},{...author,simulated:true},{...author,authority:undefined}]){
  await assert.rejects(f.workflow.reassessFromRepairedSources(f.context,f.snapshot().version,actor,token),{code:"unavailable"});
 }
 await assert.rejects(f.workflow.reassessFromRepairedSources(f.context,f.snapshot().version,author,fingerprint("unapproved repair")),{code:"unavailable"});
});

test("source repair retains consumed replan/editorial allowances and does not turn old work into current claims",async()=>{
 const f=setup({repair:true,consumed:3}),before=f.snapshot(),auth=fingerprint("owner-authorized source repair");
 const view=(await f.workflow.reassessFromRepairedSources(f.context,before.version,author,auth))!;
 const state=f.snapshot() as typeof before & {sourceRecovery:{priorRevisionOrdinal:number}};
 assert.equal(state.sourceRecovery.priorRevisionOrdinal,3);
 assert.equal(state.replan?.ordinal,2);
 assert.equal(state.revisionRequest,null);
 assert.deepEqual(state.sourceSnapshot,before.sourceSnapshot);
 assert.equal(state.report,null);
 assert.equal(state.confirmation,null);
 const operations=Reflect.get(f.workflow,"operations");
 assert.equal(operations.maxCommercialReplans,1,"The original configured allowance is not replenished");
 f.mutate(s=>{Object.assign(s,{report:before.report,confirmation:before.confirmation,direction:before.direction,blueprint:before.blueprint,pages:before.pages})});
 const restored=(await f.workflow.review(f.context))!;
 await assert.rejects(f.workflow.reviseHomeConcept(f.context,view.version,author,composeHomeConcept(f.context,restored).digest,"Another correction"),{code:"workflow_not_ready"});
});

test("explicit site-first development builds every declared Page before actual whole-site review without manufacturing Home approval",async()=>{
 const f=setup({siteFirst:true});
 let view=(await f.workflow.review(f.context))!;
 assert.equal(view.next,"page");assert.equal(view.homeConcept,undefined);assert.equal(view.conceptQuality,undefined);
 assert.equal(view.homeReview,undefined);
 await assert.rejects(f.workflow.reviewCandidate(f.context,view.version,author),{code:"workflow_not_ready"});
 await assert.rejects(f.workflow.critiqueHomeConcept(f.context,view.version,author),{code:"workflow_not_ready"});
 while(view.next==="page"){view=(await f.workflow.advance(f.context,view.version))!;assert.equal(view.failure,null,JSON.stringify(view.failure));}
 assert.equal(view.pages.length,4);assert.equal(view.next,"editorial");assert.ok(view.canRenderForEditorial);
 assert.equal(f.runs.length,3);assert.ok(f.runs.every(run=>run.work.operation==="page"));
 const input=await f.workflow.editorialCritiqueInput(f.context,view.version,author);
 assert.equal(input.input.pages.length,4);assert.equal(input.work.reviewStage,undefined);
 const {workflowLocalDraftInput,workflowDeliveryInput}=await import("../lib/platform/intake/presence-workflow-delivery");
 const packet=workflowLocalDraftInput(f.context,view);assert.equal(packet.pages.length,4);
 assert.throws(()=>workflowDeliveryInput(f.context,view,null,[]));
 view=(await f.workflow.critiqueSite(f.context,view.version,author))!;
 assert.equal(view.next,"operator-review");assert.equal(view.deliveryQuality?.passed,false);
 view=(await f.workflow.reviewCandidate(f.context,view.version,author))!;
 assert.equal(view.next,"review-complete");assert.equal(view.deliveryQuality?.passed,false);
 assert.throws(()=>workflowDeliveryInput(f.context,view,null,[]),/quality/);
 assert.equal(f.snapshot().homeReview,null,"No synthetic Home approval is recorded");
 assert.equal(f.snapshot().confirmation.decision,"development-continuation");
 assert.throws(()=>setup({siteFirst:true,boundary:"protected"}));
 assert.throws(()=>setup({siteFirst:true,enabled:false,boundary:"protected"}));
});
