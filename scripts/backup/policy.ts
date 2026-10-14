import assert from "node:assert/strict";
import path from "node:path";

export const rootKind = "myomaton-backup-root/1";
export const pointPattern = /^\d{8}T\d{9}Z_[a-f0-9]{8}$/;
export function pointId(now: Date, suffix: string) {
  assert.match(suffix, /^[a-f0-9]{8}$/);
  return now.toISOString().replace(/[-:.]/g, "") + "_" + suffix;
}
export function contained(root: string, target: string) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}
export function assertBackupRoot(root: string, protectedRoots: string[]) {
  assert.ok(path.isAbsolute(root), "Backup root must be absolute");
  const resolved = path.resolve(root);
  assert.notEqual(resolved, path.parse(resolved).root, "A volume root is not a backup directory");
  for (const protectedRoot of protectedRoots) {
    const live = path.resolve(protectedRoot);
    assert.ok(resolved.toLowerCase() !== live.toLowerCase() && !contained(live, resolved) && !contained(resolved, live), "Backup and live/source paths must not overlap");
  }
  return resolved;
}
export function checkedRelative(relative: string) {
  assert.ok(/^[a-zA-Z0-9_./-]+$/.test(relative) && !relative.includes("..") && !relative.startsWith("/") && !relative.includes("\\"), "Unsafe backup artifact path");
  return relative;
}
export function isDisposableSchema(schema: string) {
  return /^canonical_test_[a-f0-9]{32}(?:_\w+)?$/.test(schema) || /^myomaton_(?:asset_test|rename_test|contact_test|visual_test)_[a-f0-9]{32}(?:_\w+)?$/.test(schema);
}
// Planning only: never deletes files. Keep newest point per day for 14 days,
// plus newest point per seven-day bucket for the preceding eight weeks.
export function retentionPlan(points: { id: string; createdAt: string }[], now: Date) {
  const days = new Set<string>(), weeks = new Set<number>(), keep: string[] = [], eligible: string[] = [];
  for (const point of [...points].sort((a,b) => b.createdAt.localeCompare(a.createdAt))) {
    assert.match(point.id, pointPattern);
    const at = new Date(point.createdAt); assert.ok(Number.isFinite(at.getTime()) && at <= now, "Invalid restore-point date");
    const age = Math.floor((Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()) - Date.UTC(at.getUTCFullYear(),at.getUTCMonth(),at.getUTCDate())) / 86400000);
    const day = point.createdAt.slice(0,10), week = Math.floor((age - 14) / 7);
    if (!keep.length || age < 14 && !days.has(day) || age >= 14 && week < 8 && !weeks.has(week)) {
      keep.push(point.id); days.add(day); if (age >= 14) weeks.add(week);
    } else eligible.push(point.id);
  }
  return { keep, eligibleForOperatorRemoval: eligible, deletesPerformed: 0 };
}
