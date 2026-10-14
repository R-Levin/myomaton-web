import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { InterviewQuestion } from "../components/intake/question";
import { questions, projects, goals, responses, areas, normalizeAnswers, validateComplete, questionErrors, questionTitle, reviewConfirmation, currentScreenAnswers } from "../lib/platform/intake/model";
import { intakeEnabled, mioPagesIntakeOwner } from "../lib/platform/intake/availability";
import { intakeAnswers } from "./helpers/intake";
import { intakeStorageSchema } from "../lib/platform/intake/storage";
import { canonicalPagePath } from "../lib/platform/managed-sites/paths";

test("all twelve groups render accessible fields with optional phone/role/additional copy and no internal jargon", () => {
  const answers = intakeAnswers();
  assert.equal(questions.length, 12);
  for (const [index, question] of questions.entries()) {
    const doc = new JSDOM(renderToStaticMarkup(<InterviewQuestion index={index} answers={answers} errors={{}} change={() => {}} />)).window.document;
    for (const f of question.fields.filter(f => !f.when)) assert.ok(doc.querySelector(`[name="${f.key}"]`));
    assert.doesNotMatch(doc.body.textContent ?? "", /inquir(?:y|ies)|questionnaire_version|operator_review|canonical|tenant|schema/i);
    for (const input of doc.querySelectorAll("input:not([type=checkbox]):not([type=radio]),textarea")) assert.ok(doc.querySelector(`label[for="${input.id}"]`));
  }
  assert.match(questions[10].fields.find(f => f.key === "phone")!.label, /optional/);
});
test("up to three goals, multiple response methods, optional answers and three project branches", () => {
  for (const project of projects) assert.doesNotThrow(() => validateComplete(normalizeAnswers(intakeAnswers(project))));
  const a = intakeAnswers(); a.goals = goals.slice(0, 3); a.responses = responses.slice(0, 4);
  assert.equal((normalizeAnswers(a).responses as string[]).length, 4);
  assert.doesNotThrow(() => validateComplete(normalizeAnswers(a)));
  assert.throws(() => normalizeAnswers({ ...a, goals: goals.slice(0, 4) }));
  assert.throws(() => normalizeAnswers({ ...a, goals: [goals[0], goals[0]] }));
  assert.ok(questionErrors(1, { ...a, website: "" }).website);
  assert.deepEqual(questionErrors(1, { ...a, project: projects[1], website: "" }), {});
  assert.match(questionTitle(6, { project: projects[1] }), /establishing/);
  assert.match(questionTitle(6, { project: projects[2] }), /Campaign/);
});
test("conditional booking, location and other fields appear only when relevant and stale answers are removed", () => {
  const a = intakeAnswers(); a.bookingContext = "Removed when irrelevant"; a.serviceArea = areas[4];
  const normalized = normalizeAnswers(a); assert.ok(!("bookingContext" in normalized)); assert.ok(!("locations" in normalized));
  const booking = new JSDOM(renderToStaticMarkup(<InterviewQuestion index={8} answers={{ ...a, responses: [responses[3]] }} errors={{}} change={() => {}} />)).window.document;
  assert.ok(booking.querySelector('[name="bookingContext"]'));
  const online = new JSDOM(renderToStaticMarkup(<InterviewQuestion index={9} answers={a} errors={{}} change={() => {}} />)).window.document;
  assert.equal(online.querySelector('[name="locations"]'), null);
  assert.throws(() => validateComplete(normalizeAnswers({ ...a, goals: ["Something else"] })));
  assert.throws(() => validateComplete(normalizeAnswers({ ...a, responses: ["Something else"] })));
  assert.ok(!questions.flatMap(q => q.fields).some(f => /urgency/i.test(f.key)));
});
test("unknown fields, arbitrary markup, bad URLs, control characters, invalid email and unbounded values refuse", () => {
  for (const patch of [{ customerId: "pretend" }, { offer: "<script>alert(1)</script>" }, { website: "javascript:alert(1)" }, { website: "https://user:password@example.test" }, { email: "not an email" }, { audience: "x\u0000" }, { audience: "x".repeat(1501) }, { goals: ["unknown"] }]) assert.throws(() => normalizeAnswers({ ...intakeAnswers(), ...patch }));
  assert.throws(() => validateComplete(normalizeAnswers({})));
  assert.doesNotThrow(() => normalizeAnswers({ businessName: "MioPages", website: "https://miopages.com" }));
});
test("direct start uses the same foundation without implying paid onboarding or Review delivery", () => {
  assert.equal(questionTitle(0, {}, "DIRECT_START"), questions[0].title);
  assert.match(questionTitle(7, {}, "DIRECT_START"), /getting started/);
  assert.match(reviewConfirmation.join(" "), /not instant/); assert.match(reviewConfirmation.join(" "), /before delivery/); assert.doesNotMatch(reviewConfirmation.join(" "), /not available|not been sent|Your information was received/);
});
test("pilot activation is explicit, development-only and refuses other customers", () => {
  const env = { NODE_ENV: "development", MIOPAGES_REVIEW_INTAKE: "local-development", INTAKE_DATABASE_URL: "configured" };
  assert.equal(intakeEnabled(mioPagesIntakeOwner, env), true);
  assert.equal(intakeEnabled(mioPagesIntakeOwner, { ...env, NODE_ENV: "production" }), false);
  assert.equal(intakeEnabled({ ...mioPagesIntakeOwner, webPresenceId: "foreign" }, env), false);
  assert.equal(intakeEnabled(mioPagesIntakeOwner, { ...env, INTAKE_DATABASE_URL: "" }), false);
  const schema = "canonical_test_" + "a".repeat(32) + "_intake";
  const url = new URL("postgres://localhost/test"); url.searchParams.set("options", `-c search_path=${schema} -c timezone=UTC`);
  assert.equal(intakeStorageSchema(url.toString()), schema);
  url.searchParams.set("options", "-c search_path=public"); assert.throws(() => intakeStorageSchema(url.toString()));
  assert.equal(canonicalPagePath("/review/intake"), null);
  assert.equal(canonicalPagePath("/review/intake/child"), null);
  assert.equal(canonicalPagePath("/review"), "/review");
});


