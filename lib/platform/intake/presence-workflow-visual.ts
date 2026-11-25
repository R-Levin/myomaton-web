import { workDigest } from "../work-products/pages";
import { createHash } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, sep } from "node:path";
import { prepareManagedBytes } from "../assets/ingestion";
import { provisionManagedObject, readManagedObject } from "../assets/local-storage";
import type { ImageProvider, ImageRequest } from "../acquisition/contracts";
import { fingerprint, object, text, uuid } from "../canonical/model";
import type { PresenceWorkflowView, WorkflowContext } from "./presence-workflow";
import { validateStoredMedia } from "../assets/media-validation";
import { hash } from "../content-editing/proposal";

export type PresenceVisualPlacement = {
  owner: string; site: string; intake: string; path: string; sectionIndex: number;
  /** The Section Work product the image is placed in (step 4); placements recorded earlier have only its position. */
  sectionId?: string;
  sectionDigest: string; candidateDigest: string; purpose: string; brief: string; altIntent: string;
};

export function presenceVisualPlacement(context: WorkflowContext, view: PresenceWorkflowView, path: string, sectionIndex: number): PresenceVisualPlacement {
  const decision = view.operatorReview;
  const concept = context.evaluation && view.next === "home-concept" && path === "/" && sectionIndex === 0 ? view.homeConcept : undefined;
  if (view.contextDigest !== fingerprint(context) || (!concept && (view.next !== "review-complete" || !decision || decision.target !== view.candidateReviewTarget || decision.actor.role !== "operator"))) throw Error("Exact reviewed website or scoped Home concept required for a visual placement");
  const section = view.pages.find(page => page.path === path)?.sections[sectionIndex];
  if (!Number.isSafeInteger(sectionIndex) || sectionIndex < 0 || section?.visual.status !== "asset-needed") {
    throw Error("Visual placement needs an image and has no outstanding rights review");
  }
  const { purpose, brief, altIntent } = section.visual;
  return {
    owner: uuid(context.scope.webPresenceId), site: uuid(context.scope.managedSiteId), intake: uuid(context.intakeId),
    path, sectionIndex, ...(section.id && { sectionId: section.id }), sectionDigest: workDigest(section), candidateDigest: concept?.digest ?? decision!.target,
    purpose, brief, altIntent,
  };
}

export type PresenceImageGrant = { model: string; briefs: readonly { id: string; label: string; prompt: string }[] };
export type PresenceVisualResult = Awaited<ReturnType<typeof acquirePresenceVisual>>;
export type PresenceVisual = {
  id: string;
  placement: PresenceVisualPlacement;
  briefId: string;
  requestDigest: string;
  requester: { id: string; authority: string };
  leaseUntil?: number;
  state: "queued" | "running" | "review" | "approved" | "rejected" | "revoked" | "unverified";
  result?: PresenceVisualResult;
  association?: { assetId: string; usageId: string };
  decision?: {
    scope: "non-public-draft-only";
    at: string;
    reviewer: { id: string; authority: string };
    reference: string;
    alt: string | null;
    provenanceDigest: string;
  };
};
export type PresenceVisualOperations = {
  briefs: readonly { id: string; label: string; requestDigest: string }[];
  requestable: boolean;
  execute?: (visual: PresenceVisual, retain: (value: PresenceVisualResult) => Promise<void>) => Promise<PresenceVisualResult>;
  recover: (visual: PresenceVisual, bytes: Buffer) => Promise<PresenceVisualResult>;
  read: (visual: PresenceVisual) => Promise<Buffer>;
};

export function validatePresenceImageGrant(value: unknown): PresenceImageGrant {
  const grant = object(value, ["model", "briefs"]);
  if (grant.model !== "gpt-image-2.5-sunburst-2026-09-08" || !Array.isArray(grant.briefs) || !grant.briefs.length) {
    throw Error("Exact private image grant required");
  }
  const briefs = grant.briefs.map(raw => {
    const brief = object(raw, ["id", "label", "prompt"]);
    if (typeof brief.id !== "string" || !/^[a-z0-9-]{1,64}$/u.test(brief.id)) throw Error("Visual brief identity refused");
    return { id: brief.id, label: text(brief.label, 160), prompt: text(brief.prompt, 3000, true) };
  });
  if (new Set(briefs.map(brief => brief.id)).size !== briefs.length) throw Error("Duplicate authorized visual brief");
  return { model: grant.model, briefs };
}

