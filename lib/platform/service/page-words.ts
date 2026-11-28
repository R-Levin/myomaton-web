import type { NativeComponent, NativeNode } from "../intake/presence-native-component";
import { assertNativeSection, readNativeComponent } from "../intake/presence-native-component";
import type { PageContent } from "./cycle";

/**
 * A page's words and its layout, kept apart (task 1a, docs/plan-words-and-layout.md). A stored
 * page still holds its text in place, so delivery and WordPress are unchanged; here its visible
 * words are read out as numbered pieces. A layout change places those pieces by number and holds
 * no text of its own, so it cannot change a word. A word change edits pieces in place and leaves
 * the arrangement as it is.
 */

export type Piece = { id: string; kind: "heading" | "text"; text: string };

type Section = PageContent["sections"][number] & { role?: string; block?: unknown; sourceIds?: string[] };
type Group = { heading: string; body: string; items: string[] };
type Spot = { kind: "heading" | "text"; get(): string; set(value: string): void;
  /** Where it sits, for removing it or adding after it. */
  at: { section: number; sectionHeading?: true; body?: true; node?: NativeNode; parent?: NativeNode; item?: number; group?: number; field?: "heading" | "body" } };

export class WordsError extends Error {}

const isNative = (block: unknown): block is NativeComponent => (block as { version?: unknown } | null)?.version === 2;
const isGroups = (block: unknown): block is { groups: Group[] } => Array.isArray((block as { groups?: unknown } | null)?.groups);
/** A section whose whole visible content is its designed component (the heading included). */
const designed = (section: Section) => isNative(section.block) && section.block.mode === "section";

/** Every visible word of a page, in reading order (action labels are the page's Actions, not here). */
function spots(page: PageContent): Spot[] {
  const found: Spot[] = [];
  page.sections.forEach((raw, index) => {
    const section = raw as Section;
    const visit = (node: NativeNode, parent?: NativeNode) => {
      if (node.kind !== "action" && typeof node.text === "string")
        found.push({ kind: node.kind === "heading" ? "heading" : "text", get: () => node.text!, set: value => { node.text = value; }, at: { section: index, node, parent } });
      if (node.kind === "list") node.items.forEach((_, item) =>
        found.push({ kind: "text", get: () => node.items[item]!, set: value => { node.items[item] = value; }, at: { section: index, node, parent, item } }));
      node.children.forEach(child => visit(child, node));
    };
    if (!designed(section)) {
      found.push({ kind: "heading", get: () => section.heading, set: value => { section.heading = value; }, at: { section: index, sectionHeading: true } });
      paragraphs(section.body, value => { section.body = value; }).forEach(([get, set]) => found.push({ kind: "text", get, set, at: { section: index, body: true } }));
    }
    if (isNative(section.block)) visit(section.block.root);
    else if (isGroups(section.block)) section.block.groups.forEach((group, g) => {
      if (group.heading.trim()) found.push({ kind: "heading", get: () => group.heading, set: value => { group.heading = value; }, at: { section: index, group: g, field: "heading" } });
      paragraphs(group.body, value => { group.body = value; }).forEach(([get, set]) => found.push({ kind: "text", get, set, at: { section: index, group: g, field: "body" } }));
      group.items.forEach((_, item) => found.push({ kind: "text", get: () => group.items[item]!, set: value => { group.items[item] = value; }, at: { section: index, group: g, item } }));
    });
  });
  return found;
}

/** A body of several paragraphs is several pieces; setting one rewrites the body (an emptied paragraph drops out). */
function paragraphs(body: string, write: (value: string) => void): [() => string, (value: string) => void][] {
  const parts = body.split(/\n\s*\n/u).map(part => part.trim());
  return parts.flatMap((part, index) => part ? [[() => parts[index]!, (value: string) => { parts[index] = value; write(parts.filter(Boolean).join("\n\n")); }]] : []) as [() => string, (value: string) => void][];
}

const pieceId = (index: number) => "w" + (index + 1);

/** The page's visible words as numbered pieces. */
export function pageWords(page: PageContent): Piece[] {
  return spots(page).map((spot, index) => ({ id: pieceId(index), kind: spot.kind, text: spot.get() }));
}

/** The page's arrangement with each piece's number in place of its text: what a layout change starts from. */
export function arrangementOf(page: PageContent): PageContent {
  const copy = structuredClone(page);
  spots(copy).forEach((spot, index) => spot.set(pieceId(index)));
  return copy;
}

/** Just the visible words, for comparing two versions of a page. */
export function visibleWords(page: PageContent): string[] {
  return pageWords(page).map(piece => piece.text.replace(/\s+/gu, " ").trim());
}

