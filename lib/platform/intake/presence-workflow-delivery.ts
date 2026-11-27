import { placedAt } from "./presence-workflow-visual";
import { logicalId, pageIdentity, sectionIdentity, withoutIdentity } from "../work-products/pages";
import { fingerprint } from "../canonical/model";
import { designProjection } from "../design-systems/site-design";
import { pageProposal, type PageProposal } from "../content-editing/proposal";
import { nativeDraftBaseline } from "../wordpress-delivery/site-draft";
import type { PresenceWorkflowView, WorkflowContext } from "./presence-workflow";
import { roundChanges, type Change } from "../change/model";
import { internalOnly, roundLedger } from "./review-round-changes";


/** Translate the exact reviewed workflow into ordinary protected Page proposals.
 * This prepares inputs only. Each Page still requires a verified preview and
 * independent approval before the site authorization can issue. */
export function workflowDeliveryInput(context: WorkflowContext, view: PresenceWorkflowView,
  prior: unknown, canonical: readonly { id: string; slug: string }[]) {
  if (view.deliveryQuality?.passed === false) throw Error("Independent product-quality review required before delivery");
  return workflowEvaluationPreviewInput(context, view, prior, canonical);
}

/** Permits a private evaluation render before its product-quality verdict. */
export function workflowEvaluationPreviewInput(context: WorkflowContext, view: PresenceWorkflowView,
  prior: unknown, canonical: readonly { id: string; slug: string }[]) {
  const review = view.operatorReview;
  if (view.pages.some(page => page.sections.some(section => section.block))) throw Error("Local semantic blocks require a supported release renderer");
  if (view.contextDigest !== fingerprint(context) || view.next !== "review-complete" || !review || !view.blueprint ||
      view.visuals?.some(visual => ["queued", "running", "review", "unverified"].includes(visual.state))) {
    throw Error("Complete exact workflow and visual review required");
  }
  return projectWorkflowPreview(context, { ...view, blueprint: view.blueprint }, review.target, prior, canonical);
}

/** Disposable render input for editorial inspection. No signed projection or review event is issued. */
export function workflowLocalDraftInput(context: WorkflowContext, view: PresenceWorkflowView) {
  const blueprint = view.blueprint;
  const beforeCritique = view.canRenderForEditorial === true && view.next === "editorial";
  // While an Operator review round is analyzed or awaits its decision, the site stays deliverable.
  const reviewing = ["review-analysis", "review-summary"].includes(view.next);
  if (!context.evaluation || view.contextDigest !== fingerprint(context) || !blueprint || (!view.editorial && !beforeCritique && !reviewing) || view.failure ||
      (!beforeCritique && !reviewing && !["editorial-review", "operator-review", "review-complete"].includes(view.next)) ||
      view.pages.length !== blueprint.pages.length || blueprint.pages.some(entry => !view.pages.some(page => page.path === entry.path)) ||
      view.visuals?.some(visual => ["queued", "running", "unverified"].includes(visual.state))) {
    throw Error("Complete isolated editorial draft required");
  }
  const target = fingerprint({ draft: view.pages.map(withoutIdentity), outline: blueprint, editorial: view.editorial, scope: context.scope });
  return projectWorkflowPreview(context, { ...view, blueprint }, target, null, [], "Unapproved isolated draft " + target, true);
}

/** Core's own visual intent for a section, carried so drafts can place the image
 * or a marked FPO frame instead of silently dropping it (baseline Part 1 #12). */
export function sectionVisual(view: Pick<PresenceWorkflowView, "pages">, path: string, index: number) {
  const visual = view.pages.find(item => item.path === path)?.sections[index]?.visual;
  return visual ? { visual: { purpose: visual.purpose, brief: visual.brief, altIntent: visual.altIntent, status: visual.status } } : {};
}

/** Shared data projection for Core's visual review and native WordPress drafts.
 * This is representation only, with no approval, installation or publication. */
