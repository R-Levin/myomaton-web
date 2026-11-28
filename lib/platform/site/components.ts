/**
 * The site's components (docs/rendering-design.md): each is defined once, with the content its slots
 * take and the variants a design may choose. A page's layout uses them; its content fills them. The
 * same components serve the first build and every later change in Ongoing.
 */

/** One piece of a page's content. Layout points at it by id; it never holds layout. */
export type ContentItem =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "text"; text: string }
  | { id: string; type: "item"; title: string; text: string }
  | { id: string; type: "question"; question: string; answer: string }
  | { id: string; type: "picture"; shows: string; alt: string }
  | { id: string; type: "action"; label: string; page: string }
  | { id: string; type: "placeholder"; need: string; text: string };
export type ContentType = ContentItem["type"];

/** One section of a page's layout: a component, how it looks, and which content fills its slots. */
export type Section = { id: string; component: ComponentName; variant: string | null; band: Band; slots: Record<string, string[]> };

/** The design's palette pairs a section's band can use (site-design.ts). */
export const bands = ["light", "tonal", "strong", "brand", "supporting", "contrast"] as const;
export type Band = typeof bands[number];

type Slot = { takes: ContentType[]; many: boolean; required: boolean };
const slot = (takes: ContentType[], many = false, required = false): Slot => ({ takes, many, required });

export const components = {
  opening: { slots: { heading: slot(["heading"], false, true), text: slot(["text"], true), picture: slot(["picture", "placeholder"]), actions: slot(["action"], true) },
    variants: ["centered", "split", "banner"] },
  text: { slots: { heading: slot(["heading"], false, true), text: slot(["text"], true, true), actions: slot(["action"], true) }, variants: ["single", "wide"] },
  "text-picture": { slots: { heading: slot(["heading"], false, true), text: slot(["text"], true, true), picture: slot(["picture", "placeholder"], false, true), actions: slot(["action"], true) },
    variants: ["picture-left", "picture-right"] },
  points: { slots: { heading: slot(["heading"]), text: slot(["text"], true), items: slot(["item", "placeholder"], true, true), actions: slot(["action"], true) },
    variants: ["columns", "cards", "list"] },
  steps: { slots: { heading: slot(["heading"]), text: slot(["text"], true), items: slot(["item", "placeholder"], true, true), actions: slot(["action"], true) },
    variants: ["row", "list"] },
  questions: { slots: { heading: slot(["heading"]), text: slot(["text"], true), questions: slot(["question", "placeholder"], true, true), actions: slot(["action"], true) },
    variants: ["open", "folded"] },
  gallery: { slots: { heading: slot(["heading"]), text: slot(["text"], true), pictures: slot(["picture", "placeholder"], true, true) }, variants: ["grid", "row"] },
  call: { slots: { heading: slot(["heading"], false, true), text: slot(["text"], true), actions: slot(["action"], true, true) }, variants: ["band", "card"] },
} satisfies Record<string, { slots: Record<string, Slot>; variants: string[] }>;
export type ComponentName = keyof typeof components;
export const componentNames = Object.keys(components) as ComponentName[];

/** A page as content and layout, both its own. */
export type SitePage = { path: string; title: string; menuLabel: string; searchTitle: string; searchDescription: string;
  content: ContentItem[]; layout: Section[] };

/**
 * Check a page's layout against its content and the components. What's refused is said plainly;
 * content no section uses is not an error, it's listed so a person can see it.
 */
export function checkPage(page: SitePage, paths: readonly string[]) {
  const problems: string[] = [];
  const byId = new Map(page.content.map(item => [item.id, item]));
  if (byId.size !== page.content.length) problems.push("Two content items share an id");
  for (const item of page.content) if (item.type === "action" && !paths.includes(item.page)) problems.push(`Action "${item.label}" goes to ${item.page}, which isn't a page of the site`);
  const used = new Set<string>();
  page.layout.forEach((section, index) => {
    const where = `Section ${index + 1} (${section.component})`;
    const component = components[section.component];
    if (!component) { problems.push(`${where}: no such component`); return; }
    if (section.variant !== null && !component.variants.includes(section.variant)) problems.push(`${where}: no variant "${section.variant}"`);
    if (!bands.includes(section.band)) problems.push(`${where}: no band "${section.band}"`);
    for (const name of Object.keys(section.slots)) if (!(name in component.slots)) problems.push(`${where}: no slot "${name}"`);
    for (const [name, rule] of Object.entries(component.slots) as [string, Slot][]) {
      const ids = section.slots[name] ?? [];
      if (rule.required && !ids.length) problems.push(`${where}: the ${name} slot is empty`);
      if (!rule.many && ids.length > 1) problems.push(`${where}: the ${name} slot takes one item`);
      for (const id of ids) {
        const item = byId.get(id);
        if (!item) { problems.push(`${where}: ${name} points at "${id}", which isn't in the page's content`); continue; }
        if (!rule.takes.includes(item.type)) problems.push(`${where}: ${name} can't hold a ${item.type}`);
        used.add(id);
      }
    }
  });
  if (!page.layout.length) problems.push("The page has no sections");
  return { problems, unused: page.content.filter(item => !used.has(item.id)).map(item => item.id) };
}

/** What changed in a page's content between two versions, item by item, for a person to see. */
export function compareContent(before: SitePage, after: SitePage) {
  const words = (item: ContentItem) => Object.entries(item).filter(([key]) => key !== "id" && key !== "type").map(([, value]) => value).join(" — ");
  const was = new Map(before.content.map(item => [item.id, words(item)])), now = new Map(after.content.map(item => [item.id, words(item)]));
  const gone = [...was].filter(([id, text]) => now.get(id) !== text).map(([, text]) => text);
  const added = [...now].filter(([id, text]) => was.get(id) !== text).map(([, text]) => text);
  return { unchanged: !gone.length && !added.length, gone, added };
}
