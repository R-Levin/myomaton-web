import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/platform/db/connection";
import { organizations } from "@/lib/platform/db/schema/organizations";
import { subjects } from "@/lib/platform/db/schema/subjects";
import { subjectTypes } from "@/lib/platform/db/schema/subject-types";
import { webPresences } from "@/lib/platform/db/schema/web-presences";

export async function getWebPresenceByDomain(domain: string) {
  const [result] = await db
    .select({
      organizationName: organizations.name,
      webPresenceName: webPresences.name,
      subjectName: subjects.name,
      subjectType: subjectTypes.name,
    })
    .from(webPresences)
    .innerJoin(
      organizations,
      eq(webPresences.organizationId, organizations.id),
    )
    .innerJoin(
      subjects,
      eq(subjects.webPresenceId, webPresences.id),
    )
    .leftJoin(
      subjectTypes,
      eq(subjects.subjectTypeId, subjectTypes.id),
    )
    .where(eq(webPresences.primaryDomain, domain))
    .limit(1);

  return result ?? null;
}