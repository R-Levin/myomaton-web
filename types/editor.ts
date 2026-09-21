import type { Data } from "@puckeditor/core";

export type HeroProps = {
  eyebrow: string;
  heading: string;
  supportingText: string;
  ctaLabel?: string;
  ctaUrl?: string;
  alignment: "left" | "center";
};

export type ContentSectionProps = {
  heading: string;
  body: string;
  width: "normal" | "narrow";
};

export type EditorComponents = {
  Hero: HeroProps;
  ContentSection: ContentSectionProps;
};

export type EditorData = Data<EditorComponents>;
