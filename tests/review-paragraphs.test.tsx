import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { JSDOM } from "jsdom";
import { evidencePacket, submissionDigest, validateDraft, bindClaimIdentities, reviewClaims, qualityChecks, type Claim, type ReviewDraft, type Submission } from "../lib/platform/reviews/model";
import { LocalReviewStore, reviewRoot } from "../lib/platform/reviews/store";
import { reviewHtml, reviewMarkdown, reviewSections } from "../lib/platform/reviews/presentation";
import { compareRevisions, comparisonMarkdown } from "../lib/platform/reviews/revision-context";
import { editedMarkdown, beginHumanEdit, inspectHumanEdit, saveHumanEdit, editRoot } from "../scripts/reviews/editing";
import { loadSolutionContext } from "../scripts/reviews/context";

Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" });
const c = (text: string): Claim => ({ kind: "RECOMMENDATION", text, evidence: ["intake:audience"] });
async function fixture() {
  const owner = { webPresenceId: randomUUID(), managedSiteId: randomUUID() }, answers = { businessName: "Synthetic paragraph test", audience: "Synthetic small teams", project: "Improve or replace an existing Web presence" };
  const s: Submission = { id: randomUUID(), intake_id: randomUUID(), web_presence_id: owner.webPresenceId, entry_intent: "FREE_REVIEW", questionnaire_version: "foundational-intake/1", draft_version: 1, answers, provenance: Object.fromEntries(Object.keys(answers).map(key => [key, { source: "prospect-supplied", confirmation: "unconfirmed", suppliedAt: "2026-10-18T00:00:00Z" }])), digest: "", submitted_at: "2026-10-18T00:00:00Z" }; s.digest = submissionDigest(s);
  const packet = evidencePacket(owner, s, [{ id: "page", kind: "operator", source: "http://127.0.0.1:55555/", text: "A synthetic service explanation.", capturedAt: s.submitted_at, coverage: "Synthetic captured text only." }], "Synthetic only", undefined, await loadSolutionContext());
  const draft: ReviewDraft = { format: "consultative/2", understanding: c("Your audience needs clear answers."), startingPoint: { framing: "existing", content: c("Your explanation is a starting point.") }, opportunities: [1, 2, 3].map(i => ({ title: `Synthetic priority ${i}`, what: c("Your readers need to decide."), why: c("Useful explanations help that decision."), direction: c("Make the next action useful.") })), firstDirection: c("Begin with a useful explanation."), conversion: c("Help people continue the conversation."), ongoing: c("Your original ongoing direction."), fit: { assessment: "conditional", content: c("A managed relationship could help.") }, teaser: { status: "not-generated", content: c("Internal status only.") } };
  const store = await LocalReviewStore.create(packet, draft, "synthetic paragraph test"); await store.append("request-review", await store.currentBinding(), null, "synthetic", "Synthetic baseline"); return store;
}
const paragraphs = ["Your first paragraph has  two spaces and an owner’s question.", "Your second paragraph keeps its own meaning.\nIt also keeps this hard wrap.", "Your third paragraph states the intended outcome."];
const split = (d: ReviewDraft, prose = paragraphs) => reviewMarkdown(d).replace(d.ongoing!.text, prose.join("\n\n"));
async function cleanup(store: LocalReviewStore, dirs: string[] = []) { for (const dir of dirs) { assert.equal(path.dirname(dir), editRoot()); await rm(dir, { recursive: true }); } const dir = path.join(reviewRoot(), store.id); assert.equal(path.dirname(dir), reviewRoot()); await rm(dir, { recursive: true }); }

