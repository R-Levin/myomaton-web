import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID, createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { JSDOM } from "jsdom";
import { fingerprint } from "../lib/platform/canonical/model";
import { evidencePacket, submissionDigest, synthesize, validatePacket, validateDraft, manualModelAdapter, type Claim, type ReviewDraft, type Submission, type PresenceCoverage } from "../lib/platform/reviews/model";
import { internalCustomerTerms, snapshotWritingGuidance, validateSolutionContext, type SolutionContext } from "../lib/platform/reviews/synthesis-context";
import { loadSolutionContext } from "../scripts/reviews/context";
import { LocalReviewStore, reviewRoot } from "../lib/platform/reviews/store";
import { reviewHtml, reviewMarkdown } from "../lib/platform/reviews/presentation";
import { interviewMarkdown } from "../lib/platform/reviews/operator-context";

Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" });
const owner = { webPresenceId: randomUUID(), managedSiteId: randomUUID() };
const answers = { project: "Improve or replace an existing Web presence", businessName: "Synthetic consulting business", goals: ["Improve search visibility", "Something else"], goalOther: "Fewer unsuitable enquiries", responses: ["Something else"], responseOther: "Discuss a project", audience: "Regional service buyers" };
const submission: Submission = { id: randomUUID(), intake_id: randomUUID(), web_presence_id: owner.webPresenceId, entry_intent: "FREE_REVIEW", questionnaire_version: "foundational-intake/1", draft_version: 1, answers, provenance: Object.fromEntries(Object.keys(answers).map(k => [k, { source: "prospect-supplied", confirmation: "unconfirmed", suppliedAt: "2026-10-17T00:00:00Z" }])), submitted_at: "2026-10-17T00:00:00Z", digest: "" };
submission.digest = submissionDigest(submission);
const routes = ["/", "/service", "/what-you-get", "/review", "/start", "/review/intake"];
const evidence = routes.map((route, i) => ({ id: `page-${i}`, kind: "operator" as const, source: new URL(route, "http://127.0.0.1:55555").href, text: "Managed help is described, not verified delivery.", capturedAt: "2026-10-17T00:00:00Z", coverage: "Rendered text; no analytics, delivery or fresh-visitor completion proof." }));
const presence: PresenceCoverage = { version: "development-presence/1", label: "Synthetic full service", baseUrl: "http://127.0.0.1:55555", observedVersion: "Synthetic six-route fixture", discovered: routes.map(route => ({ route, title: route })), reviewed: routes.map((route, i) => ({ route, purpose: "Synthetic context test", capturedAt: evidence[i].capturedAt, limitations: evidence[i].coverage, evidenceId: evidence[i].id, snapshotSha256: "0".repeat(64) })), omitted: [] };
const claim = (text = "Your prospect's need suggests a clearer route to a useful conversation.", kind: Claim["kind"] = "RECOMMENDATION"): Claim => ({ text, kind, evidence: ["intake:audience", "page-0"] });
const draft = (): ReviewDraft => ({ format: "consultative/1", understanding: claim("You want more useful enquiries.", "OBSERVATION"), startingPoint: { framing: "existing", content: claim("The offer has a useful starting point.", "OBSERVATION") }, opportunities: [1, 2, 3].map(i => ({ title: `Useful direction ${i}`, what: claim("Your buyers need to recognize the offer.", "OBSERVATION"), why: claim(), direction: claim() })), firstDirection: claim(), conversion: claim(), ongoing: { ...claim("Once measurement is in place, use qualified enquiries to guide useful content."), serviceUses: [{ capability: "measurement-optimization", mode: "direction" }] }, fit: { assessment: "conditional", content: claim() }, teaser: { status: "not-generated", content: claim("No concept is included.", "UNKNOWN") } });

