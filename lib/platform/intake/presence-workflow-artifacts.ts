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

const copy = (value: unknown) => text(value, Infinity, true);
function list<T>(value: unknown, map: (item: unknown) => T, required = true): T[] {
  if (!Array.isArray(value) || (required && !value.length)) throw Error("Invalid artifact list");
  return value.map(map);
}
function unique(values: readonly string[]) {
  if (new Set(values).size !== values.length) throw Error("Repeated artifact identity");
}
function references(value: unknown, allowed: readonly string[], required = true) {
  const entries = list(value, item => text(item, 160), required);
  unique(entries);
  if (entries.some(entry => !allowed.includes(entry))) throw Error("Unknown artifact reference");
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
    const sourceIds = references(finding.sourceIds, ids);
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
export function readDirection(value: unknown, ids: readonly string[]) {
  const direction = object(value, ["positioning", "approach", "visitorDecisions", "sourceIds"]);
  return { positioning: copy(direction.positioning), approach: copy(direction.approach),
    visitorDecisions: list(direction.visitorDecisions, copy), sourceIds: references(direction.sourceIds, ids) };
}
export function readBlueprint(value: unknown, ids: readonly string[], normalizeProviderReferences = false) {
  // Source repetition carries no additional meaning. Validate every ID even when deduplicating.
  const citedSources = (value: unknown) => references(normalizeProviderReferences && Array.isArray(value) ? [...new Set(value)] : value, ids);
  const blueprint = object(value, ["pages", "navigation", "articles"]);
  const pages = list(blueprint.pages, value => {
    const page = object(value, ["path", "label", "purpose", "sourceIds"]);
    return { path: path(page.path), label: copy(page.label), purpose: copy(page.purpose), sourceIds: citedSources(page.sourceIds) };
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
  return { pages, navigation: references(navigation, paths), articles: list(blueprint.articles, value => {
    const article = object(value, ["title", "question", "target", "sourceIds"]);
    const [target] = references([article.target], paths);
    return { title: copy(article.title), question: copy(article.question), target, sourceIds: citedSources(article.sourceIds) };
  }, false) };
}
export function readPage(value: unknown, exactPath: string, paths: readonly string[], ids: readonly string[],
  destinations: Partial<Record<Exclude<typeof actionKinds[number], "navigate">, string>>) {
  const page = object(value, ["path", "heading", "searchTitle", "searchDescription", "sections", "actions", "internalLinks"]);
  if (page.path !== exactPath) throw Error("Page does not match the blueprint");
  const sections = list(page.sections, value => {
    const section = object(value, ["heading", "body", "sourceIds", "visual"]);
    const visual = object(section.visual, ["purpose", "brief", "altIntent", "status"]);
    return { heading: copy(section.heading), body: copy(section.body), sourceIds: references(section.sourceIds, ids),
      visual: { purpose: copy(visual.purpose), brief: copy(visual.brief), altIntent: copy(visual.altIntent), status: choice(visual.status, visualStates) } };
  });
  const otherPaths = paths.filter(candidate => candidate !== exactPath);
  const actions = list(page.actions, value => {
    const action = object(value, ["label", "kind", "destination"]);
    const kind = choice(action.kind, actionKinds);
    const destination = action.destination === null ? null : text(action.destination, 500);
    if (kind === "navigate" ? !otherPaths.includes(destination ?? "") : destination !== null && destination !== destinations[kind]) {
      throw Error("Unknown Action destination");
    }
    return { label: copy(action.label), kind, destination };
  });
  return { path: exactPath, heading: copy(page.heading), searchTitle: copy(page.searchTitle), searchDescription: copy(page.searchDescription),
    sections, actions, internalLinks: references(page.internalLinks, otherPaths, false) };
}
export function readEditorial(value: unknown, paths: readonly string[]) {
  const editorial = object(value, ["summary", "concerns"]);
  return { summary: copy(editorial.summary), concerns: list(editorial.concerns, value => {
    const concern = object(value, ["path", "concern"]);
    const [pagePath] = references([concern.path], paths);
    return { path: pagePath, concern: copy(concern.concern) };
  }, false) };
}

export type WorkflowReport = ReturnType<typeof readReport>;
export type WorkflowDirection = ReturnType<typeof readDirection>;
export type WorkflowBlueprint = ReturnType<typeof readBlueprint>;
export type WorkflowPage = ReturnType<typeof readPage>;
export type WorkflowEditorial = ReturnType<typeof readEditorial>;
