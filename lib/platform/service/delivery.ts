import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { defaultVariant, designProjection, type SiteDesign } from "../design-systems/site-design";
import { renderPage } from "../site/render";
import type { SitePage } from "../site/components";
import { draftBrand } from "../wordpress-delivery/draft-brand";
import { reviewDraftEnvelope } from "../wordpress-delivery/native-draft-envelope";
import { deliveryTarget, readBackOperatorSite, samePaths, signingKey, type OperatorSiteConfig } from "../wordpress-delivery/operator-review";
import type { Readback } from "../wordpress-delivery/readback";
import { sendDraftMedia, sendSignedDraft } from "../wordpress-delivery/review-delivery";
import { readNativeDraftMedia } from "../wordpress-delivery/native-draft-media";
import { fingerprint } from "../canonical/model";
import { deliveryCopy, pictureFrameId } from "./assets";
import { bindReviewDraft } from "../wordpress-delivery/review-draft";
import { directionIdentity, logicalId, pageIdentity } from "../work-products/pages";
import { ask, current, currentSite, edit, type PageContent, type ServiceRecord } from "./cycle";

/**
 * Delivery (rebuild plan, milestone 1): the engine's current Pages, Menu and Design go to WordPress
 * as review drafts through the kept signed delivery path, and Read-back brings Notes and hand edits
 * home as Requests. Publish is not here: it is always a separate, explicit approval.
 */
export type Delivery = { site: string; installationId: string; streamId: string; revision: number; digest: string;
  recordVersion: number; pages: { path: string; id: string }[]; at: string; answeredNotes: number[] };

type Visual = { purpose: string; brief: string; altIntent: string; status: string };
type Section = { id: string; heading: string; body: string; role?: string; block?: unknown; visual?: Visual; moreVisuals?: Visual[] };
type Page = { id: string; path: string; heading: string; composition?: string; sections: Section[];
  actions?: { label: string; kind: string; destination: string | null; sectionIndex?: number }[]; internalLinks?: string[] };

/** The draft WordPress receives: the same shape delivery has always taken, built from the engine's Work products. */
export function draftCandidate(record: ServiceRecord) {
  const site = currentSite(record);
  if (!site?.complete) throw Error("Every page in the Site plan needs an approved Version before delivery");
  const design = (current(record, directionIdentity(record.account.managedSiteId))?.content as { design?: SiteDesign } | undefined)?.design;
  if (!design) throw Error("The approved Direction carries Core's design; it is required for a draft");
  const managedSiteId = record.account.managedSiteId;
  // Pages in the components format (from Nov 29) are rendered here by Core; pages written before keep the earlier format.
  const rendered = (site.pages as unknown as SitePage[]).filter(page => Array.isArray(page.layout)).map(page => ({
    id: pageIdentity(managedSiteId, page.path), path: page.path, title: page.title, composition: "components-v1" as const,
    navigationLabel: site.plan.pages.find(entry => entry.path === page.path)!.label,
    markup: renderPage(page, { link: path => `miopages:page:${path}`, defaultVariant: name => defaultVariant(design, name),
      picture: contentId => {
        const frame = pictureFrameId(page.path, contentId), asset = (record.assets ?? []).find(item => item.sectionId === frame);
        return asset ? { url: `miopages:media:${frame}`, width: asset.width, height: asset.height } : null;
      } }) }));
  const earlier = (site.pages as unknown as Page[]).filter(page => !Array.isArray((page as unknown as SitePage).layout)).map(page => ({ id: page.id, path: page.path, title: page.heading, composition: page.composition,
    navigationLabel: site.plan.pages.find(entry => entry.path === page.path)!.label,
    sections: page.sections.map(section => ({ id: section.id, type: section.role ?? "intro", content: { heading: section.heading, text: section.body },
      ...(section.block !== undefined && section.block !== null && { block: section.block }),
      ...(page.composition && section.visual && { visual: { purpose: section.visual.purpose, brief: section.visual.brief, altIntent: section.visual.altIntent,
        status: section.visual.status } }),
      ...(page.composition && section.moreVisuals?.length && { moreVisuals: section.moreVisuals.map((visual, n) => ({ id: logicalId({ section: section.id, picture: n + 1 }),
        purpose: visual.purpose, brief: visual.brief, altIntent: visual.altIntent, status: visual.status })) }) })) }));
  const pages = [...rendered, ...earlier];
  // Home is reachable from the Menu; when the plan leaves it out (the logo often links home), it goes first.
  const navigation = site.menu.includes("/") ? site.menu : ["/", ...site.menu];
  const paths = site.plan.pages.map(entry => entry.path);
  const actions = (site.pages as unknown as Page[]).filter(page => !Array.isArray((page as unknown as SitePage).layout)).flatMap(page => {
    const own = earlier.find(item => item.path === page.path)!;
    const chosen = (page.actions ?? []).map((action, index) => ({ ...action, index }))
      .filter(action => action.destination && action.destination !== page.path && paths.includes(action.destination) &&
        (action.kind === "navigate" || page.composition && action.kind !== "existing-account"))
      .map(action => ({ id: logicalId({ site: managedSiteId, from: page.path, index: action.index }), type: "page" as const, from: page.path,
        destination: action.destination!, label: action.label, componentReference: "action-" + action.index,
        ...(action.sectionIndex !== undefined && own.sections[action.sectionIndex] && { sectionId: own.sections[action.sectionIndex].id }) }));
    for (const destination of page.internalLinks ?? []) {
      const entry = site.plan.pages.find(item => item.path === destination);
      if (entry && !chosen.some(action => action.destination === destination)) chosen.push({ id: logicalId({ site: managedSiteId, from: page.path, related: destination }),
        type: "page", from: page.path, destination, label: entry.label, componentReference: "related-" + logicalId({ site: managedSiteId, from: page.path, destination }) });
    }
    return chosen;
  });
  const unresolvedActions = (site.pages as unknown as Page[]).filter(page => !Array.isArray((page as unknown as SitePage).layout)).flatMap(page => (page.actions ?? []).flatMap((action, index) =>
    !action.destination ? [{ from: page.path, reference: "action-" + index, label: action.label }] : []));
  return { candidate: { pages, navigation, actions, ...(site.footer && { footer: site.footer }) }, unresolvedActions, design: designProjection(design) };
}

