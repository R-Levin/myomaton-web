import { fingerprint, object, text } from "../canonical/model";
import type { WorkflowRun } from "./presence-workflow";
import { readBlueprint, type PresenceEvidence, type WorkflowPage } from "./presence-workflow-artifacts";
import { checkStrategyScope, compilePageDecision, strategyBasis, type StrategyScope } from "./presence-decision-brief";

const uses = ["business-fact", "staffed-offer", "editorial", "analysis", "excluded"] as const;
type EvidenceUse = typeof uses[number];

export type MarketingAuthority = {
  contextDigest: string;
  sources: readonly { digest: string; use: EvidenceUse }[];
  // Brand and editorial materials must have been reviewed before binding their exact versions.
  brandDigest: string;
  brandBrief: string;
  qualityReviewerId: string;
  strategy?: StrategyScope;
  // Opt-in for a new pinned grant; historical projections and approvals stay exact.
  projectionVersion?: 2;
  earlyConceptReview?: true;
  sourceSelections?: readonly { digest: string; passages: readonly string[] }[];
  processingInstructions?: readonly { text: string; basis: "owner-direction" | "security-requirement" | "implementation-choice"; reference: string }[];
};

const publicUses: ReadonlySet<EvidenceUse> = new Set(["business-fact", "staffed-offer", "editorial"]);
const sha256 = /^[a-f0-9]{64}$/u;

export function validateMarketingAuthority(authority: MarketingAuthority, contextDigest: string, sources: readonly string[]) {
  if (authority.strategy) checkStrategyScope(authority.strategy);
  const declared = authority.sources.map(source => source.digest);
  if (authority.earlyConceptReview !== undefined && (authority.earlyConceptReview !== true || authority.projectionVersion !== 2)) throw Error("Source-aware authority required for early concept review");
  if (authority.projectionVersion !== undefined && authority.projectionVersion !== 2 ||
      authority.projectionVersion !== 2 && (authority.sourceSelections !== undefined || authority.processingInstructions !== undefined)) {
    throw Error("Source-aware authoring version required");
  }
  if (authority.projectionVersion === 2) {
    const selections = authority.sourceSelections;
    const publicSources = authority.sources.filter(source => publicUses.has(source.use));
    if (!Array.isArray(selections) || selections.length !== publicSources.length ||
        new Set(selections.map(row => row.digest)).size !== selections.length ||
        selections.some(row => !publicSources.some(source => source.digest === row.digest) || !Array.isArray(row.passages) || !row.passages.length ||
          new Set(row.passages).size !== row.passages.length || row.passages.some((passage: unknown) => typeof passage !== "string" || !passage.trim())) ||
        authority.processingInstructions !== undefined && (!Array.isArray(authority.processingInstructions) ||
          authority.processingInstructions.some(rule => !rule.text?.trim() || !rule.reference?.trim() ||
            !["owner-direction", "security-requirement", "implementation-choice"].includes(rule.basis)))) {
      throw Error("Exact source passages and separate processing instructions required");
    }
  }
  if (authority.contextDigest !== contextDigest || !sha256.test(authority.brandDigest) ||
      !authority.brandBrief.trim() || !authority.qualityReviewerId.trim() ||
      sources.length !== new Set(sources).size || declared.length !== sources.length ||
      new Set(declared).size !== declared.length ||
      !authority.sources.some(source => publicUses.has(source.use)) ||
      authority.sources.some(source => !uses.includes(source.use) || !sources.includes(source.digest))) {
    throw Error("Reviewed marketing authority does not match the workflow grant");
  }
}

export function marketingSources(authority: MarketingAuthority, evidence: readonly PresenceEvidence[]) {
  return authority.sources.map(({ digest, use }) => {
    const source = evidence.find(item => fingerprint(item) === digest);
    if (!source) throw Error("Reviewed marketing source changed");
    if (publicUses.has(use) && !["owner-confirmed", "service-direction"].includes(source.kind) ||
        (use === "business-fact" && source.kind !== "owner-confirmed")) {
      throw Error("Unconfirmed or market material cannot authorize visitor claims");
    }
    if (authority.projectionVersion === 2 && publicUses.has(use)) {
      const selected = authority.sourceSelections?.filter(row => row.digest === digest);
      if (selected?.length !== 1 || !selected[0].passages.length || selected[0].passages.some(passage => !source.content.includes(passage))) {
        throw Error("Business knowledge must retain exact recorded source passages");
      }
      return { source: { ...source, content: selected[0].passages.join("\n\n") }, use };
    }
    return { source, use };
  });
}

