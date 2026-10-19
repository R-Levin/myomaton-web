import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { JSDOM } from "jsdom";
import { evidencePacket, submissionDigest, qualityChecks, type Claim, type ReviewDraft, type Submission } from "../lib/platform/reviews/model";
import { LocalReviewStore, reviewRoot, revisionDigest } from "../lib/platform/reviews/store";
import { reviewHtml, reviewMarkdown } from "../lib/platform/reviews/presentation";
import { compareRevisions, comparisonMarkdown, validateEditNotes } from "../lib/platform/reviews/revision-context";
import { beginHumanEdit, saveHumanEdit, editedMarkdown, editRoot } from "../scripts/reviews/editing";
import { loadSolutionContext } from "../scripts/reviews/context";

Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" });
const owner = { webPresenceId: randomUUID(), managedSiteId: randomUUID() };
const c = (value: string, kind: Claim["kind"] = "RECOMMENDATION"): Claim => ({ kind, text: value, evidence: ["intake:audience", "page"] });
async function fixture() {
  const answers = { businessName: "Synthetic human-edit fixture", project: "Improve or replace an existing Web presence", audience: "Synthetic local owners", goals: ["Something else"], goalOther: "Synthetic useful conversations" };
  const s: Submission = { id: randomUUID(), intake_id: randomUUID(), web_presence_id: owner.webPresenceId, entry_intent: "FREE_REVIEW", questionnaire_version: "foundational-intake/1", draft_version: 1, answers, provenance: Object.fromEntries(Object.keys(answers).map(k => [k, { source: "prospect-supplied", confirmation: "unconfirmed", suppliedAt: "2026-10-17T00:00:00Z" }])), submitted_at: "2026-10-17T00:00:00Z", digest: "" }; s.digest = submissionDigest(s);
  const p = evidencePacket(owner, s, [{ id: "page", kind: "operator", source: "http://127.0.0.1:55555/", capturedAt: s.submitted_at, text: "Synthetic public explanation.", coverage: "Synthetic rendered text only." }], "Synthetic editing test", undefined, await loadSolutionContext());
  const d: ReviewDraft = { format: "consultative/2", understanding: c("Your offer needs a useful explanation.", "OBSERVATION"), startingPoint: { framing: "existing", content: c("The worked example helps explain your offer.", "OBSERVATION") }, opportunities: [1, 2, 3].map(i => ({ title: `Synthetic opportunity ${i}`, what: c(`Your readers face question ${i}.`, "OBSERVATION"), why: c("Clear answers help readers decide."), direction: c("Explain the next useful action.") })), firstDirection: c("Your priority is a clearer explanation."), conversion: c("Give readers a useful next step."), ongoing: c("Learn from useful conversations over time."), fit: { assessment: "conditional", content: c("A managed relationship could reduce repeated work.") }, teaser: { status: "not-generated", content: c("Internal concept status only.", "UNKNOWN") } };
  const store = await LocalReviewStore.create(p, d, "synthetic editing test"); await store.append("request-review", await store.currentBinding(), null, "synthetic", "Fixture awaiting review"); return store;
}
async function cleanup(store: LocalReviewStore, directories: string[]) { for (const dir of directories) { assert.equal(path.dirname(dir), editRoot()); await rm(dir, { recursive: true }); } const dir = path.join(reviewRoot(), store.id); assert.equal(path.dirname(dir), reviewRoot()); await rm(dir, { recursive: true }); }

test("normal operator reading is clean Review then Q&A, with secondary closed diagnostics and unchanged customer copy", async () => {
  const store = await fixture();
  try { const r = await store.read(), customer = reviewHtml(r), doc = new JSDOM(reviewHtml(r, true)).window.document;
    assert.equal(doc.querySelectorAll("#review details").length, 0); assert.ok(doc.querySelector("#review")!.compareDocumentPosition(doc.querySelector("#prospect-qa")!) & 4);
    const diagnostics = doc.querySelector("details#diagnostics")!; assert.ok(diagnostics); assert.equal(diagnostics.hasAttribute("open"), false); assert.equal(diagnostics.querySelectorAll("details.claim-evidence").length, 15);
    assert.ok(doc.querySelector("#review")!.textContent!.includes(r.revisions[0].content.understanding.text)); assert.ok(!doc.querySelector("#review")!.textContent!.includes("Why this says this"));
    const goal = [...doc.querySelectorAll("li")].find(li => li.firstChild?.textContent === "Something else" && li.textContent?.includes("Synthetic useful conversations")); assert.ok(goal);
    const noted = structuredClone(r); noted.revisions[0].editNotes = { summary: "Private operator explanation" }; assert.equal(reviewHtml(noted), customer);
    for (const value of ["Operator edit notes", "Diagnostic evidence", "claim_", "intake:", "Synthetic useful conversations", "Revision comparison"]) assert.ok(!customer.includes(value));
    assert.match(reviewHtml(r, true, "comparison"), /No later revision has been saved/);
  } finally { await cleanup(store, []); }
});

