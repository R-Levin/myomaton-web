import { withoutIdentity } from "../work-products/pages";
import { fingerprint } from "../canonical/model";
import { validatePages } from "../wordpress-delivery/authority";
import { requireEvaluationContext } from "./presence-evaluation";
import type { WorkflowContext, PresenceWorkflowView } from "./presence-workflow";
import type { WorkflowBlueprint, WorkflowDirection, WorkflowPage } from "./presence-workflow-artifacts";

function scopedId(value: unknown) {
  const id = fingerprint(value);
  return id.slice(0, 8) + "-" + id.slice(8, 12) + "-5" + id.slice(13, 16) + "-8" + id.slice(17, 20) + "-" + id.slice(20, 32);
}

export function homeConceptDigest(context: WorkflowContext, view: { blueprint: WorkflowBlueprint | null; direction: WorkflowDirection | null; pages: readonly WorkflowPage[] }) {
  if (!context.evaluation || !view.direction || !view.blueprint) return undefined;
  const home = view.pages.find(page => page.path === "/" && page.composition === "managed-v1");
  return home && fingerprint({ binding: requireEvaluationContext(context), page: withoutIdentity(home), siteDirection: view.direction, blueprint: view.blueprint });
}

// Input for the existing WordPress native block projector in a disposable
// evaluation. It carries no proposal approval, envelope or stage authority.
export function composeHomeConcept(context: WorkflowContext, view: PresenceWorkflowView) {
  if (view.contextDigest !== fingerprint(context) || view.next !== "home-concept" || !view.homeConcept) {
    throw Error("Current evaluation Home required");
  }
  const target = homeConceptDigest(context, view);
  if (target !== view.homeConcept.digest) throw Error("Evaluation Home changed");
  const home = view.pages.find(page => page.path === "/")!;
  const id = scopedId({ scope: context.scope, path: "/" });
  const pages = [{ id, path: "/", title: home.heading, composition: "managed-v1" as const,
    navigationLabel: view.blueprint!.pages.find(page => page.path === "/")!.label,
    sections: home.sections.map((section, index) => ({ id: scopedId({ pageId: id, section: index }),
      type: section.role!, content: { heading: section.heading, text: section.body }, ...(section.block && { block: section.block }) })) }];
  validatePages(pages, true, true);
  const image = view.visuals?.find(visual => visual.placement.candidateDigest === target && visual.placement.sectionIndex === 0 && visual.state === "approved");
  const candidate = { pages, navigation: ["/"], actions: [] };
  return { candidate, pendingActions: home.actions.map(action => action.label),
    ...(image && { image: { id: image.id, sectionId: pages[0].sections[0].id,
      digest: image.result!.masterDigest, alt: image.decision!.alt, width: image.result!.width, height: image.result!.height } }),
    digest: fingerprint({ target, candidate, visual: image ? { result: image.result?.provenanceDigest, decision: image.decision } : null }) };
}
