import { object } from "../site-globals/model";
import { motionLevels, resolveVisualPolicy, type MotionLevel } from "../policy/site-policy";
import type { SectionPresentation } from "../managed-sites/sections";

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
export type VisualDirection = Profile & { profileId: string; profileVersion: 1 };
export type VisualResolution = { direction: VisualDirection | null; reason: "missing" | "invalid" | "unsupported" | "resolved" };
const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);

// All-or-nothing validation. No partially applied malformed preference object.
export function resolveVisualDirection(configuration: unknown, policy = resolveVisualPolicy()): VisualResolution {
  const input = object(configuration).visualDirection;
  if (input === undefined) return { direction: null, reason: "missing" };
  if (!isObject(input) || Object.keys(input).some(k => !["profileId", "profileVersion", "preferences"].includes(k))) return { direction: null, reason: "invalid" };
  const profile = typeof input.profileId === "string" && Object.hasOwn(profiles, input.profileId) ? profiles[input.profileId] : null;
  if (!profile || input.profileVersion !== 1) return { direction: null, reason: "unsupported" };
  const prefs = input.preferences === undefined ? {} : input.preferences;
  if (!isObject(prefs) || Object.entries(prefs).some(([key, value]) => !Object.hasOwn(choices, key) || !(choices[key as keyof Choices] as readonly unknown[]).includes(value))) return { direction: null, reason: "invalid" };
  const permitted = Object.fromEntries(Object.entries(prefs).filter(([key]) => policy.allowedPreferences.includes(key as keyof Choices)));
  const result = { ...profile, ...permitted } as Profile;
  result.motion = motionLevels[Math.min(motionLevels.indexOf(result.motion), motionLevels.indexOf(policy.maxMotion))];
  if (!policy.translucency) result.backdrop = "opaque";
  return { direction: { ...result, profileId: input.profileId as string, profileVersion: 1 }, reason: "resolved" };
}

export function sectionPresentation(defaults: SectionPresentation, raw: unknown, type: string, index: number, direction?: VisualDirection | null): SectionPresentation {
  if (!direction) return defaults;
  const explicit = object(raw);
  const next = { ...defaults };
  // Presence, even when invalid, conservatively retains the normalizer's fallback.
  if (!Object.hasOwn(explicit, "surface")) next.surface = direction.rhythm === "alternating" && index % 2 === 1 ? "subtle" : defaults.surface;
  if (!Object.hasOwn(explicit, "divider")) next.divider = "none";
  if (!Object.hasOwn(explicit, "spacing") && direction.density === "airy") next.spacing = "spacious";
  if (type === "hero") {
    if (!Object.hasOwn(explicit, "alignment") && direction.hero === "statement") next.alignment = "center";
    if (!Object.hasOwn(explicit, "width")) next.width = direction.hero === "editorial" ? "reading" : "wide";
  }
  return next;
}

// Whole-Page allocation, never one budget per Section/card. Only supported,
// populated Hero/CTA consumers qualify. Delays serialize the short CSS effects.
export function allocateMotion(sections: readonly { id: string; type: string; content: unknown }[], level: MotionLevel): Map<string, number> {
  const cap = { off: 0, minimal: 1, light: 3 }[level];
  const eligible = sections.filter(s => ["hero", "cta"].includes(s.type) && typeof object(s.content).heading === "string" && String(object(s.content).heading).trim());
  const priority = [...eligible.filter(s => s.type === "hero"), ...eligible.filter(s => s.type !== "hero")];
  return new Map([...new Set(priority.map(s => s.id))].slice(0, cap).map((id, index) => [id, index]));
}
