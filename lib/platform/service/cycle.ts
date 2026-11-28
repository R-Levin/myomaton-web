import { decide, emptyLedger, markApplied, review as reviewChange, takeIn, type Change, type ChangeLedger, type Consequence,
  type Grain, type Person, type Request } from "../change/model";
import type { Delivery } from "./delivery";
import type { Evidence } from "./evidence";
import type { Asset } from "./assets";
import type { SiteFooter } from "./site-footer";
import { fingerprint } from "../canonical/model";
import { directionIdentity, pageIdentity, reportIdentity, sitePlanIdentity, versionPages } from "../work-products/pages";
import { arrangementOf, compareWords, fillLayout, layoutFromExample, mendLayout, pageWords, type Piece } from "./page-words";

/**
 * Core's one engine (rebuild plan, milestone 1). Every piece of work is the same cycle of shared
 * objects: a Request arrives, a Task says who handles it, the handler's Decision proposes Changes
 * to a Work product at an exact Version, the right person Reviews them, and an approved Change
 * makes the next Version current. Onboarding, Launch and Ongoing are this cycle at different
 * grains; nothing here is written for any one Client.
 */

/** The Work products Core writes in Launch, in the order each one builds on the last. */
export type Kind = "report" | "direction" | "site-plan" | "page";
export type PlanEntry = { path: string; label: string; purpose: string; inMenu: boolean };
export type SitePlan = { pages: PlanEntry[]; footer?: SiteFooter };
export type PageContent = { path: string; heading: string; sections: { heading: string; body: string; [key: string]: unknown }[]; [key: string]: unknown };

/** One saved state of a Work product. A proposed Version becomes current only when its Change is approved. */
export type ProductVersion = {
  id: string; kind: Kind; version: number; path?: string; content: unknown; changeId: string; at: string;
  status: "proposed" | "current" | "superseded" | "declined";
};

/** An Account's service record: its Change record and every Version of its Work products. */
export type ServiceRecord = { account: { webPresenceId: string; managedSiteId: string }; version: number; ledger: ChangeLedger; products: ProductVersion[];
  /** Approved Publishes. Until public delivery is built (milestone 5) each is a labeled Beacon: approved, not yet public. */
  publications?: Publication[];
  /** Each review draft sent to the Account's WordPress, latest last (service/delivery.ts). */
  deliveries?: Delivery[];
  /** The Account's Evidence: its documents, direction and research, which Core reads with the Knowledge (service/evidence.ts). */
  evidence?: Evidence[];
  /** Pictures chosen for the Sections that asked for one (service/assets.ts). */
  assets?: Asset[] };

/** A Publish the Client approved: exactly which Page Versions, and the Proposed facts the approval confirmed. */
export type Publication = { changeId: string; at: string; by: Person; pages: { id: string; path: string; version: number }[];
  confirms: { key: string; statement: string }[]; beacon: "public delivery not built yet" };

/** What Core gives its writer (the AI, or a labeled Beacon standing in for it) for one Work product. */
export type WriteInput = {
  kind: Kind; knowledge: readonly unknown[]; evidence?: readonly Evidence[]; report?: unknown; direction?: unknown; sitePlan?: SitePlan; page?: PlanEntry;
  /** The current Version being reworked, and the words of each Request asking for the rework. */
  previous?: unknown; requests: string[];
  /** For a page: the whole page, only its words, or only its layout (task 1a). For the words or the layout,
   * Core is given the page's words as numbered pieces and its arrangement with the numbers in place of text. */
  grain?: PageGrain; words?: Piece[]; arrangement?: PageContent;
  /** An earlier Version a layout change should follow where it can (the Request names it). */
  example?: unknown;
};
export type PageGrain = "page" | "page-words" | "page-layout";
export interface Writer { write(input: WriteInput): Promise<unknown> }

export type Task = { id: string; who: "core" | "specialist" | "client"; what: string; requestIds?: string[]; changeId?: string };

const core: Person = { id: "core", role: "core" };
/** How much review each Work product needs (Consequence level). Publishing always needs the Client. */
const consequence: Record<Kind, Consequence> = { report: "customer-approval", direction: "operator-review", "site-plan": "operator-review", page: "operator-review" };
const grainOf: Record<Kind, Grain> = { report: "report", direction: "direction", "site-plan": "site-plan", page: "page" };
const kindOf = (grain: Grain): Kind | undefined => (Object.entries(grainOf).find(([, value]) => value === grain)?.[0] as Kind | undefined)
  ?? (grain === "new-page" || grain === "page-words" || grain === "page-layout" ? "page" : undefined);

