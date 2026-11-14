import { test } from "node:test";
import assert from "node:assert/strict";
import { fingerprint } from "../lib/platform/canonical/model";
import { prepareSitePlanning, readSitePlanning, sitePlanningFormat } from "../lib/platform/intake/site-planning";
import type { InterviewEvidence, InterviewTurn } from "../lib/platform/intake/intelligent-model";

const now = Date.parse("2026-11-13T12:00:00Z");
const source = (id: string, statement: string): InterviewEvidence => ({
  id, kind: "owner-confirmed", statement, reference: "Retained private source pointer", at: new Date(now).toISOString(),
});
const owner = (id: string) => fingerprint({ id });
const grant = (ownerDigest: string, evidence: InterviewEvidence[]) => ({
  ownerDigest, evidenceDigest: fingerprint(evidence), expiresAt: now + 1000, approvedAnswerDigests: [],
});
const page = (path: string, title: string, body: string, action: string) => ({
  path, title, purpose: title, seoDescription: title, action, sections: [{ heading: title, body }],
});
const signal = (path: string, id: string, destination: string | null) => ({
  path, sourceIds: [id], sectionSourceIds: [[id]], actionKind: destination ? "learn" : "request-contact", destination,
});

test("validates distinct, editable site shapes and visitor decisions against their own evidence", () => {
  const c0 = [source("transition", "The business is transitioning to managed Web Presence.")];
  const c2 = [source("tree", "Storm-damage assessments and scheduled pruning have distinct visitor needs.")];
  const a = prepareSitePlanning(owner("c0"), c0, [], grant(owner("c0"), c0), now);
  const b = prepareSitePlanning(owner("c2"), c2, [], grant(owner("c2"), c2), now);
  const draftA = {
    plan: { positioning: "Managed Web Presence", offering: "A review before scoping", audience: "Small businesses with a website",
      pages: [page("/", "Understand your web options", "Start with the website you already have.", "See the approach"),
        page("/approach", "Start with a review", "Discuss the existing site before deciding how to proceed.", "Request a conversation")] },
    directionSourceIds: ["transition"], pages: [signal("/", "transition", "/approach"), signal("/approach", "transition", null)],
    unresolved: ["Launch eligibility remains unconfirmed."],
  };
  const draftB = {
    plan: { positioning: "Tree care with clear next steps", offering: "Storm assessment and routine pruning", audience: "Property owners",
      pages: [page("/", "Tree care", "Choose the next step based on your situation.", "Explore storm assessment"),
        page("/storm", "Storm damage", "Tell us about damage from a safe location.", "Request an assessment"),
        page("/pruning", "Scheduled pruning", "Describe the tree and the work you want considered.", "Discuss pruning")] },
    directionSourceIds: ["tree"], pages: [signal("/", "tree", "/storm"), signal("/storm", "tree", null), signal("/pruning", "tree", null)],
    unresolved: ["Emergency availability is unconfirmed."],
  };
  const x = readSitePlanning(draftA, a), y = readSitePlanning(draftB, b);
  assert.deepEqual(x.plan.pages.map(item => item.path), ["/", "/approach"]);
  assert.deepEqual(y.plan.pages.map(item => item.path), ["/", "/storm", "/pruning"]);
  assert.equal(y.evidence[1].action.kind, "request-contact");
  assert.equal(x.status, "proposed");
  assert.notEqual(x.digest, y.digest);
  assert.doesNotMatch(JSON.stringify(a.input), /Retained private source pointer/);
  assert.equal(sitePlanningFormat(a).strict, true);
  assert.throws(() => readSitePlanning(draftA, b), /citations refused/);
  assert.throws(() => readSitePlanning({ ...draftA, pages: [signal("/", "transition", "https://example.test"), draftA.pages[1]] }, a), /visitor action refused/);
  assert.throws(() => readSitePlanning({ ...draftA, pages: [{ ...draftA.pages[0], sectionSourceIds: [] }, draftA.pages[1]] }, a), /section evidence mismatch/);
});

test("fails closed for a changed evidence set, wrong tenant, expired grant or unapproved correction", () => {
  const tenant = owner("c0"), evidence = [source("transition", "New managed service in development.")];
  const original: InterviewTurn = {
    id: "b59dd874-cf5b-437b-911e-5400df2295b5", gapId: "first-action", question: "What should visitors do first?",
    rationale: "Select the first visitor action.", sourceIds: ["transition"], respondsTo: null, generatorVersion: "fixture",
    assessment: null, at: evidence[0].at, answer: { text: "Private original.", disposition: "provided", at: evidence[0].at },
  };
  const correction = {
    ...original, id: "d581e1c9-8148-47f6-a990-8475d77fc990", replacesAnswerTo: original.id,
    answer: { ...original.answer!, text: "Private correction." },
  };
  const auth = { ...grant(tenant, evidence), approvedProjections: [
    { savedAnswerDigest: fingerprint(correction.answer.text), outboundText: "Ask visitors for the existing site address." },
  ] };
  const prepared = prepareSitePlanning(tenant, evidence, [original, correction], auth, now);
  assert.deepEqual(prepared.input.answers.map(item => [item.id, item.statement, item.confirmation]), [
    [correction.id + ":answer", "Ask visitors for the existing site address.", "unconfirmed"],
  ]);
  assert.doesNotMatch(JSON.stringify(prepared.input), /Private original|Private correction|What should visitors do first/);
  assert.throws(() => prepareSitePlanning(owner("c2"), evidence, [], auth, now), /not authorized/);
  assert.throws(() => prepareSitePlanning(tenant, [source("transition", "Different evidence")], [], auth, now), /not authorized/);
  assert.throws(() => prepareSitePlanning(tenant, evidence, [], auth, auth.expiresAt), /not authorized/);
  assert.throws(() => prepareSitePlanning(tenant, evidence, [original, correction], grant(tenant, evidence), now), /transmission not approved/);
});