test("flat continuation paragraphs keep individual 550-character bounds, identities and existing closed validation", async () => {
  const store = await fixture();
  try { const r = await store.read(), d = structuredClone(r.revisions[0].content); d.ongoing!.additionalParagraphs = [c("Your second paragraph."), c("Your third paragraph.")]; validateDraft(bindClaimIdentities(d, store.id), r.packet);
    const long = structuredClone(d); long.ongoing!.additionalParagraphs![0].text = "x".repeat(551); assert.throws(() => validateDraft(long, r.packet), /Invalid canonical text/);
    const nested = structuredClone(d); Object.assign(nested.ongoing!.additionalParagraphs![0], { additionalParagraphs: [c("Not allowed.")] }); assert.throws(() => validateDraft(nested, r.packet), /Unknown canonical field/);
    const excessive = structuredClone(d); excessive.ongoing!.additionalParagraphs = Array.from({ length: 5 }, () => c("Too many units.")); assert.throws(() => validateDraft(excessive, r.packet), /five flat/);
    const duplicate = bindClaimIdentities(d, store.id); duplicate.ongoing!.additionalParagraphs![0].id = duplicate.ongoing!.id; assert.throws(() => validateDraft(duplicate, r.packet), /duplicate claim/);
    const first = bindClaimIdentities(d, store.id), again = bindClaimIdentities(first, store.id); assert.deepEqual(reviewClaims(first).map(row => row.claim.id), reviewClaims(again).map(row => row.claim.id)); assert.equal(new Set(reviewClaims(first).map(row => row.claim.id)).size, reviewClaims(first).length);
  } finally { await cleanup(store); }
});

test("Markdown import preserves ordered prose, whitespace and paragraph boundaries without mutating its base", async () => {
  const store = await fixture();
  try { const r = await store.read(), base = r.revisions[0].content, before = JSON.stringify(base), input = split(base); const d = validateDraft(bindClaimIdentities(editedMarkdown(input, base), store.id), r.packet);
    assert.deepEqual([d.ongoing!.text, ...d.ongoing!.additionalParagraphs!.map(p => p.text)], paragraphs); assert.equal(JSON.stringify(base), before);
    assert.equal(d.ongoing!.id, base.ongoing!.id); assert.equal(d.ongoing!.additionalParagraphs!.length, 2);
    const groups = reviewSections(d), section = groups.find(s => s.title === "How your Web presence should improve over time")!; assert.deepEqual(section.paragraphs, paragraphs);
    const md = reviewMarkdown(d); for (const p of paragraphs) assert.ok(md.includes(p)); assert.ok(md.includes(paragraphs.join("\n\n")));
    assert.deepEqual(reviewSections(validateDraft(editedMarkdown(md, d), r.packet)).map(s => s.paragraphs), groups.map(s => s.paragraphs));
  } finally { await cleanup(store); }
});

test("changed and split paragraphs have candidate sources, no automatically asserted references, and readable diagnostics", async () => {
  const store = await fixture();
  try { const r = await store.read(), d = bindClaimIdentities(editedMarkdown(split(r.revisions[0].content), r.revisions[0].content), store.id), units = reviewClaims(d).filter(row => row.location.startsWith("ongoing"));
    assert.equal(units.length, 3); for (const row of units) { assert.deepEqual(row.claim.evidence, []); assert.deepEqual(row.claim.referenceReview!.candidateEvidence, ["intake:audience"]); assert.equal(row.claim.referenceReview!.sourceLocation, "ongoing"); assert.equal(row.claim.referenceReview!.sourceClaimId, r.revisions[0].content.ongoing!.id); }
    const view = structuredClone(r); view.revisions.push({ ...r.revisions[0], number: 2, content: d });
    const customer = new JSDOM(reviewHtml(view)).window.document; const section = [...customer.querySelectorAll("section")].find(s => s.querySelector("h2")?.textContent === "How your Web presence should improve over time")!; assert.deepEqual([...section.querySelectorAll("p")].map(p => p.textContent), paragraphs);
    const op = new JSDOM(reviewHtml(view, true)).window.document; assert.equal(op.querySelectorAll("#review details").length, 0); assert.equal(op.querySelector("#diagnostics")!.hasAttribute("open"), false); assert.match(reviewHtml(view, true, "diagnostics"), /Candidate references only/);
    for (const value of ["candidateEvidence", "sourceClaimId", "claim_", "Candidate references", "intake:"]) assert.ok(!reviewHtml(view).includes(value));
    const diff = compareRevisions(view, 1, 2).changes.filter(row => row.location.startsWith("ongoing")); assert.deepEqual(diff.map(row => row.change), ["changed", "added", "added"]); assert.ok(diff.every(row => row.claimId && row.newReferenceReview?.status === "candidate")); assert.match(comparisonMarkdown(view, 1, 2), /CANDIDATE ONLY/);
  } finally { await cleanup(store); }
});

