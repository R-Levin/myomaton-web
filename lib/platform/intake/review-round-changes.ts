/**
 * Review rounds expressed in the Change area's shared objects (docs/service-object-model.md,
 * step 2; strangler fig). This is the first path routed through Request, Decision, Change and
 * Review:
 * - take-in: each Note and each kept hand edit becomes a Request; hand edits are routine
 *   Changes, approved by the Operator who made them and applied at once;
 * - analysis: Core's Decision proposes Changes (facts, sections, new pages), each with its
 *   base Version, difference, wording to preserve and Consequence level;
 * - the Operator's answers on the Review summary become Reviews, and closing the Round
 *   approves the rest. What is recorded, revised or added is read from the ledger.
 *
 * The older ReviewRound fields stay for now (the AI input and the record read them); they
 * are removed path by path once nothing reads them.
 */
import { workDigest } from "../work-products/pages";
import {
  closeRound, decide, emptyLedger, flagConflicts, markApplied, review, roundChanges, takeIn,
  type Change, type ChangeLedger, type Person, type Request,
} from "../change/model";
import type { ReviewDecision, ReviewRound, WorkflowActor } from "./presence-workflow";

export const person = (actor: WorkflowActor): Person => ({ id: actor.id, role: actor.role, simulated: actor.simulated });
const core: Person = { id: "core", role: "core" };
const editRequestId = (round: Pick<ReviewRound, "id">, index: number) => `${round.id}:edit:${index}`;
const noteRequestId = (round: Pick<ReviewRound, "id">, note: number) => `${round.id}:note:${note}`;
const changeId = (round: Pick<ReviewRound, "id">, label: string) => `${round.id}:${label}`;
/** Revision labels on the Review summary: C1, C2, … in the order proposed. */
export const revisionLabel = (index: number) => "C" + (index + 1);

type Page = { path: string; id?: string; version?: number; sections?: readonly unknown[] };
const publicFact = "Record this business fact";
const internalFact = "Record this business fact (for Core's understanding only; not for the website)";
/** Whether a proposed fact is for Core's understanding only, not for the website. */
export const internalOnly = (change: Change) => change.difference.summary === internalFact;

/** The Requests an Operator review round raises, and the hand edits already kept. */
export function takeInRound(ledger: ChangeLedger | undefined, round: ReviewRound, version: number): ChangeLedger {
  const by = person(round.actor);
  const sectionsOf = (path: string) => round.noteRevisions.find(item => item.path === path)?.indexes ?? [];
  const requests: Omit<Request, "status" | "roundId">[] = [
    ...round.edits.map((edit, index) => ({ id: editRequestId(round, index), at: round.at,
      origin: { kind: "operator" as const, by, channel: "hand-edit" as const }, target: { grain: "section" as const, path: edit.path },
      words: `Before: ${edit.before}\nNow: ${edit.after}` })),
    ...round.notes.map(note => ({ id: noteRequestId(round, note.id), at: round.at, channelRef: String(note.id),
      origin: { kind: "operator" as const, by, channel: "wordpress-note" as const },
      target: sectionsOf(note.path).length ? { grain: "section" as const, path: note.path, sections: sectionsOf(note.path) } : { grain: "page" as const, path: note.path },
      words: note.text })),
    ...round.factNotes.map(note => ({ id: noteRequestId(round, note.id), at: round.at, channelRef: String(note.id),
      origin: { kind: "operator" as const, by, channel: "wordpress-note" as const }, target: { grain: "fact" as const, path: note.path }, words: note.statement })),
    ...(round.pageNotes ?? []).map(note => ({ id: noteRequestId(round, note.id), at: round.at, channelRef: String(note.id),
      origin: { kind: "operator" as const, by, channel: "wordpress-note" as const }, target: { grain: "new-page" as const }, words: note.request })),
  ];
  let next = takeIn(ledger ?? emptyLedger(), { id: round.id, at: round.at, by }, requests);
  if (round.edits.length) {
    // A hand edit is the Operator's own Change: routine, kept as written, applied at take-in.
    const edits = round.edits.map((edit, index) => ({ id: changeId(round, "E" + (index + 1)), label: "E" + (index + 1), at: round.at,
      requestIds: [editRequestId(round, index)], target: { grain: "section" as const, path: edit.path }, base: { version },
      difference: { summary: `Your edit on ${edit.path}, kept as written`, before: edit.before, after: edit.after },
      preserve: [], consequence: "routine" as const }));
    next = decide(next, { id: `${round.id}:kept`, at: round.at, by, requestIds: edits.flatMap(item => item.requestIds), outcome: "change",
      reasoning: "The Operator's edits in WordPress are kept as written." }, edits);
    next = markApplied(next, edits.map(item => item.id), round.at, version + 1);
  }
  return next;
}

