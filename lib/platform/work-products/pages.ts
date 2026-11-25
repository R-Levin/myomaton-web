import { fingerprint } from "../canonical/model";

/**
 * Work products (object model, step 4): every Page and Section the service makes has one stable
 * identity and numbered versions. Core's drafts and revisions are new versions of the same Page
 * and Section, not fresh pages matched up later, and the identity is the one delivery uses for the
 * canonical Page and the WordPress draft. A Section keeps its identity when its wording is revised;
 * a Page keeps its identity for as long as it has its path.
 */
export type WorkIdentity = { id: string; version: number };
type Section = { [key: string]: unknown };
type Page = { path: string; sections: readonly Section[]; [key: string]: unknown };
export type Identified<P extends Page> = Omit<P, "sections"> & WorkIdentity & { sections: (P["sections"][number] & WorkIdentity)[] };

/** A UUID-shaped identity from stable inputs: the same scheme delivery has always used. */
export function logicalId(value: unknown) {
  const id = fingerprint(value);
  return id.slice(0, 8) + "-" + id.slice(8, 12) + "-5" + id.slice(13, 16) + "-8" + id.slice(17, 20) + "-" + id.slice(20, 32);
}
/** A Page's identity on its site. */
export const pageIdentity = (managedSiteId: string, path: string) => logicalId({ site: managedSiteId, path });
/** The identity of a Page's nth Section (its order of creation), matching what WordPress already holds. */
export const sectionIdentity = (pageId: string, ordinal: number) => logicalId({ pageId, section: ordinal });

/** A Page or Section without its identity and version: what its content is. */
export function withoutIdentity<T>(value: T): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const rest: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  delete rest.id; delete rest.version;
  return (Array.isArray(rest.sections) ? { ...rest, sections: rest.sections.map(withoutIdentity) } : rest) as T;
}
/** The digest of a Page's (or Pages') content, the same before and after it carried an identity. */
export const workDigest = (value: unknown) => fingerprint(Array.isArray(value) ? value.map(withoutIdentity) : withoutIdentity(value));
const content = (value: { [key: string]: unknown }): string => workDigest(value);

/** The latest version of every Page and Section ever made, with its content digest, so a Page set aside and drafted again continues its history. */
export type VersionIndex = { pages: Record<string, Latest>; sections: Record<string, Latest>;
  /** The Site plan and its Menu (glossary): one of each per site, versioned like Pages. */
  plan?: WorkIdentity & { digest: string }; menu?: WorkIdentity & { digest: string } };
type Latest = { version: number; digest: string };

/**
 * Give the next set of Pages their identities and versions. A Page or Section keeps its version
 * while its content is the same as its latest version's, and otherwise takes the next one. A
 * Section matches the previous Section in its place, as the drafts in WordPress always have; a new
 * one takes the next identity on its Page.
 */
export function versionPages<P extends Page>(managedSiteId: string, previous: readonly Page[], next: readonly P[],
  index: VersionIndex = { pages: {}, sections: {} }): { pages: Identified<P>[]; index: VersionIndex } {
  const known: VersionIndex = { ...index, pages: { ...index.pages }, sections: { ...index.sections } };
  const note = (into: Record<string, Latest>, item: Partial<WorkIdentity> & { [key: string]: unknown }) => {
    if (item.id && item.version && (into[item.id]?.version ?? 0) < item.version) into[item.id] = { version: item.version, digest: content(item) };
  };
  for (const page of previous as (Page & Partial<WorkIdentity>)[]) {
    note(known.pages, page);
    for (const section of page.sections as (Section & Partial<WorkIdentity>)[]) note(known.sections, section);
  }
  const versionOf = (into: Record<string, Latest>, id: string, digest: string) => {
    const latest = into[id];
    const version = latest && latest.digest === digest ? latest.version : (latest?.version ?? 0) + 1;
    into[id] = { version, digest };
    return version;
  };
  const pages = next.map(page => {
    const before = previous.find(item => item.path === page.path) as (Page & Partial<WorkIdentity>) | undefined;
    const id = before?.id ?? (page as Partial<WorkIdentity>).id ?? pageIdentity(managedSiteId, page.path);
    const priorSections = (before?.sections ?? []) as (Section & Partial<WorkIdentity>)[];
    const used = new Set<string>();
    let ordinal = Math.max(priorSections.length, page.sections.length);
    const sections = page.sections.map((section, position) => {
      const own = section as Section & Partial<WorkIdentity>;
      const match = (own.id && priorSections.find(item => item.id === own.id)) || priorSections[position];
      let sectionId = match ? match.id ?? sectionIdentity(id, position) : own.id ?? sectionIdentity(id, position);
      while (used.has(sectionId)) sectionId = sectionIdentity(id, ordinal++);
      used.add(sectionId);
      // A Section saved before step 4 counts as version 1 of itself.
      if (match && !match.version) known.sections[sectionId] ??= { version: 1, digest: content(match) };
      return { ...section, id: sectionId, version: versionOf(known.sections, sectionId, content(section)) };
    });
    const candidate = { ...page, sections };
    if (before && !before.version) known.pages[id] ??= { version: 1, digest: content(before) };
    return { ...candidate, id, version: versionOf(known.pages, id, content(candidate)) } as unknown as Identified<P>;
  });
  return { pages, index: known };
}

/** The Site plan's and Menu's identities on a site. */
export const sitePlanIdentity = (managedSiteId: string) => logicalId({ site: managedSiteId, plan: "site" });
export const menuIdentity = (managedSiteId: string) => logicalId({ site: managedSiteId, menu: "primary" });

/**
 * Version the Site plan (its Pages and purposes) and its Menu. They keep their identities for the
 * life of the site; each takes its next version when its content changes. The plan itself is left
 * exactly as Core wrote it, so everything already recorded against it still matches.
 */
export function versionPlan(managedSiteId: string, plan: { navigation: readonly string[]; [key: string]: unknown } | null, index: VersionIndex): VersionIndex {
  if (!plan) return index;
  const next = (latest: (WorkIdentity & { digest: string }) | undefined, id: string, digest: string) =>
    latest?.digest === digest ? latest : { id, version: (latest?.version ?? 0) + 1, digest };
  const { navigation, ...rest } = plan as { navigation: readonly string[]; [key: string]: unknown };
  return { ...index, plan: next(index.plan, sitePlanIdentity(managedSiteId), fingerprint(rest)),
    menu: next(index.menu, menuIdentity(managedSiteId), fingerprint(navigation)) };
}
