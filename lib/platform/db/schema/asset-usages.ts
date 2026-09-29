import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { assets } from "./assets";

export const assetUsages = pgTable(
  "asset_usages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    webPresenceId: uuid("web_presence_id").notNull(),
    assetId: uuid("asset_id").notNull(),
    // Polymorphic target; future writers must verify target existence/ownership.
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    role: text("role").notNull(),
    configuration: jsonb("configuration").notNull().default({}),
    metadata: jsonb("metadata").notNull().default({}),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.webPresenceId, table.assetId],
      foreignColumns: [assets.webPresenceId, assets.id],
      name: "asset_usages_same_web_presence_asset_fk",
    }),
    unique("asset_usages_reference_unique").on(table.webPresenceId, table.entityType, table.entityId, table.role, table.assetId),
    index("asset_usages_web_presence_asset_idx").on(table.webPresenceId, table.assetId),
    check("asset_usages_entity_type_nonempty", sql`btrim(${table.entityType}) <> ''`),
    check("asset_usages_role_nonempty", sql`btrim(${table.role}) <> ''`),
    check("asset_usages_version_positive", sql`${table.version} > 0`),
  ],
);
