import { createHash } from "node:crypto";
import { actionId } from "../actions/model";

export function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Expected object");
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some(k => !keys.includes(k))) throw Error("Unknown canonical field");
  return result;
}
export function text(value: unknown, max = 200, multiline = false): string {
  const unsafe=multiline ? /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/ : /[<>\u0000-\u001f\u007f-\u009f]/;
  if (typeof value !== "string" || !value.trim() || value.length > max || unsafe.test(value)) throw Error("Invalid canonical text");
  return value.replace(/\r\n?/g,"\n").trim();
}
export function choice<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (!allowed.includes(value as T)) throw Error("Invalid canonical choice");
  return value as T;
}
export function uuid(value: unknown): string { const id = actionId(value); if (!id) throw Error("Invalid UUID"); return id; }
export function key(value: unknown): string { const s = text(value, 64); if (!/^[a-z][a-z0-9_-]*$/.test(s)) throw Error("Invalid local key"); return s; }
function list(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 30) throw Error("Invalid bounded list");
  return value.map(v => text(v, 1000));
}
function date(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) throw Error("Invalid attestation date");
  return new Date(value).toISOString();
}
export type Approval = { by: string; at: string; scope: "internal" | "public" };
export function approval(value: unknown): Approval {
  const r = object(value, ["by", "at", "scope"]);
  return { by: text(r.by), at: date(r.at), scope: choice(r.scope, ["internal", "public"]) };
}
export type Evidence = { sourceKind: "customer" | "operator" | "public-reference"; sourceReference: string;
  confirmation: "confirmed" | "provisional"; visibility: "internal" | "public"; confirmedBy?: string; confirmedAt?: string; correction?: string };
export function evidence(value: unknown): Evidence {
  const r = object(value, ["sourceKind", "sourceReference", "confirmation", "visibility", "confirmedBy", "confirmedAt", "correction"]);
  const confirmation = choice(r.confirmation, ["confirmed", "provisional"]);
  if (confirmation === "provisional" && (r.confirmedBy !== undefined || r.confirmedAt !== undefined)) throw Error("Provisional evidence cannot be confirmed");
  return { sourceKind: choice(r.sourceKind, ["customer", "operator", "public-reference"]), sourceReference: text(r.sourceReference, 1000),
    confirmation, visibility: choice(r.visibility, ["internal", "public"]),
    ...(confirmation === "confirmed" ? { confirmedBy: text(r.confirmedBy), confirmedAt: date(r.confirmedAt) } : {}),
    ...(r.correction === undefined ? {} : { correction: text(r.correction, 1000) }) };
}
export const knowledgeKinds = ["audience", "goal", "service-area", "differentiator", "constraint", "preference"] as const;
export type Knowledge = { entries: { key: string; kind: typeof knowledgeKinds[number]; value: string; evidence: Evidence }[];
  identityEvidence: { field: "displayName" | "phone" | "email" | "socials"; digest: string; evidence: Evidence }[]; approval: Approval };
