import type { MicrositePage } from "@/lib/platform/microsites/service";

import { designTokens } from "./design-tokens";
import { SectionRenderer } from "./section-renderer";
import { PrimaryNavigation } from "./primary-navigation";

export function MicrositePageView({ page }: { page: MicrositePage }) {
  return (
    <div className="microsite" style={designTokens(page.designSystem.configuration)}>
      <div className="microsite-navigation-container">
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
