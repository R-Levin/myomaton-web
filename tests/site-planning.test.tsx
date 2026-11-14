import { test } from "node:test";
import assert from "node:assert/strict";
import { fingerprint } from "../lib/platform/canonical/model";
import { prepareSitePlanning, readSitePlanning, sitePlanningFormat } from "../lib/platform/intake/site-planning";
import type { InterviewEvidence, InterviewTurn } from "../lib/platform/intake/intelligent-model";

const now = Date.parse("2026-11-13T12:00:00Z");
const source = (id: string, statement: string): InterviewEvidence => ({
  id, kind: "owner-confirmed", statement, reference: "Retained private source pointer", at: new Date(now).toISOString(),
});
const owner = (id: string) => fingerprint({ id });
const grant = (ownerDigest: string, evidence: InterviewEvidence[]) => ({
  ownerDigest, evidenceDigest: fingerprint(evidence), expiresAt: now + 1000, approvedAnswerDigests: [],
});
const page = (path: string, title: string, body: string, action: string) => ({
  path, title, purpose: title, seoDescription: title, action, sections: [{ heading: title, body }],
});
const signal = (path: string, id: string, destination: string | null) => ({
  path, sourceIds: [id], sectionSourceIds: [[id]], actionKind: destination ? "learn" : "request-contact", destination,
});

test("validates distinct, editable site shapes and visitor decisions against their own evidence", () => {
  const c0 = [source("transition", "The business is transitioning to managed Web Presence.")];
  const c2 = [source("tree", "Storm-damage assessments and scheduled pruning have distinct visitor needs.")];
  const a = prepareSitePlanning(owner("c0"), c0, [], grant(owner("c0"), c0), now);
  const b = prepareSitePlanning(owner("c2"), c2, [], grant(owner("c2"), c2), now);
  const draftA = {
    plan: { positioning: "Managed Web Presence", offering: "A review before scoping", audience: "Small businesses with a website",
      pages: [page("/", "Understand your web options", "Start with the website you already have.", "See the approach"),
        page("/approach", "Start with a review", "Discuss the existing site before deciding how to proceed.", "Request a conversation")] },
    directionSourceIds: ["transition"], pages: [signal("/", "transition", "/approach"), signal("/approach", "transition", null)],
    unresolved: ["Launch eligibility remains unconfirmed."],
  };
  const draftB = {
    plan: { positioning: "Tree care with clear next steps", offering: "Storm assessment and routine pruning", audience: "Property owners",
      pages: [page("/", "Tree care", "Choose the next step based on your situation.", "Explore storm assessment"),
        page("/storm", "Storm damage", "Tell us about damage from a safe location.", "Request an assessment"),
        page("/pruning", "Scheduled pruning", "Describe the tree and the work you want considered.", "Discuss pruning")] },
    directionSourceIds: ["tree"], pages: [signal("/", "tree", "/storm"), signal("/storm", "tree", null), signal("/pruning", "tree", null)],
    unresolved: ["Emergency availability is unconfirmed."],
  };
  const x = readSitePlanning(draftA, a), y = readSitePlanning(draftB, b);
  assert.deepEqual(x.plan.pages.map(item => item.path), ["/", "/approach"]);
  assert.deepEqual(y.plan.pages.map(item => item.path), ["/", "/storm", "/pruning"]);
  assert.equal(y.evidence[1].action.kind, "request-contact");
  assert.equal(x.status, "proposed");
  assert.notEqual(x.digest, y.digest);
  assert.doesNotMatch(JSON.stringify(a.input), /Retained private source pointer/);
  assert.equal(sitePlanningFormat(a).strict, true);
  assert.throws(() => readSitePlanning(draftA, b), /citations refused/);
  assert.throws(() => readSitePlanning({ ...draftA, pages: [signal("/", "transition", "https://example.test"), draftA.pages[1]] }, a), /visitor action refused/);
  assert.throws(() => readSitePlanning({ ...draftA, pages: [{ ...draftA.pages[0], sectionSourceIds: [] }, draftA.pages[1]] }, a), /section evidence mismatch/);
});

