import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { getSectionImages } from "@/lib/platform/assets/presentation-service";
import type { SectionImage } from "@/lib/platform/assets/source";

import { db } from "@/lib/platform/db/connection";
import { microsites } from "@/lib/platform/db/schema/microsites";
import { pages } from "@/lib/platform/db/schema/pages";
import { sections } from "@/lib/platform/db/schema/sections";
import { webPresences } from "@/lib/platform/db/schema/web-presences";
import { getActionsByIds } from "@/lib/platform/actions/service";
import { sectionActionId, type Action } from "@/lib/platform/actions/model";
import { getNavigationByName } from "@/lib/platform/navigations/service";
import type { Navigation } from "@/lib/platform/navigations/model";
import {
  getDesignSystemByWebPresenceId,
  type ResolvedDesignSystem,
} from "@/lib/platform/design-systems/service";

export type MicrositeSection = {
  id: string;
  type: string;
  variant: string | null;
  name: string | null;
  content: unknown;
  configuration: unknown;
  action?: Action | null;
  image?: SectionImage | null;
};

export type MicrositePage = {
  microsite: { id: string; name: string };
  page: { id: string; name: string; title: string; slug: string };
  sections: MicrositeSection[];
  designSystem: ResolvedDesignSystem;
  navigation?: Navigation | null;
};

export async function getMicrositePageByDomain(
  domain: string,
  slug: string,
): Promise<MicrositePage | null> {
  const matches = await db
    .select({
      webPresenceId: webPresences.id,
      microsite: { id: microsites.id, name: microsites.name },
      page: { id: pages.id, name: pages.name, title: pages.title, slug: pages.slug },
    })
    .from(webPresences)
    .innerJoin(microsites, eq(microsites.webPresenceId, webPresences.id))
    .innerJoin(pages, eq(pages.micrositeId, microsites.id))
    .where(and(
      eq(webPresences.primaryDomain, domain),
      eq(pages.slug, slug),
      eq(webPresences.status, "active"),
      eq(microsites.status, "active"),
      eq(pages.status, "active"),
    ))
    .limit(2);

  if (matches.length > 1) {
    throw new Error("Multiple active microsite pages match the domain and slug.");
  }

  const match = matches[0];
  if (!match) return null;

  const orderedSections = await db
    .select({
      id: sections.id,
      type: sections.type,
      variant: sections.variant,
      name: sections.name,
      content: sections.content,
      configuration: sections.configuration,
    })
    .from(sections)
    .where(and(eq(sections.pageId, match.page.id), eq(sections.status, "active")))
    .orderBy(asc(sections.sortOrder), asc(sections.id));

  const images = await getSectionImages(match.webPresenceId, orderedSections.filter((section) => section.type === "intro").map((section) => section.id));
  const designSystem = await getDesignSystemByWebPresenceId(match.webPresenceId);
  const actionIds = orderedSections
    .map((section) => sectionActionId(section.content))
    .filter((id) => id !== null);
  const resolvedActions = await getActionsByIds(match.webPresenceId, actionIds);
  const navigation = await getNavigationByName(match.webPresenceId, "Primary Navigation", "microsite", {
    micrositeId: match.microsite.id,
    pageId: match.page.id,
  });

  return {
    microsite: match.microsite,
    page: match.page,
    sections: orderedSections.map((section) => ({
      ...section,
      image: images.get(section.id) ?? null,
      action: resolvedActions.get(sectionActionId(section.content) ?? "") ?? null,
    })),
    designSystem,
    navigation,
  };
}
