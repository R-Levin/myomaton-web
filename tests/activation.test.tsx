import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { initialAssessment, assessment, commercial, source } from "../lib/platform/activation/model";
import { submissionDigest, type Submission } from "../lib/platform/reviews/model";
import { intakeAnswersV2 } from "./helpers/intake";

const authority = { operatorId: "test-operator", authorityReference: "test-grant" };
const s: Submission = { id: randomUUID(), intake_id: randomUUID(), web_presence_id: randomUUID(), entry_intent: "DIRECT_START", questionnaire_version: "foundational-intake/2", draft_version: 2, answers: intakeAnswersV2(), provenance: {}, digest: "", submitted_at: new Date().toISOString() };
for (const key of Object.keys(s.answers)) s.provenance[key] = { source: "prospect-supplied", confirmation: "unconfirmed", suppliedAt: s.submitted_at };
s.digest = submissionDigest(s);
test("assessment starts unconfirmed/missing, retains immutable field references, and needs explicit attestation to confirm", () => {
  const initial = initialAssessment(s); assert.equal(initial.filter(a => a.state === "UNCONFIRMED").length, 4); assert.equal(initial.at(-1)!.state, "MISSING");
  assert.deepEqual(assessment(initial, s, authority, s.submitted_at), initial);
  assert.throws(() => assessment(initial.map((a, i) => i ? a : { ...a, state: "CONFIRMED" }), s, authority, s.submitted_at));
  const confirmed = assessment(initial.map((a, i) => i ? a : { ...a, state: "CONFIRMED", reference: "Customer explicitly verified identity in order-123" }), s, authority, s.submitted_at);
  assert.equal(confirmed[0].confirmedBy, authority.operatorId); assert.equal(s.provenance.businessName.confirmation, "unconfirmed");
  assert.throws(() => assessment(initial.map((a, i) => i ? a : { ...a, fields: ["review:recommendation"] }), s, authority, s.submitted_at));
  assert.throws(() => assessment([...initial, initial[0]], s, authority, s.submitted_at));
});
test("commercial metadata is bounded and provider-neutral; credentials/extra fields and missing scope refuse", () => {
  const value = { source: "external-provider", reference: "order-123", confirmedAt: s.submitted_at, launchScope: "Focused Launch", ongoingScope: "Continuing care" };
  assert.equal(commercial(value, authority).recordedBy, authority.operatorId);
  assert.throws(() => commercial({ ...value, cardNumber: "sensitive" }, authority));
  assert.throws(() => commercial({ ...value, ongoingScope: "" }, authority));
  assert.throws(() => commercial({ ...value, confirmedAt: "2999-01-01T00:00:00Z" }, authority));
});
test("source binding requires unchanged immutable digest", () => { assert.equal(source(s).path, "DIRECT_START"); assert.throws(() => source({ ...s, answers: { businessName: "changed" } })); });
