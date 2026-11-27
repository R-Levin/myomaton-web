/**
 * The Change area (docs/service-object-model.md, docs/glossary.md): Request, Decision,
 * Change, Review and Round, shared by every workflow. Onboarding, Launch, review rounds and
 * Ongoing raise Requests and propose Changes here instead of keeping their own shapes.
 *
 * Pure and storage-free: the records live in a ChangeLedger held by whatever owns the
 * Account's state, and every function returns a new ledger. Nothing here calls AI, WordPress
 * or a database.
 *
 * A Change behaves like a pull request: it names a base Version, shows its difference, says
 * what it must preserve, carries a Consequence level that decides who must review it, is
 * applied exactly as approved, and is flagged as a conflict when its base has moved.
 */

/** Anyone acting: a Customer, an Operator, the Owner, or Core itself. */
export type Person = { id: string; role: "customer" | "operator" | "owner" | "core"; simulated?: boolean };

/** Where a Request came from (glossary: Origin) and the channel it arrived through. */
export type Origin = {
  kind: "customer" | "operator" | "core" | "observation" | "business-change" | "stage-start";
  by: Person;
  /** How it was raised: a WordPress Note, a hand edit read back, a Core screen, a quality check. */
  channel: "wordpress-note" | "hand-edit" | "review-summary" | "core-screen" | "quality-check" | "measurement" | "email";
  /** Who carried it into Core, when that is not the person who said it (a Specialist entering a Client's email). */
  enteredBy?: Person;
};

/** How much a Change touches (glossary: Grain). */
export type Grain = "fact" | "section" | "page" | "new-page" | "menu" | "design" | "site" | "report" | "direction" | "site-plan";

/** What a Request or Change is about: one object of Knowledge or a Work product. */
export type Target = {
  grain: Grain;
  /** Page path for site content; a Fact's key for Knowledge. */
  path?: string;
  /** Zero-based sections of a Page, for the section grain. */
  sections?: number[];
  /** The name people see, where the target is new (a new Page's label). */
  name?: string;
  /** The exact Page Work product, and its Sections, at the versions the Change is made against (step 4). */
  workProduct?: { id: string; version: number; sections?: { id: string; version: number }[] };
};

/** How much review a Change needs. Publishing always needs customer approval. */
export type Consequence = "routine" | "operator-review" | "customer-approval";

export type Request = {
  id: string;
  at: string;
  origin: Origin;
  target: Target;
  /** The words of the Request, as raised. */
  words: string;
  roundId?: string;
  /** Reference in the channel it came from, such as a WordPress Note id. */
  channelRef?: string;
  status: "open" | "decided" | "withdrawn";
};

/**
 * The reasoning about one or more Requests. "maintain" (leave it as it is) and "watch" are
 * valid outcomes; "change" proposes Changes; "answer" replies without changing anything.
 */
export type Decision = {
  id: string;
  at: string;
  by: Person;
  requestIds: string[];
  outcome: "change" | "maintain" | "watch" | "answer";
  reasoning: string;
  changeIds: string[];
  /** Estimated cost of carrying out the Decision's Changes, in millionths of a dollar. */
  estimateMicros?: number;
};

/** A person's response to a Change. */
export type Review = {
  at: string;
  by: Person;
  response: "approve" | "decline" | "correct" | "ask";
  /** The corrected wording ("correct"), the question ("ask"), or what else to do ("approve"). */
  words?: string;
};

export type ChangeStatus = "proposed" | "approved" | "declined" | "applied" | "reverted" | "conflict";

export type Change = {
  id: string;
  /** Short label people use on screens and in Notes: F1, C2, P1. */
  label: string;
  at: string;
  requestIds: string[];
  decisionId?: string;
  target: Target;
  /** The Version the Change was made against, and a digest of the target at that Version. */
  base: { version: number; digest?: string };
  /** The visible difference. `after` is the proposed wording when it is known in advance. */
  difference: { summary: string; before?: string; after?: string };
  /** Wording or parts that must survive the Change unchanged. */
  preserve: string[];
  consequence: Consequence;
  /** Changes that only make sense if one of these is approved (a link to a proposed new page). */
  dependsOn?: string[];
  status: ChangeStatus;
  reviews: Review[];
  appliedAt?: { at: string; version: number };
};

/** A batch of Requests taken in together and reviewed together. */
export type Round = { id: string; at: string; by: Person; requestIds: string[]; status: "taken-in" | "analyzed" | "decided" | "withdrawn" };

export type ChangeLedger = { requests: Request[]; decisions: Decision[]; changes: Change[]; rounds: Round[] };

