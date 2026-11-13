import { fingerprint, uuid } from "../canonical/model";
import type { Answers } from "../intake/model";
import { prospectDirection } from "../intake/prospect-direction";
import type { PageProposal } from "./proposal";
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
  if (!direction || !Number.isSafeInteger(context.version) || context.version < 1 ||
      !/^[a-f0-9]{64}$/u.test(context.evidenceDigest) || identities.some(id => page.sections.some(section => section.id === id))) {
    throw Error("Exact planning evidence and a new Section identity required");
  }
  const { heading, body, action } = direction.primary;
  const binding = fingerprint({ context, primary: action, pageId: page.pageId, slug: page.slug });
  const rationale = `Proposed prospect path: ${action}. Draft v${context.version}, planning binding ${binding}.` +
    (context.finding ? ` Interview finding ${context.finding.findingId} informs the direction. Review the cited answer and the unresolved evidence before using it.` : "");
  const plannedPage = context.finding?.plan?.pages.find(item => item.path === page.slug);
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
  if (identities.length !== 1) throw Error("A new Section identity is required");
  return { ...page, sections: [...page.sections, {
    id: identities[0], type: "intro",
    heading: { kind: "editorial", text: heading, rationale },
    text: { kind: "editorial", text: body, rationale },
  }] };
}
