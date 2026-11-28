import type { Band, ComponentName, ContentItem, Section, SitePage } from "./components";
import { checkPage } from "./components";

/**
 * A page in the earlier format (sections of headings, bodies and node trees, before Nov 29) as the
 * same words in the component format: every heading, paragraph, list item, question, picture,
 * placeholder and button carried over as a content item, and each earlier section laid out with the
 * component nearest to what it held. No AI, no word changed. Used when an existing site moves to the
 * component format; the result is an ordinary page version, reviewed like any other.
 */
type Node = { kind: string; text: string | null; level: number | null; items: string[]; reference: string | null; children: Node[] };
type Visual = { purpose: string; brief: string; altIntent: string; status: string };
type OldSection = { id?: string; heading: string; body: string; role?: string; visual?: Visual; moreVisuals?: Visual[];
  block?: { version?: number; mode?: string; root?: Node; groups?: { heading: string; body: string; items: string[] }[] } | null };
type OldPage = { path: string; heading: string; searchTitle?: string; searchDescription?: string; sections: OldSection[];
  actions?: { label: string; kind: string; destination: string | null; sectionIndex?: number | null }[] };

const paragraphs = (text: string) => text.split(/\n\s*\n/u).map(part => part.trim()).filter(Boolean);

export function migratePage(old: OldPage, menuLabel: string, sourceIds: string[] = []) {
  const content: ContentItem[] = [], layout: Section[] = [];
  /** Where each earlier picture frame went: the earlier frame's id, and the new picture item's id. */
  const pictures: { frame: string; contentId: string }[] = [];
  let n = 0;
  const id = () => `c${++n}`;
  const add = (item: Record<string, string>) => { const full = { id: id(), ...item } as unknown as ContentItem; content.push(full); return full.id; };
  const designed = (section: OldSection) => section.block?.version === 2 && section.block.mode === "section" && section.block.root;

  old.sections.forEach((section, index) => {
    const slots: Record<string, string[]> = { heading: [], text: [], items: [], questions: [], pictures: [], actions: [] };
    const put = (slot: string, contentId: string) => slots[slot]!.push(contentId);
    const picture = (frame: string, visual?: Visual) => {
      const contentId = add({ type: "picture", shows: visual?.brief || visual?.purpose || section.heading, alt: visual?.altIntent || section.heading });
      pictures.push({ frame, contentId });
      put("pictures", contentId);
    };
    let imageCount = 0;
    const walk = (node: Node, inItem = false) => {
      if (node.kind === "heading") {
        if ((node.level ?? 2) <= 2 && !slots.heading!.length) put("heading", add({ type: "heading", text: node.text ?? "" }));
        else if (!inItem) put("items", add({ type: "item", title: node.text ?? "", text: "" }));
        return;
      }
      if (node.kind === "group") {
        // A group that opens with a small heading reads as one item: its title and the words under it.
        const [first, ...rest] = node.children;
        if (first?.kind === "heading" && (first.level ?? 2) >= 3 && rest.every(child => ["paragraph", "list", "quote"].includes(child.kind))) {
          const text = rest.flatMap(child => child.kind === "list" ? [child.text ?? "", ...child.items.map(item => "• " + item)] : [child.text ?? ""]).filter(Boolean).join("\n\n");
          put("items", add({ type: "item", title: first.text ?? "", text }));
          return;
        }
        node.children.forEach(child => walk(child, inItem));
        return;
      }
      if (node.kind === "paragraph" || node.kind === "quote") { if (node.text) put("text", add({ type: "text", text: node.text })); return; }
      if (node.kind === "list") {
        // A list's own lead-in line comes first, as text.
        if (node.text) put("text", add({ type: "text", text: node.text }));
        node.items.forEach(item => put("items", add({ type: "item", title: "", text: item })));
        return;
      }
      if (node.kind === "details") {
        put("questions", add({ type: "question", question: node.text ?? "", answer: node.children.map(child => child.text ?? child.items.join("\n")).filter(Boolean).join("\n\n") }));
        return;
      }
      if (node.kind === "placeholder") { put("items", add({ type: "placeholder", need: (node.reference ?? "need-detail").replace(/^need-/u, "").replace(/-/gu, " "), text: node.text ?? "" })); return; }
      if (node.kind === "image") {
        const extra = /^section-\d+-(\d+)$/u.exec(node.reference ?? "")?.[1];
        const visual = extra ? section.moreVisuals?.[Number(extra) - 1] : section.visual;
        if (visual && visual.status !== "text-only") { picture(extra ? `${section.id}#${extra}` : section.id ?? "", visual); imageCount++; }
        return;
      }
      if (node.kind === "action") {
        const action = old.actions?.[Number(/^action-(\d+)$/u.exec(node.reference ?? "")?.[1] ?? NaN)];
        if (action?.destination) put("actions", add({ type: "action", label: action.label, page: action.destination }));
      }
    };
    if (designed(section)) walk(section.block!.root!);
    else {
      put("heading", add({ type: "heading", text: section.heading }));
      for (const part of paragraphs(section.body)) put("text", add({ type: "text", text: part }));
      for (const group of section.block?.groups ?? []) {
        const text = [...paragraphs(group.body), ...group.items.map(item => "• " + item)].join("\n\n");
        put("items", add({ type: "item", title: group.heading, text }));
      }
      for (const [n2, action] of (old.actions ?? []).entries()) if (action.sectionIndex === index && action.destination) {
        void n2; put("actions", add({ type: "action", label: action.label, page: action.destination }));
      }
    }
    if (!imageCount && section.visual && section.visual.status !== "text-only") picture(section.id ?? "", section.visual);
    // Further pictures the section asked for but didn't place were shown after its content; they come along too.
    section.moreVisuals?.forEach((visual, n) => {
      const frame = `${section.id}#${n + 1}`;
      if (visual.status !== "text-only" && !pictures.some(entry => entry.frame === frame)) picture(frame, visual);
    });
    if (!slots.heading!.length) put("heading", add({ type: "heading", text: section.heading }));
    // The component nearest to what the section held.
    const first = index === 0;
    const component: ComponentName = first ? "opening" : slots.questions!.length ? "questions" : slots.items!.length >= 2 ? (section.role === "cta" ? "points" : "points")
      : section.role === "cta" && slots.actions!.length ? "call" : slots.pictures!.length ? "text-picture" : "text";
    if (component === "text" || component === "text-picture" || component === "call") {
      // A single item's words join the text, so nothing is left out of the layout.
      for (const itemId of slots.items!) {
        const item = content.find(entry => entry.id === itemId)!;
        if (item.type === "item") { const textId = add({ type: "text", text: [item.title, item.text].filter(Boolean).join("\n\n") }); put("text", textId);
          content.splice(content.indexOf(item), 1); }
        else put("text", add({ type: "text", text: "" }));
      }
      slots.items = [];
      if (!slots.text!.length) put("text", add({ type: "text", text: section.heading }));
    }
    const band: Band = first ? "contrast" : section.role === "cta" ? "brand" : index % 2 ? "tonal" : "light";
    const picturesFor = (name: ComponentName): Record<string, string[]> => name === "opening" || name === "text-picture" ? { picture: slots.pictures!.slice(0, 1) } : {};
    const sectionSlots: Record<string, string[]> = { heading: slots.heading!.slice(0, 1), text: slots.text!, ...picturesFor(component),
      ...(component === "points" ? { items: slots.items! } : {}), ...(component === "questions" ? { questions: slots.questions!, } : {}),
      ...(slots.actions!.length ? { actions: slots.actions! } : {}) };
    layout.push({ id: `s${index + 1}`, component, variant: null, band, slots: Object.fromEntries(Object.entries(sectionSlots).filter(([, ids]) => ids.length)) });
    // Pictures beyond the first in a section get a gallery right after it, so none is lost.
    const more = slots.pictures!.slice(component === "opening" || component === "text-picture" ? 1 : 0);
    if (more.length) layout.push({ id: `s${index + 1}g`, component: "gallery", variant: null, band, slots: { pictures: more } });
    // Items in a section that became questions stay too.
    if (component === "questions" && slots.items!.length) layout.push({ id: `s${index + 1}p`, component: "points", variant: null, band, slots: { items: slots.items! } });
  });
  const page: SitePage & { sourceIds: string[] } = { path: old.path, title: old.heading, menuLabel, searchTitle: old.searchTitle ?? old.heading,
    searchDescription: old.searchDescription ?? old.heading, sourceIds, content: content.filter(item => item.type !== "text" || item.text.trim()), layout };
  // Text items emptied above are dropped from the content and the layout alike.
  const kept = new Set(page.content.map(item => item.id));
  page.layout = page.layout.map(section => ({ ...section, slots: Object.fromEntries(Object.entries(section.slots).map(([slot, ids]) => [slot, ids.filter(i => kept.has(i))])) }));
  return { page, pictures, problems: checkPage(page, []).problems.filter(problem => !/isn't a page of the site/u.test(problem)) };
}