export class CycleError extends Error { constructor(readonly code: "not-found" | "not-open" | "not-permitted" | "invalid", message: string) { super(message); } }

/** The current Version of a Work product, if any. */
export function current(record: ServiceRecord, id: string) {
  return record.products.findLast(item => item.id === id && item.status === "current");
}
const identity = (record: ServiceRecord, kind: Kind, path?: string) => {
  const site = record.account.managedSiteId;
  return kind === "report" ? reportIdentity(site) : kind === "direction" ? directionIdentity(site)
    : kind === "site-plan" ? sitePlanIdentity(site) : pageIdentity(site, path!);
};

/** Open an Account's service record. */
export function openRecord(account: ServiceRecord["account"]): ServiceRecord {
  return { account, version: 0, ledger: emptyLedger(), products: [] };
}

/** The start of Launch: one Request, from the start of the Stage, to understand the business. */
export function startLaunch(record: ServiceRecord, at: string, by: Person): ServiceRecord {
  if (record.ledger.requests.some(request => request.origin.kind === "stage-start")) return record;
  const id = `launch:${record.account.webPresenceId}`;
  return { ...record, ledger: takeIn(record.ledger, { id, at, by }, [{ id: id + ":report", at,
    origin: { kind: "stage-start", by, channel: "core-screen" }, target: { grain: "report" }, words: "Understand the business." }]) };
}

/**
 * A person asks for a Work product to change (a correction, a Note, an email): a Request on it.
 * "site" is a Request on the site as a whole, for a Specialist to direct (`direct`).
 */
export function ask(record: ServiceRecord, request: { id: string; at: string; by: Person; kind: Kind | "site"; path?: string; words: string;
  channel?: Request["origin"]["channel"]; channelRef?: string; enteredBy?: Person; grain?: PageGrain; example?: number }): ServiceRecord {
  if (!request.words.trim()) throw new CycleError("invalid", "A Request needs its words");
  if (record.ledger.requests.some(item => item.id === request.id + ":request")) return record;
  const origin = request.by.role === "customer" ? "customer" : request.by.role === "core" ? "core" : "operator";
  return { ...record, ledger: takeIn(record.ledger, { id: request.id, at: request.at, by: request.enteredBy ?? request.by }, [{ id: request.id + ":request", at: request.at,
    origin: { kind: origin, by: request.by, channel: request.channel ?? "core-screen", ...(request.enteredBy && { enteredBy: request.enteredBy }) },
    target: { grain: request.kind === "site" ? "site" : request.kind === "page" && request.grain ? request.grain : grainOf[request.kind],
      ...(request.path && { path: request.path }), ...(request.example && { example: request.example }) }, words: request.words.trim(),
    ...(request.channelRef && { channelRef: request.channelRef }) }]) };
}

/**
 * A Specialist handles a Request on the site as a whole (an email, the Client's reason for not
 * publishing yet): sends it to Core as a Request on one Work product, in the same person's words,
 * or answers it without changing anything. Either way it is a Decision on the record.
 */
export function direct(record: ServiceRecord, requestId: string, by: Person, at: string, to: { kind: Kind; path?: string } | { answer: string }): ServiceRecord {
  const request = record.ledger.requests.find(item => item.id === requestId);
  if (!request) throw new CycleError("not-found", "No such Request");
  if (request.status !== "open" || request.target.grain !== "site") throw new CycleError("not-open", "That Request is not waiting to be directed");
  if (by.role !== "operator" && by.role !== "owner") throw new CycleError("not-permitted", "A Specialist directs Requests");
  if ("answer" in to && !to.answer.trim()) throw new CycleError("invalid", "Say how it was answered");
  if ("kind" in to && to.kind === "page" && !currentSite(record)?.plan.pages.some(entry => entry.path === to.path)) throw new CycleError("invalid", "No such page");
  const where = "kind" in to ? (to.kind === "page" ? `page ${to.path}` : label({ target: { grain: grainOf[to.kind] } } as Request)) : "";
  let ledger = decide(record.ledger, { id: `${requestId}:directed`, at, by, requestIds: [requestId], outcome: "answer",
    reasoning: "answer" in to ? to.answer.trim() : `Sent to Core as a Request on the ${where}.` }, []);
  if ("kind" in to) ledger = takeIn(ledger, { id: `${requestId}:directed`, at, by }, [{ id: `${requestId}:to:${to.kind}${to.path ?? ""}`, at,
    origin: { ...request.origin, enteredBy: request.origin.enteredBy ?? by }, target: { grain: grainOf[to.kind], ...(to.path && { path: to.path }) },
    words: request.words, ...(request.channelRef && { channelRef: request.channelRef }) }]);
  return { ...record, ledger };
}

