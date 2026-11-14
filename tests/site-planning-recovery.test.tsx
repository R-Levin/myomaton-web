import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fingerprint } from "../lib/platform/canonical/model";
import { initializeResponsesUsageLedger, protectedSitePlanningProvider, type ResponsesTransport } from "../lib/platform/intake/intelligent-responses";
import { IntakeError } from "../lib/platform/intake/model";
import { PlanningResponseCustody, planningResponseRetentionMs } from "../lib/platform/intake/planning-response-custody";
import { ProtectedSitePlanning, reviewedSitePlanning, type SitePlanningReview } from "../lib/platform/intake/protected-site-planning";
import type { IntakeService, IntakeView } from "../lib/platform/intake/service";
import { compactSitePlanningOutput, compactSitePlanningVersion, prepareSitePlanning } from "../lib/platform/intake/site-planning";
import { c2 } from "./fixtures/site-planning-compact";


test("a completed provider response survives validation and draft failures in private custody", async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "planning-custody-")));
  try {
    for (const [caseName, expected] of [
      ["duplicate citations", "proposal_citations"], ["visitor route", "proposal_route"], ["copy", "proposal_content"],
      ["missing sections", "proposal_shape"], ["invalid JSON", "response_decode"], ["changed evidence", "evidence_changed"],
      ["usage mismatch", "provider_usage"],
      ["private write", "custody_write"], ["capacity", "draft_capacity"], ["database", "draft_persistence"],
      ["unsettled receipt", "draft_persistence"], ["valid", null],
    ] as const) await t.test(caseName, async () => {
      const directory = join(root, "case-" + caseName.replaceAll(" ", "-"));
      await mkdir(directory, { mode: 0o700 });
      const responseDirectory = join(directory, "responses");
      await mkdir(responseDirectory, { mode: 0o700 });
      const selection = { webPresenceId: "fictional-presence", managedSiteId: "fictional-site" };
      const ownerDigest = fingerprint(selection), expiresAt = Date.now() + 60_000;
      const sources = [
        { id: "tree", kind: "synthetic-review" as const, statement: "Fictional tree business.", reference: "Fixture", at: "2026-11-14" },
        { id: "storm", kind: "synthetic-review" as const, statement: "Fictional storm intake.", reference: "Fixture", at: "2026-11-14" },
      ];
      const projection = prepareSitePlanning(ownerDigest, sources, [], {
        ownerDigest, evidenceDigest: fingerprint(sources), expiresAt, approvedAnswerDigests: [],
      });
      const rates = { model: "test-model", verifiedOn: "2026-11-14", inputPerMillion: 750_000, cachedPerMillion: 75_000,
        outputPerMillion: 4_500_000, cacheWritePerMillion: 0, countMicros: 0 };
      await initializeResponsesUsageLedger(directory, rates);

      let now = Date.now() + 30_000;
      class ResponseFiles extends PlanningResponseCustody {
        override async save(...args: Parameters<PlanningResponseCustody["save"]>) {
          if (caseName === "private write") throw Error("PRIVATE_ERROR_SENTINEL");
          return super.save(...args);
        }
      }
      const custody = new ResponseFiles(responseDirectory, () => now, directory);
      const generated = structuredClone(c2);
      if (caseName === "duplicate citations") generated.pages[0].refs = [1, 1];
      if (caseName === "visitor route") generated.pages[0].action.to = "/unknown";
      if (caseName === "copy") generated.pages[0].sections[0].body = "\u202eUnsafe";
      if (caseName === "missing sections") generated.pages[0].sections = [];
      const body = { id: "resp_offline", model: rates.model, service_tier: "default", status: "completed",
        usage: { input_tokens: 350, input_tokens_details: { cached_tokens: 0 }, output_tokens: 750,
          output_tokens_details: { reasoning_tokens: 0 }, total_tokens: caseName === "usage mismatch" ? 100 : 1100 },
        output: [{ type: "message", role: "assistant", content: [{ type: "output_text",
          text: caseName === "invalid JSON" ? "PRIVATE_OUTPUT_SENTINEL" : JSON.stringify(generated) }] }] };
      const rawBody = Buffer.from("  " + JSON.stringify(body, null, 2) + "\n");
      let calls = 0;
      const transport: ResponsesTransport = { async send(path) {
        calls++;
        if (path.endsWith("input_tokens")) return { body: { input_tokens: 350 } };
        if (caseName === "changed evidence") view.answers = { businessName: "Different evidence" };
        return { body, rawBody };
      } };
      const generate = protectedSitePlanningProvider(directory, rates, transport, {
        ownerDigest, inputDigest: projection.inputDigest, expiresAt, maxRequests: 2, capMicros: 30_000,
        format: compactSitePlanningVersion, maxOutputTokens: compactSitePlanningOutput,
      });
      let view: IntakeView = { version: 1, answers: {} } as IntakeView;
      let shouldFail = caseName === "database" || caseName === "capacity" || caseName === "unsettled receipt";
      const intake = { selection, async resume() { return structuredClone(view); },
        async editProtectedSitePlanning(_token: string, version: number | undefined,
          update: (state: SitePlanningReview, view: IntakeView) => SitePlanningReview) {
          if (version !== undefined && version !== view.version) throw new IntakeError("draft_changed", 409);
          const next = update(view.sitePlanning ?? {}, structuredClone(view));
          if (next.proposal && shouldFail) {
            shouldFail = false;
            if (caseName === "capacity") throw new IntakeError("payload_too_large", 413);
            throw Error("PRIVATE_ERROR_SENTINEL");
          }
          view = { ...view, sitePlanning: next, version: view.version + 1 };
          return structuredClone(view);
        },
      } as unknown as IntakeService;
      const service = new ProtectedSitePlanning(intake, {
        model: rates.model, format: compactSitePlanningVersion, input: async () => projection, generate,
      }, custody);
      const result = await service.generate("fixture", 1);
      assert.equal(calls, 2);
      assert.equal(result.sitePlanning?.failure ?? null, expected);
      assert.doesNotMatch(JSON.stringify(result), /PRIVATE_ERROR_SENTINEL|PRIVATE_OUTPUT_SENTINEL|rawBody|capturedAt/);
      const ledger = JSON.parse(await readFile(join(directory, "onboarding-usage.json"), "utf8"));
      assert.equal(ledger.attempts.length, 1);
      assert.equal(ledger.attempts[0].recoveryAuthorized,
        ["changed evidence", "private write", "usage mismatch"].includes(caseName) ? undefined : true);
      if (caseName === "usage mismatch") {
        assert.equal(ledger.attempts[0].status, "pending");
        assert.equal(ledger.attempts[0].estimatedMicros, undefined);
      } else {
        assert.equal(ledger.attempts[0].estimatedMicros, 3638);
        assert.equal(ledger.attempts[0].status, caseName === "invalid JSON" ? "rejected" : "completed");
      }
      const files = await readdir(responseDirectory);
      if (caseName === "private write") { assert.deepEqual(files, []); return; }
      assert.equal(files.length, 1);
      if (!expected) {
        const snapshot = result.sitePlanning!.proposal!;
        assert.equal(snapshot.generated.plan.pages.length, 5);
        assert.deepEqual((await intake.resume("fixture")).sitePlanning?.proposal, snapshot);
        return;
      }

      const attempt = result.sitePlanning!.recovery!;
      assert.deepEqual((await custody.read(attempt))?.bytes, rawBody);
      await assert.rejects(custody.read({ ...attempt, ownerDigest: "0".repeat(64) }), { code: "custody_read" });
      await assert.rejects(service.generate("fixture", result.version), { code: "draft_changed" });
      assert.equal(calls, 2);
      if (caseName === "unsettled receipt") {
        ledger.attempts[0].status = "pending";
        await writeFile(join(directory, "onboarding-usage.json"), JSON.stringify(ledger));
      }
      const reopened = new ProtectedSitePlanning(intake, undefined, custody);
      const recovered = await reopened.recover("fixture", result.version);
      if (caseName === "database" || caseName === "capacity") {
        const proposal = recovered.sitePlanning!.proposal!;
        const review = reviewedSitePlanning(proposal), editedPlan = structuredClone(review.plan);
        editedPlan.pages[0].title = "Fictional tree work options";
        const routes = Object.fromEntries(review.actions.map(action => [action.from, action.destination]));
        const edited = await reopened.edit("fixture", recovered.version, review.digest, editedPlan, routes);
        const saved = (await intake.resume("fixture")).sitePlanning!.proposal!;
        assert.deepEqual(saved.sources, proposal.sources);
        assert.deepEqual(saved.generated.evidence, proposal.generated.evidence);
        assert.equal(reviewedSitePlanning(saved).plan.pages[0].title, "Fictional tree work options");
        await assert.rejects(reopened.delivery("fixture", edited.version), { code: "authorization_required" });
      } else {
        assert.equal(recovered.sitePlanning?.failure, ["unsettled receipt", "usage mismatch"].includes(caseName) ? "usage_gate" : expected);
        assert.equal(recovered.sitePlanning?.proposal, undefined);
      }
      assert.equal(calls, 2);
      now += planningResponseRetentionMs;
      await assert.rejects(custody.read(attempt), { code: "custody_expired" });
      if (caseName === "visitor route") {
        await custody.pruneExpired();
        assert.deepEqual(await readdir(responseDirectory), []);
      }
      if (caseName === "copy") {
        const path = join(responseDirectory, files[0]);
        const stored: { payload: string; sha256: string } = JSON.parse(await readFile(path, "utf8"));
        await writeFile(path, JSON.stringify({ ...stored, sha256: "0".repeat(64) }));
        await assert.rejects(custody.read(attempt), { code: "custody_read" });
      }
    });
  } finally { await rm(root, { recursive: true, force: true }); }
});
