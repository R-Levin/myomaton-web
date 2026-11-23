import { createHash } from "node:crypto";
import type { NativeComponent, NativeNode } from "./presence-native-component";
import type { PresenceWorkflowView, WorkflowContext } from "./presence-workflow";
import { workflowNativeReviewCandidate } from "./presence-workflow-delivery";
import { noteBlocks, type Readback } from "../wordpress-delivery/readback";

/**
 * Turns a WordPress read-back into what Core acts on (owner direction, Nov 22):
 *  - edits: the Operator's changed wording, mapped to the exact Core text it replaces
 *    (each review-draft block names its Core text in metadata.mio). Kept as written.
 *  - notes: open Notes, each tied to its block, become revision requests for that page.
 *  - structural: blocks the Operator added or removed, which have no one-to-one Core text;
 *    passed to the revision as the Operator's intent.
 * Read-only: nothing here changes the case.
 */
export type OperatorEdit = { path: string; origin: string; before: string; after: string };
export type OperatorNote = { id: number; path: string; origin: string | null; blockType: string | null; blockText: string;
  text: string; replies: string[] };
export type OperatorStructural = { path: string; kind: "added" | "removed" | "unreadable"; text: string };
export type OperatorFeedback = {
  readbackRevision: number;
  /** The WordPress content Core has read and accounts for, by path; the next delivery may replace exactly this. */
  acknowledged: { path: string; contentSha256: string; title: string }[];
  edits: OperatorEdit[];
  titles: { path: string; before: string; after: string }[];
  notes: OperatorNote[];
  structural: OperatorStructural[];
};

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#039": "'", "#39": "'", "#038": "&" };
function decode(html: string) {
  return html.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/giu, (match, name: string) => {
    if (entities[name.toLowerCase()] !== undefined) return entities[name.toLowerCase()];
    if (name.startsWith("#x")) return String.fromCodePoint(parseInt(name.slice(2), 16));
    if (name.startsWith("#")) return String.fromCodePoint(Number(name.slice(1)));
    return match;
  });
}
/** Visible text of a block's own markup: line breaks kept, inline formatting dropped (Core stores plain text). */
function visible(html: string) {
  return decode(html.replace(/<br\s*\/?>/giu, "\n").replace(/<!--[\s\S]*?-->/gu, "").replace(/<[^>]+>/gu, ""))
    .split("\n").map(line => line.replace(/[ \t]+/gu, " ").trim()).join("\n").trim();
}

type Unit = { origin: string | null; name: string; text: string };
const PENDING_SUFFIX = " — preview only; submissions disabled";

