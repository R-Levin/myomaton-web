import type { PoolClient } from "pg";
import { fingerprint, uuid } from "../canonical/model";
import { releaseBase } from "../content-editing/release";
import { releaseHistory } from "../content-editing/releases";
import { assertNativeSection } from "../intake/presence-native-component";
import { readSemanticBlock, type SemanticBlock } from "../intake/presence-semantic-block";

export type Site = { organizationId: string; webPresenceId: string; managedSiteId: string };
type Page = { id: string; path: string; title: string; composition?: "managed-v1"; navigationLabel?: string; sections: {
  id: string; type: string; content: { heading: string; text: string }; block?: SemanticBlock; visual?: SectionVisual; moreVisuals?: (SectionVisual & { id: string })[];
}[] };
/** Core's own per-section visual intent. "asset-needed"/"rights-review" without an
 * approved acquired image renders as a clearly marked FPO frame in drafts only. */
export type SectionVisual = { purpose: string; brief: string; altIntent: string; status: "text-only" | "asset-needed" | "rights-review" };
export type ReviewedProjection = Site & {
  version: 1;
  publishable: true;
  releaseId: string;
  releaseDigest: string;
  revision: number;
  approvalId: string;
  previewDigest: string;
  sourceDigest: string;
  projectionDigest: string;
  pages: Page[];
};

// The composition root must supply a reviewed production authority that reads
// current canonical source and independently approved projection evidence in this transaction.
export type ProjectionAuthority = (db: PoolClient, site: Site) => Promise<ReviewedProjection | null>;
export const unavailableAuthority: ProjectionAuthority = async () => null;

const hash = (value: string) => /^[a-f0-9]{64}$/.test(value);
const id = (value: string) => typeof value === "string" && value.trim() === value && /^[a-z0-9][a-z0-9_.:-]{0,127}$/i.test(value);
const exact = (value: object, keys: string) => Object.keys(value).sort().join(",") === keys;
const text = (value: string, limit: number) =>
  typeof value === "string" && Buffer.byteLength(value) <= limit && !/[<>\x00]/.test(value);

export function validatePages(pages: Page[], nativeDraft = false, localSemanticBlocks = false) {
  const paths = new Set<string>(), pageIds = new Set<string>(), sectionIds = new Set<string>();
  if (!Array.isArray(pages) || pages.length < 1 || (!nativeDraft && pages.length > 16)) throw Error("Projection pages refused");
  for (const page of pages) {
    const composed = nativeDraft && page.composition === "managed-v1";
    if (!exact(page, composed ? "composition,id,navigationLabel,path,sections,title" : "id,path,sections,title") || !id(page.id) || !text(page.title, 160) || !page.title.trim()
      || !text(page.path, 160) || !/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*\/?)?$/.test(page.path)
      || paths.has(page.path) || pageIds.has(page.id)
      || !Array.isArray(page.sections) || page.sections.length < 1 || (!nativeDraft && page.sections.length > 32)) {
      throw Error("Projection page refused");
    }
    if (composed && (!text(page.navigationLabel!, 100) || !page.navigationLabel!.trim() || page.sections[0].type !== "hero" || page.sections.slice(1).some(section => section.type === "hero") ||
      page.sections.some(section => !["hero", "intro", "cta"].includes(section.type)))) throw Error("Composed Page sections refused");
    paths.add(page.path);
    pageIds.add(page.id);
    for (const { id: sectionId, type, content, block, visual, moreVisuals, ...extra } of page.sections) {
      const visualRefused = (item: SectionVisual) => !["text-only", "asset-needed", "rights-review"].includes(item.status) ||
        !text(item.purpose, 2000) || !text(item.brief, 4000) || !text(item.altIntent, 1000);
      if (visual !== undefined && (!composed || !exact(visual, "altIntent,brief,purpose,status") || visualRefused(visual))) throw Error("Projection section visual refused");
      // Further pictures in the section, each with its own frame identity (design rules: Core decides how many).
      if (moreVisuals !== undefined && (!composed || !Array.isArray(moreVisuals) || !moreVisuals.length || moreVisuals.some(item =>
        !exact(item, "altIntent,brief,id,purpose,status") || !id(item.id) || sectionIds.has(item.id) || visualRefused(item)))) throw Error("Projection section visual refused");
      for (const item of moreVisuals ?? []) sectionIds.add(item.id);
      if (block !== undefined) {
        if (!composed || !localSemanticBlocks) throw Error("Projection semantic block requires the local draft renderer");
        const component = readSemanticBlock(block);
        if (component.version === 2) assertNativeSection(component, content.heading, type);
      }
      if (Object.keys(extra).length || !id(sectionId) || sectionIds.has(sectionId)
        || !["hero", "intro", "relationship", "collection", "cta"].includes(type)
        || !exact(content, "heading,text") || !text(content.heading, 300) || !content.heading.trim()
        || !text(content.text, nativeDraft ? 700_000 : 10000)) throw Error("Projection section refused");
      sectionIds.add(sectionId);
    }
  }
}

export async function eligibleProjection(db: PoolClient, site: Site, authority: ProjectionAuthority) {
  const projection = await authority(db, site);
  if (!projection || projection.version !== 1 || projection.publishable !== true
    || projection.organizationId !== site.organizationId || projection.webPresenceId !== site.webPresenceId
    || projection.managedSiteId !== site.managedSiteId) throw Error("Core delivery authority unavailable");

  const release = (await releaseHistory(db, site)).at(-1);
  if (!release || release.operation !== "release" || release.id !== uuid(projection.releaseId)
    || release.digest !== projection.releaseDigest || release.revision !== projection.revision
    || release.preview_digest !== projection.previewDigest || release.approval_event !== projection.approvalId
    || !hash(projection.sourceDigest) || release.after_fingerprint !== projection.sourceDigest
    || fingerprint(await releaseBase(db, site)) !== projection.sourceDigest) {
    throw Error("Core release evidence mismatch");
  }
  const approval = await db.query(
    "SELECT 1 FROM site_change_events WHERE proposal_id=$1 AND digest=$2 AND revision=$3 AND operation='approve'",
    [release.proposal_id, release.approval_event, release.revision]);
  if (!approval.rowCount) throw Error("Core approval evidence missing");

  const pages = structuredClone(projection.pages);
  validatePages(pages);
  if (fingerprint(pages) !== projection.projectionDigest) throw Error("Core projection digest mismatch");
  return { releaseId: release.id, approvalId: release.approval_event, sourceDigest: release.after_fingerprint,
    projectionDigest: projection.projectionDigest, pages };
}
