import { normalizeDestination } from "../actions/model";
import { fingerprint, object, text, uuid } from "../canonical/model";
import { hash } from "../content-editing/proposal";
import { canonicalPagePath } from "../managed-sites/paths";
import { validatePages, type ReviewedProjection, type Site } from "./authority";
import { readSignedDraftBrand } from "./draft-brand";
import { readNativeDraftMedia, type NativeDraftMedia } from "./native-draft-media";

// Page review remains the source of content authority. This composition
// validates what an exact non-public draft authorization would cover.
export type ReviewedDraftPage = Site & Pick<ReviewedProjection, "approvalId" | "previewDigest" | "sourceDigest" | "projectionDigest" | "revision" | "pages"> & {
  proposalId: string;
  media?: readonly NativeDraftMedia[];
};

export function nativeDraftRollback(value: unknown, revision: number) {
  const rollback = object(value, ["revision", "digest"]);
  if (!Number.isSafeInteger(revision) || typeof rollback.revision !== "number" || !Number.isSafeInteger(rollback.revision) ||
      rollback.revision < 1 || rollback.revision >= revision - 1) throw Error("Invalid materialized rollback revision");
  return { revision: rollback.revision, digest: hash(rollback.digest) };
}

export function verifyNativeMediaPlacements(media: readonly NativeDraftMedia[], pages: ReviewedProjection["pages"]) {
  const sectionIds = new Set<string>(), usages = new Set<string>();
  for (const item of media) {
    if (sectionIds.has(item.sectionId) || usages.has(item.usageId) || !pages.some(page => page.id === item.pageId &&
      page.sections.some(section => (section.id === item.sectionId || (section.moreVisuals ?? []).some(frame => frame.id === item.sectionId))
        && ["hero", "intro", "relationship", "collection", "cta"].includes(section.type)))) {
      throw Error("Draft media placement differs from reviewed Section");
    }
    sectionIds.add(item.sectionId);
    usages.add(item.usageId);
  }
}

export function nativeDraftBaseline(value: unknown) {
  if (!Array.isArray(value) || !value.length) throw Error("Exact prior Page set required");
  const pages = value.map(raw => {
    const page = object(raw, ["id", "path"]);
    const path = canonicalPagePath(page.path);
    if (!path) throw Error("Invalid prior Page path");
    return { id: uuid(page.id), path };
  });
  if (!pages.some(page => page.path === "/") || new Set(pages.map(page => page.path.replace(/\/$/u, ""))).size !== pages.length ||
      new Set(pages.map(page => page.id)).size !== pages.length) throw Error("Conflicting prior Page identities");
  return pages;
}

