import Image from "next/image";
import type { CSSProperties } from "react";
import type { ManagedSiteSection } from "@/lib/platform/managed-sites/service";
import { normalizeDestination, sectionActionId, type Action } from "../../lib/platform/actions/model";
import { normalizeSection } from "../../lib/platform/managed-sites/sections";
import { presentCollection } from "../../lib/platform/managed-sites/collections";
import { PlainTextParagraphs } from "./plain-text-paragraphs";
import { ContactContent } from "./contact-content";
import { sectionComposition, sectionPresentation, sectionRole, type VisualDirection } from "../../lib/platform/visual-direction/model";
import { heroSequence } from "../../lib/platform/visual-direction/motion";

function SectionAction({ action, role, heroPart }: { action?: Action | null; role?: "primary" | "supporting"; heroPart?: "action" }) {
  const href = action && typeof action.label === "string" && action.label.trim()
    ? normalizeDestination(action.type, action.destination) : null;
  return action && href ? <a href={href} className="managed-site-action" data-action-role={role} data-hero-part={heroPart}>{action.label}</a> : null;
}

export function SectionRenderer({ section, direction, index = 0, motionSlot }: { section: ManagedSiteSection; direction?: VisualDirection | null; index?: number; motionSlot?: number; decoration?: "panel" }) {
  const normalized = normalizeSection(section);
  if (!normalized) return null;
  const { type, variant, content } = normalized;
  const image = type === "intro" ? section.image : null;
  const role = sectionRole(normalized, Boolean(image), direction);
  const raw = direction?.grammar && Object.hasOwn(section, "rawConfiguration")
    ? section.rawConfiguration : section.rawConfiguration ?? section.configuration;
  const config = sectionPresentation(normalized.configuration, raw, type, index, direction, role);
  const composition = sectionComposition(config, role, direction);
  const { heading, text } = content;
  const actionId = normalized.type !== "collection" ? sectionActionId(normalized.content) : undefined;
  const action = actionId && section.action?.id === actionId ? section.action : null;
  const items = normalized.type === "collection"
    ? section.collectionItems ?? presentCollection(normalized.content) : [];
  const Heading = type === "hero" ? "h1" : "h2";
  const v2 = direction?.profileVersion === 2;
  const composed = v2 || Boolean(direction?.grammar);
  const staged = composed && type === "hero";
  const hasHeading = Boolean(heading?.trim());
  const hasSupport = Boolean(text?.trim());
  const hasAction = Boolean(action?.label?.trim() && normalizeDestination(action.type, action.destination));
  const sequence = heroSequence(hasHeading, hasSupport, hasAction);
  const motionStyle = staged && motionSlot !== undefined ? {
    "--hero-sequence-delay": `${motionSlot * 1400}ms`,
    "--hero-support-delay": `${sequence.supportStart}ms`, "--hero-action-delay": `${sequence.actionStart}ms`,
  } as CSSProperties : undefined;
  const explicitSurface = raw !== null && typeof raw === "object" && Object.hasOwn(raw, "surface");
  const wash = v2 && role === "statement" && direction.decoration && !explicitSurface;
  const layout = image ? variant : type === "intro" ? "stack" : variant;
  const split = image && (layout === "split-text-first" || layout === "split-image-first" || composition === "image-evidence");
  const separateHeading = split || composition === "editorial-row" || composition === "statement-break";
  const media = image && <div className="managed-site-section-media">
    <Image className="managed-site-photo" src={image.src} alt={image.alt}
      width={image.width} height={image.height} unoptimized />
  </div>;

  return (
    <section
      id={config.anchor}
      className={`managed-site-section managed-site-section-${type}`}
      data-composition={composition}
      data-section-role={composed ? role : undefined}
      data-accent-surface={wash ? "secondary-wash" : undefined}
      style={motionStyle}
      data-layout={layout}
      data-hero-treatment={type === "hero" ? direction?.hero : undefined}
      data-image-treatment={image ? direction?.image : undefined}
      data-motion-slot={motionSlot}
      data-motion-entrance={direction?.profileVersion === 2 && type === "hero" && motionSlot !== undefined ? "initial" : undefined}
      data-width={config.width}
      data-spacing={config.spacing}
      data-alignment={config.alignment}
      data-surface={config.surface}
      data-divider={config.divider}
      data-media-fit={config.mediaFit}
      data-columns={normalized.type === "collection" ? normalized.configuration.columns : undefined}
    >
      <div className="managed-site-section-inner">
        {separateHeading && <>
          <div className="managed-site-section-heading">{heading && <Heading>{heading}</Heading>}</div>
          {split && media}
        </>}
        <div className="managed-site-section-copy">
          {staged ? <>
            {normalized.type === "hero" && normalized.content.eyebrow && <p data-hero-part="eyebrow" className="managed-site-eyebrow">{normalized.content.eyebrow}</p>}
            {hasHeading && <div data-hero-part="heading">
              {heading && <h1>{heading}</h1>}
            </div>}
            {hasSupport && <div data-hero-part="support" className="managed-site-hero-narrative"><PlainTextParagraphs text={text} /></div>}
            <SectionAction action={action} role="primary" heroPart="action" />
          </> : <>
            {normalized.type === "hero" && normalized.content.eyebrow && <p className="managed-site-eyebrow">{normalized.content.eyebrow}</p>}
            {!separateHeading && heading && <Heading>{heading}</Heading>}
            <PlainTextParagraphs text={text} />
            <SectionAction action={action} role={composed ? type === "cta" ? "primary" : "supporting" : undefined} />
          </>}
        </div>
        {!split && media}
        {type === "contact" && section.contact && <ContactContent contact={section.contact} />}
        {items.length > 0 && <ul className="managed-site-collection" role="list">
          {items.map((item) => <li key={item.id} className="managed-site-collection-item">
            <h3>{item.heading}</h3>
            <PlainTextParagraphs text={item.text} />
            <SectionAction action={item.action} role={composed ? "supporting" : undefined} />
          </li>)}
        </ul>}
      </div>
    </section>
  );
}
