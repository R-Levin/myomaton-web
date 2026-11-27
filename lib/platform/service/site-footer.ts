/**
 * The site's footer, written by Core as part of the Site plan and approved with it (the Principal,
 * Nov 27). Core decides what it holds within the business's facts; its stylesheet designs the look.
 * Design rule 2: these are approved words like any other; facts come only from the Evidence and
 * Knowledge, never invented.
 */
import { text } from "../canonical/model";

export type SiteFooter = { columns: { heading: string | null; text: string | null; links: string[] }[]; note: string | null };

const nullable = (description: string) => ({ type: ["string", "null"], description });

export const siteFooterSchema = {
  type: "object", additionalProperties: false, required: ["columns", "note"],
  description: "The site's footer, on every page: what a visitor looks for at the bottom of a site for this business (for example a short line on " +
    "what the business does, how to reach it, the pages that matter most, legal pages). You decide what it holds and how many columns. Use only " +
    "facts in the Evidence and Knowledge, exactly as given: never invent an address, phone number, email, registration or award; leave out what is " +
    "not supplied. Keep it short.",
  properties: {
    columns: { type: "array", items: { type: "object", additionalProperties: false, required: ["heading", "text", "links"], properties: {
      heading: nullable("A short heading, or null."),
      text: nullable("A few plain lines (contact details, a one-line description), or null."),
      links: { type: "array", items: { type: "string" }, description: "Paths of pages in pages to link here, in order." },
    } } },
    note: nullable("One closing line, such as a copyright notice with the business's name, or null."),
  },
};

const line = (value: unknown, max: number) => value === null || (typeof value === "string" && !value.trim()) ? null : text(value, max, true).trim();

/** Check Core's footer: plain text, links only to the plan's own pages. */
export function readSiteFooter(value: unknown, paths: readonly string[]): SiteFooter {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Expected the footer");
  const footer = value as Record<string, unknown>;
  if (Object.keys(footer).some(key => !["columns", "note"].includes(key)) || !Array.isArray(footer.columns))
    throw Error("Footer refused");
  const columns = footer.columns.map(raw => {
    const column = raw as Record<string, unknown>;
    if (!column || typeof column !== "object" || Object.keys(column).some(key => !["heading", "text", "links"].includes(key)) || !Array.isArray(column.links))
      throw Error("Footer column refused");
    const links = column.links.map(link => {
      if (typeof link !== "string" || !paths.includes(link)) throw Error("Footer links only to pages in the plan");
      return link;
    });
    if (new Set(links).size !== links.length) throw Error("Footer link repeated");
    const result = { heading: line(column.heading ?? null, 120), text: line(column.text ?? null, 1000), links };
    if (!result.heading && !result.text && !links.length) throw Error("Empty footer column");
    return result;
  });
  return { columns, note: line(footer.note ?? null, 300) };
}