test("begin-edit exports exact clean text and pending style context without a new revision or source overwrite", async () => {
  const store = await fixture(), dirs: string[] = [];
  try { const before = await store.read(), packet = await readFile(path.join(reviewRoot(), store.id, "packet.json")), event = await readFile(path.join(reviewRoot(), store.id, "000001.json"));
    const workspace = await beginHumanEdit(store); dirs.push(workspace.directory); assert.equal(workspace.createdRevision, false);
    const md = await readFile(workspace.review, "utf8"); assert.equal(md, reviewMarkdown(before.revisions[0].content)); assert.match(md, /The worked example/);
    assert.match(await readFile(workspace.context, "utf8"), /not applied/); assert.deepEqual(JSON.parse(await readFile(workspace.notes, "utf8")), { summary: "", entries: [] });
    assert.deepEqual(editedMarkdown(md, before.revisions[0].content), before.revisions[0].content);
    assert.deepEqual(await readFile(path.join(reviewRoot(), store.id, "packet.json")), packet); assert.deepEqual(await readFile(path.join(reviewRoot(), store.id, "000001.json")), event); assert.deepEqual(await store.read(), before);
    await assert.rejects(saveHumanEdit(store, workspace.directory, "synthetic", "No change"), /No text\/title change/);
  } finally { await cleanup(store, dirs); }
});

test("synthetic human save appends a new draft with notes, stable claims, preserved evidence and explicit approval review", async () => {
  const store = await fixture(), dirs: string[] = [];
  try { const before = await store.read(), event = await readFile(path.join(reviewRoot(), store.id, "000001.json")), packet = await readFile(path.join(reviewRoot(), store.id, "packet.json")); const workspace = await beginHumanEdit(store); dirs.push(workspace.directory);
    await writeFile(workspace.review, (await readFile(workspace.review, "utf8")).replace("Your priority is a clearer explanation.", "Your priority is a simpler next step.").replace("1. Synthetic opportunity 1", "1. A clearer first decision"));
    await writeFile(workspace.notes, JSON.stringify({ summary: "Made the first recommendation more concrete.", entries: [{ location: "firstDirection", note: "The intended decision is clearer; inspect retained support." }] }));
    const after = await saveHumanEdit(store, workspace.directory, "synthetic human", "Synthetic revision only"); assert.equal(after.state, "DRAFT"); assert.equal(after.revisions.length, 2);
    assert.deepEqual(await readFile(path.join(reviewRoot(), store.id, "000001.json")), event); assert.deepEqual(await readFile(path.join(reviewRoot(), store.id, "packet.json")), packet);
    assert.equal(after.revisions[1].content.firstDirection.id, before.revisions[0].content.firstDirection.id); assert.deepEqual(after.revisions[1].content.firstDirection.evidence, []); assert.deepEqual(after.revisions[1].content.firstDirection.referenceReview!.candidateEvidence, before.revisions[0].content.firstDirection.evidence);
    const comparison = compareRevisions(after, 1, 2); assert.equal(comparison.changes[0].oldText, before.revisions[0].content.firstDirection.text); assert.equal(comparison.changes[0].newText, after.revisions[1].content.firstDirection.text); assert.equal(comparison.titles.length, 1); assert.equal(comparison.evidenceReviewRequired, true);
    assert.match(comparisonMarkdown(after, 1, 2), /Made the first recommendation/); assert.match(reviewHtml(after, true, "comparison"), /Evidence after/);
    assert.ok(!reviewHtml(after).includes("Made the first recommendation")); assert.match(reviewHtml(after, true, "diagnostics"), /intake:audience/);
    const binding = await store.currentBinding(), checks = Object.fromEntries(qualityChecks.map(k => [k, true])); await assert.rejects(store.append("approve", binding, null, "synthetic", "Not queued", checks));
    await store.append("request-review", binding, null, "synthetic", "Synthetic human review"); await assert.rejects(store.append("approve", binding, null, "synthetic", "No evidence attestation", checks), /evidence must be inspected/);
    await assert.rejects(store.append("approve", binding, null, "synthetic", "Attestation is not candidate resolution", { ...checks, retainedEvidenceReviewed: true }), /Candidate evidence/);
    const resolved = structuredClone(after.revisions[1].content); resolved.firstDirection.evidence = [...resolved.firstDirection.referenceReview!.candidateEvidence]; delete resolved.firstDirection.referenceReview;
    await store.append("edit", binding, resolved, "synthetic", "Explicit synthetic evidence resolution"); const reviewed = await store.currentBinding(); await store.append("request-review", reviewed, null, "synthetic", "Resolved synthetic evidence");
    const approved = await store.append("approve", reviewed, null, "synthetic", "Synthetic mechanics only", { ...checks, retainedEvidenceReviewed: true }); assert.equal(approved.state, "APPROVED");
    await assert.rejects(saveHumanEdit(store, workspace.directory, "synthetic", "Stale workspace"), /stale edit workspace/);
  } finally { await cleanup(store, dirs); }
});

