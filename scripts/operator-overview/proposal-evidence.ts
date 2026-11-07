import { readFile } from "node:fs/promises";
import { fingerprint } from "../../lib/platform/canonical/model";
import { binding, revisionDigest, type Event, type ProposalState, type Revision } from "../../lib/platform/content-editing/proposal";
import { replayProposal } from "../../lib/platform/content-editing/proposal-history";
import { proposalPreview } from "../../lib/platform/content-editing/proposal-preview";
import { accountPath } from "./model";

const sources = {
  durable: { directory: "runtime-content/site-proposal-durable-proof", digest: "9206fad37900d172dad16303936cd7b779f080fedfcf266b44368d5a41577347" },
  retained: { directory: "tests/fixtures/approved-site-proposal", digest: "568808df1fcaf51d88cc722fb92006c168d9af701daaef4f0fd6b1b1d597a0b1" },
};

type EvidenceRevision = { revision: Revision; approval?: Event; preview?: { html: string; digest: string } };
export type ProposalEvidence = { source: "durable" | "retained"; revisions: EvidenceRevision[]; latest: Revision["binding"] };

export const evidencePath = (evidence: ProposalEvidence) => accountPath(evidence.latest.scope.webPresenceId);
export function exactPreviewPath(evidence: ProposalEvidence, revision: number) {
  return `${evidencePath(evidence)}/proposals/${evidence.latest.proposalId}/revisions/${revision}/preview`;
}

export function verifyProposalEvidence(source: keyof typeof sources, inspection: unknown, archivedHtml: string): ProposalEvidence {
  // This unauthenticated console may serve only the two exact, known synthetic
  // artifacts. The pin precedes rendering or processing any stored content.
  if (fingerprint(inspection) !== sources[source].digest) throw Error("Unrecognized synthetic proposal evidence");
  const result = (revision: Revision, digest?: string, approval?: Event): EvidenceRevision => {
    if (!digest) return { revision, approval };
    const html = proposalPreview(revision);
    if (fingerprint(html) !== digest) throw Error("Proposal preview digest mismatch");
    return { revision, approval, preview: { html, digest } };
  };

  let revisions: EvidenceRevision[];
  if (source === "durable") {
    const saved = (inspection as { state: ProposalState }).state;
    const replay = replayProposal(saved.id, saved.scope, saved.events);
    revisions = replay.revisions.map(revision => {
      const approval = replay.events.find(event => event.approval?.binding.revision === revision.binding.revision);
      const preview = approval ? replay.events.find(event => event.hash === approval.approval?.previewEvent) :
        replay.events.findLast(event => event.preview?.binding.revision === revision.binding.revision);
      return result(revision, preview?.preview?.digest, approval);
    });
  } else {
    const saved = inspection as { revision: Revision; previewDigest: string; approvalEvent: Event };
    const { binding: expected, ...revision } = saved.revision;
    const { digest, ...identity } = binding(expected);
    const { hash, ...event } = saved.approvalEvent;
    if (digest !== revisionDigest(revision, identity) || identity.baseFingerprint !== fingerprint(revision.base) ||
        event.action !== "approve" || fingerprint(event) !== hash || fingerprint(event.approval?.binding) !== fingerprint(expected) ||
        event.approval?.previewDigest !== saved.previewDigest) throw Error("Invalid retained proposal approval evidence");
    revisions = [result(saved.revision, saved.previewDigest, saved.approvalEvent)];
  }
  const latest = revisions.at(-1);
  if (!latest || latest.preview?.html !== archivedHtml) throw Error("Archived exact proposal preview mismatch");
  return { source, revisions, latest: latest.revision.binding };
}

export async function loadProposalEvidence(): Promise<ProposalEvidence | null> {
  for (const source of ["durable", "retained"] as const) {
    const { directory } = sources[source];
    try {
      const [inspection, html] = await Promise.all([readFile(`${directory}/inspection.json`, "utf8"), readFile(`${directory}/candidate.html`, "utf8")]);
      return verifyProposalEvidence(source, JSON.parse(inspection), html);
    } catch { /* Withhold unavailable or invalid evidence and try the other known synthetic source. */ }
  }
  return null;
}
