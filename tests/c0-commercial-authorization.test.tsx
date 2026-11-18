import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomUUID } from "node:crypto";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import type { PoolClient } from "pg";
import { managedKey, provisionManagedObject } from "../lib/platform/assets/local-storage";
import { fingerprint } from "../lib/platform/canonical/model";
import { commercialC0Inputs, readC0CommercialProposal, readC0CommercialSourceAmendment } from "../lib/platform/intake/c0-commercial-authorization";
import { commercialApproval, commercialBinding } from "../scripts/intake/commercial-evaluation-activation";
import { confirmSitePlanningReceipt, initializeResponsesUsageLedger, meteredPresenceWorkflow, summarizePresenceWorkflowUsage } from "../lib/platform/intake/intelligent-responses";
import { focusMioPagesPreview } from "../scripts/customer-previews/miopages-focus";
import { createResponsesPresenceWorkflow } from "../lib/platform/intake/presence-workflow-provider";
import { responsesHttps } from "../lib/platform/intake/responses-https";
import { marketResearchQuestions } from "../lib/platform/intake/presence-workflow-research";
import type { WorkflowRun } from "../lib/platform/intake/presence-workflow";
import type { PresenceEvidence } from "../lib/platform/intake/presence-workflow-artifacts";
import { bindSiteDraft } from "../lib/platform/wordpress-delivery/site-draft";
import { readSignedDraftBrand, resolveSignedDraftBrand } from "../lib/platform/wordpress-delivery/draft-brand";
import { nativeDraftEnvelope, readNativeDraftEnvelope } from "../lib/platform/wordpress-delivery/native-draft-envelope";

test("commercial activation preserves the existing reviewer, expiry and exact authorization", () => {
  const artifact = "a".repeat(64);
  const expiresAt = Date.parse("2026-11-19T16:03:51.397Z");
  const startsAt = expiresAt - 36 * 3_600_000;
  const activation = {
    manifestSha256: commercialApproval,
    sourceAmendmentSha256: "169178bb9a8f4a148f0cdb6307389df34a6cc0dee460097856fffc2b4ce2f1fe",
    artifactSha256: artifact,
    innodbProofSha256: "3f9787b162032ff3a4f13cfb5d776b77dc485afd9fd49974aecce2a8547c8e83",
    reviewerAuthorizer: "same-owner-separate-permissions" as const,
    reviewerId: "1a3febb6-5f06-448c-a9b5-77749af82d07",
    reviewerVerifier: "b".repeat(64),
    reviewerExpiresAt: expiresAt,
    startsAt,
  };
  const result = commercialBinding(activation, artifact, startsAt, false);
  assert.equal(result.expiresAt, expiresAt);
  assert.equal(result.independentReviewerId, activation.reviewerId);
  assert.ok(!JSON.stringify(result).includes(activation.reviewerVerifier));
  assert.throws(() => commercialBinding({ ...activation, reviewerId: randomUUID() }, artifact, startsAt, false));
  assert.throws(() => commercialBinding({ ...activation, reviewerExpiresAt: expiresAt + 1 }, artifact, startsAt, false));
  assert.throws(() => commercialBinding(activation, "c".repeat(64), startsAt, false));
  assert.throws(() => commercialBinding(activation, artifact, startsAt - 1, false));
  assert.throws(() => commercialBinding(activation, artifact, expiresAt, false));
  assert.equal(commercialBinding(activation, artifact, expiresAt, true).expiresAt, expiresAt);
});

const sha = (value: Buffer) => createHash("sha256").update(value).digest("hex");
async function currentProposal() {
  const bytes = await readFile("docs/c0-commercial-authorization-proposal.json");
  return readC0CommercialProposal(bytes, sha(bytes));
}

test("the exact C0 proposal pins known design bytes and isolated identities, and grants no authority", async () => {
  const proposal = await currentProposal();
  const { brand, reviewLedger } = await commercialC0Inputs(proposal);
  assert.equal(proposal.status, "proposed-no-authority");
  assert.equal(brand.projection.logo.sha256, proposal.assets.logoSha256);
  assert.equal(reviewLedger.capMicros, 8_000_000);
  assert.equal(reviewLedger.baselineAttempts, 0);
  const changed = Buffer.from(JSON.stringify({ ...proposal, status: "approved" }));
  assert.throws(() => readC0CommercialProposal(changed, sha(changed)), /Exact C0/);
  await assert.rejects(commercialC0Inputs({ ...proposal, assets: { ...proposal.assets, logoSha256: "0".repeat(64) } }), /bytes differ/);
});