test("internal context snapshots exact authority bytes, statuses and boundaries separately from prospect evidence", async () => {
  const context = await loadSolutionContext(); validateSolutionContext(context);
  for (const d of context.documents) { const bytes = await readFile(d.path); assert.equal(d.sha256, createHash("sha256").update(bytes).digest("hex")); if (d.content !== undefined) assert.equal(d.content, bytes.toString("utf8")); }
  assert.equal(context.documents.filter(d => d.content !== undefined).length, 1);
  assert.deepEqual(new Set(context.capabilities.map(c => c.status)), new Set(["AVAILABLE_PROVEN", "DEFINED_EVOLVING", "PLANNED_DEFERRED", "EXTERNAL_INTEGRATION"]));
  assert.ok(!context.capabilities.some(c => c.scope === "production"));
  const p = evidencePacket(owner, submission, evidence, "Synthetic only", presence, context);
  const before = JSON.stringify(p); context.capabilities[0].summary = "External mutation"; validatePacket(p); assert.equal(JSON.stringify(p), before);
  assert.deepEqual(p.submission, submission); assert.deepEqual(p.evidence, evidence);
  const bad = structuredClone(p); bad.solutionContext!.documents[0].content += "changed"; assert.throws(() => validatePacket(bad), /document\/hash/);
  const injected = structuredClone(p); Object.assign(injected.solutionContext!, { prospectTruth: "not allowed" }); assert.throws(() => validatePacket(injected));
});

test("synthesis provider receives only bound inputs and reusable need-first guidance, never previous drafts", async () => {
  const p = evidencePacket(owner, submission, evidence, "Synthetic only", presence, await loadSolutionContext());
  await synthesize({ packet: p, operation: "free-review", authorizedAttempts: 1 }, { mode: "development-manual", async synthesize(request) {
    assert.deepEqual(Object.keys(request).sort(), ["authorizedAttempts", "guidance", "operation", "packet"]);
    assert.deepEqual(request.packet.submission, submission); assert.deepEqual(request.packet.evidence, evidence);
    assert.match(request.guidance!, /business goals and needs first/); assert.match(request.guidance!, /continuing discovery/); assert.match(request.guidance!, /do not map each problem to a feature/);
    request.packet.submission.answers.businessName = "Mutated provider copy"; return draft();
  } });
  assert.equal(p.submission.answers.businessName, answers.businessName);
  await assert.rejects(synthesize(Object.assign({ packet: p, operation: "free-review" as const, authorizedAttempts: 1 as const }, { previousDraft: "not an input" }), manualModelAdapter(draft())));
  await assert.rejects(synthesize({ packet: p, operation: "free-review", authorizedAttempts: 1 }, { mode: "live", async synthesize() { throw Error("Must not dispatch"); } }), /Live provider/);
  await assert.rejects(synthesize({ packet: p, operation: "free-review", authorizedAttempts: 1 }, manualModelAdapter(draft()), { ...process.env, NODE_ENV: "production" }), /DEVELOPMENT/);
});

test("capability direction is allowed without feature stuffing, operational promises and solution-as-prospect citations refuse", async () => {
  const context = await loadSolutionContext(), p = evidencePacket(owner, submission, evidence, "Synthetic only", presence, context);
  validateDraft(draft(), p); const d = draft(); d.ongoing!.serviceUses![0].mode = "current-operation"; assert.throws(() => validateDraft(d, p), /currently operational/);
  for (const capability of ["managed-site", "analytics-providers"]) { d.ongoing!.serviceUses![0] = { capability, mode: "current-operation" }; assert.throws(() => validateDraft(d, p), /currently operational/); }
  d.ongoing!.serviceUses![0] = { capability: "unknown", mode: "direction" }; assert.throws(() => validateDraft(d, p), /Unknown service/);
  const e = draft(); e.firstDirection.evidence = ["measurement-optimization"]; assert.throws(() => validateDraft(e, p), /Unsupported evidence/);
  for (const copy of ["PLANNED_DEFERRED capability status", "MioPages already automatically analyzes every visitor."]) { const bad = draft(); bad.ongoing!.text = copy; assert.throws(() => validateDraft(bad, p), /status or unsupported/); }
  const missing = evidencePacket(owner, submission, evidence, "No solution", presence); assert.throws(() => validateDraft(draft(), missing), /requires internal solution/);
  const noOngoing = draft(); delete noOngoing.ongoing; validateDraft(noOngoing, p); // Ongoing needs prospect justification, not a mandatory feature list.
});