/** A trusted canonical projection can bind whole approved records automatically.
 * Mixed historical documents still need explicit exact passage selections.
 * This does not classify sources or upgrade their factual/authority status. */
export function bindCompleteAuthoringKnowledge(authority: Omit<MarketingAuthority, "projectionVersion" | "sourceSelections">, evidence: readonly PresenceEvidence[]): MarketingAuthority {
  const sources = marketingSources(authority, evidence);
  const complete: MarketingAuthority = { ...authority, projectionVersion: 2,
    sourceSelections: sources.filter(({ use }) => publicUses.has(use)).map(({ source }) => ({
      digest: fingerprint(source), passages: [source.content],
    })),
  };
  validateMarketingAuthority(complete, authority.contextDigest, evidence.map(fingerprint));
  return complete;
}

export function marketingCitationIds(run: WorkflowRun, authority: MarketingAuthority) {
  const sources = marketingSources(authority, run.input.evidence);
  const writesCopy = run.work.operation === "page";
  if (writesCopy && authority.projectionVersion === 2) return sources.filter(({ use }) => use === "business-fact" || use === "staffed-offer").map(({ source }) => source.id);
  if (writesCopy && authority.strategy) return strategyDecision(run, authority,
    run.input.blueprint?.pages.find(page => page.path === run.work.path)).claimIds;
  return [
    ...sources.filter(({ use }) => writesCopy ? publicUses.has(use) && !(authority.strategy && use === "editorial") : use !== "excluded").map(({ source }) => source.id),
    ...(writesCopy ? [] : (run.input.research ?? []).map(source => source.id)),
  ];
}

