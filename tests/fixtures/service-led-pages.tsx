import { renderToStaticMarkup } from "react-dom/server";
import { ManagedSitePageView } from "../../components/managed-sites/managed-site-page";
import type { ManagedSitePage } from "../../lib/platform/managed-sites/service";
import { resolveVisualDirection } from "../../lib/platform/visual-direction/model";
import { normalizeSection } from "../../lib/platform/managed-sites/sections";
import { presentCollection } from "../../lib/platform/managed-sites/collections";
import { phase1MioPagesPreview as mioPagesPreview } from "../../scripts/customer-previews/miopages";
import { manifest } from "../../scripts/customer-initializers/miopages-c0";
import { resolveDesignConfiguration } from "../../lib/platform/design-systems/configuration";

export function servicePage(route = "/"): ManagedSitePage {
  const actions = new Map(manifest.rows.actions.map(row => [String(row.id), { id: String(row.id), name: String(row.name), type: "page" as const, label: mioPagesPreview.actionLabels[String(row.id)], destination: String(manifest.rows.pages.find(page => page.id === row.destination)?.slug ?? "") }]));
  return { managedSite: { id: "fixture", name: "MioPages" }, page: { id: "page", name: route, title: route, slug: route, configuration: mioPagesPreview.pageConfigurations?.[route] },
    visual: resolveVisualDirection(mioPagesPreview.siteConfiguration), designSystem: { id: null, name: null, configuration: resolveDesignConfiguration(mioPagesPreview.designConfiguration), rawConfiguration: mioPagesPreview.designConfiguration },
    sections: mioPagesPreview.pages[route].map((s, i) => {
      const n = normalizeSection(s)!;
      return { ...s, ...n, id: String(i), name: String(i), rawConfiguration: s.configuration,
        action: actions.get(String((s.content as Record<string, unknown>).actionId)), relationshipActions: Object.fromEntries(actions),
        ...(n.type === "collection" ? { collectionItems: presentCollection(n.content, undefined, actions) } : {}) };
    }) };
}
export function serviceFixtures() {
  const fixtures = Object.fromEntries(["/", "/service", "/experience", "/review"].map(route => [route, renderToStaticMarkup(<ManagedSitePageView page={servicePage(route)} />)]));
  // Disposable content stress cases, not themes or proof of aesthetic suitability.
  for (const [route, name, heading, text, points] of [
    ["/law", "Professional practice", "Clear advice for consequential business decisions.", "A professional practice helping business owners understand their position, consider their options and decide what to do next.", ["Understand the issue", "Consider the options", "Agree the next step"]],
    ["/local", "Local service", "Practical help. A familiar face.", "A local service that makes the work easier to understand, explains the agreed scope and keeps customers informed.", ["Explain the work", "Agree the scope", "Stay in touch"]],
    ["/technical", "Technical services", "Explain the system. Define the work.", "Technical services for teams that need clearly documented requirements, a structured approach and an accountable delivery relationship.", ["Document requirements", "Define responsibilities", "Review the evidence"]],
  ] as const) {
    const page = servicePage(); page.managedSite.name = name;
    page.sections = [page.sections[0], page.sections.at(-1)!];
    const hero = page.sections[0];
    if (hero.type === "hero") hero.content = { ...(hero.content as Record<string, unknown>), heading, text, valuePoints: points.map((heading, i) => ({ id: `value-${i}`, heading, text: "Representative approved-text fixture." })) };
    const closing = page.sections[1];
    if (closing.type === "cta") closing.content = { ...(closing.content as Record<string, unknown>), heading: "Discuss the next useful step", text: "An invitation to understand the service and decide whether it fits." };
    fixtures[route] = renderToStaticMarkup(<ManagedSitePageView page={page} />);
  }
  return fixtures;
}
