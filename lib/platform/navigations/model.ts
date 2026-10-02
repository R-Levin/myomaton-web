import { actionId as uuid, normalizeDestination } from "../actions/model";
import { canonicalPagePath } from "../managed-sites/paths";

export type NavigationSurface = "managedSite" | "content";
export type NavigationTargetType = "page" | "section" | "action" | "link";

// Supplied by the presentation when this ManagedSite's slugs are known to be
// rooted in the current deployment. No cross-ManagedSite routing is inferred.
export type NavigationContext = {
  managedSiteId: string;
  pageId?: string;
};

export type NavigationItem = {
  id: string;
  name: string;
  label: string;
  targetType: NavigationTargetType;
  targetReference: string;
  href: string;
  children: NavigationItem[];
};

export type Navigation = {
  id: string;
  name: string;
  surface: NavigationSurface;
  items: NavigationItem[];
};

export type NavigationItemData = Omit<NavigationItem, "href" | "children"> & {
  parentId: string | null;
  sortOrder: number;
};

export function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function visibleOnSurface(configuration: unknown, surface: NavigationSurface): boolean {
  if (surface !== "managedSite" && surface !== "content") return false;
  const config = record(configuration);
  if (!config) return false;
  if (!Object.hasOwn(config, "surfaces")) return true;
  const surfaces = record(config.surfaces);
  if (!surfaces || Object.values(surfaces).some((value) => typeof value !== "boolean")) return false;
  // Legacy serialization must never silently turn hidden navigation visible.
  // Migration 0006 refuses this key; also fail closed if it is later reintroduced.
  if (Object.hasOwn(surfaces, "microsite")) return false;
  return surfaces[surface] !== false;
}

export function normalizeNavigationItem(value: unknown, navigationId: string, surface: NavigationSurface): NavigationItemData | null {
  const row = record(value);
  if (!row || row.navigationId !== navigationId || row.status !== "active" || !visibleOnSurface(row.configuration, surface)) return null;
  const id = uuid(row.id);
  const parentId = row.parentId === null ? null : uuid(row.parentId);
  if (!id || (row.parentId !== null && !parentId) || id === parentId) return null;
  if (typeof row.name !== "string" || !row.name.trim() || typeof row.label !== "string" || !row.label.trim()) return null;
  if (row.name.length > 200 || row.label.length > 200 || !Number.isSafeInteger(row.sortOrder)) return null;
  if (row.targetType !== "page" && row.targetType !== "section" && row.targetType !== "action" && row.targetType !== "link") return null;
  const targetReference = row.targetType === "link"
    ? navigationDestination(row.targetReference)
    : uuid(row.targetReference);
  if (!targetReference) return null;
  return { id, parentId, name: row.name.trim(), label: row.label.trim(), targetType: row.targetType, targetReference, sortOrder: row.sortOrder as number };
}

export function navigationDestination(destination: unknown): string | null {
  return normalizeDestination(
    typeof destination === "string" && destination.startsWith("#") ? "section" : "link",
    destination,
  );
}

export function pageDestination(page: { managedSiteId: string; slug: unknown }, context?: NavigationContext): string | null {
  if (!context || !uuid(context.managedSiteId) || uuid(page.managedSiteId) !== uuid(context.managedSiteId)) return null;
  return canonicalPagePath(page.slug);
}

export function sectionAnchor(configuration: unknown): string | null {
  const anchor = record(configuration)?.anchor;
  return typeof anchor === "string" ? normalizeDestination("section", `#${anchor}`) : null;
}

export function navigationTree(items: NavigationItemData[], destinations: Map<string, string>): NavigationItem[] {
  const candidates = new Map(items.filter((item) => destinations.has(item.id)).map((item) => [item.id, item]));
  const nodes = new Map<string, NavigationItem>();
  const sorted = [...candidates.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  for (const item of sorted) {
    const seen = new Set<string>();
    let current: NavigationItemData | undefined = item;
    let valid = true;
    while (current) {
      if (seen.has(current.id) || seen.size >= 8) { valid = false; break; }
      seen.add(current.id);
      if (current.parentId === null) break;
      current = candidates.get(current.parentId);
      if (!current) valid = false;
    }
    if (valid) nodes.set(item.id, {
      id: item.id, name: item.name, label: item.label, targetType: item.targetType,
      targetReference: item.targetReference, href: destinations.get(item.id)!, children: [],
    });
  }
  const roots: NavigationItem[] = [];
  for (const item of sorted) {
    const node = nodes.get(item.id);
    if (!node) continue;
    if (item.parentId === null) roots.push(node);
    else nodes.get(item.parentId)?.children.push(node);
  }
  return roots;
}
