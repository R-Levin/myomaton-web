import { createHash } from "node:crypto";
import { object, text } from "../canonical/model";

export const capabilityStatuses = ["AVAILABLE_PROVEN", "DEFINED_EVOLVING", "PLANNED_DEFERRED", "EXTERNAL_INTEGRATION"] as const;
export type SolutionContext = {
  version: "review-solution/1";
  role: "internal-service-context";
  capturedAt: string;
  writingGuidance?: { version: "review-writing/2" | "review-writing/3" | "review-writing/4" | "review-writing/5"; text: string; sha256: string };
  synthesisPolicy?: { managedServiceResponsibilities: string[]; customerResponsibilities: string[]; responseOptions: "unranked-signals"; primaryActionBasis: "full-business-context"; ongoingInput?: { mode: "optional-after-onboarding"; interface: "deferred"; examples: string[] }; visitorActionIntent?: { primary: "primaryResponse"; secondary: "secondaryResponses"; weight: "primary-over-secondary"; legacy: "responses-unranked" }; interviewLearning?: "deferred-no-cross-prospect-reuse" };
  documents: { path: string; sha256: string; content?: string }[];
  capabilities: { id: string; status: typeof capabilityStatuses[number]; scope: "local-development" | "production" | "none" | "external"; summary: string; boundary: string; sources: string[] }[];
};
export function validateSolutionContext(value: SolutionContext) {
  object(value, ["version", "role", "capturedAt", "writingGuidance", "synthesisPolicy", "documents", "capabilities"]);
  if (value.version !== "review-solution/1" || value.role !== "internal-service-context" || !Number.isFinite(Date.parse(value.capturedAt))) throw Error("Invalid internal solution context");
  if (value.writingGuidance !== undefined) {
    const g = value.writingGuidance; object(g, ["version", "text", "sha256"]); text(g.text, 8000, true);
    if (!["review-writing/2", "review-writing/3", "review-writing/4", "review-writing/5"].includes(g.version) || createHash("sha256").update(g.text, "utf8").digest("hex") !== g.sha256) throw Error("Invalid writing guidance snapshot/hash");
  }
  if (value.synthesisPolicy !== undefined) {
    const p = value.synthesisPolicy; object(p, ["managedServiceResponsibilities", "customerResponsibilities", "responseOptions", "primaryActionBasis", "ongoingInput", "interviewLearning", "visitorActionIntent"]);
    for (const list of [p.managedServiceResponsibilities, p.customerResponsibilities]) { if (!Array.isArray(list) || !list.length || list.length > 10) throw Error("Invalid responsibility policy"); for (const item of list) text(item, 120); }
    if (p.ongoingInput !== undefined) {
      const i = p.ongoingInput; object(i, ["mode", "interface", "examples"]);
      if (i.mode !== "optional-after-onboarding" || i.interface !== "deferred" || !Array.isArray(i.examples) || !i.examples.length || i.examples.length > 10) throw Error("Invalid optional ongoing-input boundary");
      for (const example of i.examples) text(example, 120);
    }
    if (p.visitorActionIntent !== undefined) { const a = p.visitorActionIntent; object(a, ["primary", "secondary", "weight", "legacy"]); if (a.primary !== "primaryResponse" || a.secondary !== "secondaryResponses" || a.weight !== "primary-over-secondary" || a.legacy !== "responses-unranked") throw Error("Invalid explicit visitor-action policy"); }
    if (p.interviewLearning !== undefined && p.interviewLearning !== "deferred-no-cross-prospect-reuse") throw Error("Cross-prospect interview learning remains deferred");
    if (p.responseOptions !== "unranked-signals" || p.primaryActionBasis !== "full-business-context") throw Error("Response options cannot determine primary conversion intent");
  }
  if (!Array.isArray(value.documents) || value.documents.length < 2 || value.documents.length > 10 || !Array.isArray(value.capabilities) || !value.capabilities.length || value.capabilities.length > 16) throw Error("Solution context bounds");
  const documents = new Set<string>();
  for (const d of value.documents) {
    object(d, ["path", "sha256", "content"]);
    if (!/^docs\/[a-z0-9-]+\.md$/.test(d.path) || documents.has(d.path) || !/^[a-f0-9]{64}$/.test(d.sha256)) throw Error("Invalid solution document/hash");
    if (d.content !== undefined && (typeof d.content !== "string" || !d.content.trim() || d.content.length > 15000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(d.content) || createHash("sha256").update(d.content, "utf8").digest("hex") !== d.sha256)) throw Error("Invalid solution document/hash");
    if (d.path === "docs/miopages-service-description.md" && !d.content) throw Error("Service description snapshot required");
    documents.add(d.path);
  }
  if (!documents.has("docs/miopages-service-description.md")) throw Error("Working service description required");
  const ids = new Set<string>();
  for (const c of value.capabilities) {
    object(c, ["id", "status", "scope", "summary", "boundary", "sources"]); text(c.summary, 900); text(c.boundary, 1200);
    if (!/^[a-z][a-z0-9-]{0,49}$/.test(c.id) || ids.has(c.id) || !capabilityStatuses.includes(c.status) || !["local-development", "production", "none", "external"].includes(c.scope) || !Array.isArray(c.sources) || !c.sources.length || c.sources.some(s => !documents.has(s))) throw Error("Invalid capability status/source");
    if (c.status !== "AVAILABLE_PROVEN" && c.scope === "production") throw Error("Unproven production capability");
    ids.add(c.id);
  }
  if (JSON.stringify(value).length > 30000) throw Error("Solution snapshot too large");
}

