export type SectionSpacing = "compact" | "standard" | "generous";
export type ContentWidth = "narrow" | "standard" | "wide";

export type SiteTheme = {
  headingFont: "geist" | "system-serif";
  bodyFont: "geist" | "system-sans";
  baseTextSize: "small" | "standard" | "large";
  headingScale: "compact" | "standard" | "editorial";
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  contentWidth: ContentWidth;
  sectionSpacing: SectionSpacing;
};
