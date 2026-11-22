import { createHash, createPrivateKey, createPublicKey } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { designProjection } from "../design-systems/site-design";
import { workflowNativeReviewCandidate } from "../intake/presence-workflow-delivery";
import type { PresenceWorkflowView, WorkflowContext } from "../intake/presence-workflow";
import { draftBrand } from "./draft-brand";
import { reviewDraftEnvelope } from "./native-draft-envelope";
import { fetchReadback, summarizeReadback, type Readback } from "./readback";
import { bindReviewDraft } from "./review-draft";
import { sendSignedDraft, type WordPressTarget } from "./review-delivery";

/**
 * Core's Operator actions for review drafts (hosted-delivery plan steps 5 and 6):
 * send the case's current site to its Operator WordPress, and read the Operator's edits
 * and Notes back. Called by the Core server (today its worker command; later the
 * Operator portal). The site's settings live in Core's protected configuration on the
 * Core server, never on a developer's computer.
 */
export type OperatorSiteConfig = {
  name: string;
  origin: string;
  gate?: { user: string; password: string };
  organizationId: string;
  installationId: string;
  /** Stable review stream for this case on this site. */
  streamId: string;
  keyId: string;
  /** Core's Ed25519 signing key for this site (PKCS#8 DER, base64) and its public half. */
  signingKeyPkcs8Base64: string;
  publicKeyBase64: string;
  /** Shared key WordPress signs its receipts and read-back answers with. */
  receiptSecretHex: string;
  /** The reviewed wordmark the site carries (a PNG Core holds). */
  logo: { assetId: string; usageId: string; alt: string; file: string; sha256: string };
};