/** Who must do what next: Core writes for open Requests; the right person reviews proposed Changes. */
export function tasks(record: ServiceRecord): Task[] {
  const open = record.ledger.requests.filter(request => request.status === "open" && kindOf(request.target.grain));
  const byTarget = new Map<string, Request[]>();
  for (const request of open) {
    const key = request.target.grain + ":" + (request.target.path ?? "");
    byTarget.set(key, [...byTarget.get(key) ?? [], request]);
  }
  const writing = [...byTarget.values()].map(requests => ({ id: "write:" + requests[0].id, who: "core" as const,
    what: `Write the ${label(requests[0])}`, requestIds: requests.map(request => request.id) }));
  const reviewing = record.ledger.changes.filter(change => change.status === "proposed").map(change => ({ id: "review:" + change.id,
    who: change.consequence === "customer-approval" ? "client" as const : "specialist" as const, what: `Review ${change.difference.summary}`, changeId: change.id }));
  // A Request on the site as a whole (such as the Client's reason for not publishing yet) is the Specialist's to answer.
  const answering = record.ledger.requests.filter(request => request.status === "open" && request.target.grain === "site" &&
    !record.ledger.changes.some(change => change.requestIds.includes(request.id))).map(request => ({ id: "answer:" + request.id,
    who: "specialist" as const, what: `Answer: ${request.words}`, requestIds: [request.id] }));
  return [...writing, ...reviewing, ...answering];
}
const label = (request: Request) => request.target.grain === "site-plan" ? "Site plan" : request.target.grain === "page" || request.target.grain === "new-page"
  ? `page ${request.target.name ?? request.target.path}` : request.target.grain === "page-words" ? `words of the page ${request.target.path}`
  : request.target.grain === "page-layout" ? `layout of the page ${request.target.path}` : request.target.grain === "report" ? "Report" : "Direction";

/** Knowledge, and the current Work products each kind builds on. */
function inputFor(record: ServiceRecord, kind: Kind, knowledge: readonly unknown[], requests: Request[], path?: string): WriteInput {
  const site = record.account.managedSiteId;
  const got = (id: string) => current(record, id)?.content;
  const plan = got(sitePlanIdentity(site)) as SitePlan | undefined;
  // The Version being reworked: the current one, or the latest draft when a first draft was corrected.
  const id = identity(record, kind, path);
  const grain = requests[0]?.target.grain;
  // A change to a page's words or layout is always made on its approved Version.
  const pageGrain = kind === "page" && (grain === "page-words" || grain === "page-layout") ? grain : undefined;
  const previous = pageGrain ? got(id) : got(id) ?? record.products.findLast(item => item.id === id)?.content;
  if (pageGrain && previous === undefined) throw new CycleError("invalid", "A page's words or layout change needs an approved Version of the page");
  const example = pageGrain === "page-layout" && requests[0]?.target.example
    ? record.products.find(item => item.id === id && item.version === requests[0]!.target.example)?.content : undefined;
  return { kind, knowledge, ...(record.evidence?.length && { evidence: record.evidence }),
    ...(pageGrain && { grain: pageGrain, words: pageWords(previous as PageContent), arrangement: arrangementOf(previous as PageContent),
      ...(example !== undefined && { example }) }),
    ...(kind !== "report" && { report: got(reportIdentity(site)) }),
    ...((kind === "site-plan" || kind === "page") && { direction: got(directionIdentity(site)) }),
    ...(kind === "page" && plan && { sitePlan: plan, page: plan.pages.find(entry => entry.path === path) }),
    ...(previous !== undefined && { previous }),
    requests: requests.filter(request => request.origin.kind !== "stage-start" && request.origin.kind !== "core").map(request => request.words) };
}

