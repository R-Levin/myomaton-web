import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { JSDOM } from "jsdom";
import { fingerprint } from "../lib/platform/canonical/model";
import { bindClaimIdentities, evidencePacket, reviewClaims, submissionDigest, validateDraft, validatePacket, type Claim, type ReviewDraft, type Submission, type ReviewEvidencePacket } from "../lib/platform/reviews/model";
import { prospectInterview, claimSources } from "../lib/platform/reviews/operator-context";
import { questionnaireFor, snapshotQuestionnaire } from "../lib/platform/reviews/questionnaire";
import { reviewHtml } from "../lib/platform/reviews/presentation";
import { LocalReviewStore, reviewRoot, revisionDigest, type ReviewState } from "../lib/platform/reviews/store";

const owner = { webPresenceId: "00000000-0000-4000-8000-000000000011", managedSiteId: "00000000-0000-4000-8000-000000000012" };
function source(): Submission {
  const answers = { project: "Improve or replace an existing Web presence", businessName: "Synthetic operator context", website: "https://example.test/", audience: "  Owner-led teams\nwith recurring needs.  ", goals: ["Get more qualified leads", "Something else"], goalOther: "Reduce repeated explanation", offer: "Managed help", difference: "Not yet established", problem: "Unclear next step", reviewFocus: "Clearer direction", responses: ["Send a message"], serviceArea: "Primarily online / location is not important", contactName: "Synthetic operator fixture", email: "private-context@example.test", additional: "" };
  const submission: Submission = { id: randomUUID(), intake_id: randomUUID(), web_presence_id: owner.webPresenceId, entry_intent: "FREE_REVIEW", questionnaire_version: "foundational-intake/1", draft_version: 1, answers, provenance: Object.fromEntries(Object.keys(answers).map(k => [k, { source: "prospect-supplied", confirmation: "unconfirmed", suppliedAt: "2026-10-17T12:00:00Z" }])), submitted_at: "2026-10-17T12:00:00Z", digest: "" };
  submission.digest = submissionDigest(submission); return submission;
}
const packet = (submission = source()) => evidencePacket(owner, submission, [{ id: "page", kind: "operator", source: "http://127.0.0.1:55555/service", text: "A managed service is described.", capturedAt: "2026-10-17T12:00:00Z", coverage: "Rendered text only; delivery and results unverified." }], "Synthetic source; no canonical business data");
const c = (kind: Claim["kind"] = "RECOMMENDATION", value = "Your next step could be clearer.", evidence = ["intake:audience"]): Claim => ({ kind, text: value, evidence });
function draft(): ReviewDraft { return { understanding: c("PROSPECT_SUPPLIED_UNCONFIRMED", "You want a clearer next step."), startingPoint: { framing: "existing", content: c("FACT", "A managed service is described.", ["page"]) }, opportunities: [1, 2, 3].map(i => ({ title: `Synthetic opportunity ${i}`, what: c("OBSERVATION", "Your answers suggest a clarity opportunity.", ["intake:audience", "page"]), why: c(), direction: c() })), firstDirection: c(), conversion: c("UNKNOWN", "Results remain unknown.", ["page"]), fit: { assessment: "conditional", content: c() }, teaser: { status: "not-generated", content: c("UNKNOWN", "No concept is promised.") } }; }
function review(p = packet(), d = draft()): ReviewState { return { id: randomUUID(), packet: p, state: "NEEDS_OPERATOR_REVIEW", revisions: [{ number: 1, content: d, digest: fingerprint(d), source: "development-manual", at: "2026-10-17T12:00:00Z", actor: "synthetic fixture" }], decisions: [] }; }
function legacy(p: ReviewEvidencePacket) { const { questionnaireContext: _, digest: __, ...body } = p; void _; void __; return { ...body, digest: fingerprint(body) }; }

