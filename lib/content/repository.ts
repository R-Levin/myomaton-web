import type { HomepageContent, WorkingCopy } from "@/types/content";

export interface ContentRepository {
  read(): Promise<HomepageContent>;
  saveDraft(snapshot: WorkingCopy, expectedSavedAt: string | null): Promise<HomepageContent>;
  publish(expectedSavedAt: string): Promise<HomepageContent>;
}

export class ContentConflictError extends Error {}
