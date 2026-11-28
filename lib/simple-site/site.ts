/**
 * The simplified site (Principal, Nov 28): a site is pages; a page is sections in order. Each
 * section keeps its layout and its words apart, so either can change without touching the other.
 */
export type Kind = "opening" | "text" | "points" | "call";
export type Tone = "light" | "tint" | "dark";
export type Item = { title: string; text: string };
export type Words = { heading: string; text: string; items: Item[]; button: { label: string; page: string } | null };
export type Section = { id: string; layout: { kind: Kind; tone: Tone }; words: Words };
export type Page = { path: string; menuLabel: string; title: string; sections: Section[] };
export type Site = { business: string; footer: string; pages: Page[] };

const kinds: Kind[] = ["opening", "text", "points", "call"], tones: Tone[] = ["light", "tint", "dark"];
const str = { type: "string" };
const object = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });

/** The shape the AI answers in. */
export const siteSchema = object({
  business: str, footer: str,
  pages: { type: "array", items: object({
    path: { type: "string", description: "The page's address, starting with /; Home is /." }, menuLabel: str, title: str,
    sections: { type: "array", items: object({
      layout: object({ kind: { type: "string", enum: kinds }, tone: { type: "string", enum: tones } }),
      words: object({ heading: str, text: str, items: { type: "array", items: object({ title: str, text: str }) },
        button: { anyOf: [object({ label: str, page: { type: "string", description: "The path of one of the site's pages." } }), { type: "null" }] } }),
    }) },
  }) },
});

/** Read the AI's answer into a Site, giving each section a stable id. */
export function readSite(value: unknown): Site {
  const site = value as Site;
  if (!site || !Array.isArray(site.pages) || !site.pages.length) throw Error("The answer has no pages");
  const paths = new Set(site.pages.map(page => page.path));
  if (!paths.has("/")) throw Error("The site has no Home page (/)");
  site.pages.forEach((page, p) => {
    if (!Array.isArray(page.sections) || !page.sections.length) throw Error(`Page ${page.path} has no sections`);
    page.sections.forEach((section, s) => {
      if (!kinds.includes(section.layout?.kind) || !tones.includes(section.layout?.tone)) throw Error(`Page ${page.path}, section ${s + 1}: unknown layout`);
      section.id = `p${p + 1}s${s + 1}`;
      if (section.words.button && !paths.has(section.words.button.page)) section.words.button = null;
    });
  });
  return site;
}
