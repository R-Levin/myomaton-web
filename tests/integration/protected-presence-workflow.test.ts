import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, rm, mkdtemp, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import type { Pool } from "pg";
import { createC0Onboarding } from "../../scripts/intake/c0-onboarding";
import { readRetainedC0 } from "../../scripts/intake/retained-c0";
import { prepareC0 } from "../../scripts/intake/adaptive-sources";
import { IntakeService } from "../../lib/platform/intake/service";
import { c0DisclosureManifest } from "../../lib/platform/intake/c0-workflow-knowledge";
import { c0ActivationGrant } from "../../lib/platform/intake/c0-workflow-activation";
import { fingerprint } from "../../lib/platform/canonical/model";
import { initializeResponsesUsageLedger } from "../../lib/platform/intake/intelligent-responses";
import { composePresenceCase, reviewWorkflowChange, workPresenceCase } from "../../lib/platform/intake/protected-presence-workflow";
import type { PresenceWorkflowGrant } from "../../lib/platform/intake/presence-workflow-provider";
import { publicResearchAddress } from "../../lib/platform/intake/presence-workflow-egress";

const readSql = (file: string) => readFile(new URL("../../lib/platform/intake/" + file, import.meta.url), "utf8");

test("restricted Core worker discovers research, retains a substantial provider-shaped site and revises one flagged page", async () => {
  const bin = process.env.PG_BIN_DIR ?? "C:/Program Files/PostgreSQL/18/bin";
  const setup = await createC0Onboarding(bin, true);
  const ledgerDirectory = await mkdtemp(join(tmpdir(), "miopages-protected-workflow-proof-"));
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
    const workspace = { root: ledgerDirectory, grantFile: join(ledgerDirectory, "unused-test-grant.json"), ledgerDirectory };
    const client = await setup.pool.connect();
    try {
      await client.query("SET ROLE miopages_core_development");
      const restricted = { query: client.query.bind(client) } as unknown as Pool;
      const fetches: string[] = [], passes: string[] = [];
      let audits = 0;
      let reportAttempts = 0;
      const composition = composePresenceCase(restricted, intake, token, workspace, { kind: "offline-test", rates,
        readGrant: async () => grant,
        async fetchPage(url, init) {
          assert.equal(init?.redirect, "error");
          fetches.push(String(url));
          const links = '<a href="/services/maintenance">Maintenance service</a> <a href="/login">Login</a> <a href="https://outside.example/">External</a>';
          const response = new Response("<main>Retained public evidence for tests. " + (fetches.length === 1 ? links : "") + "</main>",
            { headers: { "content-type": "text/html" } });
          Object.defineProperty(response, "url", { value: url });
          return response;
        },
        transport: { async send(route, raw) {
          if (route.endsWith("input_tokens")) return { body: { input_tokens: 9600 } };
          const request = raw as { store: boolean; input: string; text: { format: { name: string } } };
          assert.equal(request.store, false);
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
            case "page": output = { path: input.pagePath, heading: "Draft " + input.pagePath, searchTitle: "Scope proof", searchDescription: "Recorded provider response shape",
              sections: Array.from({ length: 6 }, (_, index) => ({
                heading: "Block " + index, body: passages(input.previous ? "Editorial revision" : "Initial draft"), ...cited,
                visual: { purpose: "Explain", brief: "Use a text diagram", status: "asset-needed", altIntent: "Explain the steps in text" },
              })), actions: [{ label: "Read more", kind: "navigate", destination: input.pagePath === "/" ? "/service" : "/" },
                { label: "Contact", kind: "request-contact", destination: null }], internalLinks: [input.pagePath === "/" ? "/service" : "/"] }; break;
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
      }
      const grant: PresenceWorkflowGrant = {
        contextDigest: manifest.contextDigest, approvedSources: manifest.approvedSourceCandidates.map(source => source.digest),
        approvedCorrections: [], maxRetries: 1, maxEditorialRevisions: 1, maxOutputTokens: 12_000, expiresAt: Date.now() + 180_000,
        researchSources: [{ id: "research:competitor", url: "https://example.org/", label: "Market reference" }],
        discovery: { terms: ["maintenance"], prefixes: { "https://example.org": ["/services"] }, maxDiscovered: 2 },
        researchResponseBytes: 12_000, ledger: { id: fingerprint("offline-only grant"), baselineAttempts: 0,
          startingLedger: createHash("sha256").update(await readFile(ledgerFile)).digest("hex"),
          requests: 28, generations: 14, capMicros: 1_000_000, inputTokens: 24_000, inputBytes: 120_000 },
      };
      const owner = { id: "test-verified-operator", role: "operator", simulated: false } as const;
      let worker = await composition.open();
      await reviewWorkflowChange(worker, context, "workflow-start", 0, owner);
      let view = (await workPresenceCase(worker, context))!;
      assert.equal(view.failure, "output-invalid");
      assert.deepEqual(fetches, ["https://example.org/", "https://example.org/services/maintenance"]);
      assert.equal(await workPresenceCase(worker, context).then(v => v?.version), view.version);
      worker = await composition.open();
      view = (await reviewWorkflowChange(worker, context, "workflow-retry", view.version, owner))!;
      assert.equal(view.next, "report");
      view = (await workPresenceCase(worker, context))!;
      assert.equal(view.report?.findings.length, 12);
      assert.equal(view.next, "customer-review");
      view = (await reviewWorkflowChange(worker, context, "workflow-continue", view.version, owner))!;
      assert.equal(view.confirmation?.decision, "development-continuation");
      view = (await workPresenceCase(worker, context))!;
      assert.equal(view.next, "editorial-review");
      assert.equal(view.pages.length, 5);
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
    await rmdir(ledgerDirectory);
  }
});