/** What changed in a page's words between two versions, line by line. */
export function compareWords(before: PageContent, after: PageContent) {
  const less = (from: string[], minus: string[]) => {
    const left = minus.reduce((map, line) => map.set(line, (map.get(line) ?? 0) + 1), new Map<string, number>());
    return from.filter(line => { const n = left.get(line) ?? 0; if (n > 0) { left.set(line, n - 1); return false; } return true; });
  };
  const a = visibleWords(before), b = visibleWords(after), gone = less(a, b), added = less(b, a);
  return { unchanged: gone.length === 0 && added.length === 0, gone, added };
}

/** The layout a layout change returns: each section by its heading piece, and its designed component with piece numbers. */
export type LayoutSection = { heading: string; role: string; visual: unknown; moreVisuals?: unknown; block: unknown };
export type Layout = { sections: LayoutSection[] };

/**
 * Fill a layout change with the page's own words. Every piece must be placed exactly once (a
 * section's heading piece also heads its component); an unknown number, or a piece left out, is
 * refused. Everything that isn't arrangement (the page title, search text, Actions, links) stays
 * as it was.
 */
export function fillLayout(previous: PageContent, layout: Layout): PageContent {
  const pieces = new Map(pageWords(previous).map(piece => [piece.id, piece]));
  const used = new Map<string, number>();
  const take = (id: unknown, kind?: Piece["kind"]) => {
    const piece = typeof id === "string" ? pieces.get(id.trim()) : undefined;
    if (!piece) throw new WordsError(`The layout uses ${JSON.stringify(id)}, which is not one of the page's pieces`);
    if (kind && piece.kind !== kind) throw new WordsError(`Piece ${piece.id} is ${piece.kind === "heading" ? "a heading" : "text"}, not ${kind === "heading" ? "a heading" : "text"}`);
    used.set(piece.id, (used.get(piece.id) ?? 0) + 1);
    return piece.text.replace(/\s*\n\s*/gu, " ");
  };
  if (!Array.isArray(layout?.sections) || !layout.sections.length) throw new WordsError("The layout has no sections");
  const before = previous.sections as Section[];
  // A section's own fields that aren't words (its summary, its sources) go with its heading.
  const byHeading = new Map(before.map(section => [section.heading, section]));
  const sections = layout.sections.map((raw, index) => {
    if (!isNative(raw.block) || raw.block.mode !== "section") throw new WordsError(`Section ${index + 1} must be a designed component (version 2, mode section)`);
    const heading = take(raw.heading, "heading");
    const block = structuredClone(raw.block) as NativeComponent;
    let headed = false;
    const fill = (node: NativeNode) => {
      if (node.kind === "action") {
        // A button's label is the page's Action, never the layout's.
        const action = (previous.actions as { label?: string }[] | undefined)?.[Number(/^action-(\d+)$/u.exec(node.reference ?? "")?.[1] ?? NaN)];
        if (!action?.label) throw new WordsError(`The layout places a button (${node.reference}) the page doesn't have`);
        node.text = action.label;
      }
      else if (typeof node.text === "string") {
        // The heading that heads this section reuses the section's heading piece.
        if (node.kind === "heading" && node.text.trim() === String(raw.heading).trim() && !headed) { headed = true; node.text = heading; }
        else node.text = take(node.text, node.kind === "heading" ? "heading" : "text");
      }
      if (node.kind === "list") node.items = node.items.map(item => take(item, "text"));
      node.children.forEach(fill);
    };
    fill(block.root);
    const was = byHeading.get(heading);
    return { ...(was ?? {}), heading, body: was?.body ?? heading, role: raw.role, sourceIds: was?.sourceIds ?? [], visual: raw.visual,
      ...(raw.moreVisuals !== undefined && { moreVisuals: raw.moreVisuals }), block } as Section;
  });
  const missing = [...pieces.keys()].filter(id => !used.get(id));
  const twice = [...used].filter(([, n]) => n > 1).map(([id]) => id);
  if (missing.length) throw new WordsError(`The layout leaves out ${missing.length} of the page's pieces: ${missing.slice(0, 20).join(", ")}`);
  if (twice.length) throw new WordsError(`The layout uses pieces more than once: ${twice.slice(0, 20).join(", ")}`);
  if (sections[0]!.role !== "hero" || sections.slice(1).some(section => section.role === "hero")) throw new WordsError("The first section, and only the first, is the opening (hero)");
  sections.forEach(section => {
    // Each component is checked exactly as a whole-page answer is.
    const block = readNativeComponent(section.block);
    assertNativeSection(block, section.heading, section.role!);
    section.block = block;
  });
  const holder = (index: number) => sections.findIndex(section => {
    let found = false;
    const visit = (node: NativeNode) => { if (node.kind === "action" && node.reference === "action-" + index) found = true; node.children.forEach(visit); };
    visit((section.block as NativeComponent).root);
    return found;
  });
  const actions = Array.isArray(previous.actions) ? (previous.actions as { sectionIndex?: number | null }[]).map((action, index) => {
    const at = holder(index);
    return { ...action, sectionIndex: at >= 0 ? at : null };
  }) : previous.actions;
  const page = { ...structuredClone(previous), sections, actions } as PageContent;
  // The guarantee itself: the words read back exactly as they were.
  if (!compareWords(previous, page).unchanged) throw new WordsError("The layout would change the page's words");
  return page;
}

