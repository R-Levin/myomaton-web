import { decide, takeIn, type Person } from "../change/model";
import { fingerprint } from "../canonical/model";
import { migratePage } from "../site/migrate";
import { logicalId, pageIdentity } from "../work-products/pages";
import { pictureFrameId, type Asset } from "./assets";
import { CycleError, current, currentSite, respond, type ServiceRecord } from "./cycle";

/**
 * An existing site moves to the component format (docs/rendering-design.md): each current page in
 * the earlier format becomes its next version with the same words as content items, laid out with
 * the nearest components (site/migrate.ts). No AI. It's the Specialist's own Change, approved as it's
 * made, like a hand edit; every earlier version stays and can be restored. Pictures already chosen
 * move to their new frames.
 */
export function migrateSite(record: ServiceRecord, input: { id: string; at: string; by: Person }): ServiceRecord {
  if (input.by.role !== "operator" && input.by.role !== "owner") throw new CycleError("not-permitted", "Only a Specialist moves a site to the component format");
  const site = currentSite(record);
  if (!site) throw new CycleError("not-found", "The site has no approved pages yet");
  let next = record;
  const assets: Asset[] = [];
  for (const entry of site.plan.pages) {
    const id = pageIdentity(record.account.managedSiteId, entry.path), base = current(next, id);
    const old = base?.content as { sections?: unknown[]; layout?: unknown } | undefined;
    if (!base || !old?.sections || Array.isArray(old.layout)) continue;
    const { page, pictures, problems } = migratePage(base.content as never, entry.label,
      ((base.content as { sections: { sourceIds?: string[] }[] }).sections.flatMap(section => section.sourceIds ?? [])));
    if (problems.length) throw new CycleError("invalid", `The page ${entry.path} couldn't be moved: ${problems.join("; ")}`);
    const requestId = `${input.id}:${entry.path}:request`, words = `Move the page ${entry.path} to the component format, with the same words.`;
    if (next.ledger.requests.some(request => request.id === requestId)) continue;
    let ledger = takeIn(next.ledger, { id: `${input.id}:${entry.path}`, at: input.at, by: input.by }, [{ id: requestId, at: input.at,
      origin: { kind: "operator", by: input.by, channel: "core-screen" }, target: { grain: "page", path: entry.path }, words }]);
    const version = Math.max(0, ...next.products.filter(item => item.id === id).map(item => item.version)) + 1, changeId = `${id}:v${version}`;
    ledger = decide(ledger, { id: changeId + ":decision", at: input.at, by: input.by, requestIds: [requestId], outcome: "change", reasoning: words },
      [{ id: changeId, label: `page-v${version}`, at: input.at, requestIds: [requestId],
        target: { grain: "page", path: entry.path, workProduct: { id, version: base.version } }, base: { version: next.version, digest: fingerprint(base.content) },
        difference: { summary: `the page ${entry.path}, version ${version} (the same words, in the component format)` }, preserve: [], consequence: "operator-review" }]);
    const products = next.products.map(item => item.id === id && item.status === "proposed" ? { ...item, status: "superseded" as const } : item);
    next = respond({ ...next, ledger, products: [...products, { id, kind: "page" as const, version, path: entry.path, content: page, changeId, at: input.at, status: "proposed" as const }] },
      changeId, input.by, "approve", input.at);
    // A picture chosen for an earlier frame (a section's picture, or its n-th further picture) moves to the new picture item's frame.
    for (const { frame, contentId } of pictures) {
      const [sectionId, extra] = frame.split("#");
      const earlier = extra ? logicalId({ section: sectionId, picture: Number(extra) }) : sectionId;
      const asset = (record.assets ?? []).find(item => item.path === entry.path && item.sectionId === earlier);
      if (asset) assets.push({ ...asset, sectionId: pictureFrameId(entry.path, contentId) });
    }
  }
  return assets.length ? { ...next, assets: [...(next.assets ?? []), ...assets] } : next;
}
