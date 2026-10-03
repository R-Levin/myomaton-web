import type { ManagedSitePage } from "@/lib/platform/managed-sites/service";

import { designTokens } from "./design-tokens";
import { SectionRenderer } from "./section-renderer";
import { SiteHeader, SiteFooter } from "./site-chrome";
import { resolveBusinessIdentity, resolveSitePresentation } from "@/lib/platform/site-globals/model";

export function ManagedSitePageView({ page }: { page: ManagedSitePage }) {
  const globals = page.globals ?? { identity: resolveBusinessIdentity({}, page.managedSite.name, page.managedSite.name),
    presentation: resolveSitePresentation({}), policy: { socialLinksEnabled: true }, logo: null, utilityNavigation: null, contactAction: null };
  return (
    <div className="managed-site" style={designTokens(page.designSystem.configuration)}>
      <SiteHeader globals={globals} navigation={page.navigation} />
      <main>
        {page.sections.map((section) => (
          <SectionRenderer key={section.id} section={section} />
        ))}
      </main>
      <SiteFooter globals={globals} />
    </div>
  );
}
