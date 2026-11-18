import assert from "node:assert/strict";
import {resolveSourceReferences} from "../lib/platform/intake/presence-source-material";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { p022CandidateInputs, p022ProposedMeter, readP022SourcePack } from "../lib/platform/intake/c0-p022-source-pack";
import { fingerprint } from "../lib/platform/canonical/model";
import { strategyBasis } from "../lib/platform/intake/presence-decision-brief";
import { bindBlueprintDecisionSchema, bindEvaluationHomeActions, createResponsesPresenceWorkflow, type PresenceWorkflowGrant } from "../lib/platform/intake/presence-workflow-provider";
import { marketingProjection, repeatsPeerObservation, unsupportedCommercialCopy, type MarketingAuthority } from "../lib/platform/intake/presence-marketing-authority";
import { readBlueprint, readPage } from "../lib/platform/intake/presence-workflow-artifacts";
import { readSemanticBlock } from "../lib/platform/intake/presence-semantic-block";
import { initializeResponsesUsageLedger, type ResponsesRates } from "../lib/platform/intake/intelligent-responses";
import type { WorkflowInput, WorkflowRun } from "../lib/platform/intake/presence-workflow";
import { validatePages } from "../lib/platform/wordpress-delivery/authority";

const packFile = "docs/c0-generation-p0-22-sources.json";
const protectedText = "Internal paperwork and private measurements belong only in the excluded operating record";
const priorReport = "Untransmittable narrative report body";
const prices = "Provisional price and unverified testimonials stay outside claims.";
const peerIds = ["peer-wordpress-builder", "peer-scanmyseo", "peer-amplify"];
const claims = ["c0-service-scope", "c0-review", "c0-direct", "c0-launch", "c0-ongoing", "c0-ownership"];
const scope = { brandDigest: fingerprint("accepted brand"), qualityReviewerId: "offline-fixture" };
const block = { version: 1, name: "how-control-moves", purpose: "Explain responsibility",
  layout: "grid", listStyle: "steps", groups: [{ heading: "You confirm",
    body: "Tell us what your business does.", items: ["Share what already works", "Confirm important details"] },
  { heading: "We handle the next step", body: "Structure and maintain the web presence.", items: [] }] };

test("Core binds only explicit Home preview intents to exact declared and authorized routes", () => {
  const output = { path: "/", actions: [
    { kind: "request-review", label: "Free Review", sectionIndex: 0, destination: null },
    { kind: "start-onboarding", label: "Direct Start", sectionIndex: 0, destination: null },
    { kind: "existing-account", label: "Account", sectionIndex: 0, destination: null },
  ] };
  const paths = ["/", "/free-review", "/direct-start"];
  const destinations = { "request-review": "/free-review", "start-onboarding": "/direct-start" };
  assert.deepEqual((bindEvaluationHomeActions(output, paths, destinations) as typeof output).actions.map(action => action.destination),
    ["/free-review", "/direct-start", null]);
  assert.deepEqual(bindEvaluationHomeActions(output, paths.slice(0, 2), destinations), output);
  assert.deepEqual(bindEvaluationHomeActions({ ...output, path: "/other" }, paths, destinations), { ...output, path: "/other" });
  const tainted = { ...output, actions: [{ ...output.actions[0], destination: "/unapproved" }, output.actions[1]] };
  assert.equal((bindEvaluationHomeActions(tainted, paths, destinations) as typeof tainted).actions[0].destination, "/unapproved");
  assert.equal(readSemanticBlock({ ...block, name: "Service fit and scope" }, true).name, "service-fit-and-scope");
  assert.throws(() => readSemanticBlock({ ...block, name: "<script>" }, true));
});

