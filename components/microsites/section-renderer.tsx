import Image from "next/image";
import type { MicrositeSection } from "@/lib/platform/microsites/service";
import { normalizeDestination } from "../../lib/platform/actions/model";
import { normalizeSection } from "../../lib/platform/microsites/sections";

export function SectionRenderer({ section }: { section: MicrositeSection }) {
  const normalized = normalizeSection(section);
  if (!normalized) return null;
  const { type, variant, content, configuration: config } = normalized;
  const { heading, text } = content;
  const action = content.actionId && section.action?.id === content.actionId ? section.action : null;
  const actionHref = action && typeof action.label === "string" && action.label.trim()
    ? normalizeDestination(action.type, action.destination) : null;
  const Heading = type === "hero" ? "h1" : "h2";
  const image = type === "intro" ? section.image : null;
  const layout = image ? variant : type === "intro" ? "stack" : variant;

  return (
    <section
      id={config.anchor}
      className={`microsite-section microsite-section-${type}`}
      data-layout={layout}
      data-width={config.width}
      data-spacing={config.spacing}
      data-alignment={config.alignment}
      data-surface={config.surface}
      data-divider={config.divider}
      data-media-fit={config.mediaFit}
    >
      <div className="microsite-section-inner">
        <div className="microsite-section-copy">
          {normalized.type === "hero" && normalized.content.eyebrow && <p className="microsite-eyebrow">{normalized.content.eyebrow}</p>}
          {heading && <Heading>{heading}</Heading>}
          {text && <p>{text}</p>}
          {action && actionHref && <a href={actionHref} className="microsite-action">{action.label}</a>}
        </div>
        {image && <div className="microsite-section-media">
          <Image className="microsite-photo" src={image.src} alt={image.alt}
            width={image.width} height={image.height} unoptimized />
        </div>}
      </div>
    </section>
  );
}
