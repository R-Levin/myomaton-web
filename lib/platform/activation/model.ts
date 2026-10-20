import { choice, fingerprint, object, text, uuid } from "../canonical/model";
import { submissionDigest, type Owner, type Submission } from "../reviews/model";

export type Operation = "inspect" | "create" | "confirm-commercial" | "assess" | "confirm-information";
export type Scope = Owner & { pendingCustomerId: string };
export type Authority = { operatorId: string; authorityReference: string };
// Supplied by a trusted composition root, never deserialized from a request body.
// The authenticator must resolve the opaque context and check this exact operation/scope.
export interface OperatorAuthority { authorize(context: unknown, operation: Operation, scope: Scope): Promise<Authority> }
export type ReviewBinding = { id: string; revision: number; digest: string; evidenceDigest: string; approvalEventHash: string };
export const areas = ["business-identity", "audience", "offering", "service-area", "operating-access"] as const;
export type Area = typeof areas[number];
export type Assessment = { area: Area; state: "CONFIRMED" | "UNCONFIRMED" | "MISSING"; fields: string[]; reference?: string; confirmedBy?: string; confirmedAt?: string }[];
export type Commercial = { source: "manual-invoice" | "agreement-order" | "external-provider"; reference: string; confirmedAt: string; launchScope: string; ongoingScope: string; note?: string; recordedBy: string; authorityReference: string };
export type CaseState = { status: "PENDING_COMMERCIAL" | "AUTHORIZED_FOR_ONBOARDING"; commercial: Commercial | null; assessment: Assessment };
export type Source = { submissionId: string; intakeId: string; digest: string; questionnaireVersion: string; draftVersion: number; path: "FREE_REVIEW" | "DIRECT_START" };
export type CreateCase = { requestId: string; scope: Scope; submissionId: string; submissionDigest: string; review?: { id: string; revision: number; digest: string } };
export function digest(value: unknown) { if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw Error("Invalid digest"); return value; }
export function scope(value: Scope): Scope { object(value, ["webPresenceId", "managedSiteId", "pendingCustomerId"]); return { webPresenceId: uuid(value.webPresenceId), managedSiteId: uuid(value.managedSiteId), pendingCustomerId: uuid(value.pendingCustomerId) }; }
export function source(submission: Submission): Source {
  if (submissionDigest(submission) !== submission.digest) throw Error("Immutable source digest mismatch");
  return { submissionId: uuid(submission.id), intakeId: uuid(submission.intake_id), digest: digest(submission.digest), questionnaireVersion: text(submission.questionnaire_version, 80), draftVersion: submission.draft_version, path: choice(submission.entry_intent, ["FREE_REVIEW", "DIRECT_START"]) };
}
const fields: Record<Area, string[]> = { "business-identity": ["businessName"], audience: ["audience"], offering: ["offer"], "service-area": ["serviceArea", "locations"], "operating-access": [] };
export function initialAssessment(s: Submission): Assessment {
  return areas.map(area => { const present = fields[area].filter(k => s.answers[k] !== undefined && s.answers[k] !== ""); return { area, state: present.length ? "UNCONFIRMED" : "MISSING", fields: present }; });
}
export function assessment(value: unknown, s: Submission, authority: Authority, at: string): Assessment {
  if (!Array.isArray(value) || value.length !== areas.length) throw Error("Five bounded assessment areas required");
  const result = value.map(v => {
    const r = object(v, ["area", "state", "fields", "reference"]), area = choice(r.area, areas), state = choice(r.state, ["CONFIRMED", "UNCONFIRMED", "MISSING"]);
    if (!Array.isArray(r.fields) || r.fields.length > 8 || new Set(r.fields).size !== r.fields.length || r.fields.some(k => typeof k !== "string" || !Object.hasOwn(s.answers, k) || !s.provenance[k] || s.answers[k] === "")) throw Error("Assessment source fields must exist in immutable intake");
    if (state === "MISSING" && r.fields.length || state === "UNCONFIRMED" && !r.fields.length) throw Error("Assessment source/state conflict");
    if (state !== "CONFIRMED" && r.reference !== undefined) throw Error("Only explicit confirmation has an external attestation reference");
    return { area, state, fields: [...r.fields] as string[], ...(state === "CONFIRMED" ? { reference: text(r.reference, 300), confirmedBy: authority.operatorId, confirmedAt: at } : {}) };
  });
  if (new Set(result.map(r => r.area)).size !== areas.length) throw Error("Duplicate assessment area");
  return areas.map(area => result.find(r => r.area === area)!);
}
export function commercial(value: unknown, authority: Authority): Commercial {
  const r = object(value, ["source", "reference", "confirmedAt", "launchScope", "ongoingScope", "note"]);
  if (typeof r.confirmedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(r.confirmedAt) || !Number.isFinite(Date.parse(r.confirmedAt)) || Date.parse(r.confirmedAt) > Date.now()) throw Error("Invalid external confirmation timestamp");
  return { source: choice(r.source, ["manual-invoice", "agreement-order", "external-provider"]), reference: text(r.reference, 300), confirmedAt: new Date(r.confirmedAt).toISOString(), launchScope: text(r.launchScope, 600), ongoingScope: text(r.ongoingScope, 600), ...(r.note === undefined ? {} : { note: text(r.note, 400) }), authorityReference: authority.authorityReference, recordedBy: authority.operatorId };
}
export const same = (a: unknown, b: unknown) => fingerprint(a) === fingerprint(b);
