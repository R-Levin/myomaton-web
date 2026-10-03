import { actionId, normalizeDestination } from "../actions/model";

export function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result && result.length <= max && !/[\u0000-\u001f\u007f-\u009f]/.test(result) ? result : null;
}
export type ContactLink = { label: string; href: string };
export type BusinessIdentity = { name: string; phone: ContactLink | null; email: ContactLink | null; socials: ContactLink[] };
const socialHosts = {
  youtube: ["youtube.com", "www.youtube.com"], linkedin: ["linkedin.com", "www.linkedin.com"],
  facebook: ["facebook.com", "www.facebook.com"], instagram: ["instagram.com", "www.instagram.com"],
  x: ["x.com", "www.x.com"], github: ["github.com", "www.github.com"],
} as const;
const socialLabels = { youtube: "YouTube", linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram", x: "X", github: "GitHub" };

// Web Presence public identity; Organization is the owning entity, not a second
// competing source of public contact facts. No Page/Site fallback for facts.
export function resolveBusinessIdentity(configuration: unknown, presenceName: unknown, siteName: unknown): BusinessIdentity {
  const input = object(object(configuration).business);
  const phone = text(input.phone, 40);
  const digits = phone?.replace(/[ ().-]/g, "");
  const email = text(input.email, 254);
  const socials: ContactLink[] = [];
  for (const [platform, hosts] of Object.entries(socialHosts)) {
    const value = object(input.socials)[platform];
    const safe = normalizeDestination("link", value);
    if (!safe) continue;
    const url = new URL(safe, "https://platform.invalid");
    if (url.protocol !== "https:" || url.port || !(hosts as readonly string[]).includes(url.hostname) || url.pathname === "/") continue;
    socials.push({ label: socialLabels[platform as keyof typeof socialLabels], href: url.href });
  }
  return {
    name: text(input.displayName) ?? text(presenceName) ?? text(siteName) ?? "Site",
    phone: phone && /^[+\d ().-]+$/.test(phone) && /^\+?\d{7,15}$/.test(digits!) ? { label: phone, href: `tel:${digits}` } : null,
    // Deliberately bounded mailbox-only input; no mail headers, query or fragments.
    email: email && /^[A-Za-z0-9!$&'*+/=_-]+(?:\.[A-Za-z0-9!$&'*+/=_-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(email)
      ? { label: email, href: `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}` } : null,
    socials,
  };
}
export function resolveSitePresentation(configuration: unknown) {
  const input = object(object(configuration).globals), header = object(input.header), footer = object(input.footer);
  return {
    header: { showPhone: header.showPhone === true, contactActionId: actionId(header.contactActionId) },
    footer: { showPhone: footer.showPhone === true, showEmail: footer.showEmail === true,
      showSocials: footer.showSocials === true, showUtilityNavigation: footer.showUtilityNavigation === true },
  };
}
