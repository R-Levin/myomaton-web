import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { readManagedObject } from "../assets/local-storage";
import { validateStoredMedia } from "../assets/media-validation";
import { resolveUsageAlt } from "../assets/usage-presentation";
import { fingerprint, object, text, uuid } from "../canonical/model";
import { resolveDesignConfiguration } from "../design-systems/configuration";
import { validateDirection } from "../presentation/plan";
import { contrast, validatePalette } from "../presentation/tokens";

type ReviewedLogo = { assetId: string; usageId: string; sha256: string; alt: string };

/** Translate reviewed Core configuration into a portable, data-only projection.
 * The caller must resolve the approved AssetUsage in the same Managed Site scope. */
export function draftBrand(input: {
  scope: { webPresenceId: string; managedSiteId: string };
  design: unknown;
  visualDirection: unknown;
  logo: ReviewedLogo;
}) {
  const design = input.design as { palette?: unknown; typography?: unknown } | null;
  const { typography } = resolveDesignConfiguration(design);
  if (fingerprint(typography) !== fingerprint(design?.typography)) throw Error("Exact approved typography required");
  const palette = validatePalette(design?.palette);
  if (contrast(palette.brand.background, palette.light.background) < 4.5 ||
      contrast(palette.brand.background, palette.tonal.background) < 4.5) {
    throw Error("Approved link color needs contrast on draft surfaces");
  }
  const { grammar, version, motion } = validateDirection(input.visualDirection);
  const { logo, scope } = input;
  if (!/^[a-f0-9]{64}$/u.test(logo.sha256)) throw Error("Reviewed wordmark digest required");
  const projection = {
    version: 1,
    scope: { webPresenceId: uuid(scope.webPresenceId), managedSiteId: uuid(scope.managedSiteId) },
    logo: { assetId: uuid(logo.assetId), usageId: uuid(logo.usageId), sha256: logo.sha256, alt: text(logo.alt, 160) },
    design: { palette, typography, grammar, version, motion },
  };
  return { digest: fingerprint(projection), projection };
}

const pngLimit = 128 * 1024;
type BrandScope = Parameters<typeof draftBrand>[0]["scope"];

export function readSignedDraftBrand(input: unknown, scope: BrandScope) {
  const brand = object(input, ["digest", "projection", "pngBase64"]);
  const projection = object(brand.projection, ["version", "scope", "logo", "design"]);
  const logo = object(projection.logo, ["assetId", "usageId", "sha256", "alt"]);
  const design = object(projection.design, ["palette", "typography", "grammar", "version", "motion"]);
  const normalized = draftBrand({ scope: { webPresenceId: scope.webPresenceId, managedSiteId: scope.managedSiteId },
    design: { palette: { ...object(design.palette, ["light", "strong", "tonal", "brand", "supporting", "contrast", "border", "muted"]), version: 1 },
      typography: design.typography },
    visualDirection: { contractVersion: 2, grammar: { id: design.grammar, version: design.version }, preferences: { motion: design.motion } },
    logo: { assetId: uuid(logo.assetId), usageId: uuid(logo.usageId), sha256: text(logo.sha256, 64), alt: text(logo.alt, 160) } });
  if (normalized.digest !== brand.digest || normalized.digest !== fingerprint(projection) ||
      typeof brand.pngBase64 !== "string" || brand.pngBase64.length > Math.ceil(pngLimit / 3) * 4) throw Error("Signed brand projection refused");
  const png = Buffer.from(brand.pngBase64, "base64");
  if (png.length < 24 || png.length > pngLimit || png.toString("base64") !== brand.pngBase64 ||
      !png.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) ||
      createHash("sha256").update(png).digest("hex") !== normalized.projection.logo.sha256) throw Error("Signed brand PNG refused");
  return { ...normalized, pngBase64: brand.pngBase64 };
}

export async function resolveSignedDraftBrand(db: PoolClient, scope: BrandScope, wantedDigest: unknown, root: string) {
  const { rows: [brand, duplicate] } = await db.query(`SELECT u.id AS usage_id, a.id AS asset_id, a.source_reference, a.alt_text,
      a.width, a.height, u.configuration AS usage, d.configuration AS design, m.configuration AS site
    FROM managed_sites m
    JOIN design_systems d ON d.web_presence_id=m.web_presence_id AND d.status='active'
    JOIN asset_usages u ON u.web_presence_id=m.web_presence_id AND u.entity_id=m.web_presence_id
      AND u.entity_type='web_presence' AND u.role='logo'
    JOIN assets a ON a.id=u.asset_id AND a.web_presence_id=m.web_presence_id
    WHERE m.id=$1 AND m.web_presence_id=$2 AND a.status='active' AND a.type='image' AND a.mime_type='image/png'
      AND a.source_type='managed' AND NOT (a.metadata ? 'acquisition')`, [scope.managedSiteId, scope.webPresenceId]);
  if (!brand || duplicate) throw Error("One owned canonical brand AssetUsage required");
  const png = await readManagedObject(root, scope.webPresenceId, brand.source_reference);
  if (png.length > pngLimit) throw Error("Canonical brand PNG exceeds draft envelope");
  await validateStoredMedia(png, "image/png", { width: brand.width, height: brand.height });
  const prepared = draftBrand({ scope, design: brand.design, visualDirection: brand.site.visualDirection,
    logo: { assetId: brand.asset_id, usageId: brand.usage_id, sha256: brand.source_reference.slice(8),
      alt: text(resolveUsageAlt(brand.alt_text, brand.usage), 160) } });
  if (prepared.digest !== wantedDigest) throw Error("Canonical brand differs from reviewed projection");
  return { ...prepared, pngBase64: png.toString("base64") };
}
