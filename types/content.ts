import type { EditorData } from "./editor";
import type { SiteTheme } from "./site-theme";

export type WorkingCopy = { page: EditorData; theme: SiteTheme };
export type SavedDraft = { snapshot: WorkingCopy; savedAt: string };
export type PublishedVersion = SavedDraft & { publishedAt: string };
export type HomepageContent = {
  schemaVersion: 1;
  draft: SavedDraft | null;
  published: PublishedVersion | null;
};
export type RecoverySnapshot = {
  snapshot: WorkingCopy;
  capturedAt: string;
  baseSavedAt: string | null;
};