/** A word change: only the pieces it changes, removes or adds (each added after a named piece). */
export type WordEdits = {
  change?: { id: string; text: string }[];
  remove?: string[];
  add?: { after: string; text: string; as: "paragraph" | "heading" | "item" }[];
};

/** Apply a word change to the current page; the arrangement stays as it is. */
export function applyWordEdits(previous: PageContent, edits: WordEdits): PageContent {
  const page = structuredClone(previous);
  const all = spots(page), byId = new Map(all.map((spot, index) => [pieceId(index), spot]));
  const find = (id: string) => { const spot = byId.get(String(id).trim()); if (!spot) throw new WordsError(`No piece ${id} on the page`); return spot; };
  const order = (spot: Spot) => all.indexOf(spot);
  const clean = (text: string) => { const value = String(text ?? "").trim(); if (!value || /[<>]/u.test(value)) throw new WordsError("A piece of text must be plain words"); return value; };
  for (const { id, text } of edits.change ?? []) {
    const spot = find(id), value = clean(text);
    // A designed section's title is both its heading and its component's heading: change both together.
    const section = page.sections[spot.at.section] as Section;
    if (spot.at.node?.kind === "heading" && designed(section) && section.heading === spot.get()) section.heading = value;
    spot.set(value);
  }
  // Additions and removals work from the end so earlier places stay where they are.
  const adds = (edits.add ?? []).map((add, n) => ({ ...add, n, spot: find(add.after) }))
    .sort((x, y) => order(y.spot) - order(x.spot) || y.n - x.n);
  const removes = [...new Set((edits.remove ?? []).map(id => find(id)))].sort((x, y) => order(y) - order(x));
  for (const add of adds) {
    const { node, parent, item, group, section } = add.spot.at, text = clean(add.text);
    if (node && item !== undefined && add.as === "item") { node.items.splice(item + 1, 0, text); continue; }
    if (group !== undefined && item !== undefined && add.as === "item") { ((page.sections[section] as Section).block as { groups: Group[] }).groups[group]!.items.splice(item + 1, 0, text); continue; }
    if (node && parent && add.as !== "item") {
      const fresh: NativeNode = { ...structuredClone(node), kind: add.as, text, level: add.as === "heading" ? Math.max(3, node.level ?? 3) : null,
        items: [], ordered: false, reference: null, children: [] };
      parent.children.splice(parent.children.indexOf(node) + 1, 0, fresh);
      continue;
    }
    throw new WordsError(`Adding ${add.as === "item" ? "a list item" : "a " + add.as} after ${add.after} needs a whole-page change`);
  }
  for (const spot of removes) {
    const { node, parent, item, group, section, sectionHeading, body } = spot.at;
    const owner = page.sections[section] as Section;
    if (sectionHeading || (node?.kind === "heading" && designed(owner) && owner.heading === spot.get())) throw new WordsError("Removing a section's heading removes the section: that needs a whole-page change");
    if (body) { spot.set(""); continue; }
    if (node && item !== undefined) { node.items.splice(item, 1); if (node.items.length || !parent) continue; }
    if (node && parent) { parent.children.splice(parent.children.indexOf(node), 1); continue; }
    if (group !== undefined) {
      const g = (owner.block as { groups: Group[] }).groups[group]!;
      if (item !== undefined) g.items.splice(item, 1); else spot.set("");
      continue;
    }
    throw new WordsError("That piece can't be removed on its own: it needs a whole-page change");
  }
  // A group left empty goes with its last piece.
  const prune = (node: NativeNode) => { node.children = node.children.filter(child => (prune(child), child.kind !== "group" || child.children.length > 0)); };
  page.sections.forEach(raw => { const section = raw as Section; if (isNative(section.block)) prune(section.block.root); });
  page.sections.forEach(raw => { const section = raw as Section; if (isNative(section.block)) assertNativeSection(readNativeComponent(section.block), section.heading, section.role ?? "intro"); });
  return page;
}
