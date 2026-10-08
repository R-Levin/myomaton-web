import { actionId, normalizeDestination } from "../actions/model";
import { subjectId } from "../subjects/presentation";
import { relationship, valuePoints, type Relationship, type ValuePoint } from "../presentation/content";

export type InlineCollectionItem = { id: string; heading: string; text?: string; actionId?: string };
export type SubjectCollectionItem = { id: string; subjectId: string; actionId?: string };
export type CollectionContent = { heading?: string; text?: string } & (
  | { itemSource: "inline"; items: InlineCollectionItem[] }
  | { itemSource: "subjects"; items: SubjectCollectionItem[] }
);

export type SectionContent = { heading?: string; text?: string; actionId?: string; secondaryActionId?: string };
export type SectionPresentation = {
  presentation?: unknown;
  previewMedia?: unknown;
  treatment?: "statement";
  composition?: "asymmetric-field" | "editorial-row" | "statement-break" | "image-evidence" | "grouped-field" | "conversion-band";
  anchor?: string;
  width: "reading" | "standard" | "wide";
  spacing: "compact" | "normal" | "spacious";
  alignment: "left" | "center";
  surface: "default" | "subtle" | "accent" | "contrast" | "editorial";
  divider: "none" | "rule" | "spacing";
  mediaFit: "natural" | "contain" | "cover";
};
export type NormalizedSection = { configuration: SectionPresentation } & (
  | { type: "hero"; variant: "default"; content: SectionContent & { eyebrow?: string; valuePoints?: ValuePoint[] } }
  | { type: "relationship"; variant: "default"; content: Relationship }
  | { type: "intro"; variant: "stack" | "split-text-first" | "split-image-first"; content: SectionContent }
  | { type: "cta"; variant: "default"; content: SectionContent }
  | { type: "contact"; variant: "default"; content: SectionContent & { contact_definition_id: string } }
  | { type: "collection"; variant: "grid"; content: CollectionContent; configuration: { columns: 2 | 3 } }
);

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function choice<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

function collectionContent(input: Record<string, unknown>): CollectionContent | null {
  if (input.itemSource !== "inline" && input.itemSource !== "subjects") return null;
  const copy = {
    ...(typeof input.heading === "string" ? { heading: input.heading } : {}),
    ...(typeof input.text === "string" ? { text: input.text } : {}),
  };
  const seen = new Set<string>();
  const inline: InlineCollectionItem[] = [];
  const references: SubjectCollectionItem[] = [];
  for (const value of Array.isArray(input.items) ? input.items : []) {
    const item = record(value);
    if (typeof item.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(item.id) || seen.has(item.id)) continue;
    const id = item.id;
    const action = actionId(item.actionId);
    const reference = { id, ...(action ? { actionId: action } : {}) };
    if (input.itemSource === "inline") {
      if (typeof item.heading !== "string" || !item.heading.trim()) continue;
      inline.push({ ...reference, heading: item.heading, ...(typeof item.text === "string" ? { text: item.text } : {}) });
    } else {
      const subject = subjectId(item.subjectId);
      if (!subject) continue;
      references.push({ ...reference, subjectId: subject });
    }
    seen.add(id);
  }
  return input.itemSource === "inline"
    ? { ...copy, itemSource: "inline", items: inline }
    : { ...copy, itemSource: "subjects", items: references };
}

// Read-time projection only: discard unsupported fields, never rewrite canonical JSON.
export function normalizeSection(value: unknown): NormalizedSection | null {
  const section = record(value);
  const type = section.type;
  if (type === "relationship") {
    try {
      const normalized = normalizeSection({ ...section, type: "intro", content: {} });
      return normalized ? { type, variant: "default", content: relationship(section.content), configuration: normalized.configuration } : null;
    } catch { return null; }
  }
  if (type !== "hero" && type !== "intro" && type !== "cta" && type !== "collection" && type !== "contact") return null;
  const input = record(section.content);
  const config = record(section.configuration);
  const content: SectionContent & { eyebrow?: string; valuePoints?: ValuePoint[] } = {};
  for (const key of ["heading", "text"] as const) {
    if (typeof input[key] === "string") content[key] = input[key];
  }
  if (type === "hero" && typeof input.eyebrow === "string") content.eyebrow = input.eyebrow;
  if (type === "hero" && input.valuePoints !== undefined) {
    try { content.valuePoints = valuePoints(input.valuePoints); } catch { /* Scaffold failure falls back without invented points. */ }
  }
  const secondary = type === "hero" ? actionId(input.secondaryActionId) : null;
  if (secondary) content.secondaryActionId = secondary;
  const id = actionId(input.actionId);
  if (id) content.actionId = id;
  const anchor = typeof config.anchor === "string" ? normalizeDestination("section", `#${config.anchor}`)?.slice(1) : undefined;
  const configuration: SectionPresentation = {
    ...(Object.hasOwn(config, "previewMedia") ? { previewMedia: config.previewMedia } : {}),
    ...(Object.hasOwn(config, "presentation") ? { presentation: config.presentation } : {}),
    ...(typeof config.composition === "string" && ({ hero: ["asymmetric-field"], intro: ["editorial-row", "statement-break", "image-evidence"], collection: ["grouped-field"], cta: ["conversion-band"], contact: [] }[type] as readonly string[]).includes(config.composition)
      ? { composition: config.composition as SectionPresentation["composition"] } : {}),
    ...(type === "intro" && config.treatment === "statement" ? { treatment: "statement" as const } : {}),
    ...(anchor ? { anchor } : {}),
    width: choice(config.width, ["reading", "standard", "wide"], "standard"),
    spacing: choice(config.spacing, ["compact", "normal", "spacious"], "normal"),
    alignment: choice(config.alignment, ["left", "center"], "left"),
    surface: choice(config.surface, ["default", "subtle", "accent", "contrast", "editorial"], type === "cta" ? "subtle" : "default"),
    divider: choice(config.divider, ["none", "rule", "spacing"], "rule"),
    mediaFit: type === "intro" ? choice(config.mediaFit, ["natural", "contain", "cover"], "natural") : "natural",
  };
  if (type === "collection") {
    const collection = collectionContent(input);
    return collection ? { type, variant: "grid", content: collection,
      configuration: { ...configuration, columns: config.columns === 3 ? 3 : 2 } } : null;
  }
  if (type === "contact") {
    const definitionId = actionId(input.contact_definition_id);
    return definitionId ? { type, variant: "default", content: { ...content, contact_definition_id: definitionId }, configuration } : null;
  }
  return type === "intro"
    ? { type, variant: choice(section.variant, ["stack", "split-text-first", "split-image-first"], "stack"), content, configuration }
    : { type, variant: "default", content, configuration };
}
