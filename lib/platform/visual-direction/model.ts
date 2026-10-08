import { object } from "../site-globals/model";
import { motionLevels, resolveVisualPolicy, type MotionLevel } from "../policy/site-policy";
import type { SectionPresentation } from "../managed-sites/sections";
import type { NormalizedSection } from "../managed-sites/sections";
import { resolveGrammar, grammarPresentation, type VisualGrammar } from "./grammar";
import { readDirection, type Selection } from "../presentation/plan";

const choices = {
  density: ["comfortable", "airy"], hero: ["editorial", "graphic", "statement"],
  image: ["plain", "framed", "elevated", "bordered"], elevation: ["none", "subtle", "prominent"],
  motion: motionLevels, backdrop: ["opaque", "translucent"],
} as const;
type Choices = { -readonly [K in keyof typeof choices]: typeof choices[K][number] };
type Profile = Choices & { rhythm: "quiet" | "alternating"; typography: "balanced" | "confident"; icons: "none" | "functional" | "selective" };
const profiles: Record<string, Readonly<Profile>> = {
  editorial: { density: "comfortable", hero: "editorial", image: "plain", elevation: "none", motion: "off", backdrop: "opaque", rhythm: "quiet", typography: "balanced", icons: "functional" },
  reference: { density: "airy", hero: "graphic", image: "framed", elevation: "subtle", motion: "light", backdrop: "opaque", rhythm: "alternating", typography: "confident", icons: "functional" },
};
export type VisualDirection = Profile & { profileId: string; profileVersion: 1 | 2; decoration: boolean; grammar?: VisualGrammar };
export type VisualResolution = { direction: VisualDirection | null; presentation?: Selection; reason: "missing" | "invalid" | "unsupported" | "resolved" };
const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);

// All-or-nothing validation. No partially applied malformed preference object.
export function resolveVisualDirection(configuration: unknown, policy = resolveVisualPolicy()): VisualResolution {
  const input = object(configuration).visualDirection;
  if (Object.hasOwn(object(input), "contractVersion")) {
    const presentation = readDirection(input, policy);
    return { direction: null, presentation, reason: presentation.grammar === "basic" ? "unsupported" : "resolved" };
  }
  if (input === undefined) return { direction: null, reason: "missing" };
  if (!isObject(input) || Object.keys(input).some(k => !["profileId", "profileVersion", "preferences", "grammar"].includes(k))) return { direction: null, reason: "invalid" };
  if (Object.hasOwn(input, "grammar")) {
    // One authority: choose either a legacy profile or a grammar, never both.
    if (Object.hasOwn(input, "profileId") || Object.hasOwn(input, "profileVersion")) return { direction: null, reason: "invalid" };
    const grammar = resolveGrammar(input.grammar);
    if (!grammar) return { direction: null, reason: "unsupported" };
    const prefs = input.preferences === undefined ? {} : input.preferences;
    if (!isObject(prefs) || Object.entries(prefs).some(([key, value]) => !["density", "motion", "image", "elevation", "backdrop"].includes(key)
      || !(choices[key as keyof Choices] as readonly unknown[]).includes(value))) return { direction: null, reason: "invalid" };
    const permitted = Object.fromEntries(Object.entries(prefs).filter(([key]) => policy.allowedPreferences.includes(key as keyof Choices)));
    const result = { ...profiles.editorial, ...permitted } as Profile;
    result.motion = motionLevels[Math.min(motionLevels.indexOf(result.motion), motionLevels.indexOf(policy.maxMotion))];
    if (!policy.translucency) result.backdrop = "opaque";
    return { direction: { ...result, profileId: "editorial", profileVersion: 1, grammar, decoration: false }, reason: "resolved" };
  }
  const profile = typeof input.profileId === "string" && Object.hasOwn(profiles, input.profileId) ? profiles[input.profileId] : null;
  if (!profile || !(input.profileVersion === 1 || (input.profileId === "reference" && input.profileVersion === 2))) return { direction: null, reason: "unsupported" };
  const prefs = input.preferences === undefined ? {} : input.preferences;
  if (!isObject(prefs) || Object.entries(prefs).some(([key, value]) => !Object.hasOwn(choices, key) || !(choices[key as keyof Choices] as readonly unknown[]).includes(value))) return { direction: null, reason: "invalid" };
  const permitted = Object.fromEntries(Object.entries(prefs).filter(([key]) => policy.allowedPreferences.includes(key as keyof Choices)));
  const result = { ...profile, ...permitted } as Profile;
  result.motion = motionLevels[Math.min(motionLevels.indexOf(result.motion), motionLevels.indexOf(policy.maxMotion))];
  if (!policy.translucency) result.backdrop = "opaque";
  return { direction: { ...result, profileId: input.profileId as string, profileVersion: input.profileVersion as 1 | 2, decoration: input.profileVersion === 2 && policy.decoration }, reason: "resolved" };
}

