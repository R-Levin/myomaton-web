import { canonicalPagePath } from "../managed-sites/paths";

export type ActionType = "link" | "section" | "contact" | "page";

export type Action = {
  id: string;
  name: string;
  type: ActionType;
  label: string;
  destination: string; // Resolved URL in this presentation DTO, never a Page UUID.
};

export function actionId(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase()
    : null;
}

export function sectionActionId(content: unknown): string | null {
  if (!content || typeof content !== "object" || Array.isArray(content)) return null;
  return actionId((content as Record<string, unknown>).actionId);
}

export function normalizeDestination(type: ActionType, value: unknown): string | null {
  if (type === "page") return canonicalPagePath(value);
  if (type !== "link" && type !== "section" && type !== "contact") return null;
  if (typeof value !== "string" || !value || value.length > 2048) return null;
  // Reject controls, whitespace, markup, backslashes, and their encoded forms.
  const unsafe = /[\s\u0000-\u001f\u007f-\u009f\\<>"`]/;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (unsafe.test(value) || unsafe.test(decoded)) return null;

  if (value.startsWith("#")) {
    return type !== "link" && /^#[A-Za-z][A-Za-z0-9_.:-]*$/.test(value) ? value : null;
  }
  if (type === "section") return null;

  if (value.startsWith("/")) {
    if (decoded.startsWith("//")) return null;
    const url = new URL(value, "https://platform.invalid");
    if (url.origin !== "https://platform.invalid" || url.pathname.startsWith("//")) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  }

  // Contact only points to an existing internal page or section in this slice.
  if (type !== "link" || !/^https?:\/\/[^/?#]/i.test(value)) return null;
  try {
    const url = new URL(value);
    if (!url.hostname || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function normalizeAction(value: unknown, webPresenceId: string,
  pageDestinations: ReadonlyMap<string, string> = new Map()): Action | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.webPresenceId !== webPresenceId || row.status !== "active") return null;
  if (row.type !== "link" && row.type !== "section" && row.type !== "contact" && row.type !== "page") return null;
  const id = actionId(row.id);
  // Canonical page Actions store a UUID in destination. Only an eligible lookup
  // may translate it into the presentation URL; a literal path is not a target.
  const destination = normalizeDestination(row.type, row.type === "page"
    ? pageDestinations.get(actionId(row.destination) ?? "") : row.destination);
  if (!id || !destination || typeof row.name !== "string" || typeof row.label !== "string") return null;
  const name = row.name.trim();
  const label = row.label.trim();
  if (!name || !label || name.length > 200 || label.length > 200) return null;
  return { id, name, type: row.type, label, destination };
}