/**
 * Core's analysis of a round as a Decision and the Changes it proposes. `pages` are Core's
 * pages at `version` (the base every proposed Change is made against).
 */
export function analysedRound(ledger: ChangeLedger, round: ReviewRound, version: number, pages: readonly Page[], at: string,
  sitePlan?: { id: string; version: number }): ChangeLedger {
  const analysis = round.analysis;
  if (!analysis) throw Error("The round has not been analyzed");
  const digest = (path: string) => { const page = pages.find(item => item.path === path); return page ? workDigest(page) : undefined; };
  // The Page and Sections each revision is made against, by identity and version.
  const workProduct = (path: string, indexes: readonly number[]) => {
    const page = pages.find(item => item.path === path);
    if (!page?.id || !page.version) return {};
    const sections = indexes.flatMap(index => { const section = page.sections?.[index] as { id?: string; version?: number } | undefined;
      return section?.id && section.version ? [{ id: section.id, version: section.version }] : []; });
    return { workProduct: { id: page.id, version: page.version, ...(sections.length && { sections }) } };
  };
  const sourceRequest = (source: { path: string; kind: "edit" | "note"; text: string }) => source.kind === "note"
    ? round.factNotes.filter(note => note.path === source.path && note.statement === source.text).map(note => noteRequestId(round, note.id))
    : round.edits.flatMap((edit, index) => edit.path === source.path && edit.after === source.text ? [editRequestId(round, index)] : []);
  const facts: Omit<Change, "status" | "reviews" | "decisionId">[] = analysis.facts.map(fact => ({ id: changeId(round, fact.id), label: fact.id, at,
    requestIds: sourceRequest(fact.source), target: { grain: "fact", path: fact.source.path }, base: { version },
    difference: { summary: fact.publicUse ? publicFact : internalFact, after: fact.statement }, preserve: [], consequence: "operator-review" }));
  const newPages: Omit<Change, "status" | "reviews" | "decisionId">[] = (analysis.newPages ?? []).map(page => ({ id: changeId(round, page.id), label: page.id, at,
    requestIds: [noteRequestId(round, page.noteId)], target: { grain: "new-page", path: page.path, name: page.label, ...(sitePlan && { workProduct: { id: sitePlan.id, version: sitePlan.version } }) }, base: { version },
    difference: { summary: `Add the page ${page.label} (${page.path}) to the site plan${page.navigation ? ", in the main menu" : ", linked from other pages rather than the main menu"}`, after: page.purpose },
    preserve: [], consequence: "operator-review" }));
  const revisions = [...round.noteRevisions, ...analysis.revisions].map((revision, index): Omit<Change, "status" | "reviews" | "decisionId"> => {
    const factChanges = revision.factIds.map(id => changeId(round, id));
    const pageChanges = (revision.newPageIds ?? []).map(id => changeId(round, id));
    const requestIds = revision.source === "note"
      ? round.notes.filter(note => note.path === revision.path).map(note => noteRequestId(round, note.id))
      : [...new Set([...facts, ...newPages].filter(item => [...factChanges, ...pageChanges].includes(item.id)).flatMap(item => item.requestIds))];
    return { id: changeId(round, revisionLabel(index)), label: revisionLabel(index), at, requestIds,
      target: { ...(revision.indexes.length ? { grain: "section" as const, path: revision.path, sections: revision.indexes } : { grain: "page" as const, path: revision.path }),
        ...workProduct(revision.path, revision.indexes) },
      base: { version, ...(digest(revision.path) && { digest: digest(revision.path) }) },
      difference: { summary: revision.source === "note" ? "Revise in response to your note" : revision.reason },
      preserve: round.keep.filter(item => item.path === revision.path).map(item => item.text),
      consequence: "operator-review", ...(revision.source !== "note" && { dependsOn: [...factChanges, ...pageChanges] }) };
  });
  const changes = [...facts, ...newPages, ...revisions];
  const requestIds = ledger.rounds.find(item => item.id === round.id)?.requestIds ?? [];
  return decide(ledger, { id: `${round.id}:analysis`, at, by: core, requestIds, outcome: changes.length ? "change" : "answer",
    reasoning: analysis.summary, estimateMicros: analysis.estimateMicros }, changes);
}

/**
 * The ledger for a round, building it from the round's own record when the round was taken in
 * before the Change area existed (states already on protected Core).
 */