test("the exact approved amendment changes only the prepared C0 source records", async () => {
  const base = await readFile("docs/c0-commercial-authorization-proposal.json");
  const amendment = await readFile("docs/c0-commercial-source-amendment.json");
  const baseSha = sha(base), amendmentSha = sha(amendment);
  const original = readC0CommercialProposal(base, baseSha);
  const prepared = readC0CommercialSourceAmendment(amendment, amendmentSha, baseSha);
  assert.equal(original.evidence.prepared.length, 2);
  assert.deepEqual(prepared.map(item => item.id),
    ["c0-approved-market", "c0-approved-service", "c0-current-legacy-boundary", "c0-current-scope-and-trust"]);
  assert.match(prepared[2].content, /Standalone hosting and email.*retired/u);
  assert.match(prepared[2].content, /take precedence over historical R3/u);
  assert.match(prepared[1].content, /first-party observations/u);
  assert.throws(() => readC0CommercialSourceAmendment(amendment, amendmentSha, "9".repeat(64)), /amendment required/);
  const substitute = Buffer.from(JSON.stringify({ ...JSON.parse(amendment.toString()), replace: "budget.capMicros" }));
  assert.throws(() => readC0CommercialSourceAmendment(substitute, sha(substitute), baseSha), /amendment required/);
});