export async function readPresenceVisual(root: string, visual: PresenceVisual) {
  const result = visual.result;
  if (!result || result.selection !== fingerprint(visual.placement) || result.prompt !== visual.requestDigest) {
    throw Error("Retained visual provenance differs from placement");
  }
  const { provenanceDigest, usage, actualMicros, ...provenance } = result;
  if (typeof usage !== "object" || (actualMicros !== null && (!Number.isSafeInteger(actualMicros) || actualMicros < 0)) ||
      fingerprint(provenance) !== provenanceDigest ||
      result.provider !== "openai" || result.rightsStatus !== "pending-review") throw Error("Retained visual source refused");
  const bytes = await readManagedObject(root, visual.placement.owner, "objects/" + hash(result.masterDigest));
  await validateStoredMedia(bytes, "image/png", result);
  return bytes;
}

// Bind the already allowed outbound prompt, not raw research, customer answers,
// section copy, or unreviewed model instructions. This helper performs no I/O.
export function presenceVisualRequest(approvedPrompt: string): ImageRequest {
  return {
    templateVersion: "presence-provisional-visual/1",
    prompt: "Draw a clearly illustrative, original visual for a private business website candidate. No logos, customer likeness, screenshots, text or evidence of results. " +
      text(approvedPrompt, 3000, true),
    size: "1536x1024", quality: "medium",
  };
}

/** Only a composed acquisition worker with an existing reservation may invoke this. */
export async function acquirePresenceVisual(provider: ImageProvider, selection: PresenceVisualPlacement, request: ImageRequest,
  root: string, attemptId: string, recheck: () => Promise<void>) {
  const directory = await lstat(root);
  if (!isAbsolute(root) || await realpath(root) !== root || !directory.isDirectory() ||
      root.split(sep).some(part => part === "public_html") ||
      (process.platform !== "win32" && (directory.uid !== process.getuid?.() || (directory.mode & 0o777) !== 0o700))) {
    throw Error("Provisional media custody must be a private managed directory");
  }
  provider.assertConfigured();
  await recheck();
  const result = await provider.generateImage(request, { attemptId: uuid(attemptId) });
  if (result.provider !== provider.id || result.model !== provider.model || result.policy !== "passed" ||
      result.width !== 1536 || result.height !== 1024 || result.mimeType !== "image/png") {
    throw Error("Provisional image provider identity or dimensions refused");
  }
  const prepared = await prepareManagedBytes(result.bytes);
  if (prepared.type !== "image" || prepared.mimeType !== result.mimeType ||
      prepared.width !== result.width || prepared.height !== result.height) throw Error("Provisional prepared image differs");
  await provisionManagedObject(root, selection.owner, prepared.sourceReference, prepared.bytes);
  const provenance = {
    selection: fingerprint(selection), prompt: fingerprint(request), provider: result.provider, model: result.model,
    requestId: result.requestId, generatedAt: result.generatedAt, rightsStatus: "pending-review" as const,
    sourceDigest: createHash("sha256").update(result.bytes).digest("hex"), masterDigest: prepared.sourceReference.slice(8), width: result.width,
    height: result.height, altIntent: selection.altIntent,
  };
  return { ...provenance, provenanceDigest: fingerprint(provenance), usage: result.usage, actualMicros: result.actualMicros };
}

/** Where a placement sits on its Page now: by its Section's identity, or by position for placements recorded earlier. */
export function placedAt(placement: Pick<PresenceVisualPlacement, "sectionIndex" | "sectionId">, sections: readonly { id?: string }[]) {
  return placement.sectionId ? sections.findIndex(section => section.id === placement.sectionId) : placement.sectionIndex;
}
/** Whether a placement is still exactly the one Core would make now (a placement recorded earlier is compared without the identity). */
export function samePlacement(current: PresenceVisualPlacement, recorded: PresenceVisualPlacement) {
  const { sectionId, ...rest } = current;
  return fingerprint(recorded.sectionId ? { ...rest, sectionId } : rest) === fingerprint(recorded);
}