test("trivial grammar edits allow an empty revision note without per-change annotation", async () => {
  const store = await fixture(), dirs: string[] = [];
  try { const workspace = await beginHumanEdit(store); dirs.push(workspace.directory); await writeFile(workspace.review, (await readFile(workspace.review, "utf8")).replace("Your priority is a clearer explanation.", "Your priority is a clearer explanation!")); const r = await saveHumanEdit(store, workspace.directory, "synthetic", "Punctuation only"); assert.deepEqual(r.revisions[1].editNotes, { summary: "", entries: [] }); assert.equal(r.state, "DRAFT"); }
  finally { await cleanup(store, dirs); }
});

test("clean editing refuses ambiguous structure, unknown note references, foreign workspace and unsafe customer markup", async () => {
  const store = await fixture(), dirs: string[] = [];
  try { const r = await store.read(), base = r.revisions[0].content, md = reviewMarkdown(base);
    for (const invalid of [md.replace("## What we would do first", "## Different outline"), md + "\n## Extra section\n\nUnexpected.", md.replace("Your priority is a clearer explanation.", "One paragraph.\n\nAnother paragraph.")]) assert.throws(() => editedMarkdown(invalid, base));
    assert.throws(() => validateEditNotes({ summary: "Meaning changed", entries: [{ location: "unknown", note: "Cannot map this" }] }, base), /Unknown/);
    const workspace = await beginHumanEdit(store); dirs.push(workspace.directory);
    await writeFile(workspace.review, md.replace("Your priority is a clearer explanation.", "<script>unsafe markup</script>")); await assert.rejects(saveHumanEdit(store, workspace.directory, "synthetic", "Unsafe markup"));
    await writeFile(workspace.review, md);
    const manifest = JSON.parse(await readFile(path.join(workspace.directory, "editing.json"), "utf8")); manifest.id = randomUUID(); await writeFile(path.join(workspace.directory, "editing.json"), JSON.stringify(manifest)); await assert.rejects(saveHumanEdit(store, workspace.directory, "synthetic", "Foreign"), /Foreign or stale/);
    await assert.rejects(saveHumanEdit(store, reviewRoot(), "synthetic", "Wrong root"), /workspace required/); assert.deepEqual(await store.read(), r);
  } finally { await cleanup(store, dirs); }
});

test("notes are digest-bound and production begin-edit refuses before creating any workspace", async () => {
  const store = await fixture();
  try { const r = await store.read(), rev = r.revisions[0]; assert.notEqual(revisionDigest(rev.content, rev.questionnaireContext, { summary: "First rationale" }), revisionDigest(rev.content, rev.questionnaireContext, { summary: "Changed rationale" }));
    const out = spawnSync(process.execPath, ["--import", "tsx", "scripts/review-synthesis.ts", "begin-edit", "--id", store.id], { env: { ...process.env, NODE_ENV: "production" }, encoding: "utf8", windowsHide: true }); assert.equal(out.status, 1); assert.match(out.stderr, /Review command refused/); assert.deepEqual(await store.read(), r);
  } finally { await cleanup(store, []); }
});


