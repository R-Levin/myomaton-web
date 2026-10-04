import { actionId } from "../actions/model";
import { resolveBusinessIdentity, type BusinessIdentity } from "../site-globals/model";

export const fieldLimits = { name: 200, email: 254, phone: 40, organization: 200, message: 5000 } as const;
export type FieldName = keyof typeof fieldLimits;
export type ContactDefinition = { id: string; version: number; fields: { key: FieldName; label: string; required: boolean }[]; text?: string; privacyText?: string; successText: string };
export type ContactPresentation = { definition: ContactDefinition; sectionId: string; identity: BusinessIdentity };
export class ContactError extends Error {
  constructor(public code: string, public status = 400, public fieldErrors: Partial<Record<FieldName, string>> = {}) { super(code); }
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ContactError("invalid_object");
  return value as Record<string, unknown>;
}
export function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  if (Object.keys(value).some(k => !keys.includes(k))) throw new ContactError("unexpected_field");
}
function text(value: unknown, max: number, multiline = false): string {
  if (typeof value !== "string" || value.length > max || (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/ : /[\u0000-\u001f\u007f-\u009f]/).test(value)) throw new ContactError("invalid_text");
  return value.replace(/\r\n?/g, "\n").trim();
}
export function normalizeDefinition(row: { id: string; version: number; status: string; configuration: unknown }): ContactDefinition {
  if (!actionId(row.id) || row.status !== "active" || !Number.isSafeInteger(row.version) || row.version < 1) throw new ContactError("unavailable", 404);
  const c = record(row.configuration); exactKeys(c, ["fields", "text", "privacyText", "successText"]);
  if (!Array.isArray(c.fields) || !c.fields.length || c.fields.length > 5) throw new ContactError("invalid_definition");
  const seen = new Set<string>();
  const fields = c.fields.map(value => {
    const f = record(value); exactKeys(f, ["key", "label", "required"]);
    if (typeof f.key !== "string" || !Object.hasOwn(fieldLimits, f.key) || seen.has(f.key) || typeof f.required !== "boolean") throw new ContactError("invalid_definition");
    seen.add(f.key); const label = text(f.label, 100); if (!label) throw new ContactError("invalid_definition");
    return { key: f.key as FieldName, label, required: f.required };
  });
  const successText = c.successText === undefined ? "Your message has been received." : text(c.successText, 500, true);
  if (!successText) throw new ContactError("invalid_definition");
  return { id: row.id, version: row.version, fields, successText,
    ...(c.text === undefined ? {} : { text: text(c.text, 2000, true) }),
    ...(c.privacyText === undefined ? {} : { privacyText: text(c.privacyText, 2000, true) }) };
}
export function normalizeFields(input: unknown, definition: ContactDefinition): Partial<Record<FieldName, string>> {
  const raw = record(input); exactKeys(raw, definition.fields.map(f => f.key));
  const fields: Partial<Record<FieldName, string>> = {}, errors: Partial<Record<FieldName, string>> = {};
  for (const f of definition.fields) {
    try {
      const value = raw[f.key] === undefined ? "" : text(raw[f.key], fieldLimits[f.key], f.key === "message");
      if (!value) { if (f.required) errors[f.key] = "This field is required."; continue; }
      if (f.key === "email" && !resolveBusinessIdentity({ business: { email: value } }, "", "").email) throw new Error();
      if (f.key === "phone" && !resolveBusinessIdentity({ business: { phone: value } }, "", "").phone) throw new Error();
      fields[f.key] = value;
    } catch { errors[f.key] = "Enter a valid value within the allowed length."; }
  }
  if (Object.keys(errors).length) throw new ContactError("invalid_fields", 422, errors);
  if (!Object.keys(fields).length) throw new ContactError("empty_submission", 422);
  return fields;
}
export function submissionInput(value: unknown) {
  const input = record(value); exactKeys(input, ["sectionId", "definitionId", "version", "fields", "idempotencyKey", "website"]);
  if (!actionId(input.sectionId) || !actionId(input.definitionId) || !Number.isSafeInteger(input.version) || Number(input.version) < 1 || typeof input.idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{16,100}$/.test(input.idempotencyKey)) throw new ContactError("invalid_request");
  if (input.website !== undefined && input.website !== "") throw new ContactError("rejected");
  return { sectionId: actionId(input.sectionId)!, definitionId: actionId(input.definitionId)!, version: Number(input.version), fields: input.fields, idempotencyKey: input.idempotencyKey };
}
