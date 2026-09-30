import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/platform/db/connection";
import { subjects } from "@/lib/platform/db/schema/subjects";
import { webPresences } from "@/lib/platform/db/schema/web-presences";
import { subjectId, presentSubject, type PresentedSubject } from "./presentation";

// Active is the existing public eligibility model; this does not introduce publishing state.
export async function getPresentedSubjectsByIds(webPresenceId: string, ids: readonly string[]): Promise<Map<string, PresentedSubject>> {
  const presenceId = subjectId(webPresenceId);
  const validIds = [...new Set(ids.map(subjectId).filter((id) => id !== null))];
  const resolved = new Map<string, PresentedSubject>();
  if (!presenceId || !validIds.length) return resolved;
  const rows = await db.select({
    id: subjects.id, webPresenceId: subjects.webPresenceId,
    name: subjects.name, description: subjects.description, status: subjects.status,
  }).from(subjects)
    .innerJoin(webPresences, eq(subjects.webPresenceId, webPresences.id))
    .where(and(eq(subjects.webPresenceId, presenceId), eq(subjects.status, "active"),
      eq(webPresences.status, "active"), inArray(subjects.id, validIds)));
  for (const row of rows) {
    const subject = presentSubject(row, presenceId);
    if (subject && validIds.includes(subject.id)) resolved.set(subject.id, subject);
  }
  return resolved;
}
