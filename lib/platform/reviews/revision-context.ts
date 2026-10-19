import { object, text } from "../canonical/model";
import { reviewClaims, type ParagraphClaim, type ReviewDraft } from "./model";
import type { ReviewState } from "./store";

export type EditNotes = { summary: string; retainedEvidenceReviewed?: boolean; entries?: { location?: string; claimId?: string; note: string }[] };
export function validateEditNotes(value: EditNotes, draft: ReviewDraft): EditNotes {
  object(value, ["summary", "entries", "retainedEvidenceReviewed"]);
  if (value.retainedEvidenceReviewed !== undefined && typeof value.retainedEvidenceReviewed !== "boolean") throw Error("Invalid retained evidence review attestation");
  if (typeof value.summary !== "string" || value.summary.length > 1800) throw Error("Invalid operator edit summary");
  if (value.summary) text(value.summary, 1800, true);
  const rows = reviewClaims(draft);
  if (value.entries !== undefined) {
    if (!Array.isArray(value.entries) || value.entries.length > 20) throw Error("Invalid operator edit notes");
    for (const e of value.entries) { object(e, ["location", "claimId", "note"]); text(e.note, 900, true); if ((!e.location && !e.claimId) || !rows.some(row => (!e.location || row.location === e.location) && (!e.claimId || row.claim.id === e.claimId))) throw Error("Unknown edit note claim/location"); }
  }
  return structuredClone(value);
}

type ComparisonRow = { section: string; location: string; claimId?: string; change: "added" | "removed" | "changed"; oldText: string; newText: string; oldEvidence: string[]; newEvidence: string[]; oldReferenceReview?: ParagraphClaim["referenceReview"]; newReferenceReview?: ParagraphClaim["referenceReview"]; evidenceRelevant: boolean };
const sectionName = (location: string) => location.startsWith("ongoing") ? "How your Web presence should improve over time" : location.startsWith("opportunities.") ? "Opportunity " + (Number(location.split(".")[1]) + 1) : location.split(".paragraphs.")[0];
export function compareRevisions(review: ReviewState, from: number, to: number) {
  const before = review.revisions.find(r => r.number === from), after = review.revisions.find(r => r.number === to);
  if (!before || !after || from >= to) throw Error("Select two existing ordered revisions");
  const oldRows = reviewClaims(before.content), newRows = reviewClaims(after.content);
  const changes: ComparisonRow[] = newRows.flatMap(row => {
    const old = oldRows.find(o => row.claim.id && o.claim.id ? o.claim.id === row.claim.id : o.location === row.location);
    if (old?.claim.text === row.claim.text && old.claim.kind === row.claim.kind && JSON.stringify(old.claim.evidence) === JSON.stringify(row.claim.evidence) && JSON.stringify(old.claim.referenceReview) === JSON.stringify(row.claim.referenceReview)) return [];
    return [{ section: sectionName(row.location), location: row.location, claimId: row.claim.id, change: old ? "changed" as const : "added" as const, oldText: old?.claim.text ?? "", newText: row.claim.text, oldEvidence: old?.claim.evidence ?? [], newEvidence: row.claim.evidence, oldReferenceReview: old?.claim.referenceReview, newReferenceReview: row.claim.referenceReview, evidenceRelevant: true }];
  });
  for (const row of oldRows.filter(row => !newRows.some(n => row.claim.id && n.claim.id ? n.claim.id === row.claim.id : n.location === row.location))) changes.push({ section: sectionName(row.location), location: row.location, claimId: row.claim.id, change: "removed", oldText: row.claim.text, newText: "", oldEvidence: row.claim.evidence, newEvidence: [], oldReferenceReview: row.claim.referenceReview, evidenceRelevant: true });
  const titles: ComparisonRow[] = after.content.opportunities.flatMap((o, i) => before.content.opportunities[i]?.title === o.title ? [] : [{ section: "Opportunity " + (i + 1), location: "opportunities." + i + ".title", change: "changed" as const, oldText: before.content.opportunities[i]?.title ?? "", newText: o.title, oldEvidence: [], newEvidence: [], evidenceRelevant: false }]);
  return { from, to, changes, titles, notes: after.editNotes ?? { summary: "" }, evidenceReviewRequired: after.editNotes !== undefined || changes.some(c => c.newReferenceReview) };
}
export function comparisonMarkdown(review: ReviewState, from: number, to: number) {
  const c = compareRevisions(review, from, to);
  return `# Operator revision comparison: ${from} → ${to}\n\nRetained evidence reviewed: ${c.notes.retainedEvidenceReviewed === true ? "yes (not approval)" : "not recorded"}\n\nOperator edit notes: ${c.notes.summary || "No revision-level note supplied (permitted for trivial copy edits)."}\n\n` +
    (c.notes.entries ?? []).map(n => `- ${n.location ?? n.claimId}: ${n.note}\n`).join("") + "\n" +
    [...c.titles, ...c.changes].map(row => `## ${row.section} — ${row.change} (${row.location})\n\nClaim identity: ${row.claimId ?? "legacy location"}\n\nOld:\n${row.oldText || "(absent)"}\n\nNew:\n${row.newText || "(removed)"}\n\n${row.evidenceRelevant ? `Evidence before: ${row.oldEvidence.join(", ")}\nEvidence after: ${row.newEvidence.join(", ")}\nReference review: ${row.newReferenceReview ? "CANDIDATE ONLY from " + row.newReferenceReview.sourceLocation + ": " + row.newReferenceReview.candidateEvidence.join(", ") : "no pending candidate set"}\nRetained references require human inspection; a text change may change what they support.\n` : ""}`).join("\n") +
    (!c.changes.length && !c.titles.length ? "No claim text, evidence references or opportunity titles changed.\n" : "");
}

export const pendingStyleFeedback = `# Pending human editorial context — not applied\n\nThese are review prompts, not completed edit notes or automatic replacement rules.\n\n- Avoid enquiry/inquiry as a generic default. Choose ordinary wording that fits the meaning: questions, contacts, requests, prospects, conversations or responses.\n- The worked example sounds awkward. Consider a natural description such as the how-it-works example where appropriate.\n\nEdit the clean Review first. Record meaningful editorial reasons separately in edit-notes.json; punctuation, spelling and trivial grammar do not need individual notes. If meaning changes, inspect the evidence and update references/classification through the structured CLI when needed. Do not assume retained references still support changed text. Saving creates a new DRAFT revision; requesting review and approving are separate actions.\n`;
