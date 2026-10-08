import type { CSSProperties } from "react";
import { resolveDesignConfiguration } from "../design-systems/configuration";
import type { SectionPresentation } from "../managed-sites/sections";

// Grammar is a coordinated, versioned recipe, not a bag of styling preferences.
export type VisualGrammar = { id: "restrained-editorial"; version: 1 };
export function resolveGrammar(input: unknown): VisualGrammar | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  return Object.keys(value).length === 2 && value.id === "restrained-editorial" && value.version === 1
    ? { id: "restrained-editorial", version: 1 } : null;
}

export function grammarPresentation(defaults: SectionPresentation, explicit: Record<string, unknown>, role: string, airy: boolean): SectionPresentation {
  const next = { ...defaults };
  // A present invalid value keeps the legacy normalizer fallback, never inherits.
  if (!Object.hasOwn(explicit, "width")) next.width = role === "intro" && !next.composition ? "reading"
    : next.composition === "asymmetric-field" ? "wide" : "standard";
  if (!Object.hasOwn(explicit, "alignment")) next.alignment = "left";
  if (!Object.hasOwn(explicit, "spacing")) next.spacing = airy ? "spacious" : "normal";
  if (!Object.hasOwn(explicit, "surface")) next.surface = role === "cta" ? "subtle" : "default";
  if (!Object.hasOwn(explicit, "divider")) next.divider = "none";
  return next;
}

export function grammarTokens(configuration: unknown): CSSProperties {
  const { typography: t } = resolveDesignConfiguration(configuration);
  return {
    "--grammar-hero-size": `${Math.min(56, Math.max(40, t.baseSize * t.headingScale * 1.4))}px`,
    "--grammar-heading-size": `${Math.min(28, Math.max(22, t.baseSize * 1.55))}px`,
    "--grammar-prose-measure": "64ch", "--grammar-support-measure": "54ch",
    "--grammar-heading-measure": "24ch",
  } as CSSProperties;
}
