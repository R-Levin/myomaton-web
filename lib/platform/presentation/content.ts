import { actionId } from "../actions/model";

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function exact(value: unknown, keys: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) throw Error("Unsupported contract fields");
  return record(value);
}
export function plain(value: unknown, limit = 2000): string {
  if (typeof value !== "string" || !value.trim() || value.length > limit || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw Error("Plain bounded text required");
  return value.trim();
}
function key(value: unknown) { const v = plain(value, 80); if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(v)) throw Error("Stable key required"); return v; }
function list(value: unknown, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw Error("Invalid bounded list"); return value;
}
function unique<T extends { id: string }>(items: T[]): T[] { if (new Set(items.map(i => i.id)).size !== items.length) throw Error("Duplicate keys"); return items; }
function optionalAction(value: unknown) { if (value === undefined) return {}; const id = actionId(value); if (!id) throw Error("Invalid Action reference"); return { actionId: id }; }
export type ValuePoint = { id: string; heading: string; text?: string };
export function valuePoints(value: unknown): ValuePoint[] {
  return unique(list(value, 2, 4).map(v => { const p = exact(v, ["id", "heading", "text"]); return { id: key(p.id), heading: plain(p.heading, 100), ...(p.text === undefined ? {} : { text: plain(p.text, 300) }) }; }));
}
type Item = { id: string; heading: string; text: string; actionId?: string; category?: "included" | "boundary" | "extension" };
export type Relationship = { contractVersion: 1 | 2; extensions?: { id: string; stageId: string; heading: string; text: string }[]; heading?: string; text?: string } & (
  | { kind: "stages" | "scope"; items: Item[] }
  | { kind: "responsibilities"; parties: { id: string; label: string }[]; rows: { id: string; label: string; cells: { partyId: string; text: string }[] }[] }
);
export function relationship(value: unknown): Relationship {
  const r = exact(value, ["contractVersion", "kind", "heading", "text", "items", "parties", "rows", "extensions"]);
  if (r.contractVersion !== 1 && r.contractVersion !== 2) throw Error("Unsupported relationship version");
  if (r.contractVersion === 1 && r.extensions !== undefined) throw Error("Extensions require relationship v2");
  if (r.contractVersion === 2 && r.kind !== "stages") throw Error("Relationship v2 supports connected stages only");
  const copy = { contractVersion: r.contractVersion as 1 | 2, ...(r.heading === undefined ? {} : { heading: plain(r.heading, 200) }), ...(r.text === undefined ? {} : { text: plain(r.text) }) };
  if (r.kind === "stages" || r.kind === "scope") {
    if (r.parties !== undefined || r.rows !== undefined) throw Error("Incompatible relationship fields");
    const kind = r.kind;
    const items = unique(list(r.items, 2, 8).map(v => {
      const i = exact(v, ["id", "heading", "text", "actionId", "category"]);
      if (kind === "scope" ? !["included", "boundary", "extension"].includes(String(i.category)) : i.category !== undefined) throw Error("Invalid relationship category");
      return { id: key(i.id), heading: plain(i.heading, 160), text: plain(i.text), ...optionalAction(i.actionId), ...(kind === "scope" ? { category: i.category as Item["category"] } : {}) };
    }));
    const extensions = r.extensions === undefined ? undefined : unique(list(r.extensions, 1, 3).map(v => { const e = exact(v, ["id", "stageId", "heading", "text"]); const stageId = key(e.stageId); if (!items.some(i => i.id === stageId)) throw Error("Extension must attach to a named stage"); return { id: key(e.id), stageId, heading: plain(e.heading, 160), text: plain(e.text) }; }));
    return { ...copy, kind, items, ...(extensions ? { extensions } : {}) };
  }
  if (r.kind !== "responsibilities" || r.items !== undefined) throw Error("Unsupported relationship kind");
  const parties = unique(list(r.parties, 2, 3).map(v => { const p = exact(v, ["id", "label"]); return { id: key(p.id), label: plain(p.label, 100) }; }));
  const rows = unique(list(r.rows, 1, 10).map(v => {
    const row = exact(v, ["id", "label", "cells"]);
    const cells = list(row.cells, parties.length, parties.length).map(v => { const c = exact(v, ["partyId", "text"]); return { partyId: key(c.partyId), text: plain(c.text) }; });
    if (new Set(cells.map(c => c.partyId)).size !== parties.length || cells.some(c => !parties.some(p => p.id === c.partyId))) throw Error("Each party must occur once");
    return { id: key(row.id), label: plain(row.label, 120), cells: parties.map(p => cells.find(c => c.partyId === p.id)!) };
  }));
  return { ...copy, kind: "responsibilities", parties, rows };
}