test("constrains Blueprint report references separately from approved source IDs", async () => {
  const { context, authority } = p022CandidateInputs(await readFile(packFile), scope);
  const run = inputs(authority, context);
  const fields = bindBlueprintDecisionSchema(run, authority).properties.pages.items.properties.decisionBrief.properties;
  assert.deepEqual((fields.findingIds.items as { enum?: string[] }).enum, ["important-finding"]);
  assert.ok((fields.claimIds.items as { enum?: string[] }).enum?.includes("c0-launch"));
  assert.ok(!(fields.claimIds.items as { enum?: string[] }).enum?.includes("peer-wordpress-builder"));
  assert.deepEqual((fields.directionSteps.items as { enum?: number[] }).enum, [0]);
});

test("P0-22 accepts both exact rendered public peers and rejects replaced evidence", async () => {
  const pack = await readFile(packFile);
  const peers = [
    { id: "peer-b12-rendered", publisher: "B12", url: "https://www.b12.io/" },
    { id: "peer-sitecare-rendered", publisher: "SiteCare", url: "https://sitecare.com/" },
  ].map(peer => ({ ...peer, date: "2026-11-18", desktopSha256: "a".repeat(64), mobileSha256: "b".repeat(64),
    observation: "Local structured desktop and mobile observations, no source pixels or copied prose." }));
  const result = p022CandidateInputs(pack, scope, [], peers);
  assert.deepEqual(result.authority.strategy?.peerIds.slice(-2), peers.map(peer => peer.id));
  assert.ok(result.authority.sources.slice(-2).every(row => row.use === "analysis"));
  assert.throws(() => p022CandidateInputs(pack, scope, [], [peers[0], { ...peers[1], url: "https://sitecare.com/sign-in/" }]));
  assert.throws(() => p022CandidateInputs(pack, scope, [], [peers[0]]));
  assert.throws(() => p022CandidateInputs(pack, scope, [], [peers[0], { ...peers[1], mobileSha256: peers[1].desktopSha256 }]));
});

function inputs(authority: MarketingAuthority, context: WorkflowRun["context"], testCase = 1, revision = false): WorkflowRun {
  const direction = { positioning: "Private strategy narrative", approach: "Original supported decisions", sourceIds: [claims[0], peerIds[0]],
    visitorDecisions: [testCase === 1 ? "Show the managed responsibilities beside customer control" : "Explain migration before the next action"] };
  const report = { title: "Private business report", summary: priorReport, findings: [
    { id: "important-finding", heading: testCase === 1 ? "Owners fear losing control" : "Useful existing URLs must be preserved",
      body: priorReport, status: "proposed" as const, sourceIds: [claims[0], peerIds[0]] },
  ] };
  const sourceIds = context.evidence.map(row => row.id);
  const home = { path: "/", label: "Home", purpose: "Explain and route the managed service", sourceIds: [claims[0]],
    decisionBrief: { decision: direction.visitorDecisions[0], findingIds: [report.findings[0].id], directionSteps: [0], claimIds: claims,
      influences: [{ sourceIds: [peerIds[0]], use: "composition", implication: testCase === 1 ? "Lead with a responsibility comparison" : "Show what stays and what changes" },
        { sourceIds: [peerIds[2]], use: "journey", implication: "Separate a diagnostic from the launch path" }],
      avoid: [prices] } };
  const blueprint = readBlueprint({ pages: [home], navigation: ["/"], articles: [] }, sourceIds, false, true);
  const heads = { report, direction, research: null };
  const input: WorkflowInput = {
    evidence: context.evidence, entry: context.entry, corrections: [], conflicts: [], limitations: [],
    ...heads, pages: [], blueprint: { ...blueprint, strategyBasis: strategyBasis(context, heads) },
    ...(revision && { revisionRequest: { paths: ["/"], priorPages: [], audit: { summary: "Improve this Page",
      concerns: [{ path: "/", concern: "Use a clearer path into Direct Start" }] }, actor: { id: "offline", role: "operator", simulated: true },
      at: "2026-11-18T00:00:00.000Z", ordinal: 1 } }),
  };
  if (authority.contextDigest !== fingerprint(context)) throw Error("Fixture case binding changed");
  return { context, input, work: { operation: "page", path: "/", inputDigest: fingerprint(input), attempt: "offline-fixture", until: 0 } };
}