export function marketingProjection(run: WorkflowRun, authority: MarketingAuthority) {
  const { operation, path } = run.work;
  const { entry, evidence, research, corrections, report, direction, blueprint, pages, revisionRequest, replan, sourceRecovery } = run.input;
  const sources = marketingSources(authority, evidence);
  const expose = ({ id, kind, label, date, content }: PresenceEvidence) => ({ id, kind, label, date, content });
  const design = { digest: authority.brandDigest, brief: authority.brandBrief };
  const claims = sources.filter(({ use }) => use === "business-fact" || use === "staffed-offer");
  const approved = (authority.strategy ? claims : sources.filter(({ use }) => publicUses.has(use)))
    .map(({ source, use }) => ({ ...expose(source), use }));
  const analysis = sources.filter(({ use }) => use === "analysis").map(({ source }) => expose(source));
  if (authority.projectionVersion === 2) {
    validateMarketingAuthority(authority, fingerprint(run.context), run.context.evidence.map(fingerprint));
    if (fingerprint(run.context.evidence) !== fingerprint(evidence)) throw Error("Source-aware knowledge scope changed");
    if (authority.strategy && operation === "page" && blueprint?.strategyBasis !== strategyBasis(run.context, run.input)) {
      throw Error("Page brief is stale for the current report, Direction or market evidence");
    }
    const previous = revisionRequest?.priorPages.find(page => page.path === path);
    const readable = new Set([...sources.filter(({ use }) => use !== "excluded").map(({ source }) => source.id), ...(research ?? []).map(source => source.id)]);
    return { entry, design,
      ...(sourceRecovery && { repairedSourceContext: sourceRecovery }),
      businessKnowledge: claims.map(({ source, use }) => ({ ...expose(source), use })),
      editorialReferences: sources.filter(({ use }) => use === "editorial").map(({ source }) => expose(source)),
      contextualEvidence: analysis.filter(source => source.kind !== "customer-unconfirmed"),
      customerAssertions: analysis.filter(source => source.kind === "customer-unconfirmed"),
      research: research?.map(expose), report, direction, blueprint,
      corrections: corrections.filter(({ finding }) => finding.sourceIds.every(id => readable.has(id))).map(({ finding, text }) => ({ finding, text, status: "correction-to-review" })),
      ...(operation === "page" && { pagePath: path, ...(path && authority.strategy && { decisionBrief: strategyDecision(run, authority, blueprint?.pages.find(page => page.path === path)) }),
        ...(previous && { previous, concerns: revisionRequest?.audit.concerns.filter(concern => concern.path === path) }),
        ...(!path && revisionRequest?.batch === "pending" && { pages: revisionRequest.priorPages, concerns: revisionRequest.audit.concerns }) }),
      ...(operation === "editorial" && { pages, ...(run.input.reviewStage && { reviewStage: run.input.reviewStage }) }),
      ...(replan && !sourceRecovery && { independentReviewCriteriaToCorrect: replan.concerns,
        ...(replan.priorRejectedPages && { priorRejectedPages: replan.priorRejectedPages }),
        ...(replan.conceptCritique && { priorCoreConceptCritique: replan.conceptCritique }) }),
      interpretation: "Business knowledge preserves its recorded factual or staffed-offer status. Customer assertions, research, reports, Direction and historical editorial references remain distinct evidence for reasoning and proposed interpretation. They do not become verified customer facts. Page claim IDs in the plan identify relevance, not a ceiling on other already authorized knowledge from this same case. Processing instructions are supplied separately and are not customer knowledge.",
    };
  }
  if (operation === "page") {
    const prior = revisionRequest?.priorPages.find(page => page.path === path);
    const needBatch = !path && revisionRequest?.batch === "pending";
    if (authority.strategy && blueprint?.strategyBasis !== strategyBasis(run.context, run.input)) {
      throw Error("Page brief is stale for the current report, Direction or market evidence");
    }
    const scoped = authority.strategy && strategyDecision(run, authority, blueprint?.pages.find(item => item.path === path));
    // The case-bound strategy compiler intentionally omits raw narrative reports and raw peer pages.
    return { entry, approved: scoped ? approved.filter(item => scoped.claimIds.includes(item.id)) : approved,
      design, pagePath: path, ...(scoped && { decisionBrief: scoped }), pagePlan: blueprint?.pages.map(({ path, label, purpose }) => ({ path, label, purpose })),
      ...(needBatch ? { pages: revisionRequest.priorPages, concerns: revisionRequest.audit.concerns } :
        prior ? { previous: prior, concerns: revisionRequest?.audit.concerns.filter(item => item.path === path) } : {}) };
  }
  const readable = new Set([...approved, ...analysis, ...(research ?? [])].map(source => source.id));
  const approvedCorrections = corrections.filter(({ finding }) => finding.sourceIds.every(id => readable.has(id)))
    .map(({ text, finding }) => ({ text, finding, status: "correction-to-review" }));
  const base = { entry, approved, analysis, research: research?.map(expose), corrections: approvedCorrections, design,
    ...(authority.strategy && { strategy: authority.strategy }),
    ...(replan && { independentReviewCriteriaToCorrect: replan.concerns }) };
  switch (operation) {
    case "research":
    case "report": return base;
    case "direction": return { ...base, report };
    case "blueprint": return { ...base, report, direction };
    case "editorial": return { ...base, report, direction, blueprint, pages };
  }
}

function strategyDecision(run: WorkflowRun, authority: MarketingAuthority, page: ReturnType<typeof readBlueprint>["pages"][number] | undefined) {
  if (!authority.strategy || !page?.decisionBrief) throw Error("Provenance-linked Page brief required");
  const sources = marketingSources(authority, run.input.evidence);
  const claims = sources.filter(item => item.use === "business-fact" || item.use === "staffed-offer").map(item => item.source);
  const analysis = sources.filter(item => item.use === "analysis").map(item => item.source);
  for (const id of authority.strategy.peerIds) {
    const source = analysis.find(item => item.id === id);
    if (source?.kind !== "public-research" || !source.date || !source.rawDigest || !sha256.test(source.rawDigest)) {
      throw Error("Reviewed peer observation missing");
    }
  }
  const influenceSources = authority.projectionVersion === 2
    ? sources.filter(item => item.use !== "excluded").map(item => item.source) : analysis;
  const brief = compilePageDecision(run, page.decisionBrief, page.path, authority.strategy, claims,
    [...influenceSources, ...run.input.research ?? []], authority.contextDigest, authority.projectionVersion === 2);
  if (exposesInternalCopy(brief, run.input.evidence, authority, true)) throw Error("Excluded content in Page decision");
  return brief;
}

