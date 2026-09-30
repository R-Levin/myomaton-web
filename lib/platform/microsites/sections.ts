import { actionId, normalizeDestination } from "../actions/model";

export type SectionContent = { heading?: string; text?: string; actionId?: string };
export type SectionPresentation = {
  anchor?: string;
  width: "reading" | "standard" | "wide";
  spacing: "compact" | "normal" | "spacious";
  alignment: "left" | "center";
  surface: "default" | "subtle" | "accent";
  divider: "none" | "rule" | "spacing";
  mediaFit: "natural" | "contain" | "cover";
};
export type NormalizedSection = { configuration: SectionPresentation } & (
  | { type: "hero"; variant: "default"; content: SectionContent & { eyebrow?: string } }
  | { type: "intro"; variant: "stack" | "split-text-first" | "split-image-first"; content: SectionContent }
  | { type: "cta"; variant: "default"; content: SectionContent }
);

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function choice<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

// Read-time projection only: discard unsupported fields, never rewrite canonical JSON.
export function normalizeSection(value: unknown): NormalizedSection | null {
  const section = record(value);
  const type = section.type;
  if (type !== "hero" && type !== "intro" && type !== "cta") return null;
  const input = record(section.content);
  const config = record(section.configuration);
  const content: SectionContent & { eyebrow?: string } = {};
  for (const key of ["heading", "text"] as const) {
    if (typeof input[key] === "string") content[key] = input[key];
  }
  if (type === "hero" && typeof input.eyebrow === "string") content.eyebrow = input.eyebrow;
  const id = actionId(input.actionId);
  if (id) content.actionId = id;
  const anchor = typeof config.anchor === "string" ? normalizeDestination("section", `#${config.anchor}`)?.slice(1) : undefined;
  const configuration: SectionPresentation = {
    ...(anchor ? { anchor } : {}),
    width: choice(config.width, ["reading", "standard", "wide"], "standard"),
    spacing: choice(config.spacing, ["compact", "normal", "spacious"], "normal"),
    alignment: choice(config.alignment, ["left", "center"], "left"),
    surface: choice(config.surface, ["default", "subtle", "accent"], type === "cta" ? "subtle" : "default"),
    divider: choice(config.divider, ["none", "rule", "spacing"], "rule"),
    mediaFit: type === "intro" ? choice(config.mediaFit, ["natural", "contain", "cover"], "natural") : "natural",
  };
  return type === "intro"
    ? { type, variant: choice(section.variant, ["stack", "split-text-first", "split-image-first"], "stack"), content, configuration }
    : { type, variant: "default", content, configuration };
}