/**
 * Core handles one writing Task: it writes the Work product and its Decision proposes the new
 * Version as a Change against the current one. The writer is the only part that differs between
 * the real AI and a Beacon.
 */
export async function work(record: ServiceRecord, task: Task, writer: Writer, knowledge: readonly unknown[], at: string): Promise<ServiceRecord> {
  if (task.who !== "core" || !task.requestIds?.length) throw new CycleError("invalid", "Not a Core Task");
  const requests = task.requestIds.map(id => record.ledger.requests.find(request => request.id === id && request.status === "open"));
  if (requests.some(request => !request)) throw new CycleError("not-open", "The Task's Requests are no longer open");
  const first = requests[0]!, kind = kindOf(first.target.grain)!, path = first.target.path;
  const given = inputFor(record, kind, knowledge, requests as Request[], path);
  const content = await writer.write(given);
  const id = identity(record, kind, path);
  // The guarantee of a layout change, whatever wrote it: the page's words read back exactly as they were.
  if (given.grain === "page-layout" && !compareWords(given.previous as PageContent, content as PageContent).unchanged)
    throw new CycleError("invalid", "A layout change may not change the page's words");
  const base = current(record, id);
  const version = Math.max(0, ...record.products.filter(item => item.id === id).map(item => item.version)) + 1;
  const stored = kind === "page" ? versionedPage(record, id, content as PageContent) : content;
  const changeId = `${id}:v${version}`;
  const change: Omit<Change, "status" | "reviews" | "decisionId"> = { id: changeId, label: `${kind}-v${version}`, at, requestIds: requests.map(request => request!.id),
    target: { grain: given.grain ?? grainOf[kind], ...(path && { path }), workProduct: { id, version: base?.version ?? 0 } },
    base: { version: record.version, digest: fingerprint(base?.content ?? null) },
    difference: { summary: `${given.grain === "page-words" ? "the words of the page " + path : given.grain === "page-layout" ? "the layout of the page " + path
      : kind === "page" ? "the page " + path : kind === "site-plan" ? "the Site plan" : "the " + kind[0].toUpperCase() + kind.slice(1)}, version ${version}` },
    preserve: [], consequence: consequence[kind] };
  const ledger = decide(record.ledger, { id: changeId + ":decision", at, by: core, requestIds: change.requestIds, outcome: "change",
    reasoning: base ? "A new Version answering the Requests on the current one." : "The first Version." }, [change]);
  // A newer proposal replaces an older one still waiting for Review.
  const products = record.products.map(item => item.id === id && item.status === "proposed" ? { ...item, status: "superseded" as const } : item);
  return { ...record, ledger, products: [...products, { id, kind, version, ...(path && { path }), content: stored, changeId, at, status: "proposed" }] };
}

/**
 * A person's own edit of a page, such as a Specialist's hand edit in WordPress. Nobody else writes
 * it, so it is their Decision and their Change, and making it is their Review: the edited Version
 * becomes current at once. Only a Specialist (or the Principal) edits pages by hand.
 */
