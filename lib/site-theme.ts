import type { CSSProperties } from "react";
import type { SiteTheme } from "@/types/site-theme";

export const defaultSiteTheme: SiteTheme = {
  headingFont: "geist",
  bodyFont: "geist",
};

export const headingFontOptions = [
  { value: "geist", label: "Geist Sans" },
  { value: "system-serif", label: "System serif (Georgia)" },
] as const;

export const bodyFontOptions = [
  { value: "geist", label: "Geist Sans" },
  { value: "system-sans", label: "System sans-serif" },
] as const;

const fontFamilies = {
  geist: "var(--font-geist-sans, sans-serif)",
  "system-serif": 'Georgia, "Times New Roman", serif',
  "system-sans": 'system-ui, -apple-system, "Segoe UI", sans-serif',
};

export function siteThemeVariables(theme: SiteTheme): CSSProperties & {
  "--site-heading-font": string;
  "--site-body-font": string;
} {
  return {
    "--site-heading-font": fontFamilies[theme.headingFont],
    "--site-body-font": fontFamilies[theme.bodyFont],
  };
}
