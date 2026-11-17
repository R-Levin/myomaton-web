import { fingerprint, object, text } from "../canonical/model";
import { readPage, type WorkflowPage } from "./presence-workflow-artifacts";

const string = { type: "string" };
const optional = { type: ["string", "null"] };
const indexed = { type: "integer" };
const array = (items: object) => ({ type: "array", items });
const shape = (properties: Record<string, object>) => ({ type: "object", properties,
  required: Object.keys(properties), additionalProperties: false });

export function editorialPatchSchema(paths: readonly string[]) {
  return shape({ changes: array(shape({
    path: { type: "string", enum: paths }, heading: optional,
    sections: array(shape({ index: indexed, heading: optional, body: optional, sourceIds: array(string),
      visual: { type: ["string", "null"], enum: ["text-only", null] } })),
    actions: array(shape({ index: indexed, label: optional, sectionIndex: { type: ["integer", "null"] }, remove: { type: "boolean" } })),
    removeInternalLinks: array(string),
  })) });
}

function uniqueEdits(value: unknown, keys: readonly string[], length: number) {
  if (!Array.isArray(value)) throw Error("Expected a list of indexed editorial edits");
  const indexed = new Map<number, Record<string, unknown>>();
  for (const raw of value) {
    const item = object(raw, keys);
    const index = item.index;
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= length || indexed.has(index)) {
      throw Error("Editorial edit index refused");
    }
    indexed.set(index, item);
  }
  return indexed;
}

export function applyEditorialPatch(value: unknown, current: readonly WorkflowPage[], targets: readonly string[],
  paths: readonly string[], sources: readonly string[], destinations: Parameters<typeof readPage>[4]) {
  const { changes } = object(value, ["changes"]);
  if (!Array.isArray(changes) || !changes.length) throw Error("Expected substantive editorial edits");
  const patched = new Map<string, WorkflowPage>();
  for (const raw of changes) {
    const edit = object(raw, ["path", "heading", "sections", "actions", "removeInternalLinks"]);
    const previous = typeof edit.path === "string" && targets.includes(edit.path) && current.find(page => page.path === edit.path);
    if (!previous || patched.has(previous.path)) throw Error("Editorial page is outside the exact review");
    const sectionEdits = uniqueEdits(edit.sections, ["index", "heading", "body", "sourceIds", "visual"], previous.sections.length);
    const actionEdits = uniqueEdits(edit.actions, ["index", "label", "sectionIndex", "remove"], previous.actions.length);
    if (!Array.isArray(edit.removeInternalLinks) || edit.removeInternalLinks.some(link => !previous.internalLinks.includes(link))) {
      throw Error("Editorial link change refused");
    }
    const removedLinks = new Set(edit.removeInternalLinks);
    const rawPage = { path: previous.path, heading: edit.heading === null ? previous.heading : text(edit.heading, Infinity, true),
      searchTitle: previous.searchTitle, searchDescription: previous.searchDescription, composition: previous.composition,
      sections: previous.sections.map((section, index) => {
        const change = sectionEdits.get(index);
        if (!change) return section;
        if (change.visual !== null && change.visual !== "text-only" || !Array.isArray(change.sourceIds)) throw Error("Editorial section edit refused");
        return { ...section, heading: change.heading === null ? section.heading : text(change.heading, Infinity, true),
          body: change.body === null ? section.body : text(change.body, Infinity, true),
          sourceIds: change.body === null && change.sourceIds.length === 0 ? section.sourceIds : change.sourceIds,
          visual: change.visual === null ? section.visual : { ...section.visual, status: "text-only" } };
      }),
      actions: previous.actions.flatMap((action, index) => {
        const change = actionEdits.get(index);
        if (change && typeof change.remove !== "boolean") throw Error("Editorial action change refused");
        if (change?.remove) return [];
        return [{ label: !change || change.label === null ? action.label : text(change.label, Infinity, true), kind: action.kind,
          destination: action.destination ?? action.unresolvedDestination ?? null, sectionIndex: change ? change.sectionIndex : action.sectionIndex ?? null }];
      }),
      internalLinks: previous.internalLinks.filter(link => !removedLinks.has(link)),
    };
    const routes = Object.fromEntries(Object.entries(destinations).filter(([, path]) => path !== previous.path && paths.includes(path)));
    const revised = readPage(rawPage, previous.path, paths, sources, routes, true, true);
    // Retain pre-existing quarantined references for later review; the editor
    // cannot supply, remove, or activate them through a patch.
    if (previous.unresolvedLinks?.length) revised.unresolvedLinks = previous.unresolvedLinks;
    if (fingerprint(revised) === fingerprint(previous)) throw Error("Editorial edit did not change its page");
    patched.set(previous.path, revised);
  }
  return current.map(page => patched.get(page.path) ?? page);
}
