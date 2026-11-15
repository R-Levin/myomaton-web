import { lstat, readFile, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fingerprint } from "../canonical/model";
import type { WorkflowContext } from "./presence-workflow";
import type { PresenceEvidence } from "./presence-workflow-artifacts";

// Source documents predate the editorial comparison. Marketing benchmarks and
// the curated comparison corpus do not enter this projection.
const documents = [
  ["miopages-c0-business-brief.md", "approved-brief", "service-direction", "2026-10-06",
    ["Business, customer and geography", "Launch and Ongoing offer", "Web Presence Review", "Proof and trust"]],
  ["c0-discovery-question-recovery-audit.md", "discovery-recovery", "historical-discovery", "2026-11-08",
    ["Distinguish two real interview events", "Original October 5 conversation prompts recoverable from previous conversations"]],
  ["miopages-c0-product-model.md", "current-c0-direction", "service-direction", null,
    ["Founder-led transition to the managed service", "Initial customer hypothesis", "Launch and Ongoing customer deliverable summary"]],
] as const;

// Exact IDs of substantive saved discussion, excluding credentials, destinations,
// UI acknowledgements, commercial commitments and contact information.
const allowedDraftKeys = new Set([
  "intake:sourceCorrection", "intake:workIncluded", "intake:workExcluded", "intake:reviewHandoff",
  "intake:conversationHandoff", "intake:proof", "intake:proofDetails", "intake:foundationGoal", "intake:sitePriority",
]);

export async function addC0WorkflowKnowledge(context: WorkflowContext, root = resolve("docs"), protectedRead = false): Promise<WorkflowContext> {
  const evidence = [...context.evidence];
  const hasActualReview = ["earlier-review-answer", "earlier-review-assessment"].every(kind => evidence.some(source => source.kind === kind));
  if (!hasActualReview || !evidence.some(source => source.kind === "owner-confirmed")) throw Error("Retained C0 discovery and separate Free Review required");
  for (const [file, prefix, kind, date, headings] of documents) {
    const name = join(root, file);
    if (protectedRead) {
      const metadata = await lstat(name);
      if (!metadata.isFile() || metadata.uid !== process.getuid?.() || (metadata.mode & 0o777) !== 0o600 ||
          await realpath(name) !== name) throw Error("Protected reference file refused");
    }
    const source = (await readFile(name, "utf8")).replace(/\r\n/g, "\n");
    if (prefix === "current-c0-direction") {
      const correction = source.match(/^\*\*Owner correction during the live C0[^\n]*(?:\n(?!\n)[^\n]+)*/mu)?.[0];
      if (!correction?.includes("Startups remain an important market")) throw Error("C0 audience correction refused");
      evidence.push({ id: "c0-market-correction", kind: "owner-confirmed", label: "November owner audience correction",
        reference: "docs/" + file + " · Initial customer hypothesis", date: "2026-11-09", content: correction });
    }
    const sections = [...source.matchAll(/^## ([^\n]+)\n([\s\S]*?)(?=^## |(?![\s\S]))/gm)];
    for (const [index, title] of headings.entries()) {
      const section = sections.filter(candidate => candidate[1] === title);
      if (section.length !== 1 || !section[0][2].trim()) throw Error("Expected the exact canonical C0 evidence section");
      evidence.push({ id: prefix + ":" + (index + 1), kind, label: title, reference: "docs/" + file + " · " + title,
        date, content: section[0][2].trim() });
    }
  }
  return { ...context, evidence,
    limitations: [...context.limitations, "Authentic prior discovery and retained material stand in for a complete progressive interview; the full adaptive interview did not occur."],
    conflicts: [...context.conflicts, "The recorded November market correction includes startups. The development rehearsal is unconfirmed; existing-site adoption is an explored path, and service operation and public destination claims require separate verification."],
  };
}

export function c0DisclosureManifest(context: WorkflowContext) {
  const sources = context.evidence.filter(source => source.kind !== "customer-unconfirmed" || allowedDraftKeys.has(source.id));
  return {
    contextDigest: fingerprint(context),
    approvedSourceCandidates: sources.map(({ id, kind, label, date, content, ...provenance }) => ({
      id, kind, label, date, bytes: Buffer.byteLength(content), digest: fingerprint({ id, kind, label, date, content, ...provenance } satisfies PresenceEvidence),
    })),
    excluded: context.evidence.filter(source => !sources.includes(source)).map(({ id, kind }) => ({ id, kind })),
  };
}
