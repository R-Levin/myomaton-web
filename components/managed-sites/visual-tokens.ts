import type { CSSProperties } from "react";
import { resolveDesignConfiguration } from "../../lib/platform/design-systems/configuration";
import type { VisualDirection } from "../../lib/platform/visual-direction/model";
import { heroMotion } from "../../lib/platform/visual-direction/motion";

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
function accentWash(accent: string, background: string) {
  return `#${[1, 3, 5].map(i => Math.round(parseInt(accent.slice(i, i + 2), 16) * .12
    + parseInt(background.slice(i, i + 2), 16) * .88).toString(16).padStart(2, "0")).join("")}`;
}
export function visualTokens(configuration: unknown, direction: VisualDirection): CSSProperties {
  const { colors: c, typography: t } = resolveDesignConfiguration(configuration);
  const tokens: Record<`--visual-${string}`, string> = {
    "--visual-page-title": "var(--design-heading-size)",
    "--visual-display": `${direction.profileVersion === 2 ? Math.min(112, Math.max(56, t.baseSize * t.headingScale * 2)) : t.baseSize * t.headingScale * (direction.typography === "confident" ? 1.25 : 1)}px`,
    "--visual-section-heading": `${direction.profileVersion === 2 ? Math.min(40, Math.max(24, t.baseSize * 1.85)) : t.baseSize * (direction.typography === "confident" ? 1.85 : 1.6)}px`,
    "--visual-statement": `${direction.profileVersion === 2 ? Math.min(72, Math.max(40, t.baseSize * t.headingScale * 1.3)) : t.baseSize * t.headingScale * 1.8}px`,
    "--visual-motion-ease": heroMotion.easing,
    "--visual-heading-duration": `${heroMotion.heading.duration}ms`,
    "--visual-heading-travel": `${heroMotion.heading.travel}px`,
    "--visual-heading-mobile-travel": `${heroMotion.heading.mobileTravel}px`,
    "--visual-support-duration": `${heroMotion.support.duration}ms`,
    "--visual-support-travel": `${heroMotion.support.travel}px`,
    "--visual-action-duration": `${heroMotion.action.duration}ms`,
    "--visual-action-travel": `${heroMotion.action.travel}px`,
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
  tokens["--visual-secondary-accent"] = c.secondaryAccent ?? c.accent;
  tokens["--visual-secondary-text"] = readableColor(c.onSecondaryAccent ?? c.onAccent, c.secondaryAccent ?? c.accent);
  const wash = accentWash(c.secondaryAccent ?? c.accent, c.background);
  tokens["--visual-editorial-background"] = wash;
  tokens["--visual-editorial-text"] = readableColor(c.text, wash);
  tokens["--visual-editorial-muted"] = readableColor(c.muted, wash);
  tokens["--visual-editorial-link"] = readableColor(c.accent, wash);
  tokens["--visual-button-text"] = readableColor(c.onAccent, c.accent);
  tokens["--visual-inverse-button-text"] = readableColor(c.accent, tokens["--visual-emphasized-text"]);
  tokens["--visual-contrast-background"] = c.text;
  tokens["--visual-contrast-text"] = readableColor(c.background, c.text);
  tokens["--visual-contrast-button-text"] = readableColor(c.accent, tokens["--visual-contrast-text"]);
  tokens["--visual-contrast-muted"] = readableColor(c.surface, c.text);
  tokens["--visual-contrast-link"] = readableColor(c.background, c.text);
  return tokens as CSSProperties;
}
