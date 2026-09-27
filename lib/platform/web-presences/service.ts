import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/platform/db/connection";
import { organizations } from "@/lib/platform/db/schema/organizations";
import { subjects } from "@/lib/platform/db/schema/subjects";
import { subjectTypes } from "@/lib/platform/db/schema/subject-types";
import { webPresences } from "@/lib/platform/db/schema/web-presences";

export async function getWebPresenceByDomain(domain: string) {
  const [presence] = await db
    .select({
      id: webPresences.id,
      name: webPresences.name,
      primaryDomain: webPresences.primaryDomain,
      locale: webPresences.locale,
      timezone: webPresences.timezone,
      organizationId: organizations.id,
      organizationName: organizations.name,
    })
    .from(webPresences)
    .innerJoin(
      organizations,
      eq(webPresences.organizationId, organizations.id),
    )
    .where(eq(webPresences.primaryDomain, domain))
    .limit(1);

  if (!presence) {
    return null;
  }

  const subjectRows = await db
    .select({
      id: subjects.id,
      name: subjects.name,
      legalName: subjects.legalName,
      description: subjects.description,
      typeId: subjectTypes.id,
      typeKey: subjectTypes.key,
      typeName: subjectTypes.name,
    })
    .from(subjects)
    .leftJoin(
      subjectTypes,
      eq(subjects.subjectTypeId, subjectTypes.id),
    )
    .where(eq(subjects.webPresenceId, presence.id));

  return {
    id: presence.id,
    name: presence.name,
    primaryDomain: presence.primaryDomain,
    locale: presence.locale,
    timezone: presence.timezone,

    organization: {
      id: presence.organizationId,
      name: presence.organizationName,
    },

    subjects: subjectRows.map((subject) => ({
      id: subject.id,
      name: subject.name,
      legalName: subject.legalName,
      description: subject.description,

      type:
        subject.typeId && subject.typeKey && subject.typeName
          ? {
              id: subject.typeId,
              key: subject.typeKey,
              name: subject.typeName,
            }
          : null,
    })),
  };
}