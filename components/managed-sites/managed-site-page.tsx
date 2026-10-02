import type { ManagedSitePage } from "@/lib/platform/managed-sites/service";

import { designTokens } from "./design-tokens";
import { SectionRenderer } from "./section-renderer";
import { PrimaryNavigation } from "./primary-navigation";

export function ManagedSitePageView({ page }: { page: ManagedSitePage }) {
  return (
    <div className="managed-site" style={designTokens(page.designSystem.configuration)}>
      <div className="managed-site-navigation-container">
        <PrimaryNavigation navigation={page.navigation} />
      </div>
      <main>
        {page.sections.map((section) => (
          <SectionRenderer key={section.id} section={section} />
        ))}
      </main>
    </div>
  );
}
