import { fingerprint } from "../canonical/model";

export type DraftReadback = {
  installationId: string;
  siteProposalId: string;
  appliedDigest: string;
  revision: number;
  posts: readonly { id: number; path: string; contentSha256: string }[];
};

export type CycleObservation = {
  id: string;
  installationId: string;
  siteProposalId: string;
  draftDigest: string;
  pageId: number;
  at: string;
  source: "synthetic-development";
  kind: "preview-rendered" | "navigation-target-verified" | "inquiry-sample";
  topic?: "existing-website-handoff";
};

export function cycleSnapshot(draft: DraftReadback, observations: readonly CycleObservation[]) {
  const accepted = new Map<string, CycleObservation>();
  for (const event of observations) {
    if (event.installationId !== draft.installationId || event.siteProposalId !== draft.siteProposalId ||
        event.draftDigest !== draft.appliedDigest || !draft.posts.some(post => post.id === event.pageId) ||
        event.source !== "synthetic-development" || !/^[a-z0-9-]{1,80}$/u.test(event.id) ||
        !Number.isFinite(Date.parse(event.at)) ||
        !(["preview-rendered", "navigation-target-verified", "inquiry-sample"] as const).includes(event.kind) ||
        (event.kind === "inquiry-sample" ? event.topic !== "existing-website-handoff" : event.topic !== undefined)) {
      throw Error("Observation does not match the applied development draft");
    }
    const prior = accepted.get(event.id);
    if (prior && fingerprint(prior) !== fingerprint(event)) throw Error("Conflicting observation retry");
    accepted.set(event.id, event);
  }
  const entries = [...accepted.values()];
  const count = (kind: CycleObservation["kind"]) => entries.filter(event => event.kind === kind).length;
  const evidence = entries.filter(event => event.kind === "inquiry-sample").map(event => event.id);
  return {
    revision: draft.revision, draftDigest: draft.appliedDigest,
    observations: entries, previewChecks: count("preview-rendered"),
    navigationChecks: count("navigation-target-verified"), syntheticInquirySamples: evidence.length,
    visitorActivity: "not collected", acceptedInquiries: "not exercised",
    notification: "not attempted", qualifiedLeads: "unknown", customerOutcomes: "unknown",
    recommendation: evidence.length ? {
      evidence, proposal: "Explain what someone with an existing website should bring to the first conversation.",
      expectedBenefit: "Reduce uncertainty before an inquiry.",
      uncertainty: "A synthetic question cannot establish demand, conversion or business impact.",
    } : null,
  };
}


// Exact restored baseline verified by the existing native draft receipt
// journal. The protected inquiry grant covers this revision only.
export const protectedDevelopmentDraft = {
  installationId: "d84ebc69-46d5-4c64-adc6-ac7b87468f89",
  siteProposalId: "1e28f792-624d-4141-96db-45c4ba05e17d",
  appliedDigest: "85786f251ed5b93e42d9ae2b8c7247d85d99280aa9b1bc5932a1321330a043db",
  revision: 3,
} as const;
