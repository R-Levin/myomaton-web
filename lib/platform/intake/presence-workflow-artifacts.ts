import { choice, object, text } from "../canonical/model";
import { canonicalPagePath } from "../managed-sites/paths";

export const evidenceKinds = ["owner-confirmed", "earlier-review-answer", "earlier-review-assessment", "website-observation", "customer-unconfirmed", "historical-discovery", "service-direction", "public-research"] as const;
export type PresenceEvidence = { id: string; kind: typeof evidenceKinds[number]; label: string; reference: string; date: string | null; content: string; rawDigest?: string; discoveredFrom?: string };
const findingStates = ["established", "proposed", "unresolved"] as const;
const actionKinds = ["navigate", "request-review", "start-onboarding", "request-contact", "existing-account"] as const;
const visualStates = ["text-only", "asset-needed", "rights-review"] as const;
const string = { type: "string" };
const nullableString = { type: ["string", "null"] };
const array = (items: unknown) => ({ type: "array", items });
const shape = (properties: Record<string, unknown>) => ({
  type: "object", properties, required: Object.keys(properties), additionalProperties: false,
});
const options = (values: readonly string[]) => ({ type: "string", enum: values });
const cited = { sourceIds: array(string) };

export const artifactSchemas = {
  report: shape({ title: string, summary: string, findings: array(shape({ id: string, heading: string, body: string, status: options(findingStates), ...cited })) }),
  direction: shape({ positioning: string, approach: string, visitorDecisions: array(string), ...cited }),
  blueprint: shape({
    pages: array(shape({ path: string, label: string, purpose: string, ...cited })),
    navigation: array(string), articles: array(shape({ title: string, question: string, target: string, ...cited })),
  }),
  page: shape({
    path: string, heading: string, searchTitle: string, searchDescription: string,
    sections: array(shape({ heading: string, body: string, ...cited,
      visual: shape({ purpose: string, brief: string, altIntent: string, status: options(visualStates) }) })),
    actions: array(shape({ label: string, kind: options(actionKinds), destination: nullableString })),
    internalLinks: array(string),
  }),
  editorial: shape({ summary: string, concerns: array(shape({ path: string, concern: string })) }),
};

export type ArtifactIssue = "citation" | "page-binding" | "action-destination" | "shape-or-content";

export class ArtifactValidationError extends Error {
  constructor(readonly issue: ArtifactIssue, message: string) { super(message); }
}

const copy = (value: unknown) => text(value, Infinity, true);
function list<T>(value: unknown, map: (item: unknown) => T, required = true): T[] {
  if (!Array.isArray(value) || (required && !value.length)) throw Error("Invalid artifact list");
  return value.map(map);
}
function unique(values: readonly string[]) {
  if (new Set(values).size !== values.length) throw Error("Repeated artifact identity");
}
function references(value: unknown, allowed: readonly string[], required = true, issue: ArtifactIssue = "page-binding") {
  const entries = list(value, item => text(item, 160), required);
  unique(entries);
  if (entries.some(entry => !allowed.includes(entry))) throw new ArtifactValidationError(issue, "Unknown artifact reference");
  return entries;
}
function path(value: unknown) {
  const result = text(value, 120);
  if (!canonicalPagePath(result)) throw Error("Invalid Page path");
  return result;
}
const knownSources: readonly PresenceEvidence["kind"][] = ["owner-confirmed"];
export function readReport(value: unknown, sources: readonly PresenceEvidence[], allowCertaintyDowngrade = false) {
  const report = object(value, ["title", "summary", "findings"]);
  const ids = sources.map(source => source.id);
  const findings = list(report.findings, value => {
    const finding = object(value, ["id", "heading", "body", "status", "sourceIds"]);
    let status = choice(finding.status, findingStates);
    const sourceIds = citedSources(finding.sourceIds, ids, allowCertaintyDowngrade);
    if (status === "established" && !sourceIds.every(id => knownSources.includes(sources.find(source => source.id === id)!.kind))) {
      if (!allowCertaintyDowngrade) throw Error("Established finding lacks confirmed evidence");
      // Retain the provider wording as a proposal and keep the exact response in custody.
      status = "proposed";
    }
    return { id: text(finding.id, 160), heading: copy(finding.heading), body: copy(finding.body), status, sourceIds };
  });
  unique(findings.map(finding => finding.id));
  return { title: copy(report.title), summary: copy(report.summary), findings };
}
export function readDirection(value: unknown, ids: readonly string[], normalizeProviderReferences = false) {
  const direction = object(value, ["positioning", "approach", "visitorDecisions", "sourceIds"]);
  return { positioning: copy(direction.positioning), approach: copy(direction.approach),
    visitorDecisions: list(direction.visitorDecisions, copy), sourceIds: citedSources(direction.sourceIds, ids, normalizeProviderReferences) };
}
function citedSources(value: unknown, ids: readonly string[], normalizeProviderReferences: boolean) {
  // Source repetition carries no additional meaning. Validate every ID even when deduplicating.
  return references(normalizeProviderReferences && Array.isArray(value) ? [...new Set(value)] : value, ids, true, "citation");
}

