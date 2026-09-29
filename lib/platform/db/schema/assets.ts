import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { webPresences } from "./web-presences";

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    webPresenceId: uuid("web_presence_id").notNull().references(() => webPresences.id),
    name: text("name").notNull(),
    type: text("type").notNull().default("image"),
    mimeType: text("mime_type").notNull(),
    width: integer("width"),
    height: integer("height"),
    altText: text("alt_text"),
    status: text("status").notNull().default("active"),
    // A resolver kind and opaque locator, never the asset's identity or bytes.
    sourceType: text("source_type").notNull(),
    sourceReference: text("source_reference").notNull(),
    configuration: jsonb("configuration").notNull().default({}),
    metadata: jsonb("metadata").notNull().default({}),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("assets_web_presence_id_id_unique").on(table.webPresenceId, table.id),
    check("assets_name_nonempty", sql`btrim(${table.name}) <> ''`),
    check("assets_type_nonempty", sql`btrim(${table.type}) <> ''`),
    check("assets_mime_type_nonempty", sql`btrim(${table.mimeType}) <> ''`),
    check("assets_source_type_nonempty", sql`btrim(${table.sourceType}) <> ''`),
    check("assets_source_reference_nonempty", sql`btrim(${table.sourceReference}) <> ''`),
    check("assets_width_positive", sql`${table.width} IS NULL OR ${table.width} > 0`),
    check("assets_height_positive", sql`${table.height} IS NULL OR ${table.height} > 0`),
    check("assets_version_positive", sql`${table.version} > 0`),
  ],
);
