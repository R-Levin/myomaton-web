import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { logicalId } from "../work-products/pages";
import { currentSite, type ServiceRecord } from "./cycle";

/**
 * Assets (glossary): an image placed in a Page. Core asked for an image in a Section's visual
 * (status asset-needed), which the draft shows as a marked FPO frame (Part 1 #12). Core chooses a
 * real picture for it from a permitted free source (Pixabay; the Principal, Nov 26), and the Asset
 * keeps where it came from and its credit. Delivery places the picture in that exact Section; any
 * frame without one stays a visible FPO frame.
 */
export type Asset = {
  id: string; usageId: string;
  /** The Page and the frame the picture fills: a Section's own picture (the Section's id) or one of its further
   * pictures (pictureFrameId). A reworked Section with a new identity goes back to its FPO frames. */
  path: string; sectionId: string;
  /** The kept local copy (inside the project, outside Git) and its fingerprint. */
  file: string; sha256: string; width: number; height: number; alt: string;
  source: { provider: "pixabay"; id: number; pageURL: string; creator: string; query: string };
  chosenAt: string;
};

/** A Section where Core asked for an image and none is placed yet. */
export type PictureFrame = { path: string; sectionId: string; heading: string; purpose: string; brief: string; altIntent: string };

const placeable = new Set(["hero", "intro", "relationship", "collection", "cta"]);

/** The frame of a Section's further picture n (counting from 1): its own stable identity. */
export const pictureFrameId = (sectionId: string, n: number) => logicalId({ section: sectionId, picture: n });

type Visual = { purpose: string; brief: string; altIntent: string; status: string };

/** Each frame of the current site where Core asked for an image, with what the image must do. */
export function pictureFrames(record: ServiceRecord): PictureFrame[] {
  const site = currentSite(record);
  if (!site) return [];
  return (site.pages as unknown as { path: string; sections: { id: string; heading: string; role?: string; visual?: Visual; moreVisuals?: Visual[] }[] }[])
    .flatMap(page => page.sections.filter(section => placeable.has(section.role ?? "intro")).flatMap(section =>
      [[section.id, section.visual] as const, ...(section.moreVisuals ?? []).map((visual, n) => [pictureFrameId(section.id, n + 1), visual] as const)]
        .filter(([, visual]) => visual?.status === "asset-needed")
        .map(([sectionId, visual]) => ({ path: page.path, sectionId, heading: section.heading, purpose: visual!.purpose,
          brief: visual!.brief, altIntent: visual!.altIntent }))));
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
