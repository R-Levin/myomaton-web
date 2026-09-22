import type { EditorData } from "@/types/editor";
import type { HomepageContent, WorkingCopy } from "@/types/content";
import { defaultSiteTheme } from "@/lib/site-theme";

export class InvalidContentError extends Error {}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InvalidContentError("Expected an object.");
  }
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== "string" || value.length > 50000) {
    throw new InvalidContentError("Text must be a string of at most 50,000 characters.");
  }
  return value;
}

function choice<T extends string>(value: unknown, options: readonly T[], fallback?: T): T {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "string" || !options.includes(value as T)) {
    throw new InvalidContentError(`Choose one of: ${options.join(", ")}.`);
  }
  return value as T;
}

function color(value: unknown, fallback: string): string {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new InvalidContentError("Colors must use six-digit hexadecimal notation.");
  }
  return value.toLowerCase();
}

export function timestamp(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new InvalidContentError("Invalid timestamp.");
  }
  return new Date(value).toISOString();
}

export function parsePageData(value: unknown): EditorData {
  const page = object(value);
  if (!Array.isArray(page.content) || page.content.length > 100) {
    throw new InvalidContentError("A page must contain at most 100 blocks.");
  }
  const ids = new Set<string>();
  const content: EditorData["content"] = page.content.map((item) => {
    const block = object(item);
    const props = object(block.props);
    const id = text(props.id);
    if (!id || ids.has(id)) throw new InvalidContentError("Block IDs must be unique.");
    ids.add(id);
    if (block.type === "Hero") {
      if (props.alignment !== "left" && props.alignment !== "center") {
        throw new InvalidContentError("Invalid Hero alignment.");
      }
      return { type: "Hero", props: {
        id, eyebrow: text(props.eyebrow), heading: text(props.heading),
        supportingText: text(props.supportingText),
        ctaLabel: text(props.ctaLabel ?? ""), ctaUrl: text(props.ctaUrl ?? ""),
        alignment: props.alignment,
        width: choice(props.width, ["standard", "wide"], "standard"),
        spacing: choice(props.spacing, ["compact", "standard", "generous"], "standard"),
      } };
    }
    if (block.type === "ContentSection") {
      return { type: "ContentSection", props: {
        id, heading: text(props.heading), body: text(props.body),
        // The first prototype called its standard width "normal".
        width: choice(props.width === "normal" ? "standard" : props.width, ["narrow", "standard", "wide"], "standard"),
        alignment: choice(props.alignment, ["left", "center"], "left"),
        spacing: choice(props.spacing, ["compact", "standard", "generous"], "standard"),
      } };
    }
    throw new InvalidContentError("Unknown block type.");
  });
  // No root fields, zones, HTML, or editor UI state are part of this prototype.
  return { root: { props: {} }, content };
}

export function parseWorkingCopy(value: unknown): WorkingCopy {
  const copy = object(value);
  const theme = object(copy.theme);
  if ((theme.headingFont !== "geist" && theme.headingFont !== "system-serif") ||
      (theme.bodyFont !== "geist" && theme.bodyFont !== "system-sans")) {
    throw new InvalidContentError("Invalid site fonts.");
  }
  return { page: parsePageData(copy.page), theme: {
    headingFont: theme.headingFont, bodyFont: theme.bodyFont,
    baseTextSize: choice(theme.baseTextSize, ["small", "standard", "large"], defaultSiteTheme.baseTextSize),
    headingScale: choice(theme.headingScale, ["compact", "standard", "editorial"], defaultSiteTheme.headingScale),
    accentColor: color(theme.accentColor, defaultSiteTheme.accentColor),
    backgroundColor: color(theme.backgroundColor, defaultSiteTheme.backgroundColor),
    textColor: color(theme.textColor, defaultSiteTheme.textColor),
    contentWidth: choice(theme.contentWidth, ["narrow", "standard", "wide"], defaultSiteTheme.contentWidth),
    sectionSpacing: choice(theme.sectionSpacing, ["compact", "standard", "generous"], defaultSiteTheme.sectionSpacing),
  } };
}

export function sameWorkingCopy(a: WorkingCopy, b: WorkingCopy) {
  return JSON.stringify(parseWorkingCopy(a)) === JSON.stringify(parseWorkingCopy(b));
}

export function parseHomepageContent(value: unknown): HomepageContent {
  const record = object(value);
  if (record.schemaVersion !== 1) throw new InvalidContentError("Unknown storage format.");
  const draft = record.draft === null ? null : object(record.draft);
  const published = record.published === null ? null : object(record.published);
  return {
    schemaVersion: 1,
    draft: draft && { snapshot: parseWorkingCopy(draft.snapshot), savedAt: timestamp(draft.savedAt) },
    published: published && {
      snapshot: parseWorkingCopy(published.snapshot),
      savedAt: timestamp(published.savedAt), publishedAt: timestamp(published.publishedAt),
    },
  };
}