/** Notes Core has answered since the last delivery: the Request each one raised was carried out. */
function answered(record: ServiceRecord, previous: Delivery | null) {
  const done = record.ledger.requests.filter(request => request.origin.channel === "wordpress-note" && request.channelRef && request.status === "decided" &&
    record.ledger.changes.some(change => change.requestIds.includes(request.id) && change.status === "applied"));
  return done.map(request => Number(request.channelRef)).filter(id => !previous?.answeredNotes.includes(id))
    .map(id => ({ id, reply: "Done: Core made this change and it is in this draft." }));
}

/** Deliver the current site as WordPress review drafts. Refused while WordPress holds changes Core has not taken in. */
export async function deliverDraft(input: { config: OperatorSiteConfig; record: ServiceRecord; previous: Delivery | null; fetcher?: typeof fetch; now?: Date }) {
  const { config, record, previous } = input, fetcher = input.fetcher ?? fetch;
  if (previous && (previous.installationId !== config.installationId || previous.streamId !== config.streamId)) throw Error("That delivery belongs to another site");
  let acknowledged: { path: string; contentSha256: string; title: string }[] = [];
  if (previous) {
    const { readback } = await readBackOperatorSite(config, fetcher);
    if (readback.revision !== previous.revision || readback.digest !== previous.digest) throw Error("WordPress no longer holds Core's last delivery; read it back first");
    const untaken = readback.notes.filter(note => note.status !== "resolved" && note.parent === 0 &&
      !record.ledger.requests.some(request => request.channelRef === String(note.id)));
    const edited = readback.pages.filter(page => page.edited && !record.ledger.requests.some(request => request.origin.channel === "hand-edit" &&
      request.channelRef === `${page.path}:${page.contentSha256}`));
    if (untaken.length || edited.length) throw Error("Take in the Notes and hand edits in WordPress before the next delivery");
    // A hand edit is worked into the page before Core replaces that page, never overwritten.
    if (record.ledger.requests.some(request => request.origin.channel === "hand-edit" && request.status === "open"))
      throw Error("Core must work the hand edits into their pages before the next delivery");
    // Hand edits Core took in as Requests: WordPress may replace exactly these pages.
    acknowledged = readback.pages.filter(page => page.edited && !page.missing && page.contentSha256)
      .map(page => ({ path: page.path, contentSha256: page.contentSha256!, title: page.title ?? "" }));
  }
  const review = draftCandidate(record);
  const logoPng = await readFile(config.logo.file);
  if (createHash("sha256").update(logoPng).digest("hex") !== config.logo.sha256) throw Error("Wordmark file differs from configuration");
  const site = { organizationId: config.organizationId, ...record.account };
  const brand = { ...draftBrand({ scope: site, coreDesign: review.design,
    logo: { assetId: config.logo.assetId, usageId: config.logo.usageId, sha256: config.logo.sha256, alt: config.logo.alt } }), pngBase64: logoPng.toString("base64") };
  const answeredNotes = answered(record, previous);
  // Each chosen picture goes in the exact Section it was chosen for; a Section since reworked keeps its FPO frame.
  const placed = (record.assets ?? []).flatMap(asset => {
    const page = review.candidate.pages.find(item => item.path === asset.path);
    // A picture goes where its frame is in the rendered page; a picture item since removed falls away.
    return page && "markup" in page && page.markup.includes(`src="miopages:media:${asset.sectionId}"`) ? [{ asset, pageId: page.id }] : [];
  });
  const copies = await Promise.all(placed.map(async ({ asset, pageId }) => {
    const copy = await deliveryCopy(asset, file => readFile(file));
    return { copy, descriptor: readNativeDraftMedia({ pageId, sectionId: asset.sectionId, assetId: asset.id, usageId: asset.usageId,
      masterDigest: asset.sha256, evidenceDigest: fingerprint(asset.source), copyDigest: copy.copyDigest, width: copy.width, height: copy.height, alt: asset.alt }) };
  }));
  const draft = bindReviewDraft({ site, installationId: config.installationId, streamId: config.streamId,
    revision: (previous?.revision ?? 0) + 1, previousDigest: previous?.digest ?? null,
    // The draft's source is the Account's service record at this version.
    source: { intakeId: record.account.webPresenceId, workflowVersion: Math.max(1, record.version) },
    review: review as never, brand, ...(answeredNotes.length && { answeredNotes }), ...(copies.length && { media: copies.map(item => item.descriptor) }),
    ...(acknowledged.length && { readBack: { revision: previous!.revision, pages: acknowledged } }),
    ...(previous && !samePaths(previous.pages, review.candidate.pages) && { baselinePages: previous.pages }) });
  const wire = reviewDraftEnvelope(draft, config.keyId, config.publicKeyBase64, signingKey(config));
  for (const { copy } of copies) await sendDraftMedia(deliveryTarget(config), wire, copy, fetcher);
  const receipt = await sendSignedDraft(deliveryTarget(config), wire, Buffer.from(config.receiptSecretHex, "hex"), {
    installationId: config.installationId, siteProposalId: config.streamId, operation: "apply", requestedDigest: draft.digest, appliedDigest: draft.digest,
    revision: draft.candidate.revision, paths: draft.candidate.pages.map(page => page.path), brandDigest: brand.digest,
    ...(copies.length && { media: copies.map(item => item.descriptor), pageIds: draft.candidate.pages.map(page => page.id) }) }, fetcher);
  const delivery: Delivery = { site: config.name, installationId: config.installationId, streamId: config.streamId, revision: receipt.revision,
    digest: receipt.appliedDigest, recordVersion: record.version, pages: draft.candidate.pages.map(page => ({ path: page.path, id: page.id })),
    at: (input.now ?? new Date()).toISOString(), answeredNotes: [...previous?.answeredNotes ?? [], ...answeredNotes.map(note => note.id)] };
  return { delivery, receipt };
}

