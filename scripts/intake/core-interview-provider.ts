import type { QuestionContext, QuestionProvider } from "../../lib/platform/intake/intelligent-model";
import { previousQuestions } from "./research-first";

export type InterviewScenario = keyof typeof previousQuestions;

const reasons = {
  c0: "A clear scope makes the Launch promise concrete for both new sites and migrations.",
  c2: "People calling about a hazardous tree need to know what the urgent route can handle.",
  startup: "A confirmed service area lets customers check whether a visit is practical before requesting one.",
};

const followUp = {
  c0: ["The included Launch build or migration limit is still open.", "For a new site or migration, what limit can you actually include in Launch?"],
  c2: ["Eligible urgent jobs or the verified fallback still need confirmation.", "Which urgent jobs can someone dispatch during staffed hours, and what verified referral covers other calls?"],
  startup: ["The pilot still needs a specific service area.", "Which ZIP codes or named neighborhoods can the mechanic reliably visit in the first month?"],
} as const;
const recommendations = {
  c0: "Use the stated Launch limit to draft the included scope for Operator review.",
  c2: "Draft the urgent routing and referral from the confirmed service details for Operator review.",
  startup: "Use the stated pilot coverage to draft a service-area check before booking for Operator review.",
};

// A bounded local substitute for follow-up generation. Extract only explicit,
// supported wording and leave ambiguous answers open for human review.
function review(scenario: InterviewScenario, reply: string) {
  const clauses = reply.match(/[^.!?]+[.!?]*/gu)?.map(value => value.trim()).filter(Boolean) ?? [];
  const direct = clauses.find(value => Buffer.byteLength(JSON.stringify(value)) <= 452 && !/\b(?:not|no|maybe|unknown|unsure|might|could|should|whether|unconfirmed)\b/i.test(value) && (
    scenario === "c0" ? /\b(?:launch|new (?:site|build)|migration)\b/i.test(value) &&
      /\b(?:includes?|covers?|limited to|up to|maximum of)\b.{0,80}\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b.{0,16}\bpages?\b/i.test(value) &&
      !/\b(?:ongoing|monthly|existing clients?)\b/i.test(value)
      : scenario === "c2" ? /\burgent\b.*\b(?:accepts?|covers?|dispatch(?:es)?|eligible)\b/i.test(value) &&
        /\b(?:fallen|blocking|storm)\b/i.test(value) && /\b(?:refer|redirect|fallback)\b/i.test(value)
      : /\b(?:cover|covers|serve|serves|pilot)\b/i.test(value) && /\b[0-9]{5}\b/u.test(value)
  ));
  const ongoing = scenario === "c0" && clauses.find(value => /\b(?:ongoing|monthly|existing clients?|existing customers?)\b/i.test(value));
  return {
    direct,
    relevance: direct ? "direct" : ongoing ? "off-topic" : reply ? "partial" : "needs-confirmation",
    topic: direct ? previousQuestions[scenario].unknown : ongoing ? "Changes for existing customers during Ongoing" : reply ? "Customer-supplied context awaiting clarification" : "No answer supplied",
    excerpt: direct || [ongoing, ...clauses].find(value => value && Buffer.byteLength(JSON.stringify(value)) <= 452) || (reply ? Array.from(reply).slice(0, 90).join("") : null),
  };
}

export function localInterviewProvider(scenario: InterviewScenario): QuestionProvider {
  return { version: "local-rehearsal/1", reviewAnswers: true, async propose({ gap, history }: QuestionContext) {
    const initial = previousQuestions[scenario];
    const rationale = reasons[scenario];
    const prior = history.at(-1);
    const sourceIds = initial.sourceIds.filter(id => gap.sourceIds.includes(id));
    if (!prior?.answer) return { question: initial.question, rationale, sourceIds, assessment: null };
    const { direct, relevance, topic, excerpt } = review(scenario, prior.answer.text ?? "");
    const [unresolved, question] = followUp[scenario];
    return {
      question: direct || history.some(turn => turn.question === question)
        ? direct ? null : "What confirmed detail can we record for this open decision?"
        : question,
      rationale,
      sourceIds: [...sourceIds, prior.id + ":answer"],
      answerReview: { relevance, topic, excerpt, unresolved: direct ? null : unresolved },
      assessment: direct ? { recommendation: recommendations[scenario], evidenceNeeded: null } : null,
    };
  } };
}
