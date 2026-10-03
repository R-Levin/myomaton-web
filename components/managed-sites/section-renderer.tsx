import Image from "next/image";
import type { ManagedSiteSection } from "@/lib/platform/managed-sites/service";
import { normalizeDestination, type Action } from "../../lib/platform/actions/model";
import { normalizeSection } from "../../lib/platform/managed-sites/sections";
import { presentCollection } from "../../lib/platform/managed-sites/collections";
import { PlainTextParagraphs } from "./plain-text-paragraphs";

function SectionAction({ action }: { action?: Action | null }) {
  const href = action && typeof action.label === "string" && action.label.trim()
    ? normalizeDestination(action.type, action.destination) : null;
  return action && href ? <a href={href} className="managed-site-action">{action.label}</a> : null;
}

export function SectionRenderer({ section }: { section: ManagedSiteSection }) {
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
  const split = image && (layout === "split-text-first" || layout === "split-image-first");
  const media = image && <div className="managed-site-section-media">
    <Image className="managed-site-photo" src={image.src} alt={image.alt}
      width={image.width} height={image.height} unoptimized />
  </div>;

  return (
    <section
      id={config.anchor}
      className={`managed-site-section managed-site-section-${type}`}
      data-layout={layout}
      data-width={config.width}
      data-spacing={config.spacing}
      data-alignment={config.alignment}
      data-surface={config.surface}
      data-divider={config.divider}
      data-media-fit={config.mediaFit}
      data-columns={normalized.type === "collection" ? normalized.configuration.columns : undefined}
    >
      <div className="managed-site-section-inner">
        {split && <>
          <div className="managed-site-section-heading">{heading && <Heading>{heading}</Heading>}</div>
          {media}
        </>}
        <div className="managed-site-section-copy">
          {normalized.type === "hero" && normalized.content.eyebrow && <p className="managed-site-eyebrow">{normalized.content.eyebrow}</p>}
          {!split && heading && <Heading>{heading}</Heading>}
          <PlainTextParagraphs text={text} />
          <SectionAction action={action} />
        </div>
        {!split && media}
        {items.length > 0 && <ul className="managed-site-collection" role="list">
          {items.map((item) => <li key={item.id} className="managed-site-collection-item">
            <h3>{item.heading}</h3>
            <PlainTextParagraphs text={item.text} />
            <SectionAction action={item.action} />
          </li>)}
        </ul>}
      </div>
    </section>
  );
}