/** Plain text of a block's HTML. */
function plain(html: string) {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };
  return html.replace(/<br\s*\/?>/giu, "\n").replace(/<[^>]+>/gu, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (whole, code: string) => code[0] === "#"
      ? String.fromCodePoint(code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1))) : named[code.toLowerCase()] ?? whole)
    .replace(/[ \t]+/gu, " ").trim();
}

/**
 * A hand-edited page, section by section, when it can be read that way: every heading and
 * paragraph still carries the section it was delivered for, no section is missing, and nothing
 * else was added. Otherwise null, and the edit goes to Core as a Request to work in.
 */
export function editedSections(content: string, sectionIds: readonly string[]) {
  const found = new Map<string, { heading?: string[]; text?: string[] }>();
  for (const match of content.matchAll(/<!-- wp:(heading|paragraph)(?: (\{.*?\}))? -->([\s\S]*?)<!-- \/wp:\1 -->/gu)) {
    let mio: unknown;
    try { mio = match[2] ? (JSON.parse(match[2]) as { metadata?: { mio?: unknown } }).metadata?.mio : undefined; } catch { return null; }
    const [section, part] = typeof mio === "string" ? mio.split(":") : [];
    if (!section || !sectionIds.includes(section) || (part !== "heading" && part !== "text")) { if (plain(match[3])) return null; continue; }
    const entry = found.get(section) ?? {};
    (entry[part] ??= []).push(plain(match[3]));
    found.set(section, entry);
  }
  // Anything else a person may have added (lists, images, other blocks) is beyond a section-by-section reading.
  const other = content.replace(/<!-- wp:(heading|paragraph)[\s\S]*?<!-- \/wp:\1 -->/gu, "").replace(/<!-- wp:html -->[\s\S]*?<!-- \/wp:html -->/gu, "")
    .replace(/<!-- \/?wp:group[^>]*-->/gu, "").replace(/<\/?(div|section)[^>]*>/gu, "").trim();
  if (other || sectionIds.some(id => !found.has(id))) return null;
  return sectionIds.map(id => {
    const { heading, text } = found.get(id)!;
    return { id, ...(heading && { heading: heading.join(" ") }), ...(text && { body: text.join("\n\n") }) };
  });
}

