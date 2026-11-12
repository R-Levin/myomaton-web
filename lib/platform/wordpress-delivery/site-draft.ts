import { normalizeDestination } from "../actions/model";
import { fingerprint, object, text, uuid } from "../canonical/model";
import { hash } from "../content-editing/proposal";
import { validatePages, type ReviewedProjection, type Site } from "./authority";

// Page review remains the source of content authority. This composition
// validates what an exact non-public draft authorization would cover.
export type ReviewedDraftPage = Site & Pick<ReviewedProjection, "approvalId" | "previewDigest" | "sourceDigest" | "projectionDigest" | "revision" | "pages"> & {
  proposalId: string;
};

export function bindSiteDraft(site: Site, reviewed: readonly ReviewedDraftPage[], input: unknown) {
  const scope = { organizationId: uuid(site.organizationId), webPresenceId: uuid(site.webPresenceId), managedSiteId: uuid(site.managedSiteId) };
  const selection = object(input, ["siteProposalId", "installationId", "revision", "previousDigest", "navigation", "actions"]);
  if (typeof selection.revision !== "number" || !Number.isSafeInteger(selection.revision) || selection.revision < 1) throw Error("Invalid draft revision");
  const revision = selection.revision;
  const previousDigest = revision === 1 && selection.previousDigest === null ? null : hash(selection.previousDigest);
  if (revision === 1 && previousDigest !== null) throw Error("Initial draft must have no predecessor");
  if (reviewed.length < 1 || reviewed.length > 16) throw Error("Invalid draft page count");
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
  validatePages(pages);
  const paths = new Set(pages.map(page => page.path));
  if (!paths.has("/") || paths.size !== new Set(pages.map(page => page.path.replace(/\/$/u, ""))).size) throw Error("Invalid draft routes");
  if (!Array.isArray(selection.navigation) || selection.navigation.length !== pages.length ||
      new Set(selection.navigation).size !== pages.length || selection.navigation.some(item => !paths.has(item))) throw Error("Invalid draft navigation");
  if (!Array.isArray(selection.actions) || selection.actions.length > 32) throw Error("Invalid draft actions");
  const actions = selection.actions.map(value => {
    const action = object(value, ["id", "label", "from", "type", "destination"]);
    if (typeof action.from !== "string" || !paths.has(action.from) || (action.type !== "contact" && action.type !== "page")) throw Error("Invalid draft action scope");
    const destination = normalizeDestination(action.type, action.destination);
    // This first draft binds internal page targets. A Contact action points to
    // its private page, whose native form integration has separate authority.
    if (!destination || !paths.has(destination)) throw Error("Invalid draft action destination");
    return { id: uuid(action.id), label: text(action.label, 100), from: action.from, type: action.type, destination };
  });
  if (new Set(actions.map(action => action.id)).size !== actions.length) throw Error("Duplicate draft action");
  const candidate = { scope, siteProposalId: uuid(selection.siteProposalId), installationId: uuid(selection.installationId), revision,
    previousDigest, sourceDigest, approvals, pages, navigation: [...selection.navigation] as string[], actions };
  return { candidate, digest: fingerprint(candidate) };
}
