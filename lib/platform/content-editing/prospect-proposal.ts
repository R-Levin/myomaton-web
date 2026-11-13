import { choice, fingerprint, object, uuid } from "../canonical/model";
import type { Answers } from "../intake/model";
import { prospectDirection } from "../intake/prospect-direction";
import { hash, pageProposal, type PageProposal } from "./proposal";
import { normalizeDestination } from "../actions/model";
import { readPresencePlan } from "../intake/presence-plan";
import type { interviewDirection } from "../intake/interview-direction";

/** Add reviewed editorial copy around a caller's existing, canonical-backed Page input. */
export function composeProspectPage(
  page: PageProposal,
  sectionIdentity: string | readonly string[],
  answers: Answers,
  context: { version: number; evidenceDigest: string; finding?: NonNullable<ReturnType<typeof interviewDirection>> },
): PageProposal {
  const identities = typeof sectionIdentity === "string" ? [sectionIdentity] : sectionIdentity;
  const direction = prospectDirection(answers);
  const plannedPage = context.finding?.plan?.pages.find(item => item.path === page.slug);
  if (!(direction || plannedPage) || !Number.isSafeInteger(context.version) || context.version < 1 ||
      !/^[a-f0-9]{64}$/u.test(context.evidenceDigest) || identities.some(id => page.sections.some(section => section.id === id))) {
    throw Error("Exact planning evidence and a new Section identity required");
  }
  const action = plannedPage?.action ?? direction?.primary.action;
  const binding = fingerprint({ context, primary: action, pageId: page.pageId, slug: page.slug });
  const rationale = `Proposed prospect path: ${action}. Draft v${context.version}, planning binding ${binding}.` +
    (context.finding ? ` Interview finding ${context.finding.findingId} informs the direction. Review the cited answer and the unresolved evidence before using it.` : "");
  if (plannedPage) {
    const ids = identities.map(uuid);
    if (ids.length !== plannedPage.sections.length || new Set(ids).size !== ids.length ||
        page.sections.length + ids.length > 6) throw Error("Exact supported Section identities required for proposed copy");
    const sections = plannedPage.sections.map((section, index): PageProposal["sections"][number] => ({
      id: ids[index], type: "intro",
      heading: { kind: "editorial", text: section.heading, rationale },
      text: { kind: "editorial", text: section.body, rationale },
    }));
    return { ...page, title: { kind: "editorial", text: plannedPage.title, rationale },
      purpose: plannedPage.purpose, sections: [...page.sections, ...sections] };
  }
  if (identities.length !== 1 || !direction) throw Error("A new Section identity is required");
  const { heading, body } = direction.primary;
  return { ...page, sections: [...page.sections, {
    id: identities[0], type: "intro",
    heading: { kind: "editorial", text: heading, rationale },
    text: { kind: "editorial", text: body, rationale },
  }] };
}

// Read-only preparation. Existing authorization and proposal writers must
// receive the resulting Page inputs under the selected scope.
export function prepareInterviewPages(value: unknown, expectedDigest: unknown, destinations: unknown) {
  const selection = object(value, ["scope", "version", "evidenceDigest", "finding", "improvement"]);
  const scope = object(selection.scope, ["webPresenceId", "managedSiteId"]);
  const finding = object(selection.finding, ["findingId", "sourceIds", "recommendation", "unresolved", "answerReference", "plan"]);
  if (fingerprint(selection) !== hash(expectedDigest) || !Number.isSafeInteger(selection.version) ||
      typeof finding.answerReference !== "string" || !Array.isArray(finding.sourceIds) ||
      !finding.sourceIds.includes(finding.answerReference)) throw Error("Exact interview review packet required");
  uuid(scope.webPresenceId); uuid(scope.managedSiteId);
  const plan = readPresencePlan(finding.plan);
  if (!Array.isArray(destinations) || destinations.length !== plan.pages.length) throw Error("Resolve each Page destination before proposal preparation");
  const allocated = new Set<string>();
  const seen = new Set<string>();
  const pages = destinations.map(input => {
    const mapping = object(input, ["page", "sectionIds", "action"]);
    const page = pageProposal(mapping.page);
    const supported = plan.pages.find(item => item.path === page.slug);
    if (!supported || seen.has(page.slug) || !Array.isArray(mapping.sectionIds)) throw Error("Exact proposed Page destination required");
    seen.add(page.slug);
    const ids = mapping.sectionIds.map(uuid);
    for (const id of [page.pageId, ...page.sections.map(section => section.id), ...ids]) {
      if (allocated.has(id)) throw Error("Duplicate Page or Section identity");
      allocated.add(id);
    }
    const context = { version: selection.version as number, evidenceDigest: hash(selection.evidenceDigest),
      finding: { ...finding, plan } as NonNullable<ReturnType<typeof interviewDirection>> };
    const proposal = pageProposal(composeProspectPage(page, ids, {}, context));
    if (![proposal.title, ...proposal.sections.flatMap(section => [section.heading, section.text])]
      .some(copy => copy?.kind === "canonical")) throw Error("An owned canonical fact is required on every Page");
    const action = object(mapping.action, ["id", "type", "destination"]);
    const type = choice(action.type, ["page", "contact"]);
    const destination = normalizeDestination(type, action.destination);
    if (!destination || !plan.pages.some(item => item.path === destination)) {
      throw Error("Resolve each visitor action to an exact proposed Page");
    }
    const id = uuid(action.id);
    if (allocated.has(id)) throw Error("Duplicate Page, Section or Action identity");
    allocated.add(id);
    return { proposal, seoDescription: supported.seoDescription,
      action: { id, type, from: page.slug, destination, label: supported.action } };
  });
  const evidence = selection.improvement === undefined ? undefined : object(selection.improvement, ["inquiryId", "draftDigest", "pagePath"]);
  const improvement = evidence && { inquiryId: uuid(evidence.inquiryId), draftDigest: hash(evidence.draftDigest), pagePath: evidence.pagePath };
  if (improvement && !seen.has(improvement.pagePath as string)) throw Error("Improvement Page must be reviewed");
  return { scope, inputDigest: expectedDigest as string, navigation: plan.pages.map(page => page.path), pages,
    ...(improvement && { improvement }) };
}
