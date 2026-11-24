import assert from "node:assert/strict";
import test from "node:test";
import {
  ChangeError, closeRound, decide, emptyLedger, flagConflicts, markApplied, review, roundChanges, takeIn, timeline, withdrawRound,
  type Change, type Person,
} from "../lib/platform/change/model";
import { approvedInRound, reviewRound, roundLedger } from "../lib/platform/intake/review-round-changes";
import type { ReviewRound } from "../lib/platform/intake/presence-workflow";
import { fingerprint } from "../lib/platform/canonical/model";

const operator: Person = { id: "op", role: "operator" };
const customer: Person = { id: "cu", role: "customer" };
const core: Person = { id: "core", role: "core" };
const at = "2026-11-24T12:00:00.000Z";
const change = (id: string, extra: Partial<Change> = {}) => ({ id, label: id, at, requestIds: ["r1"], target: { grain: "section" as const, path: "/" },
  base: { version: 1, digest: "d1" }, difference: { summary: "s" }, preserve: [], consequence: "operator-review" as const, ...extra });
const opened = () => takeIn(emptyLedger(), { id: "R", at, by: operator },
  [{ id: "r1", at, origin: { kind: "operator", by: operator, channel: "wordpress-note" }, target: { grain: "section", path: "/" }, words: "Shorter" }]);

test("a Decision proposes Changes; routine ones are approved at once, the rest wait for Review", () => {
  const ledger = decide(opened(), { id: "D", at, by: core, requestIds: ["r1"], outcome: "change", reasoning: "why" },
    [change("A"), change("B", { consequence: "routine" })]);
  assert.deepEqual(ledger.changes.map(item => item.status), ["proposed", "approved"]);
  assert.equal(ledger.requests[0].status, "decided");
  assert.throws(() => decide(ledger, { id: "D2", at, by: core, requestIds: ["r1"], outcome: "change", reasoning: "" }, [change("A")]), ChangeError,
    "The same Change cannot be proposed twice");
  assert.throws(() => decide(opened(), { id: "D", at, by: core, requestIds: [], outcome: "change", reasoning: "" }, [change("A")]), ChangeError,
    "A Change answers a Request of its own Decision");
});

test("the Consequence level decides who may review", () => {
  let ledger = decide(opened(), { id: "D", at, by: core, requestIds: ["r1"], outcome: "change", reasoning: "" },
    [change("A"), change("P", { consequence: "customer-approval" })]);
  assert.throws(() => review(ledger, "A", { at, by: customer, response: "approve" }), /may not review/);
  assert.throws(() => review(ledger, "P", { at, by: operator, response: "approve" }), /may not review/, "Publishing needs the Customer");
  assert.throws(() => review(ledger, "A", { at, by: core, response: "approve" }), /may not review/, "Core does not approve its own proposals");
  ledger = review(ledger, "P", { at, by: customer, response: "approve" });
  ledger = review(ledger, "A", { at, by: { id: "owner", role: "owner" }, response: "decline" });
  assert.deepEqual(ledger.changes.map(item => item.status), ["declined", "approved"]);
  assert.throws(() => review(ledger, "A", { at, by: operator, response: "approve" }), /declined/, "A decided Change is not reviewed again");
});

test("Correct replaces the wording and approves; Ask keeps it open; both need words", () => {
  let ledger = decide(opened(), { id: "D", at, by: core, requestIds: ["r1"], outcome: "change", reasoning: "" },
    [change("F", { target: { grain: "fact" }, difference: { summary: "fact", after: "Open Mondays" } })]);
  assert.throws(() => review(ledger, "F", { at, by: operator, response: "correct" }), /needs words/);
  ledger = review(ledger, "F", { at, by: operator, response: "ask", words: "Which Mondays?" });
  assert.equal(ledger.changes[0].status, "proposed");
  ledger = review(ledger, "F", { at, by: operator, response: "correct", words: "Open every Monday" });
  assert.deepEqual([ledger.changes[0].status, ledger.changes[0].difference.after], ["approved", "Open every Monday"]);
});