test("consultative customer flow excludes internal context while operator Q&A nests conditional answers under choices", async () => {
  const p = evidencePacket(owner, submission, evidence, "Synthetic only", presence, await loadSolutionContext()), content = validateDraft(draft(), p);
  const review = { id: randomUUID(), packet: p, state: "NEEDS_OPERATOR_REVIEW" as const, revisions: [{ number: 1, content, digest: fingerprint(content), at: p.solutionContext!.capturedAt, source: "development-manual" as const, actor: "synthetic" }], decisions: [] };
  const html = reviewHtml(review), md = reviewMarkdown(content);
  for (const forbidden of ["Prospect Q&amp;A", "Why this says this", "PLANNED_DEFERRED", "review-solution/1", "serviceUses", "intake:audience", "Local rendering is not"]) assert.ok(!html.includes(forbidden) && !md.includes(forbidden));
  assert.ok(md.indexOf("Our read on your situation") < md.indexOf("What we would do first")); assert.ok(md.indexOf("How your Web presence") < md.indexOf("Where MioPages fits"));
  const operator = new JSDOM(reviewHtml(review, true)).window.document;
  for (const answer of [answers.goalOther, answers.responseOther]) { const node = [...operator.querySelectorAll('li')].find(n => n.firstChild?.textContent === "Something else" && n.textContent?.includes(answer)); assert.ok(node); }
  const qa = interviewMarkdown(p); assert.match(qa, /- Something else\n\n  What else would you like to accomplish\?/); assert.ok(!md.includes(answers.goalOther));
  const local = structuredClone(submission); Object.assign(local.answers, { serviceArea: "Local area", locations: "Synthetic north district", responses: ["Book an appointment or consultation"], bookingContext: "Synthetic discovery call" });
  delete local.answers.responseOther; delete local.provenance.responseOther;
  for (const key of Object.keys(local.answers)) local.provenance[key] ??= { source: "prospect-supplied", confirmation: "unconfirmed", suppliedAt: local.submitted_at };
  local.digest = submissionDigest(local); const conditional = evidencePacket(owner, local, evidence, "Synthetic only", presence);
  const fields = conditional.questionnaireContext!.groups.flatMap(g => g.fields);
  assert.deepEqual(fields.find(f => f.key === "locations")!.followUpTo, { key: "serviceArea", choice: "Local area" });
  assert.deepEqual(fields.find(f => f.key === "bookingContext")!.followUpTo, { key: "responses", choice: "Book an appointment or consultation" });
});

test("synthetic consultative artifact binds context and claim identities without rewriting prior immutable events", async () => {
  const p = evidencePacket(owner, submission, evidence, "Synthetic only", presence, await loadSolutionContext());
  const store = await LocalReviewStore.create(p, draft(), "synthetic test"); const dir = path.join(reviewRoot(), store.id);
  try { const original = await readFile(path.join(dir, "000001.json")); await store.append("request-review", await store.currentBinding(), null, "synthetic test", "Await human review"); const r = await store.read(); assert.equal(r.state, "NEEDS_OPERATOR_REVIEW"); assert.equal(r.revisions.length, 1); assert.ok(r.revisions[0].content.ongoing?.id); assert.deepEqual(await readFile(path.join(dir, "000001.json")), original); assert.deepEqual(r.packet.solutionContext, p.solutionContext); }
  finally { assert.equal(path.dirname(dir), reviewRoot()); await rm(dir, { recursive: true }); }
});