export const emptyLedger = (): ChangeLedger => ({ requests: [], decisions: [], changes: [], rounds: [] });

export class ChangeError extends Error {
  constructor(readonly code: "unknown" | "not-open" | "not-permitted" | "invalid", message: string) { super(message); }
}

const replace = <T extends { id: string }>(items: readonly T[], next: T) => items.map(item => item.id === next.id ? next : item);
const find = <T extends { id: string }>(items: readonly T[], id: string, what: string) => {
  const item = items.find(entry => entry.id === id);
  if (!item) throw new ChangeError("unknown", `No ${what} ${id}`);
  return item;
};

/** Take in a Round of Requests. */
export function takeIn(ledger: ChangeLedger, round: Omit<Round, "requestIds" | "status">, requests: readonly Omit<Request, "status" | "roundId">[]): ChangeLedger {
  if (ledger.rounds.some(item => item.id === round.id)) throw new ChangeError("invalid", `Round ${round.id} already taken in`);
  const raised = requests.map(request => ({ ...request, roundId: round.id, status: "open" as const }));
  return { ...ledger, requests: [...ledger.requests, ...raised],
    rounds: [...ledger.rounds, { ...round, requestIds: raised.map(item => item.id), status: "taken-in" }] };
}

/**
 * Record a Decision and the Changes it proposes. Routine Changes are approved at once; the
 * rest wait for Review. The Requests it answers are marked decided.
 */
export function decide(ledger: ChangeLedger, decision: Omit<Decision, "changeIds">, changes: readonly Omit<Change, "status" | "reviews" | "decisionId">[]): ChangeLedger {
  for (const id of decision.requestIds) if (find(ledger.requests, id, "Request").status === "withdrawn") throw new ChangeError("not-open", `Request ${id} was withdrawn`);
  const made: Change[] = changes.map(change => ({ ...change, decisionId: decision.id,
    status: change.consequence === "routine" ? "approved" : "proposed",
    reviews: change.consequence === "routine" ? [{ at: decision.at, by: decision.by, response: "approve" }] : [] }));
  const ids = new Set(ledger.changes.map(item => item.id));
  for (const change of made) {
    if (ids.has(change.id)) throw new ChangeError("invalid", `Change ${change.id} proposed twice`);
    if (!change.requestIds.every(id => decision.requestIds.includes(id))) throw new ChangeError("invalid", `Change ${change.label} answers a Request outside its Decision`);
    ids.add(change.id);
  }
  return { ...ledger, decisions: [...ledger.decisions, { ...decision, changeIds: made.map(item => item.id) }],
    changes: [...ledger.changes, ...made],
    requests: ledger.requests.map(request => decision.requestIds.includes(request.id) ? { ...request, status: "decided" } : request) };
}

/** Who may review a Change at its Consequence level. The Owner may review anything. */
export function mayReview(person: Person, consequence: Consequence) {
  if (person.role === "owner") return true;
  if (consequence === "customer-approval") return person.role === "customer";
  if (consequence === "operator-review") return person.role === "operator";
  return person.role !== "core" || consequence === "routine";
}

/**
 * A person's Review of a proposed Change. Approve and Correct approve it (Correct with the
 * person's wording as the new `after`); Decline declines it; Ask leaves it proposed.
 */
export function review(ledger: ChangeLedger, changeId: string, entry: Review): ChangeLedger {
  const change = find(ledger.changes, changeId, "Change");
  if (change.status !== "proposed") throw new ChangeError("not-open", `Change ${change.label} is ${change.status}`);
  if (!mayReview(entry.by, change.consequence)) throw new ChangeError("not-permitted", `A ${entry.by.role} may not review a ${change.consequence} Change`);
  if ((entry.response === "correct" || entry.response === "ask") && !entry.words?.trim()) throw new ChangeError("invalid", `${entry.response} needs words`);
  const status: ChangeStatus = entry.response === "decline" ? "declined" : entry.response === "ask" ? "proposed" : "approved";
  const difference = entry.response === "correct" ? { ...change.difference, after: entry.words!.trim() } : change.difference;
  return { ...ledger, changes: replace(ledger.changes, { ...change, status, difference, reviews: [...change.reviews, entry] }) };
}

/**
 * Close a Round: every Change still proposed in it is approved by the person closing it
 * (the Operator approved the summary and said No only to what they left out). A Change that
 * depends on others is declined if none of them was approved.
 */
