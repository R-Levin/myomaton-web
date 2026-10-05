import type { CSSProperties } from "react";

import { resolveDesignConfiguration } from "../../lib/platform/design-systems/configuration";

const fonts = {
  sans: 'var(--font-geist-sans), system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'var(--font-geist-mono), ui-monospace, monospace',
};

export function designTokens(configuration: unknown): CSSProperties {
  const { typography, colors, spacing, shape } = resolveDesignConfiguration(configuration);
  const tokens: CSSProperties & Record<`--design-${string}`, string | number> = {
    "--design-body-font": fonts[typography.bodyFont],
    "--design-heading-font": fonts[typography.headingFont],
    "--design-base-size": `${typography.baseSize}px`,
    "--design-heading-size": `${typography.baseSize * typography.headingScale}px`,
    "--design-line-height": typography.lineHeight,
    "--design-background": colors.background,
    "--design-surface": colors.surface,
    "--design-text": colors.text,
    "--design-muted": colors.muted,
    "--design-accent": colors.accent,
    "--design-on-accent": colors.onAccent,
    "--design-border": colors.border,
    "--design-space": `${spacing.unit}px`,
    "--design-section-space": `${spacing.section}px`,
    "--design-radius": `${shape.radius}px`,
  };
  if (colors.secondaryAccent) {
    tokens["--design-secondary-accent"] = colors.secondaryAccent;
    tokens["--design-on-secondary-accent"] = colors.onSecondaryAccent!;
  }
  return tokens;
}