test("two pinned model cards share one ledger, respect stage headroom, and recover only the exact stage receipt", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "miopages-staged-models-"));
  try {
    const { primary, reviewLedger } = await commercialC0Inputs(await currentProposal());
    await initializeResponsesUsageLedger(directory, primary);
    const plan = reviewLedger.stages!;
    const scope = { ...reviewLedger, stages: { ...plan, report: { ...plan.report, capMicros: 450_000 } } };
    const report = scope.stages.report.rates;
    let calls = 0;
    const sent: string[] = [];
    let retained: Buffer | undefined;
    const transport = { async send(path: string, body: object) {
      const request = body as { model: string; max_output_tokens?: number };
      calls++;
      sent.push(request.model);
      if (path.endsWith("input_tokens")) return { body: { input_tokens: 20 } };
      assert.equal(request.max_output_tokens, request.model === report.model ? 14_000 : 6_000);
      const reply = { id: "response_" + calls, model: request.model, service_tier: "default", status: "completed",
        usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30,
          input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } },
        output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "{}" }] }] };
      return { body: reply, rawBody: Buffer.from(JSON.stringify(reply)) };
    } };
    const author = sha(Buffer.from("owner"));
    const work = (stage: string) => ({ ownerDigest: author, workDigest: sha(Buffer.from(stage)) });
    const recheck = async () => {};
    const request = (model: string) => ({ model, input: "synthetic", instructions: "test only", text: { format: {} } });
    const prepare = (stage: "report" | "page") => meteredPresenceWorkflow(directory, primary, transport, scope, 1000, undefined, undefined, stage);
    await prepare("report")(work("report"), request(report.model), recheck, async bytes => { retained = bytes; });
    assert.ok(retained);
    await confirmSitePlanningReceipt(directory, author, work("report").workDigest, retained, { name: "report", rates: report });
    await assert.rejects(confirmSitePlanningReceipt(directory, author, work("report").workDigest, retained, { name: "page", rates: primary }));
    await assert.rejects(prepare("report")(work("second report"), request(report.model), recheck), /Development funding|Usage unavailable|stage budget|Usage governance|usage/i);
    assert.equal(calls, 2);
    await prepare("page")(work("page"), request(primary.model), recheck);
    assert.deepEqual(sent, [report.model, report.model, primary.model, primary.model]);
    const ledger = JSON.parse(await readFile(join(directory, "onboarding-usage.json"), "utf8"));
    assert.equal(ledger.attempts.length, 2);
    const usage = await summarizePresenceWorkflowUsage(directory, scope, author);
    assert.equal(usage.total.accountedMicros, 260);
    assert.equal(usage.stages.find(item => item.name === "report")?.outputTokens, 10);
    assert.equal(usage.images.requests, 0);
    assert.deepEqual(ledger.attempts.map((receipt: { workflowStage: string; estimatedMicros: number }) =>
      [receipt.workflowStage, receipt.estimatedMicros]), [["report", 200], ["page", 60]]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("research continuation retains the batched receipt and separately meters five resumable authorized questions", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "miopages-research-recovery-"));
  try {
    const proposal = await currentProposal();
    const { primary, reviewLedger, brand } = await commercialC0Inputs(proposal);
    await initializeResponsesUsageLedger(directory, primary);
    const marketSearch = proposal.research.scopes;
    const evidence: PresenceEvidence[] = [{ id: "owner-fact", kind: "owner-confirmed", label: "Approved", reference: "fixture", date: null, content: "Synthetic approved business fact." }];
    const context = { intakeId: proposal.destination.intakeId, scope: proposal.destination.scope, entry: "DIRECT_START" as const, limitations: [], conflicts: [], evidence };
    const input = { ...context, research: null, report: null, direction: null, blueprint: null, pages: [], corrections: [] };
    const run: WorkflowRun = { context, input, work: { operation: "research", attempt: randomUUID(), until: Date.now() + 60_000, inputDigest: fingerprint(input) } };
    const grant = {
      contextDigest: fingerprint(context),
      marketingAuthority: { contextDigest: fingerprint(context), brandDigest: brand.digest, brandBrief: "Synthetic test style",
        qualityReviewerId: randomUUID(), sources: [{ digest: fingerprint(evidence[0]), use: "business-fact" as const }] },
      approvedCorrections: [], approvedSources: evidence.map(fingerprint), researchSources: proposal.research.roots, marketSearch,
      researchResponseBytes: proposal.research.responseBytes, ledger: reviewLedger, maxOutputTokens: 16_000, expiresAt: Date.now() + 3600_000,
    };
    const seen: string[] = [];
    let initial: Buffer | undefined;
    const custody = new Map<string, Buffer>();
    let fetched = 0;
    const read: typeof fetch = async target => {
      const response = new Response("<html><title>Public market reference</title><main>" +
        "Evidence from a research publisher on customer buying questions. ".repeat(8) + "</main></html>", { headers: { "Content-Type": "text/html" } });
      Object.defineProperty(response, "url", { value: String(target) });
      fetched++;
      return response;
    };
    const enabled = createResponsesPresenceWorkflow({ grant, readGrant: async () => grant, readContext: async () => context,
      ledgerDirectory: directory, rates: primary, resumeMarketResearch: true, fetchPage: read, fetchMarketPages: () => read,
      transport: { async send(path, body) {
        assert.equal(path, "/v1/responses");
        const request = body as { max_tool_calls: number; max_output_tokens: number; input: string };
        const index = seen.length;
        assert.equal(request.max_tool_calls, index ? 1 : 10);
        assert.equal(request.max_output_tokens, index ? 750 : 5000);
        seen.push(request.input);
        const reply = { id: "response_" + index, model: primary.model, status: "completed", service_tier: "default",
          usage: { input_tokens: 8848, output_tokens: index ? 170 : 765, total_tokens: index ? 9018 : 9613,
            input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } },
          output: [{ type: "web_search_call", status: "completed", action: { sources: [
            { type: "url", url: `https://publisher${index}.example.com/research` },
            { type: "url", url: "https://sector.example.org/analysis" },
          ] } }] };
        return { body: reply, rawBody: Buffer.from(JSON.stringify(reply)) };
      } } });
    await assert.rejects(enabled.run(run, async bytes => { initial = bytes; }), /too few completed search passes/);
    assert.ok(initial);
    const store = { read: async (id: string) => custody.get(id) ?? null, retain: async (id: string, bytes: Buffer) => { custody.set(id, bytes); } };
    const results = await enabled.completeMarketResearch!(run, initial, store);
    assert.ok(Array.isArray(results) && results.length >= marketSearch.minimumNewOrigins);
    assert.ok(fetched >= marketSearch.minimumNewOrigins);
    assert.deepEqual(seen.slice(1), marketResearchQuestions(marketSearch).map(item => item.question));
    assert.deepEqual(await enabled.completeMarketResearch!(run, initial, store), results);
    assert.equal(seen.length, 6);
    const usage = await summarizePresenceWorkflowUsage(directory, reviewLedger, fingerprint(context.scope));
    assert.equal(usage.total.requests, 6);
    assert.equal(usage.total.uncertain, 0);
    assert.ok(usage.total.heldMicros <= proposal.budget.stages.research.capMicros);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("an isolated commercial transport accepts its bounded deadline and refuses use after authorization expires", async () => {
  const syntheticCredential = "sk-" + "f".repeat(35);
  const expired = Date.now() - 1;
  assert.throws(() => responsesHttps(syntheticCredential, expired, 18_000, 150_001), /unavailable/);
  const adapter = responsesHttps(syntheticCredential, expired, 18_000, 150_000);
  await assert.rejects(adapter.send("/v1/responses", {}), /dispatch refused/);
});

