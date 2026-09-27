import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { organizations } from "./organizations";

export const webPresences = pgTable("web_presences", {
  id: uuid("id").defaultRandom().primaryKey(),

  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),

  name: text("name").notNull(),
  primaryDomain: text("primary_domain"),
  locale: text("locale").notNull().default("en-US"),
  timezone: text("timezone").notNull().default("UTC"),
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