export function edit(record: ServiceRecord, input: { id: string; at: string; by: Person; path: string; words: string;
  sections: { id: string; heading?: string; body?: string }[]; channel: Request["origin"]["channel"]; channelRef?: string }): ServiceRecord {
  if (input.by.role !== "operator" && input.by.role !== "owner") throw new CycleError("not-permitted", "Only a Specialist edits pages by hand");
  const id = pageIdentity(record.account.managedSiteId, input.path), base = current(record, id);
  if (!base) throw new CycleError("not-found", "No approved Version of that page to edit");
  if (record.ledger.requests.some(request => request.id === input.id + ":request")) return record;
  const before = base.content as PageContent & { sections: { id: string; heading: string; body: string }[] };
  for (const section of input.sections) if (!before.sections.some(item => item.id === section.id)) throw new CycleError("invalid", "That section is not on the page");
  const sections = before.sections.map(section => { const edited = input.sections.find(item => item.id === section.id);
    return edited ? { ...section, ...(edited.heading !== undefined && { heading: edited.heading }), ...(edited.body !== undefined && { body: edited.body }) } : section; });
  const requestId = input.id + ":request";
  let ledger = takeIn(record.ledger, { id: input.id, at: input.at, by: input.by }, [{ id: requestId, at: input.at,
    origin: { kind: "operator", by: input.by, channel: input.channel }, target: { grain: "page", path: input.path }, words: input.words,
    ...(input.channelRef && { channelRef: input.channelRef }) }]);
  const unchanged = fingerprint(sections) === fingerprint(before.sections);
  if (unchanged) return { ...record, ledger: decide(ledger, { id: input.id + ":decision", at: input.at, by: input.by, requestIds: [requestId], outcome: "maintain",
    reasoning: "The edit leaves the page as it is." }, []) };
  const version = Math.max(0, ...record.products.filter(item => item.id === id).map(item => item.version)) + 1, changeId = `${id}:v${version}`;
  ledger = decide(ledger, { id: changeId + ":decision", at: input.at, by: input.by, requestIds: [requestId], outcome: "change", reasoning: "Their own edit." },
    [{ id: changeId, label: `page-v${version}`, at: input.at, requestIds: [requestId],
      target: { grain: "page", path: input.path, workProduct: { id, version: base.version } }, base: { version: record.version, digest: fingerprint(base.content) },
      difference: { summary: `the page ${input.path}, version ${version} (edited by hand)` }, preserve: [], consequence: "operator-review" }]);
  const products = record.products.map(item => item.id === id && item.status === "proposed" ? { ...item, status: "superseded" as const } : item);
  const proposed = { ...record, ledger, products: [...products, { id, kind: "page" as const, version, path: input.path,
    content: versionedPage(record, id, { ...before, sections }), changeId, at: input.at, status: "proposed" as const }] };
  return respond(proposed, changeId, input.by, "approve", input.at);
}

/**
 * Going back: a Specialist makes an earlier Version of a page current again, as it was. Every Version
 * is kept, so this is a new Version with the earlier content, the Specialist's own Decision and
 * Change, approved as they make it (as with a hand edit). No AI is involved.
 */
export function restore(record: ServiceRecord, input: { id: string; at: string; by: Person; path: string; version: number }): ServiceRecord {
  if (input.by.role !== "operator" && input.by.role !== "owner") throw new CycleError("not-permitted", "Only a Specialist restores a page");
  const id = pageIdentity(record.account.managedSiteId, input.path), base = current(record, id);
  const earlier = record.products.find(item => item.id === id && item.version === input.version);
  if (!base || !earlier) throw new CycleError("not-found", "No such version of that page");
  if (earlier.version === base.version) throw new CycleError("invalid", "That version is already current");
  if (record.ledger.requests.some(request => request.id === input.id + ":request")) return record;
  const requestId = input.id + ":request", words = `Go back to version ${earlier.version} of the page ${input.path}.`;
  let ledger = takeIn(record.ledger, { id: input.id, at: input.at, by: input.by }, [{ id: requestId, at: input.at,
    origin: { kind: "operator", by: input.by, channel: "core-screen" }, target: { grain: "page", path: input.path }, words }]);
  const version = Math.max(0, ...record.products.filter(item => item.id === id).map(item => item.version)) + 1, changeId = `${id}:v${version}`;
  ledger = decide(ledger, { id: changeId + ":decision", at: input.at, by: input.by, requestIds: [requestId], outcome: "change", reasoning: words },
    [{ id: changeId, label: `page-v${version}`, at: input.at, requestIds: [requestId],
      target: { grain: "page", path: input.path, workProduct: { id, version: base.version } }, base: { version: record.version, digest: fingerprint(base.content) },
      difference: { summary: `the page ${input.path}, version ${version} (version ${earlier.version} restored)` }, preserve: [], consequence: "operator-review" }]);
  const products = record.products.map(item => item.id === id && item.status === "proposed" ? { ...item, status: "superseded" as const } : item);
  const proposed = { ...record, ledger, products: [...products, { id, kind: "page" as const, version, path: input.path,
    content: versionedPage(record, id, structuredClone(earlier.content) as PageContent), changeId, at: input.at, status: "proposed" as const }] };
  return respond(proposed, changeId, input.by, "approve", input.at);
}

/**
 * A Specialist proposes an earlier version's layout for a page, holding its current, approved words
 * (layoutFromExample): no AI, a layout change like any other, shown for Review with its words check.
 */
