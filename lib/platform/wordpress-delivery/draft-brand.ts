import { fingerprint, text, uuid } from "../canonical/model";
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
