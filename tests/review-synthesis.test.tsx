import assert from "node:assert/strict";
import test from "node:test";
import { readFile, writeFile, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fingerprint } from "../lib/platform/canonical/model";
import { evidencePacket, validatePacket, validateDraft, synthesize, manualModelAdapter, qualityChecks, type Claim, type ReviewDraft, type Submission, type PresenceCoverage } from "../lib/platform/reviews/model";
import { LocalReviewStore, reviewRoot } from "../lib/platform/reviews/store";
import { reviewHtml, reviewMarkdown } from "../lib/platform/reviews/presentation";
import { fromSubmission, originalHumanPacket } from "../scripts/reviews/source";

const owner = { webPresenceId: "926cb772-7507-4542-8acd-e7e57ce71324", managedSiteId: "312b8081-4582-47fa-bedb-a551fd6e2b36" };
const submission: Submission = { id: "00000000-0000-4000-8000-000000000001", intake_id: "00000000-0000-4000-8000-000000000002", web_presence_id: owner.webPresenceId, entry_intent: "FREE_REVIEW", questionnaire_version: "foundational-intake/1", draft_version: 1, answers: { businessName: "Synthetic Review test", project: "Improve or replace an existing Web presence", website: "https://example.test/" }, provenance: Object.fromEntries(["businessName", "project", "website"].map(k => [k, { source: "prospect-supplied", confirmation: "unconfirmed", suppliedAt: "2026-10-15T00:00:00Z" }])), digest: "", submitted_at: "2026-10-15T00:00:00Z" };
submission.digest = fingerprint({ intent: submission.entry_intent, questionnaireVersion: submission.questionnaire_version, draftVersion: submission.draft_version, answers: submission.answers, provenance: submission.provenance });
const packet = () => evidencePacket(owner, submission, [{ id: "home", kind: "public-web", source: "https://example.test/", capturedAt: "2026-10-15T00:00:00Z", text: "An account link is visible.", coverage: "Homepage text only; no function testing." }], "Synthetic evidence; no real prospect.");
const claim = (kind: Claim["kind"] = "RECOMMENDATION", text = "Your next step could be easier to understand."): Claim => ({ kind, text, evidence: ["intake:project"] });
const draft = (): ReviewDraft => ({ understanding: claim("PROSPECT_SUPPLIED_UNCONFIRMED", "You describe an existing business presence."), startingPoint: { framing: "existing", content: { kind: "FACT", text: "An account link is visible.", evidence: ["home"] } }, opportunities: [1, 2, 3].map(n => ({ title: `Priority ${n}`, what: claim("OBSERVATION"), why: claim("OBSERVATION"), direction: claim() })), firstDirection: claim(), conversion: claim("UNKNOWN", "We cannot confirm whether the contact path works."), fit: { assessment: "conditional", content: claim() }, teaser: { status: "not-generated", content: claim("UNKNOWN", "A concept may be useful later; none is promised.") } });
const env = { ...process.env, NODE_ENV: "development" as const, MIOPAGES_REVIEW_SYNTHESIS: "local-operator" };


test("original-human preservation source requires explicit valid configuration without a machine fallback", async () => {
  for (const value of [undefined, "", "   ", "relative/bundle", "https://example.test/bundle", path.join(tmpdir(), "bundle") + "\n"]) {
    await assert.rejects(originalHumanPacket([], "No source fallback", undefined,
      value === undefined ? {} : { MIOPAGES_REVIEW_PRESERVATION_BUNDLE: value }), /MIOPAGES_REVIEW_PRESERVATION_BUNDLE must name an explicit absolute/);
  }
});
test("explicit preservation directory is used and unrelated or altered source is refused", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "review-preservation-"));
  const sourceEnv = { MIOPAGES_REVIEW_PRESERVATION_BUNDLE: directory };
  try {
    await assert.rejects(originalHumanPacket([], "Explicit source only", undefined, sourceEnv),
      (error: unknown) => error instanceof Error && "code" in error && error.code === "ENOENT" && "path" in error && error.path === path.join(directory, "manifest.json"));
    // Selecting a different directory cannot authorize another human case or bypass the pinned manifest.
    await writeFile(path.join(directory, "manifest.json"), JSON.stringify({ records: [{ role: "firstHuman", file: "other-human.json" }] }));
    await assert.rejects(originalHumanPacket([], "Reject unrelated source", undefined, sourceEnv), /Preservation authority changed/);
    await writeFile(path.join(directory, "manifest.json"), "{}");
    await assert.rejects(originalHumanPacket([], "Reject changed source", undefined, sourceEnv), /Preservation authority changed/);
  } finally { await rm(directory, { recursive: true }); }
});
test("original-human CLI explains missing preservation configuration before creating a Review", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "review-preservation-cli-"));
  const commandEnv: NodeJS.ProcessEnv = { ...env };
  delete commandEnv.MIOPAGES_REVIEW_PRESERVATION_BUNDLE;
  try {
    const capture = path.join(directory, "capture.json");
    await writeFile(capture, JSON.stringify({ evidence: [], coverage: "Synthetic config test" }));
    const out = spawnSync(process.execPath, ["--import", "tsx", "scripts/review-synthesis.ts", "prepare-original", "--evidence", capture],
      { encoding: "utf8", windowsHide: true, env: commandEnv });
    assert.equal(out.status, 1);
    assert.match(out.stderr, /MIOPAGES_REVIEW_PRESERVATION_BUNDLE must name an explicit absolute/);
    assert.equal(out.stdout, "");
  } finally { await rm(directory, { recursive: true }); }
});

