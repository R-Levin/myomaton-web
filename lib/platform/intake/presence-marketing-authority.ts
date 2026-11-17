import { fingerprint, object, text } from "../canonical/model";
import type { WorkflowRun } from "./presence-workflow";
import type { PresenceEvidence } from "./presence-workflow-artifacts";

const uses = ["business-fact", "staffed-offer", "editorial", "analysis", "excluded"] as const;
type EvidenceUse = typeof uses[number];

export type MarketingAuthority = {
  contextDigest: string;
  sources: readonly { digest: string; use: EvidenceUse }[];
  // Brand and editorial materials must have been reviewed before binding their exact versions.
  brandDigest: string;
  brandBrief: string;
  qualityReviewerId: string;
};

const publicUses: ReadonlySet<EvidenceUse> = new Set(["business-fact", "staffed-offer", "editorial"]);
const sha256 = /^[a-f0-9]{64}$/u;

export function validateMarketingAuthority(authority: MarketingAuthority, contextDigest: string, sources: readonly string[]) {
  const declared = authority.sources.map(source => source.digest);
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
    return { source, use };
  });
}

export function marketingCitationIds(run: WorkflowRun, authority: MarketingAuthority) {
  const sources = marketingSources(authority, run.input.evidence);
  const writesCopy = run.work.operation === "page";
  return [
    ...sources.filter(({ use }) => writesCopy ? publicUses.has(use) : use !== "excluded").map(({ source }) => source.id),
    ...(writesCopy ? [] : (run.input.research ?? []).map(source => source.id)),
  ];
}

export function marketingProjection(run: WorkflowRun, authority: MarketingAuthority) {
  const { operation, path } = run.work;
  const { entry, evidence, research, corrections, report, direction, blueprint, pages, revisionRequest } = run.input;
  const sources = marketingSources(authority, evidence);
  const expose = ({ id, kind, label, date, content }: PresenceEvidence) => ({ id, kind, label, date, content });
  const design = { digest: authority.brandDigest, brief: authority.brandBrief };
  const approved = sources.filter(({ use }) => publicUses.has(use)).map(({ source, use }) => ({ ...expose(source), use }));
  const analysis = sources.filter(({ use }) => use === "analysis").map(({ source }) => expose(source));
  if (operation === "page") {
    const prior = revisionRequest?.priorPages.find(page => page.path === path);
    const needBatch = !path && revisionRequest?.batch === "pending";
    // Carry forward information architecture, not free-form report, raw research, private notes or derived strategy prose.
    return { entry, approved, design, pagePath: path, pagePlan: blueprint?.pages.map(({ path, label, purpose }) => ({ path, label, purpose })),
      ...(needBatch ? { pages: revisionRequest.priorPages, concerns: revisionRequest.audit.concerns } :
        prior ? { previous: prior, concerns: revisionRequest?.audit.concerns.filter(item => item.path === path) } : {}) };
  }
  const readable = new Set([...approved, ...analysis, ...(research ?? [])].map(source => source.id));
  const approvedCorrections = corrections.filter(({ finding }) => finding.sourceIds.every(id => readable.has(id)))
    .map(({ text, finding }) => ({ text, finding, status: "correction-to-review" }));
  const base = { entry, approved, analysis, research: research?.map(expose), corrections: approvedCorrections, design };
  switch (operation) {
    case "research":
    case "report": return base;
    case "direction": return { ...base, report };
    case "blueprint": return { ...base, report, direction };
    case "editorial": return { ...base, report, direction, blueprint, pages };
  }
}

function normalized(value: string) {
  return value.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.join(" ") ?? "";
}

/** Exact internal excerpts are deterministic failures. Independent review still judges paraphrase,
 * sales effectiveness, claim support and suitability of approved material. */
export function exposesInternalCopy(output: unknown, evidence: readonly PresenceEvidence[], authority: MarketingAuthority) {
  const forbidden = marketingSources(authority, evidence).filter(({ use }) => use === "excluded")
    .flatMap(({ source }) => source.content.split(/[.!?\r\n]+/u).map(normalized))
    .filter(phrase => phrase.split(" ").length >= 6);
  function search(value: unknown, field = ""): boolean {
    if (typeof value === "string") {
      if (!["title", "heading", "body", "searchTitle", "searchDescription", "label", "purpose"].includes(field)) return false;
      const searchText = " " + normalized(value) + " ";
      return forbidden.some(phrase => searchText.includes(" " + phrase + " "));
    }
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some(item => search(item, field));
    return Object.entries(value).some(([key, item]) => search(item, key));
  }
  return search(output);
}

export const qualityCriteria = [
  "offer-and-value", "buyer-fit-and-objections", "commercial-copy", "supported-service-and-actions",
  "internal-content-exclusion", "brand-and-design", "media-in-context", "site-architecture-and-search",
  "desktop-mobile-and-accessibility", "proof-permission-and-data",
] as const;
type Criterion = typeof qualityCriteria[number];

export type QualityReview = {
  target: string;
  desktopEvidence: string;
  mobileEvidence: string;
  findings: readonly { criterion: Criterion; status: "pass" | "revise"; observation: string }[];
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

export function qualityPass(review: QualityReview, expected: string) {
  return readQualityReview(review, expected).findings.every(finding => finding.status === "pass");
}
