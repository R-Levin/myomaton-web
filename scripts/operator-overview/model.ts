import { normalizeAction, sectionActionId, type Action } from "../../lib/platform/actions/model";
import { normalizeBinding, projectContent } from "../../lib/platform/canonical/projections";
import type { CustomerState } from "../../lib/platform/customer-initialization";
import { customerGraph, type CustomerTarget } from "../../lib/platform/customer-state";
import { resolveDesignConfiguration } from "../../lib/platform/design-systems/configuration";
import { presentCollection } from "../../lib/platform/managed-sites/collections";
import { normalizeSection } from "../../lib/platform/managed-sites/sections";
import type { ManagedSitePage, ManagedSiteSection } from "../../lib/platform/managed-sites/service";
import { record } from "../../lib/platform/presentation/content";
import { resolveVisualDirection } from "../../lib/platform/visual-direction/model";

export const accountPath = (presenceId: string) => `/accounts/${presenceId}`;
export const previewPath = (presenceId: string, pageId: string) => `${accountPath(presenceId)}/pages/${pageId}`;

export function snapshotAccount(state: CustomerState, target: CustomerTarget) {
  const graph = customerGraph(state, target);
  const organization = graph.organizations.find(row => row.id === target.organizationId);
  const presence = graph.web_presences.find(row => row.id === target.webPresenceId && row.organization_id === organization?.id);
  const site = graph.managed_sites.find(row => row.id === target.managedSiteId && row.web_presence_id === presence?.id);
  if (!organization || !presence || !site) throw Error("Snapshot account ownership does not match");
  const { id: siteId, name: siteName, configuration: siteConfiguration } = site;
  const pages = graph.pages.filter(row => row.managed_site_id === siteId && row.status === "active")
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  const sectionsFor = (pageId: unknown) => graph.sections.filter(row => row.page_id === pageId && row.status === "active")
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  const visualNeeds = pages.flatMap(page => sectionsFor(page.id).flatMap(section => {
    const need = record(record(section.metadata).visualNeed);
    return need.permission === "unresolved" && typeof need.purpose === "string" ? [{
      pageId: String(page.id), pageName: String(page.name), purpose: need.purpose,
      role: String(need.role), importance: String(need.importance),
    }] : [];
  }));
  // Existing project evidence has a rights decision to make. Other visual
  // observations stay grouped in account detail instead of becoming alerts.
  const nextReview = visualNeeds.find(need => need.role === "evidence-project" && need.importance === "important");
  const activeAssets = graph.assets.filter(row => row.status === "active");
  const promotion = record(record(site.metadata).promotion);

  function preview(pageId: string): ManagedSitePage | null {
    const page = pages.find(row => row.id === pageId);
    if (!page) return null;
    const localDestinations = new Map(pages.map(row => [String(row.id), previewPath(target.webPresenceId, String(row.id))]));
    const actions = new Map<string, Action>();
    for (const row of graph.actions) {
      const action = normalizeAction({ ...row, webPresenceId: row.web_presence_id }, target.webPresenceId, localDestinations);
      if (action?.type === "page") actions.set(action.id, action);
    }
    const design = graph.design_systems.find(row => row.status === "active");
    const sections: ManagedSiteSection[] = sectionsFor(page.id).map(section => {
      const raw = record(section.content);
      let content: unknown = raw;
      if (Object.hasOwn(raw, "source")) {
        const binding = normalizeBinding(raw.source);
        const sources = binding.role === "knowledge" ? graph.business_knowledge : graph.offerings;
        const source = sources.find(row => row.id === (binding.role === "knowledge" ? binding.knowledgeId : binding.offeringId));
        if (!source) throw Error("Snapshot section source is unavailable");
        content = projectContent(String(section.type), raw, binding, {
          id: String(source.id), web_presence_id: String(source.web_presence_id), payload: source.payload,
          name: String(source.name), status: String(source.status), contract_version: Number(source.contract_version),
        });
        if (!content) throw Error("Snapshot section source cannot project");
      }
      const normalized = normalizeSection({ ...section, content });
      if (!normalized) throw Error("Snapshot section cannot render");
      return { id: String(section.id), name: String(section.name), ...normalized, rawConfiguration: section.configuration,
        action: actions.get(sectionActionId(normalized.content) ?? ""),
        ...(normalized.type === "hero" ? { secondaryAction: actions.get(normalized.content.secondaryActionId ?? "") } : {}),
        ...(normalized.type === "relationship" ? { relationshipActions: Object.fromEntries(actions) } : {}),
        ...(normalized.type === "collection" ? { collectionItems: presentCollection(normalized.content, new Map(), actions) } : {}),
      };
    });
    const visual = resolveVisualDirection(siteConfiguration);
    if (visual.presentation?.grammar !== "service-led" || visual.presentation.version !== 3) throw Error("Expected reviewed service-led v3 snapshot");
    return {
      managedSite: { id: String(siteId), name: String(siteName) },
      page: { id: pageId, name: String(page.name), title: String(page.title), slug: String(page.slug), configuration: page.configuration },
      designSystem: { id: String(design?.id), name: String(design?.name), rawConfiguration: design?.configuration,
        configuration: resolveDesignConfiguration(design?.configuration) },
      sections, visual,
    };
  }

  return { id: target.webPresenceId, organization: String(organization.name), name: String(presence.name),
    domain: String(presence.primary_domain), site: String(site.name), presenceStatus: String(presence.status),
    pages, visualNeeds, nextReview, activeAssets, publicationAuthorized: promotion.publicationAuthorized === true, preview };
}

export type SnapshotAccount = ReturnType<typeof snapshotAccount>;