export function workflowNativeReviewCandidate(context: WorkflowContext, view: PresenceWorkflowView) {
  const input = workflowLocalDraftInput(context, view);
  const pages = input.pages.map(page => ({ id: page.pageId, path: page.slug,
    title: page.title.kind === "editorial" ? page.title.text : "", composition: page.composition,
    navigationLabel: page.navigationLabel,
    sections: page.sections.map((section, index) => ({ id: section.id, type: section.type,
      content: { heading: section.heading?.kind === "editorial" ? section.heading.text : "",
        text: section.text?.kind === "editorial" ? section.text.text : "" },
      ...(view.pages.find(item => item.path === page.slug)?.sections[index].block &&
        { block: view.pages.find(item => item.path === page.slug)!.sections[index].block }),
      ...(page.composition && sectionVisual(view, page.slug, index)),
    })),
  }));
  // While a review round awaits the Operator's decision, its Review summary is delivered as a draft page (not in navigation).
  const summary = reviewSummaryPage(context, view);
  return { candidate: { pages: summary ? [...pages, summary.page] : pages, navigation: input.navigation, actions: input.actions }, unresolvedActions: input.unresolvedActions,
    ...(view.direction?.design && { design: designProjection(view.direction.design) }) };
}

function projectWorkflowPreview(context: WorkflowContext, view: PresenceWorkflowView & { blueprint: NonNullable<PresenceWorkflowView["blueprint"]> }, target: string,
  prior: unknown, canonical: readonly { id: string; slug: string }[], rationale = "Protected evidence-linked website review " + target, authoredActions = false) {
  const baseline = prior === null ? [] : nativeDraftBaseline(prior);
  const editorial = (copy: string) => ({ kind: "editorial" as const, text: copy,
    rationale });
  const pages = view.pages.map(page => {
    const owned = canonical.find(row => row.slug === page.path);
    const existing = baseline.find(row => row.path === page.path);
    if (owned && existing && owned.id !== existing.id) throw Error("Canonical Page and prior WordPress identity differ");
    // The Page Work product's own identity, unless WordPress or the canonical site already hold it under another.
    const pageId = existing?.id ?? owned?.id ?? page.id ?? pageIdentity(context.scope.managedSiteId, page.path);
    return pageProposal({ operation: owned ? "replace-page" : "create-page", pageId, slug: page.path,
      title: editorial(page.heading), purpose: view.blueprint!.pages.find(entry => entry.path === page.path)!.purpose,
      workflowReview: { intakeId: context.intakeId, candidateDigest: target },
      ...(page.composition && { composition: page.composition, navigationLabel: view.blueprint!.pages.find(entry => entry.path === page.path)!.label }),
      sections: page.sections.map((section, index) => {
        const approved = view.visuals?.find(item => item.placement.path === page.path &&
          placedAt(item.placement, page.sections) === index && item.state === "approved");
        if (approved && (!approved.association || !approved.decision?.alt)) throw Error("Approved placement evidence incomplete");
        return { id: section.id && pageId === page.id ? section.id : sectionIdentity(pageId, index), type: section.role ?? "intro", heading: editorial(section.heading), text: editorial(section.body),
          ...(approved && { image: { ...approved.association!, altText: approved.decision!.alt! } }) };
      }),
    } satisfies PageProposal);
  });
  // Home must be reachable from the menu. When Core's plan leaves it out (the logo often
  // links home), place it first rather than refusing the whole site.
  const navigation = view.blueprint.navigation.includes("/") ? view.blueprint.navigation
    : view.blueprint.pages.some(entry => entry.path === "/") ? ["/", ...view.blueprint.navigation] : view.blueprint.navigation;
  if (!navigation.includes("/")) throw Error("Private navigation requires Home");
  const actions = view.pages.flatMap(page => {
    const nativePage = pages.find(item => item.slug === page.path)!;
    if(authoredActions){
      const original=page.actions.map((action,index)=>({...action,sourceIndex:index})).filter(action=>action.destination&&action.destination!==page.path&&view.blueprint!.pages.some(target=>target.path===action.destination)&&(action.kind==="navigate"||page.composition&&action.kind!=="existing-account"));
      const chosen=original.map(action=>({id:logicalId({site:context.scope.managedSiteId,from:page.path,index:action.sourceIndex}),type:"page" as const,from:page.path,destination:action.destination!,label:action.label,componentReference:"action-"+action.sourceIndex,...(action.sectionIndex!==undefined&&{sectionId:nativePage.sections[action.sectionIndex].id})}));
      for(const destination of page.internalLinks){
        const target=view.blueprint!.pages.find(entry=>entry.path===destination);
        if(target&&!chosen.some(action=>action.destination===destination))chosen.push({id:logicalId({site:context.scope.managedSiteId,from:page.path,related:destination}),type:"page",from:page.path,destination,label:target.label,componentReference:"related-"+logicalId({site:context.scope.managedSiteId,from:page.path,destination})});
      }
      return chosen;
    }
    const navigation = new Map<string, { label: string; sectionId?: string }>();
    for (const action of page.actions) if (action.destination && action.destination !== page.path &&
      view.blueprint!.pages.some(target => target.path === action.destination) &&
      (action.kind === "navigate" || (page.composition && action.kind !== "existing-account"))) {
      navigation.set(action.destination, { label: action.label,
        ...(page.composition && action.sectionIndex !== undefined && { sectionId: nativePage.sections[action.sectionIndex].id }) });
    }
    for (const link of page.internalLinks) {
      const target = view.blueprint!.pages.find(entry => entry.path === link);
      if (target && !navigation.has(link)) navigation.set(link, { label: target.label });
    }
    return [...navigation].map(([destination, location]) => ({ id: logicalId({ site: context.scope.managedSiteId, from: page.path, destination }),
      type: "page" as const, from: page.path, destination, ...location }));
  });
  return { scope: context.scope, candidateDigest: target, pages, navigation,
    actions, ...(authoredActions&&{unresolvedActions:view.pages.flatMap(page=>page.actions.flatMap((action,index)=>!action.destination?[{from:page.path,reference:"action-"+index,label:action.label}]:[]))}), ...(view.brandDigest && { brandDigest: view.brandDigest }), ...(baseline.length && { baselinePages: baseline }) };
}

