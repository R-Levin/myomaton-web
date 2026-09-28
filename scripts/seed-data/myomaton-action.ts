export const myomatonAction = {
  name: "Learn about Myomaton",
  type: "section",
  label: "Learn more",
  destination: "#about",
};

// Only upgrade the known legacy seed relationship; preserve custom content/references.
export function upgradeMyomatonCtaContent(content: unknown, actionId: string) {
  if (!content || typeof content !== "object" || Array.isArray(content)) return null;
  const existing = content as Record<string, unknown>;
  if (Object.hasOwn(existing, "actionId")) return null;
  if (existing.actionLabel !== myomatonAction.label || existing.actionHref !== myomatonAction.destination) return null;
  const updated = { ...existing, actionId } as Record<string, unknown>;
  delete updated.actionLabel;
  delete updated.actionHref;
  return updated;
}
