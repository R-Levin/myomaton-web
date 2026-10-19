import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { questions, questionsFor, intakeVersion, legacyIntakeVersion, responsesV2 as responses, projects, normalizeAnswers, validateComplete, questionErrors } from "../lib/platform/intake/model";
import { InterviewQuestion } from "../components/intake/question";
import { intakeAnswers, intakeAnswersV2 } from "./helpers/intake";
import { evidencePacket, submissionDigest, synthesize, type Submission } from "../lib/platform/reviews/model";
import { snapshotQuestionnaire } from "../lib/platform/reviews/questionnaire";
import { prospectInterview } from "../lib/platform/reviews/operator-context";
import { loadSolutionContext } from "../scripts/reviews/context";

Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" });

test("Q2 preserves the reference-pair branch policy in both versions and validates every entered URL", () => {
  for (const version of [legacyIntakeVersion, intakeVersion]) for (const project of projects) {
    const fixture = version === legacyIntakeVersion ? intakeAnswers(project) : intakeAnswersV2(project);
    const blank = normalizeAnswers({ ...fixture, website: "  ", publicProfile: "" }, version);
    if (version === legacyIntakeVersion) { assert.equal(blank.website, ""); assert.equal(blank.publicProfile, ""); }
    else { assert.ok(!("website" in blank)); assert.ok(!("publicProfile" in blank)); }
    if (project === projects[1]) { assert.deepEqual(questionErrors(1, blank, version), {}); validateComplete(blank, version); }
    else { assert.match(questionErrors(1, blank, version).website, /website or a public profile/); assert.throws(() => validateComplete(blank, version), /incomplete/); }
    for (const references of [{ website: "example.test" }, { publicProfile: "example.test/profile" }, { website: "example.test", publicProfile: "example.test/profile" }]) {
      const valid = normalizeAnswers({ ...blank, ...references }, version);
      assert.deepEqual(questionErrors(1, valid, version), {}); validateComplete(valid, version);
    }
    assert.equal(normalizeAnswers({ ...blank, website: "example.test" }, version).website, "https://example.test/");
    assert.throws(() => normalizeAnswers({ ...blank, website: "not a website" }, version), /invalid_answers/);
    assert.throws(() => normalizeAnswers({ ...blank, publicProfile: "not a profile" }, version), /invalid_answers/);
    const doc = new JSDOM(renderToStaticMarkup(<InterviewQuestion index={1} questionnaireVersion={version} answers={blank} errors={{}} change={() => {}} />)).window.document;
    assert.equal(doc.querySelector('[name="website"]')!.getAttribute("aria-required"), "false");
  }
});

test("v2 contact action wording is stored and snapshotted without changing v1 or implying a form", () => {
  assert.equal(questions[8].fields[0].choices![1], "Send a message");
  const answers = normalizeAnswers({ ...intakeAnswersV2(), primaryResponse: responses[1], secondaryResponses: [] }, intakeVersion);
  assert.equal(answers.primaryResponse, "Send a message or contact request");
  const doc = new JSDOM(renderToStaticMarkup(<InterviewQuestion index={8} questionnaireVersion={intakeVersion} answers={answers} errors={{}} change={() => {}} />)).window.document;
  assert.equal(doc.querySelectorAll('input[value="Send a message or contact request"]').length, 2);
  assert.equal(doc.querySelectorAll('input[value="Send a message"]').length, 0);
  assert.doesNotMatch(doc.body.textContent!, /Fill out a form/);
  assert.throws(() => normalizeAnswers({ primaryResponse: "Send a message" }, intakeVersion));
  const definition = questionsFor(intakeVersion)[8];
  assert.equal(definition.fields[0].key, "primaryResponse");
  assert.equal(definition.fields[2].key, "secondaryResponses");
});