export function validateStrategyBlueprint(output: unknown, run: WorkflowRun, authority: MarketingAuthority,
  destinations?: Partial<Record<"request-review" | "start-onboarding", string>>) {
  const parsed = readBlueprint(output, marketingCitationIds(run, authority), true, true);
  for (const page of parsed.pages) strategyDecision(run, authority, page);
  const journeys = authority.strategy?.entryJourneys;
  if (journeys && !authority.strategy?.change) {
    const review = destinations?.["request-review"];
    const direct = destinations?.["start-onboarding"];
    const claims = (path: string | undefined) => parsed.pages.find(page => page.path === path)?.decisionBrief?.claimIds;
    if (!review || !direct || review === direct || review === "/" || direct === "/" ||
        !claims(review)?.includes(journeys.reviewClaimId) || !claims(direct)?.includes(journeys.directClaimId) ||
        ![journeys.reviewClaimId, journeys.directClaimId].every(id => claims("/")?.includes(id))) {
      throw Error("Distinct supported buyer routes required");
    }
  }
}

function normalized(value: string) {
  return value.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.join(" ") ?? "";
}

/** Exact internal excerpts are deterministic failures. Independent review still judges paraphrase,
 * sales effectiveness, claim support and suitability of approved material. */
export function exposesInternalCopy(output: unknown, evidence: readonly PresenceEvidence[], authority: MarketingAuthority, allText = false) {
  const excluded = marketingSources(authority, evidence).filter(({ use }) => use === "excluded").map(({ source }) => source.content);
  const policy = authority.projectionVersion === 2 ? (authority.processingInstructions ?? []).map(rule => rule.text) : [];
  const forbidden = [...excluded, ...policy]
    .flatMap(content => content.split(/[.!?\r\n]+/u).map(normalized))
    .filter(phrase => phrase.split(" ").length >= 6);
  function search(value: unknown, field = ""): boolean {
    if (typeof value === "string") {
      if (!allText && !["title", "heading", "body", "searchTitle", "searchDescription", "label", "purpose", "items"].includes(field)) return false;
      const searchText = " " + normalized(value) + " ";
      return forbidden.some(phrase => searchText.includes(" " + phrase + " "));
    }
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some(item => search(item, field));
    return Object.entries(value).some(([key, item]) => search(item, key));
  }
  return search(output);
}

// These are deterministic refusals for an unpriced development offer. Claims
// still need source review, including wording this check cannot recognize.
function anyVisitorCopy(output: unknown, check: (copy: string) => boolean) {
  const fields = new Set(["heading", "title", "body", "searchTitle", "searchDescription", "label", "items"]);
  function walk(value: unknown, field = ""): boolean {
    if (typeof value === "string") return fields.has(field) && check(value);
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some(item => walk(item, field));
    return Object.entries(value).some(([key, child]) => walk(child, key));
  }
  return walk(output);
}

export function unsupportedCommercialCopy(output: unknown) {
  const explicitClaim = /(?:[$€£]\s*\d|\b\d[\d,.]*\s*(?:USD|dollars)\b|\b(?:guaranteed|guarantee)\b[^.!?]{0,30}\b(?:rankings|sales|profits|revenue|leads|traffic|results)\b|\b\d(?:\.\d+)?\s*(?:\/\s*5|stars)\b|\b(?:customers?|clients?)\s+(?:say|said|reported)\b)/iu;
  return anyVisitorCopy(output, copy => explicitClaim.test(copy));
}

export function repeatsPeerObservation(output: unknown, peers: readonly PresenceEvidence[]) {
  const phraseSize = 12;
  function phrases(copy: string) {
    const words = normalized(copy).split(" ");
    return words.slice(0, Math.max(0, words.length - phraseSize + 1))
      .map((_, index) => words.slice(index, index + phraseSize).join(" "));
  }
  const sourcePhrases = new Set(peers.flatMap(peer => phrases(peer.content)));
  return anyVisitorCopy(output, copy => phrases(copy).some(phrase => sourcePhrases.has(phrase)));
}

export const qualityCriteria = [
  "offer-and-value", "buyer-fit-and-objections", "commercial-copy", "supported-service-and-actions",
  "internal-content-exclusion", "brand-and-design", "media-in-context", "site-architecture-and-search",
  "desktop-mobile-and-accessibility", "proof-permission-and-data",
] as const;
export type QualityCriterion = typeof qualityCriteria[number];

