import "dotenv/config";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { organizations } from "../lib/platform/db/schema/organizations";
import { subjects } from "../lib/platform/db/schema/subjects";
import { subjectTypes } from "../lib/platform/db/schema/subject-types";
import { webPresences } from "../lib/platform/db/schema/web-presences";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

const pool = new Pool({
  connectionString,
});

const db = drizzle({ client: pool });

async function seed() {
  const [projectType] = await db
    .insert(subjectTypes)
    .values({
      key: "project",
      name: "Project",
      description:
        "A project, initiative, or undertaking represented by a web presence.",
    })
    .onConflictDoNothing({ target: subjectTypes.key })
    .returning();

  const existingProjectType =
    projectType ??
    (
      await db
        .select()
        .from(subjectTypes)
        .where(eq(subjectTypes.key, "project"))
        .limit(1)
    )[0];

  const existingOrganization = (
    await db
      .select()
      .from(organizations)
      .where(eq(organizations.name, "Open Practical Robotics"))
      .limit(1)
  )[0];

  const organization =
    existingOrganization ??
    (
      await db
        .insert(organizations)
        .values({
          name: "Open Practical Robotics",
        })
        .returning()
    )[0];

  const existingPresence = (
    await db
      .select()
      .from(webPresences)
      .where(eq(webPresences.primaryDomain, "myomaton.com"))
      .limit(1)
  )[0];

  const presence =
    existingPresence ??
    (
      await db
        .insert(webPresences)
        .values({
          organizationId: organization.id,
          name: "Myomaton",
          primaryDomain: "myomaton.com",
          locale: "en-US",
          timezone: "America/New_York",
        })
        .returning()
    )[0];

  const existingSubject = (
    await db
      .select()
      .from(subjects)
      .where(eq(subjects.webPresenceId, presence.id))
      .limit(1)
  )[0];

  if (!existingSubject) {
    await db.insert(subjects).values({
      webPresenceId: presence.id,
      subjectTypeId: existingProjectType.id,
      name: "Myomaton",
      description: "An open practical robotics project.",
    });
  }

  console.log("Development seed complete.");
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });