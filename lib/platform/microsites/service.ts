import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/platform/db/connection";
import { microsites } from "@/lib/platform/db/schema/microsites";
import { pages } from "@/lib/platform/db/schema/pages";
import { sections } from "@/lib/platform/db/schema/sections";
import { webPresences } from "@/lib/platform/db/schema/web-presences";
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
};

export type MicrositePage = {
  microsite: { id: string; name: string };
  page: { id: string; name: string; title: string; slug: string };
  sections: MicrositeSection[];
  designSystem: ResolvedDesignSystem;
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

  const designSystem = await getDesignSystemByWebPresenceId(match.webPresenceId);

  return {
    microsite: match.microsite,
    page: match.page,
    sections: orderedSections,
    designSystem,
  };
}
