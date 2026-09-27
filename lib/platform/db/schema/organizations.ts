import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: text("name").notNull(),
  type: text("type").notNull().default("standard"),
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
});