test("a single reviewed multi-paragraph human revision binds evidence notes without approving or changing revision one", async () => {
  const store = await fixture(), dirs: string[] = [];
  try {
    const original = await store.read(), event = await readFile(path.join(reviewRoot(), store.id, "000001.json"));
    const d = editedMarkdown(reviewMarkdown(original.revisions[0].content).replace("Learn from useful conversations over time.", "Learn from useful conversations.\n\nImprove the explanation using those questions.\n\nKeep the business focused on its work."), original.revisions[0].content);
    const units = [d.ongoing!, ...d.ongoing!.additionalParagraphs!];
    for (const unit of units) { unit.evidence = ["page"]; delete unit.referenceReview; }
    const notes = { summary: "Keep service analysis with the managed service and customer judgment with the customer.", retainedEvidenceReviewed: true, entries: [{ location: "ongoing", note: "Inspected each paragraph; page context informs recommendations, not factual performance claims." }] };
    validateEditNotes(notes, d);
    assert.throws(() => validateEditNotes({ ...notes, retainedEvidenceReviewed: "yes" } as unknown as Parameters<typeof validateEditNotes>[0], d), /attestation/);
    await store.append("edit", await store.currentBinding(), d, "synthetic reviewer", "One human revision after reference inspection", undefined, notes);
    const binding = await store.currentBinding(); await store.append("request-review", binding, null, "synthetic reviewer", "Await explicit human inspection");
    const r = await store.read(); assert.equal(r.state, "NEEDS_OPERATOR_REVIEW"); assert.equal(r.revisions.length, 2);
    assert.equal(r.revisions[1].editNotes!.retainedEvidenceReviewed, true);
    assert.deepEqual(r.revisions[0], original.revisions[0]);
    assert.deepEqual(r.revisions[1].questionnaireContext, r.revisions[0].questionnaireContext);
    assert.deepEqual(await readFile(path.join(reviewRoot(), store.id, "000001.json")), event);
    const doc = new JSDOM(reviewHtml(r)).window.document, paragraphs = [...doc.querySelectorAll('section')].find(s => s.querySelector('h2')?.textContent === "How your Web presence should improve over time")!.querySelectorAll('p');
    assert.deepEqual([...paragraphs].map(p => p.textContent), units.map(u => u.text));
    assert.ok(!reviewHtml(r).includes(notes.summary)); assert.ok(!reviewHtml(r).includes("retainedEvidenceReviewed"));
    const comparison = compareRevisions(r, 1, 2); assert.equal(comparison.changes.filter(c => c.change === "added").length, 2);
    assert.match(comparisonMarkdown(r, 1, 2), /yes \(not approval\)/);
    await assert.rejects(store.append("approve", binding, null, "synthetic reviewer", "Notes alone are not approval QC", Object.fromEntries(qualityChecks.map(k => [k, true]))), /evidence must be inspected/);
    assert.equal((await store.read()).state, "NEEDS_OPERATOR_REVIEW");
  } finally { await cleanup(store, dirs); }
});


test("third human revision compares against revision two and preserves all older immutable events", async () => {
  const store = await fixture();
  try {
    const base = await store.read(), second = structuredClone(base.revisions[0].content);
    second.ongoing!.additionalParagraphs = [c("Your second ongoing paragraph."), c("Your third ongoing paragraph.")];
    await store.append("edit", await store.currentBinding(), second, "synthetic", "Second revision fixture", undefined, { summary: "Second revision notes" });
    await store.append("request-review", await store.currentBinding(), null, "synthetic", "Await review");
    const before = await store.read(), oldEvents = await Promise.all([1, 2, 3, 4].map(n => readFile(path.join(reviewRoot(), store.id, String(n).padStart(6, "0") + ".json"))));
    const human = reviewMarkdown(before.revisions[1].content).replace(second.understanding.text, "Your first opening paragraph.\n\nYour separate service description.").replace([second.ongoing!.text, ...second.ongoing!.additionalParagraphs!.map(p => p.text)].join("\n\n"), "Your revised learning inputs.\n\nYour optional updates remain separate from managed work.");
    const third = editedMarkdown(human, before.revisions[1].content);
    const units = [third.understanding, ...third.understanding.additionalParagraphs!, third.ongoing!, ...third.ongoing!.additionalParagraphs!];
    for (const unit of units) { unit.evidence = ["page"]; delete unit.referenceReview; }
    await store.append("edit", await store.currentBinding(), third, "synthetic", "Human third revision", undefined, { summary: "Optional input is not homework", retainedEvidenceReviewed: true });
    await store.append("request-review", await store.currentBinding(), null, "synthetic", "Human inspection only");
    const r = await store.read(); assert.equal(r.revisions.length, 3); assert.equal(r.state, "NEEDS_OPERATOR_REVIEW");
    assert.deepEqual(r.revisions.slice(0, 2), before.revisions);
    for (const [i, bytes] of oldEvents.entries()) assert.deepEqual(await readFile(path.join(reviewRoot(), store.id, String(i + 1).padStart(6, "0") + ".json")), bytes);
    const comparison = compareRevisions(r, 2, 3); assert.equal(comparison.changes.filter(c => c.change === "added").length, 1); assert.equal(comparison.changes.filter(c => c.change === "removed").length, 1);
    assert.match(reviewHtml(r, true, "comparison"), /Revision 2 → 3/);
    assert.ok(!reviewHtml(r).includes("Optional input is not homework"));
    assert.equal(reviewMarkdown(r.revisions[2].content), human);
    await assert.rejects(store.append("approve", await store.currentBinding(), null, "synthetic", "Not authorized by notes", Object.fromEntries(qualityChecks.map(k => [k, true]))), /evidence must be inspected/);
  } finally { await cleanup(store, []); }
});