export const commercialRevisionGuidance: Readonly<Record<QualityCriterion, string>> = {
  "offer-and-value": "Rebuild the opening to name the managed offer, its buyer, the concrete outcome and a substantiated reason to choose it.",
  "buyer-fit-and-objections": "Address a material audience objection with supported evidence and help that buyer decide whether the offer fits.",
  "commercial-copy": "Rewrite the sections around a real buyer decision and concrete benefit. Remove generic service language.",
  "supported-service-and-actions": "Explain the supported staffed offer, put the two relevant entry choices where visitors can see them, and use exact authorized routes.",
  "internal-content-exclusion": "Remove internal process, development, diagnostic and unconfirmed information throughout the public copy.",
  "brand-and-design": "Rework the visual hierarchy and semantic section choices around the approved brand and what visitors need first.",
  "media-in-context": "Specify an image with a distinct communication job and a mobile-readable placement, or remove the filler placement.",
  "site-architecture-and-search": "Give the page one distinct buyer purpose, remove repetition, and support it with clear contextual navigation.",
  "desktop-mobile-and-accessibility": "Prioritize concise content, clear headings, visible entry choices and accessible descriptions on narrow and wide screens.",
  "proof-permission-and-data": "Build relevant proof around grounded contribution and rights. Remove unsupported results, promises, customer details and unusable destinations.",
};

export type QualityReview = {
  target: string;
  desktopEvidence: string;
  mobileEvidence: string;
  findings: readonly { criterion: QualityCriterion; status: "pass" | "revise"; observation: string }[];
};

export function readQualityReview(input: unknown, expected: string): QualityReview {
  const review = object(input, ["target", "desktopEvidence", "mobileEvidence", "findings"]);
  if (review.target !== expected || typeof review.desktopEvidence !== "string" || typeof review.mobileEvidence !== "string" ||
      !sha256.test(review.desktopEvidence) || !sha256.test(review.mobileEvidence) ||
      review.desktopEvidence === review.mobileEvidence || !Array.isArray(review.findings) ||
      review.findings.length !== qualityCriteria.length) throw Error("Exact independent desktop and mobile quality findings required");
  const findings = review.findings.map((item): QualityReview["findings"][number] => {
    const finding = object(item, ["criterion", "status", "observation"]);
    const criterion = qualityCriteria.find(criterion => criterion === finding.criterion);
    if (!criterion || (finding.status !== "pass" && finding.status !== "revise")) throw Error("Invalid independent quality finding");
    return { criterion, status: finding.status, observation: text(finding.observation, 3500, true) };
  });
  if (new Set(findings.map(finding => finding.criterion)).size !== qualityCriteria.length) throw Error("Duplicate independent quality finding");
  return { target: expected, desktopEvidence: review.desktopEvidence, mobileEvidence: review.mobileEvidence, findings };
}

export function verifyCommercialJourneys(pages: readonly WorkflowPage[], navigation: readonly string[],
  required: Partial<Record<"request-review" | "start-onboarding", string>>) {
  const home = pages.find(page => page.path === "/");
  if (!home) throw Error("Commercial Home unavailable");
  for (const [kind, destination] of Object.entries(required)) {
    if (!home.actions.some(action => action.kind === kind && action.destination === destination &&
        action.sectionIndex !== undefined && home.sections[action.sectionIndex]?.role === "hero") ||
        !pages.some(page => page.path === destination)) throw Error("Home must present each authorized visitor journey");
  }
  const reached = new Set(["/", ...navigation]);
  const queue = [...reached];
  const byPath = new Map(pages.map(page => [page.path, page]));
  for (const path of queue) {
    const page = byPath.get(path);
    if (!page) throw Error("Commercial navigation target missing");
    for (const route of [...page.internalLinks, ...page.actions.flatMap(action =>
      action.destination && action.kind !== "existing-account" && (action.kind === "navigate" || page.composition) ? [action.destination] : [])]) {
      if (!reached.has(route) && byPath.has(route)) {
        reached.add(route);
        queue.push(route);
      }
    }
  }
  if (pages.some(page => !reached.has(page.path))) throw Error("Commercial site contains unreachable pages");
}

export function qualityPass(review: QualityReview, expected: string) {
  return readQualityReview(review, expected).findings.every(finding => finding.status === "pass");
}