export function bindSiteDraft(site: Site, reviewed: readonly ReviewedDraftPage[], input: unknown, exactBrand?: ReturnType<typeof readSignedDraftBrand>) {
  const scope = { organizationId: uuid(site.organizationId), webPresenceId: uuid(site.webPresenceId), managedSiteId: uuid(site.managedSiteId) };
  const selection = object(input, ["siteProposalId", "installationId", "revision", "previousDigest", "rollback", "baselinePages", "navigation", "actions", "brandDigest"]);
  if (selection.brandDigest !== exactBrand?.digest) throw Error("Exact canonical draft brand required");
  const brand = exactBrand && readSignedDraftBrand(exactBrand, scope);
  if (typeof selection.revision !== "number" || !Number.isSafeInteger(selection.revision) || selection.revision < 1) throw Error("Invalid draft revision");
  const revision = selection.revision;
  const previousDigest = revision === 1 && selection.previousDigest === null ? null : hash(selection.previousDigest);
  if (revision === 1 && previousDigest !== null) throw Error("Initial draft must have no predecessor");
  if (reviewed.length < 1) throw Error("Invalid draft page count");
  const sourceDigest = hash(reviewed[0].sourceDigest);
  const proposals = new Set<string>();
  const approvals = reviewed.map(member => {
    if (member.organizationId !== scope.organizationId || member.webPresenceId !== scope.webPresenceId ||
        member.managedSiteId !== scope.managedSiteId || member.sourceDigest !== sourceDigest || member.pages.length !== 1 ||
        fingerprint(member.pages) !== member.projectionDigest || !Number.isSafeInteger(member.revision) || member.revision < 1) {
      throw Error("Draft page review binding mismatch");
    }
    const proposalId = uuid(member.proposalId);
    if (proposals.has(proposalId)) throw Error("Duplicate draft page proposal");
    proposals.add(proposalId);
    return { proposalId, revision: member.revision, approvalId: hash(member.approvalId), previewDigest: hash(member.previewDigest),
      projectionDigest: hash(member.projectionDigest), pageId: uuid(member.pages[0].id) };
  });
  const pages = structuredClone(reviewed.flatMap(member => member.pages));
  validatePages(pages, true);
  const media = reviewed.flatMap(member => (member.media ?? []).map(raw => {
    const item = readNativeDraftMedia(raw);
    if (item.pageId !== member.pages[0].id) throw Error("Draft visual belongs to another reviewed Page");
    return item;
  }));
  verifyNativeMediaPlacements(media, pages);
  const baselinePages = selection.baselinePages === undefined ? undefined : nativeDraftBaseline(selection.baselinePages);
  if (baselinePages) {
    if (!previousDigest) throw Error("Prior Page set requires an applied revision");
    for (const page of pages) {
      if (baselinePages.some(prior => (prior.path === page.path || prior.id === page.id) &&
          (prior.path !== page.path || prior.id !== page.id))) throw Error("Draft Page identity changed");
    }
  }
  const paths = new Set(pages.map(page => page.path));
  if (!paths.has("/") || paths.size !== new Set(pages.map(page => page.path.replace(/\/$/u, ""))).size) throw Error("Invalid draft routes");
  if (!Array.isArray(selection.navigation) || !selection.navigation.includes("/") ||
      new Set(selection.navigation).size !== selection.navigation.length ||
      selection.navigation.some(item => !paths.has(item))) throw Error("Invalid draft navigation");
  if (!Array.isArray(selection.actions)) throw Error("Invalid draft actions");
  const actions = selection.actions.map(value => {
    const action = object(value, ["id", "label", "from", "type", "destination", "sectionId"]);
    if (typeof action.from !== "string" || !paths.has(action.from) || (action.type !== "contact" && action.type !== "page")) throw Error("Invalid draft action scope");
    const destination = normalizeDestination(action.type, action.destination);
    // This first draft binds internal page targets. A Contact action points to
    // its private page, whose native form integration has separate authority.
    if (!destination || !paths.has(destination)) throw Error("Invalid draft action destination");
    const sectionId = action.sectionId === undefined ? undefined : uuid(action.sectionId);
    if (sectionId && (action.type !== "page" || destination === action.from || !pages.some(page => page.path === action.from &&
      page.composition === "managed-v1" && page.sections.some(section => section.id === sectionId && ["hero", "cta"].includes(section.type))))) {
      throw Error("Invalid draft Action placement");
    }
    return { id: uuid(action.id), label: text(action.label, 100), from: action.from, type: action.type, destination, ...(sectionId && { sectionId }) };
  });
  if (new Set(actions.map(action => action.id)).size !== actions.length) throw Error("Duplicate draft action");
  const rollback = selection.rollback === undefined ? undefined : nativeDraftRollback(selection.rollback, revision);
  if (rollback?.digest === previousDigest) throw Error("Materialized rollback digest must differ from signed predecessor");
  const candidate = { scope, siteProposalId: uuid(selection.siteProposalId), installationId: uuid(selection.installationId), revision,
    previousDigest, ...(brand && { brand }), ...(rollback && { rollback }), ...(baselinePages && { baselinePages }), ...(media.length && { media }), sourceDigest, approvals, pages, navigation: [...selection.navigation] as string[], actions };
  return { candidate, digest: fingerprint(candidate) };
}