export const reviewSummaryPath = "/review-summary";
type SummaryItem = { kind: "approve" } | { kind: "edit" } | { kind: "fact"; id: string } | { kind: "revision"; index: number } | { kind: "page"; id: string } | { kind: "info" };

const dollars = (micros: number) => "$" + (Math.max(micros, 10_000) / 1_000_000).toFixed(2);
const where = (path: string, indexes: readonly number[]) => indexes.length
  ? `${path}, section${indexes.length > 1 ? "s" : ""} ${indexes.map(index => index + 1).join(", ")}` : `${path} (whole page)`;

/**
 * The Review summary Core delivers as a draft page while a review round awaits the Specialist's
 * decision (Principal decision, Nov 23). It is a view of the round's Proposed changes in the
 * Change area: each item is one Change, or a Request no Change answers, in its own section so a
 * Note can answer it.
 */
export function reviewSummaryPage(context: WorkflowContext, view: PresenceWorkflowView) {
  const round = view.reviewRounds?.at(-1);
  if (round?.status !== "summary" || !round.analysis) return null;
  const ledger = roundLedger(view.changes, round, view.version, view.pages);
  const decision = ledger.decisions.find(item => item.id === `${round.id}:analysis`);
  if (!decision) return null;
  const changes = roundChanges(ledger, round.id);
  const requestsOf = (change: Change) => ledger.requests.filter(request => change.requestIds.includes(request.id));
  const labelOf = (id: string) => ledger.changes.find(change => change.id === id)?.label ?? id;
  const facts = changes.filter(change => change.target.grain === "fact");
  const pages = changes.filter(change => change.target.grain === "new-page");
  const revisions = changes.filter(change => change.label.startsWith("C"));
  const items: { item: SummaryItem; heading: string; text: string }[] = [];
  items.push({ item: { kind: "approve" }, heading: "Review summary",
    text: [decision.reasoning,
      `Your edits are already kept. Below are the business facts Core proposes to record${pages.length ? ", the pages it proposes to add" : ""} and the changes it proposes to make. Nothing is recorded, added or changed until you approve. Estimated AI cost of the changes: about ${dollars(decision.estimateMicros ?? 0)}.`,
      "To approve, add a note on this paragraph saying Approve. To leave out an item, add a note on it saying No. To correct a fact, add a note on it with the corrected wording. To add to a change or a new page, add a note on it saying what else it should do."].join("\n\n") });
  for (const fact of facts) items.push({ item: { kind: "fact", id: fact.label },
    heading: `Fact ${fact.label}: from your ${requestsOf(fact).some(request => request.origin.channel === "wordpress-note") ? "note" : "edit"} on ${fact.target.path}`,
    text: fact.difference.after + (internalOnly(fact) ? "\n\n(For Core's understanding only; not for the website.)" : "") });
  for (const page of pages) items.push({ item: { kind: "page", id: page.label },
    heading: `New page ${page.label}: ${page.target.name ?? page.target.path} (${page.target.path})`,
    text: [page.difference.after, page.difference.summary + ".", "You asked: " + requestsOf(page).map(request => request.words).join(" / ")].join("\n\n") });
  // A "New page:" Note that no Change answers is said so, not dropped.
  const answered = new Set(changes.flatMap(change => change.requestIds));
  for (const request of ledger.requests.filter(item => item.roundId === round.id && item.target.grain === "new-page" && !answered.has(item.id))) {
    items.push({ item: { kind: "info" }, heading: "No page proposed for your request", text: "You asked: " + request.words + "\n\n" +
      (round.analysisNotes?.refusedPageNotes?.includes(Number(request.channelRef))
        ? "Core drafted a page plan for this, but it did not pass Core's checks (for example, it was at an address the site already uses, or its brief did not trace to the business knowledge), so it is left out. To try again, add a new note starting New page: after this review."
        : "Core did not propose a page for this; the summary above says why.") });
  }
  for (const revision of revisions) items.push({ item: { kind: "revision", index: Number(revision.label.slice(1)) - 1 },
    heading: `Change ${revision.label}: ${where(revision.target.path!, revision.target.sections ?? [])}`,
    text: revision.dependsOn?.length ? `Because of ${revision.dependsOn.map(labelOf).join(", ")}: ${revision.difference.summary}`
      : "Revise in response to your note: " + requestsOf(revision).map(request => request.words).join(" / ") });
  if (!facts.length && !revisions.length && !pages.length) items.push({ item: { kind: "edit" }, heading: "Nothing else to change",
    text: "Core found no business facts to record and no other changes to make." });
  for (const edit of changes.filter(change => change.label.startsWith("E"))) items.push({ item: { kind: "edit" },
    heading: `Kept: your edit on ${edit.target.path}`, text: `Before: ${edit.difference.before}\n\nNow: ${edit.difference.after}` });
  const pageId = logicalId({ site: context.scope.managedSiteId, path: reviewSummaryPath });
  const sections = items.map((entry, index) => ({ id: logicalId({ round: round.id, item: index }), type: "intro",
    content: { heading: entry.heading.slice(0, 300), text: entry.text } }));
  return { page: { id: pageId, path: reviewSummaryPath, title: "Review summary", sections },
    items: new Map(sections.map((section, index) => [section.id, items[index].item])) };
}
