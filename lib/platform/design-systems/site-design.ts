/**
 * The site design Core's AI chooses for each business (rebuild step 2, 2026-11-22).
 *
 * The AI decides palette, type, shape, density and imagery as part of the Presence
 * Direction. Nothing here is a house style: the only rules are readable contrast
 * (accessibility) and a curated set of self-hosted, open-licence fonts (licensing and
 * page performance). Where contrast falls short, Core repairs the colour minimally and
 * records the adjustment, rather than discarding the AI's design.
 */
import { contrast, luminance } from "../presentation/tokens";

/** Self-hosted in the WordPress theme (wordpress/miopages-managed-site/fonts), SIL OFL 1.1. */
export const siteFonts = {
  "inter": { label: "Inter", category: "sans" },
  "manrope": { label: "Manrope", category: "sans" },
  "dm-sans": { label: "DM Sans", category: "sans" },
  "work-sans": { label: "Work Sans", category: "sans" },
  "space-grotesk": { label: "Space Grotesk", category: "sans" },
  "plus-jakarta-sans": { label: "Plus Jakarta Sans", category: "sans" },
  "source-sans-3": { label: "Source Sans 3", category: "sans" },
  "fraunces": { label: "Fraunces", category: "serif" },
  "source-serif-4": { label: "Source Serif 4", category: "serif" },
  "lora": { label: "Lora", category: "serif" },
  "playfair-display": { label: "Playfair Display", category: "serif" },
  "newsreader": { label: "Newsreader", category: "serif" },
  "jetbrains-mono": { label: "JetBrains Mono", category: "mono" },
} as const;
export type SiteFont = keyof typeof siteFonts;
const fontIds = Object.keys(siteFonts) as SiteFont[];

/** Colour roles the theme paints. light = main page; brand = primary accent surface and
 * link colour; strong/tonal/supporting = alternative section surfaces; contrast = the
 * boldest band (e.g. dark). Each role pairs a background with its text colour. */
export const paletteRoles = ["light", "strong", "tonal", "brand", "supporting", "contrast"] as const;
export const radii = ["square", "soft", "round"] as const;
export const densities = ["compact", "balanced", "airy"] as const;
export const imageryStyles = ["photography", "illustration", "diagram", "mixed"] as const;

const hex = { type: "string", pattern: "^#[0-9a-fA-F]{6}$" };
const pair = { type: "object", additionalProperties: false, required: ["background", "text"],
  properties: { background: hex, text: hex } };
const shape = <P extends Record<string, unknown>>(properties: P) => ({ type: "object", properties,
  required: Object.keys(properties), additionalProperties: false });

/** Wire schema for the AI. Descriptions explain each choice's effect. */
export const siteDesignSchema = shape({
  palette: shape({
    ...Object.fromEntries(paletteRoles.map(role => [role, pair])) as Record<typeof paletteRoles[number], typeof pair>,
    border: hex, muted: hex,
  }),
  typography: shape({
    headingFamily: { type: "string", enum: fontIds },
    bodyFamily: { type: "string", enum: fontIds },
    baseSize: { type: "number", minimum: 15, maximum: 20, description: "Body text size in pixels." },
    headingScale: { type: "number", minimum: 1.6, maximum: 3.4, description: "Largest heading size as a multiple of body size." },
    lineHeight: { type: "number", minimum: 1.35, maximum: 1.85 },
    headingWeight: { type: "integer", enum: [400, 500, 600, 700, 800] },
  }),
  shape: { type: "string", enum: radii, description: "Corner style for cards, images and buttons." },
  density: { type: "string", enum: densities, description: "Overall spacing between and within sections." },
  imagery: shape({ style: { type: "string", enum: imageryStyles }, direction: { type: "string",
    description: "Art direction every image brief should follow." } }),
  rationale: { type: "string", description: "Why this design fits the business and how the research shaped it." },
  sourceIds: { type: "array", items: { type: "string" } },
});

export type SiteDesign = {
  palette: Record<typeof paletteRoles[number], { background: string; text: string }> & { border: string; muted: string };
  typography: { headingFamily: SiteFont; bodyFamily: SiteFont; baseSize: number; headingScale: number; lineHeight: number; headingWeight: number };
  shape: typeof radii[number];
  density: typeof densities[number];
  imagery: { style: typeof imageryStyles[number]; direction: string };
  rationale: string;
  sourceIds: string[];
  /** Accessibility repairs Core made to the AI's colours, for transparency. */
  adjustments: string[];
};

const minimumContrast = 4.5;

function record(value: unknown, keys: readonly string[], label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error(label + " must be an object");
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => !keys.includes(key)) || keys.some(key => !(key in row))) throw Error(label + " fields refused");
  return row;
}
function colour(value: unknown, label: string) {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/iu.test(value)) throw Error(label + " must be a #rrggbb colour");
  return value.toLowerCase();
}
function choice<T extends string>(value: unknown, options: readonly T[], label: string): T {
  if (typeof value !== "string" || !options.includes(value as T)) throw Error(label + " refused");
  return value as T;
}
function number(value: unknown, min: number, max: number, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw Error(label + " out of range");
  return value;
}
function prose(value: unknown, label: string, max = 2_000) {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[<>]/u.test(value)) throw Error(label + " refused");
  return value.trim();
}