test("closing a Round approves what was not left out and declines what depended only on left-out Changes", () => {
  let ledger = decide(opened(), { id: "D", at, by: core, requestIds: ["r1"], outcome: "change", reasoning: "" },
    [change("F1", { target: { grain: "fact" } }), change("F2", { target: { grain: "fact" } }), change("C1", { dependsOn: ["F1"] }),
      change("C2", { dependsOn: ["F1", "F2"] }), change("C3")]);
  ledger = review(ledger, "F1", { at, by: operator, response: "decline" });
  ledger = review(ledger, "C1", { at, by: operator, response: "approve", words: "and mention parking" });
  ledger = closeRound(ledger, "R", operator, at);
  assert.deepEqual(Object.fromEntries(ledger.changes.map(item => [item.id, item.status])),
    { F1: "declined", F2: "approved", C1: "declined", C2: "approved", C3: "approved" });
  assert.equal(ledger.changes.find(item => item.id === "C1")!.reviews.at(-1)!.by.role, "core", "Core's decline is on record");
  assert.equal(ledger.rounds[0].status, "decided");
  assert.throws(() => closeRound(ledger, "R", operator, at), /decided/);
});

test("a Change whose base moved is a conflict, never applied silently", () => {
  let ledger = decide(opened(), { id: "D", at, by: core, requestIds: ["r1"], outcome: "change", reasoning: "" }, [change("A")]);
  ledger = flagConflicts(ledger, new Map([["/", "d1"]]));
  assert.equal(ledger.changes[0].status, "proposed", "Same base, no conflict");
  ledger = flagConflicts(ledger, new Map([["/", "d2"]]));
  assert.equal(ledger.changes[0].status, "conflict");
  assert.throws(() => markApplied(ledger, ["A"], at, 2), /conflict, not approved/);
});

test("withdrawing a Round keeps it on record and reverts what it applied", () => {
  let ledger = decide(opened(), { id: "D", at, by: operator, requestIds: ["r1"], outcome: "change", reasoning: "" },
    [change("E1", { consequence: "routine" }), change("C1")]);
  ledger = markApplied(ledger, ["E1"], at, 2);
  ledger = withdrawRound(ledger, "R", at, operator);
  assert.deepEqual(ledger.changes.map(item => item.status), ["reverted", "declined"]);
  assert.deepEqual([ledger.rounds[0].status, ledger.requests[0].status], ["withdrawn", "withdrawn"]);
  assert.deepEqual(roundChanges(ledger, "R").map(item => item.id), ["E1", "C1"]);
  assert.deepEqual(timeline(ledger).map(item => item.what), ["request", "decision", "review", "review", "review"]);
});

test("a review round taken in before the Change area existed is read into the ledger at decision time", () => {
  const actor = { id: "op", role: "operator" as const, simulated: true, authority: "a" };
  const pages = [{ path: "/", sections: [1, 2] }, { path: "/start", sections: [1] }];
  const round: ReviewRound = { id: "old", at, actor, status: "summary",
    edits: [{ path: "/", before: "Old", after: "We open at 9." }], notes: [{ id: 5, path: "/start", text: "Shorter" }],
    factNotes: [], concerns: [{ path: "/start", concern: "Shorter" }], keep: [{ path: "/", text: "We open at 9." }],
    noteRevisions: [{ path: "/start", indexes: [0], reason: "Shorter", source: "note", factIds: [] }],
    analysis: { summary: "One fact.", estimateMicros: 1, facts: [{ id: "F1", statement: "Opens at 9", publicUse: true, source: { path: "/", kind: "edit", text: "We open at 9." } }],
      revisions: [{ path: "/", indexes: [1], reason: "Say the hours", source: "fact", factIds: ["F1"] }] } };
  const ledger = roundLedger(undefined, round, 7, pages);
  assert.deepEqual(roundChanges(ledger, "old").map(item => [item.label, item.status]),
    [["E1", "applied"], ["F1", "proposed"], ["C1", "proposed"], ["C2", "proposed"]]);
  assert.equal(roundChanges(ledger, "old").find(item => item.label === "C2")!.base.digest, fingerprint(pages[0]));
  const decided = reviewRound(ledger, round, { approved: true, rejectFacts: ["F1", "F1"], correctFacts: [{ id: "F1", statement: "x" }], rejectRevisions: [] },
    actor, at, pages);
  const outcome = approvedInRound(decided, "old");
  assert.deepEqual([outcome.facts, outcome.revisions.map(item => item.label)], [[], ["C1"]],
    "A No wins over a correction, twice is the same as once, and the change that needed the fact falls away");
  assert.throws(() => reviewRound(ledger, round, { approved: true, rejectFacts: [], correctFacts: [], rejectRevisions: [] }, actor, at,
    [{ path: "/", sections: [9] }, pages[1]]), /base moved under C2/, "A page that changed since the analysis stops the decision");
});
