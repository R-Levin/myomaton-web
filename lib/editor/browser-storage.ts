import type { RecoverySnapshot, SavedDraft, WorkingCopy } from "@/types/content";
import { object, parseWorkingCopy, sameWorkingCopy, timestamp } from "@/lib/content/validation";

export const RECOVERY_KEY = "myomaton:home:recovery:v1";
export const PREVIEW_KEY = "myomaton:home:preview:v1";

export function readRecovery(storage: Storage, draft: SavedDraft | null): RecoverySnapshot | null {
  const raw = storage.getItem(RECOVERY_KEY);
  if (!raw) return null;
  const value = object(JSON.parse(raw));
  const recovery: RecoverySnapshot = {
    snapshot: parseWorkingCopy(value.snapshot), capturedAt: timestamp(value.capturedAt),
    baseSavedAt: value.baseSavedAt === null ? null : timestamp(value.baseSavedAt),
  };
  if (draft && (Date.parse(recovery.capturedAt) <= Date.parse(draft.savedAt) ||
      sameWorkingCopy(recovery.snapshot, draft.snapshot))) return null;
  return recovery;
}

export function writeRecovery(storage: Storage, snapshot: WorkingCopy, baseSavedAt: string | null) {
  const capturedAt = new Date(Math.max(Date.now(), Date.parse(baseSavedAt ?? "1970-01-01") + 1)).toISOString();
  const recovery: RecoverySnapshot = { snapshot, baseSavedAt, capturedAt };
  storage.setItem(RECOVERY_KEY, JSON.stringify(recovery));
}

export function writePreview(storage: Storage, snapshot: WorkingCopy) {
  storage.setItem(PREVIEW_KEY, JSON.stringify(parseWorkingCopy(snapshot)));
}

export function readPreview(storage: Storage): WorkingCopy | null {
  const raw = storage.getItem(PREVIEW_KEY);
  return raw ? parseWorkingCopy(JSON.parse(raw)) : null;
}
