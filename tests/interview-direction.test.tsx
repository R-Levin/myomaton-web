import assert from "node:assert/strict";
import test from "node:test";
import { interviewDirection } from "../lib/platform/intake/interview-direction";
import type { InterviewTurn } from "../lib/platform/intake/intelligent-model";
import { projectInterviewHistory } from "../lib/platform/intake/answer-projection";
import { fingerprint } from "../lib/platform/canonical/model";
import { composeProspectPage, prepareInterviewPages } from "../lib/platform/content-editing/prospect-proposal";
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
  assert.throws(() => readPresencePlan({ ...plan, pages: [page, page] }), { code: "proposal_route" });
  assert.throws(() => readPresencePlan({ ...plan, pages: [{ ...page, title: "<script>" }] }), { code: "proposal_content" });
});

test("an exact edited Presence Direction composes a variable Page set with canonical sources", () => {
  const ids = ["ccb1f0f2-0285-4ced-8166-5dd011082c76", "d69ecf07-53e3-43eb-b46a-b7665bbdcfa8", "1b81958a-a387-4e05-b874-ad403514fce5",
    "75f2952c-3a53-4ba1-85de-1dfbcde23459", "9a511424-79af-4d02-801e-8d191d4b0d2f", "977b5f9f-907a-4815-989e-987f698ab9fa"];
  const fact = { kind: "canonical", source: { domain: "knowledge", recordId: ids[0], revision: 1,
    fingerprint: "a".repeat(64), field: "service" } };
  const planned = { path: "/", title: "Plan the next step", purpose: "Explain the offer", seoDescription: "Review your current site.",
    action: "Discuss your existing website", sections: [{ heading: "Start with the visitor goal", body: "Bring the action you want visitors to take." }] };
  const packet = { scope: { webPresenceId: ids[0], managedSiteId: ids[1] }, version: 2, evidenceDigest: "b".repeat(64),
    finding: { findingId: "finding", recommendation: "Explain the handoff.", unresolved: null, answerReference: "question:answer",
      sourceIds: ["source", "question:answer"],
      plan: { positioning: "Start with what visitors need", offering: "Managed Web Presence", audience: "Established businesses", pages: [planned] } } };
  const destinations = [{ page: { operation: "replace-page", pageId: ids[2], slug: "/", title: fact,
    purpose: "Explain the service", sections: [{ id: ids[3], type: "intro", heading: fact }] }, sectionIds: [ids[4]], action: { id: ids[5], type: "page", destination: "/" } }];
  const prepared = prepareInterviewPages(packet, fingerprint(packet), destinations);
  assert.deepEqual(prepared.navigation, ["/"]);
  assert.equal(prepared.pages[0].action.label, planned.action);
  assert.throws(() => prepareInterviewPages(packet, fingerprint(packet),
    [{ ...destinations[0], action: { ...destinations[0].action, destination: "https://external.example" } }]), /exact proposed Page/);
  assert.deepEqual(prepared.pages[0].proposal.sections[0].heading, fact);
  assert.equal(prepared.pages[0].proposal.sections[1].text?.kind, "editorial");
  assert.throws(() => prepareInterviewPages({ ...packet, version: 3 }, fingerprint(packet), destinations), /Exact interview/);
  assert.throws(() => prepareInterviewPages(packet, fingerprint(packet), []), /Resolve each Page/);
  const service = { ...planned, path: "/service", title: "Managed Web Presence" };
  const multi = { ...packet, finding: { ...packet.finding, plan: { ...packet.finding.plan, pages: [planned, service] } } };
  assert.throws(() => prepareInterviewPages(multi, fingerprint(multi), destinations), /Resolve each Page/);
});

test("a curated session sends only the permitted excerpt for an unchanged turn before expiry", () => {
  const id = "d84ebc69-46d5-4c64-adc6-ac7b87468f89";
  const answer = { text: "Private source with an approved summary.", disposition: "provided" as const, at: "2026-11-13" };
  const turn: InterviewTurn = { id, gapId: "handoff", question: "What is reviewed?", rationale: "Find the starting point.",
    sourceIds: ["source"], respondsTo: null, generatorVersion: "test", assessment: null, at: "2026-11-13", answer };
  const scope = { approvedAnswerDigests: [], interviewSession: { endsAt: 100,
    answers: [{ turnId: id, savedAnswerDigest: fingerprint(answer.text), outboundText: "Review the current site." }] } };
  assert.equal(projectInterviewHistory([turn], scope, 200, 99)[0].answer.text, "Review the current site.");
  assert.throws(() => projectInterviewHistory([turn], scope, 200, 100), /not approved/);
  assert.throws(() => projectInterviewHistory([turn], scope, 99, 50), /Invalid interview session/);
  assert.throws(() => projectInterviewHistory([{ ...turn, id: "1d92a248-416f-4e22-baaf-d2f1fca70352" }], scope, 200, 99), /not approved/);
  assert.throws(() => projectInterviewHistory([{ ...turn, answer: { ...answer, text: "A correction." } }], scope, 200, 99), /not approved/);
});