test("v1 remains separate and unranked; v2 changes only Q9 and keeps twelve groups", () => {
  assert.equal(intakeVersion, "foundational-intake/2");
  assert.equal(questionsFor(legacyIntakeVersion), questions);
  const v2 = questionsFor(intakeVersion); assert.equal(v2.length, 12);
  for (let i = 0; i < 12; i++) if (i !== 8) assert.deepEqual(v2[i], questions[i]);
  assert.equal(questions[8].fields[0].key, "responses");
  assert.equal(v2[8].fields[0].kind, "single");
  assert.deepEqual(v2[8].fields[0].choices, responses);
  const legacy = normalizeAnswers({ ...intakeAnswers(), responses: [responses[2], responses[0]] }, legacyIntakeVersion);
  assert.deepEqual(legacy.responses, [responses[0], responses[2]]);
  validateComplete(legacy, legacyIntakeVersion);
  assert.throws(() => questionsFor("unknown/9"));
});

test("v2 requires a single primary, allows no secondaries and refuses invalid/cross-version answers", () => {
  const valid = intakeAnswersV2(); delete valid.secondaryResponses;
  validateComplete(normalizeAnswers(valid, intakeVersion), intakeVersion);
  assert.ok(questionErrors(8, {}, intakeVersion).primaryResponse);
  for (const patch of [
    { primaryResponse: [responses[0]] }, { primaryResponse: "unknown" },
    { secondaryResponses: [responses[1], responses[1]] }, { secondaryResponses: [responses[0]] },
    { secondaryResponses: ["unknown"] }, { responses: [responses[0]] }, { unexpected: "value" },
  ]) assert.throws(() => normalizeAnswers({ ...intakeAnswersV2(), ...patch }, intakeVersion));
  assert.throws(() => normalizeAnswers(intakeAnswersV2(), legacyIntakeVersion));
  assert.throws(() => normalizeAnswers(intakeAnswers(), intakeVersion));
});

test("distinct custom primary and secondary actions are independent and stale text is removed", () => {
  const custom = { ...intakeAnswersV2(), primaryResponse: "Something else", primaryResponseOther: "Complete the Free Web Presence Review", secondaryResponses: ["Something else"], secondaryResponseOther: "Discuss our fit directly" };
  const normalized = normalizeAnswers(custom, intakeVersion); validateComplete(normalized, intakeVersion);
  assert.equal(normalized.primaryResponseOther, custom.primaryResponseOther);
  assert.equal(normalized.secondaryResponseOther, custom.secondaryResponseOther);
  for (const key of ["primaryResponseOther", "secondaryResponseOther"]) {
    const missing = { ...custom }; delete missing[key as keyof typeof missing];
    assert.ok(questionErrors(8, normalizeAnswers(missing, intakeVersion), intakeVersion)[key]);
  }
  assert.throws(() => normalizeAnswers({ ...custom, secondaryResponseOther: " complete the free web presence review " }, intakeVersion));
  assert.throws(() => normalizeAnswers({ ...custom, primaryResponse: responses[0], secondaryResponseOther: responses[0] }, intakeVersion));
  assert.throws(() => normalizeAnswers({ ...custom, primaryResponseOther: responses[0], secondaryResponses: [responses[0]] }, intakeVersion));
  const changed = normalizeAnswers({ ...custom, primaryResponse: responses[0], secondaryResponses: [responses[1]] }, intakeVersion);
  assert.ok(!("primaryResponseOther" in changed)); assert.ok(!("secondaryResponseOther" in changed));
});

test("one optional booking field follows either role, including when the primary stops being booking", () => {
  for (const primary of [responses[3], responses[4]]) {
    const answers = normalizeAnswers({ primaryResponse: primary, bookingContext: "Synthetic calendar" }, intakeVersion);
    assert.equal(answers.bookingContext, "Synthetic calendar");
  }
  const secondary = normalizeAnswers({ primaryResponse: responses[0], secondaryResponses: [responses[4]], bookingContext: "Synthetic calendar" }, intakeVersion);
  assert.equal(secondary.bookingContext, "Synthetic calendar");
  assert.ok(!("bookingContext" in normalizeAnswers({ primaryResponse: responses[0], bookingContext: "stale" }, intakeVersion)));
  for (const answers of [intakeAnswersV2(), secondary, { primaryResponse: responses[3] }]) {
    const doc = new JSDOM(renderToStaticMarkup(<InterviewQuestion index={8} questionnaireVersion={intakeVersion} answers={answers} errors={{}} change={() => {}} />)).window.document;
    assert.equal(doc.querySelectorAll('[name="bookingContext"]').length, "bookingContext" in answers || answers.primaryResponse === responses[3] ? 1 : 0);
    assert.equal(doc.querySelectorAll('input[type="radio"]').length, 9);
    const primary = doc.querySelector<HTMLInputElement>(`input[name="secondaryResponses"][value="${answers.primaryResponse}"]`);
    if (answers.primaryResponse !== "Something else") assert.equal(primary?.disabled, true);
  }
});

