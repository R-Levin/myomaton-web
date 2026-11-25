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
import { pageIdentity, withoutIdentity, workDigest } from "../../lib/platform/work-products/pages";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync, randomUUID } from "node:crypto";
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
import { reviewSummaryPage, workflowNativeReviewCandidate } from "../../lib/platform/intake/presence-workflow-delivery";
import { roundOutcome } from "../../lib/platform/intake/review-round-changes";
import { readMyBusiness } from "../../lib/platform/intake/my-business";
import { timeline } from "../../lib/platform/change/model";
import { observeDelivery } from "../../lib/platform/measurement/observation-beacon";
import { accountTasks, queue } from "../../lib/platform/work/tasks";
import { pendingContent, type NativeNode } from "../../lib/platform/intake/presence-native-component";
import type { MarketingAuthority } from "../../lib/platform/intake/presence-marketing-authority";
import { IntakeService } from "../../lib/platform/intake/service";
import { deliverReviewDraft, readBackOperatorSite, readOperatorSiteConfig, reviewDecisionFromReadback } from "../../lib/platform/wordpress-delivery/operator-review";
import { operatorFeedback, operatorFeedbackFromCandidate } from "../../lib/platform/intake/operator-feedback";
import { addClientPerson, clientAddresses, clientPeople, removeClientPerson } from "../../lib/platform/accounts/people";

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
      ({ path, label, purpose: "Simulated purpose.", sourceIds: ids, decisionBrief: brief(path) })), navigation: ["/service", "/start"], articles: [] }; // Home left out of the menu, as Core did in the first real run
  }
  if (stage === "review-analysis" && schema.properties?.newPages) {
    // Second round: the Operator asked for a page the site does not have.
    assert.match(instructions, /New page:/);
    const brief = (key: string) => enumAt(schema, "newPages", "[]", "decisionBrief", key).slice(0, 1);
    const decisionBrief = { decision: "Give people one clear way to get in touch.", findingIds: brief("findingIds"),
      directionSteps: brief("directionSteps"), claimIds: brief("claimIds"), influences: [], avoid: [] };
    const page = { path: "/contact", label: "Contact", purpose: "Tell people how to reach MioPages and what to include.",
      sourceIds: [], decisionBrief };
    const noteId = enumAt(schema, "newPages", "[]", "noteId")[0];
    return { summary: "You asked for a Contact page; Core proposes one, linked from Home.", facts: [],
      newPages: [{ ...page, noteId }, { ...page, noteId, path: "/service" }],
      revisions: [{ path: "/", sectionIndex: 1, reason: "Point people to the new Contact page.", factIds: [], newPageIds: ["P1"] }] };
  }
  if (stage === "review-analysis") {
    assert.match(instructions, /analyse the Operator's review/);
    return { summary: "One fact in your Service edit; Home should mention it.",
      facts: [{ statement: "The Service page heading is as the Operator wrote it.", publicUse: true, sourcePath: "/service",
        sourceText: "Simulated heading for /service (edited by the Operator)" },
        { statement: "An invented fact with no source.", publicUse: true, sourcePath: "/", sourceText: "Text the Operator never wrote" }],
      revisions: [{ path: "/", sectionIndex: 1, reason: "Mention the Operator's Service wording.", factIds: ["F1"] },
        { path: "/start", sectionIndex: 0, reason: "Already queued from the Note.", factIds: ["F1"] }] };
  }
  if (stage === "page" && schema.properties?.widerChange) {
    // A revision limited to the noted sections: only those sections come back.
    assert.match(instructions, /act on the Operator's review/);
    assert.match(instructions, /limited to the noted section/);
    const indexes = enumAt(schema, "sections", "[]", "index") as unknown as number[];
    const visual = { purpose: "Simulated", brief: "Simulated brief.", altIntent: "Simulated alt", status: "text-only" };
    return { widerChange: { needed: true, reason: "The Home page should mention the shorter first step too." },
      sections: indexes.map(index => index === 0
        ? { index, heading: "Simulated heading for /start", body: "A shorter first step (revised).", sourceIds: [], role: "hero", visual: { ...visual, status: "asset-needed" },
          block: { version: 2, name: "simulated-opening", purpose: "Simulated hero", mode: "section", root: node("group", { children: [
            node("heading", { level: 1, text: "Simulated heading for /start" }), node("paragraph", { text: "A shorter first step (revised)." }),
            node("action", { reference: "action-0", text: "See how it works" })] }) } }
        : { index, heading: "What clients say", body: "Revised proof section.", sourceIds: [], role: "intro", visual,
          block: { version: 2, name: "simulated-proof", purpose: "Simulated proof", mode: "section", root: node("group", { children: [
            node("heading", { level: 2, text: "What clients say" }), node("paragraph", { text: "Revised proof section." })] }) } }) };
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
    const requests: { name: string; instructions: string; body: string }[] = [];
    let loseNextAnswer = false;
    // The real run researches with web search and page capture; here one simulated page stands in.
    const provider = createResponsesPresenceWorkflow({ grant, readGrant: async () => grant, readContext: async () => context,
      rates, ledgerDirectory: root,
      fetchPage: (async (url: string) => ({ ok: true, url, headers: new Headers({ "content-type": "text/html" }),
        body: new Response("<html><body><main><h1>Simulated peer</h1><p>A simulated public page about managed websites.</p></main></body></html>").body,
      })) as unknown as typeof fetch,
      transport: { async send(path, body, started) {
        if (path.endsWith("/input_tokens")) return { body: { input_tokens: 2000 } };
        if (loseNextAnswer) {
          // The provider starts writing, then the connection drops before the answer arrives.
          loseNextAnswer = false;
          await started?.({ responseId: "resp_dry_run_lost", requestId: "req_lost" });
          throw Error("Responses HTTPS result unavailable");
        }
        const request = body as { instructions: string; text: { format: { name: string; schema: Schema } } };
        requests.push({ name: request.text.format.name, instructions: request.instructions, body: JSON.stringify(body) });
        const output = simulatedAnswer(request.text.format.name, request.text.format.schema, request.instructions);
        const response = { id: "resp_dry_run_" + requests.length, model: rates.model, status: "completed", service_tier: "default",
          usage: { input_tokens: 2000, output_tokens: 400, total_tokens: 2400, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } },
          output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(output) }] }] };
        return { body: response, rawBody: Buffer.from(JSON.stringify(response)) };
      } } });
    const operations = { ...provider, requiresResearch: true, clientPeople: (current: { scope: { webPresenceId: string } }) => clientAddresses(setup.pool, current.scope.webPresenceId),
      knowledgeConfirmation: { async authorize(person: { id: string; role: string }) {
        if (person.id !== "owner@c0.example" || person.role !== "customer") throw Error("Not the Client");
        return { operatorId: person.id, authorityReference: "Dry-run Client", customer: { kind: "business-representative" as const,
          subjectId: person.id, authorityReference: "Dry-run Client representative" } };
      } } };
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
    // Core delivers this site as a review draft to an Operator WordPress over the plugin's web
    // endpoint, reads back the Operator's edit and Note, and refuses to overwrite the edit.
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    await writeFile(join(root, "wordmark.png"), png);
    const config = readOperatorSiteConfig({ name: "dry-run", origin: "https://operator.example.test", gate: { user: "gate", password: "fixture-only" },
      organizationId: randomUUID(), installationId: randomUUID(), streamId: randomUUID(), keyId: "dry-run-key",
      signingKeyPkcs8Base64: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
      publicKeyBase64: Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url").toString("base64"),
      receiptSecretHex: "ab".repeat(32),
      logo: { assetId: randomUUID(), usageId: randomUUID(), alt: "MioPages", file: join(root, "wordmark.png"), sha256: createHash("sha256").update(png).digest("hex") } });
    const identity = { organizationId: config.organizationId, ...context.scope, installationId: config.installationId, keyId: config.keyId,
      publicKeyBase64: config.publicKeyBase64, deliveryUser: "core-delivery" };
    const site = { store: join(root, "wordpress.bin"), identity, pull: { secretHex: config.receiptSecretHex, identity: { installationId: config.installationId } } };
    const wordpress = (input: object) => {
      const result = spawnSync(process.platform === "win32" ? "C:/php/php.exe" : "php", ["-d", "serialize_precision=17", "wordpress/miopages-delivery/tests/review-draft-writer.php"],
        { input: JSON.stringify({ ...site, ...input }), encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr + result.stdout.slice(0, 400));
      return JSON.parse(result.stdout);
    };
    const fetcher = (async (url: URL, init: RequestInit) => {
      const route = new URL(url).searchParams.get("rest_route");
      const out = route === "/miopages/v1/draft" ? wordpress({ mode: "endpoint", wires: [init.body] })
        : route === "/miopages/v1/readback" ? wordpress({ mode: "readback", request: init.body }) : null;
      assert.ok(out, "Unexpected WordPress route " + route);
      return new Response(JSON.stringify(out.responses[0].body), { status: out.responses[0].status });
    }) as unknown as typeof fetch;
    // The Operator's answers on the Review summary, as the worker's decide-review reads them.
    const decideFromWordPress = async (readback: Parameters<typeof operatorFeedbackFromCandidate>[1], at: NonNullable<typeof view>) => {
      const { decision, replies, feedback: read } = reviewDecisionFromReadback(context, at, readback);
      if (!decision.approved) return null;
      return workflow.decideReview(context, at.version, actor, decision,
        { readbackRevision: read.readbackRevision, acknowledged: read.acknowledged, summaryNotes: replies });
    };
    const first = await deliverReviewDraft({ config, context, view, state: null, fetcher });
    assert.equal(first.state.revision, 1);
    assert.deepEqual(first.receipt.posts.map(post => post.path), ["/", "/service", "/start"]);
    const second = await deliverReviewDraft({ config, context, view, state: first.state, fetcher });
    assert.equal(second.state.revision, 2, "An unedited site can be delivered again");
    const delivered = wordpress({ mode: "operator" });
    assert.equal(Object.keys(delivered.ids).length, 3);
    // The Operator rewrites the Service heading and adds a Note to the first block on /start
    // (WordPress stores the Note's id in that block's metadata, beside Core's identifier).
    wordpress({ mode: "operator", edits: { "/service": ["</h1>", " (edited by the Operator)</h1>"],
      "/start": ['{"metadata":{"mio":"', '{"metadata":{"noteId":[501],"mio":"'] },
      notes: [{ id: 501, path: "/start", text: "Make the first step shorter." }] });
    const { readback, summary } = await readBackOperatorSite(config, fetcher);
    assert.deepEqual(summary.editedPages.sort(), ["/service", "/start"]);
    assert.equal(summary.openNotes[0].text, "Make the first step shorter.");
    assert.ok(summary.openNotes[0].block?.text, "The Note is tied to its block");
    await assert.rejects(deliverReviewDraft({ config, context, view, state: second.state, fetcher }),
      /Operator edits on .* must be taken into Core/);

    // Core takes the review in: the Operator's heading is kept as written, the noted page is revised.
    const feedback = operatorFeedback(context, view, readback);
    assert.equal(feedback.edits.length, 1);
    assert.equal(feedback.edits[0].path, "/service");
    assert.match(feedback.edits[0].after, /\(edited by the Operator\)$/);
    assert.equal(feedback.notes.length, 1);
    assert.equal(feedback.notes[0].path, "/start");
    assert.deepEqual(feedback.structural, []);
    // A review taken in by mistake can be withdrawn while nothing has run: the case returns exactly.
    const taken = (await workflow.applyOperatorReview(context, view.version, actor, feedback))!;
    const withdrawn = (await workflow.withdrawOperatorReview(context, taken.version, actor, "Dry-run withdrawal"))!;
    assert.deepEqual(withdrawn.pages.map(withoutIdentity), view.pages.map(withoutIdentity), "Withdrawal restores Core's pages exactly");
    // The same Page and Section Work products, with the restored content as their next version: history only moves forward.
    assert.deepEqual(withdrawn.pages.map(page => [page.id, page.sections.map(section => section.id)]), view.pages.map(page => [page.id, page.sections.map(section => section.id)]));
    assert.ok(withdrawn.pages.every((page, index) => page.version! >= view.pages[index].version!));
    assert.equal(withdrawn.wordpressReviews, undefined);
    // The Change ledger keeps the withdrawn round on record: Requests withdrawn, the kept edit reverted.
    const statuses = (at: { changes?: { changes: { id: string; label: string; status: string }[] } }, roundId: string) =>
      Object.fromEntries(at.changes!.changes.filter(change => change.id.startsWith(roundId + ":")).map(change => [change.label, change.status]));
    const withdrawnRound = withdrawn.changes!.rounds.at(-1)!;
    assert.equal(withdrawnRound.status, "withdrawn");
    assert.deepEqual(statuses(withdrawn, withdrawnRound.id), { E1: "reverted" });
    assert.ok(withdrawn.changes!.requests.filter(request => request.roundId === withdrawnRound.id).every(request => request.status === "withdrawn"));
    await assert.rejects(workflow.withdrawOperatorReview(context, withdrawn.version, actor, "again"), "Nothing left to withdraw");
    let revised = (await workflow.applyOperatorReview(context, withdrawn.version, actor, feedback))!;
    assert.ok(revised.pages.find(page => page.path === "/service")!.sections[0].heading.endsWith("(edited by the Operator)"),
      "The Operator's wording is now Core's own text");
    assert.deepEqual(revised.pages.map(page => page.path), ["/", "/service", "/start"], "Nothing is queued for revision before the Operator decides");
    assert.equal(revised.next, "review-analysis");
    const requestsBefore = requests.length;
    // The analysis answer is lost in transit once: Core stops, keeps the charge on record, and the
    // Operator's retry sends the same unchanged work again.
    loseNextAnswer = true;
    const sentBefore = requests.length;
    let lost = (await workPresenceCase(workflow, context))!;
    assert.equal(lost.failure, "outcome-unknown");
    lost = (await workPresenceCase(workflow, context))!;
    assert.equal(lost.failure, "outcome-unknown", "Working the case again does not guess or resend");
    assert.equal(requests.length, sentBefore, "Nothing more is sent while the charge is unsettled");
    revised = (await workflow.retryLostAnswer(context, lost.version, actor))!;
    assert.equal(revised.failure, null);
    await assert.rejects(workflow.retryLostAnswer(context, revised.version, actor), "Only a lost answer can be retried");
    const ledgerRows = JSON.parse(await readFile(join(root, "onboarding-usage.json"), "utf8")).attempts as { status: string; responseId?: string }[];
    assert.deepEqual(ledgerRows.filter(row => row.status === "lost").map(row => row.responseId), ["resp_dry_run_lost"]);
    // Core analyses the review: a fact in the Operator's edit, and a section elsewhere it affects.
    revised = (await workPresenceCase(workflow, context))!;
    assert.equal(revised.failure, null, JSON.stringify({ failure: revised.failure, issue: (revised as { artifactIssue?: unknown }).artifactIssue }));
    assert.equal(revised.next, "review-summary");
    const round = revised.reviewRounds!.at(-1)!;
    assert.deepEqual(round.analysis!.facts.map(fact => [fact.id, fact.source.kind, fact.source.path]), [["F1", "edit", "/service"]]);
    assert.deepEqual([...round.noteRevisions, ...round.analysis!.revisions].map(item => [item.path, item.indexes, item.source]),
      [["/start", [0], "note"], ["/", [1], "fact"]]);
    assert.ok(round.analysis!.estimateMicros > 0);
    // The analysis is Core's Decision: each proposal is a Change with its grain, base and consequence level.
    assert.deepEqual(statuses(revised, round.id), { E1: "applied", F1: "proposed", C1: "proposed", C2: "proposed" });
    const c2 = revised.changes!.changes.find(change => change.id === round.id + ":C2")!;
    // Step 4: the Change names the exact Page and Section Work products, at their versions, it is made against.
    const home = revised.pages.find(page => page.path === "/")!;
    assert.deepEqual([c2.target, c2.consequence, c2.dependsOn], [{ grain: "section", path: "/", sections: [1],
      workProduct: { id: home.id, version: home.version, sections: [{ id: home.sections[1].id, version: home.sections[1].version }] } },
      "operator-review", [round.id + ":F1"]]);
    assert.equal(home.id, pageIdentity(context.scope.managedSiteId, "/"), "The Page keeps the identity delivery has always given it");
    assert.ok(c2.base.digest, "A revision names the exact page it was proposed against");
    assert.deepEqual(revised.changes!.changes.find(change => change.id === round.id + ":C1")!.requestIds, [round.id + ":note:501"],
      "The noted change answers the Operator's Note");
    // The Review summary is delivered with the site; the Operator's Note stays open until the decision.
    const summaryDelivery = await deliverReviewDraft({ config, context, view: revised, state: second.state, fetcher });
    assert.deepEqual(summaryDelivery.receipt.posts.map(post => post.path), ["/", "/service", "/start", "/review-summary"]);
    let check = await readBackOperatorSite(config, fetcher);
    assert.deepEqual(check.summary.openNotes.map(note => note.id), [501]);
    const summaryPage = reviewSummaryPage(context, revised)!.page;
    const note = (id: number, section: number, text: string) => wordpress({ mode: "operator",
      edits: { "/review-summary": ['{"metadata":{"mio":"' + summaryPage.sections[section].id, '{"metadata":{"noteId":[' + id + '],"mio":"' + summaryPage.sections[section].id] },
      notes: [{ id, path: "/review-summary", text }] });
    // Sections: 0 opening, 1 fact F1, 2 change C1 (/start), 3 change C2 (/).
    assert.match(summaryPage.sections[3].content.heading, /^Change C2: \/, section 2$/);
    note(601, 3, "No");
    check = await readBackOperatorSite(config, fetcher);
    const pending = await decideFromWordPress(check.readback, revised);
    assert.equal(pending, null, "Without an Approve note nothing is decided");
    note(602, 0, "Approve");
    check = await readBackOperatorSite(config, fetcher);
    revised = (await decideFromWordPress(check.readback, revised))!;
    // The fact goes into the one Knowledge (the record My Business shows), Proposed: a Specialist introduced it.
    assert.equal(revised.businessFacts, undefined, "No separate copy of facts in the workflow");
    assert.deepEqual(revised.facts!.map(fact => [fact.status, fact.said.kind, fact.source]), [["proposed", "specialist", round.id + ":F1"]]);
    const knownAfterReview = await readMyBusiness(setup.pool, context.scope.webPresenceId);
    assert.deepEqual(knownAfterReview.proposed.map(item => [item.value, item.from]), [[revised.facts![0].statement, "Specialist"]],
      "The Client sees it in My Business, waiting for confirmation");
    assert.deepEqual(roundOutcome(revised.changes!, round.id).changes.map(item => item.path), ["/start"], "The change marked No is left out");
    assert.equal(revised.reviewRounds!.at(-1)!.decision, undefined, "What was decided lives in the Change ledger only");
    assert.deepEqual(statuses(revised, round.id), { E1: "applied", F1: "applied", C1: "approved", C2: "declined" }, "The ledger decides");
    assert.ok(!revised.pages.some(page => page.path === "/start"), "The approved change is queued");
    for (let step = 0; step < 6 && revised.pages.length < 3; step++) revised = (await workPresenceCase(workflow, context))!;
    assert.equal(revised.failure, null, JSON.stringify({ failure: revised.failure, next: revised.next }));
    assert.deepEqual(revised.pages.map(page => page.path), ["/", "/service", "/start"]);
    const asked = requests.slice(requestsBefore).find(row => row.body.includes("Make the first step shorter."));
    assert.ok(asked, "The Operator's Note reached Core's revision request");
    assert.match(asked.body, /Operator note\. On the/, "with the block it is attached to");
    assert.ok(revised.pages.find(page => page.path === "/service")!.sections[0].heading.endsWith("(edited by the Operator)"));
    // Only the noted section changed; the rest of the page is exactly as the Operator reviewed it.
    const startBefore = view.pages.find(page => page.path === "/start")!, startAfter = revised.pages.find(page => page.path === "/start")!;
    const changed = startAfter.sections.flatMap((section, index) => JSON.stringify(section) === JSON.stringify(startBefore.sections[index]) ? [] : [index]);
    assert.equal(changed.length, 1, "exactly one section was revised: " + JSON.stringify(changed));
    assert.deepEqual({ ...startAfter, sections: [], version: 0 }, { ...startBefore, sections: [], version: 0 }, "heading, search text and Actions are unchanged");
    assert.equal(startAfter.version, startBefore.version! + 1, "the Page is its next version because one of its Sections is");
    assert.equal(revised.widerChanges?.length, 1, "Core's suggested wider change is recorded, not made");
    assert.equal(statuses(revised, round.id).C1, "applied", "The approved change is applied once Core has written it");
    // The revision is the next version of the same Sections; the Sections it did not touch keep their versions.
    const homeAfter = revised.pages.find(page => page.path === "/")!;
    assert.equal(homeAfter.id, home.id);
    assert.deepEqual(homeAfter.sections.map(section => section.id), home.sections.map(section => section.id));
    for (const [index, section] of homeAfter.sections.entries()) {
      const before = home.sections[index];
      assert.equal(section.version, workDigest(section) === workDigest(before) ? before.version : before.version! + 1, "Section " + index);
    }
    if (workDigest(homeAfter) === workDigest(home)) assert.equal(homeAfter.version, home.version, "Home's revision was declined: it keeps its version");
    else assert.ok(homeAfter.version! > home.version!);
    const deliveredHome = workflowNativeReviewCandidate(context, revised).candidate.pages.find(page => page.path === "/")!;
    assert.deepEqual([deliveredHome.id, deliveredHome.sections.map(section => section.id)], [home.id, home.sections.map(section => section.id)],
      "WordPress receives the Work products' own identities");

    const factRequest = requests.slice(requestsBefore).find(row => row.name === "presence_workflow_page");
    assert.ok(factRequest?.body.includes("businessFacts"), "Later AI steps receive the fact");
    assert.ok(factRequest?.body.includes('\\"status\\":\\"proposed\\"'), "with its standing");

    // A Client emails changes; the Specialist enters the email. Quoted facts are the Client's word.
    const emailId = randomUUID();
    const email = { id: emailId, from: "owner@c0.example", sentAt: "2026-11-24T09:00:00.000Z",
      text: "Hi, two updates. We now answer enquiries within one working day. Thanks!", facts: [
        { statement: "We now answer enquiries within one working day.", publicUse: true },
        { statement: "Replies are guaranteed within 24 hours.", publicUse: true }] };
    await assert.rejects(workflow.recordClientEmail(context, revised.version, actor, email), /unavailable/,
      "Until the Account lists who speaks for the Client, nobody's email counts");
    // The Principal, as Account Manager, puts the Client's person on the Account's list.
    const principal = { operatorId: "principal", authorityReference: "Dry-run Account Manager" };
    const person = await addClientPerson(setup.pool, context.scope.webPresenceId, { name: "Dry-run owner", email: "Owner@C0.example" }, principal, "Speaks for the business");
    assert.deepEqual([person.email, person.addedBy], ["owner@c0.example", "principal"]);
    await assert.rejects(workflow.recordClientEmail(context, revised.version, actor, { ...email, from: "someone@else.example" }), /unavailable/,
      "Only a person who speaks for the Client can give the Client's word");
    revised = (await workflow.recordClientEmail(context, revised.version, actor, email))!;
    const fromEmail = revised.facts!.filter(fact => fact.source === "client-email:" + emailId);
    assert.deepEqual(fromEmail.map(fact => [fact.status, fact.said.kind]), [["confirmed", "client"], ["proposed", "specialist"]],
      "The Client's own words are Confirmed; the Specialist's rewording stays Proposed");
    const emailRequest = revised.changes!.requests.find(item => item.id === emailId + ":email")!;
    assert.deepEqual([emailRequest.origin.kind, emailRequest.origin.channel, emailRequest.origin.enteredBy?.id], ["customer", "email", actor.id]);
    assert.equal(revised.clientStatements!.at(-1)!.text, email.text, "The email is kept as Evidence");
    const known = await readMyBusiness(setup.pool, context.scope.webPresenceId);
    assert.ok(known.facts.some(item => item.value === email.facts[0].statement && item.source === "customer"), "My Business shows the Client's confirmed fact");
    assert.equal(known.proposed.length, 2);
    assert.deepEqual((await workflow.recordClientEmail(context, revised.version - 1, actor, email))!.version, revised.version, "Entering it twice is the same as once");
    // Someone removed from the list no longer speaks for the Client; what they said before stays.
    assert.deepEqual(await removeClientPerson(setup.pool, context.scope.webPresenceId, person.id, principal, "Left the business"), []);
    await assert.rejects(workflow.recordClientEmail(context, revised.version, actor, { ...email, id: randomUUID() }), /unavailable/);
    assert.deepEqual((await clientPeople(setup.pool, context.scope.webPresenceId)), []);
    const readded = await addClientPerson(setup.pool, context.scope.webPresenceId, { name: "Dry-run owner", email: "owner@c0.example" }, principal, "Back in the business");
    assert.equal(readded.id, person.id, "Added again, the same Person keeps their history");

    // The Client answers the Proposed facts in My Business: their word settles each one.
    const clientPerson = { id: "owner@c0.example", role: "customer", simulated: false } as const;
    const [reviewFactKey, rewordedKey] = known.proposed.map(item => item.key);
    const answer = (response: string, key: string, extra: object = {}) => ({ requestId: randomUUID(), key, response, ...extra });
    await assert.rejects(workflow.reviewFact(context, revised.version, answer("confirm", reviewFactKey), actor), /unavailable/,
      "A Specialist cannot confirm on the Client's behalf");
    const corrected = answer("correct", reviewFactKey, { wording: "Open weekdays from 9." });
    revised = (await workflow.reviewFact(context, revised.version, corrected, clientPerson))!;
    assert.equal((await workflow.reviewFact(context, revised.version - 1, corrected, clientPerson))!.version, revised.version, "Answering twice is the same as once");
    revised = (await workflow.reviewFact(context, revised.version, answer("decline", rewordedKey), clientPerson))!;
    const settled = await readMyBusiness(setup.pool, context.scope.webPresenceId);
    assert.equal(settled.proposed.length, 0, "Nothing waits for the Client now");
    assert.ok(settled.facts.some(item => item.value === "Open weekdays from 9." && item.source === "customer"), "The Client's wording is the Fact");
    assert.ok(!revised.facts!.some(item => item.key === rewordedKey), "A Fact the Client says is not true leaves Knowledge");
    assert.deepEqual(revised.facts!.find(item => item.key === reviewFactKey)!.said.kind, "client");
    const followUp = accountTasks(context.intakeId, revised, "2026-11-24T14:00:00.000Z").filter(task => task.id.includes(":request:"));
    assert.ok(followUp.some(task => /not true[^]*Revise any copy/.test(task.what)), "Revising copy that relied on it is waiting as a Task");

    // The next delivery replaces exactly what Core read back, answers and resolves the Notes, and
    // retires the Review summary page.
    const third = await deliverReviewDraft({ config, context, view: revised, state: summaryDelivery.state, fetcher });
    assert.equal(third.state.revision, 4);
    assert.ok(!third.receipt.posts.some(post => post.path === "/review-summary"));
    const after = await readBackOperatorSite(config, fetcher);
    assert.deepEqual(after.summary.editedPages, [], "WordPress now holds Core's delivery, including the Operator's wording");
    assert.equal(after.summary.openNotes.length, 0);
    const resolved = new Map(after.summary.resolvedNotes.map(item => [item.id, item.replies[0]?.text ?? ""]));
    assert.match(resolved.get(501)!, /revised the section this note is on/);
    assert.match(resolved.get(501)!, /suggests a wider change, not made: The Home page/);
    assert.ok(after.readback.pages.find(page => page.path === "/service")!.content!.includes("(edited by the Operator)"));

    // Second round: a Note asking for a page the site does not have (owner request, Nov 24).
    const serviceBlock = workflowNativeReviewCandidate(context, revised).candidate.pages.find(page => page.path === "/service")!.sections[0].id;
    wordpress({ mode: "operator", edits: { "/service": ['{"metadata":{"mio":"' + serviceBlock, '{"metadata":{"noteId":[701],"mio":"' + serviceBlock] },
      notes: [{ id: 701, path: "/service", text: "New page: a Contact page that tells people how to reach us." }] });
    const round2 = await readBackOperatorSite(config, fetcher);
    const asking = operatorFeedback(context, revised, round2.readback);
    revised = (await workflow.applyOperatorReview(context, revised.version, actor, asking))!;
    assert.deepEqual(revised.reviewRounds!.at(-1)!.pageNotes, [{ id: 701, path: "/service", request: "a Contact page that tells people how to reach us." }]);
    assert.deepEqual(revised.reviewRounds!.at(-1)!.noteRevisions, [], "A page request is not a revision of the page it sits on");
    revised = (await workPresenceCase(workflow, context))!;
    assert.equal(revised.failure, null, JSON.stringify({ failure: revised.failure, issue: (revised as { artifactIssue?: unknown }).artifactIssue }));
    const proposedRound = revised.reviewRounds!.at(-1)!;
    assert.deepEqual(proposedRound.analysis!.newPages!.map(page => [page.id, page.path, page.label]), [["P1", "/contact", "Contact"]],
      "A proposal at a path the site already has is left out");
    assert.equal(proposedRound.analysisNotes?.refusedPages, 1);
    assert.deepEqual(proposedRound.analysis!.revisions.map(item => [item.path, item.indexes, item.source, item.newPageIds]), [["/", [1], "page", ["P1"]]]);
    const summary2 = reviewSummaryPage(context, revised)!;
    const pageItem = summary2.page.sections.findIndex(section => section.content.heading.startsWith("New page P1: Contact (/contact)"));
    assert.ok(pageItem > 0, "The Review summary shows the proposed page");
    const summary2Delivery = await deliverReviewDraft({ config, context, view: revised, state: third.state, fetcher });
    const reopened = await readBackOperatorSite(config, fetcher);
    assert.deepEqual(reopened.summary.openNotes.map(item => item.id), [701], "Round-1 notes on the Review summary are answered and closed");
    assert.ok(reopened.summary.resolvedNotes.some(item => item.id === 602 && /approved/.test(item.replies[0]?.text ?? "")));
    const note2 = (id: number, section: number, text: string) => wordpress({ mode: "operator",
      edits: { "/review-summary": ['{"metadata":{"mio":"' + summary2.page.sections[section].id, '{"metadata":{"noteId":[' + id + '],"mio":"' + summary2.page.sections[section].id] },
      notes: [{ id, path: "/review-summary", text }] });
    note2(702, pageItem, "Also say we reply within two working days.");
    note2(703, 0, "Approve");
    revised = (await decideFromWordPress((await readBackOperatorSite(config, fetcher)).readback, revised))!;
    assert.deepEqual(roundOutcome(revised.changes!, proposedRound.id).pagesAdded, ["/contact"]);
    // "Add a page" is a Change of the new-page grain, approved with the Operator's addition.
    const p1 = revised.changes!.changes.find(change => change.id === proposedRound.id + ":P1")!;
    assert.deepEqual([p1.target, p1.status, p1.reviews.map(entry => [entry.response, entry.words])],
      [{ grain: "new-page", path: "/contact", name: "Contact" }, "applied", [["approve", "Also say we reply within two working days."]]]);
    assert.deepEqual(statuses(revised, proposedRound.id), { P1: "applied", C1: "approved" });
    assert.ok(revised.blueprint!.navigation.includes("/contact"), "The new page is in the menu");
    const sentBeforePage = requests.length;
    for (let step = 0; step < 6 && revised.pages.length < 4; step++) revised = (await workPresenceCase(workflow, context))!;
    assert.equal(revised.failure, null, JSON.stringify({ failure: revised.failure, next: revised.next, issue: (revised as { artifactIssue?: unknown }).artifactIssue }));
    assert.deepEqual(revised.pages.map(page => page.path), ["/", "/service", "/start", "/contact"]);
    const pageRequest = requests.slice(sentBeforePage).find(row => row.body.includes('"enum":["/contact"]'));
    assert.ok(pageRequest, "Core wrote the new page");
    assert.match(pageRequest.instructions, /asked for this Page to be added/);
    assert.ok(pageRequest.body.includes("reply within two working days"), "with the Operator's addition from the Review summary");
    assert.ok(!/act on the Operator's review/.test(pageRequest.instructions), "A new page is written, not revised");
    const fourth = await deliverReviewDraft({ config, context, view: revised, state: summary2Delivery.state, fetcher });
    assert.deepEqual(fourth.receipt.posts.map(post => post.path), ["/", "/service", "/start", "/contact"]);
    const after2 = await readBackOperatorSite(config, fetcher);
    assert.deepEqual(after2.summary.editedPages, []);
    assert.equal(after2.summary.openNotes.length, 0);
    const replies2 = new Map(after2.summary.resolvedNotes.map(item => [item.id, item.replies[0]?.text ?? ""]));
    assert.match(replies2.get(701)!, /added the page "Contact" \(\/contact\)/);
    const recorded = revised.wordpressReviews!.at(-1)!.notes.filter(note => note.path === "/review-summary").map(note => [note.id, note.reply]);
    assert.deepEqual(recorded.map(([id]) => id), [702, 703], "Notes answered in round 1 are not read again");
    assert.match(String(recorded[0][1]), /include this when it writes the page/);
    const thirdState = fourth;

    // The cycle closes at its exact places, with labelled Beacons where pieces are unbuilt:
    // Delivery → Observation → Request → Decision ("watch"), and the work waiting shows as Tasks in the Queue.
    const observed = observeDelivery(revised.changes!, { account: context.intakeId, at: "2026-11-24T13:00:00.000Z", version: revised.version });
    assert.match(observed.observation.beacon!, /^Beacon:/);
    assert.deepEqual(timeline(observed.ledger).filter(item => item.id.startsWith(observed.observation.id)).map(item => [item.what, item.by.role]), [["request", "core"], ["decision", "core"]]);
    assert.equal(observed.ledger.decisions.at(-1)!.outcome, "watch");
    assert.equal(observed.ledger.changes.length, revised.changes!.changes.length, "Watching proposes no Change");
    const open = queue(accountTasks(context.intakeId, { ...revised, changes: observed.ledger }, "2026-11-24T13:00:00.000Z"));
    assert.ok(open.length > 0 && open.every(task => /^Beacon:/.test(task.beacon)), "Every waiting Task is shown, and labelled a Beacon");

    // A change the Operator makes after Core took the review in is never overwritten unread.
    wordpress({ mode: "operator", edits: { "/": ["</h1>", " again</h1>"] } });
    await assert.rejects(deliverReviewDraft({ config, context, view: revised, state: thirdState.state, fetcher }), /must be taken into Core/);
    if (process.env.MIOPAGES_DRY_RUN_EXPORT) await writeFile(process.env.MIOPAGES_DRY_RUN_EXPORT,
      JSON.stringify({ review, home: php.stdout, requests: requests.map(row => row.name) }, null, 2));
  } finally {
    await rm(root, { recursive: true, force: true });
    await setup.stop();
  }
});
