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

export const pixabayPrivatePolicy = "disposable-pixabay/1";
export const declinedPixabayIds = ["384740", "6389104", "7642551"] as const;
export function stockPolicyFor(selection: Pick<StockSelection, "provider">) {
  return selection.provider === "pixabay" ? pixabayPrivatePolicy : stockPolicy;
}
// Pixabay is eligible here only for the disposable private evaluation. The
// existing scoped intake, explicit rights review and publication guards apply.
export function eligibleStock(value: unknown): StockSelection {
  const raw = object(value, ["provider", "sourceId", "sourceUrl", "creator", "representation", "license", "integration"]);
  const provider = key(raw.provider);
  const url = new URL(text(raw.sourceUrl, 500));
  const pixabay = provider === "pixabay";
  const id = text(raw.sourceId, 120);
  const permittedSource = pixabay ? url.hostname === "pixabay.com" && /^[1-9][0-9]*$/u.test(id) &&
    /^\/photos\/[a-z0-9-]+\/$/u.test(url.pathname) && url.pathname.endsWith("-" + id + "/") &&
    !declinedPixabayIds.some(rejected => rejected === id) : provider.startsWith("synthetic-") && url.hostname.endsWith(".invalid");
  if (!permittedSource || url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) {
    throw Error("Synthetic stock source or permitted private Pixabay source required");
  }
  const representation = object(raw.representation, ["id", "sourceDigest"]);
  const license = object(raw.license, ["reference", "use", "copy", "expiresAt"]);
  const integration = object(raw.integration, ["reference", "delivery", "attribution"]);
  if (license.reference !== (pixabay ? "https://pixabay.com/service/license-summary/" : "synthetic-project-permission/1") ||
    license.use !== (pixabay ? "isolated-private-site-evaluation" : "disposable-intro-image")
    || license.copy !== "allowed" || integration.reference !== (pixabay ? "https://pixabay.com/api/docs/" : "synthetic-local-integration/1")
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
    license: { reference: text(license.reference, 200), use: text(license.use, 120), copy: license.copy, expiresAt },
    integration: { reference: text(integration.reference, 200), delivery: integration.delivery, attribution: integration.attribution } };
}
