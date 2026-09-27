export type FontFamily = "sans" | "serif" | "mono";

export type DesignConfiguration = {
  typography: {
    bodyFont: FontFamily;
    headingFont: FontFamily;
    baseSize: number;
    headingScale: number;
    lineHeight: number;
  };
  colors: {
    background: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
    onAccent: string;
    border: string;
  };
  spacing: { unit: number; section: number };
  shape: { radius: number };
};

// Sizes are pixels; headingScale and lineHeight are unitless multipliers.
// Font identifiers map to platform-owned stacks, never database-provided CSS.
export const defaultDesignConfiguration: DesignConfiguration = {
  typography: {
    bodyFont: "sans",
    headingFont: "sans",
    baseSize: 16,
    headingScale: 2.5,
    lineHeight: 1.6,
  },
  colors: {
    background: "#ffffff",
    surface: "#f4f4f5",
    text: "#18181b",
    muted: "#52525b",
    accent: "#334155",
    onAccent: "#ffffff",
    border: "#d4d4d8",
  },
  spacing: { unit: 8, section: 56 },
  shape: { radius: 8 },
};

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function number(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : fallback;
}

function font(value: unknown, fallback: FontFamily): FontFamily {
  return value === "sans" || value === "serif" || value === "mono" ? value : fallback;
}

function color(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

export function resolveDesignConfiguration(value: unknown): DesignConfiguration {
  const input = object(value);
  const typography = object(input.typography);
  const colors = object(input.colors);
  const spacing = object(input.spacing);
  const shape = object(input.shape);
  const defaults = defaultDesignConfiguration;

  return {
    typography: {
      bodyFont: font(typography.bodyFont, defaults.typography.bodyFont),
      headingFont: font(typography.headingFont, defaults.typography.headingFont),
      baseSize: number(typography.baseSize, defaults.typography.baseSize, 14, 22),
      headingScale: number(typography.headingScale, defaults.typography.headingScale, 1.5, 3.5),
      lineHeight: number(typography.lineHeight, defaults.typography.lineHeight, 1.2, 2),
    },
    colors: {
      background: color(colors.background, defaults.colors.background),
      surface: color(colors.surface, defaults.colors.surface),
      text: color(colors.text, defaults.colors.text),
      muted: color(colors.muted, defaults.colors.muted),
      accent: color(colors.accent, defaults.colors.accent),
      onAccent: color(colors.onAccent, defaults.colors.onAccent),
      border: color(colors.border, defaults.colors.border),
    },
    spacing: {
      unit: number(spacing.unit, defaults.spacing.unit, 4, 12),
      section: number(spacing.section, defaults.spacing.section, 24, 120),
    },
    shape: { radius: number(shape.radius, defaults.shape.radius, 0, 32) },
  };
}