export function adoptLayout(record: ServiceRecord, input: { id: string; at: string; by: Person; path: string; version: number }): ServiceRecord {
  if (input.by.role !== "operator" && input.by.role !== "owner") throw new CycleError("not-permitted", "Only a Specialist proposes a page's layout");
  const id = pageIdentity(record.account.managedSiteId, input.path), base = current(record, id);
  const example = record.products.find(item => item.id === id && item.version === input.version);
  if (!base || !example) throw new CycleError("not-found", "No such version of that page");
  if (record.ledger.requests.some(request => request.id === input.id + ":request")) return record;
  const before = base.content as PageContent;
  const content = fillLayout(before, mendLayout(before, layoutFromExample(before, example.content as PageContent)).layout);
  if (!compareWords(before, content).unchanged) throw new CycleError("invalid", "That layout would change the page's words");
  const requestId = input.id + ":request", words = `Use the layout of version ${example.version} of the page ${input.path}, with its current words.`;
  let ledger = takeIn(record.ledger, { id: input.id, at: input.at, by: input.by }, [{ id: requestId, at: input.at,
    origin: { kind: "operator", by: input.by, channel: "core-screen" }, target: { grain: "page-layout", path: input.path, example: example.version }, words }]);
  const version = Math.max(0, ...record.products.filter(item => item.id === id).map(item => item.version)) + 1, changeId = `${id}:v${version}`;
  ledger = decide(ledger, { id: changeId + ":decision", at: input.at, by: input.by, requestIds: [requestId], outcome: "change", reasoning: words },
    [{ id: changeId, label: `page-v${version}`, at: input.at, requestIds: [requestId],
      target: { grain: "page-layout", path: input.path, workProduct: { id, version: base.version } }, base: { version: record.version, digest: fingerprint(base.content) },
      difference: { summary: `the layout of the page ${input.path}, version ${version} (the layout of version ${example.version})` }, preserve: [], consequence: "operator-review" }]);
  const products = record.products.map(item => item.id === id && item.status === "proposed" ? { ...item, status: "superseded" as const } : item);
  return { ...record, ledger, products: [...products, { id, kind: "page" as const, version, path: input.path,
    content: versionedPage(record, id, content), changeId, at: input.at, status: "proposed" as const }] };
}

/** A Page's Sections keep their identities across Versions, as delivery has always given them. */
function versionedPage(record: ServiceRecord, id: string, page: PageContent) {
  const before = current(record, id)?.content as PageContent | undefined;
  return versionPages(record.account.managedSiteId, before ? [before] : [], [page]).pages[0];
}

/**
 * A person's Review of a proposed Version. Approve makes it current and raises what builds on it;
 * Correct declines it and raises a Request, in the reviewer's words, for Core to rework it.
 */
export function respond(record: ServiceRecord, changeId: string, by: Person, response: "approve" | "correct" | "decline", at: string, words?: string): ServiceRecord {
  if (changeId.startsWith("publish:")) return respondToPublish(record, changeId, by, response, at, words);
  const proposed = record.products.find(item => item.changeId === changeId);
  if (!proposed) throw new CycleError("not-found", "No such proposed Version");
  if (proposed.status !== "proposed") throw new CycleError("not-open", "That Version is not waiting for Review");
  let ledger: ChangeLedger;
  try { ledger = reviewChange(record.ledger, changeId, { at, by, response: response === "approve" ? "approve" : "decline", ...(words && { words }) }); }
  catch (error) { throw new CycleError("not-permitted", (error as Error).message); }
  if (response !== "approve") {
    const declined = { ...record, ledger, products: record.products.map(item => item.changeId === changeId ? { ...item, status: "declined" as const } : item) };
    const target = record.ledger.changes.find(change => change.id === changeId)?.target;
    const grain = target?.grain === "page-words" || target?.grain === "page-layout" ? target.grain : undefined;
    return response === "correct" ? ask(declined, { id: `${changeId}:correction:${at}`, at, by, kind: proposed.kind, path: proposed.path, words: words ?? "",
      ...(grain && { grain }) }) : declined;
  }
  ledger = markApplied(ledger, [changeId], at, record.version + 1);
  const products = record.products.map(item => item.changeId === changeId ? { ...item, status: "current" as const }
    : item.id === proposed.id && item.status === "current" ? { ...item, status: "superseded" as const } : item);
  return follow({ ...record, ledger, products }, proposed, at);
}

