import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, jsonb, timestamp, check, unique, index, foreignKey } from "drizzle-orm/pg-core";
import { webPresences } from "./web-presences";
import { managedSites } from "./managed-sites";
import { pages } from "./pages";
import { sections } from "./sections";
import { contactDefinitions } from "./contact-definitions";

export const contactSubmissions = pgTable("contact_submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  webPresenceId: uuid("web_presence_id").notNull().references(() => webPresences.id, { onDelete: "restrict" }),
  managedSiteId: uuid("managed_site_id").notNull().references(() => managedSites.id, { onDelete: "restrict" }),
  pageId: uuid("page_id").references(() => pages.id, { onDelete: "set null" }),
  sectionId: uuid("section_id").references(() => sections.id, { onDelete: "set null" }),
  contactDefinitionId: uuid("contact_definition_id").notNull(),
  contactDefinitionVersion: integer("contact_definition_version").notNull(),
  fields: jsonb("fields").notNull(),
  deliveryRouteKey: text("delivery_route_key"),
  deliveryStatus: text("delivery_status").notNull(),
  deliveryAttempts: integer("delivery_attempts").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  deliveryErrorCode: text("delivery_error_code"),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, t => [
  foreignKey({ name: "contact_submissions_definition_owner_fk", columns: [t.webPresenceId, t.contactDefinitionId], foreignColumns: [contactDefinitions.webPresenceId, contactDefinitions.id] }).onDelete("restrict"),
  unique("contact_submissions_idempotency").on(t.webPresenceId, t.contactDefinitionId, t.idempotencyKey),
  index("contact_submissions_owner_created").on(t.webPresenceId, t.createdAt),
  index("contact_submissions_expiry").on(t.expiresAt),
  index("contact_submissions_pending").on(t.createdAt).where(sql`${t.deliveryStatus} = 'pending'`),
  check("contact_submissions_version_positive", sql`${t.contactDefinitionVersion} > 0`),
  check("contact_submissions_fields_object", sql`jsonb_typeof(${t.fields}) = 'object' AND octet_length(${t.fields}::text) <= 16384`),
  check("contact_submissions_delivery_status", sql`${t.deliveryStatus} IN ('pending','delivered','failed','disabled')`),
  check("contact_submissions_attempts", sql`${t.deliveryAttempts} >= 0`),
  check("contact_submissions_route", sql`(${t.deliveryStatus} = 'disabled' AND ${t.deliveryRouteKey} IS NULL) OR (${t.deliveryStatus} <> 'disabled' AND ${t.deliveryRouteKey} IS NOT NULL AND ${t.deliveryRouteKey} ~ '^[a-z][a-z0-9_-]{0,63}$')`),
  check("contact_submissions_error", sql`${t.deliveryErrorCode} IS NULL OR ${t.deliveryErrorCode} ~ '^[a-z][a-z0-9_]{0,63}$'`),
  check("contact_submissions_key", sql`${t.idempotencyKey} ~ '^[A-Za-z0-9_-]{16,100}$'`),
  check("contact_submissions_expiry_after_creation", sql`${t.expiresAt} > ${t.createdAt}`),
]);
