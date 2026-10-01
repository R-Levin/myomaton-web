import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { subjectTypes } from "../../lib/platform/db/schema/subject-types";

export async function seedPlatform(db: NodePgDatabase) {
  await db.insert(subjectTypes).values({
    key: "project", name: "Project",
    description: "A project, initiative, or undertaking represented by a web presence.",
  }).onConflictDoNothing({ target: subjectTypes.key });
}