test("natural public domain/profile addresses normalize; private and unsafe addresses refuse", () => {
  for (const [address, expected] of [["miopages.com", "https://miopages.com/"], ["www.example.com", "https://www.example.com/"], ["linkedin.com/company/example", "https://linkedin.com/company/example"]]) {
    assert.equal(normalizeAnswers({website: address}).website, expected);
    assert.equal(normalizeAnswers({publicProfile: address}).publicProfile, expected);
  }
  for (const website of ["localhost", "http://127.1", "http://2130706433", "http://10.0.0.1", "http://192.168.1.1", "http://169.254.169.254", "http://[::1]", "http://[::ffff:127.0.0.1]", "printer.local", "host.internal", "https://user:password@example.com", "javascript:alert(1)", "file:///tmp/test", "https://example.com/a b"]) assert.throws(() => normalizeAnswers({website}));
});

test("active form controls override older state for text, URL, textarea, radio and multiple choices", () => {
  for (const [index, values] of [[1, {businessName: "Current business", website: "miopages.com", publicProfile: "linkedin.com/company/example"}], [3, {audience: "Current audience"}], [0, {project: projects[1]}], [2, {goals: goals.slice(0, 3)}]] as const) {
    const doc = new JSDOM(renderToStaticMarkup(<form><InterviewQuestion index={index} answers={{}} errors={{}} change={() => {}} /></form>)).window;
    for (const [key, value] of Object.entries(values)) {
      const controls = [...doc.document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(`[name="${key}"]`)];
      for (const control of controls) if (control.type === "radio" || control.type === "checkbox") (control as HTMLInputElement).checked = Array.isArray(value) ? value.includes(control.value) : value === control.value; else control.value = value as string;
    }
    const result = normalizeAnswers(currentScreenAnswers(index, {offer: "Earlier answer"}, new doc.FormData(doc.document.querySelector("form")!)));
    for (const [key, value] of Object.entries(values)) assert.deepEqual(result[key], key === "website" || key === "publicProfile" ? new URL(`https://${value}`).toString() : value);
    assert.equal(result.offer, "Earlier answer");
    doc.close();
  }
});

test("repeated prompts retain hidden accessible labels and Q12 has a separate Optional hint", () => {
  for (const index of [3, 5, 6, 9, 11]) {
    const doc = new JSDOM(renderToStaticMarkup(<InterviewQuestion index={index} answers={intakeAnswers()} errors={{}} change={() => {}} classes={{visuallyHidden: "hidden-label"}} />)).window.document;
    assert.equal(doc.querySelectorAll(".hidden-label").length, 1);
    assert.ok(doc.querySelector(index === 9 ? "legend.hidden-label" : "label.hidden-label"));
    if (index === 11) assert.equal([...doc.querySelectorAll("p")].some(p => p.textContent === "Optional"), true);
  }
});


test("public URL errors and Review-focus helper use the approved customer copy", () => {
  try { normalizeAnswers({website: "http://127.0.0.1"}); assert.fail("Expected refusal"); }
  catch (e) { assert.equal((e as {fields:Record<string,string>}).fields.website, "Enter a valid public website address."); }
  const doc = new JSDOM(renderToStaticMarkup(<InterviewQuestion index={7} answers={{}} errors={{}} change={() => {}} classes={{visuallyHidden: "hidden-label"}} />)).window.document;
  assert.doesNotMatch(doc.body.textContent!, /A question to answer, problem to examine/);
  assert.ok(doc.querySelector("label.hidden-label"));
  assert.equal(questions[7].fields[0].hint, "Is there a question you'd like us to answer, a problem you'd like us to look at, or an opportunity you'd like us to consider?");
});
