import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { pages } from "./pages";

export const sections = pgTable("sections", {
  id: uuid("id").defaultRandom().primaryKey(),

  pageId: uuid("page_id")
    .notNull()
    .references(() => pages.id),

  type: text("type").notNull(),
  variant: text("variant"),
  name: text("name"),
  sortOrder: integer("sort_order").notNull().default(0),

  content: jsonb("content").notNull().default({}),
  configuration: jsonb("configuration").notNull().default({}),
  metadata: jsonb("metadata").notNull().default({}),

  status: text("status").notNull().default("active"),
  version: integer("version").notNull().default(1),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
