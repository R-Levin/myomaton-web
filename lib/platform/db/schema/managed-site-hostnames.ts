import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, unique, check, foreignKey, index } from "drizzle-orm/pg-core";
import { managedSites } from "./managed-sites";

// Registry entries are operator-managed data, never inferred from customer copy.
export const managedSiteHostnames = pgTable("managed_site_hostnames", {
  id: uuid("id").defaultRandom().primaryKey(),
  hostname: text("hostname").notNull(),
  webPresenceId: uuid("web_presence_id").notNull(),
  managedSiteId: uuid("managed_site_id").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  unique("managed_site_hostname_unique").on(t.hostname),
  foreignKey({ name: "hostname_site_owner_fk", columns: [t.webPresenceId, t.managedSiteId], foreignColumns: [managedSites.webPresenceId, managedSites.id] }),
  index("hostname_owner_site").on(t.webPresenceId, t.managedSiteId),
  check("hostname_status", sql`${t.status} IN ('active','inactive')`),
  check("hostname_normalized", sql`length(${t.hostname}) >= 3 AND length(${t.hostname}) <= 253 AND ${t.hostname} = lower(${t.hostname}) AND ${t.hostname} ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$' AND ${t.hostname} !~ '(^|\\.)xn--' AND ${t.hostname} !~ '^[0-9.]+$'`),
]);
