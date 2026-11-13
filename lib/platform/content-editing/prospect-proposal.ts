import { fingerprint } from "../canonical/model";
import type { Answers } from "../intake/model";
import { prospectDirection } from "../intake/prospect-direction";
import type { PageProposal } from "./proposal";
import type { interviewDirection } from "../intake/interview-direction";

/** Add reviewed editorial copy around a caller's existing, canonical-backed Page input. */
export function composeProspectPage(
  page: PageProposal,
  sectionId: string,
  answers: Answers,
  context: { version: number; evidenceDigest: string; finding?: NonNullable<ReturnType<typeof interviewDirection>> },
): PageProposal {
  const direction = prospectDirection(answers);
  if (!direction || !Number.isSafeInteger(context.version) || context.version < 1 ||
      !/^[a-f0-9]{64}$/u.test(context.evidenceDigest) || page.sections.some(section => section.id === sectionId)) {
    throw Error("Exact planning evidence and a new Section identity required");
  }
  const { heading, body, action } = direction.primary;
  const binding = fingerprint({ context, primary: action, pageId: page.pageId, slug: page.slug });
  const rationale = `Proposed prospect path: ${action}. Draft v${context.version}, planning binding ${binding}.` +
    (context.finding ? ` Interview finding ${context.finding.findingId} informs the direction. Review the cited answer and the unresolved evidence before using it.` : "");
  return { ...page, sections: [...page.sections, {
    id: sectionId, type: "intro",
    heading: { kind: "editorial", text: heading, rationale },
    text: { kind: "editorial", text: body, rationale },
  }] };
}
