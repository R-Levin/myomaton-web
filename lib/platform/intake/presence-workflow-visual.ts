import { createHash } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, sep } from "node:path";
import { prepareManagedBytes } from "../assets/ingestion";
import { provisionManagedObject } from "../assets/local-storage";
import type { ImageProvider, ImageRequest } from "../acquisition/contracts";
import { fingerprint, text, uuid } from "../canonical/model";
import type { PresenceWorkflowView, WorkflowContext } from "./presence-workflow";

export function presenceVisualPlacement(context: WorkflowContext, view: PresenceWorkflowView, path: string, sectionIndex: number) {
  const decision = view.operatorReview;
  if (view.contextDigest !== fingerprint(context) || view.next !== "review-complete" || !decision || decision.target !== fingerprint({
    confirmation: view.confirmation?.target, direction: view.direction, blueprint: view.blueprint, pages: view.pages, editorial: view.editorial,
  }) || decision.actor.role !== "operator") throw Error("Exact reviewed website required for a visual placement");
  const section = view.pages.find(page => page.path === path)?.sections[sectionIndex];
  if (!Number.isSafeInteger(sectionIndex) || sectionIndex < 0 || section?.visual.status !== "asset-needed") {
    throw Error("Visual placement needs an image and has no outstanding rights review");
  }
  const { purpose, brief, altIntent } = section.visual;
  return {
    owner: uuid(context.scope.webPresenceId), site: uuid(context.scope.managedSiteId), intake: uuid(context.intakeId),
    path, sectionIndex, sectionDigest: fingerprint(section), candidateDigest: decision.target,
    purpose, brief, altIntent,
  };
}

export type PresenceVisualPlacement = ReturnType<typeof presenceVisualPlacement>;

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
