// Shared foundational information, not confirmed canonical customer knowledge.
export const intakeVersion = "foundational-intake/1";
export type EntryIntent = "FREE_REVIEW" | "DIRECT_START";
export type Answers = Record<string, string | string[]>;
export type Condition = { field: string; oneOf: string[] };
export type Field = { key: string; label: string; kind: "text" | "textarea" | "email" | "url" | "single" | "multiple"; required?: boolean; max?: number; choices?: readonly string[]; when?: Condition; labels?: { when: Condition; label: string }[]; hint?: string };
export type Question = { title: string; fields: Field[] };
export const projects = ["Improve or replace an existing Web presence", "Build a new Web presence from scratch", "Create a focused Campaign/addition alongside an existing presence"] as const;
export const goals = ["Get more qualified leads", "Help the right people understand what we offer", "Improve search visibility", "Promote a specific service, product, location, or Campaign", "Replace an outdated or ineffective website", "Establish a professional presence for a new business or organization", "Something else"] as const;
export const responses = ["Call us", "Send a message", "Request a quote or estimate", "Book an appointment or consultation", "Schedule service", "Visit a location", "Buy or order through another system", "Sign up / register", "Something else"] as const;
export const areas = ["Local area", "Several cities or regions", "Statewide", "Nationwide", "Primarily online / location is not important", "Something else"] as const;
export const questions: Question[] = [
  { title: "What are you looking to do?", fields: [{ key: "project", label: "What are you looking to do?", kind: "single", choices: projects, required: true }] },
  { title: "What business or organization should we review?", fields: [
    { key: "businessName", label: "Business or organization name", kind: "text", required: true, max: 160 },
    { key: "website", label: "Website URL", kind: "url", max: 1000, hint: "If you have an existing presence, provide a website or public profile. No website is needed when starting from scratch. You can leave off https://." },
    { key: "publicProfile", label: "Other public profile or listing (optional)", kind: "url", max: 1000, hint: "For example, a LinkedIn company page, Google Business Profile, Facebook page or industry directory. You can leave off https://." },
  ] },
  { title: "What do you most want your Web presence to accomplish?", fields: [
    { key: "goals", label: "Choose up to 3", kind: "multiple", choices: goals, required: true, max: 3 },
    { key: "goalOther", label: "What else would you like to accomplish?", kind: "text", required: true, when: { field: "goals", oneOf: ["Something else"] } },
  ] },
  { title: "Who are you most trying to reach?", fields: [{ key: "audience", label: "Who are you most trying to reach?", kind: "textarea", required: true, hint: "For example, local homeowners or teams at growing businesses." }] },
  { title: "What do you offer?", fields: [{ key: "offer", label: "Main products, services, programs or other offerings", kind: "textarea", required: true, hint: "A short summary is enough. You do not need to list everything." }] },
  { title: "Why do customers choose you?", fields: [{ key: "difference", label: "Why do customers choose you?", kind: "textarea", required: true, hint: "If you are starting out or unsure, say so. You do not need to invent a claim." }] },
  { title: "What is the biggest problem with your current Web presence?", fields: [{ key: "problem", label: "What is the biggest problem with your current Web presence?", kind: "textarea", required: true, labels: [
    { when: { field: "project", oneOf: [projects[1]] }, label: "What is the biggest challenge in establishing your new Web presence?" },
    { when: { field: "project", oneOf: [projects[2]] }, label: "What should this focused Campaign or addition improve?" },
  ] }] },
  { title: "What would make this Review most useful to you?", fields: [{ key: "reviewFocus", label: "What would make this Review most useful to you?", kind: "textarea", required: true, hint: "Is there a question you'd like us to answer, a problem you'd like us to look at, or an opportunity you'd like us to consider?" }] },
  { title: "How would you ideally like prospects to respond?", fields: [
    { key: "responses", label: "Choose all that apply", kind: "multiple", choices: responses, required: true },
    { key: "responseOther", label: "How else would you like people to respond?", kind: "text", required: true, when: { field: "responses", oneOf: ["Something else"] } },
    { key: "bookingContext", label: "Do you already use a booking system? (optional)", kind: "text", when: { field: "responses", oneOf: [responses[3], responses[4]] }, hint: "If so, its name is enough. Do not provide passwords or access details." },
  ] },
  { title: "Where do you serve customers?", fields: [
    { key: "serviceArea", label: "Where do you serve customers?", kind: "single", choices: areas, required: true },
    { key: "locations", label: "Which locations or service areas?", kind: "text", required: true, when: { field: "serviceArea", oneOf: [areas[0], areas[1], areas[2], areas[5]] } },
  ] },
  { title: "Where should we send your Review?", fields: [
    { key: "contactName", label: "Your name", kind: "text", required: true, max: 160 },
    { key: "email", label: "Email", kind: "email", required: true, max: 254 },
    { key: "role", label: "Role or title (optional)", kind: "text", max: 160 },
    { key: "phone", label: "Phone (optional)", kind: "text", max: 60 },
  ] },
  { title: "Anything else you'd like us to know?", fields: [{ key: "additional", label: "Anything else you'd like us to know? (optional)", kind: "textarea" }] },
];
export class IntakeError extends Error {
  constructor(public code: string, public status = 400, public fields: Record<string, string> = {}) { super(code); }
}
export function matches(condition: Condition | undefined, answers: Answers) {
  if (!condition) return true;
  const value = answers[condition.field];
  return condition.oneOf.some(option => Array.isArray(value) ? value.includes(option) : value === option);
}
export function fieldLabel(field: Field, answers: Answers) { return field.labels?.find(l => matches(l.when, answers))?.label ?? field.label; }
export function questionTitle(index: number, answers: Answers, intent: EntryIntent = "FREE_REVIEW") {
  if (index === 6) return fieldLabel(questions[index].fields[0], answers);
  if (intent === "DIRECT_START" && index === 7) return "What would make getting started most useful to you?";
  if (intent === "DIRECT_START" && index === 10) return "How should we contact you about getting started?";
  return questions[index].title;
}
const fields = questions.flatMap(q => q.fields);
export function normalizeAnswers(value: unknown): Answers {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new IntakeError("invalid_answers");
  const input = value as Record<string, unknown>, result: Answers = {};
  for (const key of Object.keys(input)) if (!fields.some(f => f.key === key)) throw new IntakeError("invalid_answers");
  for (const field of fields) {
    const v = input[field.key]; if (v === undefined) continue;
    if (field.kind === "multiple") {
      if (!Array.isArray(v) || v.some(x => typeof x !== "string" || !field.choices!.includes(x)) || new Set(v).size !== v.length || v.length > (field.max ?? field.choices!.length)) throw new IntakeError("invalid_answers", 400, { [field.key]: `Choose up to ${field.max ?? field.choices!.length}.` });
      result[field.key] = field.choices!.filter(c => v.includes(c));
    } else {
      if (typeof v !== "string" || v.length > (field.max ?? 1500) || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(v)) throw new IntakeError("invalid_answers", 400, { [field.key]: "Use plain text within the field limit." });
      let s = v.trim();
      if (field.kind === "single" && s && !field.choices!.includes(s)) throw new IntakeError("invalid_answers");
      if (field.kind === "email" && s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new IntakeError("invalid_answers", 400, { [field.key]: "Enter a valid email address." });
      if (field.kind === "url" && s) {
        try {
          const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
          const host = u.hostname.toLowerCase().replace(/\.$/, "");
          // Domain addresses only: literal IPs and local/internal names are not public profiles.
          if (!["https:", "http:"].includes(u.protocol) || u.username || u.password || /[\s\\]/.test(s) || !host.includes(".") || /[\[\]:]/.test(host) || /^\d+\.\d+\.\d+\.\d+$/.test(host) || /(?:^|\.)(?:localhost|local|internal|lan|home|invalid)$/.test(host) || !/^[a-z0-9.-]+$/.test(host) || host.split(".").some(label => !label || label.startsWith("-") || label.endsWith("-"))) throw Error();
          s = u.toString();
        } catch { throw new IntakeError("invalid_answers", 400, { [field.key]: "Enter a valid public website address." }); }
      }
      result[field.key] = s;
    }
  }
  // Inapplicable answers are not retained or passed into later work.
  for (const field of fields) if (!matches(field.when, result)) delete result[field.key];
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > 14000) throw new IntakeError("payload_too_large", 413);
  return result;
}
export function questionErrors(index: number, answers: Answers): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of questions[index].fields) {
    const v = answers[field.key];
    if (matches(field.when, answers) && field.required && (!v || Array.isArray(v) && !v.length)) errors[field.key] = "Please answer this question.";
  }
  if (index === 1 && [projects[0], projects[2]].includes(answers.project as typeof projects[0]) && !answers.website && !answers.publicProfile) errors.website = "Provide your website or a public profile for the existing presence.";
  return errors;
}
export function validateComplete(answers: Answers) {
  const errors = Object.assign({}, ...questions.map((_, i) => questionErrors(i, answers)));
  if (Object.keys(errors).length) throw new IntakeError("incomplete", 400, errors);
}
export const reviewConfirmation = [
  "MioPages will review your information. The Review is not instant. An operator will review the result before delivery.",
  "The Review is cost-free and does not commit you to paid work.",
  "Your submitted answers are preserved.",
];

// Read the active controls at the action boundary, including browser autofill values.
// Earlier answers remain intact; normalization and server version checks still apply.
export function currentScreenAnswers(index: number, answers: Answers, data: Pick<FormData, "getAll">): Answers {
  const result = { ...answers };
  for (const field of questions[index].fields.filter(f => matches(f.when, answers))) {
    const values = data.getAll(field.key).filter((v): v is string => typeof v === "string");
    result[field.key] = field.kind === "multiple" ? values : values[0] ?? "";
  }
  return result;
}
