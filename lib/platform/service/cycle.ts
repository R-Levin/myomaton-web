import { decide, emptyLedger, markApplied, review as reviewChange, takeIn, type Change, type ChangeLedger, type Consequence,
  type Grain, type Person, type Request } from "../change/model";
import { fingerprint } from "../canonical/model";
import { directionIdentity, pageIdentity, reportIdentity, sitePlanIdentity, versionPages } from "../work-products/pages";

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
export type SitePlan = { pages: PlanEntry[] };
export type PageContent = { path: string; heading: string; sections: { heading: string; body: string; [key: string]: unknown }[]; [key: string]: unknown };

/** One saved state of a Work product. A proposed Version becomes current only when its Change is approved. */
export type ProductVersion = {
  id: string; kind: Kind; version: number; path?: string; content: unknown; changeId: string; at: string;
  status: "proposed" | "current" | "superseded" | "declined";
};

/** An Account's service record: its Change record and every Version of its Work products. */
export type ServiceRecord = { account: { webPresenceId: string; managedSiteId: string }; version: number; ledger: ChangeLedger; products: ProductVersion[] };

/** What Core gives its writer (the AI, or a labelled Beacon standing in for it) for one Work product. */
export type WriteInput = {
  kind: Kind; knowledge: readonly unknown[]; report?: unknown; direction?: unknown; sitePlan?: SitePlan; page?: PlanEntry;
  /** The current Version being reworked, and the words of each Request asking for the rework. */
  previous?: unknown; requests: string[];
};
export interface Writer { write(input: WriteInput): Promise<unknown> }

export type Task = { id: string; who: "core" | "specialist" | "client"; what: string; requestIds?: string[]; changeId?: string };

const core: Person = { id: "core", role: "core" };
/** How much review each Work product needs (Consequence level). Publishing always needs the Client. */
const consequence: Record<Kind, Consequence> = { report: "customer-approval", direction: "operator-review", "site-plan": "operator-review", page: "operator-review" };
const grainOf: Record<Kind, Grain> = { report: "report", direction: "direction", "site-plan": "site-plan", page: "page" };
const kindOf = (grain: Grain): Kind | undefined => (Object.entries(grainOf).find(([, value]) => value === grain)?.[0] as Kind | undefined)
  ?? (grain === "new-page" ? "page" : undefined);

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

/** A person asks for a Work product to change (a correction, a Note, an email): a Request on it. */
export function ask(record: ServiceRecord, request: { id: string; at: string; by: Person; kind: Kind; path?: string; words: string;
  channel?: Request["origin"]["channel"] }): ServiceRecord {
  if (!request.words.trim()) throw new CycleError("invalid", "A Request needs its words");
  if (record.ledger.requests.some(item => item.id === request.id + ":request")) return record;
  const origin = request.by.role === "customer" ? "customer" : request.by.role === "core" ? "core" : "operator";
  return { ...record, ledger: takeIn(record.ledger, { id: request.id, at: request.at, by: request.by }, [{ id: request.id + ":request", at: request.at,
    origin: { kind: origin, by: request.by, channel: request.channel ?? "core-screen" },
    target: { grain: grainOf[request.kind], ...(request.path && { path: request.path }) }, words: request.words.trim() }]) };
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
  return [...writing, ...reviewing];
}
const label = (request: Request) => request.target.grain === "site-plan" ? "Site plan" : request.target.grain === "page" || request.target.grain === "new-page"
  ? `page ${request.target.name ?? request.target.path}` : request.target.grain === "report" ? "Report" : "Direction";

/** Knowledge, and the current Work products each kind builds on. */
function inputFor(record: ServiceRecord, kind: Kind, knowledge: readonly unknown[], requests: Request[], path?: string): WriteInput {
  const site = record.account.managedSiteId;
  const got = (id: string) => current(record, id)?.content;
  const plan = got(sitePlanIdentity(site)) as SitePlan | undefined;
  // The Version being reworked: the current one, or the latest draft when a first draft was corrected.
  const id = identity(record, kind, path);
  const previous = got(id) ?? record.products.findLast(item => item.id === id)?.content;
  return { kind, knowledge,
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
  const content = await writer.write(inputFor(record, kind, knowledge, requests as Request[], path));
  const id = identity(record, kind, path);
  const base = current(record, id);
  const version = Math.max(0, ...record.products.filter(item => item.id === id).map(item => item.version)) + 1;
  const stored = kind === "page" ? versionedPage(record, id, content as PageContent) : content;
  const changeId = `${id}:v${version}`;
  const change: Omit<Change, "status" | "reviews" | "decisionId"> = { id: changeId, label: `${kind}-v${version}`, at, requestIds: requests.map(request => request!.id),
    target: { grain: grainOf[kind], ...(path && { path }), workProduct: { id, version: base?.version ?? 0 } },
    base: { version: record.version, digest: fingerprint(base?.content ?? null) },
    difference: { summary: `${kind === "page" ? "the page " + path : kind === "site-plan" ? "the Site plan" : "the " + kind[0].toUpperCase() + kind.slice(1)}, version ${version}` },
    preserve: [], consequence: consequence[kind] };
  const ledger = decide(record.ledger, { id: changeId + ":decision", at, by: core, requestIds: change.requestIds, outcome: "change",
    reasoning: base ? "A new Version answering the Requests on the current one." : "The first Version." }, [change]);
  // A newer proposal replaces an older one still waiting for Review.
  const products = record.products.map(item => item.id === id && item.status === "proposed" ? { ...item, status: "superseded" as const } : item);
  return { ...record, ledger, products: [...products, { id, kind, version, ...(path && { path }), content: stored, changeId, at, status: "proposed" }] };
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
  const proposed = record.products.find(item => item.changeId === changeId);
  if (!proposed) throw new CycleError("not-found", "No such proposed Version");
  if (proposed.status !== "proposed") throw new CycleError("not-open", "That Version is not waiting for Review");
  let ledger: ChangeLedger;
  try { ledger = reviewChange(record.ledger, changeId, { at, by, response: response === "approve" ? "approve" : "decline", ...(words && { words }) }); }
  catch (error) { throw new CycleError("not-permitted", (error as Error).message); }
  if (response !== "approve") {
    const declined = { ...record, ledger, products: record.products.map(item => item.changeId === changeId ? { ...item, status: "declined" as const } : item) };
    return response === "correct" ? ask(declined, { id: `${changeId}:correction:${at}`, at, by, kind: proposed.kind, path: proposed.path, words: words ?? "" }) : declined;
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

/** The site's current Pages in Site plan order: what delivery puts into WordPress drafts. */
export function currentSite(record: ServiceRecord) {
  const plan = current(record, sitePlanIdentity(record.account.managedSiteId))?.content as SitePlan | undefined;
  if (!plan) return null;
  const pages = plan.pages.map(entry => current(record, pageIdentity(record.account.managedSiteId, entry.path)));
  return { plan, pages: pages.filter(Boolean).map(item => item!.content as PageContent & { id: string; version: number }),
    complete: pages.every(Boolean), menu: plan.pages.filter(entry => entry.inMenu).map(entry => entry.path) };
}
