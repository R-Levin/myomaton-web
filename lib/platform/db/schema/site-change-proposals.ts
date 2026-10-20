import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, jsonb, timestamp, unique, check, foreignKey, primaryKey, uniqueIndex, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { webPresences } from "./web-presences";
import { managedSites } from "./managed-sites";

export const siteChangeProposals = pgTable("site_change_proposals", {
  id: uuid("id").primaryKey(), organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  webPresenceId: uuid("web_presence_id").notNull().references(() => webPresences.id),
  managedSiteId: uuid("managed_site_id").notNull().references(() => managedSites.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, t => [index("site_proposal_owner").on(t.webPresenceId, t.managedSiteId)]);
export const siteChangeRevisions = pgTable("site_change_revisions", {
  proposalId: uuid("proposal_id").notNull().references(() => siteChangeProposals.id),
  revision: integer("revision").notNull(), digest: text("digest").notNull(), baseFingerprint: text("base_fingerprint").notNull(),
  data: jsonb("data").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, t => [primaryKey({ columns: [t.proposalId, t.revision] }), unique("site_revision_binding").on(t.proposalId, t.revision, t.digest, t.baseFingerprint),
  check("site_revision_bounds", sql`${t.revision} BETWEEN 1 AND 128 AND ${t.digest} ~ '^[a-f0-9]{64}$' AND ${t.baseFingerprint} ~ '^[a-f0-9]{64}$' AND jsonb_typeof(${t.data})='object' AND octet_length(${t.data}::text)<=2097152`)]);
export const siteChangeEvents = pgTable("site_change_events", {
  proposalId: uuid("proposal_id").notNull(), sequence: integer("sequence").notNull(), requestId: uuid("request_id").notNull(), requestDigest: text("request_digest").notNull(),
  operation: text("operation").notNull(), revision: integer("revision").notNull(), proposalDigest: text("proposal_digest").notNull(), baseFingerprint: text("base_fingerprint").notNull(),
  previous: text("previous"), digest: text("digest").notNull(), previewDigest: text("preview_digest"), previewEvent: text("preview_event"), renderer: text("renderer"),
  actor: text("actor").notNull(), authorityReference: text("authority_reference").notNull(), customer: jsonb("customer"), approvalReference: text("approval_reference"),
  at: timestamp("at", { withTimezone: true }).notNull(), data: jsonb("data").notNull(),
}, t => [primaryKey({ columns: [t.proposalId, t.sequence] }), unique("site_event_request").on(t.proposalId, t.requestId), unique("site_event_hash").on(t.proposalId, t.digest),
  foreignKey({ name: "site_event_revision_fk", columns: [t.proposalId, t.revision, t.proposalDigest, t.baseFingerprint], foreignColumns: [siteChangeRevisions.proposalId, siteChangeRevisions.revision, siteChangeRevisions.digest, siteChangeRevisions.baseFingerprint] }),
  // Preview linkage is checked by the append-only trigger against this same table.
  uniqueIndex("site_approval_once").on(t.proposalId, t.revision).where(sql`${t.operation}='approve'`),
  check("site_event_bounds", sql`${t.sequence} BETWEEN 1 AND 128 AND ${t.operation} IN ('revise','preview','approve') AND ${t.requestDigest} ~ '^[a-f0-9]{64}$' AND ${t.digest} ~ '^[a-f0-9]{64}$' AND (${t.previous} IS NULL OR ${t.previous} ~ '^[a-f0-9]{64}$') AND length(${t.actor}) BETWEEN 1 AND 200 AND length(${t.authorityReference}) BETWEEN 1 AND 300 AND jsonb_typeof(${t.data})='object' AND octet_length(${t.data}::text)<=32768`)]);
