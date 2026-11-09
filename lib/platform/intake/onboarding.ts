import type { Field, Question } from "./model";

export const onboardingVersion = "paid-onboarding/1";
export const unknownAnswer = "Not sure yet";
const websiteChoices = ["Keep or replace an existing website", "Start without an existing website", unknownAnswer];
const notes = (key: string, label: string, extra: Partial<Field> = {}): Field => ({ key, label, kind: "textarea", max: 700, ...extra });
const pick = (key: string, label: string, choices: string[], extra: Partial<Field> = {}): Field => ({ key, label, kind: "single", choices, ...extra });

// Reuse stable foundational keys and choices. The paid continuation adds
// only the detail needed for a first build basis, with explicit unknowns.
export function paidQuestions(foundational: Question[]): Question[] {
  const base = (key: string) => foundational.flatMap(question => question.fields).find(field => field.key === key)!;
  const action = base("primaryResponse");
  const area = base("serviceArea");
  return [
    { title: "Your business", fields: [base("businessName"), base("website"), notes("reviewContact", "Who should review the business information? (optional)")] },
    { title: "What you provide", fields: [base("offer"), notes("offerPriority", "Which service should people learn about first, and why? (optional)")] },
    { title: "Who you want to reach", fields: [base("audience"), notes("audienceNeeds", "What are these customers trying to accomplish? (optional)")] },
    { title: "How people should contact you", fields: [{ ...action, choices: [...action.choices!, unknownAnswer] }, base("primaryResponseOther"),
      { ...base("bookingContext"), whenAny: [{ field: "primaryResponse", oneOf: ["Book an appointment or consultation", "Schedule service"] }] },
      notes("publicDestination", "What public contact or booking destination should people use? (optional)", { when: { field: "primaryResponse", oneOf: ["Call us", "Send a message or contact request", "Request a quote or estimate", "Book an appointment or consultation", "Schedule service"] } })] },
    { title: "Where and how you operate", fields: [{ ...area, choices: [...area.choices!, unknownAnswer] }, base("locations"),
      pick("hasLimitations", "Do visitors need to know about any special requirements?", ["Yes", "No", unknownAnswer]),
      notes("limitations", "What should visitors know before contacting you?", { required: true, when: { field: "hasLimitations", oneOf: ["Yes"] } })] },
    { title: "Credibility and materials", fields: [notes("proof", "What real examples, credentials or materials could help people trust your business? (optional)", { hint: "Identify the material and any permission still needed. Listing it does not grant permission to publish." })] },
    { title: "Existing presence and preferences", fields: [pick("siteSituation", "Is there an existing website to carry forward?", websiteChoices, { required: true }),
      notes("keepFromSite", "What content, pages or links should we preserve? (optional)", { when: { field: "siteSituation", oneOf: [websiteChoices[0]] } }),
      notes("stylePreferences", "What should the site feel like, or avoid? (optional)")] },
    { title: "Operational needs and handoff", fields: [pick("hasDependencies", "Are there systems or requirements we should account for before launch?", ["Yes", "No", unknownAnswer]),
      notes("dependencies", "Which systems, people or requirements should we account for?", { required: true, when: { field: "hasDependencies", oneOf: ["Yes"] }, hint: "A system name or responsibility is enough. Leave passwords, payment details and access codes out." })] },
    { title: "How we'll work together", fields: [pick("routinePreference", "What would you prefer for routine updates?", ["Review a limited standing approval later", "Discuss updates individually", unknownAnswer], { hint: "This is a preference for discussion. Any standing permission would be a separate decision." })] },
    { title: "Anything important missing?", fields: [notes("additional", "What else should we understand before proposing your site? (optional)")] },
  ];
}