/**
 * A hand-edited Core-rendered page, item by item: each block named mp:<id> is read back into that
 * content item's fields. When the edit can't be read that way (a block someone added without a
 * name, an item removed), null: the edit goes to Core as a Request to work in, so it is never lost.
 */
export function editedItems(content: string, page: SitePage) {
  const found = new Map<string, { headings: string[]; paragraphs: string[]; buttons: string[]; summary?: string }>();
  const entry = (id: string) => { let item = found.get(id); if (!item) found.set(id, item = { headings: [], paragraphs: [], buttons: [] }); return item; };
  for (const match of content.matchAll(/<!-- wp:(heading|paragraph|button|details)(?: (\{.*?\}))? \/?-->([\s\S]*?)(?=<!-- \/?wp:)/gu)) {
    let attrs: { metadata?: { name?: string }; summary?: string; className?: string } = {};
    try { attrs = match[2] ? JSON.parse(match[2]) : {}; } catch { return null; }
    const id = /^mp:(.+)$/u.exec(attrs.metadata?.name ?? "")?.[1];
    const text = plain(match[3]);
    if (!id) { if (text) return null; continue; }
    if (/mp-(fpo|placeholder)-/u.test(attrs.className ?? "")) continue;
    const item = entry(id);
    if (match[1] === "heading") item.headings.push(text);
    else if (match[1] === "paragraph") item.paragraphs.push(text);
    else if (match[1] === "button") item.buttons.push(text);
    else item.summary = attrs.summary ?? plain(/<summary>([\s\S]*?)<\/summary>/u.exec(match[3])?.[1] ?? "");
  }
  const items: { id: string; fields: Record<string, string> }[] = [];
  for (const item of page.content) {
    if (item.type === "picture" || item.type === "placeholder") continue;
    const read = found.get(item.id);
    if (!read) { if (page.layout.some(section => Object.values(section.slots).flat().includes(item.id))) return null; continue; }
    const paragraphs = read.paragraphs.join("\n\n");
    const fields: Record<string, string> = item.type === "heading" ? { text: read.headings.join(" ") } : item.type === "text" ? { text: paragraphs }
      : item.type === "item" ? { title: read.headings.join(" "), text: paragraphs } : item.type === "question" ? { question: read.summary ?? item.question, answer: paragraphs }
      : { label: read.buttons.join(" ") };
    items.push({ id: item.id, fields });
  }
  return items;
}

/**
 * Read-back: each open Note in WordPress becomes a Request on its page, in the person's own words,
 * for Core to handle like any other. A hand edit is the Specialist's own: read section by section,
 * it becomes the page's next Version directly; when it cannot be read that way it becomes a
 * Request for Core to work in, so it is never lost. Taking the same thing in twice changes nothing.
 */
export function takeInReadBack(record: ServiceRecord, readback: Readback, by: { id: string; role: "operator" | "customer" }, at: string) {
  const pathOf = (postId: number) => readback.pages.find(page => page.id === postId)?.path;
  for (const note of readback.notes.filter(item => item.status !== "resolved" && item.parent === 0)) {
    const path = pathOf(note.postId);
    if (!path || !note.content.trim()) continue;
    record = ask(record, { id: `wp-note:${note.id}`, at, by, kind: "page", path, words: note.content.trim().slice(0, 4000), channel: "wordpress-note", channelRef: String(note.id) });
  }
  for (const page of readback.pages.filter(item => item.edited && !item.missing)) {
    const channelRef = `${page.path}:${page.contentSha256}`;
    if (record.ledger.requests.some(request => request.channelRef === channelRef)) continue;
    const delivered = current(record, pageIdentity(record.account.managedSiteId, page.path))?.content as PageContent | undefined;
    const items = by.role === "operator" && delivered && Array.isArray(delivered.layout) && page.content ? editedItems(page.content, delivered) : null;
    if (items) {
      record = edit(record, { id: `wp-edit:${channelRef}`, at, by, path: page.path, items, channel: "hand-edit", channelRef,
        words: "Hand edit in WordPress, taken in item by item." });
      continue;
    }
    record = ask(record, { id: `wp-edit:${page.path}:${page.contentSha256}`, at, by, kind: "page", path: page.path, channel: "hand-edit",
      channelRef: `${page.path}:${page.contentSha256}`,
      words: `Keep the hand edits made in WordPress on this page and work them into it: ${(page.content ?? "").replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim().slice(0, 3500)}` });
  }
  return record;
}
