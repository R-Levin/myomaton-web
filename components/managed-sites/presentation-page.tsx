import { resolveFpo } from "../../lib/platform/presentation/fpo";
import { sourceEditorial } from "../../lib/platform/presentation/fonts";
import { fontDiagnostics } from "../../lib/platform/presentation/fonts-server";
import { FpoVisual } from "./fpo-visual";
import { FocusPage } from "./focus-page";
import Image from "next/image";
import Link from "next/link";
import type { ManagedSitePage, ManagedSiteSection } from "../../lib/platform/managed-sites/service";
import type { Action } from "../../lib/platform/actions/model";
import { normalizeDestination } from "../../lib/platform/actions/model";
import { resolvePlan, type SectionPlan, type PresentationPlan } from "../../lib/platform/presentation/plan";
import { presentationTokens } from "../../lib/platform/presentation/tokens";
import { record, relationship, valuePoints } from "../../lib/platform/presentation/content";
import { PrimaryNavigation } from "./primary-navigation";
import { ResponsiveNavigation } from "./responsive-navigation";
import { PlainTextParagraphs } from "./plain-text-paragraphs";
import { ContactContent } from "./contact-content";
import type { Navigation, NavigationItem } from "../../lib/platform/navigations/model";

function PresentationNavigation({ navigation, currentPath, actionHref }: { navigation: Navigation; currentPath: string; actionHref?: string | null }) {
  const items = (rows: NavigationItem[]) => <ul>{rows.map(item => <li key={item.id}>
    <a href={item.href} aria-current={item.href === currentPath ? "page" : undefined} data-action-target={item.href === actionHref ? "true" : undefined}>{item.label}</a>
    {item.children.length > 0 && items(item.children)}</li>)}</ul>;
  return <nav aria-label={navigation.name}>{items(navigation.items)}</nav>;
}