test("fails closed for a changed evidence set, wrong tenant, expired grant or unapproved correction", () => {
  const tenant = owner("c0"), evidence = [source("transition", "New managed service in development.")];
  const original: InterviewTurn = {
    id: "b59dd874-cf5b-437b-911e-5400df2295b5", gapId: "first-action", question: "What should visitors do first?",
    rationale: "Select the first visitor action.", sourceIds: ["transition"], respondsTo: null, generatorVersion: "fixture",
    assessment: null, at: evidence[0].at, answer: { text: "Private original.", disposition: "provided", at: evidence[0].at },
  };
  const correction = {
    ...original, id: "d581e1c9-8148-47f6-a990-8475d77fc990", replacesAnswerTo: original.id,
    answer: { ...original.answer!, text: "Private correction." },
  };
  const auth = { ...grant(tenant, evidence), approvedProjections: [
    { savedAnswerDigest: fingerprint(correction.answer.text), outboundText: "Ask visitors for the existing site address." },
  ] };
  const prepared = prepareSitePlanning(tenant, evidence, [original, correction], auth, now);
  assert.deepEqual(prepared.input.answers.map(item => [item.id, item.statement, item.confirmation]), [
    [correction.id + ":answer", "Ask visitors for the existing site address.", "unconfirmed"],
  ]);
  assert.doesNotMatch(JSON.stringify(prepared.input), /Private original|Private correction|What should visitors do first/);
  assert.throws(() => prepareSitePlanning(owner("c2"), evidence, [], auth, now), /not authorized/);
  assert.throws(() => prepareSitePlanning(tenant, [source("transition", "Different evidence")], [], auth, now), /not authorized/);
  assert.throws(() => prepareSitePlanning(tenant, evidence, [], auth, auth.expiresAt), /not authorized/);
  assert.throws(() => prepareSitePlanning(tenant, evidence, [original, correction], grant(tenant, evidence), now), /transmission not approved/);
});

