import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { logicalId } from "../work-products/pages";
import { currentSite, type PageContent, type ServiceRecord } from "./cycle";

/**
 * Assets (glossary): an image placed in a Page. Core asked for an image in a Section's visual
 * (status asset-needed), which the draft shows as a marked FPO frame (Part 1 #12). Core chooses a
 * real picture for it from a permitted free source (Pixabay; the Principal, Nov 26), and the Asset
 * keeps where it came from and its credit. Delivery places the picture in that exact Section; any
 * frame without one stays a visible FPO frame.
 */
export type Asset = {
  id: string; usageId: string;
  /** The Page and the frame the picture fills: a picture item's frame (pictureFrameId of the page and the item). */
  path: string; sectionId: string;
  /** The kept local copy (inside the project, outside Git) and its fingerprint. */
  file: string; sha256: string; width: number; height: number; alt: string;
  source: { provider: "pixabay"; id: number; pageURL: string; creator: string; query: string };
  chosenAt: string;
};

/** A Section where Core asked for an image and none is placed yet. */
export type PictureFrame = { path: string; sectionId: string; contentId: string; heading: string; purpose: string; brief: string; altIntent: string };

/** A picture item's frame: its own stable identity on the page (delivery places the chosen picture by it). */
export const pictureFrameId = (path: string, contentId: string) => logicalId({ page: path, picture: contentId });

/** Each picture of the current site still waiting for a real picture, with what it must show. */
export function pictureFrames(record: ServiceRecord): PictureFrame[] {
  const site = currentSite(record);
  if (!site) return [];
  return (site.pages as PageContent[]).filter(page => Array.isArray(page.content)).flatMap(page => {
    const headingOf = (id: string) => {
      const section = page.layout.find(entry => Object.values(entry.slots).flat().includes(id));
      const heading = section?.slots.heading?.[0] ? page.content.find(item => item.id === section.slots.heading![0]) : undefined;
      return heading?.type === "heading" ? heading.text : page.title;
    };
    return page.content.flatMap(item => item.type === "picture" ? [{ path: page.path, sectionId: pictureFrameId(page.path, item.id), contentId: item.id,
      heading: headingOf(item.id), purpose: item.shows, brief: item.shows, altIntent: item.alt }] : []);
  });
}

/** Core's search phrase for each frame: a short, literal description of a photograph that could do the frame's job. */
export const pictureQuerySchema = { type: "object", additionalProperties: false, required: ["frames"], properties: { frames: { type: "array", items: {
  type: "object", additionalProperties: false, required: ["sectionId", "query"], properties: {
    sectionId: { type: "string" },
    query: { type: "string", description: "2 to 5 plain words describing a real photograph to search a stock library for, e.g. \"woman reviewing website laptop\". No brand names." } } } } } };

export const pictureQueryInstructions = "You are MioPages Core's designer. Each frame is a place on the business's website where you asked for an image, " +
  "with its purpose and art direction. The site will use real photographs from a free stock library (Pixabay) instead of illustrations or diagrams, " +
  "so for each frame write the search phrase most likely to find a photograph that does the frame's job credibly for this business: real people, " +
  "work settings, documents, screens, conversations, or a clean illustration where that suits the frame better. Avoid phrases that return clichés " +
  "(handshakes, stock smiles, lightbulbs, puzzle pieces). Each frame needs a different picture, so make each phrase specific to its frame.";

/** Core's choice among the candidates for each frame, or none when no candidate is right. */
export const pictureChoiceSchema = { type: "object", additionalProperties: false, required: ["choices"], properties: { choices: { type: "array", items: {
  type: "object", additionalProperties: false, required: ["sectionId", "candidate", "alt", "reason"], properties: {
    sectionId: { type: "string" },
    candidate: { type: ["integer", "null"], description: "The number of the chosen candidate, or null when none is right (the frame stays FPO)." },
    alt: { type: "string", description: "Alt text describing what the chosen photograph shows, for people who cannot see it." },
    reason: { type: "string" } } } } } };

export const pictureChoiceInstructions = "You are MioPages Core's designer choosing photographs for the business's website. For each frame you see its purpose and " +
  "art direction, then numbered candidate photographs. Choose the one that best does the frame's job, fits the site's design and looks credible and " +
  "current. Refuse (null) any candidate with visible logos or brands, legible third-party text, a recognizable public figure, anything implying an " +
  "endorsement, a result or a real client, or an obviously staged cliché. The briefs were written before the pictures came from a stock library, so judge " +
  "each candidate by the frame's purpose rather than the letter of its brief: a credible photograph or illustration that does the job is better " +
  "than an empty frame. Choose null only when the frame truly needs a specific labeled diagram or artifact, or no candidate is acceptable.";

/** The web copy delivery sends for one Asset: WebP within 1600px, its fingerprint and size. */
export async function deliveryCopy(asset: Asset, read: (file: string) => Promise<Buffer>) {
  const master = await read(asset.file);
  if (createHash("sha256").update(master).digest("hex") !== asset.sha256) throw Error("Asset file differs from its record");
  const { data, info } = await sharp(master).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  if (data.length > 2_000_000) throw Error("Asset copy too large");
  return { bytes: data, width: info.width, height: info.height, copyDigest: createHash("sha256").update(data).digest("hex") };
}

/** A new Asset for a chosen picture. */
export function newAsset(input: Omit<Asset, "id" | "usageId">): Asset {
  return { id: randomUUID(), usageId: randomUUID(), ...input };
}

/** The record with these Assets, each replacing any earlier Asset for the same Section. */
export function withAssets(record: ServiceRecord, assets: readonly Asset[]): ServiceRecord {
  const sections = new Set(assets.map(asset => asset.sectionId));
  return { ...record, assets: [...(record.assets ?? []).filter(asset => !sections.has(asset.sectionId)), ...assets] };
}
