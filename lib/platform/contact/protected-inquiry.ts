import type { PoolClient } from "pg";
import { fingerprint } from "../canonical/model";
import { normalizeDefinition, normalizeFields } from "./model";
import { storeContactSubmission } from "./submissions";
import type { DeploymentSelection } from "../managed-sites/deployment";

const definition = normalizeDefinition({ id: "e113a3ed-ca49-4f23-9c25-2ffd40443c55", status: "active", version: 1,
  configuration: { fields: [{ key: "message", label: "Synthetic inquiry", required: true }] } });
const sample = "Before I get in touch, what should I bring if I already have a website?";

export async function protectedInquiry(db: Pick<PoolClient, "query">, scope: DeploymentSelection, revision: {
  installationId: string; siteProposalId: string; appliedDigest: string; revision: number;
}, accept = false) {
  // Stable across retries and separate for each verified private revision.
  const key = "dev_" + fingerprint({ scope, revision, definition: definition.id });
  const now = new Date();
  const existing = async () => (await db.query<{ id: string; created: string; unexpired: boolean }>(
    `SELECT id, created_at::text AS created, expires_at > now() AS unexpired
     FROM miopages_wp.core_development_inquiries
     WHERE web_presence_id=$1 AND managed_site_id=$2 AND contact_definition_id=$3 AND idempotency_key=$4`,
    [scope.webPresenceId, scope.managedSiteId, definition.id, key],
  )).rows[0];
  let row = await existing();
  if (!row && accept) {
    const result = await storeContactSubmission(db, { ...scope, definition, pageId: null, sectionId: null,
      fields: normalizeFields({ message: sample }, definition), route: null, idempotencyKey: key, now,
      expires: new Date(now.getTime() + 86_400_000),
    }, "protected-development");
    row = await existing();
    if (row?.id !== result.id) throw Error("Protected inquiry did not reconcile");
  }
  return {
    source: "synthetic-development" as const, draft: revision, accepted: row?.unexpired ? 1 : 0,
    notification: "disabled" as const, visitorActivity: "not collected" as const, customerOutcomes: "unknown" as const,
    recommendation: row?.unexpired ? {
      evidenceId: row.id, acceptedAt: row.created, proposal: "Explain what a visitor with an existing website should bring to the first conversation.",
      successCheck: "Review whether that handoff is clear in the next private revision.",
      suggestedSection: {
        heading: "If you already have a website",
        body: "Bring your website address and tell us what you most want visitors to do. We can start by looking at what to keep and what needs attention.",
      },
      uncertainty: "One synthetic inquiry cannot measure demand, conversion or customer outcomes.",
    } : null,
  };
}
