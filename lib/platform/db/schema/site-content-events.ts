import { sql } from "drizzle-orm";
import { type AnyPgColumn, pgTable, uuid, integer, text, jsonb, timestamp, unique, uniqueIndex, foreignKey, check } from "drizzle-orm/pg-core";
import { managedSites } from "./managed-sites";
import { webPresences } from "./web-presences";
import { siteChangeEvents, siteChangeRevisions } from "./site-change-proposals";

export const siteContentEvents = pgTable("site_content_events", {
  id: uuid("id").primaryKey(), webPresenceId: uuid("web_presence_id").notNull().references(() => webPresences.id), managedSiteId: uuid("managed_site_id").notNull().references(() => managedSites.id),
  sequence: integer("sequence").notNull(), operation: text("operation").notNull(), requestId: uuid("request_id").notNull(), requestDigest: text("request_digest").notNull(),
  proposalId: uuid("proposal_id").notNull(), revision: integer("revision").notNull(), proposalDigest: text("proposal_digest").notNull(), baseFingerprint: text("base_fingerprint").notNull(),
  approvalEvent: text("approval_event").notNull(), previewDigest: text("preview_digest").notNull(), rollbackOf: uuid("rollback_of").references((): AnyPgColumn => siteContentEvents.id), pageId: uuid("page_id").notNull(),
  beforeFingerprint: text("before_fingerprint").notNull(), afterFingerprint: text("after_fingerprint").notNull(), beforeContent: jsonb("before_content").notNull(), afterContent: jsonb("after_content").notNull(),
  actor: jsonb("actor").notNull(), reference: text("reference").notNull(), at: timestamp("at", { withTimezone: true }).notNull(), previousDigest: text("previous_digest"), digest: text("digest").notNull(),
}, t => [unique("site_content_sequence").on(t.managedSiteId, t.sequence), unique("site_content_request").on(t.managedSiteId, t.requestId), unique("site_content_digest").on(t.managedSiteId, t.digest),
  uniqueIndex("site_content_release_once").on(t.proposalId, t.revision).where(sql`${t.operation}='release'`), uniqueIndex("site_content_rollback_once").on(t.rollbackOf).where(sql`${t.operation}='rollback'`),
  foreignKey({ name: "site_content_revision_fk", columns: [t.proposalId, t.revision, t.proposalDigest, t.baseFingerprint], foreignColumns: [siteChangeRevisions.proposalId, siteChangeRevisions.revision, siteChangeRevisions.digest, siteChangeRevisions.baseFingerprint] }),
  foreignKey({ name: "site_content_approval_fk", columns: [t.proposalId, t.approvalEvent], foreignColumns: [siteChangeEvents.proposalId, siteChangeEvents.digest] }),
  check("site_content_bounds", sql`${t.sequence} BETWEEN 1 AND 256 AND ${t.operation} IN ('release','rollback') AND (${t.operation}='release' AND ${t.rollbackOf} IS NULL OR ${t.operation}='rollback' AND ${t.rollbackOf} IS NOT NULL) AND ${t.requestDigest} ~ '^[a-f0-9]{64}$' AND ${t.beforeFingerprint} ~ '^[a-f0-9]{64}$' AND ${t.afterFingerprint} ~ '^[a-f0-9]{64}$' AND ${t.digest} ~ '^[a-f0-9]{64}$' AND (${t.previousDigest} IS NULL OR ${t.previousDigest} ~ '^[a-f0-9]{64}$') AND length(${t.reference}) BETWEEN 1 AND 500 AND jsonb_typeof(${t.actor})='object' AND octet_length(${t.beforeContent}::text)<=1048576 AND octet_length(${t.afterContent}::text)<=1048576`),
]);
