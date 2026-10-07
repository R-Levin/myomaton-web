import "server-only";
import { projectCanonicalSections } from "../canonical/projections";
import { offeringImages } from "../canonical/media";
import { resolveVisualDirection, type VisualResolution } from "../visual-direction/model";
import { resolveVisualPolicy, servicePolicyFromEnvironment } from "../policy/site-policy";
import { object } from "../site-globals/model";
import { getSiteGlobals, type SiteGlobals } from "../site-globals/service";
import { contactPresentations } from "../contact/presentation";
import type { ContactPresentation } from "../contact/model";

import { and, asc, eq } from "drizzle-orm";
import { getSectionImages } from "@/lib/platform/assets/presentation-service";
import type { SectionImage } from "@/lib/platform/assets/source";

import { db } from "@/lib/platform/db/connection";
import { managedSites } from "@/lib/platform/db/schema/managed-sites";
import { pages } from "@/lib/platform/db/schema/pages";
import { sections } from "@/lib/platform/db/schema/sections";
import { webPresences } from "@/lib/platform/db/schema/web-presences";
import { getActionsByIds } from "@/lib/platform/actions/service";
import { sectionActionId, type Action } from "@/lib/platform/actions/model";
import { normalizeSection } from "./sections";
import { normalizePagePath } from "./paths";
import { presentCollection, type CollectionItem } from "./collections";
import { getPresentedSubjectsByIds } from "@/lib/platform/subjects/presentation-service";
import { getNavigationByName } from "@/lib/platform/navigations/service";
import type { Navigation } from "@/lib/platform/navigations/model";
import {
  getDesignSystemByWebPresenceId,
  type ResolvedDesignSystem,
} from "@/lib/platform/design-systems/service";

export type ManagedSiteSection = {
  id: string;
  type: string;
  variant: string | null;
  name: string | null;
  content: unknown;
  configuration: unknown;
  rawConfiguration?: unknown;
  action?: Action | null;
  image?: SectionImage | null;
  collectionItems?: CollectionItem[];
  contact?: ContactPresentation;
};

export type ManagedSitePage = {
  managedSite: { id: string; name: string };
  page: { id: string; name: string; title: string; slug: string };
  sections: ManagedSiteSection[];
  designSystem: ResolvedDesignSystem;
  navigation?: Navigation | null;
  globals?: SiteGlobals;
  visual?: VisualResolution;
};

export type ManagedSiteSelection = { domain: string; managedSiteName: string } | { webPresenceId: string; managedSiteId: string };

export async function getManagedSitePage(
  selection: ManagedSiteSelection,
  path: string,
): Promise<ManagedSitePage | null> {
  const slug = normalizePagePath(path);
  if (!slug) return null;
  const sites = await db
    .select({
      webPresenceId: webPresences.id,
      managedSite: { id: managedSites.id, name: managedSites.name },
      presenceName: webPresences.name,
      presenceConfiguration: webPresences.configuration,
      siteConfiguration: managedSites.configuration,
    })
    .from(webPresences)
    .innerJoin(managedSites, eq(managedSites.webPresenceId, webPresences.id))
    .where(and(
      ...("webPresenceId" in selection
        ? [eq(webPresences.id, selection.webPresenceId), eq(managedSites.id, selection.managedSiteId)]
        : [eq(webPresences.primaryDomain, selection.domain), eq(managedSites.name, selection.managedSiteName)]),
      eq(webPresences.status, "active"),
      eq(managedSites.status, "active"),
    ))
    .limit(2);

  if (sites.length !== 1) return null;
  const site = sites[0];
  const matches = await db.select({ id: pages.id, name: pages.name, title: pages.title, slug: pages.slug })
    .from(pages)
    .where(and(eq(pages.managedSiteId, site.managedSite.id), eq(pages.slug, slug), eq(pages.status, "active")))
    .limit(2);
  if (matches.length !== 1) return null;
  const match = { ...site, page: matches[0] };

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

  const boundIds=new Set(orderedSections.filter(s=>s.content && typeof s.content==="object" && Object.hasOwn(s.content,"source")).map(s=>s.id));
  const projectedSections = await projectCanonicalSections(db.$client, match.webPresenceId, orderedSections);
  const supportedSections = projectedSections.flatMap((section) => {
    const normalized = normalizeSection(section);
    return normalized ? [{ ...section, ...normalized, rawConfiguration: section.configuration }] : [];
  });
  const images = await getSectionImages(match.webPresenceId, supportedSections.filter((section) => section.type === "intro" && !boundIds.has(section.id)).map((section) => section.id));
  const canonicalImages = orderedSections.some(s => s.content && typeof s.content === "object" && Object.hasOwn(s.content,"source"))
    ? await offeringImages(db.$client,match.webPresenceId,match.managedSite.id) : new Map();
  const designSystem = await getDesignSystemByWebPresenceId(match.webPresenceId);
  const actionIds = supportedSections
    .flatMap((section) => section.type === "collection"
      ? section.content.items.map((item) => item.actionId ?? null)
      : [sectionActionId(section.content)])
    .filter((id) => id !== null);
  const resolvedActions = await getActionsByIds(match.webPresenceId, actionIds, { managedSiteId: match.managedSite.id });
  const subjectIds = supportedSections.flatMap((section) => section.type === "collection" && section.content.itemSource === "subjects"
    ? section.content.items.map((item) => item.subjectId) : []);
  const resolvedSubjects = await getPresentedSubjectsByIds(match.webPresenceId, subjectIds);
  const navigation = await getNavigationByName(match.webPresenceId, "Primary Navigation", "managedSite", {
    managedSiteId: match.managedSite.id,
    pageId: match.page.id,
  });

  const contacts = supportedSections.some(s => s.type === "contact") ? await contactPresentations(db,
    { id: match.webPresenceId, name: match.presenceName, configuration: match.presenceConfiguration }, supportedSections) : new Map<string, ContactPresentation>();
  return {
    visual: resolveVisualDirection(match.siteConfiguration, resolveVisualPolicy(
      servicePolicyFromEnvironment(process.env.WEB_PRESENCE_SERVICE_POLICY),
      object(match.presenceConfiguration).policy, object(match.siteConfiguration).policy)),
    globals: await getSiteGlobals({ webPresenceId: match.webPresenceId, presenceName: match.presenceName,
      presenceConfiguration: match.presenceConfiguration, managedSiteId: match.managedSite.id,
      siteName: match.managedSite.name, siteConfiguration: match.siteConfiguration, pageId: match.page.id }),
    managedSite: match.managedSite,
    page: match.page,
    sections: supportedSections.map((section) => ({
      ...section,
      contact: contacts.get(section.id),
      image: boundIds.has(section.id) ? canonicalImages.get(section.id)?.image ?? null : images.get(section.id) ?? null,
      action: resolvedActions.get(sectionActionId(section.content) ?? "") ?? null,
      ...(section.type === "collection" ? { collectionItems: presentCollection(section.content, resolvedSubjects, resolvedActions) } : {}),
    })),
    designSystem,
    navigation,
  };
}
