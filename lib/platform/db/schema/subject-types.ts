import {
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const subjectTypes = pgTable(
  "subject_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    parentId: uuid("parent_id"),

    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),

    configuration: jsonb("configuration").notNull().default({}),
    metadata: jsonb("metadata").notNull().default({}),

    version: integer("version").notNull().default(1),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: "subject_types_parent_id_fk",
    }),
  ],
);