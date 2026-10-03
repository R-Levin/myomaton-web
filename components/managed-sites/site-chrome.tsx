import Image from "next/image";
import Link from "next/link";
import type { SiteGlobals } from "@/lib/platform/site-globals/service";
import type { Navigation } from "@/lib/platform/navigations/model";
import type { ContactLink } from "@/lib/platform/site-globals/model";
import { PrimaryNavigation } from "./primary-navigation";
import { ResponsiveNavigation } from "./responsive-navigation";

function Brand({ globals, linked }: { globals: SiteGlobals; linked: boolean }) {
  const { identity, logo } = globals;
  // The identity names this particular logo use. A linked logo names its Home
  // destination; it never relies on arbitrary descriptive/default image alt.
  const mark = logo ? <Image className="managed-site-logo" src={logo.src} width={logo.width} height={logo.height}
    alt={identity.name} unoptimized /> : <span>{identity.name}</span>;
  return linked ? <Link className="managed-site-brand" href="/" aria-label={`${identity.name} — Home`}>{mark}</Link>
    : <div className="managed-site-brand">{mark}</div>;
}
function Contact({ value }: { value: ContactLink | null }) {
  return value ? <a href={value.href}>{value.label}</a> : null;
}
export function SiteHeader({ globals, navigation }: { globals: SiteGlobals; navigation?: Navigation | null }) {
  return <header className="managed-site-header managed-site-global">
    <div className="managed-site-global-inner">
      <Brand globals={globals} linked />
      {navigation?.items.length ? <ResponsiveNavigation><PrimaryNavigation navigation={navigation} /></ResponsiveNavigation> : null}
      {globals.presentation.header.showPhone && <Contact value={globals.identity.phone} />}
      {globals.contactAction && <a className="managed-site-contact-action" href={globals.contactAction.destination}>{globals.contactAction.label}</a>}
    </div>
  </header>;
}
export function SiteFooter({ globals, year = new Date().getUTCFullYear() }: { globals: SiteGlobals; year?: number }) {
  const { identity, presentation, policy } = globals;
  return <footer className="managed-site-footer managed-site-global">
    <div className="managed-site-global-inner">
      <Brand globals={globals} linked={false} />
      {presentation.footer.showPhone && <Contact value={identity.phone} />}
      {presentation.footer.showEmail && <Contact value={identity.email} />}
      {presentation.footer.showSocials && policy.socialLinksEnabled && identity.socials.length > 0 &&
        <ul className="managed-site-socials" aria-label="Social profiles">{identity.socials.map(social => <li key={social.label}><a href={social.href}>{social.label}</a></li>)}</ul>}
      {presentation.footer.showUtilityNavigation && <PrimaryNavigation navigation={globals.utilityNavigation} />}
      <small>© {year} {identity.name}</small>
    </div>
  </footer>;
}
