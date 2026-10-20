import { choice, fingerprint, key, object, text, uuid } from "../canonical/model";
import { canonicalPagePath } from "../managed-sites/paths";
import type { Scope } from "./authority";

export type Source = { domain: "knowledge" | "offering"; recordId: string; revision: number; fingerprint: string; field: string };
export type Copy = { kind: "canonical"; source: Source } | { kind: "editorial"; text: string; rationale: string };
// An envelope around existing Page/Section content, not a replacement content model.
export type PageProposal = { operation: "create-page" | "replace-page"; pageId: string; slug: string; title: Copy; purpose: string;
  sections: { id: string; type: "hero" | "intro" | "cta"; heading: Copy; text?: Copy; actionId?: string }[] };
export type Actor = { operatorId: string; authorityReference: string };
export type CustomerAuthority = { kind: "business-representative" | "accepted-authority"; subjectId: string; authorityReference: string };
export type Permission = "prepare-site-proposal" | "inspect-site-proposal" | "revise-site-proposal" | "preview-site-proposal" | "approve-site-proposal";
export interface ProposalAuthority { authorize(context: unknown, operation: Permission, scope: Scope): Promise<Actor & { customer?: CustomerAuthority }> }
export type Binding = { proposalId: string; scope: Scope; revision: number; digest: string; baseFingerprint: string };
export type ResolvedCopy = { path: string; value: string; origin: Copy; evidence?: unknown };
export type Candidate = { title: string; sections: { id: string; type: string; variant: string; name: string; content: { heading: string; text?: string; actionId?: string }; configuration: unknown; action?: { id: string; name: string; type: "link" | "section" | "contact" | "page"; label: string; destination: string } }[] };
export type Revision = { binding: Binding; at: string; author: Actor; page: PageProposal; resolved: ResolvedCopy[]; candidate: Candidate; base: unknown };
export type Approval = { binding: Binding; previewDigest: string; previewEvent: string; recordedBy: Actor; customer: CustomerAuthority; reference: string; at: string };
export type Event = { sequence: number; previous: string | null; requestId: string; requestDigest: string; action: "revise" | "preview" | "approve"; at: string; actor: Actor; revision?: Revision; preview?: { binding: Binding; digest: string }; approval?: Approval; hash: string };
export type ProposalState = { id: string; scope: Scope; revisions: Revision[]; events: Event[]; state: "PROPOSED" | "APPROVED"; approval: Approval | null; createdAt: string; updatedAt: string };
export function proposalOnly() {
  if (process.env.NODE_ENV !== "development" || process.env.MIOPAGES_SITE_PROPOSALS !== "local-operator") throw Error("Local development site-proposal tooling only");
}
export function proposalScope(value: unknown): Scope { const s = object(value, ["webPresenceId", "managedSiteId"]); return { webPresenceId: uuid(s.webPresenceId), managedSiteId: uuid(s.managedSiteId) }; }
export function hash(value: unknown): string { if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw Error("Exact proposal digest required"); return value; }
export function binding(value: unknown): Binding {
  const b = object(value, ["proposalId", "scope", "revision", "digest", "baseFingerprint"]);
  if (!Number.isSafeInteger(b.revision) || Number(b.revision) < 1) throw Error("Exact proposal revision required");
  return { proposalId: uuid(b.proposalId), scope: proposalScope(b.scope), revision: Number(b.revision), digest: hash(b.digest), baseFingerprint: hash(b.baseFingerprint) };
}
function copy(value: unknown, max: number): Copy {
  const c = object(value, ["kind", "source", "text", "rationale"]);
  if (c.kind === "editorial") { object(c, ["kind", "text", "rationale"]); return { kind: "editorial", text: text(c.text, max, true), rationale: text(c.rationale, 500) }; }
  object(c, ["kind", "source"]); choice(c.kind, ["canonical"]);
  const s = object(c.source, ["domain", "recordId", "revision", "fingerprint", "field"]);
  if (!Number.isSafeInteger(s.revision) || Number(s.revision) < 1) throw Error("Exact canonical revision required");
  return { kind: "canonical", source: { domain: choice(s.domain, ["knowledge", "offering"]), recordId: uuid(s.recordId), revision: Number(s.revision), fingerprint: hash(s.fingerprint), field: key(s.field) } };
}
export function pageProposal(value: unknown): PageProposal {
  const p = object(value, ["operation", "pageId", "slug", "title", "purpose", "sections"]);
  const slug = canonicalPagePath(p.slug); if (!slug) throw Error("Supported Page path required");
  if (!Array.isArray(p.sections) || p.sections.length < 1 || p.sections.length > 6) throw Error("One to six supported Sections required");
  const sections = p.sections.map(value => {
    const s = object(value, ["id", "type", "heading", "text", "actionId"]);
    return { id: uuid(s.id), type: choice(s.type, ["hero", "intro", "cta"]), heading: copy(s.heading, 300), ...(s.text === undefined ? {} : { text: copy(s.text, 2000) }), ...(s.actionId === undefined ? {} : { actionId: uuid(s.actionId) }) };
  });
  if (new Set(sections.map(s => s.id)).size !== sections.length) throw Error("Duplicate Section identity");
  return { operation: choice(p.operation, ["create-page", "replace-page"]), pageId: uuid(p.pageId), slug, title: copy(p.title, 300), purpose: text(p.purpose, 500), sections };
}
export function revisionDigest(value: Omit<Revision, "binding">, identity: Omit<Binding, "digest">) { return fingerprint({ ...identity, ...value }); }
