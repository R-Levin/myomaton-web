import type { PoolClient } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import { readManagedObject } from "../assets/local-storage";
import { validateStoredMedia } from "../assets/media-validation";
import { presentImage } from "../assets/source";
import { choice, fingerprint, object, text, uuid } from "../canonical/model";
import { assets } from "../db/schema/assets";
import { approvedSuppliedEvidence, type SuppliedEvidence } from "../acquisition/supplied-evidence";
import type { Scope } from "./authority";
import { hash, type PageProposal } from "./proposal";
import { resolvePage } from "./proposal-context";
import { releaseEnvironment, type SiteBase } from "./release";

type Usage = {
  id: string;
  web_presence_id: string;
  asset_id: string;
  entity_type: string;
  entity_id: string;
  role: string;
  configuration: unknown;
  metadata: unknown;
  version: number;
  created_at: string;
  updated_at: string;
};

export type ProposalMedia = {
  sectionId: string;
  usageId: string;
  assetId: string;
  role: "image";
  configuration: { image: { altText: string; decorative: false } };
  preparedDigest: string;
  mimeType: "image/png";
  width: number;
  height: number;
  evidence: { source: "synthetic-project-raster"; sourceDigest: string; permission: "disposable-preview-release"; reference: string } | SuppliedEvidence;
  priorUsage: Usage | null;
};

export async function resolveProposalCandidate(c: PoolClient, scope: Scope, page: PageProposal, base: SiteBase, mediaRoot?: string) {
  const resolved = await resolvePage(c, scope, page, base);
  const target = page.sections.find(section => section.image);
  if (!target?.image) return { ...resolved, image: undefined };
  if (!mediaRoot) throw Error("Disposable proposal media is unavailable");
  await requireDisposableMedia(c);
  const priorSections = base.sections.filter(section => section.page_id === page.pageId);
  if (!priorSections.some(section => section.id === target.id && section.type === "intro" && section.status === "active")) {
    throw Error("Media requires an existing active Intro on the disposable Page");
  }
  const { assetId, usageId, altText } = target.image;
  // Include foreign and polymorphic collisions, even if outside the owned baseline.
  const ids = [page.pageId, ...priorSections.map(section => section.id), ...page.sections.map(section => section.id)];
  const usages = (await c.query<{ usage: Usage }>("SELECT to_jsonb(u) AS usage FROM asset_usages u WHERE entity_id=ANY($1::uuid[]) OR id=$2", [ids, usageId])).rows;
  const priorUsage = usages[0]?.usage ?? null;
  if (usages.length > 1 || (priorUsage && (
    priorUsage.id !== usageId || priorUsage.entity_id !== target.id || priorUsage.web_presence_id !== scope.webPresenceId
    || priorUsage.asset_id !== assetId || priorUsage.entity_type !== "section" || priorUsage.role !== "image"
  ))) throw Error("Conflicting or unreviewed AssetUsage");

  const [asset] = await drizzle(c).select().from(assets).where(and(eq(assets.id, assetId), eq(assets.webPresenceId, scope.webPresenceId)));
  const configuration = { image: { altText, decorative: false as const } };
  const image = asset && presentImage(asset, configuration);
  if (!image || asset.mimeType !== "image/png" || (priorUsage && !presentImage(asset, priorUsage.configuration))) {
    throw Error("Eligible owned fixture raster required");
  }
  const metadata = object(asset.metadata, ["proposalFixture", "acquisition"]);
  const preparedDigest = asset.sourceReference.slice("objects/".length);
  let evidence: ProposalMedia["evidence"];
  if (Object.hasOwn(metadata, "acquisition")) {
    if (Object.hasOwn(metadata, "proposalFixture") || (priorUsage && presentImage(asset, priorUsage.configuration)?.alt !== altText)) {
      throw Error("Conflicting supplied-media placement evidence");
    }
    const raw = object(metadata.acquisition, ["candidateId", "subjectDigest", "reviewDigest"]);
    const lineage = { candidateId: uuid(raw.candidateId), subjectDigest: hash(raw.subjectDigest), reviewDigest: hash(raw.reviewDigest) };
    evidence = await approvedSuppliedEvidence(c, { ...scope, pageId: page.pageId, sectionId: target.id }, assetId, lineage,
      { preparedDigest, width: image.width, height: image.height, altText });
  } else {
    const raw = object(metadata.proposalFixture, ["source", "sourceDigest", "permission", "reference"]);
    evidence = {
      source: choice(raw.source, ["synthetic-project-raster"]),
      sourceDigest: hash(raw.sourceDigest),
      permission: choice(raw.permission, ["disposable-preview-release"]),
      reference: text(raw.reference, 300),
    };
  }
  const media: ProposalMedia = {
    sectionId: target.id, usageId, assetId, role: "image", configuration, preparedDigest, mimeType: asset.mimeType,
    width: image.width, height: image.height, evidence, priorUsage,
  };
  return {
    ...resolved,
    candidate: { ...resolved.candidate, media },
    image: { ...image, src: await verifiedProposalImage(mediaRoot, scope, media) },
  };
}