export type ReviewDeliveryState = { site: string; installationId: string; streamId: string; revision: number; digest: string;
  workflowVersion: number; pages: { path: string; id: string }[]; deliveredAt: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export function readOperatorSiteConfig(value: unknown): OperatorSiteConfig {
  const config = value as OperatorSiteConfig;
  const ok = config && typeof config === "object" && /^[a-z0-9-]{1,40}$/u.test(config.name) && typeof config.origin === "string" &&
    [config.organizationId, config.installationId, config.streamId, config.logo?.assetId, config.logo?.usageId].every(id => typeof id === "string" && uuidPattern.test(id)) &&
    typeof config.keyId === "string" && /^[a-f0-9]{64}$/u.test(config.receiptSecretHex) && typeof config.publicKeyBase64 === "string" &&
    typeof config.logo?.file === "string" && isAbsolute(config.logo.file) && /^[a-f0-9]{64}$/u.test(config.logo.sha256) &&
    typeof config.logo.alt === "string" && config.logo.alt.trim() !== "" &&
    (config.gate === undefined || (typeof config.gate.user === "string" && typeof config.gate.password === "string"));
  if (!ok) throw Error("Operator site configuration refused");
  const key = signingKey(config);
  if (createPublicKey(key).export({ format: "jwk" }).x !== Buffer.from(config.publicKeyBase64, "base64").toString("base64url")) {
    throw Error("Operator site signing key does not match its public key");
  }
  return config;
}

const samePaths = (before: { path: string }[], after: { path: string }[]) =>
  JSON.stringify(before.map(page => page.path).sort()) === JSON.stringify(after.map(page => page.path).sort());
const signingKey = (config: OperatorSiteConfig) =>
  createPrivateKey({ key: Buffer.from(config.signingKeyPkcs8Base64, "base64"), format: "der", type: "pkcs8" });
const target = (config: OperatorSiteConfig): WordPressTarget => ({ origin: config.origin, ...(config.gate && { gate: config.gate }) });

export async function readBackOperatorSite(config: OperatorSiteConfig, fetcher: typeof fetch = fetch) {
  const readback = await fetchReadback(target(config), config.installationId, config.keyId, signingKey(config),
    Buffer.from(config.receiptSecretHex, "hex"), fetcher);
  return { readback, summary: summarizeReadback(readback) };
}

/**
 * Send the case's current site as the next review draft. Pages the Operator edited may be
 * replaced only after Core took that review in (applyOperatorReview), and only if nothing
 * changed since: Operator work is never overwritten unread (WordPress checks too). Notes
 * Core acted on are answered and resolved with this delivery.
 */
export async function deliverReviewDraft(input: { config: OperatorSiteConfig; context: WorkflowContext; view: PresenceWorkflowView;
  state: ReviewDeliveryState | null; fetcher?: typeof fetch; now?: Date }) {
  const { config, context, view, state } = input;
  const fetcher = input.fetcher ?? fetch;
  if (view.visuals?.some(visual => visual.state === "approved")) {
    throw Error("This case has approved images; image delivery over the web endpoint is not built yet");
  }
  if (!view.direction?.design) throw Error("Core's chosen design is required for a review draft");
  if (state && (state.installationId !== config.installationId || state.streamId !== config.streamId)) {
    throw Error("Recorded delivery belongs to another site or stream");
  }
  let readback: Readback | null = null;
  if (state) {
    readback = (await readBackOperatorSite(config, fetcher)).readback;
    if (readback.revision !== state.revision || readback.digest !== state.digest) {
      throw Error("Operator WordPress no longer holds Core's last delivery; read it back and reconcile first");
    }
  }
  const taken = state ? view.wordpressReviews?.filter(review => review.readbackRevision === state.revision).at(-1) : undefined;
  if (readback) {
    const changed = readback.pages.filter(page => page.edited || page.missing);
    if (changed.length && !taken) {
      throw Error("Operator edits on " + changed.map(page => page.path).join(", ") + " must be taken into Core before the next delivery");
    }
    const since = changed.filter(page => page.missing || !taken!.acknowledged.some(read => read.path === page.path &&
      read.contentSha256 === page.contentSha256 && read.title === page.title));
    if (since.length) throw Error("The Operator changed " + since.map(page => page.path).join(", ") + " after Core took in the review; take in the new changes first");
  }
  const logoPng = await readFile(input.config.logo.file);
  if (createHash("sha256").update(logoPng).digest("hex") !== config.logo.sha256) throw Error("Wordmark file differs from configuration");
  const site = { organizationId: config.organizationId, ...context.scope };
  const brand = { ...draftBrand({ scope: site, coreDesign: designProjection(view.direction.design),
    logo: { assetId: config.logo.assetId, usageId: config.logo.usageId, sha256: config.logo.sha256, alt: config.logo.alt } }),
    pngBase64: logoPng.toString("base64") };
  const review = workflowNativeReviewCandidate(context, view);
  const draft = bindReviewDraft({ site, installationId: config.installationId, streamId: config.streamId,
    revision: (state?.revision ?? 0) + 1, previousDigest: state?.digest ?? null,
    source: { intakeId: context.intakeId, workflowVersion: view.version }, review, brand,
    ...(taken && { readBack: { revision: state!.revision, pages: taken.acknowledged },
      answeredNotes: taken.notes.map(note => ({ id: note.id, reply: note.revised
        ? "MioPages Core revised this page in response to this note. Please review the new version."
        : "MioPages Core has taken this note into the site." })) }),
    // When Core adds or retires pages, WordPress needs the previous page set: retired
    // drafts are archived there, never deleted.
    ...(state && !samePaths(state.pages, review.candidate.pages) && { baselinePages: state.pages }) });
  const wire = reviewDraftEnvelope(draft, config.keyId, config.publicKeyBase64, signingKey(config));
  const paths = draft.candidate.pages.map(page => page.path);
  const pages = draft.candidate.pages.map(page => ({ path: page.path, id: page.id }));
  const receipt = await sendSignedDraft(target(config), wire, Buffer.from(config.receiptSecretHex, "hex"), {
    installationId: config.installationId, siteProposalId: config.streamId, operation: "apply", requestedDigest: draft.digest,
    appliedDigest: draft.digest, revision: draft.candidate.revision, paths, brandDigest: brand.digest }, fetcher);
  const next: ReviewDeliveryState = { site: config.name, installationId: config.installationId, streamId: config.streamId,
    revision: receipt.revision, digest: receipt.appliedDigest, workflowVersion: view.version, pages,
    deliveredAt: (input.now ?? new Date()).toISOString() };
  return { state: next, receipt };
}