// Passed to the provider as instructions, never rendered as prospect copy or evidence.
export const fullServiceGuidance = `Understand the prospect's business goals and needs first. Assess the current Web presence as evidence, not the whole problem domain. Use the internal service model and capability status as solution context, never as facts about the prospect. Recommend the highest-value improvements with rationale and a practical picture of better. Prioritize the first action and, where supported by the prospect's needs, continuing discovery, useful content, measurement, analysis and improvement. Let MioPages fit emerge last from those needs; do not map each problem to a feature or mention every capability. Our customer is the business using MioPages; their customers/prospects are the people it seeks to reach. Separate a valid business recommendation from a claim that MioPages can deliver it today. Deferred/unproven/external work may be conditional direction, never a current operational promise. Preserve useful existing infrastructure. Do not add marketing-email integrations absent need. No previous Review or recovered editorial revision prose may be synthesis input or a writing exemplar. Human operator approval is required; citations are inputs, not proof of interpretation.

Write for a nontechnical business owner making a decision, not an operator evaluating a system. Use ordinary business words and concrete people, situations, actions and outcomes instead of internal abstractions. Explain unfamiliar ideas through their effect on the business. Avoid technical shorthand, capability labels, QA/status language, contractual process language and repeated defensive qualifications. Do not lead a section with what has not been tested or proven; keep material uncertainty in the judgment and operator evidence without inventing facts or guarantees. Do not replace jargon with a fixed set of canned sentences.

For each major opportunity, make clear what should improve, why it matters to this business, and what a better experience would let a visitor understand or do. Give enough practical direction to help a decision, without finished page copy, a sitemap, wireframes, implementation specifications, exhaustive SEO work or a content calendar. Include a detail only if it materially changes the advice or helps the prospect understand the improvement; do not promote an incidental intake detail into a priority merely to use it. Explain the most important first step and why it comes first. Keep ongoing work only where the prospect's needs justify it; name what can be learned from questions, useful conversations and outcomes, and how that would guide subsequent changes. Do not imply that every category of ongoing service belongs in every Review.

Use situation, meaningful strengths, three highest-value opportunities, first action, justified ongoing improvement, then earned MioPages fit as the default flow. Fit should connect the advice to the burden a managed relationship could remove, while retaining the business owner's knowledge, judgment and approvals. Avoid a feature list, a sales flourish or unnecessary commercial qualification. Omit empty optional sections and unsupported concept announcements; schema status is not customer value. Aim for 650–800 body words, but prefer usefulness and remove repeated ideas rather than padding or cutting to a quota. Generate a fresh Review from the bound inputs; do not rewrite an earlier Review or edit the result after generation.

Be conversational, business appropriate, friendly and forthright. Respect the reader's business knowledge without assuming familiarity with Web complexity or patronizing them. Avoid enquiry/inquiry as a generic default; choose contacts, questions, requests, prospects, conversations or responses to fit the situation. Clarify whether you mean the business buying MioPages, its customers/prospects, or potential MioPages clients wherever ambiguity matters. Do not assume a prospect already coordinates several providers. Finish with the practical business benefit directly rather than explaining why the recommendation exists; no mandatory closing template.

Before assigning an action, ask who is responsible under the recommended service. Within supported scope, the managed service handles monitoring, analysis, measurement, optimization, content planning/improvement and Web-presence coordination. The customer supplies business knowledge, outcome context that cannot be independently known, factual confirmation, judgment and approvals. Do not turn managed-service work into customer homework or mechanically start every sentence with MioPages will. This division describes service intent, not proof of current operational delivery; capability boundaries still apply.

In foundational-intake/1, multi-select response options are unranked signals, not equal-priority goals or proof of a commercial model. Infer the primary desired next step from the full intake, offer, audience and business context; distinguish secondary acceptable actions and retain uncertainty when context is insufficient. A quote/estimate checkbox alone cannot justify a quote-driven recommendation, especially when business context contradicts it. Another business may legitimately prioritize a quote, appointment, call, purchase or visit. Free Review as primary, conversation as alternate/downstream, and standardized service rather than bespoke quoting are MioPages-specific only when the reviewed business context supports them; never impose these paths on another business.

After onboarding, core business knowledge has already been captured. Customers may optionally provide meaningful changes, additions, corrections, ideas, topic suggestions, outcome context and approvals; do not portray them as continuously feeding basic knowledge or operating the Web presence. The future input interface is deferred: do not promise a portal, chat, form or email-like UI. MioPages identifies opportunities and brings important proposed changes for approval. It may replace, simplify, consolidate or complement existing activity, not necessarily add another marketing system.

Use real audience questions, problems and decisions to guide useful content where supported, not arbitrary publishing quotas. Ongoing signals may include authorized search, visitor and conversion information, customer outcomes and business changes, not primarily interview answers. Only for MioPages itself, individual Free Reviews or conversations may manually suggest clearer explanations or topics. Do not assume other businesses have that mechanism. No cross-prospect aggregation, automatic theme mining, interview-derived corpus, automatic content from accumulated answers or hidden reuse of another prospect's answers is authorized. Systematic interview learning is deferred pending separate privacy, retention, permissions, aggregation and product design.

In foundational-intake/2, primaryResponse is explicit prospect-supplied visitor intent and carries materially greater interpretive weight than secondaryResponses. Resolve Something else through primaryResponseOther or secondaryResponseOther respectively. Secondary actions are acceptable alternatives, not equal-priority goals; never silently promote one over the explicit primary. Still assess the full business context and flag conflicts or uncertainty rather than treating one action as proof of a commercial model. Do not infer a primary from historical v1 responses arrays or their order. In both versions Q3 goals remain an unranked shortlist. No business-specific default primary action is supplied by the questionnaire.`;

export function snapshotWritingGuidance(): NonNullable<SolutionContext["writingGuidance"]> {
  return { version: "review-writing/5", text: fullServiceGuidance, sha256: createHash("sha256").update(fullServiceGuidance, "utf8").digest("hex") };
}

// Bounded lint for representative internal terms, not a semantic quality scorer.
export const internalCustomerTerms = /\b(?:discovery content|appropriate measurement|assess discovery and visitor behavior|focused public presence|supported scope|reviewed implementation|sampled routes|capabilit(?:y|ies)|operational readiness|provenance|operator QC|evidence packet)\b/i;