test("canonical owned logo resolves from managed bytes and survives a signed v5 envelope accepted by PHP", async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), "miopages-brand-canonical-"));
  try {
    const proposal = await currentProposal();
    const { brand } = await commercialC0Inputs(proposal);
    const scope = proposal.destination.scope;
    const site = { ...scope, organizationId: proposal.destination.organizationId };
    const png = await readFile(proposal.assets.logoPath);
    await provisionManagedObject(root, scope.webPresenceId, managedKey(png), png);
    const row = { asset_id: proposal.assets.assetId, usage_id: proposal.assets.usageId, source_reference: managedKey(png),
      alt_text: proposal.assets.alt, width: png.readUInt32BE(16), height: png.readUInt32BE(20), usage: {},
      site: focusMioPagesPreview.siteConfiguration, design: focusMioPagesPreview.designConfiguration };
    const db = (rows: object[]) => ({ async query(sql: string, ids: string[]) {
      assert.match(sql, /u\.entity_type='web_presence' AND u\.role='logo'/u);
      assert.deepEqual(ids, [scope.managedSiteId, scope.webPresenceId]);
      return { rows };
    } }) as unknown as PoolClient;
    const exact = await resolveSignedDraftBrand(db([row]), scope, brand.digest, root);
    await assert.rejects(resolveSignedDraftBrand(db([row, row]), scope, brand.digest, root), /One owned/);
    await assert.rejects(resolveSignedDraftBrand(db([{ ...row, usage_id: randomUUID() }]), scope, brand.digest, root), /differs/);
    assert.throws(() => readSignedDraftBrand(exact, { ...scope, managedSiteId: randomUUID() }));
    assert.throws(() => readSignedDraftBrand({ ...exact, pngBase64: Buffer.from("tampered").toString("base64") }, scope));
    const pages = [{ id: randomUUID(), path: "/", title: "Home", sections: [{ id: randomUUID(), type: "intro",
      content: { heading: "Heading", text: "Body" } }] }];
    const selection = { siteProposalId: randomUUID(), installationId: randomUUID(), revision: 1, previousDigest: null,
      brandDigest: brand.digest, navigation: ["/"], actions: [] };
    const decision = bindSiteDraft(site, [{ ...site, pages, revision: 1, proposalId: randomUUID(), sourceDigest: "1".repeat(64),
      projectionDigest: fingerprint(pages), approvalId: "2".repeat(64), previewDigest: "3".repeat(64) }], selection, exact);
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const publicKeyBase64 = Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url").toString("base64");
    const wire = nativeDraftEnvelope(decision, "test", publicKeyBase64, privateKey, "apply");
    const payload = readNativeDraftEnvelope(wire, "test", publicKeyBase64);
    assert.equal(payload.version, 5);
    assert.deepEqual(payload.candidate.brand, exact);
    const php = spawnSync("php", ["-r", `define('ABSPATH',true);
      require 'wordpress/miopages-delivery/includes/class-miopages-native-draft-envelope.php';
      $input=json_decode(stream_get_contents(STDIN),true,48,JSON_THROW_ON_ERROR);
      $payload=MioPages_Native_Draft_Envelope::verify(json_encode($input['wire']),$input['identity']);
      echo $payload['candidate']['brand']['digest'];`], { encoding: "utf8",
      input: JSON.stringify({ wire, identity: { ...site, installationId: selection.installationId, keyId: "test", publicKeyBase64 } }) });
    assert.equal(php.status, 0, php.stderr);
    assert.equal(php.stdout, brand.digest);
  } finally { await rm(root, { recursive: true, force: true }); }
});
