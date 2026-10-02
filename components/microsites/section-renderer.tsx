import Image from "next/image";
import type { MicrositeSection } from "@/lib/platform/microsites/service";
import { normalizeDestination, type Action } from "../../lib/platform/actions/model";
import { normalizeSection } from "../../lib/platform/microsites/sections";
import { presentCollection } from "../../lib/platform/microsites/collections";
import { PlainTextParagraphs } from "./plain-text-paragraphs";

function SectionAction({ action }: { action?: Action | null }) {
  const href = action && typeof action.label === "string" && action.label.trim()
    ? normalizeDestination(action.type, action.destination) : null;
  return action && href ? <a href={href} className="microsite-action">{action.label}</a> : null;
}

export function SectionRenderer({ section }: { section: MicrositeSection }) {
  const normalized = normalizeSection(section);
  if (!normalized) return null;
  const { type, variant, content, configuration: config } = normalized;
  const { heading, text } = content;
  const actionId = normalized.type !== "collection" ? normalized.content.actionId : undefined;
  const action = actionId && section.action?.id === actionId ? section.action : null;
  const items = normalized.type === "collection"
    ? section.collectionItems ?? presentCollection(normalized.content) : [];
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
      data-columns={normalized.type === "collection" ? normalized.configuration.columns : undefined}
    >
      <div className="microsite-section-inner">
        <div className="microsite-section-copy">
          {normalized.type === "hero" && normalized.content.eyebrow && <p className="microsite-eyebrow">{normalized.content.eyebrow}</p>}
          {heading && <Heading>{heading}</Heading>}
          <PlainTextParagraphs text={text} />
          <SectionAction action={action} />
        </div>
        {image && <div className="microsite-section-media">
          <Image className="microsite-photo" src={image.src} alt={image.alt}
            width={image.width} height={image.height} unoptimized />
        </div>}
        {items.length > 0 && <ul className="microsite-collection" role="list">
          {items.map((item) => <li key={item.id} className="microsite-collection-item">
            <h3>{item.heading}</h3>
            <PlainTextParagraphs text={item.text} />
            <SectionAction action={item.action} />
          </li>)}
        </ul>}
      </div>
    </section>
  );
}
