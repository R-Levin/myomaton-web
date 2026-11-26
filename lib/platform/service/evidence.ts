import type { ServiceRecord } from "./cycle";

/**
 * Evidence (service object model): material gathered about an Account that is not itself
 * Knowledge, such as the Client's own documents and standing direction, research and peer
 * observations. Core reads it with the Knowledge; Knowledge stays the Client's current word.
 * Each item keeps its date, so later direction can be told from earlier.
 */
export type Evidence = {
  id: string; label: string; reference: string; date: string | null; content: string;
  /** "client": the Client's own approved word (a document they approved, their recorded direction); "gathered": anything else. */
  standing: "client" | "gathered";
  /** False when it informs Core's understanding but must not appear in site copy. */
  forWebsite: boolean;
  /** Images Core looks at with the text, such as a brand asset or a peer site's screenshots: a file and what it shows. */
  images?: { file: string; caption: string }[];
};

/** Where an Account's documents are, and which sections of each are Evidence. Kept as the Client's data, never in code. */
export type EvidenceSpec = {
  /** The Client's own logo (a PNG among its brand assets), shown wherever their site shows a logo (Part 1 #13). */
  logo?: string;
  documents:{ file: string; id: string; label: string; date: string | null; standing: Evidence["standing"];
  sections: { heading: string; date?: string; forWebsite?: boolean }[] }[];
  /** The Client's own assets, such as their logo: each an Evidence item Core sees as images. */
  assets?: { id: string; label: string; date: string | null; content: string; images?: { file: string; caption: string }[];
    /** The asset's text, from a file (and, for JSON, one field of it), added after `content`. */
    contentFile?: string; contentField?: string; forWebsite?: boolean }[] };

/** The named sections of each document, word for word. A missing or empty section is refused rather than skipped. */
export function evidenceFrom(spec: EvidenceSpec, read: (file: string) => string): Evidence[] {
  const assets = (spec.assets ?? []).map(asset => {
    const from = asset.contentFile ? read(asset.contentFile) : "";
    const text = asset.contentFile && asset.contentField ? JSON.stringify((JSON.parse(from) as Record<string, unknown>)[asset.contentField]) : from;
    if (asset.contentFile && !text) throw Error(`Nothing in ${asset.contentFile}${asset.contentField ? " " + asset.contentField : ""}`);
    return { id: asset.id, label: asset.label, reference: [asset.contentFile, ...(asset.images ?? []).map(image => image.file)].filter(Boolean).join(", "),
      date: asset.date, content: [asset.content, text].filter(Boolean).join("\n\n"), standing: "client" as const, forWebsite: asset.forWebsite ?? false,
      ...(asset.images?.length && { images: asset.images }) };
  });
  return [...spec.documents.flatMap(document => {
    const text = read(document.file).replace(/\r\n/g, "\n");
    return document.sections.map(section => {
      const content = sectionText(text, section.heading);
      if (!content) throw Error(`No section "${section.heading}" in ${document.file}`);
      return { id: `${document.id}:${slug(section.heading)}`, label: `${document.label}: ${section.heading}`, reference: `${document.file} (${section.heading})`,
        date: section.date ?? document.date, content, standing: document.standing, forWebsite: section.forWebsite ?? true };
    });
  }), ...assets];
}

/** The body under a Markdown heading, up to the next heading of the same or a higher level. */
function sectionText(text: string, heading: string) {
  const lines = text.split("\n");
  const start = lines.findIndex(line => /^#{1,6} /u.test(line) && line.replace(/^#{1,6} /u, "").trim() === heading);
  if (start < 0) return "";
  const level = lines[start]!.match(/^#+/u)![0].length;
  const end = lines.findIndex((line, index) => index > start && /^#{1,6} /u.test(line) && line.match(/^#+/u)![0].length <= level);
  return lines.slice(start + 1, end < 0 ? undefined : end).join("\n").trim();
}
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");

/** The record with these Evidence items added, each replacing any earlier item with the same id. */
export function withEvidence(record: ServiceRecord, items: readonly Evidence[]): ServiceRecord {
  const ids = new Set(items.map(item => item.id));
  return { ...record, evidence: [...(record.evidence ?? []).filter(item => !ids.has(item.id)), ...items] };
}
