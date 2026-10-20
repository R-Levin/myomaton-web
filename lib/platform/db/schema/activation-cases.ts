import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, jsonb, timestamp, unique, check } from "drizzle-orm/pg-core";
import { prospectIntakeSubmissions } from "./prospect-intakes";

export const activationCases = pgTable("activation_cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  webPresenceId: uuid("web_presence_id").notNull(), managedSiteId: uuid("managed_site_id").notNull(),
  pendingCustomerId: uuid("pending_customer_id").notNull(),
  submissionId: uuid("submission_id").notNull().references(() => prospectIntakeSubmissions.id),
  source: jsonb("source").notNull(), review: jsonb("review"),
  requestId: uuid("request_id").notNull(), requestDigest: text("request_digest").notNull(),
  createdBy: text("created_by").notNull(), authorityReference: text("authority_reference").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [unique("activation_case_source_once").on(t.submissionId), unique("activation_case_pending_once").on(t.pendingCustomerId), unique("activation_case_request").on(t.webPresenceId, t.requestId),
  check("activation_case_bounds", sql`octet_length(${t.source}::text)<=2048 AND octet_length(${t.review}::text)<=2048 AND ${t.requestDigest} ~ '^[a-f0-9]{64}$' AND length(${t.createdBy}) BETWEEN 1 AND 200 AND length(${t.authorityReference}) BETWEEN 1 AND 300`)]);
export const activationCaseEvents = pgTable("activation_case_events", {
  id: uuid("id").defaultRandom().primaryKey(), caseId: uuid("case_id").notNull().references(() => activationCases.id),
  version: integer("version").notNull(), requestId: uuid("request_id").notNull(), requestDigest: text("request_digest").notNull(),
  operation: text("operation").notNull(), actor: text("actor").notNull(), authorityReference: text("authority_reference").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull(), previous: text("previous"), digest: text("digest").notNull(), snapshot: jsonb("snapshot").notNull(),
}, t => [unique("activation_event_version").on(t.caseId, t.version), unique("activation_event_request").on(t.caseId, t.requestId),
  check("activation_event_bounds", sql`${t.version} BETWEEN 1 AND 100 AND ${t.operation} IN ('create','confirm-commercial','assess') AND octet_length(${t.snapshot}::text)<=16384 AND ${t.digest} ~ '^[a-f0-9]{64}$' AND ${t.requestDigest} ~ '^[a-f0-9]{64}$' AND length(${t.actor}) BETWEEN 1 AND 200 AND length(${t.authorityReference}) BETWEEN 1 AND 300`)]);