for (const originals of [false, true]) test(originals
  ? "new source grants carry complete report, Direction, original and revision context into actual Page requests"
  : "historical Page and revision requests retain their exact condensed privacy projection", async () => {
  const pack = await readFile(packFile);
  const { context, authority } = p022CandidateInputs(pack, scope, [{ id: "private", kind: "customer-unconfirmed", label: "Excluded",
    reference: "custody-pointer", date: null, content: protectedText }]);
  assert.equal(context.evidence.length, 15);
  assert.throws(() => readP022SourcePack(Buffer.concat([pack, Buffer.from(" ")])), /Exact/);
  const directory = await mkdtemp(join(tmpdir(), "miopages-p022-"));
  try {
    const rates: ResponsesRates = { model: "fixture-model", verifiedOn: "2026-11-18", inputPerMillion: 750_000,
      outputPerMillion: 4_500_000, cachedPerMillion: 75_000, cacheWritePerMillion: 0, countMicros: 0 };
    await initializeResponsesUsageLedger(directory, rates);
    const originalBytes = Buffer.from("An entire newly authorized source, not an excerpt. ".repeat(500));
    const original = { id: "fixture-entire-source", sha256: createHash("sha256").update(originalBytes).digest("hex"), bytes: originalBytes.length,
      mime: "text/plain" as const, reference: "Offline original fixture", author: "Test owner", date: "2026-11-18",
      status: "unconfirmed" as const, purpose: "business-context" as const, operations: ["page" as const] };
    const grant: PresenceWorkflowGrant = {
      ...(originals && { originalMaterials: { version: 1 as const, contextDigest: fingerprint(context), records: [original], requestBytes: 150_000 } }),
      contextDigest: fingerprint(context), approvedSources: context.evidence.map(fingerprint), approvedCorrections: [],
      marketingAuthority: authority, siteComposition: "managed-v1", expiresAt: Date.now() + 60_000,
      researchSources: [{ id: "research:pinned", label: "Public research", url: "https://example.org/" }],
      researchResponseBytes: 10_000, maxOutputTokens: 6000,
      previewActionDestinations: { "request-review": "/free-review", "start-onboarding": "/direct-start" },
      ledger: { id: fingerprint("P0-22 offline"), baselineAttempts: 0,
        startingLedger: createHash("sha256").update(await readFile(join(directory, "onboarding-usage.json"))).digest("hex"),
        requests: 4, generations: 2, capMicros: 150_000, inputBytes: 150_000, inputTokens: 10000 },
    };
    const recorded: string[] = [];
    const provider = createResponsesPresenceWorkflow({
      grant, readContext: async () => context, readGrant: async () => grant, rates, ledgerDirectory: directory,
      fetchPage: async () => { throw Error("No network in the verification pass"); },
      ...(originals && { readOriginalMaterials: async () => [{ source: original, bytes: originalBytes }],
        retainRequest: async (_run: WorkflowRun, bytes: Buffer) => { assert.ok(bytes.includes(originalBytes)); } }),
      transport: { async send(path, req) {
        const actual = req as { input: string; instructions: string; text: { format: { schema: object } }; store?: boolean };
        const actualInput = actual.input as unknown;
        let input;
        if (originals) {
          const content = (actualInput as { content: { type: string; text?: string }[] }[])[0].content;
          assert.ok(content.some(row => row.type === "input_text" && row.text === originalBytes.toString()));
          const packet = resolveSourceReferences(JSON.parse(content[0].text!).task,new Map([[original.id,originalBytes.toString()]])) as {report:{summary:string};direction:{positioning:string};revisions?:{audit:{concerns:{concern:string}[]}};task:ReturnType<typeof JSON.parse>};
          assert.equal(packet.report.summary, priorReport);
          assert.equal(packet.direction.positioning, "Private strategy narrative");
          assert.ok(Object.hasOwn(packet, "revisions"));
          if (packet.revisions) assert.match(packet.revisions.audit.concerns[0].concern, /Direct Start/);
          input = packet.task;
          assert.ok(!JSON.stringify(actualInput).includes(protectedText));
        } else {
          input = JSON.parse(actual.input);
          assert.doesNotMatch(actual.input, /Internal paperwork|Untransmittable narrative|custody-pointer|Private strategy narrative/u);
        }
        assert.equal(input.approved.length, claims.length);
        assert.equal(input.decisionBrief.findings[0].id, "important-finding");
        assert.equal(input.decisionBrief.sourceTrace[0].use, "market-influence");
        assert.match(input.decisionBrief.sourceTrace[0].observed, /390px/u);
        assert.ok(!input.decisionBrief.claimIds.includes(peerIds[0]));
        assert.match(JSON.stringify(actual.text.format.schema), /"path":\{"type":"string","enum":\["\/"\]\}/u);
        assert.match(actual.instructions, /semantic block/u);
        if (path.endsWith("input_tokens")) return { body: { input_tokens: 2000 } };
        assert.equal(actual.store, false);
        recorded.push(input.decisionBrief.decision);
        const output = { path: "/", heading: input.decisionBrief.decision, searchTitle: "Fixture", searchDescription: "Fixture only",
          composition: "managed-v1", actions: [
            { kind: "request-review", label: "Request a review", destination: "/free-review", sectionIndex: 0 },
            { kind: "start-onboarding", label: "Direct Start", destination: "/direct-start", sectionIndex: 0 },
            { kind: "navigate", label: "Compare responsibilities", destination: input.decisionBrief.decision.includes("migration") ? "/migration" : "/responsibility", sectionIndex: null },
          ], internalLinks: [], sections: [{ heading: "Responsibilities", body: "Supported draft",
            sourceIds: [claims[0]], role: "hero", visual: { purpose: "Example", brief: "No asset", altIntent: "No image", status: "text-only" },
            block: input.decisionBrief.decision.includes("migration") ? { ...block, layout: "stack", name: "what-we-keep" } : block }] };
        const reply = { id: "resp_fixture_" + recorded.length, model: rates.model, status: "completed", service_tier: "default",
          usage: { input_tokens: 2000, output_tokens: 100, total_tokens: 2100, input_tokens_details: { cached_tokens: 0 },
            output_tokens_details: { reasoning_tokens: 0 } },
          output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(output) }] }] };
        return { body: reply, rawBody: Buffer.from(JSON.stringify(reply)) };
      } },
    });
    const first = await provider.run(inputs(authority, context), async () => {});
    const second = await provider.run(inputs(authority, context, 2, true), async () => {});
    assert.equal(recorded.length, 2);
    assert.notEqual(recorded[0], recorded[1]);
    const paths = ["/", "/free-review", "/direct-start", "/migration", "/responsibility"];
    const draftOne = readPage(first, "/", paths, claims, grant.previewActionDestinations!, true, true, true);
    const draftTwo = readPage(second, "/", paths, claims, grant.previewActionDestinations!, true, true, true);
    assert.equal(draftOne.sections[0].block?.version === 1 && draftOne.sections[0].block.layout, "grid");
    assert.equal(draftTwo.sections[0].block?.version === 1 && draftTwo.sections[0].block.layout, "stack");
    assert.equal(draftOne.actions[2].destination, "/responsibility");
    assert.equal(draftTwo.actions[2].destination, "/migration");
    const stale = inputs(authority, context);
    stale.input.direction!.visitorDecisions = ["A re-bound unrelated decision"];
    assert.throws(() => marketingProjection(stale, authority), /stale/);
    const foreign = inputs(authority, context);
    foreign.context = { ...context, scope: { ...context.scope, managedSiteId: "other-site" } };
    assert.throws(() => marketingProjection(foreign, authority), /stale|Unbound/);
    const fakeClaim = inputs(authority, context);
    fakeClaim.input.blueprint!.pages[0].decisionBrief!.claimIds = [peerIds[0]];
    assert.throws(() => marketingProjection(fakeClaim, authority), /claim authority/);
    const leak = inputs(authority, context);
    leak.input.blueprint!.pages[0].decisionBrief!.decision = protectedText;
    assert.throws(() => marketingProjection(leak, authority), /Excluded/);
    const unrelated = inputs(authority, context);
    unrelated.input.blueprint!.pages[0].decisionBrief!.influences[0].sourceIds = ["foreign-peer"];
    assert.throws(() => marketingProjection(unrelated, authority), /peer composition|market influence/);
    const changed = { ...authority, strategy: { ...authority.strategy!, change: {
      baseline: fingerprint("retained site baseline"), paths: ["/"], reason: "Focused observed issue", observationIds: [peerIds[0]],
    } } };
    const scoped = marketingProjection(inputs(changed, context, 2, true), changed);
    assert.ok("decisionBrief" in scoped);
    assert.deepEqual(scoped.decisionBrief?.change?.paths, ["/"]);
    assert.throws(() => marketingProjection(inputs(authority, context), { ...changed, strategy: { ...changed.strategy,
      change: { ...changed.strategy.change, paths: ["/elsewhere"] } } }), /Unbound/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("the proposed P0-22 stage ceilings fit the aggregate without dropping the prior reservation", async () => {
  const bytes = await readFile("docs/c0-generation-p0-22-run-proposal.json");
  const scope = p022ProposedMeter(bytes);
  assert.equal(scope.carryForward!.debitMicros + scope.capMicros, 7_902_189);
  assert.equal(scope.carryForward!.totalCapMicros, 8_000_000);
  assert.equal(scope.baselineAttempts, 32);
  assert.equal(scope.breakdown!.searchCalls, 4);
  assert.throws(() => p022ProposedMeter(Buffer.concat([bytes, Buffer.from(" ")])), /Exact/);
});

test("peer observations can inform strategy without becoming copied visitor language", async () => {
  const { context } = p022CandidateInputs(await readFile(packFile), scope);
  const peers = context.evidence.filter(row => peerIds.includes(row.id));
  assert.equal(repeatsPeerObservation({ sections: [{ body: peers[0].content }] }, peers), true);
  assert.equal(repeatsPeerObservation({ sections: [{ body: "See how much web work you can hand off after launch." }] }, peers), false);
});

test("unpriced C0 draft refuses obvious price, rating and results claims outside approved proof", () => {
  assert.ok(unsupportedCommercialCopy({ sections: [{ body: "Launch for $1,099" }] }));
  assert.ok(unsupportedCommercialCopy({ sections: [{ block: { groups: [{ items: ["5 stars, every time"] }] } }] }));
  assert.ok(unsupportedCommercialCopy({ sections: [{ body: "We guarantee leads from the first month." }] }));
  assert.equal(unsupportedCommercialCopy({ sections: [{ body: "Agree the work in advance and review material changes." }] }), false);
});

test("semantic content is typed and remains unavailable to the protected WordPress validator", () => {
  const recipe = readSemanticBlock(block);
  const page = { id: "home", path: "/", title: "Home", composition: "managed-v1" as const, navigationLabel: "Home",
    sections: [{ id: "lead", type: "hero", content: { heading: "Home", text: "Original content" }, block: recipe }] };
  validatePages([page], true, true);
  assert.throws(() => validatePages([page], true), /local draft renderer/);
  assert.throws(() => readSemanticBlock({ ...block, script: "alert(1)" }));
  assert.throws(() => readSemanticBlock({ ...block, groups: [{ ...block.groups[0], body: "<a href='https://foreign.test'>Unsafe</a>" }] }));
});
