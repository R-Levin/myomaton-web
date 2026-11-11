import { readFile } from "node:fs/promises";

const cases = [
  ["c0-ongoing", "MioPages C0 · Ongoing reply"],
  ["c0-launch", "MioPages C0 · Launch reply"],
  ["c2", "Fictional C2 · Tree service"],
  ["startup", "Hypothetical startup · Mobile bicycle repair"],
] as const;

export const onboardingEvidencePath = "/development-evidence/onboarding";

export async function loadOnboardingEvidence(attempt: string) {
  if (!/^attempt-[0-9]{2}$/.test(attempt)) throw Error("Expected a numbered local onboarding proof");
  const display = (value: unknown): string => {
    if (typeof value !== "string" || !value.trim() || value.length > 1000) throw Error("Invalid onboarding review field");
    return value;
  };
  const optional = (value: unknown) => value === null ? null : display(value);
  return Promise.all(cases.map(async ([id, label]) => {
    const receipt = JSON.parse(await readFile(`runtime-content/openai-onboarding-proof/${attempt}/market-${id}.json`, "utf8"));
    const review = receipt.answerReview;
    if (receipt.research !== null || receipt.before !== "open" ||
        !["open", "planning-review"].includes(receipt.after) ||
        !["direct", "partial", "off-topic", "needs-confirmation"].includes(review?.relevance)) {
      throw Error("Expected saved contrast evidence");
    }
    return {
      id, label, question: display(receipt.selected), answer: display(receipt.answer),
      relevance: display(review.relevance), topic: display(review.topic), excerpt: optional(review.excerpt),
      unresolved: optional(review.unresolved), clarification: optional(receipt.followUp),
      recommendation: receipt.assessment === null ? null : display(receipt.assessment.recommendation),
      status: receipt.after === "open" ? "Still open" : "Ready for planning review",
    };
  }));
}

export type OnboardingEvidence = Awaited<ReturnType<typeof loadOnboardingEvidence>>;
