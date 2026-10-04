import type { CSSProperties } from "react";
import { resolveDesignConfiguration } from "../../lib/platform/design-systems/configuration";
import type { VisualDirection } from "../../lib/platform/visual-direction/model";

// Derived semantic roles only; primitive brand values remain Design System-owned.
function luminance(hex: string) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
export function readableColor(preferred: string, background: string) {
  const a = luminance(preferred), b = luminance(background);
  if ((Math.max(a, b) + .05) / (Math.min(a, b) + .05) >= 4.5) return preferred;
  return b > .179 ? "#000000" : "#ffffff";
}
export function visualTokens(configuration: unknown, direction: VisualDirection): CSSProperties {
  const { colors: c, typography: t } = resolveDesignConfiguration(configuration);
  const tokens: Record<`--visual-${string}`, string> = {
    "--visual-page-title": "var(--design-heading-size)",
    "--visual-display": `${t.baseSize * t.headingScale * (direction.typography === "confident" ? 1.25 : 1)}px`,
    "--visual-section-heading": `${t.baseSize * (direction.typography === "confident" ? 1.85 : 1.6)}px`,
    "--visual-body": "var(--design-base-size)", "--visual-meta": ".875em",
    "--visual-label": "1em", "--visual-help": ".875em", "--visual-error": "1em",
    "--visual-shadow-none": "none",
    "--visual-shadow-subtle": "0 2px 8px rgb(0 0 0 / 0.10)",
    "--visual-shadow-prominent": "0 6px 20px rgb(0 0 0 / 0.16)",
    "--visual-blur": "8px",
  };
  for (const [role, background] of Object.entries({ base: c.background, alternate: c.surface, emphasized: c.accent })) {
    tokens[`--visual-${role}-background`] = background;
    tokens[`--visual-${role}-text`] = readableColor(role === "emphasized" ? c.onAccent : c.text, background);
    tokens[`--visual-${role}-muted`] = readableColor(role === "emphasized" ? c.onAccent : c.muted, background);
    tokens[`--visual-${role}-link`] = readableColor(role === "emphasized" ? c.onAccent : c.accent, background);
  }
  tokens["--visual-button-text"] = readableColor(c.onAccent, c.accent);
  return tokens as CSSProperties;
}
