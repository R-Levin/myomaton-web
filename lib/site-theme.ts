import type { CSSProperties } from "react";
import type { SiteTheme } from "@/types/site-theme";

export const defaultSiteTheme: SiteTheme = {
  headingFont: "geist",
  bodyFont: "geist",
  baseTextSize: "standard",
  headingScale: "standard",
  accentColor: "#365b46",
  backgroundColor: "#fafaf7",
  textColor: "#202520",
  contentWidth: "standard",
  sectionSpacing: "standard",
};

export const headingFontOptions = [
  { value: "geist", label: "Geist Sans" },
  { value: "system-serif", label: "System serif (Georgia)" },
] as const;

export const bodyFontOptions = [
  { value: "geist", label: "Geist Sans" },
  { value: "system-sans", label: "System sans-serif" },
] as const;

export const baseTextSizeOptions = [
  { value: "small", label: "Small" },
  { value: "standard", label: "Standard" },
  { value: "large", label: "Large" },
] as const;

export const headingScaleOptions = [
  { value: "compact", label: "Compact" },
  { value: "standard", label: "Standard" },
  { value: "editorial", label: "Editorial" },
] as const;

export const contentWidthOptions = [
  { value: "narrow", label: "Narrow" },
  { value: "standard", label: "Standard" },
  { value: "wide", label: "Wide" },
] as const;

export const spacingOptions = [
  { value: "compact", label: "Compact" },
  { value: "standard", label: "Standard" },
  { value: "generous", label: "Generous" },
] as const;

const fontFamilies = {
  geist: "var(--font-geist-sans, sans-serif)",
  "system-serif": 'Georgia, "Times New Roman", serif',
  "system-sans": 'system-ui, -apple-system, "Segoe UI", sans-serif',
};

const bodySizes = { small: "0.9375rem", standard: "1.0625rem", large: "1.25rem" };
const headingSizes = {
  compact: { hero: "clamp(2rem, 4.5vw, 3.5rem)", section: "clamp(1.5rem, 3vw, 2rem)" },
  standard: { hero: "clamp(2.5rem, 7vw, 5rem)", section: "clamp(1.75rem, 4vw, 2.75rem)" },
  editorial: { hero: "clamp(3rem, 9vw, 7rem)", section: "clamp(2.25rem, 5.5vw, 4rem)" },
};
const contentWidths = { narrow: 44, standard: 64, wide: 80 };
const sectionSpaces = {
  compact: "clamp(1.5rem, 4vw, 2.5rem)",
  standard: "clamp(2rem, 6vw, 4rem)",
  generous: "clamp(3rem, 9vw, 7rem)",
};

function luminance(color: string) {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(color.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function textContrast(theme: SiteTheme) {
  const values = [luminance(theme.backgroundColor), luminance(theme.textColor)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

export function siteThemeVariables(theme: SiteTheme): CSSProperties & Record<`--site-${string}`, string> {
  return {
    "--site-heading-font": fontFamilies[theme.headingFont],
    "--site-body-font": fontFamilies[theme.bodyFont],
    "--site-body-size": bodySizes[theme.baseTextSize],
    "--site-hero-size": headingSizes[theme.headingScale].hero,
    "--site-section-heading-size": headingSizes[theme.headingScale].section,
    "--site-accent": theme.accentColor,
    "--site-background": theme.backgroundColor,
    "--site-text": theme.textColor,
    "--site-on-accent": luminance(theme.accentColor) > 0.179 ? "#000000" : "#ffffff",
    "--site-surface": "color-mix(in srgb, var(--site-accent) 8%, var(--site-background))",
    "--site-rule": "color-mix(in srgb, var(--site-text) 20%, var(--site-background))",
    "--site-content-width": `${contentWidths[theme.contentWidth]}rem`,
    "--site-content-width-narrow": `${contentWidths[theme.contentWidth] * 0.7}rem`,
    "--site-content-width-wide": `${contentWidths[theme.contentWidth] * 1.25}rem`,
    "--site-section-spacing": sectionSpaces[theme.sectionSpacing],
  };
}
