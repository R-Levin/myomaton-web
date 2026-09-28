import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/platform/db/connection";
import { navigations } from "@/lib/platform/db/schema/navigations";
import { navigationItems } from "@/lib/platform/db/schema/navigation-items";
import { webPresences } from "@/lib/platform/db/schema/web-presences";
import { microsites } from "@/lib/platform/db/schema/microsites";
import { pages } from "@/lib/platform/db/schema/pages";
import { sections } from "@/lib/platform/db/schema/sections";
import { getActionsByIds } from "@/lib/platform/actions/service";
import { actionId as uuid, normalizeDestination } from "@/lib/platform/actions/model";
import {
  navigationDestination, navigationTree, normalizeNavigationItem,
  pageDestination, sectionAnchor, visibleOnSurface,
  type Navigation, type NavigationSurface, type NavigationContext,
} from "./model";

export async function getNavigationByName(
  webPresenceId: string,
  name: string,
  surface: NavigationSurface,
  context?: NavigationContext,
): Promise<Navigation | null> {
  const presenceId = uuid(webPresenceId);
  if (!presenceId || (surface !== "microsite" && surface !== "content")) return null;
  const [navigation] = await db
    .select({ id: navigations.id, name: navigations.name, configuration: navigations.configuration })
    .from(navigations)
    .innerJoin(webPresences, eq(navigations.webPresenceId, webPresences.id))
    .where(and(eq(navigations.webPresenceId, presenceId), eq(navigations.name, name), eq(navigations.status, "active"), eq(webPresences.status, "active")))
    .limit(1);
  if (!navigation || !visibleOnSurface(navigation.configuration, surface)) return null;

  const rows = await db.select({
    id: navigationItems.id, navigationId: navigationItems.navigationId, parentId: navigationItems.parentId,
    name: navigationItems.name, label: navigationItems.label, targetType: navigationItems.targetType,
    targetReference: navigationItems.targetReference, sortOrder: navigationItems.sortOrder,
    status: navigationItems.status, configuration: navigationItems.configuration,
  }).from(navigationItems)
    .where(and(eq(navigationItems.navigationId, navigation.id), eq(navigationItems.status, "active")))
    .orderBy(asc(navigationItems.sortOrder), asc(navigationItems.id));
  const items = rows.map((row) => normalizeNavigationItem(row, navigation.id, surface)).filter((item) => item !== null);
  const micrositeId = uuid(context?.micrositeId);
  const currentPageId = context?.pageId === undefined ? undefined : uuid(context.pageId);
  const routingContext = micrositeId && currentPageId !== null
    ? { micrositeId, pageId: currentPageId }
    : undefined;
  const refs = (type: string) => [...new Set(items.filter((item) => item.targetType === type).map((item) => item.targetReference))];
  const actions = await getActionsByIds(presenceId, refs("action"));
  const pageIds = refs("page");
  const sectionIds = refs("section");
  const pageRows = !routingContext || pageIds.length === 0 ? [] : await db
    .select({ id: pages.id, micrositeId: pages.micrositeId, slug: pages.slug })
    .from(pages).innerJoin(microsites, eq(pages.micrositeId, microsites.id))
    .where(and(inArray(pages.id, pageIds), eq(microsites.id, routingContext.micrositeId), eq(microsites.webPresenceId, presenceId), eq(microsites.status, "active"), eq(pages.status, "active")));
  const pageLinks = new Map(pageRows.map((page) => [page.id, pageDestination(page, routingContext)]));

  const sectionRows = !routingContext || sectionIds.length === 0 ? [] : await db
    .select({ id: sections.id, configuration: sections.configuration, pageId: pages.id, micrositeId: pages.micrositeId, slug: pages.slug })
    .from(sections)
    .innerJoin(pages, eq(sections.pageId, pages.id))
    .innerJoin(microsites, eq(pages.micrositeId, microsites.id))
    .where(and(
      inArray(sections.id, sectionIds), eq(microsites.id, routingContext.micrositeId),
      eq(microsites.webPresenceId, presenceId), eq(microsites.status, "active"), eq(pages.status, "active"), eq(sections.status, "active"),
    ));
  const sectionTargets = sectionRows.map((section) => {
    const anchor = sectionAnchor(section.configuration);
    const page = pageDestination(section, routingContext);
    const href = anchor && page
      ? (section.pageId === routingContext?.pageId ? anchor : `${page}${anchor}`)
      : null;
    return { id: section.id, href };
  });

  const destinations = new Map<string, string>();
  for (const item of items) {
    let href: string | null | undefined;
    if (item.targetType === "link") href = navigationDestination(item.targetReference);
    if (item.targetType === "page") href = pageLinks.get(item.targetReference);
    if (item.targetType === "section") href = sectionTargets.find((section) => section.id === item.targetReference)?.href;
    if (item.targetType === "action") {
      const action = actions.get(item.targetReference);
      // Bare anchors have the same document-local meaning as CTA Actions.
      if (action) href = normalizeDestination(action.type, action.destination);
    }
    if (href) destinations.set(item.id, href);
  }
  return { id: navigation.id, name: navigation.name, surface, items: navigationTree(items, destinations) };
}
