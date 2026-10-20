import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, jsonb, timestamp, unique, check, foreignKey } from "drizzle-orm/pg-core";
import { prospectIntakeSubmissions } from "./prospect-intakes";
import { organizations } from "./organizations";
import { webPresences } from "./web-presences";
import { managedSites } from "./managed-sites";

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
  check("activation_event_bounds", sql`${t.version} BETWEEN 1 AND 100 AND ${t.operation} IN ('create','confirm-commercial','assess','initialize-customer') AND octet_length(${t.snapshot}::text)<=16384 AND ${t.digest} ~ '^[a-f0-9]{64}$' AND ${t.requestDigest} ~ '^[a-f0-9]{64}$' AND length(${t.actor}) BETWEEN 1 AND 200 AND length(${t.authorityReference}) BETWEEN 1 AND 300`)]);

// One immutable canonical identity per pending case; this is not an entitlement or publication record.
export const activationCustomerBindings = pgTable("activation_customer_bindings", {
  caseId: uuid("case_id").primaryKey().references(() => activationCases.id),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  webPresenceId: uuid("web_presence_id").notNull().references(() => webPresences.id),
  managedSiteId: uuid("managed_site_id").notNull().references(() => managedSites.id),
  eventVersion: integer("event_version").notNull(), identity: jsonb("identity").notNull(), identityDigest: text("identity_digest").notNull(),
}, t => [unique("activation_binding_org_once").on(t.organizationId), unique("activation_binding_presence_once").on(t.webPresenceId), unique("activation_binding_site_once").on(t.managedSiteId),
  foreignKey({columns:[t.caseId,t.eventVersion],foreignColumns:[activationCaseEvents.caseId,activationCaseEvents.version],name:"activation_binding_event_fk"}),
  check("activation_binding_bounds",sql`${t.eventVersion} BETWEEN 2 AND 100 AND jsonb_typeof(${t.identity})='object' AND octet_length(${t.identity}::text)<=4096 AND ${t.identityDigest} ~ '^[a-f0-9]{64}$'`)]);