test("synthetic one-to-many save preserves legacy files, refuses stale retry and cannot approve unresolved candidates", async () => {
  const store = await fixture(), dirs: string[] = [];
  try { const before = await store.read(), dir = path.join(reviewRoot(), store.id), event = await readFile(path.join(dir, "000001.json")), packet = await readFile(path.join(dir, "packet.json")), w = await beginHumanEdit(store); dirs.push(w.directory);
    await writeFile(w.review, split(before.revisions[0].content)); await writeFile(w.notes, JSON.stringify({ summary: "Separated three meanings.", entries: [{ location: "ongoing.paragraphs.1", note: "New responsibility paragraph requires source review." }] }));
    const after = await saveHumanEdit(store, w.directory, "synthetic", "Split paragraphs only"); assert.equal(after.state, "DRAFT"); assert.equal(after.revisions.length, 2); assert.deepEqual(await readFile(path.join(dir, "000001.json")), event); assert.deepEqual(await readFile(path.join(dir, "packet.json")), packet);
    await assert.rejects(saveHumanEdit(store, w.directory, "synthetic", "Stale"), /stale edit workspace/); const binding = await store.currentBinding(); await store.append("request-review", binding, null, "synthetic", "Synthetic review");
    await assert.rejects(store.append("approve", binding, null, "synthetic", "Not resolved", { ...Object.fromEntries(qualityChecks.map(k => [k, true])), retainedEvidenceReviewed: true }), /Candidate evidence/);
  } finally { await cleanup(store, dirs); }
});

test("candidate origins cannot invent an inherited source or bypass FACT validation", async () => {
  const store = await fixture();
  try { const r = await store.read(), d = bindClaimIdentities(editedMarkdown(split(r.revisions[0].content), r.revisions[0].content), store.id);
    d.ongoing!.referenceReview!.candidateEvidence = ["page"]; validateDraft(d, r.packet); await assert.rejects(store.append("edit", await store.currentBinding(), d, "synthetic", "Wrong origin"), /bound prior paragraph/);
    const bad = structuredClone(d); bad.ongoing!.kind = "FACT"; assert.throws(() => validateDraft(bad, r.packet), /candidate reference/);
    const unknown = structuredClone(d); unknown.ongoing!.referenceReview!.candidateEvidence = ["invented"]; assert.throws(() => validateDraft(unknown, r.packet), /Unsupported evidence/);
    assert.equal((await store.read()).revisions.length, 1);
  } finally { await cleanup(store); }
});

test("retained units keep stable IDs and explicit paragraph removals appear in comparison", async () => {
  const store = await fixture();
  try { const r = await store.read(), d = bindClaimIdentities(editedMarkdown(split(r.revisions[0].content), r.revisions[0].content), store.id); const shorter = bindClaimIdentities(editedMarkdown(reviewMarkdown(d).replace(paragraphs.join("\n\n"), paragraphs.slice(0, 2).join("\n\n")), d), store.id);
    assert.equal(shorter.ongoing!.id, d.ongoing!.id); assert.equal(shorter.ongoing!.additionalParagraphs![0].id, d.ongoing!.additionalParagraphs![0].id);
    const view = structuredClone(r); view.revisions = [{ ...r.revisions[0], content: d }, { ...r.revisions[0], number: 2, content: shorter }]; const diff = compareRevisions(view, 1, 2); assert.equal(diff.changes.filter(row => row.change === "removed").length, 1);
  } finally { await cleanup(store); }
});

test("read-only import preflight checks the workspace binding, assigns IDs and never appends a revision", async () => {
  const store = await fixture(), dirs: string[] = [];
  try { const before = await store.read(), w = await beginHumanEdit(store); dirs.push(w.directory); const input = path.join(w.directory, "human-draft.md"); const content = split(before.revisions[0].content); await writeFile(input, content);
    const preview = await inspectHumanEdit(store, w.directory, input); assert.equal(preview.draft.ongoing!.additionalParagraphs!.length, 2); assert.ok(reviewClaims(preview.draft).every(row => row.claim.id));
    assert.equal(await readFile(input, "utf8"), content); assert.equal(await readFile(w.review, "utf8"), reviewMarkdown(before.revisions[0].content)); assert.deepEqual(await store.read(), before);
    await assert.rejects(inspectHumanEdit(store, w.directory, path.join(reviewRoot(), "outside.md")), /inside this workspace/);
  } finally { await cleanup(store, dirs); }
});
