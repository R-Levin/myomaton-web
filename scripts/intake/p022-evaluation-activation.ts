import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { fingerprint } from "../../lib/platform/canonical/model";
import { p022Candidate, p022CandidateInputs, p022ProposedMeter, p022RunProposalSha256, p022SourcePackSha256, readP022SourcePack } from "../../lib/platform/intake/c0-p022-source-pack";
import { privateWorkflowBytes, privateWorkflowFile, verifyDirectory } from "../../lib/platform/intake/protected-presence-workflow";
import type { PresenceWorkflowGrant } from "../../lib/platform/intake/presence-workflow-provider";
import type { WorkflowContext, WorkflowRun } from "../../lib/platform/intake/presence-workflow";
import previous from "../../docs/c0-commercial-authorization-proposal.json";
import { focusMioPagesPreview } from "../customer-previews/miopages-focus";
import { draftBrand } from "../../lib/platform/wordpress-delivery/draft-brand";

const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
type PeerRecord = ReturnType<typeof readP022SourcePack>["peers"][number];
type Activation = { approvalComment: number; proposal: string; sourcePack: string; artifact: string; observations: string; startsAt: number };

// Exact P0-22 repair of the already paid response. Attach independently reviewed
// report and Direction references without rewriting its Page jobs or navigation.
export function repairP022Blueprint(output: unknown, run: WorkflowRun, bytes: Buffer) {
  if (run.context.intakeId !== p022Candidate.intakeId ||
      run.work.inputDigest !== "a7c6e79c71c0d245cb0212e2431d092657f3e0193c8526aadb723ad775f081ff" ||
      hash(bytes) !== "4aa01eb7ccc0a7ec833f61395ca14e42cc95e679a88f230a8b04ffaff44d04f7") return output;
  const bindings = {
    "/": { findingIds: ["f1", "f2", "f5", "f6", "f10"], directionSteps: [0, 3] },
    "/service": { findingIds: ["f1", "f3", "f4", "f8"], directionSteps: [1, 2, 4] },
    "/free-review": { findingIds: ["f5", "f7", "f9"], directionSteps: [3, 4] },
    "/direct-start": { findingIds: ["f4", "f5", "f8"], directionSteps: [2, 3] },
    "/articles": { findingIds: ["f2", "f8", "f9"], directionSteps: [0, 3] },
  };
  const blueprint = structuredClone(output) as { pages: { path: keyof typeof bindings; decisionBrief: {
    findingIds: string[]; directionSteps: number[]; influences: { use: string; sourceIds: string[] }[];
  } }[] };
  if (blueprint.pages.length !== Object.keys(bindings).length || blueprint.pages.some(page => !Object.hasOwn(bindings, page.path))) {
    throw Error("Retained P0-22 Blueprint Page set differs");
  }
  for (const page of blueprint.pages) {
    Object.assign(page.decisionBrief, bindings[page.path]);
    if (page.path === "/service") {
      // Its unchanged SiteCare observation already says to make both sets of
      // responsibilities visible early. Classify that placement as composition.
      const placement = page.decisionBrief.influences.find(item =>
        item.use === "terminology" && item.sourceIds.length === 1 && item.sourceIds[0] === "peer-sitecare-rendered");
      if (!placement) throw Error("Retained Service composition observation differs");
      placement.use = "composition";
    }
  }
  return blueprint;
}

