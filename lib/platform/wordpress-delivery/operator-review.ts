import { createHash, createPrivateKey, createPublicKey } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { designProjection } from "../design-systems/site-design";
import { reviewSummaryPage, reviewSummaryPath, workflowNativeReviewCandidate } from "../intake/presence-workflow-delivery";
import { operatorFeedbackFromCandidate } from "../intake/operator-feedback";
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

export const samePaths = (before: { path: string }[], after: { path: string }[]) =>
  JSON.stringify(before.map(page => page.path).sort()) === JSON.stringify(after.map(page => page.path).sort());
export const signingKey = (config: OperatorSiteConfig) =>
  createPrivateKey({ key: Buffer.from(config.signingKeyPkcs8Base64, "base64"), format: "der", type: "pkcs8" });
export const deliveryTarget = (config: OperatorSiteConfig): WordPressTarget => ({ origin: config.origin, ...(config.gate && { gate: config.gate }) });

export async function readBackOperatorSite(config: OperatorSiteConfig, fetcher: typeof fetch = fetch) {
  const readback = await fetchReadback(deliveryTarget(config), config.installationId, config.keyId, signingKey(config),
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
  // Notes on the Review summary are recorded when the Operator decides, but the summary page is
  // retired with the next delivery, so they are answered when the page is delivered again.
  const current = taken && !taken.deferNotes ? taken.notes.map(note => ({ id: note.id, reply: noteReply(note,
    view.widerChanges?.filter(change => change.path === note.path && change.reviewAt === taken.at) ?? []) })) : [];
  const earlier = review.candidate.pages.some(page => page.path === reviewSummaryPath) ? (view.wordpressReviews ?? [])
    .flatMap(item => item.notes.filter(note => note.path === reviewSummaryPath && note.reply && !current.some(answer => answer.id === note.id)))
    .map(note => ({ id: note.id, reply: note.reply! })) : [];
  const answeredNotes = [...current, ...earlier];
  const draft = bindReviewDraft({ site, installationId: config.installationId, streamId: config.streamId,
    revision: (state?.revision ?? 0) + 1, previousDigest: state?.digest ?? null,
    source: { intakeId: context.intakeId, workflowVersion: view.version }, review, brand,
    // Notes taken into a review round stay open until the Operator decides on its Review summary.
    ...(taken && { readBack: { revision: state!.revision, pages: taken.acknowledged } }),
    ...(answeredNotes.length && { answeredNotes }),
    // When Core adds or retires pages, WordPress needs the previous page set: retired
    // drafts are archived there, never deleted.
    ...(state && !samePaths(state.pages, review.candidate.pages) && { baselinePages: state.pages }) });
  const wire = reviewDraftEnvelope(draft, config.keyId, config.publicKeyBase64, signingKey(config));
  const paths = draft.candidate.pages.map(page => page.path);
  const pages = draft.candidate.pages.map(page => ({ path: page.path, id: page.id }));
  const receipt = await sendSignedDraft(deliveryTarget(config), wire, Buffer.from(config.receiptSecretHex, "hex"), {
    installationId: config.installationId, siteProposalId: config.streamId, operation: "apply", requestedDigest: draft.digest,
    appliedDigest: draft.digest, revision: draft.candidate.revision, paths, brandDigest: brand.digest }, fetcher);
  const next: ReviewDeliveryState = { site: config.name, installationId: config.installationId, streamId: config.streamId,
    revision: receipt.revision, digest: receipt.appliedDigest, workflowVersion: view.version, pages,
    deliveredAt: (input.now ?? new Date()).toISOString() };
  return { state: next, receipt };
}

/** Core's reply on an Operator Note it acted on, including any wider change it proposes rather than makes. */
export function noteReply(note: { revised: boolean; sectionOnly?: boolean; reply?: string }, wider: readonly { reason: string }[]) {
  if (note.reply) return note.reply;
  if (!note.revised) return "MioPages Core has taken this note into the site.";
  const done = note.sectionOnly
    ? "MioPages Core revised the section this note is on and left the rest of the page as it was. Please review the new version."
    : "MioPages Core revised this page in response to this note. Please review the new version.";
  if (!wider.length) return done;
  const reason = wider.map(change => change.reason).join(" ");
  // WordPress replies are limited to 2,000 bytes; the full reason stays in Core's record.
  const clipped = Buffer.byteLength(reason) > 1400 ? Buffer.from(reason).subarray(0, 1400).toString("utf8").replace(/�*$/u, "") + "…" : reason;
  return done + " Core also suggests a wider change, not made: " + clipped + " Add a note if you want it done.";
}

/**
 * Read the Operator's answers on the Review summary from the Notes left on it (owner decision,
 * Nov 23): "Approve" on the opening paragraph approves; "No" on an item leaves it out; other text
 * on a fact corrects it; other text on a change adds to it. Each Note gets a reply saying what was recorded.
 */
/**
 * The Operator's decision on the Review summary, read from WordPress (no AI call). Refuses while
 * other pages carry edits or Notes Core has not taken in; Notes on the summary answered in an earlier
 * round are ignored.
 */
export function reviewDecisionFromReadback(context: WorkflowContext, view: PresenceWorkflowView, readback: Readback) {
  const summary = reviewSummaryPage(context, view);
  if (!summary) throw Error("No Review summary is waiting for a decision");
  const feedback = operatorFeedbackFromCandidate(workflowNativeReviewCandidate(context, view).candidate, readback);
  const round = view.reviewRounds!.at(-1)!;
  const known = new Set([...round.notes, ...round.factNotes, ...round.pageNotes ?? []].map(note => note.id));
  const elsewhere = [...feedback.edits, ...feedback.titles, ...feedback.structural].filter(item => item.path !== reviewSummaryPath).length +
    feedback.notes.filter(note => note.path !== reviewSummaryPath && !known.has(note.id)).length;
  if (elsewhere) throw Error("There are new edits or notes on other pages; decide the Review summary first, then make them");
  const answered = new Set(view.wordpressReviews?.flatMap(review => review.notes.map(note => note.id)) ?? []);
  const { decision, replies } = summaryDecision(summary.items, feedback.notes.filter(note => note.path === reviewSummaryPath && !answered.has(note.id)));
  return { decision, replies, feedback };
}

export function summaryDecision(items: ReadonlyMap<string, { kind: string; id?: string; index?: number }>,
  notes: readonly { id: number; path: string; origin: string | null; text: string; replies: string[] }[]) {
  const decision = { approved: false, rejectFacts: [] as string[], correctFacts: [] as { id: string; statement: string }[],
    rejectRevisions: [] as number[], reviseNotes: [] as { index: number; text: string }[],
    rejectPages: [] as string[], pageNotes: [] as { id: string; text: string }[] };
  const replies: { id: number; path: string; text: string; reply: string }[] = [];
  const refuse = /^\s*(no|reject|skip|remove|leave (it )?out|don'?t|do not)\b/iu;
  for (const note of notes) {
    const text = [note.text, ...note.replies].join(" ").trim();
    const item = note.origin ? items.get(note.origin.slice(0, note.origin.indexOf(":"))) : undefined;
    let reply = "MioPages Core read this note but could not tie it to an item on the Review summary.";
    if (item?.kind === "approve") {
      if (/\bapprove(d)?\b/iu.test(text)) { decision.approved = true; reply = "Recorded: approved."; }
      else reply = "Recorded. To approve, add a note here saying Approve.";
    } else if (item?.kind === "fact" && item.id) {
      if (refuse.test(note.text)) { decision.rejectFacts.push(item.id); reply = "Recorded: this fact is left out."; }
      else if (/^\s*(yes|ok|okay|approve|confirm|keep|correct)\s*[.!]?\s*$/iu.test(note.text)) reply = "Recorded: confirmed.";
      else {
        const statement = note.text.replace(/^\s*(fact|correction|corrected)\s*:\s*/iu, "").trim();
        decision.correctFacts.push({ id: item.id, statement });
        reply = "Recorded: corrected to your wording.";
      }
    } else if (item?.kind === "revision" && item.index !== undefined) {
      if (refuse.test(note.text)) { decision.rejectRevisions.push(item.index); reply = "Recorded: this change is left out."; }
      else if (/^\s*(yes|ok|okay|approve|confirm)\s*[.!]?\s*$/iu.test(note.text)) reply = "Recorded: approved.";
      else { decision.reviseNotes.push({ index: item.index, text: note.text.trim() }); reply = "Recorded: Core will include this in the change."; }
    } else if (item?.kind === "page" && item.id) {
      if (refuse.test(note.text)) { decision.rejectPages.push(item.id); reply = "Recorded: this page is not added."; }
      else if (/^\s*(yes|ok|okay|approve|confirm|add it)\s*[.!]?\s*$/iu.test(note.text)) reply = "Recorded: approved.";
      else { decision.pageNotes.push({ id: item.id, text: note.text.trim() }); reply = "Recorded: Core will include this when it writes the page."; }
    } else if (item?.kind === "info") reply = "Recorded. To ask for this page again, add a note starting New page: on any page.";
    else if (item?.kind === "edit") reply = "Recorded. Your edits are kept as written; to change one, edit the page itself.";
    replies.push({ id: note.id, path: note.path, text: note.text, reply });
  }
  return { decision, replies };
}
