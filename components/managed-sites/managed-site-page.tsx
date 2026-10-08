import type { ManagedSitePage } from "@/lib/platform/managed-sites/service";

import { designTokens } from "./design-tokens";
import { SectionRenderer } from "./section-renderer";
import { SiteHeader, SiteFooter } from "./site-chrome";
import { resolveBusinessIdentity, resolveSitePresentation } from "@/lib/platform/site-globals/model";
import { PageMotion } from "./page-motion";
import { allocateDecoration, allocateMotion } from "../../lib/platform/visual-direction/model";
import { visualTokens } from "./visual-tokens";
import { PresentationPage } from "./presentation-page";

export function ManagedSitePageView({ page }: { page: ManagedSitePage }) {
  if (page.visual?.presentation) return <PresentationPage page={page} />;
  const direction = page.visual?.direction;
  const decoration = allocateDecoration(page.sections, direction);
  const motion = allocateMotion(page.sections, direction?.motion ?? "off");
  const globals = page.globals ?? { identity: resolveBusinessIdentity({}, page.managedSite.name, page.managedSite.name),
    presentation: resolveSitePresentation({}), policy: { socialLinksEnabled: true }, logo: null, utilityNavigation: null, contactAction: null };
  return (
    <div className="managed-site" style={{ ...designTokens(page.designSystem.configuration), ...(direction ? visualTokens(page.designSystem.configuration, direction) : {}) }}
      data-visual-direction={direction?.profileId} data-visual-version={direction?.profileVersion} data-typography={direction?.typography}
      data-visual-grammar={direction?.grammar?.id} data-grammar-version={direction?.grammar?.version}
      data-elevation={direction?.elevation} data-backdrop={direction?.backdrop} data-density={direction?.density}>
      <SiteHeader globals={globals} navigation={page.navigation} currentPath={direction ? page.page.slug : undefined} />
      <PageMotion enabled={direction?.profileVersion === 2}>
        {page.sections.map((section, index) => (
          <SectionRenderer key={section.id} section={section} direction={direction} index={index} motionSlot={motion.get(section.id)} decoration={decoration.get(section.id)} />
        ))}
      </PageMotion>
      <SiteFooter globals={globals} currentPath={direction ? page.page.slug : undefined} />
    </div>
  );
}