test("site planning reuses the metered Responses dispatch and refuses a stale projection after count", async () => {
  const { mkdtemp, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { initializeResponsesUsageLedger, protectedSitePlanningProvider } = await import("../lib/platform/intake/intelligent-responses");
  const directory = await mkdtemp(join(tmpdir(), "miopages-planning-"));
  try {
    const rates = { model: "test-model", verifiedOn: "2026-11-13", inputPerMillion: 750_000, cachedPerMillion: 75_000,
      outputPerMillion: 4_500_000, cacheWritePerMillion: 0, countMicros: 0 };
    await initializeResponsesUsageLedger(directory, rates);
    const ownerDigest = owner("c0"), evidence = [source("transition", "The business is preparing a managed service.")];
    const liveNow = Date.now();
    const prepared = prepareSitePlanning(ownerDigest, evidence, [], { ...grant(ownerDigest, evidence), expiresAt: liveNow + 60_000 }, liveNow);
    const authorization = { ownerDigest, inputDigest: prepared.inputDigest, expiresAt: liveNow + 60_000, capMicros: 500_000, maxRequests: 4 };
    const paths: string[] = [];
    const plan = { plan: { positioning: "Managed Web Presence", offering: "Scoped planning", audience: "Small businesses",
      pages: [page("/", "Understand the options", "Review the existing site before choosing a path.", "Request a conversation")] },
      directionSourceIds: ["transition"], pages: [signal("/", "transition", null)], unresolved: ["Eligibility remains open."] };
    const dispatch = protectedSitePlanningProvider(directory, rates, {
      async send(path, request) {
        paths.push(path);
        assert.doesNotMatch(JSON.stringify(request), /Retained private source pointer/);
        if (path.endsWith("input_tokens")) return { body: { input_tokens: 100 } };
        assert.equal((request as { store: boolean }).store, false);
        return { body: { model: rates.model, service_tier: "default", status: "completed", usage: {
          input_tokens: 100, input_tokens_details: { cached_tokens: 0 }, output_tokens: 50,
          output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 150,
        }, output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(plan) }] }] } };
      },
    }, authorization);
    const ledger = () => readFile(join(directory, "onboarding-usage.json"), "utf8").then(JSON.parse);
    assert.equal((await dispatch(() => prepared)).status, "proposed");
    assert.deepEqual(paths, ["/v1/responses/input_tokens", "/v1/responses"]);
    await assert.rejects(dispatch(() => prepared), /already dispatched/);
    const secondEvidence = [source("transition", "Customers first need a website review.")];
    const second = prepareSitePlanning(ownerDigest, secondEvidence, [], { ...grant(ownerDigest, secondEvidence), expiresAt: liveNow + 60_000 }, liveNow);
    let reads = 0;
    const secondDispatch = protectedSitePlanningProvider(directory, rates, {
      async send(path) { paths.push(path); return { body: { input_tokens: 100 } }; },
    }, { ...authorization, inputDigest: second.inputDigest });
    await assert.rejects(secondDispatch(() => ++reads === 1 ? second : prepared), /authorization mismatch/);
    assert.equal(paths.at(-1), "/v1/responses/input_tokens");
    assert.equal(paths.length, 3);
    assert.deepEqual((await ledger()).attempts.map((item: { status: string; generationDispatched: boolean }) =>
      [item.status, item.generationDispatched]), [["completed", true], ["rejected", false]]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("an incomplete site plan records an allowlisted limit reason and blocks later dispatch", async () => {
  const { mkdtemp, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { initializeResponsesUsageLedger, protectedSitePlanningProvider } = await import("../lib/platform/intake/intelligent-responses");
  const root = await mkdtemp(join(tmpdir(), "miopages-incomplete-plan-"));
  try {
    const rates = { model: "test-model", verifiedOn: "2026-11-13", inputPerMillion: 750_000, cachedPerMillion: 75_000,
      outputPerMillion: 4_500_000, cacheWritePerMillion: 0, countMicros: 0 };
    await initializeResponsesUsageLedger(root, rates);
    const ownerDigest = owner("c0"), evidence = [source("service", "An existing site needs a review.")];
    const start = Date.now(), expiresAt = start + 60_000;
    const prepared = prepareSitePlanning(ownerDigest, evidence, [], { ...grant(ownerDigest, evidence), expiresAt }, start);
    const paths: string[] = [];
    const run = protectedSitePlanningProvider(root, rates, {
      async send(path) {
        paths.push(path);
        return { body: path.endsWith("input_tokens") ? { input_tokens: 699 } : {
          model: rates.model, service_tier: "default", status: "incomplete",
          incomplete_details: { reason: "max_output_tokens", text: "This private value must not reach the ledger." },
          usage: { input_tokens: 699, input_tokens_details: { cached_tokens: 0 },
            output_tokens: 1200, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 1899 },
        } };
      },
    }, { ownerDigest, inputDigest: prepared.inputDigest, expiresAt, capMicros: 22429, maxRequests: 4 });
    await assert.rejects(run(() => prepared), { code: "output_token_limit" });
    await assert.rejects(run(() => prepared), /Unreconciled development usage/);
    const ledger = await readFile(join(root, "onboarding-usage.json"), "utf8");
    assert.doesNotMatch(ledger, /private value/);
    const [receipt] = JSON.parse(ledger).attempts;
    assert.equal(receipt.status, "uncertain");
    assert.equal(receipt.failure, "output_token_limit");
    assert.equal(receipt.estimatedMicros, 5925);
    assert.deepEqual(paths, ["/v1/responses/input_tokens", "/v1/responses"]);
  } finally { await rm(root, { recursive: true, force: true }); }
});
