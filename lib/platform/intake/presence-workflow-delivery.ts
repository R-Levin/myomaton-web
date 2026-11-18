import { fingerprint } from "../canonical/model";
import { pageProposal, type PageProposal } from "../content-editing/proposal";
import { nativeDraftBaseline } from "../wordpress-delivery/site-draft";
import type { PresenceWorkflowView, WorkflowContext } from "./presence-workflow";

function logicalId(value: unknown) {
  const id = fingerprint(value);
  return id.slice(0, 8) + "-" + id.slice(8, 12) + "-5" + id.slice(13, 16) + "-8" + id.slice(17, 20) + "-" + id.slice(20, 32);
}

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
  if (!context.evaluation || view.contextDigest !== fingerprint(context) || !blueprint || !view.editorial || view.failure ||
      !["editorial-review", "operator-review", "review-complete"].includes(view.next) ||
      view.pages.length !== blueprint.pages.length || blueprint.pages.some(entry => !view.pages.some(page => page.path === entry.path)) ||
      view.visuals?.some(visual => ["queued", "running", "unverified"].includes(visual.state))) {
    throw Error("Complete isolated editorial draft required");
  }
  const target = fingerprint({ draft: view.pages, outline: blueprint, editorial: view.editorial, scope: context.scope });
  return projectWorkflowPreview(context, { ...view, blueprint }, target, null, [], "Unapproved isolated draft " + target, true);
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
    const pageId = existing?.id ?? owned?.id ?? logicalId({ site: context.scope.managedSiteId, path: page.path });
    return pageProposal({ operation: owned ? "replace-page" : "create-page", pageId, slug: page.path,
      title: editorial(page.heading), purpose: view.blueprint!.pages.find(entry => entry.path === page.path)!.purpose,
      workflowReview: { intakeId: context.intakeId, candidateDigest: target },
      ...(page.composition && { composition: page.composition, navigationLabel: view.blueprint!.pages.find(entry => entry.path === page.path)!.label }),
      sections: page.sections.map((section, index) => {
        const approved = view.visuals?.find(item => item.placement.path === page.path &&
          item.placement.sectionIndex === index && item.state === "approved");
        if (approved && (!approved.association || !approved.decision?.alt)) throw Error("Approved placement evidence incomplete");
        return { id: logicalId({ pageId, section: index }), type: section.role ?? "intro", heading: editorial(section.heading), text: editorial(section.body),
          ...(approved && { image: { ...approved.association!, altText: approved.decision!.alt! } }) };
      }),
    } satisfies PageProposal);
  });
  if (!view.blueprint.navigation.includes("/")) throw Error("Private navigation requires Home");
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
  return { scope: context.scope, candidateDigest: target, pages, navigation: view.blueprint.navigation,
    actions, ...(authoredActions&&{unresolvedActions:view.pages.flatMap(page=>page.actions.flatMap((action,index)=>!action.destination?[{from:page.path,reference:"action-"+index,label:action.label}]:[]))}), ...(view.brandDigest && { brandDigest: view.brandDigest }), ...(baseline.length && { baselinePages: baseline }) };
}
