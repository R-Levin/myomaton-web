import { key, object, text } from "../canonical/model";
import { hash } from "../content-editing/proposal";

export const stockPolicy = "disposable-permissioned-stock/1";

export type StockSelection = {
  provider: string;
  sourceId: string;
  sourceUrl: string;
  creator: string | null;
  representation: { id: string; sourceDigest: string };
  license: { reference: string; use: string; copy: "allowed" | "prohibited"; expiresAt: string };
  integration: { reference: string; delivery: "managed-copy" | "provider-hosted-only"; attribution: "optional" | "required" };
};

// The current verifier accepts only the locally declared project grant. A real
// adapter needs a separately reviewed license and integration policy.
export function eligibleStock(value: unknown): StockSelection {
  const raw = object(value, ["provider", "sourceId", "sourceUrl", "creator", "representation", "license", "integration"]);
  const provider = key(raw.provider);
  const url = new URL(text(raw.sourceUrl, 500));
  if (!provider.startsWith("synthetic-") || url.protocol !== "https:" || !url.hostname.endsWith(".invalid")
    || url.username || url.password || url.port || url.search || url.hash) throw Error("Synthetic stock source required");
  const representation = object(raw.representation, ["id", "sourceDigest"]);
  const license = object(raw.license, ["reference", "use", "copy", "expiresAt"]);
  const integration = object(raw.integration, ["reference", "delivery", "attribution"]);
  if (license.reference !== "synthetic-project-permission/1" || license.use !== "disposable-intro-image"
    || license.copy !== "allowed" || integration.reference !== "synthetic-local-integration/1"
    || integration.delivery !== "managed-copy" || integration.attribution !== "optional") {
    throw Error("Unsupported stock license or integration obligations");
  }
  const expiresAt = text(license.expiresAt, 32);
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry) || new Date(expiry).toISOString() !== expiresAt || expiry <= Date.now()) {
    throw Error("Current stock permission required");
  }
  return { provider, sourceId: text(raw.sourceId, 120), sourceUrl: url.href,
    creator: raw.creator === null ? null : text(raw.creator, 200),
    representation: { id: text(representation.id, 120), sourceDigest: hash(representation.sourceDigest) },
    license: { reference: license.reference, use: license.use, copy: license.copy, expiresAt },
    integration: { reference: integration.reference, delivery: integration.delivery, attribution: integration.attribution } };
}