export type SectionRole = "hero" | "statement" | "intro" | "image" | "collection" | "cta" | "contact" | "relationship";

// Explicit opt-in only. Readability guard never removes or rewrites copy.
export function sectionRole(section: NormalizedSection, hasImage = false, direction?: VisualDirection | null): SectionRole {
  if (section.type !== "intro") return section.type;
  if (hasImage) return "image";
  const heading = section.content.heading?.trim() ?? "";
  const text = section.content.text?.trim().replace(/\r\n?/g, "\n") ?? "";
  const paragraphs = text.split(/\n(?:[^\S\n]*\n)+/).filter(p => p.trim());
  return (direction?.profileVersion === 2 || direction?.grammar) && section.configuration.treatment === "statement"
    && heading.length > 0 && heading.length <= 120 && heading.split(/\s+/).length <= 18
    && (section.configuration.composition === "statement-break"
      ? text.length <= 900 && paragraphs.length <= 5
      : text.length <= 360 && paragraphs.length <= 2) ? "statement" : "intro";
}

export function sectionPresentation(defaults: SectionPresentation, raw: unknown, type: string, index: number, direction?: VisualDirection | null, role: string = type): SectionPresentation {
  if (!direction) return defaults;
  const explicit = object(raw);
  if (direction.grammar) return grammarPresentation(defaults, explicit, role, direction.density === "airy");
  const next = { ...defaults };
  // Presence, even when invalid, conservatively retains the normalizer's fallback.
  if (!Object.hasOwn(explicit, "surface")) next.surface = direction.profileVersion === 2
    ? role === "cta" ? "accent" : role === "collection" ? "subtle" : "default"
    : direction.rhythm === "alternating" && index % 2 === 1 ? "subtle" : defaults.surface;
  if (!Object.hasOwn(explicit, "divider")) next.divider = "none";
  if (!Object.hasOwn(explicit, "spacing")) {
    if (direction.profileVersion === 2) next.spacing = direction.density === "airy" && ["hero", "statement", "cta"].includes(role) ? "spacious" : "normal";
    else if (direction.density === "airy") next.spacing = "spacious";
  }
  if (direction.profileVersion === 2 && !Object.hasOwn(explicit, "width")) {
    next.width = role === "intro" ? "reading" : ["image", "collection"].includes(role) ? "wide" : "standard";
  }
  if (type === "hero") {
    if (!Object.hasOwn(explicit, "alignment") && direction.hero === "statement") next.alignment = "center";
    if (!Object.hasOwn(explicit, "width")) next.width = direction.hero === "editorial" ? "reading" : "wide";
  }
  return next;
}

// Finite type/role vocabulary. Incompatible explicit choices fall back to the
// ordinary renderer, rather than silently changing alignment or content semantics.
export function sectionComposition(config: SectionPresentation, role: SectionRole, direction?: VisualDirection | null) {
  if ((!direction?.grammar && direction?.profileVersion !== 2) || config.alignment !== "left") return undefined;
  const composition = config.composition;
  if (role === "hero" && composition === "asymmetric-field" && config.width === "wide") return composition;
  if (role === "statement" && composition === "statement-break") return composition;
  if (role === "intro" && composition === "editorial-row" && config.width !== "reading") return composition;
  if (role === "image" && composition === "image-evidence" && config.width !== "reading") return composition;
  if (role === "collection" && composition === "grouped-field") return composition;
  if (role === "cta" && composition === "conversion-band") return composition;
  return undefined;
}

// Whole-Page allocation, never one budget per Section/card. Only supported,
// populated Hero/CTA consumers qualify. Delays serialize the short CSS effects.
export function allocateMotion(sections: readonly { id: string; type: string; content: unknown }[], level: MotionLevel): Map<string, number> {
  const cap = { off: 0, minimal: 1, light: 3 }[level];
  const eligible = sections.filter(s => ["hero", "cta"].includes(s.type) && typeof object(s.content).heading === "string" && String(object(s.content).heading).trim());
  const priority = [...eligible.filter(s => s.type === "hero"), ...eligible.filter(s => s.type !== "hero")];
  return new Map([...new Set(priority.map(s => s.id))].slice(0, cap).map((id, index) => [id, index]));
}

// Compatibility boundary for the retired automatic ornament allocation.
export function allocateDecoration(sections: readonly { id: string; type: string; content: unknown }[], direction?: VisualDirection | null): Map<string, "panel"> {
  // Compatibility API: composition now carries expression. No automatic ornament.
  void sections; void direction;
  return new Map();
}