test("operator shows Review and grouped Q&A before secondary evidence/technical details; customer copy stays clean", () => {
  const r = review(), doc = new JSDOM(reviewHtml(r, true)).window.document;
  const headings = [...doc.querySelectorAll("h2")].map(h => h.textContent!);
  assert.ok(headings.indexOf("What we understand") < headings.indexOf("Prospect Q&A"));
  assert.equal(doc.querySelectorAll("details.claim-evidence").length, 15);
  assert.equal(doc.querySelector("details:last-child")?.hasAttribute("open"), false);
  assert.match(doc.body.textContent!, /Who are you most trying to reach\?/);
  assert.match(doc.body.textContent!, /private-context@example.test/);
  assert.ok([...doc.querySelectorAll(".stored-answer")].some(p => p.textContent === r.packet.submission.answers.audience));
  const customer = reviewHtml(r);
  for (const privateText of ["Prospect Q&amp;A", "Why this says this", "intake:audience", "private-context@example.test", "Owner-led teams", "source hashes", "technical diagnostics"]) assert.ok(!customer.includes(privateText), privateText);
});
test("claim evidence resolves all references with exact answers, question wording, captured text and limitations", () => {
  const p = packet(), sources = claimSources(c("OBSERVATION", "Your answers suggest a direction.", ["intake:audience", "page"]), p);
  assert.equal(sources.length, 2); const intake = sources[0]; assert.equal(intake.type, "intake");
  if (intake.type === "intake") { assert.equal(intake.question, "Who are you most trying to reach?"); assert.equal(intake.field.answer, p.submission.answers.audience); assert.equal(intake.field.provenance.confirmation, "unconfirmed"); }
  const page = sources[1]; assert.equal(page.type, "page"); if (page.type === "page") { assert.equal(page.source, "http://127.0.0.1:55555/service"); assert.equal(page.observation, p.evidence[0].text); assert.equal(page.limitations, p.evidence[0].coverage); }
  const html = reviewHtml(review(p), true); for (const label of ["Fact", "Prospect-supplied / unconfirmed", "Observation", "Recommendation", "Unknown / needs confirmation", "not proof"]) assert.ok(html.includes(label));
});
test("questionnaire order/grouping, arrays and conditional wording survive without optional-answer noise", () => {
  const p = packet(), interview = prospectInterview(p);
  assert.deepEqual(interview.groups.map(g => g.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.deepEqual(interview.groups[1].fields.map(f => f.key), ["businessName", "website"]);
  assert.deepEqual(interview.groups[2].fields.map(f => f.key), ["goals", "goalOther"]);
  assert.deepEqual(interview.groups[2].fields[0].answer, p.submission.answers.goals);
  assert.ok(!interview.groups.flatMap(g => g.fields).some(f => ["additional", "phone", "publicProfile", "bookingContext", "locations"].includes(f.key)));
  const startup = source(); startup.answers.project = "Build a new Web presence from scratch"; startup.digest = submissionDigest(startup);
  assert.equal(snapshotQuestionnaire(startup).groups[6].title, "What is the biggest challenge in establishing your new Web presence?");
  startup.entry_intent = "DIRECT_START";
  assert.equal(snapshotQuestionnaire(startup).groups[7].title, "What would make getting started most useful to you?");
});
test("new packet binds validated context; altered/missing/duplicate/version-mismatched semantic context refuses", () => {
  const p = packet(); assert.ok(p.questionnaireContext); assert.equal(p.questionnaireContext.definitionCommit, "e4d48e5b22a60825bf64f8543f3b7980486a0b7c");
  const changed = structuredClone(p); changed.questionnaireContext!.groups[0].title = "Changed wording"; assert.throws(() => validatePacket(changed), /Changed evidence packet/);
  for (const mutate of [
    (p: typeof changed) => { p.questionnaireContext!.questionnaireVersion = "another-version"; },
    (p: typeof changed) => { p.questionnaireContext!.groups[0].number = 12; },
    (p: typeof changed) => { p.questionnaireContext!.groups[1].fields[0].key = "project"; },
    (p: typeof changed) => { p.questionnaireContext!.groups[3].fields = []; },
    (p: typeof changed) => { Object.assign(p.questionnaireContext!, { executable: "some function" }); },
  ]) { const q = structuredClone(p); mutate(q); const { digest: _, ...body } = q; void _; q.digest = fingerprint(body); assert.throws(() => validatePacket(q)); }
});
test("embedded wording resolves independently of current version definitions, while legacy stays explicitly pinned and unchanged", () => {
  const old = legacy(packet()), before = JSON.stringify(old), resolved = questionnaireFor(old.submission);
  assert.equal(resolved.mode, "legacy-pinned"); assert.match(reviewHtml(review(old), true), /Legacy wording resolved/); assert.equal(JSON.stringify(old), before);
  const future = packet(); future.submission.questionnaire_version = "synthetic-future/7"; future.submission.digest = submissionDigest(future.submission);
  future.questionnaireContext!.questionnaireVersion = future.submission.questionnaire_version; future.questionnaireContext!.groups[3].title = "Which teams should recognize themselves?";
  const { digest: _, ...body } = future; void _; future.digest = fingerprint(body); validatePacket(future);
  assert.equal(questionnaireFor(future.submission, future.questionnaireContext).mode, "embedded");
  assert.match(reviewHtml(review(future), true), /Which teams should recognize themselves\?/);
  assert.throws(() => snapshotQuestionnaire(future.submission), /No pinned questionnaire/);
});
test("source answers and observations are escaped rather than interpreted as HTML", () => {
  const s = source(); s.answers.audience = '<img src=x onerror="bad()">'; s.digest = submissionDigest(s);
  const doc = new JSDOM(reviewHtml(review(packet(s)), true)).window.document;
  assert.equal(doc.querySelectorAll("img,script").length, 0); assert.ok(doc.body.textContent!.includes(s.answers.audience));
});
test("bounded future claim identities are unique, stable for normal edits and absent from legacy/customer output", () => {
  const id = randomUUID(), first = bindClaimIdentities(draft(), id); assert.equal(new Set(reviewClaims(first).map(r => r.claim.id)).size, 15);
  const edited = structuredClone(first); edited.understanding.text = "You want a more focused next step.";
  assert.deepEqual(reviewClaims(bindClaimIdentities(edited, id)).map(c => c.claim.id), reviewClaims(first).map(c => c.claim.id));
  assert.throws(() => bindClaimIdentities(first, randomUUID()), /different Review/);
  const duplicate = structuredClone(first); duplicate.conversion.id = duplicate.understanding.id; assert.throws(() => validateDraft(duplicate, packet()), /duplicate claim/);
  assert.ok(!reviewHtml(review(packet(), first)).includes(first.understanding.id!));
  assert.match(reviewHtml(review(legacy(packet())), true), /Legacy claim location/);
});
test("synthetic future edit snapshots wording and claim IDs without rewriting legacy packet/revision; digests bind context", async () => {
  const previousEnv = { NODE_ENV: process.env.NODE_ENV, MIOPAGES_REVIEW_SYNTHESIS: process.env.MIOPAGES_REVIEW_SYNTHESIS };
  Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" });
  const id = randomUUID(), dir = path.resolve(reviewRoot(), id), p = legacy(packet()), d = draft(), at = "2026-10-17T12:00:00Z";
  try {
    await mkdir(dir, { recursive: true });
    const revision = { number: 1, content: d, digest: fingerprint(d), source: "development-manual", at, actor: "synthetic legacy fixture" };
    const event = { sequence: 1, previous: null, action: "create", actor: "synthetic legacy fixture", at, note: "Synthetic historical packet only", binding: { revision: 1, revisionDigest: revision.digest, evidenceDigest: p.digest, submissionDigest: p.submission.digest }, revision };
    const packetBytes = JSON.stringify(p), eventBytes = JSON.stringify({ ...event, hash: fingerprint(event) });
    await writeFile(path.join(dir, "packet.json"), packetBytes, { flag: "wx" }); await writeFile(path.join(dir, "000001.json"), eventBytes, { flag: "wx" });
    const store = new LocalReviewStore(id, owner); assert.equal((await store.read()).revisions[0].questionnaireContext, undefined);
    const edited = await store.append("edit", await store.currentBinding(), d, "synthetic edit test", "Not a recovered human revision"); const latest = edited.revisions.at(-1)!;
    assert.ok(latest.questionnaireContext); assert.equal(revisionDigest(latest.content, latest.questionnaireContext, latest.editNotes), latest.digest); assert.ok(latest.content.understanding.id);
    const next = structuredClone(latest.content); next.firstDirection.text = "Focus on a clearer next step.";
    const again = await store.append("edit", await store.currentBinding(), next, "synthetic edit test", "Synthetic identity stability");
    assert.deepEqual(reviewClaims(again.revisions.at(-1)!.content).map(c => c.claim.id), reviewClaims(latest.content).map(c => c.claim.id));
    assert.equal(await readFile(path.join(dir, "packet.json"), "utf8"), packetBytes); assert.equal(await readFile(path.join(dir, "000001.json"), "utf8"), eventBytes);
    await assert.rejects(new LocalReviewStore(id, { ...owner, managedSiteId: randomUUID() }).read());
  } finally { assert.equal(path.dirname(dir), reviewRoot()); await rm(dir, { recursive: true, force: true }); for (const [k, v] of Object.entries(previousEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
});
