import { fingerprint } from "../canonical/model";
import { marketingSources, type MarketingAuthority } from "./presence-marketing-authority";
import type { WorkflowContext, PresenceWorkflowView } from "./presence-workflow";
import type { WordPressReviewObservation } from "./wordpress-review-observation";

export type ArtifactHistoryRow = { version: number; context: string; report: string | null; direction: string | null; blueprint: string | null };
export type RetainedCritique = { version: number; contextDigest: string; editorial: NonNullable<PresenceWorkflowView["editorial"]>; pages: PresenceWorkflowView["pages"] };

/** Derive freshness from saved events, rather than treating an updated global
 * context hash as proof that all earlier intellectual work was regenerated. */
export function artifactLineage(history: readonly ArtifactHistoryRow[]) {
  const rows = [...history].sort((a, b) => a.version - b.version);
  if (!rows.length || rows.some((row, i) => !Number.isSafeInteger(row.version) || row.version < 1 || i > 0 && row.version <= rows[i - 1].version)) throw Error("Exact ordered artifact history required");
  let evidenceVersion = rows[0].version;
  for (let i = 1; i < rows.length; i++) if (rows[i].context !== rows[i - 1].context) evidenceVersion = rows[i].version;
  const result = Object.fromEntries((["report", "direction", "blueprint"] as const).map(name => {
    let generatedVersion: number | null = null;
    for (let i = 0; i < rows.length; i++) if (rows[i][name] && (i === 0 || rows[i][name] !== rows[i - 1][name])) generatedVersion = rows[i].version;
    return [name, { generatedVersion, predatesEvidence: generatedVersion !== null && generatedVersion < evidenceVersion }];
  })) as Record<"report" | "direction" | "blueprint", { generatedVersion: number | null; predatesEvidence: boolean }>;
  return { evidenceVersion, ...result };
}

export function projectRetainedSite(context: WorkflowContext, current: PresenceWorkflowView, previous: PresenceWorkflowView,
  authority: MarketingAuthority, history: readonly ArtifactHistoryRow[], critique?: RetainedCritique) {
  if (current.contextDigest !== fingerprint(context) || authority.contextDigest !== current.contextDigest ||
      previous.contextDigest !== current.contextDigest || current.version <= previous.version) throw Error("Retained site comparison binding refused");
  const sources = marketingSources(authority, context.evidence);
  const lineage = artifactLineage(history);
  if (critique && (critique.contextDigest !== current.contextDigest || !Number.isSafeInteger(critique.version) ||
      critique.version < 1 || critique.version > current.version)) throw Error("Retained critique binding refused");
  const lastCritique = critique ? { version: critique.version, editorial: critique.editorial,
    changedPaths: critique.pages.filter(page => fingerprint(page) !== fingerprint(current.pages.find(item => item.path === page.path) ?? null)).map(page => page.path) }
    : current.editorial ? { version: current.version, editorial: current.editorial, changedPaths: [] as string[] } : null;
  const changes = current.pages.flatMap(page => {
    const before = previous.pages.find(item => item.path === page.path);
    if (before && fingerprint(before) === fingerprint(page)) return [];
    return [{ path: page.path, label: current.blueprint?.pages.find(item => item.path === page.path)?.label ?? page.heading,
      before: before ?? null, after: page }];
  });
  return {
    kind: "retained-site-review/1" as const, scope: context.scope, intakeId: context.intakeId,
    revision: current.version, baselineRevision: previous.version, candidateDigest: fingerprint(current.pages),
    origin: "retained-core-ai" as const, readonly: true as const, lineage,
    referenceImages: [] as { id: string; label: string }[],
    wordpress: null as WordPressReviewObservation | null,
    understanding: sources.filter(item => item.use === "business-fact" || item.use === "staffed-offer")
      .map(({ source, use }) => ({ ...source, use })),
    references: sources.map(({ source, use }) => ({ ...source, use })),
    report: current.report, direction: current.direction, blueprint: current.blueprint, pages: current.pages,
    editorial: current.editorial, editorialFindings: current.editorialFindings ?? [],
    lastCritique,
    previousPages: previous.pages, changes,
    needsUnderstandingRefresh: lineage.report.predatesEvidence || lineage.direction.predatesEvidence,
    unresolved: current.pages.flatMap(page => [
      ...page.actions.filter(action => !action.destination).map(action => ({ page: page.path, label: action.label, reason: "Destination is not verified; action stays inactive." })),
      ...(page.unresolvedLinks ?? []).map(path => ({ page: page.path, label: path, reason: "Suggested route is not part of the verified site." })),
    ]),
  };
}
export type RetainedSiteReview = ReturnType<typeof projectRetainedSite>;