export async function verifiedP022Runtime(parent: string, reviewerId: string, reviewerExpiry: number, allowExpired: boolean) {
  const root = join(parent, "p0-22-c0-runtime");
  await verifyDirectory(root);
  const [approval, sourcePack, starting, observations, logo] = await Promise.all([
    privateWorkflowFile<Activation>(join(root, "activation.json"), root),
    readFile("docs/c0-generation-p0-22-sources.json"),
    readFile("docs/c0-generation-p0-22-run-proposal.json"),
    privateWorkflowBytes(join(root, "peer-observations.json"), root),
    readFile("brand/miopages/MioPagesDV.png"),
  ]);
  const meter = p022ProposedMeter(starting);
  const source = readP022SourcePack(sourcePack);
  const prefixDirectory = join(parent, "presence-evaluation", previous.destination.intakeId);
  const previousLedger = await privateWorkflowBytes(join(prefixDirectory, "usage", "onboarding-usage.json"), prefixDirectory);
  const artifact = join(root, "worker.cjs");
  const entry = await realpath(process.argv[1] ?? "");
  if (entry !== artifact) {
    const continuation = await privateWorkflowFile<{ original: string; worker: string }>(join(root, "continuation.json"), root);
    if (entry !== join(root, "worker-next.cjs") || continuation.original !== approval.artifact || continuation.worker !== hash(await readFile(entry))) {
      throw Error("P0-22 executable refused");
    }
  }
  const now = Date.now();
  const expiresAt = Math.min(approval.startsAt + 72 * 3600_000, reviewerExpiry);
  if (approval.approvalComment !== 6983036002 || approval.artifact !== hash(await readFile(artifact)) ||
      approval.proposal !== p022RunProposalSha256 || approval.sourcePack !== p022SourcePackSha256 ||
      approval.observations !== hash(observations) || hash(previousLedger) !== meter.startingLedger ||
      hash(logo) !== source.brandLogoSha256 || !Number.isSafeInteger(approval.startsAt) || approval.startsAt > now ||
      expiresAt <= approval.startsAt || (!allowExpired && expiresAt <= now)) throw Error("Exact P0-22 activation refused");
  const peers = JSON.parse(observations.toString("utf8")) as PeerRecord[];
  if (!Array.isArray(peers) || peers.length !== 2) throw Error("Both reviewed peer observations required");
  const brand = draftBrand({ scope: p022Candidate.scope, visualDirection: focusMioPagesPreview.siteConfiguration.visualDirection,
    design: focusMioPagesPreview.designConfiguration, logo: {
      assetId: "cd7d9a9f-76a1-4615-957a-0ebaa8e6427d", usageId: "bf7fbc72-50ef-461f-974b-f4dbcc7a62df",
      sha256: source.brandLogoSha256, alt: "MioPages",
    } });
  return {
    item: { ...p022Candidate, entry: "DIRECT_START" as const },
    primary: meter.stages!.research.rates,
    previousLedger,
    reportHold: undefined,
    fingerprint: fingerprint({ approval, expiresAt, scope: p022Candidate.scope, brand: brand.digest, reviewerId }),
    async compile(original: WorkflowContext) {
      const exclusions = original.evidence.filter(item => previous.evidence.originalExclusions.includes(item.id));
      if (exclusions.length !== previous.evidence.originalExclusions.length || exclusions.some(item => item.kind !== "customer-unconfirmed")) {
        throw Error("Original exclusion evidence refused");
      }
      const { context, authority } = p022CandidateInputs(sourcePack, { brandDigest: brand.digest, qualityReviewerId: reviewerId }, exclusions, peers);
      const grant: PresenceWorkflowGrant = {
        contextDigest: fingerprint(context), marketingAuthority: authority, approvedSources: context.evidence.map(fingerprint),
        approvedCorrections: [], approvedRevisionFeedback: [], researchSources: previous.research.roots,
        researchResponseBytes: previous.research.responseBytes, siteComposition: "managed-v1",
        previewActionDestinations: previous.cycle.previewDestinations, maxOutputTokens: 20_000, maxRetries: 0, maxEditorialRevisions: 2,
        startsAt: approval.startsAt, expiresAt, ledger: meter,
        images: { model: previous.image.model, briefs: previous.image.briefs.filter(item => ["journey-diagram", "illustrative-review"].includes(item.id)) },
      };
      return { context, grant, brand };
    },
  };
}