export function readBlueprint(value: unknown, ids: readonly string[], normalizeProviderReferences = false) {
  const blueprint = object(value, ["pages", "navigation", "articles"]);
  const pages = list(blueprint.pages, value => {
    const page = object(value, ["path", "label", "purpose", "sourceIds"]);
    return { path: path(page.path), label: copy(page.label), purpose: copy(page.purpose), sourceIds: citedSources(page.sourceIds, ids, normalizeProviderReferences) };
  });
  const paths = pages.map(page => page.path);
  unique(paths);
  if (!paths.includes("/")) throw Error("Home is missing");
  // A label can stand in for its path only when it resolves to one declared Page.
  const navigation = normalizeProviderReferences && Array.isArray(blueprint.navigation) ? blueprint.navigation.map(item => {
    if (typeof item !== "string" || item.startsWith("/") || paths.includes(item)) return item;
    const matches = pages.filter(page => page.label === item);
    return matches.length === 1 ? matches[0].path : item;
  }) : blueprint.navigation;
  return { pages, navigation: references(normalizeProviderReferences && Array.isArray(navigation) ? [...new Set(navigation)] : navigation, paths),
    articles: list(blueprint.articles, value => {
    const article = object(value, ["title", "question", "target", "sourceIds"]);
    const [target] = references([article.target], paths);
    return { title: copy(article.title), question: copy(article.question), target, sourceIds: citedSources(article.sourceIds, ids, normalizeProviderReferences) };
  }, false) };
}
export function readPage(value: unknown, exactPath: string, paths: readonly string[], ids: readonly string[],
  destinations: Partial<Record<Exclude<typeof actionKinds[number], "navigate">, string>>, normalizeProviderReferences = false) {
  const page = object(value, ["path", "heading", "searchTitle", "searchDescription", "sections", "actions", "internalLinks"]);
  if (page.path !== exactPath) throw new ArtifactValidationError("page-binding", "Page does not match the blueprint");
  const sections = list(page.sections, value => {
    const section = object(value, ["heading", "body", "sourceIds", "visual"]);
    const visual = object(section.visual, ["purpose", "brief", "altIntent", "status"]);
    return { heading: copy(section.heading), body: copy(section.body), sourceIds: citedSources(section.sourceIds, ids, normalizeProviderReferences),
      visual: { purpose: copy(visual.purpose), brief: copy(visual.brief), altIntent: copy(visual.altIntent), status: choice(visual.status, visualStates) } };
  });
  const otherPaths = paths.filter(candidate => candidate !== exactPath);
  const actions = list(page.actions, value => {
    const action = object(value, ["label", "kind", "destination"]);
    const kind = choice(action.kind, actionKinds);
    const destination = action.destination === null ? null : text(action.destination, 500);
    if (kind === "navigate" && !otherPaths.includes(destination ?? "")) {
      if (normalizeProviderReferences && destination === exactPath) {
        return { label: copy(action.label), kind, destination: null, unresolvedDestination: destination };
      }
      throw new ArtifactValidationError("action-destination", "Unknown Action destination");
    }
    if (kind !== "navigate" && destination !== null && destination !== destinations[kind]) {
      if (!normalizeProviderReferences) throw new ArtifactValidationError("action-destination", "Unknown Action destination");
      return { label: copy(action.label), kind, destination: null };
    }
    return { label: copy(action.label), kind, destination };
  });
  const links = normalizeProviderReferences ? [...new Set(list(page.internalLinks, item => path(item), false))] : undefined;
  const unresolvedLinks = links?.filter(link => !otherPaths.includes(link));
  return { path: exactPath, heading: copy(page.heading), searchTitle: copy(page.searchTitle), searchDescription: copy(page.searchDescription),
    sections, actions, internalLinks: links?.filter(link => otherPaths.includes(link)) ?? references(page.internalLinks, otherPaths, false),
    ...(unresolvedLinks?.length && { unresolvedLinks }) };
}
export function readEditorial(value: unknown, paths: readonly string[], normalizeProviderReferences = false) {
  const editorial = object(value, ["summary", "concerns"]);
  const items = list(editorial.concerns, value => {
    const item = object(value, ["path", "concern"]);
    return { target: copy(item.path), concern: copy(item.concern) };
  }, false);
  const concerns: { path: string; concern: string }[] = [];
  const unassigned: { suggestedTarget: string; concern: string }[] = [];
  const seen = new Set<string>();
  for (const { target, concern } of items) {
    if (normalizeProviderReferences) {
      const key = JSON.stringify([target, concern]);
      if (seen.has(key)) continue;
      seen.add(key);
      if (!paths.includes(target)) {
        // This is advisory text. It never selects a Page, Action or revision.
        unassigned.push({ suggestedTarget: target, concern });
        continue;
      }
    }
    const [pagePath] = references([target], paths);
    concerns.push({ path: pagePath, concern });
  }
  return { summary: copy(editorial.summary), concerns, ...(unassigned.length > 0 && { unassigned }) };
}

export type WorkflowReport = ReturnType<typeof readReport>;
export type WorkflowDirection = ReturnType<typeof readDirection>;
export type WorkflowBlueprint = ReturnType<typeof readBlueprint>;
export type WorkflowPage = ReturnType<typeof readPage>;
export type WorkflowEditorial = ReturnType<typeof readEditorial>;