/** Text blocks of a page in order, each with the Core text it names (if any). */
export function textUnits(content: string): Unit[] {
  const units: Unit[] = [];
  const opener = /<!-- wp:([a-z0-9/-]+)(?: (\{[\s\S]*?\}))? (\/)?-->/gu;
  for (let match = opener.exec(content); match; match = opener.exec(content)) {
    const name = match[1].replace(/^core\//u, "");
    if (!["heading", "paragraph", "list-item", "button", "details"].includes(name) || match[3]) continue;
    let origin: string | null = null;
    if (match[2]) {
      try { const mio = JSON.parse(match[2]).metadata?.mio; origin = typeof mio === "string" ? mio : null; } catch { origin = null; }
    }
    const rest = content.slice(opener.lastIndex);
    const close = rest.indexOf(`<!-- /wp:${match[1]} -->`);
    const inner = close < 0 ? "" : rest.slice(0, close);
    // A Details block's own text is its summary; its children are separate blocks.
    const own = name === "details" ? (/<summary>([\s\S]*?)<\/summary>/u.exec(inner)?.[1] ?? "")
      : name === "list-item" ? inner.replace(/<!-- wp:[\s\S]*$/u, "") : inner;
    let text = visible(own);
    if (text.endsWith(PENDING_SUFFIX)) text = text.slice(0, -PENDING_SUFFIX.length);
    units.push({ origin, name, text });
  }
  return units;
}

/** Core's text for an origin, within a review candidate's sections. */
function coreText(sections: { id: string; content: { heading: string; text: string }; block?: unknown }[], origin: string): string | null {
  const [sectionId, rest] = [origin.slice(0, origin.indexOf(":")), origin.slice(origin.indexOf(":") + 1)];
  const section = sections.find(item => item.id === sectionId);
  if (!section) return null;
  if (rest === "heading") return section.content.heading;
  if (rest === "text") return section.content.text;
  const grouped = groupText(section.block, rest);
  if (grouped !== undefined) return grouped;
  const block = section.block as NativeComponent | undefined;
  if (!block || block.version !== 2) return null;
  const located = locate(block.root, rest);
  if (!located) return null;
  const { node, item, label } = located;
  if (item !== undefined) return node.items[item] ?? null;
  if (label) return node.text;
  return node.text;
}

/** Core's older layout block (version 1): groups of heading, body and items. */
type GroupedBlock = { version: 1; groups: { heading: string; body: string; items: string[] }[] };
const groupPath = /^g([0-9]+)\/(heading|body|i([0-9]+))$/u;

/** Text in an older layout block, by "g<group>/heading|body|i<item>"; undefined if the path is not of that kind. */
function groupText(block: unknown, path: string): string | null | undefined {
  const match = groupPath.exec(path);
  if (!match) return undefined;
  const grouped = block as GroupedBlock | undefined;
  if (grouped?.version !== 1) return null;
  const group = grouped.groups[Number(match[1])];
  if (!group) return null;
  return match[3] !== undefined ? group.items[Number(match[3])] ?? null : group[match[2] as "heading" | "body"];
}

/** The node an origin path names ("r.0.2", list item "r.1/i3", list label "r.1/label"). */
export function locate(root: NativeNode, path: string) {
  const [nodePath, suffix] = path.split("/");
  const steps = nodePath.split(".");
  if (steps[0] !== "r") return null;
  let node: NativeNode | undefined = root;
  for (const step of steps.slice(1)) {
    if (!/^[0-9]+$/u.test(step)) return null;
    node = node?.children[Number(step)];
  }
  if (!node) return null;
  if (suffix === undefined) return { node };
  if (suffix === "label") return node.kind === "list" ? { node, label: true } : null;
  const item = /^i([0-9]+)$/u.exec(suffix);
  return item && node.kind === "list" ? { node, item: Number(item[1]) } : null;
}

const normal = (value: string) => value.replace(/\s+/gu, " ").trim();
const same = (a: string, b: string) => normal(a) === normal(b);

export function operatorFeedback(context: WorkflowContext, view: PresenceWorkflowView, readback: Readback): OperatorFeedback {
  return operatorFeedbackFromCandidate(workflowNativeReviewCandidate(context, view).candidate, readback);
}

/** The same, from the review candidate Core delivered (its pages, sections and section ids). */
export function operatorFeedbackFromCandidate(candidate: { pages: { path: string; title: string;
  sections: { id: string; content: { heading: string; text: string }; block?: unknown }[] }[] }, readback: Readback): OperatorFeedback {
  if (readback.revision === null) throw Error("Nothing has been delivered to this site yet");
  const edits: OperatorEdit[] = [], titles: OperatorFeedback["titles"] = [], structural: OperatorStructural[] = [];
  const blockOf = new Map<number, Unit & { path: string }>();
  for (const page of readback.pages) {
    const core = candidate.pages.find(item => item.path === page.path);
    if (!core || page.missing || page.content === undefined) {
      if (core) structural.push({ path: page.path, kind: "removed", text: "The Operator removed or unpublished this whole page draft." });
      continue;
    }
    const units = textUnits(page.content);
    // The block text each Note sits on, read from the Note's own anchor (works for any block).
    const anchored = noteBlocks(page.content);
    // Note anchors: WordPress stores each Note id in its block's metadata.
    const opener = /<!-- wp:([a-z0-9/-]+) (\{[\s\S]*?\}) (\/)?-->/gu;
    for (let match = opener.exec(page.content); match; match = opener.exec(page.content)) {
      let attributes: { metadata?: { noteId?: unknown; mio?: unknown } } = {};
      try { attributes = JSON.parse(match[2]); } catch { continue; }
      const ids = [attributes.metadata?.noteId].flat().filter((id): id is number => Number.isSafeInteger(id));
      if (!ids.length) continue;
      const origin = typeof attributes.metadata?.mio === "string" ? attributes.metadata.mio : null;
      const unit = units.find(item => item.origin !== null && item.origin === origin);
      for (const id of ids) blockOf.set(id, { origin, name: unit?.name ?? match[1].replace(/^core\//u, ""),
        text: unit?.text || anchored.get(id)?.text || "", path: page.path });
    }
    if (!page.edited) continue;
    if (page.title !== undefined && page.title !== core.title) titles.push({ path: page.path, before: core.title, after: page.title });
    // Safety net: a block without Core's identifier whose text Core already has on this page
    // (for example from a delivery made before that block type was labelled) is not new.
    const known = new Set(core.sections.flatMap(section => originsOf(section)).map(origin => coreText(core.sections, origin))
      .filter((text): text is string => Boolean(text)).map(normal));
    const present = new Set(units.map(unit => normal(unit.text)));
    const seen = new Set<string>();
    for (const unit of units) {
      if (unit.origin === null || seen.has(unit.origin)) {
        if (unit.text && !known.has(normal(unit.text))) structural.push({ path: page.path, kind: "added", text: unit.text });
        continue;
      }
      seen.add(unit.origin);
      const before = coreText(candidate.pages.find(item => item.path === page.path)!.sections, unit.origin);
      if (before === null) { if (unit.text) structural.push({ path: page.path, kind: "added", text: unit.text }); continue; }
      if (same(before, unit.text)) continue;
      // Core stores plain text without markup characters; anything else goes to the revision as intent.
      if (!unit.text || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(unit.text)) {
        structural.push({ path: page.path, kind: unit.text ? "unreadable" : "removed", text: unit.text || before });
      } else edits.push({ path: page.path, origin: unit.origin, before, after: unit.text });
    }
    // Core texts whose block the Operator deleted.
    const delivered = new Set(textUnits(page.content).map(unit => unit.origin));
    for (const section of core.sections) {
      for (const origin of originsOf(section)) {
        if (!delivered.has(origin)) {
          const text = coreText(core.sections, origin);
          // Still on the page, just without an identifier: not removed.
          if (text && !present.has(normal(text))) structural.push({ path: page.path, kind: "removed", text });
        }
      }
    }
  }
  const byPost = new Map(readback.pages.map(page => [page.id, page.path]));
  const notes: OperatorNote[] = readback.notes.filter(note => note.parent === 0 && note.status !== "resolved").map(note => {
    const block = blockOf.get(note.id);
    return { id: note.id, path: block?.path ?? byPost.get(note.postId) ?? "", origin: block?.origin ?? null, blockType: block?.name ?? null,
      blockText: block?.text ?? "", text: note.content,
      replies: readback.notes.filter(reply => reply.parent === note.id).map(reply => reply.content) };
  }).filter(note => note.path !== "");
  return {
    readbackRevision: readback.revision,
    acknowledged: readback.pages.filter(page => page.contentSha256).map(page => ({ path: page.path, contentSha256: page.contentSha256!, title: page.title ?? "" })),
    edits, titles, notes, structural,
  };
}

/** Every text origin a delivered section names. */
function originsOf(section: { id: string; content: { heading: string; text: string }; block?: unknown }): string[] {
  const block = section.block as NativeComponent | GroupedBlock | undefined;
  const own = [section.id + ":heading", ...(section.content.text ? [section.id + ":text"] : [])];
  if (block?.version === 1) return [...own, ...block.groups.flatMap((group, index) => [
    `${section.id}:g${index}/heading`, ...(group.body ? [`${section.id}:g${index}/body`] : []),
    ...group.items.map((_, item) => `${section.id}:g${index}/i${item}`)])];
  if (!block || block.version !== 2) return own;
  const out: string[] = [];
  const walk = (node: NativeNode, path: string) => {
    if (["heading", "paragraph", "action", "details"].includes(node.kind) && node.text) out.push(section.id + ":" + path);
    if (node.kind === "list") {
      if (node.text) out.push(section.id + ":" + path + "/label");
      node.items.forEach((_, index) => out.push(section.id + ":" + path + "/i" + index));
    }
    node.children.forEach((child, index) => walk(child, path + "." + index));
  };
  walk(block.root, "r");
  return out;
}

export const contentDigest = (content: string) => createHash("sha256").update(content).digest("hex");

/**
 * Core's pages with the Operator's wording written in, exactly as typed (plain text).
 * A section heading that is also the section's opening heading stays in step with it.
 */
export function applyOperatorEdits(context: WorkflowContext, view: PresenceWorkflowView, feedback: Pick<OperatorFeedback, "edits" | "titles">) {
  const pages = structuredClone(view.pages);
  const { candidate } = workflowNativeReviewCandidate(context, view);
  const clean = (value: string, label: string) => {
    if (!value.trim() || value.length > 20_000 || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) throw Error(label + " refused");
    return value;
  };
  for (const title of feedback.titles) {
    const page = pages.find(item => item.path === title.path);
    if (!page || page.heading !== title.before) throw Error("Operator title edit no longer matches Core's page");
    page.heading = clean(title.after, "Operator title");
  }
  for (const edit of feedback.edits) {
    const page = pages.find(item => item.path === edit.path);
    const delivered = candidate.pages.find(item => item.path === edit.path);
    const sectionId = edit.origin.slice(0, edit.origin.indexOf(":")), rest = edit.origin.slice(edit.origin.indexOf(":") + 1);
    const index = delivered?.sections.findIndex(section => section.id === sectionId) ?? -1;
    const section = page?.sections[index];
    if (!page || !section) throw Error("Operator edit names a section Core no longer has");
    const after = clean(edit.after, "Operator wording");
    if (rest === "heading" || rest === "text") {
      const field = rest === "heading" ? "heading" : "body";
      if (!same(section[field], edit.before)) throw Error("Operator edit no longer matches Core's text");
      section[field] = after;
      continue;
    }
    const grouped = groupPath.exec(rest);
    if (grouped) {
      const group = (section.block as GroupedBlock | undefined)?.version === 1 ? (section.block as GroupedBlock).groups[Number(grouped[1])] : undefined;
      const current = group && (grouped[3] !== undefined ? group.items[Number(grouped[3])] : group[grouped[2] as "heading" | "body"]);
      if (!group || current === undefined || !same(current, edit.before)) throw Error("Operator edit no longer matches Core's text");
      if (grouped[3] !== undefined) group.items[Number(grouped[3])] = after;
      else group[grouped[2] as "heading" | "body"] = after;
      continue;
    }
    const block = section.block as NativeComponent | undefined;
    const located = block?.version === 2 ? locate(block.root, rest) : null;
    if (!located) throw Error("Operator edit names a block Core no longer has");
    const { node, item, label } = located;
    const current = item !== undefined ? node.items[item] : node.text;
    if (current === null || current === undefined || !same(current, edit.before)) throw Error("Operator edit no longer matches Core's text");
    if (item !== undefined) node.items[item] = after;
    else if (label) node.text = after;
    else {
      // The section's own heading is checked against its opening heading node; keep them equal.
      if (node.kind === "heading" && same(section.heading, current)) section.heading = after;
      // A button's label is also the Action's label.
      if (node.kind === "action" && node.reference) {
        const index = /^action-([0-9]+)$/u.exec(node.reference)?.[1];
        const action = index === undefined ? undefined : page.actions[Number(index)];
        if (action && same(action.label, current)) action.label = after;
      }
      node.text = after;
    }
  }
  return pages;
}

/** All visitor-facing text of a Core page, whitespace-normalized, for checking kept wording. */
export function pageText(page: PresenceWorkflowView["pages"][number]) {
  const parts: string[] = [page.heading];
  const walk = (node: NativeNode) => {
    if (node.text) parts.push(node.text);
    parts.push(...node.items);
    node.children.forEach(walk);
  };
  for (const section of page.sections) {
    parts.push(section.heading, section.body);
    const block = section.block as NativeComponent | GroupedBlock | undefined;
    if (block?.version === 2) walk(block.root);
    if (block?.version === 1) for (const group of block.groups) parts.push(group.heading, group.body, ...group.items);
  }
  parts.push(...page.actions.map(action => action.label));
  return parts.join("\n").replace(/\s+/gu, " ");
}

/** Kept Operator wording a revised page no longer contains (empty when all is kept). */
export function droppedWording(page: PresenceWorkflowView["pages"][number], keep: readonly { path: string; text: string }[] | undefined) {
  const text = pageText(page);
  return (keep ?? []).filter(kept => kept.path === page.path && !text.includes(kept.text));
}

/** The Operator wording a revised page must still contain, word for word. */
export function keptWording(feedback: Pick<OperatorFeedback, "edits">, paths: readonly string[]) {
  return feedback.edits.filter(edit => paths.includes(edit.path)).map(edit => ({ path: edit.path, text: edit.after.replace(/\s+/gu, " ").trim() }));
}

/** What Core asks the revision to do, per page, from Notes and structural changes. */
export function operatorConcerns(feedback: OperatorFeedback) {
  const quote = (value: string, limit = 400) => "“" + (value.length > limit ? value.slice(0, limit) + "…" : value) + "”";
  const concerns: { path: string; concern: string }[] = [];
  for (const note of feedback.notes) {
    const where = note.blockText ? `On the ${note.blockType ?? "block"} ${quote(note.blockText, 240)}` : "On this page";
    concerns.push({ path: note.path, concern: `Operator note. ${where}: ${note.text}` +
      (note.replies.length ? ` (Further replies: ${note.replies.join(" / ")})` : "") });
  }
  for (const change of feedback.structural) {
    concerns.push({ path: change.path, concern: change.kind === "added"
      ? `The Operator added this text in WordPress; work it into the page where it fits: ${quote(change.text)}`
      : change.kind === "removed" ? `The Operator removed this from the page in WordPress; leave it out: ${quote(change.text)}`
      : `The Operator wrote this in WordPress; keep its meaning: ${quote(change.text)}` });
  }
  // Operator wording on a page being revised is kept word for word.
  const revised = new Set(concerns.map(item => item.path));
  for (const edit of feedback.edits) if (revised.has(edit.path)) {
    concerns.push({ path: edit.path, concern: `Keep this Operator wording exactly as written: ${quote(edit.after, 2000)}` });
  }
  return concerns;
}
