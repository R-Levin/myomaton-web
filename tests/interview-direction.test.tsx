import assert from "node:assert/strict";
import test from "node:test";
import { interviewDirection } from "../lib/platform/intake/interview-direction";
import type { InterviewTurn } from "../lib/platform/intake/intelligent-model";

test("site direction requires the exact saved answer and its citation", () => {
  const first: InterviewTurn = { id: "question", gapId: "handoff", question: "What should the visitor bring?",
    rationale: "Determine the handoff.", sourceIds: ["source"], respondsTo: null, generatorVersion: "test",
    assessment: null, at: "2026-11-13", answer: { text: "A website address.", disposition: "provided", at: "2026-11-13" } };
  const next: InterviewTurn = { ...first, id: "finding", answer: undefined, question: null, respondsTo: "question:answer",
    sourceIds: ["source", "question:answer"], assessment: { recommendation: "Ask for the website address.", evidenceNeeded: "Confirm who reviews it." } };
  assert.equal(interviewDirection([first, next])?.recommendation, next.assessment?.recommendation);
  assert.equal(interviewDirection([first, { ...next, gapId: "other" }]), null);
  assert.equal(interviewDirection([first, { ...next, sourceIds: ["source"] }]), null);
  assert.equal(interviewDirection([{ ...first, answer: undefined }, next]), null);
});
