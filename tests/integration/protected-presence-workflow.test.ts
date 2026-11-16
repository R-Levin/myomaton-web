import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { readFile, rm, mkdir, mkdtemp, realpath, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import type { Pool } from "pg";
import { createC0Onboarding } from "../../scripts/intake/c0-onboarding";
import { readRetainedC0 } from "../../scripts/intake/retained-c0";
import { prepareC0 } from "../../scripts/intake/adaptive-sources";
import { IntakeService } from "../../lib/platform/intake/service";
import { c0DisclosureManifest } from "../../lib/platform/intake/c0-workflow-knowledge";
import { c0ActivationGrant, c0HostedRunGrant } from "../../lib/platform/intake/c0-workflow-activation";
import { fingerprint } from "../../lib/platform/canonical/model";
import { initializeResponsesUsageLedger } from "../../lib/platform/intake/intelligent-responses";
import { presenceVisualPlacement, presenceVisualRequest } from "../../lib/platform/intake/presence-workflow-visual";
import { openAIImageProvider } from "../../lib/platform/acquisition/openai";
import type { PageProposal } from "../../lib/platform/content-editing/proposal";
import { workflowDeliveryInput } from "../../lib/platform/intake/presence-workflow-delivery";
import { nativeDraftEnvelope } from "../../lib/platform/wordpress-delivery/native-draft-envelope";
import { prepareNativeDraftMedia } from "../../lib/platform/wordpress-delivery/native-draft-media";
import { bindSiteDraft } from "../../lib/platform/wordpress-delivery/site-draft";
import { verifyNativeDraftReceipt } from "../../lib/platform/wordpress-delivery/native-draft-receipt";
import type { PresenceWorkflowView, WorkflowContext, PresenceWorkflow } from "../../lib/platform/intake/presence-workflow";
import { composePresenceCase, recoverRetainedPresenceOutput, reviewWorkflowChange, workPresenceCase } from "../../lib/platform/intake/protected-presence-workflow";
import type { PresenceWorkflowGrant } from "../../lib/platform/intake/presence-workflow-provider";
import { publicResearchAddress } from "../../lib/platform/intake/presence-workflow-egress";

async function proveProvisionalImage(context: WorkflowContext, start: PresenceWorkflowView, root: string,
  reopen: () => Promise<PresenceWorkflow>, calls: () => number) {
  let view = start;
  const selection = presenceVisualPlacement(context, view, "/", 0);
  assert.throws(() => presenceVisualPlacement({ ...context, intakeId: randomUUID() }, view, "/", 0), /reviewed website/);
  assert.throws(() => presenceVisualPlacement(context, view, "/", 99), /needs an image/);
  const author = { id: "test-placement-author", role: "operator", simulated: false, authority: "prepare-fixture" } as const;
  const reviewer = { id: "test-visual-reviewer", role: "operator", simulated: false, authority: "review-fixture" } as const;
  let worker = await reopen();
  assert.equal(start.visuals?.length, 0);
  await assert.rejects(worker.queueVisual(context, view.version, { ...author, authority: undefined }, "/", 0, "concept"), { code: "unavailable" });
  await assert.rejects(worker.queueVisual(context, view.version, author, "/", 0, "unapproved"), { code: "workflow_not_ready" });
  view = (await worker.queueVisual(context, view.version, author, "/", 0, "concept"))!;
  await assert.rejects(worker.queueVisual(context, view.version, author, "/", 0, "concept"), { code: "workflow_not_ready" });
  view = (await worker.queueVisual(context, view.version, author, "/", 1, "concept"))!;
  assert.equal(calls(), 0);
  worker = await reopen();
  view = (await workPresenceCase(worker, context))!;
  view = (await workPresenceCase(worker, context))!;
  assert.deepEqual(view.visuals?.map(item => item.state), ["review", "review"]);
  assert.equal(calls(), 2);
  const unresolved = view.visuals![0];
  const master = await worker.visualImage(context, unresolved.id);
  assert.equal((await sharp(master).metadata()).width, 1536);
  await assert.rejects(worker.visualImage({ ...context, intakeId: randomUUID() }, unresolved.id), { code: "unavailable" });
  const review = (visual: NonNullable<PresenceWorkflowView["visuals"]>[number], decision = "approved") => ({
    id: visual.id, provenanceDigest: visual.result!.provenanceDigest, decision, alt: "Illustration for Section " + visual.placement.sectionIndex,
    reference: "Offline exact private-use decision",
  });
  await assert.rejects(worker.decideVisual(context, view.version, reviewer, { ...review(unresolved), provenanceDigest: "0".repeat(64) }),
    { code: "workflow_not_ready" });
  for (const visual of view.visuals!) view = (await worker.decideVisual(context, view.version, reviewer, review(visual)))!;
  assert.deepEqual(view.visuals?.map(item => item.state), ["approved", "approved"]);
  worker = await reopen();
  assert.deepEqual(await worker.review(context), view);
  assert.equal(calls(), 2);
  const scope = { ...context.scope, organizationId: randomUUID() };
  const project = (path: string) => {
    const page = view.pages.find(item => item.path === path)!;
    return { id: randomUUID(), path, title: page.heading,
      ...(page.composition && { composition: page.composition, navigationLabel: view.blueprint!.pages.find(item => item.path === path)!.label }),
      sections: page.sections.map(section => ({
      id: randomUUID(), type: section.role ?? "intro", content: { heading: section.heading, text: section.body },
    })) };
  };
  const home = project("/"), service = project("/service");
  const editorial = (text: string) => ({ kind: "editorial" as const, text, rationale: "Reviewed test selection" });
  const input: PageProposal = { pageId: home.id, slug: "/", operation: "create-page", title: editorial(home.title), purpose: "Verify protected placement",
    workflowReview: { intakeId: context.intakeId, candidateDigest: view.operatorReview!.target },
    ...(home.composition && { composition: home.composition, navigationLabel: home.navigationLabel }),
    sections: home.sections.map((section, index) => {
      const approved = view.visuals!.find(item => item.placement.sectionIndex === index);
      return { id: section.id, type: section.type, heading: editorial(section.content.heading), text: editorial(section.content.text),
        ...(approved && { image: { ...approved.association!, altText: approved.decision!.alt! } }) };
    }) };
  const candidate = { title: home.title, sections: home.sections.map(section => ({
    ...section, variant: "stack", name: section.content.heading, configuration: {},
  })) };
  const resolve = worker.privateVisualResolver(context);
  const eligible = await resolve(context.scope, input, candidate);
  assert.equal(eligible.media.length, 2);
  assert.ok(eligible.media.every(media => media.evidence.permission === "non-public-draft-only"));
  await assert.rejects(resolve(context.scope, { ...input, workflowReview: { ...input.workflowReview!, intakeId: randomUUID() } }, candidate), /protected visual review/);
  const edited = structuredClone(candidate);
  edited.sections[0].content.text += " Changed after image review.";
  await assert.rejects(resolve(context.scope, input, edited), /copy changed/);
  const [imageCopy, second] = await Promise.all(eligible.media.map(media => prepareNativeDraftMedia(root, selection.owner, home.id, media)));
  assert.notEqual(imageCopy.descriptor.usageId, second.descriptor.usageId);
  const prepared = workflowDeliveryInput(context, view, [{ id: home.id, path: "/" }, { id: service.id, path: "/service" }], []);
  assert.equal(prepared.pages.length, 5);
  assert.equal(prepared.pages.find(page => page.slug === "/")?.pageId, home.id);
  assert.equal(prepared.pages.find(page => page.slug === "/")?.sections.filter(section => section.image).length, 2);
  assert.ok(prepared.pages.every(page => page.workflowReview?.candidateDigest === view.operatorReview?.target));
  const member = (page: typeof home) => ({ ...scope, proposalId: randomUUID(), revision: 1,
    approvalId: fingerprint("fixture approval " + page.path), previewDigest: fingerprint("fixture preview " + page.path),
    sourceDigest: view.contextDigest, projectionDigest: fingerprint([page]), pages: [page] });
  const installationId = randomUUID(), siteProposalId = randomUUID();
  const draftSelection = { siteProposalId, installationId, navigation: ["/", "/service"],
    actions: [{ id: randomUUID(), from: "/", destination: "/service", type: "page", label: "Explore the service" }] };
  const homeReview = member(home), serviceReview = member(service);
  const baseline = bindSiteDraft(scope, [homeReview, serviceReview], { ...draftSelection, revision: 1, previousDigest: null });
  const draft = bindSiteDraft(scope, [{ ...homeReview, media: [imageCopy.descriptor] }, serviceReview],
    { ...draftSelection, revision: 2, previousDigest: baseline.digest });
  assert.equal(draft.candidate.media?.[0].copyDigest, createHash("sha256").update(imageCopy.bytes).digest("hex"));
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyBase64 = Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url").toString("base64");
  const envelope = nativeDraftEnvelope(draft, "test-key", publicKeyBase64, privateKey, "apply");
  assert.equal(envelope.version, 3);
  const secret = randomBytes(32);
  const php = spawnSync("php", ["wordpress/miopages-delivery/tests/native-draft-media.php"], { encoding: "utf8", input: JSON.stringify({
    identity: { ...scope, installationId, keyId: "test-key", publicKeyBase64 }, envelope,
    baseline: nativeDraftEnvelope(baseline, "test-key", publicKeyBase64, privateKey, "apply"),
    restore: nativeDraftEnvelope(draft, "test-key", publicKeyBase64, privateKey, "restore"),
    bytes: imageCopy.bytes.toString("base64"), secret: secret.toString("hex"),
  }) });
  assert.equal(php.status, 0, php.stderr);
  const { wire, posix } = JSON.parse(php.stdout.trim());
  if (process.platform !== "win32") assert.equal(posix, true, "POSIX custody and native attachment rollback must be exercised");
  const expected = { installationId, siteProposalId, operation: "apply" as const, requestedDigest: draft.digest,
    appliedDigest: draft.digest, revision: 2, paths: ["/", "/service"], pageIds: [home.id, service.id], media: [imageCopy.descriptor] };
  const receipt = verifyNativeDraftReceipt(wire, secret, expected);
  assert.ok(receipt.attachments?.[0].id);
  assert.equal(receipt.attachments[0].postId, receipt.posts[0].id);
  assert.throws(() => verifyNativeDraftReceipt(wire, secret, { ...expected, pageIds: [service.id, home.id] }), /placement/);
  assert.throws(() => verifyNativeDraftReceipt(wire, secret, { ...expected, media: [] }), /authorization/);
  view = (await worker.decideVisual(context, view.version, reviewer, review(view.visuals![0], "revoked")))!;
  await assert.rejects(worker.visualImage(context, view.visuals![0].id), { code: "unavailable" });
  await assert.rejects(resolve(context.scope, input, candidate), /approved private image placements/);
  assert.equal(calls(), 2);
  return view;
}

const readSql = (file: string) => readFile(new URL("../../lib/platform/intake/" + file, import.meta.url), "utf8");

test("restricted Core worker discovers research, retains a substantial provider-shaped site and revises one flagged page", async () => {
  const bin = process.env.PG_BIN_DIR ?? "C:/Program Files/PostgreSQL/18/bin";
  const setup = await createC0Onboarding(bin, true);
  const ledgerDirectory = await mkdtemp(join(await realpath(tmpdir()), "miopages-protected-workflow-proof-"));
  const ledgerFile = join(ledgerDirectory, "onboarding-usage.json");
  try {
    const retainedPath = process.env.MIOPAGES_LOCAL_WORKFLOW_RETAINED;
    const input = retainedPath ? await readRetainedC0(retainedPath) : { answers: {}, provenance: {}, prepared: await prepareC0() };
    if (!retainedPath) {
      // Generic CI has no access to protected artifacts. These two placeholders
      // stand in for them here only; the handoff proof also runs with the exact saved copy.
      if (!input.prepared.sources.some(s => s.kind === "Earlier Review answer")) {
        input.prepared.sources.push({ id: "review-answers", title: "Test Review answers", kind: "Earlier Review answer",
          reference: "Test-only Review", detail: "Placeholder", entries: [{ label: "Offer", value: "Test source" }] });
      }
      if (!input.prepared.sources.some(s => s.kind === "Earlier Review assessment")) {
        input.prepared.sources.push({ id: "review-assessment", title: "Test Review assessment", kind: "Earlier Review assessment",
          reference: "Test-only assessment", detail: "Placeholder", entries: [{ label: "Observation", value: "Test source" }] });
      }
    }
    const { webPresenceId, managedSiteId } = setup.selection;
    const database = (await setup.pool.query("SELECT current_database() AS name")).rows[0].name as string;
    const intake = new IntakeService(setup.pool, setup.selection, { database, ...input });
    const token = "ab".repeat(32);
    await intake.create(token, "DIRECT_START");
    const approvedIntake = (await intake.workflowContext(token)).intakeId;
    await new IntakeService(setup.pool, setup.selection).create("cd".repeat(32), "FREE_REVIEW");
    await new IntakeService(setup.pool, setup.selection).create("ef".repeat(32), "DIRECT_START");
    await setup.pool.query(`
      CREATE ROLE miopages_core_development;
      CREATE SCHEMA miopages_wp;
      CREATE VIEW miopages_wp.core_development_drafts AS SELECT * FROM public.prospect_intakes
        WHERE web_presence_id='${webPresenceId}' AND managed_site_id='${managedSiteId}' AND entry_intent='DIRECT_START';
      GRANT USAGE ON SCHEMA miopages_wp TO miopages_core_development;
      GRANT SELECT ON miopages_wp.core_development_drafts TO miopages_core_development;
      BEGIN;
      CREATE SCHEMA miopages_core_workflow;
      SET LOCAL search_path=miopages_core_workflow,public;
      SET LOCAL miopages.workflow_intake='${approvedIntake}';
      ${await readSql("presence-workflow.sql")}
      ${await readSql("protected-presence-workflow-policy.sql")}
      COMMIT;
    `);
    const rates = { model: "gpt-5.4-mini-2026-03-17", verifiedOn: "2026-11-15", countMicros: 0,
      inputPerMillion: 750_000, outputPerMillion: 4_500_000, cachedPerMillion: 75_000, cacheWritePerMillion: 0 };
    await initializeResponsesUsageLedger(ledgerDirectory, rates);
    const visualDirectory = join(ledgerDirectory, "private-master");
    await mkdir(visualDirectory, { mode: 0o700 });
    const workspace = { root: ledgerDirectory, grantFile: join(ledgerDirectory, "unused-test-grant.json"), ledgerDirectory, visualDirectory };
    const png = await sharp({ create: { width: 1536, height: 1024, channels: 3, background: "#6843cf" } }).png().toBuffer();
    const safePrompt = "An abstract illustration of organized information and continuing care";
    let imageCalls = 0;
    const imageProvider = openAIImageProvider({ key: "offline-only", model: "gpt-image-2.5-sunburst-2026-09-08",
      transport: async (url, init) => {
        assert.equal(url, "https://api.openai.com/v1/images/generations");
        const body = JSON.parse(String(init?.body));
        assert.equal(body.prompt, presenceVisualRequest(safePrompt).prompt);
        imageCalls++;
        return new Response(JSON.stringify({ data: [{ b64_json: png.toString("base64") }] }), { headers: { "x-request-id": "img_offline" } });
      },
    });
    const client = await setup.pool.connect();
    try {
      await client.query("SET ROLE miopages_core_development");
      const restricted = { query: client.query.bind(client) } as unknown as Pool;
      const fetches: string[] = [], passes: string[] = [];
      let audits = 0;
      let reportAttempts = 0;
      let searchRequests = 0;
      let missingMarketRead = true;
      const composition = composePresenceCase(restricted, intake, token, workspace, { kind: "offline-test", rates, imageProvider,
        readGrant: async () => grant,
        async fetchPage(url, init) {
          assert.equal(init?.redirect, "error");
          fetches.push(String(url));
          if (missingMarketRead && String(url) === "https://public-example.com/offer") throw Error("Simulated public endpoint unavailability");
          const links = '<a href="/services/maintenance">Maintenance service</a> <a href="/login">Login</a> <a href="https://outside.example/">External</a>';
          const response = new Response("<main>Retained public evidence for tests. " + (fetches.length === 1 ? links : "") + "</main>",
            { headers: { "content-type": "text/html" } });
          Object.defineProperty(response, "url", { value: url });
          return response;
        },
        transport: { async send(route, raw) {
          if (route.endsWith("input_tokens")) return { body: { input_tokens: 9600 } };
          const request = raw as { store: boolean; input: string; text?: { format: { name: string } };
            max_tool_calls?: number; tools?: unknown; include?: unknown };
          assert.equal(request.store, false);
          if (!request.text) {
            searchRequests++;
            assert.equal(request.input, "managed website services for small businesses, buying considerations and trust");
            assert.deepEqual(request.tools, [{ type: "web_search" }]);
            assert.deepEqual(request.include, ["web_search_call.action.sources"]);
            assert.equal(request.max_tool_calls, 2);
            const body = { id: "resp_recorded_search", model: rates.model, status: "completed", service_tier: "default",
              usage: { input_tokens: 3000, input_tokens_details: { cached_tokens: 0 }, output_tokens: 60,
                output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 3060 },
              output: [{ type: "web_search_call", status: "completed", action: { sources: [
                { type: "url", url: "https://research-source.com/guide" },
                { type: "url", url: "https://www.research-source.com/repeated" },
                { type: "url", url: "https://public-example.com/offer" },
                { type: "url", url: "https://127.0.0.1/refuse" },
                { type: "url", url: "https://credential-example.com/trace?ignored=yes" },
              ] } }] };
            return { body, rawBody: Buffer.from(JSON.stringify(body)) };
          }
          const input = JSON.parse(request.input);
          const names = input.evidence.map((entry: { id: string }) => entry.id);
          assert.ok(!names.includes("intake:destinations"));
          assert.ok(input.research.some((item: { discoveredFrom?: string }) => item.discoveredFrom));
          const source = input.evidence.find((evidence: { kind: string }) => evidence.kind === "owner-confirmed").id;
          const cited = { sourceIds: [source] };
          const passages = (prefix: string, count = 8) => Array.from({ length: count }, (_, index) =>
            prefix + " " + index + " checks that responsive and independently reviewable artifact content survives database storage, exact readback and replacement.").join(" ");
          const paths = ["/", "/service", "/handoff", "/new-site", "/ongoing"];
          const pass = request.text.format.name.replace("presence_workflow_", "");
          passes.push(pass + (input.pagePath ?? ""));
          let output;
          switch (pass) {
            case "report":
              reportAttempts++;
              output = { title: "Recorded provider-schema test report", summary: passages("Customer-readable block"),
                findings: Array.from({ length: 12 }, (_, index) => ({
                  id: "finding-" + index, heading: "Evidence block " + index, body: passages("Interpretation for evidence block " + index),
                  status: index === 0 ? "established" : "proposed",
                  sourceIds: reportAttempts === 1 ? ["unapproved-source"] : [source],
                })) };
              break;
            case "direction": output = { positioning: "Integration-test position", approach: passages("Direction"), visitorDecisions: ["Test intent"], ...cited }; break;
            case "blueprint": output = { pages: paths.map(path => ({ path, label: "Proof " + path, purpose: "Verify generated shape", ...cited })), navigation: paths,
              articles: [{ title: "Illustrative Article label", question: "What should be in the result?", target: "/ongoing", ...cited }] }; break;
            case "page": output = { composition: "managed-v1", path: input.pagePath, heading: "Draft " + input.pagePath, searchTitle: "Scope proof", searchDescription: "Recorded provider response shape",
              sections: Array.from({ length: 6 }, (_, index) => ({
                role: index === 0 ? "hero" : index === 5 ? "cta" : "intro",
                heading: "Block " + index, body: passages(input.previous ? "Editorial revision" : "Initial draft"), ...cited,
                visual: { purpose: "Explain", brief: "Use a text diagram", status: "asset-needed", altIntent: "Explain the steps in text" },
              })), actions: [{ label: "Read more", kind: "navigate", destination: input.pagePath === "/" ? "/service" : "/", sectionIndex: 0 },
                { label: "Contact", kind: "request-contact", destination: null, sectionIndex: 5 }], internalLinks: [input.pagePath === "/" ? "/service" : "/"] }; break;
            case "editorial":
              output = { summary: "Editorial format proof", concerns: audits++ === 0 ? [{ path: "/service", concern: "Rewrite one repeated explanation" }] : [] }; break;
            default: assert.fail("Unexpected pass");
          }
          const body = { id: "resp_recorded_" + passes.length, model: rates.model, status: "completed", service_tier: "default",
            usage: { input_tokens: 9500, input_tokens_details: { cached_tokens: 0 }, output_tokens: 500,
              output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 10000 },
            output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(output) }] }] };
          return { body, rawBody: Buffer.from(JSON.stringify(body)) };
        } },
      });
      const context = await composition.context();
      const manifest = c0DisclosureManifest(context);
      assert.ok(manifest.approvedSourceCandidates.length >= 14);
      if (retainedPath) {
        assert.equal(context.evidence.filter(item => item.kind === "customer-unconfirmed").length, 10);
        const planPath = new URL("../../docs/c0-protected-workflow-authorization.json", import.meta.url);
        const proposal = JSON.parse(await readFile(planPath, "utf8"));
        const ledger = Buffer.from(JSON.stringify({ attempts: [{ status: "uncertain", reservedMicros: 8_400, countDispatched: true, generationDispatched: true }] }));
        proposal.existingLedger = { attempts: 1, digest: createHash("sha256").update(ledger).digest("hex") };
        const bytes = Buffer.from(JSON.stringify(proposal));
        const hash = createHash("sha256").update(bytes).digest("hex");
        assert.equal(c0ActivationGrant(context, bytes, hash, ledger).approvedSources.length, 20);
        assert.throws(() => c0ActivationGrant(context, bytes, "0".repeat(64), ledger), /exact owner-reviewed manifest/i);
        assert.throws(() => c0ActivationGrant(context, bytes, hash, Buffer.from("{}")), /baseline|attempts/i);
        const newPlan = {
          schema: "miopages.c0-hosted-presence/2", scope: context.scope,
          sourceEvidence: { contextDigest: manifest.contextDigest, exactCandidates: proposal.sourceEvidence.exactCandidates.map(
            ({ id, digest }: { id: string; digest: string }) => ({ id, digest })), approvedCorrections: [] },
          existingLedger: { digest: createHash("sha256").update(ledger).digest("hex"), attempts: 1,
            uncertainReservation: fingerprint(JSON.parse(ledger.toString("utf8")).attempts[0]), uncertainMicros: 8_400 },
          provider: { model: rates.model, store: false, automaticRetries: 0, requests: 60, generations: 30, maxInputTokens: 64_000,
            maxInputBytes: 320_000, maxOutputTokens: 20_000, additionalCapMicros: 20_000_000, maxRetries: 2, maxEditorialRevisions: 3 },
          research: { roots: [{ id: "research:seed", url: "https://example.org/", label: "Market reference" }],
            market: { publicQuery: "small business website management and service buying considerations", maxToolCalls: 4, maxSources: 10, minimumNewOrigins: 3 },
            maxSourceBytes: 450_000 },
          images: { model: imageProvider.model, briefs: [{ id: "concept", label: "Concept illustration", prompt: safePrompt }] },
          rollout: { commit: "0".repeat(40), artifactSha256: "0".repeat(64), wordpressOrigin: "https://miopages.org",
            wordpressPluginSha256: "0".repeat(64), coreOrigin: "https://wp-acceptance.miopages.com", siteProposalId: randomUUID(),
            installationId: randomUUID(), privateOnly: true, retentionDays: 30, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            policy: { workflowSqlSha256: "0".repeat(64), rolePolicySha256: "0".repeat(64) },
            rollback: { materializedRevision: 3, highWater: 5, materializedDigest: "0".repeat(64), highWaterDigest: "0".repeat(64),
              pages: [{ path: "/", id: randomUUID(), wordPressId: 13, slug: "home", sha256: "0".repeat(64) }] } },
        };
        const proposed = Buffer.from(JSON.stringify(newPlan));
        const proposedDigest = createHash("sha256").update(proposed).digest("hex");
        assert.equal(c0HostedRunGrant(context, proposed, proposedDigest, ledger).ledger.capMicros, 20_000_000);
        assert.throws(() => c0HostedRunGrant(context, proposed, hash, ledger), /exact owner-reviewed/i);
        assert.throws(() => c0HostedRunGrant(context, proposed, proposedDigest, Buffer.from("{}")), /ledger changed/i);
        assert.throws(() => c0HostedRunGrant({ ...context, intakeId: randomUUID() }, proposed, proposedDigest, ledger), /projection differs/i);
      }
      const grant: PresenceWorkflowGrant = {
        contextDigest: manifest.contextDigest, approvedSources: manifest.approvedSourceCandidates.map(source => source.digest),
        approvedCorrections: [], maxRetries: 1, maxEditorialRevisions: 1, maxOutputTokens: 12_000, siteComposition: "managed-v1",
        images: { model: imageProvider.model, briefs: [{ id: "concept", label: "Concept illustration", prompt: safePrompt }] }, expiresAt: Date.now() + 180_000,
        researchSources: [{ id: "research:competitor", url: "https://example.org/", label: "Market reference" }],
        marketSearch: { publicQuery: "managed website services for small businesses, buying considerations and trust",
          maxToolCalls: 2, maxSources: 4, minimumNewOrigins: 2 },
        researchResponseBytes: 12_000, ledger: { id: fingerprint("offline-only grant"), baselineAttempts: 0,
          startingLedger: createHash("sha256").update(await readFile(ledgerFile)).digest("hex"),
          requests: 32, generations: 16, capMicros: 1_800_000, inputTokens: 24_000, inputBytes: 120_000 },
      };
      const owner = { id: "test-verified-operator", role: "operator", simulated: false } as const;
      let worker = await composition.open();
      await reviewWorkflowChange(worker, context, "workflow-start", 0, owner);
      let view = (await workPresenceCase(worker, context))!;
      assert.equal(view.failure, "outcome-unknown");
      assert.equal(view.pendingOperation, "research");
      assert.equal(view.recoverable, true);
      missingMarketRead = false;
      worker = await composition.open();
      view = (await recoverRetainedPresenceOutput(worker, context, "research"))!;
      assert.equal(view.next, "report");
      view = (await workPresenceCase(worker, context))!;
      assert.equal(view.failure, "output-invalid");
      assert.equal(view.artifactIssue, "citation");
      const marketUrls = ["https://public-example.com/offer", "https://research-source.com/guide"];
      assert.deepEqual(fetches.slice(0, 2).sort(), marketUrls);
      assert.deepEqual(fetches.slice(2, 4).sort(), marketUrls);
      assert.deepEqual(fetches.slice(4), ["https://example.org/"]);
      const usage = JSON.parse(await readFile(ledgerFile, "utf8"));
      assert.equal(usage.attempts[0].countDispatched, false);
      assert.equal(usage.attempts[0].webSearchCalls, 1);
      assert.equal(usage.attempts[0].reservedMicros, 374_000);
      assert.equal(usage.attempts[0].estimatedMicros, 12_520);
      assert.equal(await workPresenceCase(worker, context).then(v => v?.version), view.version);
      worker = await composition.open();
      view = (await reviewWorkflowChange(worker, context, "workflow-retry", view.version, owner))!;
      assert.equal(view.next, "report");
      view = (await workPresenceCase(worker, context))!;
      assert.equal(view.report?.findings.length, 12);
      assert.equal(view.next, "customer-review");
      view = (await reviewWorkflowChange(worker, context, "workflow-continue", view.version, owner))!;
      assert.equal(view.confirmation?.decision, "development-continuation");
      assert.equal((await (await composition.open()).review(context))?.next, "direction");
      view = (await workPresenceCase(worker, context))!;
      assert.equal(view.next, "editorial-review");
      assert.equal(view.pages.length, 5);
      assert.equal(view.pages[0].composition, "managed-v1");
      assert.deepEqual(view.pages[0].sections.map(section => section.role), ["hero", "intro", "intro", "intro", "intro", "cta"]);
      assert.equal(view.pages[0].actions[0].sectionIndex, 0);
      const prior = view.pages.find(item => item.path === "/service");
      const other = view.pages.find(item => item.path === "/ongoing");
      await assert.rejects(reviewWorkflowChange(worker, context, "workflow-review", view.version, owner), { code: "workflow_not_ready" });
      view = (await reviewWorkflowChange(worker, context, "workflow-revise", view.version, owner))!;
      assert.equal(view.pages.length, 4);
      worker = await composition.open();
      view = (await workPresenceCase(worker, context))!;
      assert.equal(view.next, "operator-review");
      assert.equal(view.pages.reduce((sum, page) => sum + page.sections.length, 0), 30);
      assert.notDeepEqual(view.pages.find(item => item.path === "/service"), prior);
      assert.deepEqual(view.pages.find(item => item.path === "/ongoing"), other);
      assert.equal(passes.filter(item => item === "page/service").length, 2);
      assert.equal(passes.filter(item => item === "page/ongoing").length, 1);
      view = (await reviewWorkflowChange(worker, context, "workflow-review", view.version, owner))!;
      assert.equal(view.next, "review-complete");
      assert.equal(searchRequests, 1);
      view = await proveProvisionalImage(context, view, visualDirectory, composition.open, () => imageCalls);
      assert.deepEqual(await (await composition.open()).review(context), view);
      const { rows: [size] } = await client.query("SELECT count(*)::int AS captured, max(octet_length(bytes)) AS largest FROM miopages_core_workflow.presence_workflow_outputs");
      assert.ok(size.captured >= 12 && size.largest > 10_000);
      await assert.rejects(client.query("DELETE FROM miopages_core_workflow.presence_workflow_outputs"), { code: "42501" });
      const foreign = await new IntakeService(setup.pool, setup.selection).workflowContext("cd".repeat(32));
      await assert.rejects(worker.start({ ...context, intakeId: foreign.intakeId }), { code: "draft_changed" });
      const otherDirect = await new IntakeService(setup.pool, setup.selection).workflowContext("ef".repeat(32));
      await assert.rejects(worker.start({ ...context, intakeId: otherDirect.intakeId }), { code: "42501" });
      assert.equal(publicResearchAddress("127.0.0.1"), false);
      assert.equal(publicResearchAddress("169.254.169.254"), false);
      assert.equal(publicResearchAddress("8.8.8.8"), true);
    } finally { await client.query("RESET ROLE"); client.release(); }
  } finally {
    await setup.stop();
    await rm(ledgerFile, { force: true });
    await rm(join(ledgerDirectory, "private-master"), { recursive: true, force: true });
    await rmdir(ledgerDirectory);
  }
});
