export type PresentedSubject = { id: string; name: string; description: string | null };

export function subjectId(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase() : null;
}

export function presentSubject(value: unknown, webPresenceId: string): PresentedSubject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = subjectId(row.id);
  if (!id || row.webPresenceId !== webPresenceId || row.status !== "active"
    || typeof row.name !== "string" || !row.name.trim()) return null;
  return { id, name: row.name, description: typeof row.description === "string" ? row.description : null };
}