test("preserved and durable logical submission adapters preserve exact immutable answers, provenance and digest", () => {
  const before = structuredClone(submission); const p = fromSubmission(submission, owner, [], "Submitted evidence only");
  p.submission.answers.businessName = "Modified copy"; assert.deepEqual(submission, before); assert.throws(() => validatePacket(p));
  const durable = structuredClone(submission); assert.deepEqual(fromSubmission(durable, owner, [], "Submitted evidence only"), fromSubmission(before, owner, [], "Submitted evidence only"));
  const bad = structuredClone(submission); bad.provenance.businessName.confirmation = "confirmed"; bad.digest = fingerprint({ intent: bad.entry_intent, questionnaireVersion: bad.questionnaire_version, draftVersion: bad.draft_version, answers: bad.answers, provenance: bad.provenance });
  assert.throws(() => evidencePacket(owner, bad, [], "No automatic confirmation"));
});
test("packet bounds, source timestamps, owner and submitted-URL restrictions reject unsupported evidence", () => {
  const p = packet(); validatePacket(p);
  for (const mutate of [(p: ReturnType<typeof packet>) => { p.owner.webPresenceId = "00000000-0000-4000-8000-000000000004"; }, (p: ReturnType<typeof packet>) => { p.evidence[0].source = "http://localhost/secret"; }, (p: ReturnType<typeof packet>) => { p.evidence[0].capturedAt = "bad"; }, (p: ReturnType<typeof packet>) => { p.evidence.push(p.evidence[0]); }]) { const other = structuredClone(p); mutate(other); const { digest: _, ...body } = other; void _; other.digest = fingerprint(body); assert.throws(() => validatePacket(other)); }
});
test("Review contract rejects missing sections, opportunity count, long copy, unsupported references, HTML and provider/reasoning keys", () => {
  validateDraft(draft(), packet());
  const mutations = [(d: ReviewDraft) => { delete (d as Partial<ReviewDraft>).conversion; }, (d: ReviewDraft) => { d.opportunities.pop(); }, (d: ReviewDraft) => { d.understanding.text = "x".repeat(551); }, (d: ReviewDraft) => { d.firstDirection.evidence = ["made-up"]; }, (d: ReviewDraft) => { d.conversion.text = "<script>alert(1)</script>"; }, (d: ReviewDraft) => { Object.assign(d, { provider: "secret", reasoning: "hidden" }); }];
  for (const mutate of mutations) { const d = draft(); mutate(d); assert.throws(() => validateDraft(d, packet())); }
});
test("free/paid rules, attribution and factual support cannot be bypassed by plausible prose", () => {
  for (const text of ["Here is your final sitemap.", "Your finished page copy follows.", "1. Install this\n2. Paste this", "Your complete SEO implementation plan."]) { const d = draft(); d.firstDirection.text = text; assert.throws(() => validateDraft(d, packet())); }
  const d = draft(); d.understanding.text = "The business is the market leader."; assert.throws(() => validateDraft(d, packet()));
  d.understanding = claim("FACT", "The business is the market leader."); assert.throws(() => validateDraft(d, packet()));
});
test("startup framing and all four fit outcomes are supported without invented website findings", () => {
  for (const assessment of ["strong", "conditional", "insufficient-information", "not-a-good-fit"] as const) { const d = draft(); d.fit.assessment = assessment; validateDraft(d, packet()); }
  const p = packet(); p.submission.answers.project = "Build a new Web presence from scratch";
  p.submission.digest = fingerprint({ intent: p.submission.entry_intent, questionnaireVersion: p.submission.questionnaire_version, draftVersion: p.submission.draft_version, answers: p.submission.answers, provenance: p.submission.provenance });
  const updated = evidencePacket(owner, p.submission, [], "No existing presence inspected"); const d = draft(); d.startingPoint = { framing: "starting-from-scratch", content: claim("PROSPECT_SUPPLIED_UNCONFIRMED", "You are starting from scratch.") }; validateDraft(d, updated);
});
test("manual provider is explicit and live/production dispatch fails before any call", async () => {
  const request = { packet: packet(), operation: "free-review" as const, authorizedAttempts: 1 as const }; let calls = 0;
  await synthesize(request, manualModelAdapter(draft()), env);
  await assert.rejects(synthesize(request, { mode: "live", async synthesize() { calls++; return draft(); } }, env)); assert.equal(calls, 0);
  await assert.rejects(synthesize(request, manualModelAdapter(draft()), { ...env, NODE_ENV: "production" }));
});
test("local history persists immutable revisions, exact approval bindings, QC and tenant isolation without a customer writer", async () => {
  const oldEnv = { NODE_ENV: process.env.NODE_ENV, MIOPAGES_REVIEW_SYNTHESIS: process.env.MIOPAGES_REVIEW_SYNTHESIS }; Object.assign(process.env, env);
  let store: LocalReviewStore | undefined;
  try {
    store = await LocalReviewStore.create(packet(), draft(), "synthetic-test-operator"); const first = await store.currentBinding();
    await assert.rejects(store.append("deliver" as "edit", first, null, "operator", "Unsupported action"));
    await assert.rejects(store.append("approve", first, null, "operator", "Cannot approve a draft", {}));
    await store.append("request-review", first, null, "operator", "Ready for synthetic QC");
    await assert.rejects(store.append("approve", first, null, "operator", "Missing QC", {}));
    const approved = await store.append("approve", first, null, "synthetic-test-operator", "Synthetic mechanics only", Object.fromEntries(qualityChecks.map(k => [k, true]))); assert.equal(approved.state, "APPROVED"); assert.deepEqual(approved.decisions.at(-1)!.binding, first);
    const raw = await readFile(path.join(reviewRoot(), store.id, "000001.json"), "utf8"); const d = draft(); d.firstDirection.text = "Clarify the most useful next step first.";
    const edited = await store.append("edit", first, d, "operator", "Synthetic revision"); assert.equal(edited.state, "DRAFT"); assert.equal(edited.revisions.length, 2); assert.equal(await readFile(path.join(reviewRoot(), store.id, "000001.json"), "utf8"), raw);
    await store.append("request-review", await store.currentBinding(), null, "operator", "Review edited copy");
    await assert.rejects(store.append("approve", first, null, "operator", "Stale approval", Object.fromEntries(qualityChecks.map(k => [k, true]))));
    await assert.rejects(new LocalReviewStore(store.id, { ...owner, managedSiteId: "foreign" }).read());
    assert.deepEqual((await store.read()).packet.submission, submission);
    const html = reviewHtml(await store.read()); assert.ok(!html.includes(submission.id)); assert.ok(!html.includes("development-manual")); assert.match(reviewMarkdown(d), /What we understand/);
    const f = path.join(reviewRoot(), store.id, "000001.json"); await writeFile(f, raw.replace("Initial development/manual draft", "Changed history")); await assert.rejects(store.read());
  } finally { if (store) { const directory = path.resolve(reviewRoot(), store.id); assert.equal(path.dirname(directory), reviewRoot()); await rm(directory, { recursive: true }); } for (const [k, v] of Object.entries(oldEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
});
test("production operator CLI refuses before opening a store or starting an HTTP listener", () => {
  const out = spawnSync(process.execPath, ["--import", "tsx", "scripts/review-synthesis.ts", "preview", "--id", "00000000-0000-4000-8000-000000000001"], { encoding: "utf8", windowsHide: true, env: { ...process.env, NODE_ENV: "production", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" } });
  assert.equal(out.status, 1); assert.ok(!out.stdout.includes("http://"));
});

function developmentPacket() {
  const a = packet(), at = a.evidence[0].capturedAt, base = "http://127.0.0.1:59123";
  const presence: PresenceCoverage = { version: "development-presence/1", label: "Draft B — Development Presence", baseUrl: base, observedVersion: "Synthetic rendered captures; no internal business data", discovered: [{ route: "/", title: "Home" }, { route: "/service", title: "Service" }, { route: "/faq", title: "FAQ" }], reviewed: [{ route: "/", purpose: "Positioning against stated intake intent", capturedAt: at, limitations: "Text/links only", evidenceId: "home", snapshotSha256: "1".repeat(64) }, { route: "/service", purpose: "Supporting offer explanation", capturedAt: at, limitations: "No business claim independently verified", evidenceId: "service", snapshotSha256: "2".repeat(64) }], omitted: [{ route: "/faq", reason: "Not needed for bounded offer and conversion review" }] };
  return evidencePacket(owner, submission, [{ ...a.evidence[0], kind: "operator", source: base + "/" }, { id: "service", kind: "operator", source: base + "/service", capturedAt: at, text: "A service explanation is visible.", coverage: "Rendered text; no canonical records." }], "Explicit operator-controlled development target; intake remains unconfirmed", presence);
}
test("representative development coverage accounts for every discovered route and refuses mixed/legacy evidence", () => {
  const a = packet(), before = structuredClone(a), b = developmentPacket(); validatePacket(b); validateDraft(draft(), b);
  assert.deepEqual(b.submission, a.submission); assert.equal(b.submission.digest, a.submission.digest); assert.notEqual(b.digest, a.digest); assert.deepEqual(a, before);
  for (const mutate of [
    (p: typeof b) => { p.evidence[0].source = "https://example.test/"; },
    (p: typeof b) => { p.evidence.push(a.evidence[0]); },
    (p: typeof b) => { p.presence!.omitted = []; },
    (p: typeof b) => { p.presence!.reviewed[0].route = "/invented"; },
    (p: typeof b) => { p.presence!.reviewed[0].snapshotSha256 = "unverified"; },
    (p: typeof b) => { p.presence!.reviewed[0].capturedAt = "2026-10-16T00:00:00Z"; },
    (p: typeof b) => { p.presence!.baseUrl = "https://example.test/"; },
  ]) { const changed = structuredClone(b); mutate(changed); const { digest: _, ...body } = changed; void _; changed.digest = fingerprint(body); assert.throws(() => validatePacket(changed)); }
});
test("separate Review variants preserve prior files/history and keep coverage out of customer copy", async () => {
  const saved = { NODE_ENV: process.env.NODE_ENV, MIOPAGES_REVIEW_SYNTHESIS: process.env.MIOPAGES_REVIEW_SYNTHESIS }; Object.assign(process.env, env);
  const stores: LocalReviewStore[] = [];
  try {
    const a = await LocalReviewStore.create(packet(), draft(), "synthetic-variant-test"); stores.push(a);
    await a.append("request-review", await a.currentBinding(), null, "synthetic-variant-test", "Variant A test");
    const before = await a.read(), firstBytes = await readFile(path.join(reviewRoot(), a.id, "000001.json"), "utf8"), packetBytes = await readFile(path.join(reviewRoot(), a.id, "packet.json"), "utf8");
    const b = await LocalReviewStore.create(developmentPacket(), draft(), "synthetic-variant-test"); stores.push(b);
    const queued = await b.append("request-review", await b.currentBinding(), null, "synthetic-variant-test", "Separate variant B test");
    assert.notEqual(a.id, b.id); assert.equal(queued.state, "NEEDS_OPERATOR_REVIEW"); assert.equal(queued.revisions.length, 1); assert.deepEqual(await a.read(), before);
    assert.equal(await readFile(path.join(reviewRoot(), a.id, "000001.json"), "utf8"), firstBytes); assert.equal(await readFile(path.join(reviewRoot(), a.id, "packet.json"), "utf8"), packetBytes);
    assert.match(reviewHtml(queued, true), /Representative Page coverage/); assert.match(reviewHtml(queued, true), /Discovered, not reviewed/);
    assert.ok(!reviewHtml(queued).includes("Representative Page coverage")); assert.ok(!reviewMarkdown(queued.revisions[0].content).includes("Development Presence"));
  } finally { for (const store of stores) { const dir = path.resolve(reviewRoot(), store.id); assert.equal(path.dirname(dir), reviewRoot()); await rm(dir, { recursive: true }); } for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
});
