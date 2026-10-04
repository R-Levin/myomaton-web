import { and, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { contactDefinitions } from "../db/schema/contact-definitions";
import { normalizeDefinition, type ContactPresentation } from "./model";
import { actionId } from "../actions/model";
import { object, resolveBusinessIdentity } from "../site-globals/model";

// Caller supplies Sections already resolved in the selected active site/page.
// Return a public DTO only: never expose the stored delivery route.
export async function contactPresentations(db: NodePgDatabase, presence: { id: string; name: string; configuration: unknown },
  sections: { id: string; type: string; content: unknown }[]): Promise<Map<string, ContactPresentation>> {
  const targets = sections.filter(s => s.type === "contact").map(s => ({ sectionId: s.id, id: actionId(object(s.content).contact_definition_id) }));
  const ids = [...new Set(targets.flatMap(s => s.id ? [s.id] : []))];
  const output = new Map<string, ContactPresentation>();
  if (!ids.length) return output; // Existing sites work before the additive migration is applied.
  const rows = await db.select({ id: contactDefinitions.id, version: contactDefinitions.version, status: contactDefinitions.status, configuration: contactDefinitions.configuration })
    .from(contactDefinitions).where(and(eq(contactDefinitions.webPresenceId, presence.id), eq(contactDefinitions.status, "active"), inArray(contactDefinitions.id, ids)));
  for (const target of targets) {
    const row = rows.find(r => r.id === target.id); if (!row) continue;
    try { output.set(target.sectionId, { sectionId: target.sectionId, definition: normalizeDefinition(row), identity: resolveBusinessIdentity(presence.configuration, presence.name, "") }); }
    catch { /* Invalid definition omits form, not surrounding Section copy. */ }
  }
  return output;
}