function ActionLink({ action }: { action?: Action | null }) {
  const href = action && normalizeDestination(action.type, action.destination);
  return href && action?.label.trim() ? <a className="p-action" href={href}>{action.label}</a> : null;
}
function Brand({ page, home = false, light = false }: { page: ManagedSitePage; home?: boolean; light?: boolean }) {
  const name = page.globals?.identity.name ?? page.managedSite.name;
  const logo = light ? page.globals?.logoLight ?? page.globals?.logo : page.globals?.logo;
  const content = logo ? <Image className="p-logo" src={logo.src} width={logo.width} height={logo.height} alt={name} unoptimized /> : <span>{name}</span>;
  return home ? <Link className="p-brand" href="/" aria-label={`${name} — Home`}>{content}</Link> : <div className="p-brand">{content}</div>;
}
function Chrome({ page, plan }: { page: ManagedSitePage; plan: PresentationPlan }) {
  const commercial = plan.selection.version === 2;
  const action = commercial ? page.globals?.contactAction : page.sections.find(s => s.action)?.action;
  const actionHref = action ? normalizeDestination(action.type, action.destination) : null;
  const header = <header className="p-header" data-chrome={plan.header} data-navigation={plan.navigation}>
    <div className="p-header-inner"><Brand page={page} home />
      {page.navigation?.items.length ? <ResponsiveNavigation><PresentationNavigation navigation={page.navigation} currentPath={page.page.slug} actionHref={actionHref} /></ResponsiveNavigation> : null}
      {page.globals?.presentation.header.showPhone && page.globals.identity.phone && <a href={page.globals.identity.phone.href}>{page.globals.identity.phone.label}</a>}
      {!commercial && <ActionLink action={page.globals?.contactAction} />}
    </div>
  </header>;
  return commercial ? <>{sourceEditorial.resources.map(font => <link key={font.id} rel="preload" as="font" type="font/woff2" href={font.path} crossOrigin="anonymous" />)}{header}</> : header;
}
function RelationshipContent({ section }: { section: ManagedSiteSection }) {
  const r = relationship(section.content);
  if (r.kind === "responsibilities") return <div className="p-responsibilities">
    {r.rows.map(row => <div className="p-responsibility" key={row.id}><h3>{row.label}</h3><dl>
      {row.cells.map(cell => <div key={cell.partyId}><dt>{r.parties.find(p => p.id === cell.partyId)!.label}</dt><dd><PlainTextParagraphs text={cell.text} /></dd></div>)}
    </dl></div>)}
  </div>;
  if (r.kind === "stages") return <ol className="p-stages">{r.items.map((item, i) => <li key={item.id}><span className="p-stage-number" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span><div><h3>{item.heading}</h3><PlainTextParagraphs text={item.text} /><ActionLink action={section.relationshipActions?.[item.actionId ?? ""]} />{r.extensions?.filter(e => e.stageId === item.id).map(e => <aside className="p-stage-extension" key={e.id}><h4>{e.heading}</h4><p>{e.text}</p></aside>)}</div></li>)}</ol>;
  return <dl className="p-scope">{r.items.map(item => <div key={item.id} data-category={item.category}><dt>{item.heading}</dt><dd><PlainTextParagraphs text={item.text} /><ActionLink action={section.relationshipActions?.[item.actionId ?? ""]} /></dd></div>)}</dl>;
}
function Hero({ section, plan, basic, preview, commercial }: { section: ManagedSiteSection; plan: SectionPlan; basic: boolean; preview: boolean; commercial: boolean }) {
  const c = record(section.content);
  const slot = commercial ? resolveFpo(record(section.configuration).previewMedia, preview) : null;
  const introduction = <div className="p-hero-introduction"><PlainTextParagraphs text={typeof c.text === "string" ? c.text : undefined} /><ActionLink action={section.action} />{commercial && section.secondaryAction && <a className="p-secondary-action" href={normalizeDestination(section.secondaryAction.type, section.secondaryAction.destination) ?? undefined}>{section.secondaryAction.label}</a>}</div>;
  return <div className="p-hero" data-family={plan.hero}>
    <div className="p-hero-title">{typeof c.eyebrow === "string" && <p className="p-label">{c.eyebrow}</p>}<h1>{String(c.heading ?? "")}</h1>{plan.hero !== "editorial-masthead" && introduction}</div>
    {plan.hero === "editorial-masthead" && introduction}
    {basic && Array.isArray(c.valuePoints) && <ul>{valuePoints(c.valuePoints).map(point => <li key={point.id}><strong>{point.heading}</strong>{point.text && <p>{point.text}</p>}</li>)}</ul>}
    {plan.hero === "service-illustrated" && slot && <FpoVisual slot={slot} />}
    {plan.hero === "service-value" && <dl className="p-value-scaffold">{valuePoints(c.valuePoints).map(point => <div key={point.id}><dt>{point.heading}</dt>{point.text && <dd>{point.text}</dd>}</div>)}</dl>}
  </div>;
}
function Section({ section, plan, basic, preview, commercial }: { section: ManagedSiteSection; plan: SectionPlan; basic: boolean; preview: boolean; commercial: boolean }) {
  const c = record(section.content);
  const slot = commercial ? resolveFpo(record(section.configuration).previewMedia, preview) : null;
  return <section id={typeof record(section.configuration).anchor === "string" ? String(record(section.configuration).anchor) : undefined}
    className="p-section" data-type={section.type} data-region={plan.region} data-surface={plan.surface} data-width={plan.width} data-alignment={plan.alignment} data-spacing={plan.spacing} data-divider={plan.divider}
    data-preview-visual={slot ? "true" : undefined} data-relationship={section.type === "relationship" ? String(c.kind) : undefined} data-conversion={section.type === "cta" ? plan.conversion : undefined}>
    <div className="p-inner">{section.type === "hero" ? <Hero section={section} plan={plan} basic={basic} preview={preview} commercial={commercial} /> : commercial && ["intro", "collection", "cta"].includes(section.type) && slot ? <><div className="p-visual-copy">{typeof c.heading === "string" && <h2>{c.heading}</h2>}<PlainTextParagraphs text={typeof c.text === "string" ? c.text : undefined} />{section.type === "collection" && <ul className="p-peers">{section.collectionItems?.map(item => <li key={item.id}><h3>{item.heading}</h3><PlainTextParagraphs text={item.text} /><ActionLink action={item.action} /></li>)}</ul>}<ActionLink action={section.action} />{section.image && <Image className="p-support-image" src={section.image.src} width={section.image.width} height={section.image.height} alt={section.image.alt} unoptimized />}</div><FpoVisual slot={slot} /></> : <>
      <div className="p-section-heading">{typeof c.heading === "string" && <h2>{c.heading}</h2>}{section.type !== "intro" && <PlainTextParagraphs text={typeof c.text === "string" ? c.text : undefined} />}</div>
      {section.type === "relationship" ? <RelationshipContent section={section} /> : section.type === "collection" ? <ul className="p-peers">{section.collectionItems?.map(item => <li key={item.id}><h3>{item.heading}</h3><PlainTextParagraphs text={item.text} /><ActionLink action={item.action} /></li>)}</ul> : <div className="p-prose"><PlainTextParagraphs text={typeof c.text === "string" && section.type === "intro" ? c.text : undefined} /><ActionLink action={section.action} />
        {section.image && <Image className="p-support-image" src={section.image.src} width={section.image.width} height={section.image.height} alt={section.image.alt} unoptimized />}
        {section.contact && <ContactContent contact={section.contact} />}</div>}
      {slot && <FpoVisual slot={slot} />}
    </>}</div>
  </section>;
}
export function PresentationPage({ page }: { page: ManagedSitePage }) {
  if (page.visual?.presentation?.grammar === "service-led" && page.visual.presentation.version === 3) return <FocusPage page={page} />;
  const plan = resolvePlan(page.visual!.presentation!, page.page.configuration, page.sections, false, page.presentationPreview === true);
  const commercial = plan.selection.grammar === "service-led" && plan.selection.version === 2;
  const diagnostics = commercial ? fontDiagnostics() : [];
  if (diagnostics.length) console.error("Presentation font diagnostics:", diagnostics.join("; "));
  const name = page.globals?.identity.name ?? page.managedSite.name;
  return <div className="p-presence" style={{ ...presentationTokens(page.designSystem.rawConfiguration ?? page.designSystem.configuration), ...(commercial ? { "--p-font": sourceEditorial.body, "--p-heading-font": sourceEditorial.heading } : {}) }} data-contract-version="2" data-grammar={plan.selection.grammar} data-grammar-version={plan.selection.version} data-recipe={plan.recipe ?? "none"}>
    <Chrome page={page} plan={plan} />
    <main>{page.sections.map((section, i) => <Section key={section.id} section={section} plan={plan.sections[i]} basic={plan.selection.grammar === "basic"} preview={page.presentationPreview === true} commercial={commercial} />)}</main>
    <footer className="p-footer" data-chrome={plan.footer}><div className="p-footer-inner"><Brand page={page} light={commercial} />
      {(commercial || plan.footer === "service-led") && page.navigation && <PrimaryNavigation navigation={{ ...page.navigation, name: "Footer Navigation" }} currentPath={page.page.slug} />}
      {page.globals?.presentation.footer.showPhone && page.globals.identity.phone && <a href={page.globals.identity.phone.href}>{page.globals.identity.phone.label}</a>}
      {page.globals?.presentation.footer.showEmail && page.globals.identity.email && <a href={page.globals.identity.email.href}>{page.globals.identity.email.label}</a>}
      {page.globals?.presentation.footer.showUtilityNavigation && <PrimaryNavigation navigation={page.globals.utilityNavigation} currentPath={page.page.slug} />}
      {page.globals?.presentation.footer.showSocials && page.globals.policy.socialLinksEnabled && <ul>{page.globals.identity.socials.map(s => <li key={s.label}><a href={s.href}>{s.label}</a></li>)}</ul>}
      <small>© {new Date().getUTCFullYear()} {name}</small></div></footer>
  </div>;
}
