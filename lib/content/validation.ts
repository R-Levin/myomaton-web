import type { EditorData } from "@/types/editor";
import type { HomepageContent, WorkingCopy } from "@/types/content";

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
      } };
    }
    if (block.type === "ContentSection") {
      if (props.width !== "normal" && props.width !== "narrow") {
        throw new InvalidContentError("Invalid ContentSection width.");
      }
      return { type: "ContentSection", props: {
        id, heading: text(props.heading), body: text(props.body), width: props.width,
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
