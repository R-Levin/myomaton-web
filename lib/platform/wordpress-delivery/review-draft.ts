import { fingerprint, object, text, uuid } from "../canonical/model";
import type { workflowNativeReviewCandidate } from "../intake/presence-workflow-delivery";
import { validatePages, type Site } from "./authority";
import { readSignedDraftBrand } from "./draft-brand";
import { nativeDraftBaseline } from "./site-draft";

/**
 * A review draft: Core's current site for a case, delivered as private draft pages to
 * Operator WordPress so the Operator can edit and annotate it (owner decision, Nov 22:
 * no per-page approval first; releases keep the approval path). It carries Core's own
 * page designs, its chosen design, and the Actions not yet connected. It is signed by
 * Core like every delivery and is never public.
 */
type Review = ReturnType<typeof workflowNativeReviewCandidate>;
type SignedBrand = ReturnType<typeof readSignedDraftBrand>;

const hash = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);

export function bindReviewDraft(input: {
  site: Site;
  installationId: string;
  /** Stable per case and installation; WordPress refuses a different stream on the same drafts. */
  streamId: string;
  revision: number;
  previousDigest: string | null;
  source: { intakeId: string; workflowVersion: number };
  review: Review;
  brand?: SignedBrand;
  baselinePages?: unknown;
  /** The Operator content Core read back and took in; WordPress may replace exactly this. */
  readBack?: { revision: number; pages: { path: string; contentSha256: string; title: string }[] };
  /** Core's reply to each Note it acted on; WordPress adds it to the thread and resolves the Note. */
  answeredNotes?: { id: number; reply: string }[];
}) {
  const scope = { organizationId: uuid(input.site.organizationId), webPresenceId: uuid(input.site.webPresenceId),
    managedSiteId: uuid(input.site.managedSiteId) };
  if (!Number.isSafeInteger(input.revision) || input.revision < 1) throw Error("Review draft revision refused");
  if ((input.revision === 1) !== (input.previousDigest === null) || (input.previousDigest !== null && !hash(input.previousDigest))) {
    throw Error("Review draft predecessor refused");
  }
  if (!Number.isSafeInteger(input.source.workflowVersion) || input.source.workflowVersion < 1) throw Error("Review draft source refused");
  const brand = input.brand && readSignedDraftBrand(input.brand, scope);
  const baselinePages = input.baselinePages === undefined ? undefined : nativeDraftBaseline(input.baselinePages);
  const candidate = {
    scope, siteProposalId: uuid(input.streamId), installationId: uuid(input.installationId), revision: input.revision,
    previousDigest: input.previousDigest, ...(brand && { brand }), ...(baselinePages && { baselinePages }),
    ...(input.readBack && { readBack: structuredClone(input.readBack) }),
    ...(input.answeredNotes?.length && { answeredNotes: structuredClone(input.answeredNotes) }),
    source: { intakeId: uuid(input.source.intakeId), workflowVersion: input.source.workflowVersion,
      candidateDigest: fingerprint(input.review.candidate) },
    pages: structuredClone(input.review.candidate.pages),
    navigation: [...input.review.candidate.navigation],
    actions: structuredClone(input.review.candidate.actions),
    unresolvedActions: structuredClone(input.review.unresolvedActions ?? []),
  };
  readReviewDraftCandidate(candidate);
  return { candidate, digest: fingerprint(candidate) };
}

/** Checks a review-draft candidate, both before signing and when reading an envelope back. */
export function readReviewDraftCandidate(value: unknown) {
  const candidate = object(value, ["scope", "siteProposalId", "installationId", "revision", "previousDigest", "source",
    "pages", "navigation", "actions", "unresolvedActions",
    ...(Object.hasOwn(value as object, "brand") ? ["brand"] : []),
    ...(Object.hasOwn(value as object, "baselinePages") ? ["baselinePages"] : []),
    ...(Object.hasOwn(value as object, "readBack") ? ["readBack"] : []),
    ...(Object.hasOwn(value as object, "answeredNotes") ? ["answeredNotes"] : [])]);
  const scope = object(candidate.scope, ["organizationId", "webPresenceId", "managedSiteId"]) as Site;
  const pages = candidate.pages as Parameters<typeof validatePages>[0];
  validatePages(pages, true, true);
  const paths = new Set(pages.map(page => page.path));
  if (!paths.has("/")) throw Error("Review draft needs Home");
  const navigation = candidate.navigation;
  if (!Array.isArray(navigation) || !navigation.includes("/") || new Set(navigation).size !== navigation.length ||
      navigation.some(path => !paths.has(path))) throw Error("Review draft navigation refused");
  if (!Array.isArray(candidate.actions)) throw Error("Review draft Actions refused");
  const ids = new Set<string>();
  for (const value of candidate.actions) {
    const keys = Object.keys(value ?? {});
    const action = object(value, ["id", "type", "from", "destination", "label",
      ...["componentReference", "sectionId"].filter(key => keys.includes(key))]);
    if (action.type !== "page" || typeof action.from !== "string" || !paths.has(action.from) ||
        typeof action.destination !== "string" || !paths.has(action.destination) || action.destination === action.from ||
        ids.has(uuid(action.id)) || (action.componentReference !== undefined &&
        (typeof action.componentReference !== "string" || !/^(action-[0-9]+|related-[a-f0-9-]+)$/u.test(action.componentReference)))) {
      throw Error("Review draft Action refused");
    }
    text(action.label, 100);
    if (action.sectionId !== undefined) uuid(action.sectionId);
    ids.add(uuid(action.id));
  }
  if (!Array.isArray(candidate.unresolvedActions)) throw Error("Review draft pending Actions refused");
  for (const value of candidate.unresolvedActions) {
    const pending = object(value, ["from", "reference", "label"]);
    if (typeof pending.from !== "string" || !paths.has(pending.from) || typeof pending.reference !== "string" ||
        !/^action-[0-9]+$/u.test(pending.reference)) throw Error("Review draft pending Action refused");
    text(pending.label, 400);
  }
  const source = object(candidate.source, ["intakeId", "workflowVersion", "candidateDigest"]);
  uuid(source.intakeId);
  if (!Number.isSafeInteger(source.workflowVersion) || !hash(source.candidateDigest)) throw Error("Review draft source refused");
  if (candidate.brand !== undefined) readSignedDraftBrand(candidate.brand, scope);
  if (candidate.baselinePages !== undefined) nativeDraftBaseline(candidate.baselinePages);
  if (candidate.readBack !== undefined) {
    const read = object(candidate.readBack, ["revision", "pages"]);
    if (!Number.isSafeInteger(read.revision) || !Array.isArray(read.pages)) throw Error("Review draft read-back refused");
    for (const value of read.pages) {
      const page = object(value, ["path", "contentSha256", "title"]);
      if (typeof page.path !== "string" || !hash(page.contentSha256) || typeof page.title !== "string") throw Error("Review draft read-back refused");
    }
  }
  if (candidate.answeredNotes !== undefined) {
    if (!Array.isArray(candidate.answeredNotes) || !candidate.answeredNotes.length) throw Error("Review draft Note answers refused");
    for (const value of candidate.answeredNotes) {
      const answer = object(value, ["id", "reply"]);
      if (!Number.isSafeInteger(answer.id) || (answer.id as number) < 1) throw Error("Review draft Note answer refused");
      text(answer.reply, 2000);
    }
  }
  return candidate;
}
