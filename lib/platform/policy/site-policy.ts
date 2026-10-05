import { object } from "../site-globals/model";

// A capability flag, not business truth or CSS. Only trusted service settings
// grant override permission. Unknown settings never enter the resolved contract.
export function resolveSitePolicy(service: unknown = {}, presence: unknown = {}, site: unknown = {}) {
  const rule = object(object(service).socialLinksEnabled);
  let socialLinksEnabled = typeof rule.value === "boolean" ? rule.value : true;
  const presenceValue = object(presence).socialLinksEnabled, siteValue = object(site).socialLinksEnabled;
  if (rule.allowPresenceOverride === true && typeof presenceValue === "boolean") socialLinksEnabled = presenceValue;
  if (rule.allowSiteOverride === true && typeof siteValue === "boolean") socialLinksEnabled = siteValue;
  return { socialLinksEnabled };
}

export function servicePolicyFromEnvironment(value: string | undefined): unknown {
  if (!value) return {};
  try { return object(JSON.parse(value)); } catch { return {}; }
}

// Operational default, not schema semantics. Hard bounds prevent unbounded retention.
export function contactRetentionDays(service: unknown, presence: unknown, site: unknown): number {
  const rule = object(object(service).contactRetentionDays);
  const valid = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 365;
  let days = valid(rule.value) ? rule.value : 30;
  const p = object(presence).contactRetentionDays, s = object(site).contactRetentionDays;
  if (rule.allowPresenceOverride === true && valid(p)) days = p;
  if (rule.allowSiteOverride === true && valid(s)) days = s;
  return days;
}

export const motionLevels = ["off", "minimal", "light"] as const;
export type MotionLevel = typeof motionLevels[number];
export const visualPreferenceKeys = ["density", "hero", "image", "elevation", "motion", "backdrop"] as const;
export type VisualPreferenceKey = typeof visualPreferenceKeys[number];

// Only trusted service policy grants preference permissions. Scoped values cannot
// expand that list. Visual settings are capabilities/ceilings, never CSS input.
export function resolveVisualPolicy(service: unknown = {}, presence: unknown = {}, site: unknown = {}) {
  function layered<T>(key: string, fallback: T, valid: (v: unknown) => v is T): T {
    const rule = object(object(service)[key]);
    let value = valid(rule.value) ? rule.value : fallback;
    const p = object(presence)[key], s = object(site)[key];
    if (rule.allowPresenceOverride === true && valid(p)) value = p;
    if (rule.allowSiteOverride === true && valid(s)) value = s;
    return value;
  }
  const allowed = object(service).visualPreferences;
  return {
    maxMotion: layered<MotionLevel>("visualMaxMotion", "minimal", (v): v is MotionLevel => motionLevels.includes(v as MotionLevel)),
    decoration: layered("visualDecoration", true, (v): v is boolean => typeof v === "boolean"),
    translucency: layered("visualTranslucency", false, (v): v is boolean => typeof v === "boolean"),
    allowedPreferences: Array.isArray(allowed)
      ? visualPreferenceKeys.filter(key => allowed.includes(key))
      : ["density", "hero", "motion"] as readonly VisualPreferenceKey[],
  };
}
