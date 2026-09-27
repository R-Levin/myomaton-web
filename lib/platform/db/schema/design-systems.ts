import { sql } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { webPresences } from "./web-presences";

export const designSystems = pgTable(
  "design_systems",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    webPresenceId: uuid("web_presence_id")
      .notNull()
      .references(() => webPresences.id),

    name: text("name").notNull(),
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
    uniqueIndex("design_systems_web_presence_active_unique")
      .on(table.webPresenceId)
      .where(sql`${table.status} = 'active'`),
  ],
);