/** Move a colour toward black or white in small steps until it reaches the needed
 * contrast against every given background. Returns null if no step works. */
function repair(colourValue: string, backgrounds: string[]): string | null {
  const ok = (value: string) => backgrounds.every(background => contrast(value, background) >= minimumContrast);
  if (ok(colourValue)) return colourValue;
  const towardBlack = backgrounds.every(background => luminance(background) > 0.179);
  const target = towardBlack ? 0 : 255;
  const channels = [1, 3, 5].map(i => parseInt(colourValue.slice(i, i + 2), 16));
  for (let step = 1; step <= 20; step++) {
    const mixed = "#" + channels.map(c => Math.round(c + (target - c) * step / 20).toString(16).padStart(2, "0")).join("");
    if (ok(mixed)) return mixed;
  }
  return null;
}

export function readSiteDesign(value: unknown, sourceIds: readonly string[]): SiteDesign {
  const row = record(value, ["palette", "typography", "shape", "density", "imagery", "rationale", "sourceIds"], "Site design");
  const adjustments: string[] = [];
  const paletteRow = record(row.palette, [...paletteRoles, "border", "muted"], "Palette");
  const chosenText: Record<string, string> = {};
  const palette = Object.fromEntries(paletteRoles.map(role => {
    const pairRow = record(paletteRow[role], ["background", "text"], "Palette " + role);
    const background = colour(pairRow.background, role + " background");
    const chosen = colour(pairRow.text, role + " text");
    chosenText[role] = chosen;
    const text = repair(chosen, [background]);
    if (!text) throw Error("Palette " + role + " text cannot be made readable");
    if (text !== chosen) adjustments.push(`${role} text ${chosen} → ${text} for readable contrast`);
    return [role, { background, text }];
  })) as unknown as SiteDesign["palette"];
  // The brand colour is also the link colour on the main and tonal surfaces.
  const brand = palette.brand.background;
  const link = repair(brand, [palette.light.background, palette.tonal.background]);
  if (!link) throw Error("Brand colour cannot be made readable as a link colour");
  if (link !== brand) {
    adjustments.push(`brand ${brand} → ${link} so links stay readable on light and tonal surfaces`);
    // Re-derive the text on the adjusted brand colour from the AI's own choice.
    palette.brand = { background: link, text: repair(chosenText.brand, [link]) ?? (luminance(link) > 0.179 ? "#000000" : "#ffffff") };
  }
  const mutedChosen = colour(paletteRow.muted, "muted");
  const muted = repair(mutedChosen, [palette.light.background]);
  if (!muted) throw Error("Muted text cannot be made readable");
  if (muted !== mutedChosen) adjustments.push(`muted ${mutedChosen} → ${muted} for readable contrast`);
  palette.border = colour(paletteRow.border, "border");
  palette.muted = muted;

  const type = record(row.typography, ["headingFamily", "bodyFamily", "baseSize", "headingScale", "lineHeight", "headingWeight"], "Typography");
  const headingWeight = number(type.headingWeight, 400, 800, "Heading weight");
  if (headingWeight % 100) throw Error("Heading weight refused");
  const imageryRow = record(row.imagery, ["style", "direction"], "Imagery");
  if (!Array.isArray(row.sourceIds) || row.sourceIds.some(id => typeof id !== "string" || !sourceIds.includes(id))) {
    throw Error("Site design cites an unknown source");
  }
  return {
    palette,
    typography: {
      headingFamily: choice(type.headingFamily, fontIds, "Heading font"),
      bodyFamily: choice(type.bodyFamily, fontIds, "Body font"),
      baseSize: number(type.baseSize, 15, 20, "Base size"),
      headingScale: number(type.headingScale, 1.6, 3.4, "Heading scale"),
      lineHeight: number(type.lineHeight, 1.35, 1.85, "Line height"),
      headingWeight,
    },
    shape: choice(row.shape, radii, "Shape"),
    density: choice(row.density, densities, "Density"),
    imagery: { style: choice(imageryRow.style, imageryStyles, "Imagery style"), direction: prose(imageryRow.direction, "Imagery direction") },
    // Room for the reasons behind every choice and the research that shaped it (Part 1 #10); bounded only as a safeguard.
    rationale: prose(row.rationale, "Design rationale", 16_000),
    sourceIds: [...new Set(row.sourceIds as string[])],
    adjustments,
  };
}

/** Data-only projection the WordPress theme renders (brand projection design version 4). */
export function designProjection(design: SiteDesign) {
  return { grammar: "core-designed" as const, version: 4 as const, motion: "minimal" as const,
    palette: design.palette, typography: design.typography, shape: design.shape, density: design.density };
}
