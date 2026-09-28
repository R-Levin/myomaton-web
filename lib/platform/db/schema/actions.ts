import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { webPresences } from "./web-presences";

export const actions = pgTable(
  "actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    webPresenceId: uuid("web_presence_id")
      .notNull()
      .references(() => webPresences.id),

    name: text("name").notNull(),
    type: text("type").notNull(),
    label: text("label").notNull(),
    destination: text("destination").notNull(),
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
    unique("actions_web_presence_id_name_unique").on(table.webPresenceId, table.name),
  ],
);
