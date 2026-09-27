import type { MicrositePage } from "@/lib/platform/microsites/service";

import { designTokens } from "./design-tokens";
import { SectionRenderer } from "./section-renderer";

export function MicrositePageView({ page }: { page: MicrositePage }) {
  return (
    <main className="microsite" style={designTokens(page.designSystem.configuration)}>
      <div className="microsite-content">
        {page.sections.map((section) => (
          <SectionRenderer key={section.id} section={section} />
        ))}
      </div>
    </main>
  );
}
