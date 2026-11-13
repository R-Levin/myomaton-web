import assert from "node:assert/strict";
import test from "node:test";
import { interviewDirection } from "../lib/platform/intake/interview-direction";
import type { InterviewTurn } from "../lib/platform/intake/intelligent-model";
import { projectInterviewHistory } from "../lib/platform/intake/answer-projection";
import { fingerprint } from "../lib/platform/canonical/model";
import { composeProspectPage } from "../lib/platform/content-editing/prospect-proposal";
import { readPresencePlan } from "../lib/platform/intake/presence-plan";

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
  assert.throws(() => projectInterviewHistory([first], { approvedAnswerDigests: [] }), /not approved/);
  const history = projectInterviewHistory([first], { approvedAnswerDigests: [],
    approvedProjections: [{ savedAnswerDigest: fingerprint(first.answer!.text), outboundText: "Review a public website." }] });
  assert.equal(history[0].answer.text, "Review a public website.");
  assert.ok(!JSON.stringify(history).includes(first.answer!.text!));
});

test("proposed site plans refuse duplicate paths and markup", () => {
  const page = { path: "/", title: "Home", purpose: "Explain the offer", seoDescription: "Review an existing website",
    action: "Discuss your website", sections: [{ heading: "Existing site", body: "Start with the website address." }] };
  const plan = { positioning: "Hands-on help", offering: "Managed Web Presence", audience: "Existing businesses", pages: [page] };
  assert.deepEqual(readPresencePlan(plan), plan);
  const context = { version: 1, evidenceDigest: fingerprint(plan), finding: {
    findingId: "finding", recommendation: "Explain the handoff.", unresolved: null, answerReference: "question:answer",
    sourceIds: ["source", "question:answer"], plan: readPresencePlan(plan),
  } };
  const input = { operation: "replace-page" as const, pageId: "existing", slug: "/", title: {
    kind: "editorial" as const, text: "Before", rationale: "Original copy.",
  }, purpose: "Explain the offer", sections: [] };
  const ids = ["9a511424-79af-4d02-801e-8d191d4b0d2f", "75f2952c-3a53-4ba1-85de-1dfbcde23459"];
  const revisedPlan = { ...plan, pages: [{ ...page, sections: [...page.sections,
    { heading: "After the first conversation", body: "Access comes later." }] }] };
  const revised = composeProspectPage(input, ids, { sitePriority: "Conversation first" },
    { ...context, finding: { ...context.finding, plan: readPresencePlan(revisedPlan) } });
  assert.equal(revised.title.kind === "editorial" && revised.title.text, "Home");
  assert.deepEqual(revised.sections.map(section => section.text?.kind === "editorial" && section.text.text),
    ["Start with the website address.", "Access comes later."]);
  assert.throws(() => readPresencePlan({ ...plan, pages: [page, page] }), /Invalid proposed Page/);
  assert.throws(() => readPresencePlan({ ...plan, pages: [{ ...page, title: "<script>" }] }), /Invalid canonical text/);
});
