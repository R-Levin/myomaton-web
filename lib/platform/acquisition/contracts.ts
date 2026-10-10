import { fingerprint } from "../canonical/model";

export const TEMPLATE_VERSION = "miopages-service-illustration/1";
export const POLICY_VERSION = "acquired-hero/1";
export type FailureCode = "credentials-absent" | "timeout-uncertain" | "rate-limit" | "transient" | "invalid-request" | "refusal" | "invalid-response" | "validation" | "budget" | "stale" | "lease-expired";
export class AcquisitionFailure extends Error {
  constructor(public readonly code: FailureCode, public readonly requestId: string | null = null) { super(code); }
}
export type ImageRequest = { prompt: string; templateVersion: string; size: "1536x1024"; quality: "medium" };
export type ExecutionContext = { attemptId: string; signal?: AbortSignal };
export type ImageResult = {
  provider: string; model: string; requestId: string | null; bytes: Buffer;
  width: number; height: number; mimeType: string; usage: Record<string, number>;
  actualMicros: number | null; policy: "passed"; generatedAt: string;
};
export interface ImageProvider {
  readonly id: string; readonly model: string;
  assertConfigured(): void;
  generateImage(request: ImageRequest, context: ExecutionContext): Promise<ImageResult>;
  editImage?: (request: ImageRequest, context: ExecutionContext) => Promise<ImageResult>;
  iterateImage?: (request: ImageRequest, context: ExecutionContext) => Promise<ImageResult>;
}
export const illustrationRequest: ImageRequest = {
  templateVersion: TEMPLATE_VERSION, size: "1536x1024", quality: "medium",
  prompt: "Create one conceptual branded explanatory illustration, landscape 3:2. Business understanding becomes a clear public presence, with continuing attention surrounding and supporting it. Flat geometric layered planes; square and circular relational concepts; deep purple #30154a, blue-violet #6843cf, lavender #c8b8eb and warm paper #f6f1e8. Refined composition, clear hierarchy, generous negative space. This is an abstract service illustration, not documentary evidence. No dashboard, browser UI, website screenshots, analytics, customer logos, metrics, fabricated claims, embedded text or business copy, people, or photorealistic customer evidence. No decorative pseudo-writing. Show a small cluster becoming one coherent central plane, held by a subtle circular supporting form.",
};
export const ITERATION_TWO_TEMPLATE = "miopages-service-illustration/2";
const concreteIllustrationRequest: ImageRequest = {
  templateVersion: ITERATION_TWO_TEMPLATE, size: "1536x1024", quality: "medium",
  prompt: "Create ONE explanatory commercial service illustration for MioPages A Business in Focus, landscape 3:2. Clearly communicate three connected stages without words: business information -> one clear public presence -> continuing care. LEFT: recognizable structured business information, a service/topic card with tool or subject icon, audience/customer cue represented by a target symbol (no people), checklist of priorities with ticks, location pin and contact envelope, folded document/content fragments with short non-letter information lines. These must read as meaningful information, not random purple blocks. CENTER: these inputs visibly flow into a substantial coherent composed information/presence plane, with organized topic groups and a strong clear hierarchy: the business explained clearly after Launch. Use a tangible flat layered presentation object, NOT a literal website screenshot, browser or dashboard. RIGHT AND AROUND THE PRESENCE: a recognizable circular refresh/update cycle connected to the presence, a review check badge, a maintenance/tool cue and small attention/improvement sparks. Communicate that the presence is maintained and improved over time through an ongoing managed-service relationship. Clear left-to-right flow and continuing circular care, immediately understandable without explanatory text. Clean contemporary flat simplified illustration, strong deep purple #30154a, blue-violet #6843cf, lavender #c8b8eb, warm paper #f6f1e8. Meaningful geometry, layering, visual metaphor and substantial image weight, direct commercial clarity. Explanatory illustration rather than decorative abstract brand art. No people, photography, dashboard, browser chrome, analytics, fake website screenshots, client logos, fabricated metrics, embedded marketing copy, letters or pseudo-writing.",
};
export const ITERATION_THREE_TEMPLATE = "miopages-service-illustration/3";
const clarityRequest: ImageRequest = {
  templateVersion: ITERATION_THREE_TEMPLATE, size: "1536x1024", quality: "medium",
  prompt: "Create ONE restrained MioPages Home Hero supporting illustration. Goal: CLARITY + CONTINUITY. Reinforce the surrounding copy 'A clearer web presence. Less to manage.' and 'One focused Launch, followed by continuing care.' DO NOT put this copy or any text in the image. Support the copy; do not explain the complete service. Middle path: more concrete than abstract geometric brand art, much simpler and less literal than a process infographic. One central organized symbolic form: a substantial square-ish layered composition with a few harmonious information pieces fitting together, suggesting one clear public presence without looking like a web page or fabricated UI. ONLY THREE TO FIVE disparate business-information fragments total, with restrained document-like edges or simple grouped marks, resolving visually into that central coherent form. ONE simple surrounding circular ribbon/arc gesture suggesting continuity and ongoing attention; no process arrows. Meaningful square/circle relationships, substantial negative space, calm commercial clarity. Contemporary flat/layered commercial illustration, landscape 3:2, strong deep purple #30154a, blue-violet #6843cf, lavender #c8b8eb, warm paper #f6f1e8 background. No people or photography. Strictly no stars, ratings, reviews, tools or wrenches, shopping bags, target icons, map pins, dashboards, browser chrome, fake website screenshots or page mockups, analytics, charts, text labels, pseudo-writing, dense or oversized checklists, multiple arrows, icon clusters, complete process infographic. The central presence is symbolic, restrained and cohesive, not a grid of UI widgets. Clarity plus one continuous care gesture, no dense literal explanation.",
};
// Preserve each historical request so changing a brief cannot reinterpret its digest.
export function requestForTemplate(version: string): ImageRequest {
  if(version===TEMPLATE_VERSION)return {...illustrationRequest};
  if(version===ITERATION_TWO_TEMPLATE)return {...concreteIllustrationRequest};
  if(version===ITERATION_THREE_TEMPLATE)return {...clarityRequest};
  throw new AcquisitionFailure("invalid-request");
}
export type NeedContext = {
  webPresenceId: string; managedSiteId: string; pageId: string; sectionId: string;
  role: "service-illustration"; strategy: "generated-illustrated";
  sectionVersion: number; pageVersion: number; siteVersion: number;
  need: unknown; sectionContent: unknown; sectionConfiguration: unknown;
  siteConfiguration: unknown; design: unknown;
};
export type Decision = {
  actor: string; role: "operator"; authority: "local-operator";
  decision: "approve" | "reject" | "revoke"; subjectType: "media-candidate";
  candidateId: string; subjectDigest: string; revision: number;
  scope: { webPresenceId: string; sectionId: string; role: "service-illustration" };
  at: string; reason: string;
};
export function workIdentity(context: NeedContext, provider: Pick<ImageProvider,"id"|"model">, iteration: number, templateVersion=TEMPLATE_VERSION) {
  return fingerprint({ owner: context.webPresenceId, capability: "image-generation", context: fingerprint(context), provider, template: requestForTemplate(templateVersion).templateVersion, strategy: context.strategy, iteration });
}
export function micros(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 2_000_000_000) throw new AcquisitionFailure("budget");
  return value;
}
