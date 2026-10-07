import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, jsonb, timestamp, check, unique, foreignKey } from "drizzle-orm/pg-core";
import { webPresences } from "./web-presences";

const current = () => ({ id: uuid("id").defaultRandom().primaryKey(), webPresenceId: uuid("web_presence_id").notNull().references(() => webPresences.id),
  contractVersion: integer("contract_version").notNull().default(1), payload: jsonb("payload").notNull(), version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow() });
export const businessKnowledge = pgTable("business_knowledge", current(), t => [
  unique("business_knowledge_presence_unique").on(t.webPresenceId), unique("business_knowledge_owner_identity").on(t.webPresenceId,t.id),
  check("business_knowledge_versions", sql`${t.version}>0 AND ${t.contractVersion}=1`), check("business_knowledge_payload", sql`jsonb_typeof(${t.payload})='object'`) ]);
export const offerings = pgTable("offerings", { ...current(), key: text("key").notNull(), type: text("type").notNull(), name: text("name").notNull(), status: text("status").notNull() }, t => [
  unique("offerings_presence_key").on(t.webPresenceId,t.key), unique("offerings_owner_identity").on(t.webPresenceId,t.id),
  check("offerings_versions", sql`${t.version}>0 AND ${t.contractVersion}=1`), check("offerings_payload", sql`jsonb_typeof(${t.payload})='object'`),
  check("offerings_type", sql`${t.type} IN ('service','product')`), check("offerings_status", sql`${t.status} IN ('active','inactive')`),
  check("offerings_key", sql`${t.key} ~ '^[a-z][a-z0-9_-]{0,63}$'`), check("offerings_name", sql`length(btrim(${t.name})) BETWEEN 1 AND 200`) ]);
const revision = () => ({ webPresenceId: uuid("web_presence_id").notNull(), revisionVersion: integer("revision_version").notNull(), snapshot: jsonb("snapshot").notNull(),
  changeReason: text("change_reason").notNull(), responsibleIdentity: text("responsible_identity").notNull(), recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow() });
export const businessKnowledgeRevisions = pgTable("business_knowledge_revisions", { ...revision(), knowledgeId: uuid("knowledge_id").notNull() }, t => [
  unique("knowledge_revision_unique").on(t.knowledgeId,t.revisionVersion), foreignKey({ columns: [t.webPresenceId,t.knowledgeId], foreignColumns: [businessKnowledge.webPresenceId,businessKnowledge.id] }),
  check("knowledge_revision_version", sql`${t.revisionVersion}>0`), check("knowledge_revision_snapshot", sql`jsonb_typeof(${t.snapshot})='object'`),
  check("knowledge_revision_identity", sql`${t.snapshot} ? 'id' AND ${t.snapshot} ? 'web_presence_id' AND ${t.snapshot} ? 'version' AND ${t.snapshot}->>'id' = ${t.knowledgeId}::text AND ${t.snapshot}->>'web_presence_id' = ${t.webPresenceId}::text AND (${t.snapshot}->>'version')::integer = ${t.revisionVersion}`),
  check("knowledge_revision_attestation", sql`length(btrim(${t.changeReason})) BETWEEN 1 AND 1000 AND length(btrim(${t.responsibleIdentity})) BETWEEN 1 AND 200`) ]);
export const offeringRevisions = pgTable("offering_revisions", { ...revision(), offeringId: uuid("offering_id").notNull() }, t => [
  unique("offering_revision_unique").on(t.offeringId,t.revisionVersion), foreignKey({ columns: [t.webPresenceId,t.offeringId], foreignColumns: [offerings.webPresenceId,offerings.id] }),
  check("offering_revision_version", sql`${t.revisionVersion}>0`), check("offering_revision_snapshot", sql`jsonb_typeof(${t.snapshot})='object'`),
  check("offering_revision_identity", sql`${t.snapshot} ? 'id' AND ${t.snapshot} ? 'web_presence_id' AND ${t.snapshot} ? 'version' AND ${t.snapshot}->>'id' = ${t.offeringId}::text AND ${t.snapshot}->>'web_presence_id' = ${t.webPresenceId}::text AND (${t.snapshot}->>'version')::integer = ${t.revisionVersion}`),
  check("offering_revision_attestation", sql`length(btrim(${t.changeReason})) BETWEEN 1 AND 1000 AND length(btrim(${t.responsibleIdentity})) BETWEEN 1 AND 200`) ]);
