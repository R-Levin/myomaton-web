import type { PoolClient } from "pg";
import { fingerprint } from "../canonical/model";
import { record } from "../presentation/content";
import { candidateSubject, type Candidate } from "./service";
import type { Scope } from "../content-editing/authority";

export const suppliedPolicy = "disposable-supplied-raster/1";

export type SuppliedPlacement = Scope & { pageId: string; sectionId: string };
export type SuppliedSource = {
  kind: "upload" | "website-reuse" | "authorized-asset";
  reference: string;
  suppliedBy: string;
  claim: "ownership" | "license" | "specific-permission";
  evidenceReference: string | null;
  existingAssetId: string | null;
};
export type SuppliedProvenance = {
  source: SuppliedSource;
  sourceDigest: string;
  originalAssetDigest: string | null;
  transformation: "managed-raster-prepare/1" | "reuse-prepared/1";
  receivedBy: { operatorId: string; authorityReference: string };
  placement: SuppliedPlacement;
  role: "image";
};
export type SuppliedDecision = {
  decision: "approve" | "reject" | "revoke";
  requestDigest: string;
  subjectDigest: string;
  actor: { operatorId: string; authorityReference: string };
  reason: string;
  rights: { basis: "customer-attestation" | "independently-verified"; reference: string } | null;
  altText: string | null;
};
export type SuppliedLineage = { candidateId: string; subjectDigest: string; reviewDigest: string };
export type SuppliedEvidence = {
  source: "customer-supplied";
  sourceDigest: string;
  permission: "disposable-preview-release";
  reference: string;
  sourceKind: SuppliedSource["kind"];
  rightsBasis: NonNullable<SuppliedDecision["rights"]>["basis"];
  lineage: SuppliedLineage;
};

export function suppliedSubjectMatches(candidate: Candidate) {
  return candidate.source_kind === "customer-supplied" && candidate.policy_version === suppliedPolicy
    && candidate.quarantine_key === "objects/" + candidate.bytes_digest
    && candidate.subject_digest === candidateSubject(candidate)
    && candidate.provenance_digest === fingerprint(candidate.provenance)
    && candidate.expires_at.getTime() > Date.now();
}

export async function originalAsset(db: PoolClient, owner: string, id: string) {
  const rows = await db.query("SELECT to_jsonb(a) AS asset FROM assets a WHERE id=$1 AND web_presence_id=$2 AND status='active' AND type='image' AND mime_type='image/png' AND source_type='managed'", [id, owner]);
  const asset = rows.rows[0]?.asset;
  if (!asset || Object.hasOwn(record(asset.metadata), "acquisition")) throw Error("Eligible owned source Asset required");
  return asset as { source_reference: string; width: number; height: number };
}

export async function suppliedDecision(db: PoolClient, candidate: Candidate, decision: SuppliedDecision["decision"]): Promise<SuppliedDecision | null> {
  const rows = await db.query("SELECT payload FROM external_work_events WHERE web_presence_id=$1 AND work_id=$2 AND candidate_id=$3 AND kind='decision' AND payload->>'decision'=$4 LIMIT 2",
    [candidate.web_presence_id, candidate.work_id, candidate.id, decision]);
  if (rows.rows.length > 1) throw Error("Ambiguous supplied-media decision");
  return rows.rows[0]?.payload ?? null;
}

export async function approvedSuppliedEvidence(db: PoolClient, placement: SuppliedPlacement, assetId: string, lineage: SuppliedLineage, image: { preparedDigest: string; width: number; height: number; altText: string }): Promise<SuppliedEvidence> {
  // A concurrent revocation must serialize with a disposable release.
  const rows = await db.query(`SELECT c.* FROM media_candidates c JOIN external_work w
    ON w.id=c.work_id AND w.web_presence_id=c.web_presence_id
    WHERE c.id=$1 AND c.web_presence_id=$2 AND w.capability='supplied-raster' AND w.status='completed' FOR SHARE OF c`,
  [lineage.candidateId, placement.webPresenceId]);
  const candidate = rows.rows[0] as Candidate | undefined;
  if (!candidate || candidate.state !== "ingested" || !suppliedSubjectMatches(candidate)
    || candidate.subject_digest !== lineage.subjectDigest || candidate.bytes_digest !== image.preparedDigest
    || candidate.width !== image.width || candidate.height !== image.height || candidate.mime_type !== "image/png") {
    throw Error("Current supplied-media permission and exact prepared candidate required");
  }
  const provenance = candidate.provenance as unknown as SuppliedProvenance;
  const decision = await suppliedDecision(db, candidate, "approve");
  if (provenance.role !== "image" || fingerprint(provenance.placement) !== fingerprint(placement) || !decision?.rights || decision.decision !== "approve"
    || decision.subjectDigest !== lineage.subjectDigest || fingerprint(decision) !== lineage.reviewDigest || decision.altText !== image.altText) {
    throw Error("Exact supplied-media rights review, placement and alt text required");
  }
  const events = await db.query(`SELECT 1 FROM external_work_events WHERE web_presence_id=$1 AND work_id=$2 AND candidate_id=$3
    AND kind='ingestion' AND payload->>'assetId'=$4 AND payload->>'reviewDigest'=$5 AND payload->>'preparedDigest'=$6`,
  [placement.webPresenceId, candidate.work_id, candidate.id, assetId, lineage.reviewDigest, image.preparedDigest]);
  if (events.rowCount !== 1) throw Error("Exact supplied-media ingestion evidence required");
  if (provenance.source.existingAssetId &&
    fingerprint(await originalAsset(db, placement.webPresenceId, provenance.source.existingAssetId)) !== provenance.originalAssetDigest) {
    throw Error("Supplied-media source Asset changed");
  }
  return { source: "customer-supplied", sourceDigest: provenance.sourceDigest, permission: "disposable-preview-release",
    reference: decision.rights.reference, rightsBasis: decision.rights.basis, sourceKind: provenance.source.kind, lineage };
}