/** What builds on an approved Version: Core raises the next Requests itself. */
function follow(record: ServiceRecord, approved: ProductVersion, at: string): ServiceRecord {
  const next = (kind: Kind, words: string, path?: string, name?: string) => ({ id: `${approved.changeId}:next:${kind}${path ? ":" + path : ""}`, at,
    origin: { kind: "core" as const, by: core, channel: "core-screen" as const }, target: { grain: grainOf[kind], ...(path && { path }), ...(name && { name }) }, words });
  const already = (kind: Kind, path?: string) => record.products.some(item => item.kind === kind && item.path === path) ||
    record.ledger.requests.some(request => request.status === "open" && request.target.grain === grainOf[kind] && request.target.path === path);
  let requests: ReturnType<typeof next>[] = [];
  if (approved.kind === "report" && !already("direction")) requests = [next("direction", "Propose the Direction from the confirmed Report.")];
  if (approved.kind === "direction" && !already("site-plan")) requests = [next("site-plan", "Plan the site from the Direction.")];
  if (approved.kind === "site-plan") requests = (approved.content as SitePlan).pages.filter(entry => !already("page", entry.path))
    .map(entry => next("page", `Write the page ${entry.label}: ${entry.purpose}`, entry.path, entry.label));
  return requests.length ? { ...record, ledger: takeIn(record.ledger, { id: `${approved.changeId}:next`, at, by: core }, requests) } : record;
}

/**
 * What became of a person's Request, in words they can follow: still with someone, waiting for
 * a Review, done (in which Version), answered, or not taken up. A Request a Specialist sent on to
 * a Work product is followed to where it went.
 */
export function outcome(record: ServiceRecord, request: Request): { state: "working" | "review" | "done" | "answered" | "declined"; words: string } {
  request = record.ledger.requests.find(item => item.id === request.id) ?? request;
  const onward = record.ledger.requests.find(item => item.id.startsWith(request.id + ":to:"));
  if (onward) return outcome(record, onward);
  if (request.status === "withdrawn") return { state: "declined", words: "Withdrawn." };
  if (request.status === "open") return { state: "working", words: "Being worked on." };
  const changes = record.ledger.changes.filter(change => change.requestIds.includes(request.id));
  const decision = record.ledger.decisions.find(item => item.requestIds.includes(request.id));
  if (!changes.length) return { state: "answered", words: decision?.reasoning ?? "Answered." };
  const applied = changes.find(change => change.status === "applied");
  const product = applied && record.products.find(item => item.changeId === applied.id);
  if (applied) return { state: "done", words: product ? `Done: in the ${product.kind === "page" ? `page ${product.path}` : label({ target: { grain: grainOf[product.kind] } } as Request)}, version ${product.version}.` : "Done." };
  if (changes.some(change => change.status === "proposed")) return { state: "review", words: "Done; waiting for review." };
  // Corrected: the correction raised the next Request, so this one ends where that one does.
  const correction = record.ledger.requests.filter(item => changes.some(change => item.id.startsWith(change.id + ":correction:"))).at(-1);
  if (correction) return outcome(record, correction);
  return changes.some(change => change.reviews.some(review => review.response === "decline" && review.words)) ? { state: "working", words: "Being reworked." }
    : { state: "declined", words: "Not taken up." };
}

/** The site's current Pages in Site plan order: what delivery puts into WordPress drafts. */
export function currentSite(record: ServiceRecord) {
  const plan = current(record, sitePlanIdentity(record.account.managedSiteId))?.content as SitePlan | undefined;
  if (!plan) return null;
  const pages = plan.pages.map(entry => current(record, pageIdentity(record.account.managedSiteId, entry.path)));
  return { plan, pages: pages.filter(Boolean).map(item => item!.content as PageContent & { id: string; version: number }),
    complete: pages.every(Boolean), menu: plan.pages.filter(entry => entry.inMenu).map(entry => entry.path), footer: plan.footer };
}

/**
 * Ask the Client to approve publishing the site exactly as it now stands. Publishing always needs
 * the Client's approval. The request lists the Proposed facts the site relies on: Core may use
 * them in drafts, and the Client confirms them at the latest here (Principal, Nov 24).
 */
