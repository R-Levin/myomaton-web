import { claimParagraphs, reviewClaims, type ReviewDraft, type Claim } from "./model";
import type { ReviewState } from "./store";
import { prospectInterview, claimSources } from "./operator-context";
import type { QuestionnaireContext } from "./questionnaire";
import { compareRevisions } from "./revision-context";
export function reviewSections(d: ReviewDraft): { title: string; paragraphs: string[] }[] {
  const prose = (claim: Claim) => claimParagraphs(claim).map(p => p.text);
  if (d.format === "consultative/1" || d.format === "consultative/2") return [
    { title: "Our read on your situation", paragraphs: prose(d.understanding) },
    { title: d.startingPoint.framing === "existing" ? "What is already working" : "Your starting point", paragraphs: prose(d.startingPoint.content) },
    ...d.opportunities.map((o, i) => ({ title: `${i + 1}. ${o.title}`, paragraphs: [o.what, o.why, o.direction].flatMap(prose) })),
    { title: "What we would do first", paragraphs: [d.firstDirection, d.conversion].flatMap(prose) },
    ...(d.ongoing ? [{ title: "How your Web presence should improve over time", paragraphs: prose(d.ongoing) }] : []),
    { title: "Where MioPages fits", paragraphs: prose(d.fit.content) },
    ...(d.format === "consultative/2" ? [] : [{ title: "Optional Home concept", paragraphs: prose(d.teaser.content) }]),
  ];
  return [
    { title: "What we understand", paragraphs: prose(d.understanding) },
    { title: d.startingPoint.framing === "existing" ? "What appears to be working" : "Your starting point", paragraphs: prose(d.startingPoint.content) },
    ...d.opportunities.map((o, i) => ({ title: `${i + 1}. ${o.title}`, paragraphs: [o.what, o.why, o.direction].flatMap((c, n) => prose(c).map((p, k) => k ? p : `${["What matters", "Why it matters", "Recommended direction"][n]}: ${p}`)) })),
    { title: "Recommended first direction", paragraphs: prose(d.firstDirection) },
    { title: "Conversion observation", paragraphs: prose(d.conversion) },
    { title: "MioPages fit", paragraphs: prose(d.fit.content) },
    { title: "Optional Home concept", paragraphs: prose(d.teaser.content) },
  ];
}
export function reviewMarkdown(d: ReviewDraft) { return "# Your Free Web Presence Review\n\n" + reviewSections(d).map(s => `## ${s.title}\n\n${s.paragraphs.join("\n\n")}`).join("\n\n") + "\n"; }
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const answerHtml = (answer: string | string[]) => Array.isArray(answer) ? answer.length ? `<ul>${answer.map(a => `<li>${escape(a)}</li>`).join("")}</ul>` : "<p>No answer stored.</p>" : answer.trim() ? `<p class="stored-answer">${escape(answer)}</p>` : "<p>No answer stored.</p>";
const classifications: Record<Claim["kind"], string> = { FACT: "Fact — directly supported captured text", PROSPECT_SUPPLIED_UNCONFIRMED: "Prospect-supplied / unconfirmed", OBSERVATION: "Observation — interpretation of evidence", RECOMMENDATION: "Recommendation — judgment and direction", UNKNOWN: "Unknown / needs confirmation" };
function whyHtml(claim: Claim, location: string, review: ReviewState, context?: QuestionnaireContext) {
  const sources = claimSources(claim, review.packet, context).map(source => source.type === "intake"
    ? `<li><h4>${escape(source.question)}</h4>${source.field.label !== source.question ? `<p>${escape(source.field.label)}</p>` : ""}${answerHtml(source.field.answer)}<p class="metadata">${escape(source.reference)} · Prospect-supplied / unconfirmed · supplied ${escape(source.field.provenance.suppliedAt)}</p></li>`
    : `<li><h4>${escape(source.title)}${source.route ? ` (${escape(source.route)})` : ""}</h4><p>${escape(source.source)}</p><p class="stored-answer">${escape(source.observation)}</p><p class="metadata">${escape(source.reference)} · captured ${escape(source.capturedAt)}</p><p>Coverage/limitations: ${escape(source.limitations)}</p></li>`).join("");
  return `<details class="claim-evidence"><summary>Why this says this</summary><p>${escape(classifications[claim.kind])}</p>${claim.referenceReview ? `<p>Candidate references only — not confirmed support for this changed paragraph. From ${escape(claim.referenceReview.sourceLocation)}. Operator resolution is required before approval.</p>` : ""}<ul class="sources">${sources}</ul><p class="metadata">${claim.id ? `Claim ID: ${escape(claim.id)}` : `Legacy claim location: ${escape(location)} (no persisted claim ID)`}</p></details>`;
}
function operatorReading(review: ReviewState, diagnostic = false) {
  const revision = review.revisions.at(-1)!, context = revision.questionnaireContext, claims = reviewClaims(revision.content).filter(row => revision.content.format !== "consultative/2" || !row.location.startsWith("teaser.content")); let index = 0;
  const sections = reviewSections(revision.content).map(s => `<section><h2>${escape(s.title)}</h2>${s.paragraphs.map(paragraph => { const row = claims[index++]; if (!row) throw Error("Review presentation/claim mapping mismatch"); return `<p>${escape(paragraph)}</p>${diagnostic ? whyHtml(row.claim, row.location, review, context) : ""}`; }).join("")}</section>`).join("");
  if (index !== claims.length) throw Error("Review presentation/claim mapping mismatch");
  const interview = prospectInterview(review.packet, context);
  const transcript = interview.groups.map(g => `<section><h3>${g.number}. ${escape(g.title)}</h3>${g.fields.filter(f => !f.followUpTo || !g.fields.some(parent => parent.key === f.followUpTo!.key)).map(f => {
    const children = g.fields.filter(child => child.followUpTo?.key === f.key);
    const followup = (choice?: string) => children.filter(child => !choice || child.followUpTo!.choice === choice).map(child => `<p>${escape(child.label)}</p>${answerHtml(child.answer)}<p class="metadata">${escape(child.reference)} · Prospect-supplied / unconfirmed · supplied ${escape(child.provenance.suppliedAt)}</p>`).join("");
    const answer = Array.isArray(f.answer) && children.length ? `<ul>${f.answer.map(choice => `<li>${escape(choice)}${followup(choice)}</li>`).join("")}</ul>` : answerHtml(f.answer) + followup();
    return `${g.fields.length > 1 || f.label !== g.title ? `<h4>${escape(f.label)}</h4>` : ""}${answer}<p class="metadata">${escape(f.reference)} · Prospect-supplied / unconfirmed · supplied ${escape(f.provenance.suppliedAt)}</p>`;
  }).join("")}</section>`).join("");
  if (diagnostic) return `<h2>Review text and supporting evidence</h2><p>References show the inputs behind a statement, not proof that its interpretation is correct. Human operator judgment remains required. Retained evidence must be inspected when wording or meaning changes.</p>${sections}`;
  return `<div id="review">${sections}</div><h2 id="prospect-qa">Prospect Q&amp;A</h2><p>${interview.mode === "embedded" ? "Question wording preserved in this Review's immutable context" : "Legacy wording resolved from the pinned versioned definition; this historical Review has no embedded wording snapshot"} (${escape(interview.questionnaireVersion)}).</p>${transcript}`;
}
function editNotesHtml(review: ReviewState) {
  const notes = review.revisions.at(-1)!.editNotes;
  return notes ? `<h2>Operator edit notes</h2>${notes.retainedEvidenceReviewed !== undefined ? `<p>Retained evidence reviewed: ${notes.retainedEvidenceReviewed ? "yes" : "not yet"}. This is not approval.</p>` : ""}<p>${escape(notes.summary || "No revision-level note supplied; trivial copy edits do not require individual notes.")}</p><ul>${(notes.entries ?? []).map(e => `<li>${escape(e.location ?? e.claimId ?? "Revision")}: ${escape(e.note)}</li>`).join("")}</ul>` : "";
}
function comparisonHtml(review: ReviewState) {
  if (review.revisions.length < 2) return "<h2>Revision comparison</h2><p>No later revision has been saved. Revision 1 remains the baseline.</p>";
  const c = compareRevisions(review, review.revisions.at(-2)!.number, review.revisions.at(-1)!.number);
  return `<h2>Revision ${c.from} → ${c.to}</h2>${editNotesHtml(review)}<p>Changed text does not prove retained evidence still supports its meaning. Inspect the references before approval.</p>${[...c.titles, ...c.changes].map(row => `<section><h3>${escape(row.section)} — ${escape(row.change)} (${escape(row.location)})</h3>${row.claimId ? `<p class="metadata">Claim: ${escape(row.claimId)}</p>` : ""}<p>Old: ${escape(row.oldText || "(absent)")}</p><p>New: ${escape(row.newText || "(removed)")}</p>${row.evidenceRelevant ? `<p class="metadata">Evidence before: ${escape(row.oldEvidence.join(", "))}<br>Evidence after: ${escape(row.newEvidence.join(", "))}${row.newReferenceReview ? `<br>Candidate only from ${escape(row.newReferenceReview.sourceLocation)}: ${escape(row.newReferenceReview.candidateEvidence.join(", "))}. Not confirmed support.` : ""}</p>` : ""}</section>`).join("")}`;
}
export function reviewHtml(review: ReviewState, operator = false, view: "normal" | "diagnostics" | "comparison" = "normal") {
  const draft = review.revisions.at(-1)!.content;
  const p = review.packet.presence;
  const coverage = p ? `<h2>${escape(p.label)}</h2><p>${escape(p.observedVersion)}</p><p>Intake describes the prospect's stated intent. The rendered site is assessed against that intent, not treated as confirmed business truth.</p><h2>Representative Page coverage</h2><ul>${p.reviewed.map(page => `<li><strong>${escape(page.route)}</strong> — ${escape(page.purpose)}<br>Captured ${escape(page.capturedAt)}. ${escape(page.limitations)}</li>`).join("")}</ul><h2>Discovered, not reviewed</h2><ul>${p.omitted.map(page => `<li>${escape(page.route)} — ${escape(page.reason)}</li>`).join("")}</ul>` : "";
  const diagnostics = () => `${operatorReading(review, true)}${coverage}<details><summary>Revision history, QC and technical diagnostics</summary><p>Review identity: ${escape(review.id)}</p><pre>${escape(JSON.stringify(review, null, 2))}</pre></details>`;
  const content = operator ? `<h1>Operator Review</h1><p>${escape(p?.label ?? review.id)} · ${escape(review.state)} · revision ${review.revisions.at(-1)!.number} · Development/manual synthesis</p><p>This trusted local preview is not prospect delivery or production authentication. Edit and approve through the local CLI; the substantive draft requires human approval.</p>${view === "comparison" ? comparisonHtml(review) : view === "diagnostics" ? diagnostics() : `${operatorReading(review)}<h2 id="human-revision">Human revision</h2><p>Would you send this Review, and what would you change? Use begin-edit to prepare a clean Markdown workspace. Save-edit appends a new DRAFT revision; it never overwrites this baseline or approves it. Record meaningful editorial reasons separately. Inspect retained evidence before approval.</p>${editNotesHtml(review)}<p><a href="/comparison">Revision comparison</a> · <a href="/diagnostics">Diagnostic evidence</a></p><details id="diagnostics"><summary>Diagnostic evidence — secondary</summary>${diagnostics()}</details>`}`
    : `<h1>Your Free Web Presence Review</h1>${reviewSections(draft).map(s => `<section><h2>${escape(s.title)}</h2>${s.paragraphs.map(p => `<p>${escape(p)}</p>`).join("")}</section>`).join("")}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${p ? escape(p.label) + (operator ? " — Operator" : "") : operator ? "Operator Review" : "Free Web Presence Review"}</title><style>body{font:17px/1.55 system-ui,sans-serif;color:#271a35;background:#faf8f4;margin:0}main{max-width:780px;margin:40px auto;padding:24px}h1{font-size:2rem}h2{font-size:1.2rem;margin-top:1.7em}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}p{overflow-wrap:anywhere}${operator ? "details{margin:12px 0;padding:12px;border:1px solid #d8d1de;border-radius:6px}summary{cursor:pointer;font-weight:600}.metadata{font-size:13px;color:#53495d}.stored-answer{white-space:pre-wrap}.sources{padding-left:22px}.sources>li{margin-bottom:18px}h4{margin-bottom:6px}" : ""}@media print{main{margin:0;font-size:11pt;padding:0}section{break-inside:avoid}}</style></head><body><main>${content}</main></body></html>`;
}
