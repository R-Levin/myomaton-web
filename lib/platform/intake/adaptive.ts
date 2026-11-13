import type { Answers, Condition, Field, Question } from "./model";
import { unknownAnswer } from "./onboarding";

export const adaptiveOnboardingVersion = "paid-onboarding/2";
export const prospectPriorities = ["Review first", "Conversation first"] as const;

export type PreparedSource = {
  id: string;
  title: string;
  kind: "Owner-confirmed" | "Website observation" | "Earlier Review answer" | "Earlier Review assessment";
  reference: string;
  date?: string;
  detail: string;
  entries: { label: string; value: string }[];
};

export type PreparedUnderstanding = {
  scenario: "c0" | "c2";
  name: string;
  context: string;
  summary: string;
  foundationGap?: string;
  scopeSummary: string;
  sources: PreparedSource[];
  reconciliation: { title: string; sources: string[]; status: "conflict" | "needs confirmation"; detail: string };
  reviewGap: string;
  offeringPrompt: string;
  proposal: string;
  fit: string;
  inventory: { item: string; disposition: string; reference: string }[];
};

const when = (field: string, ...oneOf: string[]): Condition => ({ field, oneOf });
const note = (key: string, label: string, extra: Partial<Field> = {}): Field => ({ key, label, kind: "textarea", max: 1500, ...extra });
const pick = (key: string, label: string, choices: string[], extra: Partial<Field> = {}): Field => ({ key, label, kind: "single", choices, required: true, ...extra });
const urgent = "Emergency calls and routine estimates";

export const adaptiveQuestions: Question[] = [
  { title: "Check what we’ve carried forward", fields: [
    pick("sourceDecision", "Does the prepared understanding match your current direction?", ["Accurate as summarized", "Needs a correction", unknownAnswer]),
    note("sourceCorrection", "What specifically has changed?", { required: true, when: when("sourceDecision", "Needs a correction") }),
    note("foundationGoal", "What business outcome should this project improve first?"),
  ] },
  { title: "Review fit and scope", fields: [
    pick("rehearsalCommitment", "Would you like to continue into the deeper local interview?", ["Continue in this rehearsal"]),
  ] },
  { title: "Work through one offer and visitor decision", fields: [
    note("workIncluded", "What work should a qualified visitor expect you to handle?"),
    note("workExcluded", "Which jobs, expectations or requests would you decline or review separately?"),
    pick("visitorRoute", "What should an interested visitor do first?", ["Request a Free Review", "Start a conversation", "Request an estimate", urgent, unknownAnswer]),
    note("reviewHandoff", "What does the visitor receive from the Review, and who handles the next step?", { when: when("visitorRoute", "Request a Free Review") }),
    note("conversationHandoff", "What should the visitor bring to the conversation, and who responds?", { when: when("visitorRoute", "Start a conversation") }),
    note("estimateHandoff", "What makes an estimate request actionable, and who handles it?", { when: when("visitorRoute", "Request an estimate", urgent) }),
    note("urgentCoverage", "Which urgent jobs, areas and hours are covered? What should callers do outside coverage?", { when: when("visitorRoute", urgent) }),
    note("publicRoute", "Which actual business contact or public destination should visitors use?", { when: when("visitorRoute", "Request a Free Review", "Start a conversation", "Request an estimate", urgent), hint: "For two paths, name each separately. Keep private routing and access details out of this rehearsal." }),
    note("proof", "What can support the promise, and what permission or verification is still needed?"),
  ] },
  { title: "Decide what to carry forward from the old site", fields: [
    pick("siteDisposition", "How should we handle one additional page, claim, image or link?", ["Keep", "Improve or replace", "Remove from the new site", "Explicitly exclude from future drafts", "Investigate", "No additional decision yet"]),
    note("siteItem", "Identify the item and explain the decision", { required: true, when: when("siteDisposition", "Keep", "Improve or replace", "Remove from the new site", "Explicitly exclude from future drafts", "Investigate") }),
    note("additionalEvidence", "What other material or context should the Operator consider? (optional)", { hint: "Use a nonsecret reference or summary in this rehearsal. Leave passwords, payment details and private files out." }),
    { key: "sitePriority", label: "Which prospect path should this candidate emphasize?", kind: "single", choices: [...prospectPriorities] },
  ] },
];

export const adaptiveAssessmentStep = adaptiveQuestions.length;
export const adaptiveScopeStep = 1;
export const adaptiveOfferStep = 2;

export function adaptiveFoundationErrors(prepared: PreparedUnderstanding, answers: Answers): Record<string, string> {
  return prepared.foundationGap && !answers.foundationGoal ? { foundationGoal: "Describe the priority so we can review the scope." } : {};
}

export function adaptiveGaps(prepared: PreparedUnderstanding, answers: Answers) {
  const gaps: string[] = [];
  if (!answers.sourceDecision || answers.sourceDecision === unknownAnswer) gaps.push(prepared.reconciliation.detail);
  if (answers.sourceDecision === "Needs a correction") gaps.push("Reconcile the new correction with the retained sources before confirming business knowledge.");
  if (!answers.workIncluded || !answers.workExcluded) gaps.push("Confirm ordinary work, exclusions and exceptions for the offer.");
  if (!answers.visitorRoute || answers.visitorRoute === unknownAnswer || !answers.publicRoute) gaps.push("Confirm the intended visitor action and its real destination.");
  if ((answers.visitorRoute === "Request a Free Review" && !answers.reviewHandoff) ||
      (answers.visitorRoute === "Start a conversation" && !answers.conversationHandoff) ||
      ((answers.visitorRoute === "Request an estimate" || answers.visitorRoute === urgent) && !answers.estimateHandoff)) {
    gaps.push("Confirm what happens after the visitor takes the first step.");
  }
  if (answers.visitorRoute === urgent && !answers.urgentCoverage) gaps.push("Verify urgent coverage and out-of-hours guidance before making an emergency response promise.");
  if (!answers.proof) gaps.push("Verify supporting evidence and permission before using proof or performance claims.");
  if (answers.siteDisposition === "Investigate") gaps.push("Resolve the open existing-site item and check URL dependencies separately.");
  return gaps;
}
