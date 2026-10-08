import Image from "next/image";
import type { CSSProperties } from "react";
import Link from "next/link";
import type { ManagedSitePage, ManagedSiteSection } from "../../lib/platform/managed-sites/service";
import type { Action } from "../../lib/platform/actions/model";
import { normalizeDestination } from "../../lib/platform/actions/model";
import { record, relationship } from "../../lib/platform/presentation/content";
import { resolvePlan, boundedLayer, type SectionPlan } from "../../lib/platform/presentation/plan";
import { presentationTokens } from "../../lib/platform/presentation/tokens";
import { sourceSans } from "../../lib/platform/presentation/fonts";
import { resolveFpo } from "../../lib/platform/presentation/fpo";
import { ResponsiveNavigation } from "./responsive-navigation";
import { PrimaryNavigation } from "./primary-navigation";
import { PlainTextParagraphs } from "./plain-text-paragraphs";
import { FocusVisual } from "./focus-visual";

function ActionLink({ action, secondary = false }: { action?: Action | null; secondary?: boolean }) {
  const href = action && normalizeDestination(action.type, action.destination);
  return href && action?.label.trim() ? <a className={secondary ? "focus-secondary" : "p-action"} href={href}>{action.label}</a> : null;
}
function Brand({ page, light = false }: { page: ManagedSitePage; light?: boolean }) {
  const logo = light ? page.globals?.logoLight ?? page.globals?.logo : page.globals?.logo;
  const name = page.globals?.identity.name ?? page.managedSite.name;
  return <Link className="p-brand" href="/" aria-label={`${name} — Home`}>{logo ? <Image src={logo.src} width={logo.width} height={logo.height} alt={name} unoptimized /> : name}</Link>;
}
function FocusRelationship({ section }: { section: ManagedSiteSection }) {
  const r = relationship(section.content);
  if (r.kind === "stages") return <div className="focus-continuity" data-composition="continuing-fields"><p className="focus-continuity-cue">One managed relationship, from Launch onward</p><ol>{r.items.map((item,i) => <li key={item.id} data-stage={i === 0 ? "formation" : "continuation"}><span className="focus-stage-shape" aria-hidden="true" /><h3>{item.heading}</h3><PlainTextParagraphs text={item.text} /><ActionLink action={section.relationshipActions?.[item.actionId ?? ""]} />{r.extensions?.filter(e => e.stageId === item.id).map(e => <aside className="focus-extension" key={e.id}><h4>{e.heading}</h4><p>{e.text}</p></aside>)}</li>)}</ol></div>;
  if (r.kind === "responsibilities") return <div className="focus-contributions" data-composition="shared-contributions">{r.parties.map(p => <div className="focus-party" key={p.id}><h3>{p.label}</h3>{r.rows.map(row => <div key={row.id}><h4>{row.label}</h4><PlainTextParagraphs text={row.cells.find(c => c.partyId === p.id)!.text} /></div>)}</div>)}<p className="focus-approval">Your knowledge and approval stay connected to the agreed web work.</p></div>;
  return <dl className="focus-scope">{r.items.map(item => <div key={item.id} data-category={item.category}><dt>{item.heading}</dt><dd><PlainTextParagraphs text={item.text} /><ActionLink action={section.relationshipActions?.[item.actionId ?? ""]} /></dd></div>)}</dl>;
}
function FocusSection({ section, plan, preview }: { section: ManagedSiteSection; plan: SectionPlan; preview: boolean }) {
  const c = record(section.content), slot = resolveFpo(record(section.configuration).previewMedia, preview);
  const hero = section.type === "hero";
  const layer = slot ? boundedLayer(section.configuration) : undefined;
  return <section className="p-section focus-section" data-type={section.type} data-surface={plan.surface} data-region={plan.region} data-layer={layer} data-visual={slot?.role} data-relationship={section.type === "relationship" ? c.kind as string : undefined} data-conversion={section.type === "cta" ? plan.conversion : undefined}>
    <div className={`p-inner ${hero ? "p-hero" : "focus-region"}`} data-family={hero ? plan.hero : undefined}>
      <div className="focus-copy">{typeof c.eyebrow === "string" && <p className="focus-kicker">{c.eyebrow}</p>}{hero ? <h1>{String(c.heading ?? "")}</h1> : typeof c.heading === "string" && <h2>{c.heading}</h2>}
        <div className={hero ? "p-hero-introduction" : "focus-prose"}><PlainTextParagraphs text={typeof c.text === "string" ? c.text : undefined} /></div>
        {section.type === "collection" && <ul className="focus-peers">{section.collectionItems?.map(item => <li key={item.id}><h3>{item.heading}</h3><PlainTextParagraphs text={item.text} /><ActionLink action={item.action} /></li>)}</ul>}
        <div className="focus-actions"><ActionLink action={section.action} /><ActionLink action={section.secondaryAction} secondary /></div>
      </div>
      {section.type === "relationship" && <FocusRelationship section={section} />}
      {slot && <FocusVisual slot={slot} />}
      {section.image && <Image className="focus-managed-image" src={section.image.src} width={section.image.width} height={section.image.height} alt={section.image.alt} unoptimized />}
    </div>
  </section>;
}
export function FocusPage({ page }: { page: ManagedSitePage }) {
  const plan = resolvePlan(page.visual!.presentation!, page.page.configuration, page.sections, false, page.presentationPreview === true);
  const review = page.globals?.contactAction;
  const reviewHref = review ? normalizeDestination(review.type,review.destination) : null;
  return <div className="p-presence focus-presence" style={{ ...presentationTokens(page.designSystem.rawConfiguration ?? page.designSystem.configuration), "--p-font": sourceSans.body, "--p-heading-font": sourceSans.heading } as CSSProperties} data-contract-version="2" data-grammar="service-led" data-grammar-version="3" data-recipe={plan.recipe}>
    {sourceSans.resources.map(f => <link key={f.id} rel="preload" as="font" type="font/woff2" href={f.path} crossOrigin="anonymous" />)}
    <header className="p-header" data-chrome="graphic-brand"><div className="p-header-inner"><Brand page={page} />{page.navigation && <ResponsiveNavigation><nav aria-label={page.navigation.name}><ul>{page.navigation.items.map(item => <li key={item.id}><a href={item.href} aria-current={item.href === page.page.slug ? "page" : undefined} data-action-target={item.href === reviewHref ? "true" : undefined}>{item.label}</a></li>)}</ul></nav></ResponsiveNavigation>}</div></header>
    <main>{page.sections.map((s,i) => <FocusSection key={s.id} section={s} plan={plan.sections[i]} preview={page.presentationPreview === true} />)}</main>
    <footer className="p-footer" data-chrome="graphic-signoff"><div className="focus-footer-edge" aria-hidden="true" /><div className="p-footer-inner"><div className="focus-footer-brand"><Brand page={page} light /><p>One focused Launch.<br />Continuing care for your web presence.</p></div>{page.navigation && <PrimaryNavigation navigation={{ ...page.navigation, name: "Footer Navigation" }} currentPath={page.page.slug} />}<small>© {new Date().getUTCFullYear()} {page.globals?.identity.name ?? page.managedSite.name}</small></div></footer>
  </div>;
}