test("solution loading has no customer database or prior-Review prose reader", async () => {
  const code = await readFile("scripts/reviews/context.ts", "utf8");
  assert.ok(!/DATABASE_URL|from ["']pg["']|LocalReviewStore|review-synthesis\/|editable-review|original-draft-input/.test(code));
  // A context with caller-supplied extra history cannot enter the closed schema.
  const bad: SolutionContext = await loadSolutionContext(); Object.assign(bad, { previousReview: {} }); assert.throws(() => validateSolutionContext(bad));
});

test("refined guidance is immutable packet context; synthesis uses its exact snapshot rather than mutable current defaults", async () => {
  const context = await loadSolutionContext(); assert.equal(context.writingGuidance!.version, "review-writing/4");
  assert.deepEqual(context.writingGuidance, snapshotWritingGuidance());
  const p = evidencePacket(owner, submission, evidence, "Synthetic only", presence, context);
  const bad = structuredClone(p); bad.solutionContext!.writingGuidance!.text += "tamper"; assert.throws(() => validatePacket(bad), /guidance snapshot\/hash/);
  const historic = structuredClone(context); historic.writingGuidance!.text = "A preserved synthetic writing contract; no previous Review inputs.";
  historic.writingGuidance!.sha256 = createHash("sha256").update(historic.writingGuidance!.text).digest("hex");
  const frozen = evidencePacket(owner, submission, evidence, "Synthetic only", presence, historic);
  await synthesize({ packet: frozen, operation: "free-review", authorizedAttempts: 1 }, { mode: "development-manual", async synthesize(request) { assert.equal(request.guidance, historic.writingGuidance!.text); const d = draft(); d.format = "consultative/2"; return d; } });
  const legacy = structuredClone(context); delete legacy.writingGuidance; validateSolutionContext(legacy);
  const d = draft(); d.format = "consultative/2";
  assert.throws(() => validateDraft(d, evidencePacket(owner, submission, evidence, "Synthetic only", presence, legacy)), /bound writing guidance/);
});

test("refined customer output omits internal concept status and an absent ongoing section without changing older formats", async () => {
  const p = evidencePacket(owner, submission, evidence, "Synthetic only", presence, await loadSolutionContext()), d = draft(); d.format = "consultative/2";
  const content = validateDraft(d, p);
  const review = { id: randomUUID(), packet: p, state: "NEEDS_OPERATOR_REVIEW" as const, revisions: [{ number: 1, content, digest: fingerprint(content), at: p.solutionContext!.capturedAt, source: "development-manual" as const, actor: "synthetic" }], decisions: [] };
  const html = reviewHtml(review), md = reviewMarkdown(content);
  assert.ok(!html.includes("Optional Home concept") && !md.includes("Optional Home concept"));
  assert.ok(!html.includes(d.teaser.content.text) && !md.includes(d.teaser.content.text));
  assert.ok(!internalCustomerTerms.test(md));
  for (const value of ["Prospect Q&amp;A", "Why this says this", "PLANNED_DEFERRED", "review-writing/2", "intake:", "serviceUses", "sha256"]) assert.ok(!html.includes(value) && !md.includes(value));
  const operator = new JSDOM(reviewHtml(review, true)).window.document;
  assert.equal(operator.querySelectorAll("details.claim-evidence").length, 15);
  assert.ok(operator.body.textContent.includes("Prospect Q&A")); // No operator redesign; the existing transcript remains.
  const withoutOngoing = structuredClone(content); delete withoutOngoing.ongoing;
  assert.ok(!reviewMarkdown(validateDraft(withoutOngoing, p)).includes("How your Web presence"));
  assert.ok(reviewMarkdown(draft()).includes("Optional Home concept"));
});

test("refined writing rejects representative internal jargon without weakening recommendation and capability boundaries", async () => {
  const p = evidencePacket(owner, submission, evidence, "Synthetic only", presence, await loadSolutionContext());
  for (const term of ["operational readiness", "provenance", "supported scope", "discovery content"]) {
    const d = draft(); d.format = "consultative/2"; d.firstDirection.text = `Improve your ${term}.`; assert.throws(() => validateDraft(d, p), /Internal terminology/);
  }
  const d = draft(); d.format = "consultative/2"; validateDraft(d, p);
  d.ongoing!.serviceUses![0].mode = "current-operation"; assert.throws(() => validateDraft(d, p), /currently operational/);
  const titled = draft(); titled.format = "consultative/2"; titled.opportunities[0].title = "Operational readiness"; assert.throws(() => validateDraft(titled, p), /opportunity title/);
});

test("refined synthetic local Review persists once with bound guidance and no post-generation edit", async () => {
  const p = evidencePacket(owner, submission, evidence, "Synthetic only", presence, await loadSolutionContext()), d = draft(); d.format = "consultative/2";
  const generated = await synthesize({ packet: p, operation: "free-review", authorizedAttempts: 1 }, manualModelAdapter(d));
  const store = await LocalReviewStore.create(p, generated, "synthetic writing test"), dir = path.join(reviewRoot(), store.id);
  try { await store.append("request-review", await store.currentBinding(), null, "synthetic writing test", "Human review pending"); const r = await store.read(); assert.equal(r.revisions.length, 1); assert.deepEqual(r.decisions.map(e => e.action), ["create", "request-review"]); assert.equal(r.state, "NEEDS_OPERATOR_REVIEW"); assert.equal(r.packet.solutionContext!.writingGuidance!.sha256, p.solutionContext!.writingGuidance!.sha256); assert.ok(!reviewMarkdown(r.revisions[0].content).includes("Optional Home concept")); }
  finally { assert.equal(path.dirname(dir), reviewRoot()); await rm(dir, { recursive: true }); }
});


test("responsibility and response interpretation policies are bounded immutable provider context, not prospect evidence", async () => {
  const context = await loadSolutionContext(), policy = context.synthesisPolicy!;
  assert.ok(policy.managedServiceResponsibilities.includes("analysis"));
  assert.ok(policy.managedServiceResponsibilities.includes("optimization"));
  assert.ok(policy.customerResponsibilities.includes("business knowledge"));
  assert.ok(policy.customerResponsibilities.includes("approvals"));
  assert.ok(!policy.customerResponsibilities.includes("analysis"));
  assert.equal(policy.responseOptions, "unranked-signals");
  assert.equal(policy.primaryActionBasis, "full-business-context");
  const p = evidencePacket(owner, submission, evidence, "Synthetic policy test", presence, context);
  policy.customerResponsibilities.push("external mutation");
  assert.ok(!p.solutionContext!.synthesisPolicy!.customerResponsibilities.includes("external mutation"));
  const bad = structuredClone(p); bad.solutionContext!.synthesisPolicy!.customerResponsibilities.push("tamper");
  assert.throws(() => validatePacket(bad), /Changed evidence packet/);
  const ranked = structuredClone(context); Object.assign(ranked.synthesisPolicy!, { responseOptions: "equal-priority-goals" });
  assert.throws(() => validateSolutionContext(ranked), /primary conversion intent/);
  const text = snapshotWritingGuidance().text;
  assert.match(text, /who is responsible/); assert.match(text, /not turn managed-service work into customer homework/);
  assert.match(text, /checkbox alone cannot justify/); assert.match(text, /context contradicts/);
  assert.match(text, /MioPages-specific only/); assert.match(text, /friendly and forthright/);
  assert.match(text, /Avoid enquiry\/inquiry/);
});

test("the same response checkboxes permit contextually different primary actions without imposing MioPages paths", async () => {
  for (const fixture of [
    { name: "MioPages", offer: "Standardized managed service. Free Review is primary; conversation is alternate. No bespoke quote sales.", next: "Begin with the Free Review to explore fit." },
    { name: "Synthetic roof contractor", offer: "Site-specific roof estimates are our primary starting point.", next: "Request a roof estimate as the first step." },
    { name: "Synthetic appointment clinic", offer: "A booked initial consultation is our primary route.", next: "Book an initial consultation as the first step." },
  ]) {
    const s = structuredClone(submission); Object.assign(s.answers, { businessName: fixture.name, offer: fixture.offer, responses: ["Send a message", "Request a quote or estimate", "Book an appointment or consultation"] });
    delete s.answers.responseOther; delete s.provenance.responseOther;
    for (const key of Object.keys(s.answers)) s.provenance[key] ??= { source: "prospect-supplied", confirmation: "unconfirmed", suppliedAt: s.submitted_at };
    s.digest = submissionDigest(s);
    const p = evidencePacket(owner, s, evidence, "Synthetic contextual interpretation test", presence, await loadSolutionContext());
    const output = draft(); output.format = "consultative/2"; output.firstDirection.text = fixture.next; output.firstDirection.evidence = ["intake:offer"];
    const result = await synthesize({ packet: p, operation: "free-review", authorizedAttempts: 1 }, { mode: "development-manual", async synthesize(request) {
      assert.deepEqual(request.packet.submission.answers.responses, s.answers.responses);
      assert.equal(request.packet.submission.answers.offer, fixture.offer);
      assert.equal(request.packet.solutionContext!.synthesisPolicy!.responseOptions, "unranked-signals");
      assert.match(request.guidance!, /primary desired next step from the full intake/);
      assert.equal(request.packet.solutionContext!.synthesisPolicy!.primaryActionBasis, "full-business-context");
      return output;
    } });
    assert.equal(result.firstDirection.text, fixture.next);
    assert.ok(!reviewMarkdown(result).includes("unranked-signals"));
  }
});


test("optional ongoing input is bounded separately from managed work and interview learning cannot be activated", async () => {
  const context = await loadSolutionContext(), policy = context.synthesisPolicy!;
  assert.equal(policy.ongoingInput!.mode, "optional-after-onboarding");
  assert.equal(policy.ongoingInput!.interface, "deferred");
  assert.ok(policy.ongoingInput!.examples.includes("new ideas"));
  assert.ok(policy.ongoingInput!.examples.includes("meaningful business changes"));
  assert.ok(policy.managedServiceResponsibilities.includes("opportunity identification"));
  assert.ok(!policy.customerResponsibilities.includes("optimization"));
  assert.equal(policy.interviewLearning, "deferred-no-cross-prospect-reuse");
  for (const change of [{ interviewLearning: "automatic-theme-mining" }, { ongoingInput: { ...policy.ongoingInput, interface: "customer-portal" } }, { ongoingInput: { ...policy.ongoingInput, mode: "required-daily-updates" } }]) {
    const bad = structuredClone(context); Object.assign(bad.synthesisPolicy!, change); assert.throws(() => validateSolutionContext(bad));
  }
  const p = evidencePacket(owner, submission, evidence, "Synthetic optional-input boundary", presence, context);
  const other = structuredClone(submission); other.answers.businessName = "Other private synthetic business"; other.digest = submissionDigest(other);
  const foreignPacket = evidencePacket(owner, other, evidence, "Separate synthetic prospect", presence, context);
  await synthesize({ packet: p, operation: "free-review", authorizedAttempts: 1 }, { mode: "development-manual", async synthesize(request) {
    assert.deepEqual(request.packet.submission, submission);
    assert.ok(!JSON.stringify(request).includes(foreignPacket.submission.answers.businessName as string));
    assert.equal(request.packet.solutionContext!.synthesisPolicy!.interviewLearning, "deferred-no-cross-prospect-reuse");
    const d = draft(); d.format = "consultative/2"; return d;
  } });
  for (const bad of [Object.assign(structuredClone(p), { priorSubmissions: [other] }), { ...p, solutionContext: { ...context, interviewCorpus: [other.answers] } }]) assert.throws(() => validatePacket(bad));
  for (const version of ["review-writing/2", "review-writing/3"] as const) {
    const legacy = structuredClone(context); legacy.writingGuidance!.version = version; delete legacy.synthesisPolicy!.ongoingInput; delete legacy.synthesisPolicy!.interviewLearning; validateSolutionContext(legacy);
  }
});
