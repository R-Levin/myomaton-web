import { sql } from "drizzle-orm";
import { check, foreignKey, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { navigations } from "./navigations";

export const navigationItems = pgTable(
  "navigation_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    navigationId: uuid("navigation_id")
      .notNull()
      .references(() => navigations.id),
    parentId: uuid("parent_id"),

    name: text("name").notNull(),
    label: text("label").notNull(),
    targetType: text("target_type").notNull(),
    targetReference: text("target_reference").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
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
    unique("navigation_items_navigation_id_name_unique").on(table.navigationId, table.name),
    unique("navigation_items_navigation_id_id_unique").on(table.navigationId, table.id),
    foreignKey({
      columns: [table.navigationId, table.parentId],
      foreignColumns: [table.navigationId, table.id],
      name: "navigation_items_same_navigation_parent_fk",
    }),
    check("navigation_items_not_own_parent", sql`${table.parentId} IS NULL OR ${table.parentId} <> ${table.id}`),
  ],
);
