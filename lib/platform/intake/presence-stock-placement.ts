import { workDigest } from "../work-products/pages";
import assert from "node:assert/strict";
import type { WorkflowRun } from "./presence-workflow";

/** Resolve only actual, unambiguous Core choices; the retained pool is not a quota. */
export function privateStockPlacements<E extends { hit: { sourceId: string } },
 P extends { path: string; sections: { id: string; type: string; content: { heading: string; text: string } }[] }>(
 pages: WorkflowRun["input"]["pages"], candidate: { pages: P[] }, entries: E[]) {
  assert.ok(entries.length > 0 && entries.length <= 2 && new Set(entries.map(e => e.hit.sourceId)).size === entries.length,
    "Exact retained stock pool required");
  const placements = entries.flatMap(entry => {
    const targets = pages.flatMap(page => page.sections.flatMap((section, index) =>
      section.visual.status === "rights-review" && section.visual.brief.includes("sourceId " + entry.hit.sourceId)
        ? [{ page, section, index }] : []));
    assert.ok(targets.length <= 1, "Ambiguous Core-proposed stock placement");
    if (!targets.length) return [];
    const target = targets[0];
    assert.ok(["intro", "cta"].includes(target.section.role ?? ""), "Supported stock placement required");
    const page = candidate.pages.find(page => page.path === target.page.path);
    assert.ok(page, "Exact Core Page required");
    const section = page.sections[target.index];
    assert.ok(section);
    assert.equal(section.type, target.section.role);
    assert.equal(section.content.heading, target.section.heading);
    assert.equal(section.content.text, target.section.body);
    return [{ entry, page, section, sourcePage: target.page }];
  });
  assert.equal(new Set(placements.map(p => p.section.id)).size, placements.length, "One exact photo per Section required");
  return placements;
}

/** New reviews bind every selected Page; old Home-only reviews retain their exact scope. */
export function stockReviewMatchesPages(review: { homeDigest?: string; pageDigests?: Record<string, string>;
  records: { pagePath?: string }[] }, pages: WorkflowRun["input"]["pages"]) {
  if (review.pageDigests) return review.records.every(record => {
    const page = pages.find(page => page.path === record.pagePath);
    return page && review.pageDigests![page.path] === workDigest(page);
  }) && Object.keys(review.pageDigests).length === new Set(review.records.map(record => record.pagePath)).size;
  const home = pages.find(page => page.path === "/");
  return Boolean(home && review.homeDigest === workDigest(home) && review.records.every(record => !record.pagePath || record.pagePath === "/"));
}
