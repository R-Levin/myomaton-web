import type { Data } from "@puckeditor/core";
import type { ContentWidth, SectionSpacing } from "./site-theme";

export type HeroProps = {
  eyebrow: string;
  heading: string;
  supportingText: string;
  ctaLabel?: string;
  ctaUrl?: string;
  alignment: "left" | "center";
  width: "standard" | "wide";
  spacing: SectionSpacing;
};

export type ContentSectionProps = {
  heading: string;
  body: string;
  width: ContentWidth;
  alignment: "left" | "center";
  spacing: SectionSpacing;
};

export type EditorComponents = {
  Hero: HeroProps;
  ContentSection: ContentSectionProps;
};

export type EditorData = Data<EditorComponents>;