export function roundLedger(ledger: ChangeLedger | undefined, round: ReviewRound, version: number, pages: readonly Page[], at = round.at): ChangeLedger {
  let next = ledger ?? emptyLedger();
  if (!next.rounds.some(item => item.id === round.id)) next = takeInRound(next, round, version - 1);
  if (round.analysis && !next.decisions.some(item => item.id === `${round.id}:analysis`)) next = analysedRound(next, round, version, pages, at);
  return next;
}

/**
 * The Operator's answers on the Review summary as Reviews, then the Round closed: whatever the
 * Operator did not leave out is approved, and a Change that depended on facts or pages that were
 * all left out is declined. Conflicts (a base that moved) stop the decision.
 */
export function reviewRound(ledger: ChangeLedger, round: ReviewRound, decision: ReviewDecision, actor: WorkflowActor, at: string,
  pages: readonly Page[]): ChangeLedger {
  const by = person(actor);
  const id = (label: string) => changeId(round, label);
  let next = flagConflicts(ledger, new Map(pages.map(page => [page.path, workDigest(page)])));
  const conflicts = roundChanges(next, round.id).filter(change => change.status === "conflict");
  if (conflicts.length) throw new RoundConflict(conflicts.map(change => change.label));
  // Several Notes may answer the same item: a No wins, and the last correction counts.
  const declined = [...new Set([...decision.rejectFacts, ...decision.rejectRevisions.map(revisionLabel), ...decision.rejectPages ?? []])];
  for (const label of declined) next = review(next, id(label), { at, by, response: "decline" });
  const corrections = new Map(decision.correctFacts.filter(item => !declined.includes(item.id)).map(item => [item.id, item.statement]));
  for (const [label, statement] of corrections) next = review(next, id(label), { at, by, response: "correct", words: statement });
  // Additions to a change or a page approve it with the Operator's words.
  const additions = [...(decision.reviseNotes ?? []).map(note => ({ label: revisionLabel(note.index), text: note.text })),
    ...(decision.pageNotes ?? []).map(note => ({ label: note.id, text: note.text }))];
  for (const item of additions) {
    const change = next.changes.find(entry => entry.id === id(item.label));
    if (change?.status === "proposed") next = review(next, change.id, { at, by, response: "approve", words: item.text.slice(0, 2000) });
    else if (change?.status === "approved") next = { ...next, changes: next.changes.map(entry => entry.id === change.id
      ? { ...entry, reviews: [...entry.reviews, { at, by, response: "approve" as const, words: item.text.slice(0, 2000) }] } : entry) };
  }
  return closeRound(next, round.id, by, at);
}

export class RoundConflict extends Error {
  constructor(readonly labels: string[]) { super(`The base moved under ${labels.join(", ")}`); }
}

/** What the Round's Reviews approved, by label, with the Operator's words for each. */
export function approvedInRound(ledger: ChangeLedger, roundId: string) {
  const changes = roundChanges(ledger, roundId).filter(change => change.status === "approved" || change.status === "applied");
  const words = (change: Change) => change.reviews.flatMap(entry => entry.response === "approve" && entry.words ? [entry.words] : []);
  return {
    facts: changes.filter(change => change.target.grain === "fact").map(change => ({ label: change.label, id: change.id,
      statement: change.difference.after!, corrected: change.reviews.some(entry => entry.response === "correct") })),
    pages: changes.filter(change => change.target.grain === "new-page").map(change => ({ label: change.label, id: change.id, words: words(change) })),
    revisions: changes.filter(change => change.label.startsWith("C")).map(change => ({ label: change.label, id: change.id,
      index: Number(change.label.slice(1)) - 1, words: words(change) })),
  };
}

/** Mark a round's approved Changes as applied: facts recorded, pages added, or a page revised. */
export function appliedInRound(ledger: ChangeLedger, roundId: string, which: (change: Change) => boolean, at: string, version: number) {
  const ids = roundChanges(ledger, roundId).filter(change => change.status === "approved" && which(change)).map(change => change.id);
  return ids.length ? markApplied(ledger, ids, at, version) : ledger;
}

/** What a decided Round recorded, added and changed, read from its Changes. */
export function roundOutcome(ledger: ChangeLedger, roundId: string) {
  const changes = roundChanges(ledger, roundId);
  const done = (change: Change) => change.status === "approved" || change.status === "applied";
  return {
    factsRecorded: changes.filter(change => change.target.grain === "fact" && change.status === "applied").map(change => change.label),
    factsLeftOut: changes.filter(change => change.target.grain === "fact" && change.status === "declined").map(change => change.label),
    pagesAdded: changes.filter(change => change.target.grain === "new-page" && change.status === "applied").map(change => change.target.path!),
    changes: changes.filter(change => change.label.startsWith("C") && done(change))
      .map(change => ({ label: change.label, path: change.target.path!, sections: change.target.sections ?? [] })),
  };
}
