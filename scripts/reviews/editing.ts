import { mkdir, open, readFile, realpath } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fingerprint, object } from "../../lib/platform/canonical/model";
import { bindClaimIdentities, claimParagraphs, developmentOnly, reviewClaims, reviewClaimSlots, validateDraft, type Claim, type ParagraphClaim, type ReviewDraft } from "../../lib/platform/reviews/model";
import { reviewMarkdown, reviewSections } from "../../lib/platform/reviews/presentation";
import { pendingStyleFeedback, validateEditNotes, type EditNotes } from "../../lib/platform/reviews/revision-context";
import { LocalReviewStore, validateCandidateOrigins, type Binding } from "../../lib/platform/reviews/store";

export const editRoot = () => path.resolve("runtime-content/review-edits");
const read = async (file: string) => { if (await realpath(file) !== file) throw Error("Editing filesystem redirect refused"); const bytes = await readFile(file); if (bytes.length > 100000) throw Error("Edit file too large"); return new TextDecoder("utf-8", { fatal: true }).decode(bytes); };

// Fixed outline with flat paragraph units. No IDs/provenance in the editor.
// Sections containing multiple semantic slots still require an explicit mapping
// when their paragraph count changes; never guess how to redistribute their roles.
export function editedMarkdown(markdown: string, base: ReviewDraft): ReviewDraft {
  if (base.format !== "consultative/2") throw Error("Clean editing currently supports consultative/2 only");
  const lines = markdown.replace(/\r\n/g, "\n").trim().split("\n"), sections = reviewSections(base);
  if (lines.shift() !== "# Your Free Web Presence Review") throw Error("Keep the Review title/outline");
  const groups: { title: string; body: string[] }[] = [];
  for (const line of lines) {
    if (line.startsWith("## ")) groups.push({ title: line.slice(3), body: [] });
    else if (line.trim() || groups.length) { if (!groups.length || /^#/.test(line)) throw Error("Keep the supported section outline"); groups.at(-1)!.body.push(line); }
  }
  if (groups.length !== sections.length) throw Error("Section count changed; use structured editing for outline changes");
  const draft = structuredClone(base), oldRows = reviewClaims(base).filter(row => !row.location.startsWith("teaser.content")), slots = reviewClaimSlots(draft); let cursor = 0;
  const changedUnit = (value: string, prior: ParagraphClaim, sourceLocation: string, keepId: boolean): ParagraphClaim => {
    const { additionalParagraphs: ignored, ...unit } = prior as Claim; void ignored;
    if (value === prior.text && keepId) return structuredClone(unit);
    const refs = prior.referenceReview?.candidateEvidence ?? prior.evidence;
    const kind = prior.kind === "FACT" || prior.kind === "OBSERVATION" || prior.kind === "PROSPECT_SUPPLIED_UNCONFIRMED" && !/^you\b|^based on your answers\b/i.test(value) ? "UNKNOWN" : prior.kind;
    return { ...(keepId && prior.id ? { id: prior.id } : {}), kind, text: value, evidence: [], referenceReview: { status: "candidate", sourceLocation, ...(prior.id ? { sourceClaimId: prior.id } : {}), candidateEvidence: [...refs] } };
  };
  const replace = (target: ParagraphClaim, value: ParagraphClaim) => { for (const key of Object.keys(target)) delete (target as unknown as Record<string, unknown>)[key]; Object.assign(target, value); };
  for (const [i, group] of groups.entries()) {
    if (i >= 2 && i <= 4) { const match = new RegExp(`^${i - 1}\\. (.+)$`).exec(group.title); if (!match) throw Error("Keep opportunity numbering"); draft.opportunities[i - 2].title = match[1]; }
    else if (group.title !== sections[i].title) throw Error("Keep the supported section headings");
    const paragraphs = group.body.join("\n").trim().split(/\n[ \t]*\n/);
    if (paragraphs.some(p => !p.trim())) throw Error("Empty paragraph unit");
    const rows = oldRows.slice(cursor, cursor + sections[i].paragraphs.length); cursor += rows.length;
    const roots = new Set(rows.map(row => row.location.replace(/\.paragraphs\.[1-4]$/, "")));
    if (roots.size === 1) {
      if (paragraphs.length > 5) throw Error("One to five flat paragraph units required");
      const location = [...roots][0], slot = slots.find(row => row.location === location)!;
      const old = claimParagraphs(slot.claim).map(p => structuredClone(p));
      const units = paragraphs.map((p, n) => changedUnit(p, old[n] ?? old[0], old[n] ? rows[n].location : location, !!old[n]));
      replace(slot.claim, units[0]); if (units.length > 1) slot.claim.additionalParagraphs = units.slice(1);
    } else {
      if (paragraphs.length !== rows.length) throw Error("Keep paragraph boundaries for sections with multiple semantic roles; use structured editing for an explicit mapping");
      const newRows = reviewClaims(draft);
      for (const [n, p] of paragraphs.entries()) replace(newRows.find(row => row.location === rows[n].location)!.claim, changedUnit(p, rows[n].claim, rows[n].location, true));
    }
  }
  return draft;
}

export async function beginHumanEdit(store: LocalReviewStore) {
  developmentOnly(); const review = await store.read(), current = review.revisions.at(-1)!;
  if (current.content.format !== "consultative/2") throw Error("Clean editing currently supports consultative/2 only");
  const root = editRoot(); await mkdir(root, { recursive: true, mode: 0o700 }); if (await realpath(root) !== root) throw Error("Editing root redirect refused");
  const directory = path.join(root, randomUUID()); await mkdir(directory, { mode: 0o700 });
  const binding = await store.currentBinding();
  for (const [name, data] of Object.entries({
    "review.md": reviewMarkdown(current.content),
    "edit-notes.json": JSON.stringify({ summary: "", entries: [] }, null, 2),
    "editing.json": JSON.stringify({ version: "review-edit/1", id: review.id, binding, baseMarkdownDigest: fingerprint(reviewMarkdown(current.content)) }, null, 2),
    "editorial-context.md": pendingStyleFeedback,
  })) { const f = await open(path.join(directory, name), "wx", 0o600); try { await f.writeFile(data); await f.sync(); } finally { await f.close(); } }
  return { directory, review: path.join(directory, "review.md"), notes: path.join(directory, "edit-notes.json"), context: path.join(directory, "editorial-context.md"), binding, state: review.state, revision: current.number, createdRevision: false };
}

export async function inspectHumanEdit(store: LocalReviewStore, directory: string, input?: string) {
  developmentOnly(); const resolved = path.resolve(directory);
  if (path.dirname(resolved) !== editRoot() || await realpath(resolved) !== resolved) throw Error("Explicit local editing workspace required");
  const manifest = JSON.parse(await read(path.join(resolved, "editing.json")));
  object(manifest, ["version", "id", "binding", "baseMarkdownDigest"]);
  const review = await store.read(), base = review.revisions.at(-1)!;
  if (manifest.version !== "review-edit/1" || manifest.id !== review.id || fingerprint(manifest.binding) !== fingerprint(await store.currentBinding()) || manifest.baseMarkdownDigest !== fingerprint(reviewMarkdown(base.content))) throw Error("Foreign or stale edit workspace");
  const inputPath = input ? path.resolve(input) : path.join(resolved, "review.md");
  if (path.dirname(inputPath) !== resolved || !inputPath.endsWith(".md")) throw Error("Explicit Markdown file inside this workspace required");
  const draft = validateDraft(bindClaimIdentities(editedMarkdown(await read(inputPath), base.content), store.id), review.packet);
  validateCandidateOrigins(draft, base.content);
  const notes = validateEditNotes(JSON.parse(await read(path.join(resolved, "edit-notes.json"))) as EditNotes, draft);
  return { review, base, draft, notes, binding: manifest.binding as Binding };
}

export async function saveHumanEdit(store: LocalReviewStore, directory: string, actor: string, note: string) {
  const { base, draft, notes, binding } = await inspectHumanEdit(store, directory);
  if (fingerprint(draft) === fingerprint(base.content)) throw Error("No text/title change to save");
  return store.append("edit", binding, draft, actor, note, undefined, notes);
}
