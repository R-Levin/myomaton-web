import { fingerprint } from "../../lib/platform/canonical/model";
import { readBlueprint, readPage } from "../../lib/platform/intake/presence-workflow-artifacts";
import { workflowDeliveryInput } from "../../lib/platform/intake/presence-workflow-delivery";
import type { PresenceWorkflowView, WorkflowContext } from "../../lib/platform/intake/presence-workflow";
import { bindSiteDraft } from "../../lib/platform/wordpress-delivery/site-draft";

const projects = {
  c0: {
    name: "MioPages", path: "/managed-service", label: "Managed service", offer: "A managed Web Presence that grows with your business",
    support: "Launch establishes a clear, useful site. Ongoing care improves the content and customer journey as your business changes.",
    action: "Explore the managed service", buyerQuestion: "Know what gets handled",
    destination: "See how Launch and Ongoing fit together", primary: "Choose your starting point",
    reassurance: "Start with an optional Free Review of your current site, or tell us about the project you want to launch.",
    evidence: "MioPages combines site establishment with continuing care and evidence-led improvements. The Free Review is optional.",
  },
  c2: {
    name: "Harbor Tree Care", path: "/tree-assessment", label: "Tree assessments", offer: "Understand the next step for the trees around your home",
    support: "Describe the tree, how close it is to buildings, and what changed. An assessment can help distinguish pruning from work that needs a closer look.",
    action: "Prepare for a tree assessment", buyerQuestion: "Share the right details",
    destination: "What happens during an assessment", primary: "Tell us what you noticed",
    reassurance: "Include your street or neighborhood and the part of the property affected. Keep clear of a fallen tree near wires.",
    evidence: "The fictional provider assesses residential trees and offers pruning and maintenance recommendations.",
  },
};

export function composedFixture(key: keyof typeof projects) {
  const project = projects[key];
  const ids = { c0: "1", c2: "2" };
  const uid = (index: number) => `00000000-0000-4000-8000-${ids[key]}${String(index).padStart(11, "0")}`;
  const source = { kind: "owner-confirmed" as const, id: "fixture-owner", label: "Fixture case", reference: "Repository development fixture", date: null, content: project.evidence };
  const scope = { organizationId: uid(1), webPresenceId: uid(2), managedSiteId: uid(3) };
  const context: WorkflowContext = { scope, intakeId: uid(4), evidence: [source], entry: "DIRECT_START", limitations: [], conflicts: [] };
  const sources = { sourceIds: [source.id] };
  const entries = key === "c0" ? [
    { path: "/free-review", label: "Free Review", purpose: "Explain the optional review of an existing Web Presence.", ...sources },
    { path: "/direct-start", label: "Direct Start", purpose: "Explain the next step for a visitor who is ready to discuss a project.", ...sources },
  ] : [];
  const blueprint = readBlueprint({
    pages: [{ path: "/", label: "Home", purpose: "Establish the service and the first visitor choice.", ...sources },
      { path: project.path, label: project.label, purpose: "Answer the visitor question in the next step.", ...sources }, ...entries],
    navigation: ["/", project.path], articles: [],
  }, [source.id]);
  const paths = blueprint.pages.map(page => page.path);
  const section = (role: string, heading: string, body: string) => ({
    role, heading, body, ...sources, visual: { purpose: "Explain the visitor's next step", brief: "Local layout proof", altIntent: "Context for the service", status: "text-only" },
  });
  const known = key === "c0" ? { "request-review": "/free-review", "start-onboarding": "/direct-start" } : {};
  const pages = blueprint.pages.map(({ path, label, purpose }) => {
    const home = path === "/";
    const separateEntry = !home && path !== project.path;
    const title = home ? project.offer : separateEntry ? label : project.destination;
    return readPage({
      composition: "managed-v1", path, heading: title,
      searchTitle: home ? project.name : project.label, searchDescription: project.support,
      sections: home ? [section("hero", project.offer, project.support),
        section("intro", project.buyerQuestion, key === "c0" ? "A clear offer, useful pages and a next step make it easier for visitors to act." : project.reassurance),
        ...(key === "c0" ? [section("cta", project.primary, project.reassurance)] : [])] :
        [section("hero", title, separateEntry ? purpose : project.reassurance), section("intro", project.buyerQuestion, project.support)],
      actions: home ? [{ label: project.action, kind: "navigate", destination: project.path, sectionIndex: 0 },
        ...(key === "c0" ? [{ label: "Free Review", kind: "request-review", destination: "/free-review", sectionIndex: 2 },
          { label: "Direct Start", kind: "start-onboarding", destination: "/direct-start", sectionIndex: 2 }] : []),
        { label: "Unverified destination", kind: "request-contact", destination: null, sectionIndex: null }] :
        [{ label: "Back to Home", kind: "navigate", destination: "/", sectionIndex: 0 }],
      internalLinks: [],
    }, path, paths, [source.id], known, true);
  });
  const target = fingerprint(pages);
  const fakeReviewedView = { contextDigest: fingerprint(context), next: "review-complete", blueprint, pages,
    operatorReview: { target } } as PresenceWorkflowView;
  const input = workflowDeliveryInput(context, fakeReviewedView, null, []);
  const reviewed = input.pages.map((page, index) => {
    const editorial = (copy?: typeof page.title) => copy?.kind === "editorial" ? copy.text : "";
    // Fixture receipt evidence only. Uses the production candidate compiler below.
    const pages = [{ id: page.pageId, path: page.slug, title: editorial(page.title), composition: page.composition,
      navigationLabel: page.navigationLabel, sections: page.sections.map(section => ({
        id: section.id, type: section.type, content: { heading: editorial(section.heading), text: editorial(section.text) },
      })) }];
    return { ...scope, proposalId: uid(12 + index), revision: 1, approvalId: fingerprint(["approval", key, index]),
      previewDigest: fingerprint(["preview", key, index]), sourceDigest: fingerprint(scope), projectionDigest: fingerprint(pages), pages };
  });
  return { brand: project.name, input, reviewed,
    candidate: bindSiteDraft(scope, reviewed, { siteProposalId: uid(5), installationId: uid(6), revision: 1,
      previousDigest: null, navigation: input.navigation, actions: input.actions }).candidate };
}