export function closeRound(ledger: ChangeLedger, roundId: string, by: Person, at: string): ChangeLedger {
  const round = find(ledger.rounds, roundId, "Round");
  if (round.status === "decided" || round.status === "withdrawn") throw new ChangeError("not-open", `Round ${roundId} is ${round.status}`);
  let next = ledger;
  const inRound = (change: Change) => change.requestIds.some(id => round.requestIds.includes(id));
  for (const change of next.changes.filter(item => inRound(item) && item.status === "proposed" && !item.dependsOn?.length)) {
    next = review(next, change.id, { at, by, response: "approve" });
  }
  for (const change of next.changes.filter(item => inRound(item) && ["proposed", "approved"].includes(item.status) && item.dependsOn?.length)) {
    const met = change.dependsOn!.some(id => ["approved", "applied"].includes(next.changes.find(item => item.id === id)?.status ?? ""));
    if (met && change.status === "proposed") next = review(next, change.id, { at, by, response: "approve" });
    // Nothing it depends on was approved, so it cannot stand: Core declines it, on record.
    if (!met) next = { ...next, changes: replace(next.changes, { ...change, status: "declined",
      reviews: [...change.reviews, { at, by: { id: "core", role: "core" }, response: "decline", words: "Nothing it depends on was approved." }] }) };
  }
  return { ...next, rounds: replace(next.rounds, { ...round, status: "decided" }) };
}

/**
 * Withdraw a Round taken in by mistake. Everything stays on record: its Requests are withdrawn,
 * Changes already applied are reverted, and the rest are declined.
 */
export function withdrawRound(ledger: ChangeLedger, roundId: string, at: string, by: Person): ChangeLedger {
  const round = find(ledger.rounds, roundId, "Round");
  if (round.status === "decided" || round.status === "withdrawn") throw new ChangeError("not-open", `Round ${roundId} is ${round.status}`);
  const note: Review = { at, by, response: "decline", words: "The round was withdrawn." };
  return { ...ledger, rounds: replace(ledger.rounds, { ...round, status: "withdrawn" }),
    requests: ledger.requests.map(request => round.requestIds.includes(request.id) ? { ...request, status: "withdrawn" } : request),
    changes: ledger.changes.map(change => !change.requestIds.some(id => round.requestIds.includes(id)) ? change
      : change.status === "applied" ? { ...change, status: "reverted", reviews: [...change.reviews, note] }
        : ["proposed", "approved"].includes(change.status) ? { ...change, status: "declined", reviews: [...change.reviews, note] } : change) };
}

/** Changes in a Round, in the order they were proposed. */
export const roundChanges = (ledger: ChangeLedger, roundId: string) => {
  const round = ledger.rounds.find(item => item.id === roundId);
  return round ? ledger.changes.filter(change => change.requestIds.some(id => round.requestIds.includes(id))) : [];
};

/** Mark approved Changes as applied at a Version (Delivery or the owning area applied them exactly). */
export function markApplied(ledger: ChangeLedger, changeIds: readonly string[], at: string, version: number): ChangeLedger {
  return { ...ledger, changes: ledger.changes.map(change => {
    if (!changeIds.includes(change.id)) return change;
    if (change.status !== "approved") throw new ChangeError("not-open", `Change ${change.label} is ${change.status}, not approved`);
    return { ...change, status: "applied", appliedAt: { at, version } };
  }) };
}

/**
 * Flag proposed or approved Changes whose base has moved (a hand edit or another Change landed
 * on the same target since). `current` gives the digest of each target now, by path.
 * A conflict is never applied silently; it goes back to a person.
 */
export function flagConflicts(ledger: ChangeLedger, current: ReadonlyMap<string, string>): ChangeLedger {
  return { ...ledger, changes: ledger.changes.map(change => {
    if (!["proposed", "approved"].includes(change.status) || !change.base.digest || !change.target.path) return change;
    const now = current.get(change.target.path);
    return now !== undefined && now !== change.base.digest ? { ...change, status: "conflict" } : change;
  }) };
}

/** The Account's plain timeline: every Request, Decision and Review in date order. */
export function timeline(ledger: ChangeLedger) {
  return [
    ...ledger.requests.map(item => ({ at: item.at, what: "request" as const, id: item.id, text: item.words, by: item.origin.by })),
    ...ledger.decisions.map(item => ({ at: item.at, what: "decision" as const, id: item.id, text: item.reasoning, by: item.by })),
    ...ledger.changes.flatMap(change => change.reviews.map(entry => ({ at: entry.at, what: "review" as const, id: change.id,
      text: `${entry.response} ${change.label}${entry.words ? ": " + entry.words : ""}`, by: entry.by }))),
  ].sort((a, b) => a.at.localeCompare(b.at));
}