export function proposePublish(record: ServiceRecord, input: { at: string; by: Person; relies: { key: string; statement: string }[] }): ServiceRecord {
  const site = currentSite(record);
  if (!site?.complete) throw new CycleError("invalid", "Every page needs an approved Version before the site can be published");
  if (record.ledger.changes.some(change => change.id.startsWith("publish:") && change.status === "proposed")) throw new CycleError("not-open", "A Publish is already waiting for the Client");
  const id = `publish:${record.version}:${input.at}`, requestId = id + ":request";
  const pages = site.pages.map(page => ({ id: page.id, path: page.path, version: page.version }));
  let ledger = takeIn(record.ledger, { id, at: input.at, by: input.by }, [{ id: requestId, at: input.at,
    origin: { kind: input.by.role === "core" ? "core" : "operator", by: input.by, channel: "core-screen" }, target: { grain: "site" }, words: "Publish the site." }]);
  const confirms = input.relies.length ? ". Approving also confirms, as true and fit for the website: " + input.relies.map(fact => `"${fact.statement}"`).join("; ") : "";
  ledger = decide(ledger, { id: id + ":decision", at: input.at, by: core, requestIds: [requestId], outcome: "change", reasoning: "The site is complete and reviewed." },
    [{ id, label: "Publish", at: input.at, requestIds: [requestId], target: { grain: "site" }, base: { version: record.version, digest: fingerprint(pages) },
      difference: { summary: `publishing the site (${pages.length} pages)` + confirms, after: JSON.stringify({ pages, confirms: input.relies }) },
      preserve: [], consequence: "customer-approval" }]);
  return { ...record, ledger };
}

function respondToPublish(record: ServiceRecord, changeId: string, by: Person, response: "approve" | "correct" | "decline", at: string, words?: string): ServiceRecord {
  const change = record.ledger.changes.find(item => item.id === changeId);
  if (!change) throw new CycleError("not-found", "No such Publish");
  const { pages, confirms } = JSON.parse(change.difference.after!) as { pages: Publication["pages"]; confirms: Publication["confirms"] };
  // The approval holds only for the site exactly as it was asked about.
  const now = currentSite(record)?.pages.map(page => ({ id: page.id, path: page.path, version: page.version }));
  if (response === "approve" && fingerprint(now) !== fingerprint(pages)) throw new CycleError("not-open", "The site changed since the Publish was asked for; ask again");
  let ledger: ChangeLedger;
  try { ledger = reviewChange(record.ledger, changeId, { at, by, response: response === "approve" ? "approve" : "decline", ...(words && { words }) }); }
  catch (error) { throw new CycleError("not-permitted", (error as Error).message); }
  if (response !== "approve") {
    const declined = { ...record, ledger };
    // The Client's reason goes to the Specialist as a Request on the site.
    return response === "correct" && words?.trim() ? { ...declined, ledger: takeIn(declined.ledger, { id: `${changeId}:correction:${at}`, at, by },
      [{ id: `${changeId}:correction:${at}:request`, at, origin: { kind: by.role === "customer" ? "customer" : "operator", by, channel: "core-screen" },
        target: { grain: "site" }, words: words.trim() }]) } : declined;
  }
  ledger = markApplied(ledger, [changeId], at, record.version + 1);
  const publication: Publication = { changeId, at, by, pages, confirms, beacon: "public delivery not built yet" };
  return { ...record, ledger, publications: [...record.publications ?? [], publication] };
}

/**
 * The Knowledge the current site rests on: what its pages' Sections cite, and what the Site plan
 * cites for each page and its decision brief. This is what a Publish relies on.
 */
export function citedBySite(record: ServiceRecord): Set<string> {
  const site = currentSite(record);
  const ids = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  const fromPages = (site?.pages ?? []).flatMap(page => page.sections.flatMap(section => ids((section as { sourceIds?: unknown }).sourceIds)));
  const fromPlan = (site?.plan.pages ?? []).flatMap(entry => [...ids((entry as { sourceIds?: unknown }).sourceIds),
    ...ids((entry as { decisionBrief?: { claimIds?: unknown } }).decisionBrief?.claimIds)]);
  return new Set([...fromPages, ...fromPlan]);
}