test("v2 Review wording preserves primary/secondary roles and selects the actual booking follow-up parent", async () => {
  const owner = { webPresenceId: randomUUID(), managedSiteId: randomUUID() };
  for (const answers of [
    { ...intakeAnswersV2(), primaryResponse: responses[3], secondaryResponses: [responses[0]], bookingContext: "Synthetic calendar" },
    { ...intakeAnswersV2(), primaryResponse: "Something else", primaryResponseOther: "Complete the Free Web Presence Review", secondaryResponses: [responses[3]], bookingContext: "Synthetic calendar" },
  ]) {
    const s: Submission = { id: randomUUID(), intake_id: randomUUID(), web_presence_id: owner.webPresenceId, entry_intent: "FREE_REVIEW", questionnaire_version: intakeVersion, draft_version: 1, answers, provenance: Object.fromEntries(Object.keys(answers).map(k => [k, { source: "prospect-supplied", confirmation: "unconfirmed", suppliedAt: "2026-10-19T00:00:00Z" }])), digest: "", submitted_at: "2026-10-19T00:00:00Z" }; s.digest = submissionDigest(s);
    const context = snapshotQuestionnaire(s), q9 = context.groups[8];
    assert.equal(context.questionnaireVersion, intakeVersion); assert.equal(context.definitionBasis, "semantic-json");
    assert.equal(q9.fields.find(f => f.key === "primaryResponse")!.kind, "single");
    assert.equal(q9.fields.find(f => f.key === "secondaryResponses")!.optional, true);
    assert.equal(q9.fields.find(f => f.key === "bookingContext")!.followUpTo!.key, answers.primaryResponse === responses[3] ? "primaryResponse" : "secondaryResponses");
    const packet = evidencePacket(owner, s, [], "Synthetic no public evidence", undefined, await loadSolutionContext());
    assert.equal(prospectInterview(packet).questionnaireVersion, intakeVersion);
    const policy = packet.solutionContext!.synthesisPolicy!.visitorActionIntent!;
    assert.equal(policy.weight, "primary-over-secondary"); assert.equal(policy.legacy, "responses-unranked");
    // Inspect the provider request without generating or persisting any Review.
    let observed = false;
    await assert.rejects(synthesize({ packet, operation: "free-review", authorizedAttempts: 1 }, { mode: "development-manual", async synthesize(request) {
      observed = true; assert.equal(request.packet.submission.answers.primaryResponse, answers.primaryResponse);
      assert.deepEqual(request.packet.submission.answers.secondaryResponses, answers.secondaryResponses);
      assert.match(request.guidance!, /materially greater interpretive weight/);
      assert.match(request.guidance!, /not equal-priority goals/);
      throw Error("Synthetic inspection only");
    } }), /Synthetic inspection only/);
    assert.equal(observed, true);
  }
  const definition = JSON.parse(await readFile("lib/platform/reviews/questionnaires/foundational-intake-2.json", "utf8"));
  assert.equal(createHash("sha256").update(JSON.stringify({ questionnaireVersion: definition.questionnaireVersion, groups: definition.groups })).digest("hex"), definition.definitionSha256);
});


test("frozen v1 wording and question model retain the accepted byte/semantic fingerprints", async () => {
  const bytes = await readFile("lib/platform/reviews/questionnaires/foundational-intake-1.json");
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "6b3ffaf1902f387f4400ca3e03980a10d897521b2c2afe61e32727b05b55fad9");
  assert.equal(createHash("sha256").update(JSON.stringify(questions)).digest("hex"), "b3164b1b4adf7152d192587d15df29be239345c22054499331e86f377dc9dccf");
});