export async function requireDisposableMedia(c: PoolClient) {
  await releaseEnvironment(c, false);
  const local = await c.query("SELECT inet_server_addr() IN ('127.0.0.1'::inet,'::1'::inet) AS loopback");
  if (!local.rows[0]?.loopback) throw Error("Proposal media requires loopback PostgreSQL");
}

export async function verifiedProposalImage(root: string, scope: Scope, media: ProposalMedia) {
  try {
    if (media.mimeType !== "image/png") throw Error("Unsupported fixture format");
    const bytes = await readManagedObject(root, scope.webPresenceId, "objects/" + hash(media.preparedDigest));
    // The approved offline preview carries one bounded raster. No public media URL.
    if (bytes.length > 1024 * 1024) throw Error("Fixture raster exceeds preview limit");
    await validateStoredMedia(bytes, media.mimeType, { width: media.width, height: media.height });
    return `data:${media.mimeType};base64,${bytes.toString("base64")}`;
  } catch {
    throw Error("Prepared media bytes or dimensions failed verification");
  }
}

export function releasedUsage(scope: Scope, media: ProposalMedia, at: string): Usage {
  const prior = media.priorUsage;
  return {
    id: media.usageId, web_presence_id: scope.webPresenceId, asset_id: media.assetId,
    entity_type: "section", entity_id: media.sectionId, role: media.role,
    configuration: media.configuration, metadata: prior?.metadata ?? {},
    version: prior ? prior.version + 1 : 1, created_at: prior?.created_at ?? at, updated_at: at,
  };
}

// The release transaction already excludes concurrent canonical writers. The
// exact prior association is immutable proposal evidence; the ledger's site
// fingerprints include the prior, installed and restored canonical usages.
export async function writeProposalUsage(c: PoolClient, current: Usage | null, desired: Usage | null) {
  const id = desired?.id ?? current?.id;
  const actual = (await c.query("SELECT to_jsonb(u) AS usage FROM asset_usages u WHERE id=$1", [id])).rows[0]?.usage ?? null;
  const expected = current && await normalizeUsage(c, current);
  if (fingerprint(actual) !== fingerprint(expected)) throw Error("Exact prior AssetUsage required");
  if (desired) {
    await c.query(`INSERT INTO asset_usages(id,web_presence_id,asset_id,entity_type,entity_id,role,configuration,metadata,version,created_at,updated_at)
      SELECT id,web_presence_id,asset_id,entity_type,entity_id,role,configuration,metadata,version,created_at,updated_at
      FROM jsonb_populate_record(NULL::asset_usages,$1::jsonb)
      ON CONFLICT (id) DO UPDATE SET configuration=EXCLUDED.configuration,metadata=EXCLUDED.metadata,
        version=EXCLUDED.version,created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at`, [JSON.stringify(desired)]);
  } else {
    await c.query("DELETE FROM asset_usages WHERE id=$1", [id]);
  }
  const written = (await c.query("SELECT to_jsonb(u) AS usage FROM asset_usages u WHERE id=$1", [id])).rows[0]?.usage ?? null;
  if (fingerprint(written) !== fingerprint(desired && await normalizeUsage(c, desired))) throw Error("Exact proposed AssetUsage was not written");
}

async function normalizeUsage(c: PoolClient, usage: Usage) {
  return (await c.query("SELECT to_jsonb(jsonb_populate_record(NULL::asset_usages,$1::jsonb)) AS usage", [JSON.stringify(usage)])).rows[0].usage;
}
