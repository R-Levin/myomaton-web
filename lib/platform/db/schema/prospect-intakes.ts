import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, jsonb, timestamp, unique, index, check, foreignKey } from "drizzle-orm/pg-core";
import { webPresences } from "./web-presences";
import { managedSites } from "./managed-sites";

// Service-owner scope is independent of the prospect's unconfirmed business identity.
export const prospectIntakes = pgTable("prospect_intakes", {
  id: uuid("id").defaultRandom().primaryKey(),
  webPresenceId: uuid("web_presence_id").notNull().references(() => webPresences.id),
  managedSiteId: uuid("managed_site_id").notNull().references(() => managedSites.id),
  entryIntent: text("entry_intent").notNull(),
  questionnaireVersion: text("questionnaire_version").notNull(),
  state: text("state").notNull().default("draft"),
  resumeHash: text("resume_hash").notNull(),
  answers: jsonb("answers").notNull().default({}),
  provenance: jsonb("provenance").notNull().default({}),
  step: integer("step").notNull().default(0),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  resumeExpiresAt: timestamp("resume_expires_at", { withTimezone: true }).notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
}, t => [
  unique("prospect_intakes_owned_id").on(t.webPresenceId, t.id),
  unique("prospect_intakes_resume_hash").on(t.resumeHash),
  index("prospect_intakes_queue").on(t.webPresenceId, t.state, t.submittedAt),
  index("prospect_intakes_retention").on(t.expiresAt),
  check("prospect_intakes_intent", sql`${t.entryIntent} IN ('FREE_REVIEW','DIRECT_START')`),
  check("prospect_intakes_state", sql`${t.state} IN ('draft','needs_operator_review')`),
  check("prospect_intakes_hash", sql`${t.resumeHash} ~ '^[a-f0-9]{64}$'`),
  check("prospect_intakes_bounds", sql`${t.version}>0 AND ${t.step} BETWEEN 0 AND 12 AND octet_length(${t.answers}::text)<=32768 AND octet_length(${t.provenance}::text)<=16384 AND jsonb_typeof(${t.answers})='object' AND jsonb_typeof(${t.provenance})='object'`),
  check("prospect_intakes_submission", sql`(${t.state}='draft' AND ${t.submittedAt} IS NULL) OR (${t.state}='needs_operator_review' AND ${t.submittedAt} IS NOT NULL)`),
]);
export const prospectIntakeSubmissions = pgTable("prospect_intake_submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  webPresenceId: uuid("web_presence_id").notNull(),
  intakeId: uuid("intake_id").notNull(),
  entryIntent: text("entry_intent").notNull(),
  questionnaireVersion: text("questionnaire_version").notNull(),
  draftVersion: integer("draft_version").notNull(),
  state: text("state").notNull().default("submitted"),
  answers: jsonb("answers").notNull(),
  provenance: jsonb("provenance").notNull(),
  digest: text("digest").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, t => [
  foreignKey({ columns: [t.webPresenceId, t.intakeId], foreignColumns: [prospectIntakes.webPresenceId, prospectIntakes.id], name: "prospect_submissions_owned_intake" }).onDelete("cascade"),
  unique("prospect_submissions_once").on(t.intakeId),
  check("prospect_submissions_state", sql`${t.state}='submitted' AND ${t.draftVersion}>0 AND ${t.digest} ~ '^[a-f0-9]{64}$'`),
  check("prospect_submissions_payload", sql`octet_length(${t.answers}::text)<=32768 AND octet_length(${t.provenance}::text)<=16384`),
]);
