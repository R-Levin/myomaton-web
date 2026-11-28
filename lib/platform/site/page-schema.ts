import { bands, checkPage, componentNames, components, type ContentItem, type Section, type SitePage } from "./components";

/**
 * The shape Core's AI answers in for a page: its content and its layout (docs/rendering-design.md),
 * and the reader that turns an answer into a SitePage. A page's sources are the Knowledge and
 * Evidence its content rests on (what a Publish confirms).
 */
const str = { type: "string" };
const shape = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const kind = (type: string, fields: Record<string, unknown>) => shape({ id: str, type: { type: "string", enum: [type] }, ...fields });

export const contentItemSchema = { anyOf: [
  kind("heading", { text: str }),
  kind("text", { text: { type: "string", description: "One or more paragraphs, separated by a blank line." } }),
  kind("item", { title: str, text: str }),
  kind("question", { question: str, answer: str }),
  kind("picture", { shows: { type: "string", description: "What the picture shows and its job on the page." }, alt: str }),
  kind("action", { label: str, page: { type: "string", description: "The path of one of the site's pages." } }),
  kind("placeholder", { need: { type: "string", description: "The material that's needed, e.g. a customer testimonial." },
    text: { type: "string", description: "What it should say or show, and why it belongs here." } }),
] };

const sectionSchema = shape({
  id: str,
  component: { type: "string", enum: componentNames, description: componentNames.map(name =>
    `${name}: slots ${Object.keys(components[name].slots).join(", ")}; variants ${components[name].variants.join(", ")}`).join(". ") },
  variant: { type: ["string", "null"], description: "One of the component's variants, or null for the site's choice." },
  band: { type: "string", enum: bands, description: "Which of the design's palette pairs the section sits on." },
  slots: { type: "array", items: shape({ slot: str, ids: { type: "array", items: str, description: "Content ids, in order." } }) },
});

export function sitePageSchema(path: string, paths: readonly string[], sourceIds: readonly string[]) {
  return shape({
    path: { type: "string", enum: [path] }, title: str, menuLabel: str, searchTitle: str, searchDescription: str,
    sourceIds: { type: "array", items: sourceIds.length ? { type: "string", enum: [...sourceIds] } : str,
      description: "The knowledge and evidence the page's statements rest on." },
    content: { type: "array", items: contentItemSchema },
    layout: { type: "array", items: sectionSchema },
  }) as Record<string, unknown> & { properties: Record<string, unknown> };
}

export type SitePageWithSources = SitePage & { sourceIds: string[] };

/** Read Core's answer for a page; a layout that doesn't fit its content is refused with the reasons. */
export function readSitePage(value: unknown, path: string, paths: readonly string[], sourceIds: readonly string[]): SitePageWithSources {
  const raw = value as Omit<SitePageWithSources, "layout"> & { layout: (Omit<Section, "slots"> & { slots: { slot: string; ids: string[] }[] | Record<string, string[]> })[] };
  if (!raw || raw.path !== path) throw Error(`Expected the page ${path}`);
  for (const field of ["title", "menuLabel", "searchTitle", "searchDescription"] as const)
    if (typeof raw[field] !== "string" || !raw[field].trim() || /[<>]/u.test(raw[field])) throw Error(`The page's ${field} must be plain words`);
  if (!Array.isArray(raw.content) || !Array.isArray(raw.layout)) throw Error("The page needs its content and its layout");
  for (const item of raw.content as ContentItem[]) for (const [key, text] of Object.entries(item))
    if (key !== "id" && key !== "type" && (typeof text !== "string" || /[<>]/u.test(text))) throw Error(`Content ${item.id}: ${key} must be plain words`);
  const page: SitePageWithSources = {
    path, title: raw.title.trim(), menuLabel: raw.menuLabel.trim(), searchTitle: raw.searchTitle.trim(), searchDescription: raw.searchDescription.trim(),
    sourceIds: [...new Set((raw.sourceIds ?? []).filter(id => sourceIds.includes(id)))],
    content: raw.content,
    layout: raw.layout.map(section => ({ id: section.id, component: section.component, variant: section.variant ?? null, band: section.band,
      slots: Array.isArray(section.slots) ? Object.fromEntries(section.slots.map(entry => [entry.slot, entry.ids])) : section.slots })),
  };
  const { problems } = checkPage(page, paths);
  if (problems.length) throw Error(problems.slice(0, 12).join("; "));
  return page;
}
