import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, jsonb, timestamp, check, unique } from "drizzle-orm/pg-core";
import { webPresences } from "./web-presences";

export const contactDefinitions = pgTable("contact_definitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  webPresenceId: uuid("web_presence_id").notNull().references(() => webPresences.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  version: integer("version").notNull().default(1),
  configuration: jsonb("configuration").notNull(),
  // Null is explicit disabled delivery. Never part of the public DTO.
  deliveryRouteKey: text("delivery_route_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  unique("contact_definitions_owner_identity").on(t.webPresenceId, t.id),
  check("contact_definitions_version_positive", sql`${t.version} > 0`),
  check("contact_definitions_name_bounded", sql`length(trim(${t.name})) BETWEEN 1 AND 200`),
  check("contact_definitions_status", sql`${t.status} IN ('active','inactive')`),
  check("contact_definitions_configuration_object", sql`jsonb_typeof(${t.configuration}) = 'object'`),
  check("contact_definitions_route", sql`${t.deliveryRouteKey} IS NULL OR ${t.deliveryRouteKey} ~ '^[a-z][a-z0-9_-]{0,63}$'`),
]);
