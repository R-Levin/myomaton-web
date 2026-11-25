import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { writeCanonical } from "../canonical/writes";

/**
 * Bring onboarding done outside Core into an Account's Knowledge (rebuild plan: C0). The material
 * is data: Knowledge entries as the Client confirmed them, and Offerings. It goes through the same
 * Knowledge writer as everything else, with fresh record identities on this Account, so the same
 * data can be loaded into any Account (a test database, or the real one). Importing twice is
 * refused rather than silently doubled.
 */
export type OnboardingData = {
  knowledge: { payload: unknown };
  offerings: { key: string; type: "service" | "product"; name: string; status: "active" | "inactive"; payload: unknown }[];
};

export async function importOnboarding(pool: Pool, webPresenceId: string, data: OnboardingData, by: string, reason: string) {
  const { rows: [existing] } = await pool.query("SELECT 1 FROM business_knowledge WHERE web_presence_id=$1 LIMIT 1", [webPresenceId]);
  if (existing) throw Error("This Account already has Knowledge; add to it through Requests instead");
  // The record names who confirmed the material (the Client); who carried it in goes in the reason.
  const confirmedBy = (payload: unknown) => (payload as { approval?: { by?: string } }).approval?.by ?? by;
  reason = `${reason} (imported by ${by})`;
  const knowledgeId = randomUUID();
  await writeCanonical(pool, { domain: "knowledge", id: knowledgeId, webPresenceId, expectedVersion: null, expectedFingerprint: null,
    payload: data.knowledge.payload, responsibleIdentity: confirmedBy(data.knowledge.payload), changeReason: reason });
  const offeringIds: string[] = [];
  for (const offering of data.offerings) {
    const id = randomUUID();
    // Links to Actions belong to a built site, which this Account does not have yet; Core sets them when it builds one.
    const payload = { ...(offering.payload as Record<string, unknown>), actionIds: [] };
    await writeCanonical(pool, { domain: "offering", id, webPresenceId, expectedVersion: null, expectedFingerprint: null, payload,
      offering: { key: offering.key, type: offering.type, name: offering.name, status: offering.status }, responsibleIdentity: confirmedBy(offering.payload), changeReason: reason });
    offeringIds.push(id);
  }
  return { knowledgeId, offeringIds };
}

/** Onboarding data from a reviewed Client manifest file (C0's is one such file; nothing here is specific to it). */
export function onboardingFromManifest(manifest: { knowledge: { payload: unknown }; offering?: OnboardingData["offerings"][number];
  offerings?: OnboardingData["offerings"] }): OnboardingData {
  const offerings = manifest.offerings ?? (manifest.offering ? [manifest.offering] : []);
  return { knowledge: { payload: manifest.knowledge.payload }, offerings: offerings.map(({ key, type, name, status, payload }) => ({ key, type, name, status, payload })) };
}