export function normalizeKnowledge(value: unknown): Knowledge {
  const r = object(value, ["entries", "identityEvidence", "approval"]);
  if (!Array.isArray(r.entries) || r.entries.length > 100 || !Array.isArray(r.identityEvidence) || r.identityEvidence.length > 4) throw Error("Invalid knowledge entries");
  const seen = new Set<string>();
  const entries = r.entries.map(v => { const e = object(v, ["key", "kind", "value", "evidence"]); const id = key(e.key);
    if (seen.has(id)) throw Error("Duplicate knowledge key"); seen.add(id);
    return { key: id, kind: choice(e.kind, knowledgeKinds), value: text(e.value, 2000, true), evidence: evidence(e.evidence) }; });
  const fields = new Set<string>();
  const identityEvidence = r.identityEvidence.map(v => { const e = object(v, ["field", "digest", "evidence"]);
    const field = choice(e.field, ["displayName", "phone", "email", "socials"] as const);
    if (fields.has(field) || typeof e.digest !== "string" || !/^[a-f0-9]{64}$/.test(e.digest)) throw Error("Invalid identity evidence"); fields.add(field);
    return { field, digest: e.digest, evidence: evidence(e.evidence) }; });
  return { entries, identityEvidence, approval: approval(r.approval) };
}
function stable(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k,stable(v)]));
  return value;
}
export function fingerprint(value: unknown): string { return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex"); }
export function identityConfirmed(entry: Knowledge["identityEvidence"][number], business: Record<string, unknown>): boolean {
  return entry.evidence.confirmation === "confirmed" && entry.digest === fingerprint(business[entry.field] ?? null);
}
export type Price = { mode: "fixed" | "included" | "scope-confirmed" | "not-published"; amount?: number; currency: "USD" | "EUR" | "GBP";
  basis: "one-time" | "recurring"; interval?: "month" | "year"; applicability: "component" | "complexity-increment"; incrementKey?: string;
  note?: string; commercialStatus: "provisional-hypothesis" | "confirmed-commercial-term"; approval: Approval };
export function normalizePrice(value: unknown): Price {
  const r = object(value, ["mode", "amount", "currency", "basis", "interval", "applicability", "incrementKey", "note", "commercialStatus", "approval"]);
  const mode = choice(r.mode, ["fixed", "included", "scope-confirmed", "not-published"]);
  if (mode === "fixed" ? !Number.isSafeInteger(r.amount) || Number(r.amount) < 0 : r.amount !== undefined) throw Error("Invalid minor-unit amount");
  const basis = choice(r.basis, ["one-time", "recurring"]);
  if (basis === "one-time" && r.interval !== undefined) throw Error("Unexpected recurring interval");
  const applicability = choice(r.applicability, ["component", "complexity-increment"]);
  if (applicability === "complexity-increment" && mode !== "fixed") throw Error("Complexity increments require a fixed amount");
  if (applicability === "component" && r.incrementKey !== undefined) throw Error("Unexpected increment key");
  return { mode, ...(mode === "fixed" ? { amount: Number(r.amount) } : {}), currency: choice(r.currency, ["USD", "EUR", "GBP"]), basis,
    ...(basis === "recurring" ? { interval: choice(r.interval, ["month", "year"] as const) } : {}), applicability,
    ...(applicability === "complexity-increment" ? { incrementKey: key(r.incrementKey) } : {}),
    ...(r.note === undefined ? {} : { note: text(r.note, 1000) }), commercialStatus: choice(r.commercialStatus, ["provisional-hypothesis", "confirmed-commercial-term"]), approval: approval(r.approval) };
}
export function formatPrice(price: Price | undefined): string | null {
  if (!price || price.approval.scope !== "public" || price.mode === "not-published") return null;
  if (price.mode === "included") return "Included";
  if (price.mode === "scope-confirmed") return "Price confirmed after scope review";
  // All supported currencies use two minor-unit digits. No inferred currency.
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: price.currency, minimumFractionDigits: price.amount! % 100 ? 2 : 0 }).format(price.amount! / 100);
  return amount + (price.basis === "recurring" ? `/${price.interval}` : " one-time") + (price.commercialStatus === "provisional-hypothesis" ? " (provisional)" : "");
}
export type Component = { key: string; kind: "establishment" | "ongoing" | "supported-complexity"; name: string; summary: string;
  inclusions: string[]; boundaries: string[]; commercialRelationship: string; complexityNotes: string[]; timingGuidance?: string; pricing?: Price };
export type OfferingPayload = { summary: string; detail: string; audiences: string[]; outcomes: string[]; inclusions: string[]; exclusions: string[];
  actionIds: string[]; components: Component[]; thirdPartyCosts: string[]; evidence: Evidence; approval: Approval };
export function normalizeOffering(value: unknown): OfferingPayload {
  const r = object(value, ["summary", "detail", "audiences", "outcomes", "inclusions", "exclusions", "actionIds", "components", "thirdPartyCosts", "evidence", "approval"]);
  if (!Array.isArray(r.components) || r.components.length > 20 || !Array.isArray(r.actionIds) || r.actionIds.length > 10) throw Error("Invalid Offering references");
  const seen = new Set<string>();
  const components = r.components.map(v => { const c = object(v, ["key", "kind", "name", "summary", "inclusions", "boundaries", "timingGuidance", "commercialRelationship", "complexityNotes", "pricing"]); const id = key(c.key);
    if (seen.has(id)) throw Error("Duplicate component key"); seen.add(id);
    return { key: id, kind: choice(c.kind, ["establishment", "ongoing", "supported-complexity"] as const), name: text(c.name), summary: text(c.summary, 2000),
      inclusions: list(c.inclusions), boundaries: list(c.boundaries), commercialRelationship: text(c.commercialRelationship, 1000), complexityNotes: list(c.complexityNotes),
      ...(c.timingGuidance === undefined ? {} : { timingGuidance: text(c.timingGuidance, 1000) }), ...(c.pricing === undefined ? {} : { pricing: normalizePrice(c.pricing) }) }; });
  const result = { summary: text(r.summary, 2000), detail: text(r.detail, 10000,true), audiences: list(r.audiences), outcomes: list(r.outcomes), inclusions: list(r.inclusions), exclusions: list(r.exclusions),
    actionIds: r.actionIds.map(uuid), components, thirdPartyCosts: list(r.thirdPartyCosts), evidence: evidence(r.evidence), approval: approval(r.approval) };
  if (result.approval.scope === "public" && result.evidence.confirmation !== "confirmed") throw Error("Public Offering must be confirmed");
  return result;
}
